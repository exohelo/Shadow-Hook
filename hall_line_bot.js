/* hall_line_bot.js — #hallbot (oct 17). The Chamber's Hall Line job used to open the member's phone dialer and
   leave them to listen and type the card. Now "☎ Send the bot" has the Order's bot make the call:
     tap → edge function hall-line-call (claims the call slot as you: same 2-calls / 5-min / one-caller rules)
         → GitHub workflow hall-line.yml → Twilio dials the hall → Whisper transcribes → the card lands on
           board_wire + hall_line_log → every phone picks it up, and the job is credited to whoever tapped
           (sc.js already does that for the caller the moment the end card is on the record).
   While the bot is out the card says so; if it comes back without a card (or nothing in 10 min) the slot is
   handed back so the second call / cooldown works as before. "Type the end card in" still shows when both
   calls are used. Nothing here touches the bot's own schedule or cost guards.
   Load once from index.html, after chamber_sheet.js:  <script src="hall_line_bot.js?v=oct17a" defer></script> */
(function(){
  'use strict';
  if(window.__hallBot)return; window.__hallBot=true;
  var LS='shk_hallbot', WAIT=10*60*1000, POLL=15000;
  var run=null; /* {k, at, uid} */
  try{ run=JSON.parse(sessionStorage.getItem(LS)||'null'); if(run&&Date.now()-run.at>WAIT)run=null; }catch(e){ run=null; }
  var say=function(m){ try{ toast(m); }catch(e){} };
  var buzz=function(p){ try{ navigator.vibrate&&navigator.vibrate(p); }catch(e){} };
  function save(){ try{ run?sessionStorage.setItem(LS,JSON.stringify(run)):sessionStorage.removeItem(LS); }catch(e){} }

  /* ---------- the tap ---------- */
  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('#scChamber [data-sch="call"], #scChamber [data-sch="hangup"]'); if(!b)return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    if(b.getAttribute('data-sch')==='hangup')return;          /* the bot hangs up by itself */
    if(b.disabled||!window.SB)return;
    var k=b.getAttribute('data-k'); if(!k)return;
    b.disabled=true; b.innerHTML='\u260E Sending the bot\u2026';
    window.SB.functions.invoke('hall-line-call',{body:{key:k}}).then(async function(r){
      var j=r.data;
      if(r.error){ try{ j=await r.error.context.json(); }catch(e){ j={ok:false,why:'error',err:r.error.message}; } }
      if(!j||!j.ok){
        var why=j&&j.why;
        say(why==='busy'?'\u260E '+(j.by||'Someone')+' already has the line.':why==='done'?'\u2713 Already logged.':why==='spent'?'Both calls were used on this board.':
            why==='cooldown'?'The next call opens in a few minutes.':why==='bot'?'\u2717 The bot couldn\u2019t leave \u2014 '+(j.err||'try again'):'\u2717 '+(j&&j.err||'Not now.'));
        buzz([30,30,30]); b.disabled=false; b.innerHTML='\u260E Send the bot to call'; return;
      }
      var uid=window.__shkUid||null;
      if(!run||run.k!==k){ run={k:k,at:Date.now(),uid:uid}; save(); }
      buzz([15]); say('\u260E The bot is calling the hall. The card posts itself in about 3 minutes.');
      paint(); watch();
    },function(){ b.disabled=false; b.innerHTML='\u260E Send the bot to call'; say('\u2717 No connection. Try again.'); });
  },true);

  /* ---------- waiting for the bot ---------- */
  var timer=null;
  function finish(msg,good){
    var k=run&&run.k; run=null; save(); clearTimeout(timer); timer=null;
    if(!good&&k&&window.SB)window.SB.rpc('sc_hall_hangup',{p_key:k}).then(function(){},function(){});
    msg&&say(msg); buzz(good?[20,40,20]:[30,30,30]); paint();
  }
  function stillDue(k){
    try{ return window.HOUSE_CHORES.list().some(function(t){ return t.kind==='log'&&t.key===k; }); }catch(e){ return true; }
  }
  function watch(){
    clearTimeout(timer); if(!run||!window.SB)return;
    if(!stillDue(run.k)){ finish('\u2713 The bot got the end card. It\u2019s on the record.',true); return; }
    if(Date.now()-run.at>WAIT){ finish('The bot didn\u2019t bring back a card. Call again or type it in.',false); return; }
    var since=new Date(run.at-30000).toISOString();
    window.SB.from('hall_line_log').select('id,ran_at,card,conf,posted').gte('ran_at',since).order('id',{ascending:false}).limit(1).then(function(r){
      var row=r&&!r.error&&r.data&&r.data[0];
      if(row&&row.posted){ /* the wire takes a moment to reach the chores list; the job clears itself */ setTimeout(function(){ if(run&&!stillDue(run.k))finish('\u2713 The bot heard '+(row.card||'the card')+'. It\u2019s on the record.',true); },4000); }
      else if(row&&!row.posted){ finish(row.card?'The bot heard '+row.card+' but wasn\u2019t sure enough to post it. Check it and type it in.':'The bot called but couldn\u2019t make out a card. Call again or type it in.',false); return; }
      timer=setTimeout(watch,POLL);
    },function(){ timer=setTimeout(watch,POLL); });
  }

  /* ---------- the card's words ---------- */
  function paint(){
    var job=document.querySelector('#scChamber .sc-job[data-scjob="log"]'); if(!job)return;
    var btn=job.querySelector('[data-sch="call"]'), hot=job.querySelector('.hd .hot'), hang=job.querySelector('[data-sch="hangup"]');
    var mine=run&&btn&&btn.getAttribute('data-k')===run.k;
    if(mine){
      if(hot&&!hot.__hb){ hot.__hb=1; hot.innerHTML='<span class="sc-pulse"></span>The bot is on the line \u00B7 the card posts itself'; }
      if(btn&&!btn.__hb){ btn.__hb=1; btn.disabled=true; btn.innerHTML='\u260E The bot is calling\u2026'; }
      if(hang)hang.style.display='none';
      job.querySelectorAll('.sc-rules > div').forEach(function(d){ var s=d.querySelector('span'); if(s&&/on the line/i.test(s.textContent)){ var bb=d.querySelector('b'); if(bb&&bb.textContent!=='The bot')bb.textContent='The bot'; } });
    } else if(btn&&!btn.disabled&&/Call the Hall Line\s*$/i.test(btn.textContent)&&!btn.__hb2){
      btn.__hb2=1; btn.innerHTML='\u260E Send the bot to call';
    }
    job.querySelectorAll('.sc-p.dim').forEach(function(p){ if(/hall bot only knows/i.test(p.textContent)&&!p.__hb){ p.__hb=1;
      p.textContent='Tap and the Order\u2019s bot calls the hall, listens to the recording and posts the end card \u2014 about 3 minutes. Opens 10 minutes after dispatch ends; two calls per board, five minutes apart. The job is yours when the card lands.'; } });
  }
  var pt=null;
  new MutationObserver(function(){ clearTimeout(pt); pt=setTimeout(paint,60); }).observe(document.documentElement,{childList:true,subtree:true});
  if(run)setTimeout(watch,2000);
  window.hallBotStatus=function(){ return run; };
})();
