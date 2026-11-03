/* wire_v2.js — #wirev2 (oct 30). THE WIRE'S CALL, for everyone. The rebuilt engine runs on the server
   (wire_call_v2 / wire_call_v2_log): no call until the PMA sheet and the hall's forecast are both in, re-computed as
   fresher numbers land, LOCKED at 6:30 AM / 4:30 PM and never moved, graded against the end card.
   index.html still paints the IN TRAINING label (km_flags.wire_call_on stays false so the old bot can't post);
   this file paints over it with the v2 call: the stop letter in the big slot, the band · letters · start card · lock
   under it, the inputs, and the last six graded boards. Polls every 60 s; nothing here writes anything.
   Load once from index.html, after hand_counts.js:  <script src="wire_v2.js?v=oct31e" defer></script> */
(function(){
  'use strict';
  if(window.__wireV2)return; window.__wireV2=true;
  var rows=null, t=null, mark='data-v2', LS='shadowhook_wire_v2';
  /* #oct31(flash): paint the last call this phone saw the instant the Wire exists, so the old label never gets the screen first */
  try{ var cached=JSON.parse(localStorage.getItem(LS)||'null'); if(cached&&cached.rows&&Date.now()-cached.at<36*3600e3)rows=cached.rows; }catch(e){}
  function css(){ if(document.getElementById('v2CSS'))return; var s=document.createElement('style'); s.id='v2CSS'; s.textContent=
    '#wMoves .v2b{font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.06em;color:#dcd6c9}#wMoves .v2i{display:block;margin-top:3px;font:600 11px Inter,system-ui,sans-serif;color:#8f979e;line-height:1.5}'+
    '#wMoves .v2g{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(220,214,201,.08);font:600 11px Inter,system-ui,sans-serif;color:#8f979e}#wMoves .v2g b{color:#dcd6c9}#wMoves .v2g .ok{color:#7fcf8a}#wMoves .v2g .bad{color:#e8967a}'+
    '#wMoves .v2lock{color:#eeb46b}';
    document.head.appendChild(s); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function lbl(k){ var d=new Date(k.slice(0,10)+'T12:00:00'); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+(d.getMonth()+1)+'/'+d.getDate()+' '+(k.slice(-2)==='AM'?'day':'night'); }
  function flexOf(k){ return new Date(k.slice(0,10)+'T'+(k.slice(-2)==='AM'?'06:30':'16:30')+':00'); }
  function when(x){ var d=new Date(x); var h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?'a':'p'); }
  /* the board that's running stays on the Wire until its dispatch is over (day ~9:40, night ~7:00): the morning board
     until 10:00, the night board until 7:30 PM, then the next one. Switching at the flex hid the live board's call. */
  function upcomingKey(){ var n=new Date(), m=n.getHours()*60+n.getMinutes(), d=new Date(n), sh='AM';
    if(m<10*60){ sh='AM'; } else if(m<19*60+30){ sh='PM'; } else { d.setDate(d.getDate()+1); sh='AM'; }
    var iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    return iso+'_'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+'_'+sh; }
  function nextKey(k){ var m=/^(\d{4})-(\d{2})-(\d{2})_\w{3}_(AM|PM)$/.exec(k); if(!m)return k;
    var d=new Date(+m[1],+m[2]-1,+m[3]), sh='PM'; if(m[4]==='PM'){ d.setDate(d.getDate()+1); sh='AM'; }
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'_'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+'_'+sh; }
  function paint(){
    var ps=document.getElementById('predStop'), mv=document.getElementById('wMoves'), src=document.getElementById('wSrc');
    if(!ps||!mv||!rows)return;
    css();
    var key=upcomingKey(), up=null, i;
    /* a board whose end is already on the record is done: move to the next one right away (the night board can end
       at 7:24, before the 7:30 switch, while the Dispatch Post has already moved on) */
    for(i=0;i<rows.length;i++)if(rows[i].k===key&&rows[i].actual_moved!=null){ key=nextKey(key); break; }
    for(i=0;i<rows.length;i++)if(rows[i].k===key){ up=rows[i]; break; }
    /* once a board's dispatch is over its call comes down: the Wire stands by until the next board has a call
       (it used to keep the finished board's locked call up, which read like a call for the next one) */
    var done=rows.filter(function(r){ return r.actual_moved!=null&&r.locked_letters!=null; }).slice(0,6);
    var g=done.length?'<div class="v2g">'+done.map(function(r){ var m=Math.abs(Math.round(+r.locked_letters)-r.actual_moved);   /* graded on the letters people saw: called A, landed B = 1 off = ✓ */ return '<span>'+lbl(r.k).replace(/^\w+ /,'')+' <b>'+(+r.locked_letters).toFixed(0)+'\u2192'+r.actual_moved+'</b> <i class="'+(m<=1?'ok':m<=2?'':'bad')+'">'+(m<=1?'\u2713':'\u00B1'+m.toFixed(0))+'</i></span>'; }).join('')+'</div>':'';
    if(!up){
      ps.innerHTML='<span '+mark+'="1">\u2014</span>';
      mv.innerHTML='<span '+mark+'="1"><span class="v2b">WAITING ON THE SHEETS</span><span class="v2i">An early call comes the moment the hall\u2019s early count or the PMA sheet for '+esc(lbl(key))+' is in, and sharpens with the hall\u2019s final. Locks at '+(key.slice(-2)==='AM'?'6:30 AM':'4:30 PM')+' and doesn\u2019t move after.</span>'+g+'</span>';
      if(src){ src.className='wire-src est'; src.textContent='\u26A1 WIRE \u00B7 STANDING BY'; }
      return;
    }
    var inp=up.inputs||{}, locked=!!up.locked_at, L=locked?+up.locked_letters:+up.letters, stop=locked?(up.locked_stop||up.stop):up.stop;
    /* #nov1(earlycall): before the hall gives its job count the server estimates it from PMA's total; say so */
    var early=inp.early===true;
    ps.innerHTML='<span '+mark+'="1">'+esc(stop)+'</span>';
    mv.innerHTML='<span '+mark+'="1"><span class="v2b">'+esc(up.lo)+'\u2013'+esc(up.hi)+' \u00B7 '+L.toFixed(0)+' letters from '+esc(up.start_code||'?')+' \u00B7 '+esc(lbl(up.k))+'</span>'+
      '<span class="v2i">'+(locked?'<span class="v2lock">\u{1F512} LOCKED '+when(up.locked_at)+'</span> \u00B7 the call doesn\u2019t move once dispatch starts':'locks '+when(flexOf(up.k))+' \u00B7 updated '+when(up.computed_at)+' \u00B7 moves only if the sheets change before then')+
      '<br>'+(early?'<b>EARLY CALL</b> \u00B7 '+(inp.hall_src==='early-count'?'hall\u2019s early count '+esc(inp.hall_forecast)+' jobs':'hall count estimated at ~'+esc(inp.hall_forecast)+' from PMA')+' \u00B7 PMA '+(inp.pma_src==='estimated'?'~'+esc(inp.pma_total)+' (sheet not in yet)':esc(inp.pma_total))+' \u00B7 sharpens with the hall\u2019s final after 2:30':'hall says '+esc(inp.hall_forecast)+' jobs \u00B7 PMA '+esc(inp.pma_total))+' \u00B7 last board moved '+esc(inp.prev1)+'</span>'+g+'</span>';
    if(src){ src.className='wire-src '+(locked?'lock':'est'); src.textContent='\u26A1 WIRE v2 \u00B7 '+(locked?'LOCKED':early?'EARLY CALL':'LIVE CALL'); }
    share(up,L,stop,locked,early);
    ladder(up,L,stop,locked);
  }
  /* the letter ladder (#wTrack), the chance bar (#wMeters) and the note (#wRun), drawn the way the old Wire drew them */
  function ladder(up,L,stop,locked){
    var AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ', tr=document.getElementById('wTrack'), mt=document.getElementById('wMeters'), run=document.getElementById('wRun');
    var startL=(up.start_code||'A').charAt(0).toUpperCase(), base=AZ.indexOf(startL); if(base<0)base=0;
    var med=Math.round(L), lo=Math.max(0,Math.round(L-1.5)), hi=Math.min(26,Math.round(L+1.5)), cyc=med>=26;
    var span=Math.min(26,Math.max(hi+2,med+2,8));
    var myId=null; try{ myId=typeof window.myBoardId==='function'?window.myBoardId():null; }catch(e){}
    var myDist=myId?((AZ.indexOf(String(myId).charAt(0).toUpperCase())-base)%26+26)%26:-1;
    if(tr){ var cells='', k, cls, inner;
      for(k=0;k<=span;k++){ cls='wire-cell'; inner=AZ[(base+k)%26];
        if(k>=lo&&k<=hi)cls+=' band'; if(k===0)cls+=' start'; if(k===med&&!cyc)cls+=' stop'; if(myDist===k)cls+=' youcell';
        if(k===0)inner+='<span class="tick">START</span>'; else if(k===med&&!cyc)inner+='<span class="tick">STOP</span>';
        if(myDist===k&&myDist!==0)inner='<span class="you">\uD83C\uDF83</span>'+inner;
        cells+='<div class="'+cls+'">'+inner+'</div>'; }
      tr.innerHTML=cells; tr.classList.toggle('wide',span>16); }
    if(mt){ var pm=L>=4?97:L>=2?85:L>=1?65:35;
      mt.style.display=''; mt.innerHTML='<div class="wm-move"><div class="wm-lbl">CHANCE IT MOVES<span class="pct">'+pm+'%</span></div><div class="wm-bar"><div class="wm-fill" style="width:'+pm+'%"></div></div></div>'; }
    if(run){ run.style.display='block'; run.className='wire-runaway steady';
      run.innerHTML=cyc?'the numbers say it goes <b>around the book</b>':'typical miss on this engine is about <b>2 letters</b> \u00B7 the band is where it lands most of the time \u00B7 '+(locked?'this call is locked':'locks at flex and never moves after'); }
  }
  /* the Dispatch Post card, the "your number" line and the council line all read callFor(k) = window._lastCall for
     window._publishedKey. The old bot nulls those while it's off; hand them the v2 call instead, and repaint the Hall. */
  var shared='';
  function share(up,L,stop,locked,early){
    var sig=up.k+'|'+stop+'|'+up.lo+'|'+up.hi+'|'+(locked?'L':'')+(early?'E':'');
    /* the Dispatch Post's Prediction tile prints "stops lo–hi"; an early call reads "stops W–C · early" */
    window._lastCall={stop:stop,lo:up.lo,hi:early&&!locked?up.hi+' \u00B7 early':up.hi,pmove:Math.round(L),src:'v2',k:up.k,locked:locked,early:!!early};
    window._publishedKey=up.k; window._predSource='v2';
    if(sig===shared)return; shared=sig;
    try{ typeof window.dpRefresh==='function'&&window.dpRefresh(); }catch(e){}
  }
  setInterval(function(){ if(rows&&window._predSource!=='v2')paint(); },5000);
  function load(){ if(!window.SB)return;
    window.SB.from('wire_call_v2_log').select('k,start_code,letters,stop,lo,hi,inputs,computed_at,locked_at,locked_letters,locked_stop,actual_moved').order('d',{ascending:false}).order('shift',{ascending:false}).limit(8)
      .then(function(r){ if(r.error||!Array.isArray(r.data))return; rows=r.data; try{ localStorage.setItem(LS,JSON.stringify({at:Date.now(),rows:rows})); }catch(e){} paint(); },function(){}); }
  if(rows){ if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',paint); else paint(); }
  window.wireV2Paint=function(){ if(!rows)return false; paint(); return true; };
  /* repaint whenever index.html paints the training label over us */
  new MutationObserver(function(){ clearTimeout(t); t=setTimeout(function(){ var ps=document.getElementById('predStop'); if(ps&&rows&&!ps.querySelector('['+mark+']'))paint(); },150); }).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(load,60000);
  /* #nov3(runbtn) — the Keymaster's "Run the prediction" button, at the top of the command center: recalculates every
     upcoming board right now (wire_run_now) and shows what each one says, or what it's still waiting on. */
  var DOWF={Sun:'Sunday',Mon:'Monday',Tue:'Tuesday',Wed:'Wednesday',Thu:'Thursday',Fri:'Friday',Sat:'Saturday'};
  function kName(k){ var m=/^\d{4}-(\d{2})-(\d{2})_(\w{3})_(AM|PM)$/.exec(k||''); return m?(DOWF[m[3]]||m[3])+' '+(m[4]==='AM'?'day':'night')+' '+(+m[1])+'/'+(+m[2]):k; }
  function runCard(){
    var jump=document.getElementById('kmJump'); if(!jump||document.getElementById('kmWireRun'))return;
    var c=document.createElement('div'); c.id='kmWireRun';
    c.style.cssText='margin:0 0 12px;padding:10px 12px;border:1px solid rgba(238,180,107,.45);border-radius:12px';
    c.innerHTML='<div style="display:flex;align-items:center;gap:10px"><b style="font:700 14px Barlow Condensed,sans-serif;letter-spacing:.12em;color:var(--copper-hi,#e8a33d)">\u26A1 THE WIRE</b>'+
      '<button type="button" id="kmWireRunBtn" class="btn" style="margin-left:auto;padding:8px 14px">Run the prediction</button></div>'+
      '<div id="kmWireRunOut" class="sub" style="margin-top:8px;line-height:1.55">Recalculates every board that isn\u2019t locked yet, right now. (It also runs on its own every 5 minutes.)</div>';
    jump.insertAdjacentElement('afterend',c);
    document.getElementById('kmWireRunBtn').addEventListener('click',async function(){
      var b=this,out=document.getElementById('kmWireRunOut'); b.disabled=true; b.textContent='Running\u2026';
      try{
        var r=await window.SB.rpc('wire_run_now',{p_port:'lalb'}); if(r.error)throw r.error;
        var bs=(r.data&&r.data.boards)||[];
        out.innerHTML=bs.length?bs.map(function(x){
          var name='<b style="color:var(--bone)">'+esc(kName(x.k))+'</b>';
          if(x.locked)return name+' \u00B7 '+esc(x.stop)+' ('+esc(x.lo)+'\u2013'+esc(x.hi)+') \uD83D\uDD12 locked';
          if(!x.ok)return name+' \u00B7 <span style="color:var(--steel)">'+esc(x.why||'not ready')+'</span>';
          return name+' \u00B7 <b style="color:var(--copper-hi,#e8a33d)">'+esc(x.stop)+'</b> ('+esc(x.lo)+'\u2013'+esc(x.hi)+')'+(x.early?' \u00B7 early':'')+' \u00B7 hall '+esc(x.hall)+' \u00B7 PMA '+esc(x.pma);
        }).join('<br>'):'No upcoming boards to call.';
        load();
      }catch(e){ out.textContent='Couldn\u2019t run it: '+((e&&e.message)||e); }
      b.disabled=false; b.textContent='Run the prediction';
    });
  }
  setInterval(runCard,2000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden)load(); });
  var tries=0, w=setInterval(function(){ if(window.SB){ clearInterval(w); load(); } else if(++tries>120)clearInterval(w); },500);
})();
