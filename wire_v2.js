/* wire_v2.js — #wirev2 (oct 30). THE WIRE'S CALL, for everyone. The rebuilt engine runs on the server
   (wire_call_v2 / wire_call_v2_log): no call until the PMA sheet and the hall's forecast are both in, re-computed as
   fresher numbers land, LOCKED at 6:30 AM / 4:30 PM and never moved, graded against the end card.
   index.html still paints the IN TRAINING label (km_flags.wire_call_on stays false so the old bot can't post);
   this file paints over it with the v2 call: the stop letter in the big slot, the band · letters · start card · lock
   under it, the inputs, and the last six graded boards. Polls every 60 s; nothing here writes anything.
   Load once from index.html, after hand_counts.js:  <script src="wire_v2.js?v=oct31c" defer></script> */
(function(){
  'use strict';
  if(window.__wireV2)return; window.__wireV2=true;
  var rows=null, t=null, mark='data-v2';
  function css(){ if(document.getElementById('v2CSS'))return; var s=document.createElement('style'); s.id='v2CSS'; s.textContent=
    '#wMoves .v2b{font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.06em;color:#dcd6c9}#wMoves .v2i{display:block;margin-top:3px;font:600 11px Inter,system-ui,sans-serif;color:#8f979e;line-height:1.5}'+
    '#wMoves .v2g{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(220,214,201,.08);font:600 11px Inter,system-ui,sans-serif;color:#8f979e}#wMoves .v2g b{color:#dcd6c9}#wMoves .v2g .ok{color:#7fcf8a}#wMoves .v2g .bad{color:#e8967a}'+
    '#wMoves .v2lock{color:#eeb46b}';
    document.head.appendChild(s); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function lbl(k){ var d=new Date(k.slice(0,10)+'T12:00:00'); return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+' '+(d.getMonth()+1)+'/'+d.getDate()+' '+(k.slice(-2)==='AM'?'day':'night'); }
  function flexOf(k){ return new Date(k.slice(0,10)+'T'+(k.slice(-2)==='AM'?'06:30':'16:30')+':00'); }
  function when(x){ var d=new Date(x); var h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?'a':'p'); }
  function upcomingKey(){ var n=new Date(), m=n.getHours()*60+n.getMinutes(), d=new Date(n), sh='AM';
    if(m<6*60+30){ sh='AM'; } else if(m<16*60+30){ sh='PM'; } else { d.setDate(d.getDate()+1); sh='AM'; }
    var iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    return iso+'_'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]+'_'+sh; }
  function paint(){
    var ps=document.getElementById('predStop'), mv=document.getElementById('wMoves'), src=document.getElementById('wSrc');
    if(!ps||!mv||!rows)return;
    css();
    var key=upcomingKey(), up=null, i;
    for(i=0;i<rows.length;i++)if(rows[i].k===key){ up=rows[i]; break; }
    /* the board that's running or just ran: its locked call stays up until the next board has one */
    if(!up)for(i=0;i<rows.length;i++)if(rows[i].actual_moved==null&&rows[i].k<key){ up=rows[i]; break; }
    var done=rows.filter(function(r){ return r.actual_moved!=null&&r.locked_letters!=null; }).slice(0,6);
    var g=done.length?'<div class="v2g">'+done.map(function(r){ var m=Math.abs(+r.locked_letters-r.actual_moved); return '<span>'+lbl(r.k).replace(/^\w+ /,'')+' <b>'+(+r.locked_letters).toFixed(0)+'\u2192'+r.actual_moved+'</b> <i class="'+(m<=1?'ok':m<=2?'':'bad')+'">'+(m<=1?'\u2713':'\u00B1'+m.toFixed(0))+'</i></span>'; }).join('')+'</div>':'';
    if(!up){
      ps.innerHTML='<span '+mark+'="1">\u2014</span>';
      mv.innerHTML='<span '+mark+'="1"><span class="v2b">WAITING ON THE SHEETS</span><span class="v2i">The call comes the moment the PMA sheet and the hall\u2019s forecast for '+esc(lbl(key))+' are both in. Locks at '+(key.slice(-2)==='AM'?'6:30 AM':'4:30 PM')+' and doesn\u2019t move after.</span>'+g+'</span>';
      if(src){ src.className='wire-src est'; src.textContent='\u26A1 WIRE \u00B7 WAITING ON THE SHEETS'; }
      return;
    }
    var inp=up.inputs||{}, locked=!!up.locked_at, L=locked?+up.locked_letters:+up.letters, stop=locked?(up.locked_stop||up.stop):up.stop;
    ps.innerHTML='<span '+mark+'="1">'+esc(stop)+'</span>';
    mv.innerHTML='<span '+mark+'="1"><span class="v2b">'+esc(up.lo)+'\u2013'+esc(up.hi)+' \u00B7 '+L.toFixed(0)+' letters from '+esc(up.start_code||'?')+' \u00B7 '+esc(lbl(up.k))+'</span>'+
      '<span class="v2i">'+(locked?'<span class="v2lock">\u{1F512} LOCKED '+when(up.locked_at)+'</span> \u00B7 the call doesn\u2019t move once dispatch starts':'locks '+when(flexOf(up.k))+' \u00B7 updated '+when(up.computed_at)+' \u00B7 moves only if the sheets change before then')+
      '<br>hall says '+esc(inp.hall_forecast)+' jobs \u00B7 PMA '+esc(inp.pma_total)+' \u00B7 last board moved '+esc(inp.prev1)+'</span>'+g+'</span>';
    if(src){ src.className='wire-src '+(locked?'lock':'est'); src.textContent='\u26A1 WIRE v2 \u00B7 '+(locked?'LOCKED':'LIVE CALL'); }
    share(up,L,stop,locked);
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
  function share(up,L,stop,locked){
    var sig=up.k+'|'+stop+'|'+up.lo+'|'+up.hi+'|'+(locked?'L':'');
    window._lastCall={stop:stop,lo:up.lo,hi:up.hi,pmove:Math.round(L),src:'v2',k:up.k,locked:locked};
    window._publishedKey=up.k; window._predSource='v2';
    if(sig===shared)return; shared=sig;
    try{ typeof window.dpRefresh==='function'&&window.dpRefresh(); }catch(e){}
  }
  setInterval(function(){ if(rows&&window._predSource!=='v2')paint(); },5000);
  function load(){ if(!window.SB)return;
    window.SB.from('wire_call_v2_log').select('k,start_code,letters,stop,lo,hi,inputs,computed_at,locked_at,locked_letters,locked_stop,actual_moved').order('d',{ascending:false}).order('shift',{ascending:false}).limit(8)
      .then(function(r){ if(r.error||!Array.isArray(r.data))return; rows=r.data; paint(); },function(){}); }
  /* repaint whenever index.html paints the training label over us */
  new MutationObserver(function(){ clearTimeout(t); t=setTimeout(function(){ var ps=document.getElementById('predStop'); if(ps&&rows&&!ps.querySelector('['+mark+']'))paint(); },150); }).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(load,60000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden)load(); });
  var tries=0, w=setInterval(function(){ if(window.SB){ clearInterval(w); load(); } else if(++tries>120)clearInterval(w); },500);
})();
