/* messy_hour.js — #messyhour (oct 17). Messy on da Docks is open ONE HOUR a night (9–10 PM by default) so everyone
   looking is on the dock at the same time instead of trickling in alone. 58 searches, 0 matches said it all.
     · the arcade card says when the door opens (OPENS 9 PM · 2h 14m) and goes neon when it's open
     · inside, outside the hour: GET MESSY is replaced by a closed door with a countdown. The card (age, body, who
       you're into) can still be set up any time — that's the point of the wait
     · 🔔 PING ME WHEN IT OPENS — on by default for everyone who set Messy up; the server pushes the moment the
       door opens (push-messy). This also posts the phone's watch (asks once) so the push can reach it
     · inside the hour: a "CLOSES IN 41m" line so people don't wander off mid-hour
   Server: dates_hours (the Keymaster changes the hour there) · dates_window() · dates_remind(on) · messy_tick cron.
   #messyboard (oct 19) — the hour moved to 10–11 PM, and Messy has something to do between hours:
     · I'M COMING TONIGHT — tap it and you're counted; everyone sees "5 coming tonight · 2 for you", so people show
       up at 10 knowing someone will be there (dates_rsvp_set / dates_rsvp_count)
     · THE DOCK BOARD — a short anonymous note (200 chars), seen only by people you could match with, gone in 48 h.
       Anyone can answer privately; the two of you trade notes, both anonymous, until the note expires. No numbers,
       handles or socials (the server refuses them); two reports take a note down; suspended members can't post.
     · the "OPEN ALL NIGHT" badge on the Messy header now says the real hour
   Load once from index.html, after radio_book.js:  <script src="messy_hour.js?v=oct22a" defer></script>
   oct22: RSVP is now THE HOOK (same server call); boats, live counts and the banner live in messy_boats.js. */
(function(){
  'use strict';
  if(window.__messyHour)return; window.__messyHour=true;
  var VAPID='BOIf-N1g5af_QuVRTc9AbScS5YWjUMAX8wSFjfbC4Y6KPVJvLGxzvWrgPSBb38yYvCAuKCJqAGWisb8d-vZpbss';
  var W=null, at=0, remind=true, armed=false;
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var say=function(m){ try{ toast(m); }catch(e){} };

  var st=document.createElement('style'); st.textContent=
    '.gm-messy .mh-when{position:absolute;left:0;right:0;bottom:0;padding:6px 4px 7px;text-align:center;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.12em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ffd4ea;background:#0b0509;border-top:1px solid rgba(255,61,154,.3);border-radius:0 0 inherit inherit;pointer-events:none;z-index:2}'+
    '.gm-messy .mh-when.open{color:#ff3d9a;text-shadow:0 0 10px #ff3d9a}.gm-messy{position:relative}'+
    '.mh-door{margin:8px 0 0;padding:16px 14px;border-radius:14px;background:linear-gradient(180deg,#1a0a14,#0b0509);border:1px solid rgba(255,61,154,.35);text-align:center}'+
    '.mh-door .k{font:700 11px Inter,system-ui,sans-serif;letter-spacing:.2em;color:#d7a8c0}.mh-door .t{font:400 44px Anton,sans-serif;letter-spacing:.04em;color:#ff3d9a;text-shadow:0 0 18px #ff3d9a77;line-height:1;margin:6px 0 4px}'+
    '.mh-door .s{font:600 13px Inter,system-ui,sans-serif;color:#a89aa3;line-height:1.5}.mh-door .s b{color:#fff}'+
    '.mh-door .ping{display:inline-flex;align-items:center;gap:8px;margin-top:12px;height:38px;padding:0 14px;border-radius:19px;border:1px solid rgba(255,61,154,.45);background:none;color:#ffd4ea;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.14em;cursor:pointer}.mh-door .ping.on{background:#ff3d9a;border-color:#ff3d9a;color:#fff;box-shadow:0 0 14px #ff3d9a66}'+
    '.mh-left{margin:-4px 0 8px;text-align:center;font:700 12px Inter,system-ui,sans-serif;letter-spacing:.12em;color:#ff3d9a}'+
    '.mh-rsvp{margin:12px 0 0;padding:12px 14px;border-radius:14px;background:#140a10;border:1px solid rgba(255,61,154,.25);display:flex;align-items:center;gap:12px}.mh-rsvp .n{flex:1;min-width:0;font:600 13px Inter,system-ui,sans-serif;color:#d7a8c0;line-height:1.4}.mh-rsvp .n b{font:400 22px Anton,sans-serif;color:#ff3d9a;letter-spacing:.03em;margin-right:4px}.mh-rsvp button{flex:none;height:40px;padding:0 14px;border-radius:20px;border:1px solid #ff3d9a;background:none;color:#ffd4ea;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.14em;cursor:pointer}.mh-rsvp button.on{background:#ff3d9a;color:#fff;box-shadow:0 0 14px #ff3d9a66}'+
    '.mh-board{margin:14px 0 6px;padding:14px;border-radius:14px;background:#0d0710;border:1px solid rgba(185,166,255,.25)}.mh-board .hd{display:flex;align-items:baseline;gap:8px;margin:0 0 4px}.mh-board .hd b{font:400 18px Anton,sans-serif;letter-spacing:.06em;color:#e9dcff}.mh-board .hd small{margin-left:auto;font:600 11px Inter,system-ui,sans-serif;color:#9a8fb0}.mh-board .sub{font:500 12px Inter,system-ui,sans-serif;color:#9a8fb0;margin:0 0 10px;line-height:1.45}'+
    '.mh-board textarea{box-sizing:border-box;width:100%;min-height:62px;resize:none;border-radius:10px;border:1px solid rgba(185,166,255,.3);background:#000;color:#fff;font:500 15px Inter,system-ui,sans-serif;padding:9px 11px;outline:none}.mh-board textarea:focus{border-color:#ff3d9a}.mh-board .row{display:flex;align-items:center;gap:8px;margin-top:6px}.mh-board .row i{font-style:normal;font:600 11px Inter,system-ui,sans-serif;color:#7d7393}.mh-board .post{margin-left:auto;height:36px;padding:0 16px;border-radius:18px;border:0;background:linear-gradient(180deg,#ff5bab,#e02a85);color:#fff;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.14em;cursor:pointer}.mh-board .post:disabled{opacity:.5}'+
    '.mh-tabs{display:flex;gap:6px;margin:12px 0 8px}.mh-tabs button{flex:1;height:32px;border-radius:9px;border:1px solid rgba(185,166,255,.2);background:none;color:#9a8fb0;font:700 11px "Barlow Condensed",sans-serif;letter-spacing:.14em;cursor:pointer}.mh-tabs button.on{color:#fff;border-color:#ff3d9a}.mh-tabs button em{font-style:normal;display:inline-block;min-width:16px;height:16px;line-height:16px;margin-left:5px;border-radius:8px;background:#ff3d9a;color:#fff;font-size:10px}'+
    '.mh-note{padding:11px 12px;border-radius:12px;background:#160d1a;border:1px solid rgba(185,166,255,.12);margin-bottom:8px}.mh-note .who{font:700 10px Inter,system-ui,sans-serif;letter-spacing:.14em;color:#ff7ab8;margin-bottom:5px}.mh-note .who span{color:#7d7393;letter-spacing:.04em;font-weight:600}.mh-note p{margin:0;font:500 15px Inter,system-ui,sans-serif;color:#f1e8ff;line-height:1.4;overflow-wrap:anywhere}'+
    '.mh-note .acts{display:flex;gap:6px;margin-top:8px}.mh-note .acts button{height:28px;padding:0 11px;border-radius:14px;border:1px solid rgba(185,166,255,.25);background:none;color:#d8ccf0;font:700 11px Inter,system-ui,sans-serif;cursor:pointer}.mh-note .acts .rep{margin-left:auto;color:#7d7393;border-color:transparent}'+
    '.mh-th .msg{max-width:85%;margin:6px 0;padding:7px 10px;border-radius:12px;font:500 14px Inter,system-ui,sans-serif;line-height:1.4;overflow-wrap:anywhere}.mh-th .msg.me{margin-left:auto;background:#ff3d9a;color:#fff;border-bottom-right-radius:4px}.mh-th .msg.them{background:#241830;color:#f1e8ff;border-bottom-left-radius:4px}.mh-th .say{display:flex;gap:6px;margin-top:8px}.mh-th .say input{flex:1;min-width:0;height:38px;border-radius:19px;border:1px solid rgba(185,166,255,.3);background:#000;color:#fff;font:500 15px Inter,system-ui,sans-serif;padding:0 14px;outline:none}.mh-th .say button{flex:none;height:38px;padding:0 14px;border-radius:19px;border:0;background:#ff3d9a;color:#fff;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer}'+
    '.mh-empty{padding:18px 6px;text-align:center;color:#7d7393;font:500 13px Inter,system-ui,sans-serif;line-height:1.5}';
  document.head.appendChild(st);

  function fetchW(cb){ if(!window.SB)return; window.SB.rpc('dates_window').then(function(r){ if(r.error||!r.data)return; W=r.data; at=Date.now(); cb&&cb(); },function(){}); }
  function ms(iso){ var t=Date.parse(iso||''); return isNaN(t)?0:t-Date.now(); }
  function dur(m,short){ if(m<0)m=0; var s=Math.floor(m/1000), h=Math.floor(s/3600), mi=Math.floor(s%3600/60), se=s%60;
    if(short)return h>0?h+'h '+mi+'m':mi+'m'; return (h>0?h+':':'')+(h>0&&mi<10?'0':'')+mi+':'+(se<10?'0':'')+se; }
  function when(iso){ var d=new Date(iso); var h=d.getHours(),m=d.getMinutes(); return (h%12||12)+(m?':'+(m<10?'0':'')+m:'')+(h<12?' AM':' PM'); }
  function isOpen(){ if(!W)return true; if(W.always)return true; if(W.open)return ms(W.closes_at)>0; return ms(W.opens_at)<=0; }

  /* the arcade card */
  function card(){
    var c=document.querySelector('.hcard.gm-messy'); if(!c||!W||W.always)return;
    var b=c.querySelector('.mh-when'); if(!b){ b=document.createElement('div'); b.className='mh-when'; c.appendChild(b); }
    var open=isOpen();
    var left=ms(W.opens_at), txt=open?'\u25CF OPEN \u00B7 '+dur(ms(W.closes_at),true)+' LEFT':left<3600000?'OPENS IN '+dur(left,true):'OPENS AT '+when(W.opens_at);   /* short: the card is narrow */
    if(b.classList.contains('open')!==open)b.classList.toggle('open',open);
    if(b.textContent!==txt)b.textContent=txt;   /* only when it changes: the observer below watches the whole page */
  }

  /* the door inside */
  function door(){
    var go=document.getElementById('msyGo'); if(!go||!W||W.always)return;
    var body=go.parentNode, old=body.querySelector('.mh-door'), left=body.querySelector('.mh-left');
    if(isOpen()){
      if(old)old.remove(); go.style.display=''; if(go.hasAttribute('data-mh')){ go.disabled=go.getAttribute('data-mh')==='1'; go.removeAttribute('data-mh'); }
      if(!left){ left=document.createElement('div'); left.className='mh-left'; body.insertBefore(left,go); }
      var lt='\u25CF THE DOOR IS OPEN \u00B7 CLOSES IN '+dur(ms(W.closes_at)); if(left.textContent!==lt)left.textContent=lt;
      return;
    }
    if(left)left.remove();
    go.style.display='none'; if(!go.hasAttribute('data-mh')){ go.setAttribute('data-mh',go.disabled?'1':'0'); go.disabled=true; }
    if(!old){
      old=document.createElement('div'); old.className='mh-door';
      old.innerHTML='<div class="k">THE DOOR OPENS AT '+E(when(W.opens_at).toUpperCase())+'</div><div class="t" data-mh="t"></div>'+
        '<div class="s">Messy is open <b>one hour a night</b> \u00B7 '+E(W.label||'')+'<br>Everybody looking is on the dock at once \u2014 that\u2019s how you match.<br>Set up your card now so you\u2019re ready.</div>'+
        '<button type="button" class="ping'+(remind?' on':'')+'">\uD83D\uDD14 '+(remind?'PINGING YOU WHEN IT OPENS':'PING ME WHEN IT OPENS')+'</button>';
      body.insertBefore(old,go);
      old.querySelector('.ping').addEventListener('click',function(){ var b=this; remind=!remind; b.classList.toggle('on',remind); b.textContent='\uD83D\uDD14 '+(remind?'PINGING YOU WHEN IT OPENS':'PING ME WHEN IT OPENS');
        if(window.SB)window.SB.rpc('dates_remind',{p_on:remind}).then(function(){},function(){}); if(remind)arm(); });
    }
    var t=old.querySelector('[data-mh="t"]'), tt=dur(ms(W.opens_at)); if(t&&t.textContent!==tt)t.textContent=tt;
  }
  /* read "remind" + the window straight off the door's own answer (dates_eligible carries both now) */
  function peek(){
    if(!window.SB||!window.__shkUid)return;
    window.SB.rpc('dates_eligible').then(function(r){ var d=r&&r.data; if(!d)return; if(d.window){ W=d.window; at=Date.now(); } if(typeof d.remind==='boolean')remind=d.remind; door(); card(); },function(){});
  }

  /* the phone's watch, so the push can land (members only had one if they'd turned on odds alerts) */
  function b64u8(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')), a=new Uint8Array(r.length); for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i); return a; }
  async function arm(){
    try{
      if(armed||!window.SB||!window.__shkUid||!('Notification' in window)||!navigator.serviceWorker)return;
      var reg=window.SW_REG||await navigator.serviceWorker.ready; if(!reg||!reg.pushManager)return;
      if(Notification.permission==='default'){ var p=await Notification.requestPermission(); if(p!=='granted')return; }
      if(Notification.permission!=='granted')return;
      var sub=await reg.pushManager.getSubscription(); if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u8(VAPID)});
      var j=sub.toJSON();
      await window.SB.from('push_subs').upsert({endpoint:sub.endpoint,p256dh:j.keys&&j.keys.p256dh||'',auth:j.keys&&j.keys.auth||'',handle:(typeof loadAcct==='function'&&(loadAcct()||{}).handle)||null,km:!!window.__isKM,uid:window.__shkUid||null,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      armed=true;
    }catch(e){ try{ console.warn('messy_hour arm',e); }catch(x){} }
  }

  /* the push's link opens the door */
  function fromPush(){ try{ if(/[?&]open=dates\b/.test(location.search)&&typeof window.gameOpen==='function'){ setTimeout(function(){ try{ gameOpen('dates'); }catch(e){} },1800); history.replaceState(null,'',location.pathname); } }catch(e){} }


  /* ---------- #messyboard: I'M COMING TONIGHT + THE DOCK BOARD ---------- */
  var AGE={a:'18–24',b:'25–34',c:'35–44',d:'45–54',e:'55+'}, SEXW={m:'MAN',w:'WOMAN'};
  /* the example in the empty note box — rotates hourly; plain, friendly, nothing that reads like a hire */
  var EX=['Into hiking and taco trucks. Say hi at 10.','Love to cook, need someone to try it. On at 10.','Looking for a friend to grab a beer with.','Old school, looking for something real. Maybe a wife someday.','Fishing on my days off. Who else? On at 10.','Dodgers fan, decent cook, terrible dancer. Say hello.','Looking for good people to talk to.','Gym in the morning, movies on Sunday.'];
  var RS=null, FEED=[], INBOX=[], tab='board', openTh=null, bBusy=false, bAt=0;
  function ago(iso){ var m=Math.max(0,Math.round((Date.now()-Date.parse(iso))/60000)); return m<1?'just now':m<60?m+'m ago':Math.round(m/60)+'h ago'; }
  function rpc(fn,args){ return window.SB?window.SB.rpc(fn,args||{}):Promise.reject(); }
  function loadBoard(){
    if(!window.SB||!window.__shkUid)return; bAt=Date.now();
    rpc('dates_rsvp_count').then(function(r){ if(r.data)RS=r.data; paintBoard(); },function(){});
    rpc('dates_notes_feed').then(function(r){ if(Array.isArray(r.data))FEED=r.data; paintBoard(); },function(){});
    rpc('dates_inbox').then(function(r){ if(Array.isArray(r.data))INBOX=r.data; paintBoard(); },function(){});
  }
  function shell(){
    var go=document.getElementById('msyGo'); if(!go)return null;
    var body=go.parentNode, b=body.querySelector('.mh-board-wrap');
    if(!b){ b=document.createElement('div'); b.className='mh-board-wrap'; var after=go; if(go.nextSibling)body.insertBefore(b,go.nextSibling); else body.appendChild(b); wire(b); loadBoard(); }
    return b;
  }
  var pend=false;
  function paintBoard(){
    var b=shell(); if(!b)return;
    var ae=document.activeElement; if(ae&&b.contains(ae)&&ae.tagName==='TEXTAREA'){ if(!pend){ pend=true; ae.addEventListener('blur',function(){ pend=false; setTimeout(paintBoard,200); },{once:true}); } return; }
    var unread=INBOX.reduce(function(a,t){ return a+(+t.unread||0); },0);
    var rs=RS?'<div class="mh-rsvp"><div class="n"><b>'+(+RS.coming||0)+'</b>hook'+((+RS.coming||0)===1?'':'s')+' in tonight'+(RS.for_you!=null?' \u00B7 <span style="color:#fff">'+(+RS.for_you||0)+' for you</span>':'')+'<br><span style="font-size:11px;color:#9a8fb0">'+E(W&&W.label||'10:00 PM \u2013 11:00 PM')+(RS.mine?' \u00B7 we\u2019ll ping you the moment someone for you steps on':' \u00B7 put your hook in and we ping you when someone for you steps on, and before every boat')+'</span></div><button type="button" data-mb="rsvp" class="'+(RS.mine?'on':'')+'">'+(RS.mine?'\u2713 HOOK\u2019S IN':'\uD83E\uDE9D HOOK IN FOR TONIGHT')+'</button></div>':'';
    var list;
    if(tab==='board'){
      list=FEED.length?FEED.map(function(n){
        return '<div class="mh-note"><div class="who">'+(n.mine?'YOUR NOTE':(SEXW[n.sex]||'')+(AGE[n.age]?' \u00B7 '+AGE[n.age]:''))+' <span>\u00B7 '+ago(n.at)+'</span></div><p>'+E(n.body)+'</p><div class="acts">'+
          (n.mine?'<button type="button" data-mb="del" data-id="'+n.id+'">TAKE IT DOWN</button>':'<button type="button" data-mb="ans" data-id="'+n.id+'">'+(n.replied?'\uD83D\uDCAC KEEP TALKING':'\uD83D\uDC8C ANSWER PRIVATELY')+'</button><button type="button" class="rep" data-mb="rep" data-id="'+n.id+'">\uD83D\uDEA9</button>')+'</div></div>'; }).join('')
        :'<div class="mh-empty">The board is quiet. Say what you\u2019re into \u2014 hiking, cooking,<br>a beer with friends \u2014 whoever reads it next could be on at 10.</div>';
    } else {
      list=INBOX.length?INBOX.map(function(t){
        var open=openTh===t.thread;
        return '<div class="mh-note mh-th" data-th="'+t.thread+'"><div class="who">'+(t.i_wrote_note?'ANSWER TO YOUR NOTE':'YOU ANSWERED A NOTE')+(t.unread>0?' <span style="color:#ff3d9a">\u00B7 '+t.unread+' new</span>':'')+'</div><p style="font-size:13px;color:#9a8fb0">\u201C'+E(t.note_body)+'\u2026\u201D</p>'+
          (open?(t.msgs||[]).map(function(m){ return '<div class="msg '+(m.me?'me':'them')+'">'+E(m.body)+'</div>'; }).join('')+'<div class="say"><input maxlength="300" placeholder="Say something\u2026" data-mb-in="'+t.thread+'"><button type="button" data-mb="send" data-th="'+t.thread+'">SEND</button></div>'
               :'<div class="acts"><button type="button" data-mb="open" data-th="'+t.thread+'">OPEN \u00B7 '+(t.msgs||[]).length+' note'+((t.msgs||[]).length===1?'':'s')+'</button></div>')+'</div>'; }).join('')
        :'<div class="mh-empty">No answers yet. Answer a note on the board,<br>or leave one \u2014 replies land here.</div>';
    }
    var focusTh=document.activeElement&&document.activeElement.getAttribute&&document.activeElement.getAttribute('data-mb-in'), keep=focusTh?document.activeElement.value:'';
    var draft=b.querySelector('textarea'); var dv=draft?draft.value:'';
    b.innerHTML=rs+'<div class="mh-board"><div class="hd"><b>THE DOCK BOARD</b><small>gone in 48h</small></div><div class="sub">Leave a note for whoever comes by. Only people you could match with see it. Keep it about <b>you</b> \u2014 no names, numbers, or where you work. Answers are private.</div>'+
      '<textarea maxlength="200" placeholder="'+E(EX[Math.floor(Date.now()/36e5)%EX.length])+'"></textarea><div class="row"><i data-mb="cnt">200</i><button type="button" class="post" data-mb="post">POST NOTE</button></div>'+
      '<div class="mh-tabs"><button type="button" data-mb="tab" data-t="board" class="'+(tab==='board'?'on':'')+'">THE BOARD</button><button type="button" data-mb="tab" data-t="inbox" class="'+(tab==='inbox'?'on':'')+'">YOUR NOTES'+(unread?'<em>'+unread+'</em>':'')+'</button></div>'+list+'</div>';
    var ta=b.querySelector('textarea'); if(ta&&dv){ ta.value=dv; }
    if(focusTh){ var inp=b.querySelector('[data-mb-in="'+focusTh+'"]'); if(inp){ inp.value=keep; inp.focus(); } }
  }
  function wire(b){
    b.addEventListener('input',function(e){ if(e.target.tagName==='TEXTAREA'){ var c=b.querySelector('[data-mb="cnt"]'); if(c)c.textContent=String(200-e.target.value.length); } });
    b.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target.hasAttribute('data-mb-in')){ e.preventDefault(); send(e.target.getAttribute('data-mb-in')); } });
    b.addEventListener('click',function(e){
      var x=e.target.closest('[data-mb]'); if(!x)return; var k=x.getAttribute('data-mb'), id=+x.getAttribute('data-id')||null;
      if(k==='rsvp'){ var on=!(RS&&RS.mine); rpc('dates_rsvp_set',{p_on:on}).then(function(r){ if(r.data&&r.data.ok===false){ say(r.data.why); return; } if(r.data)RS=r.data; if(on){ say('\uD83E\uDE9D Hook\u2019s in. We ping you before every boat.'); if(!remind){ remind=true; rpc('dates_remind',{p_on:true}).then(function(){},function(){}); } arm(); } paintBoard(); }); return; }
      if(k==='post'){ var ta=b.querySelector('textarea'), v=(ta.value||'').trim(); if(v.length<3){ say('Say a little more.'); return; } if(bBusy)return; bBusy=true; x.disabled=true;
        rpc('dates_note_post',{p_body:v}).then(function(r){ bBusy=false; x.disabled=false; if(!r.data||r.data.ok===false){ say('\u2717 '+((r.data&&r.data.why)||'didn\u2019t post')); return; } ta.value=''; say('\u2713 Your note is on the board for 48 hours.'); tab='board'; loadBoard(); },function(){ bBusy=false; x.disabled=false; say('\u2717 No connection.'); }); return; }
      if(k==='tab'){ tab=x.getAttribute('data-t'); paintBoard(); if(tab==='inbox')loadBoard(); return; }
      if(k==='del'){ if(x.getAttribute('data-arm')!=='1'){ x.setAttribute('data-arm','1'); x.textContent='TAP AGAIN'; return; } rpc('dates_note_delete',{p_id:id}).then(function(){ loadBoard(); }); return; }
      if(k==='rep'){ rpc('dates_note_report',{p_id:id}).then(function(){ say('\uD83D\uDEA9 Reported. Thanks for keeping it clean.'); FEED=FEED.filter(function(n){ return n.id!==id; }); paintBoard(); }); return; }
      if(k==='ans'){ var ex=INBOX.filter(function(t){ return t.note===id&&!t.i_wrote_note; })[0];
        if(ex){ tab='inbox'; openTh=ex.thread; paintBoard(); return; }
        var v2=prompt('Answer privately \u2014 they won\u2019t know who you are:'); if(!v2||!v2.trim())return;
        rpc('dates_note_reply',{p_note:id,p_thread:null,p_body:v2.trim()}).then(function(r){ if(!r.data||r.data.ok===false){ say('\u2717 '+((r.data&&r.data.why)||'didn\u2019t send')); return; } say('\uD83D\uDC8C Sent. Their answer lands in YOUR NOTES.'); tab='inbox'; openTh=r.data.thread; loadBoard(); }); return; }
      if(k==='open'){ openTh=+x.getAttribute('data-th'); paintBoard(); rpc('dates_inbox_seen',{p_thread:openTh}).then(function(){ INBOX.forEach(function(t){ if(t.thread===openTh)t.unread=0; }); paintBoard(); },function(){}); return; }
      if(k==='send'){ send(x.getAttribute('data-th')); return; }
    });
  }
  function send(th){
    var b=shell(); if(!b)return; var inp=b.querySelector('[data-mb-in="'+th+'"]'); var v=(inp&&inp.value||'').trim(); if(!v)return; inp.value='';
    rpc('dates_note_reply',{p_note:null,p_thread:+th,p_body:v}).then(function(r){ if(!r.data||r.data.ok===false){ say('\u2717 '+((r.data&&r.data.why)||'didn\u2019t send')); return; } loadBoard(); },function(){ say('\u2717 No connection.'); });
  }
  /* the header badge said OPEN ALL NIGHT */
  var bdgAt=0;
  function badge(){
    if(!W||W.always||Date.now()-bdgAt<5000)return; var go=document.getElementById('msyGo'); if(!go)return; bdgAt=Date.now();
    var root=go.closest('.sheet,.game,#gameSheet')||go.parentNode.parentNode||document.body;
    var lab='OPEN '+String(W.label||'10:00 PM \u2013 11:00 PM').replace(/:00/g,'').replace(/ PM \u2013 /,'\u2013');
    root.querySelectorAll('*').forEach(function(el){ var t=(el.textContent||'').replace(/\s+/g,' ').trim(); if(/^OPEN\s*ALL\s*NIGHT$/i.test(t)&&!el.querySelector('*:not(br)'))el.textContent=lab; });
  }
  var seenGo=null;
  new MutationObserver(function(){
    var go=document.getElementById('msyGo');
    if(go&&go!==seenGo){ seenGo=go; peek(); shell(); }
    if(!go)seenGo=null;
    card();
  }).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){ door(); card(); badge(); if(document.getElementById('msyGo')&&Date.now()-bAt>60*1000)loadBoard(); if(Date.now()-at>5*60*1000&&window.__shkUid)fetchW(function(){ door(); card(); }); },1000);
  var lastUid=null; setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; if(u){ fetchW(function(){ card(); }); setTimeout(fromPush,500); } } },1000);
  window.messyHour=function(){ return W; };
})();
