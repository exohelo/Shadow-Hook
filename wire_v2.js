/* wire_v2.js — #wirev2 (oct 30). THE WIRE'S CALL, for everyone. The rebuilt engine runs on the server
   (wire_call_v2 / wire_call_v2_log): no call until the PMA sheet and the hall's forecast are both in, re-computed as
   fresher numbers land, LOCKED at 6:30 AM / 4:30 PM and never moved, graded against the end card.
   index.html still paints the IN TRAINING label (km_flags.wire_call_on stays false so the old bot can't post);
   this file paints over it with the v2 call: the stop letter in the big slot, the band · letters · start card · lock
   under it, the inputs, and the last six graded boards. Polls every 60 s; nothing here writes anything.
   Load once from index.html, after hand_counts.js:  <script src="wire_v2.js?v=nov5b" defer></script> */
(function(){
  'use strict';
  if(window.__wireV2)return; window.__wireV2=true;
  var rows=null, t=null, mark='data-v2', LS='shadowhook_wire_v2', LSV='shadowhook_wire_view', last=null;
  /* #nov6(swipe): 'odds' = the bell curve over the band (default), 'board' = every letter from the start card to the stop */
  var view='odds'; try{ if(localStorage.getItem(LSV)==='board')view='board'; }catch(e){}
  /* #oct31(flash): paint the last call this phone saw the instant the Wire exists, so the old label never gets the screen first */
  try{ var cached=JSON.parse(localStorage.getItem(LS)||'null'); if(cached&&cached.rows&&Date.now()-cached.at<36*3600e3)rows=cached.rows; }catch(e){}
  function css(){ if(document.getElementById('v2CSS'))return; var s=document.createElement('style'); s.id='v2CSS'; s.textContent=
    '#wMoves .v2b{font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.06em;color:#dcd6c9}#wMoves .v2i{display:block;margin-top:3px;font:600 11px Inter,system-ui,sans-serif;color:#8f979e;line-height:1.5}'+
    '#wMoves .v2g{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(220,214,201,.08);font:600 11px Inter,system-ui,sans-serif;color:#8f979e}#wMoves .v2g b{color:#dcd6c9}#wMoves .v2g .ok{color:#7fcf8a}#wMoves .v2g .bad{color:#e8967a}'+
    '#v2Curve{display:flex;gap:3px;margin:16px 2px -10px;height:62px;align-items:flex-end}'+
    '#v2Curve .wire-cell{aspect-ratio:auto!important;height:100%!important;background:none!important;border:none!important;box-shadow:none!important;transform:none!important;opacity:1!important;align-items:flex-end!important;justify-content:center;padding:0;position:relative}'+
    '#v2Curve .wire-cell i{display:block;width:78%;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,rgba(183,174,203,.55),rgba(183,174,203,.18))}'+
    '#v2Curve .wire-cell.band i{background:linear-gradient(180deg,#4de2ffcc,#4de2ff33)}#v2Curve .wire-cell.top i{background:linear-gradient(180deg,#ff4dd2,#ff4dd255);box-shadow:0 0 14px #ff4dd266}'+
    '#v2Curve .v2pct{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);z-index:1;font:700 10.5px Inter,system-ui,sans-serif;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.75);white-space:nowrap;pointer-events:none}'+
    '#v2How{margin-top:14px;text-align:left}#v2How p{margin:8px 0 0;font:400 14.5px/1.5 Inter,system-ui,sans-serif;color:var(--steel)}#v2How p b{color:var(--bone)}#v2How .odds-hold{font-size:14px;line-height:1.5;margin-top:10px}'+
    '#wMoves .v2lock{color:#eeb46b}'+
    /* #nov6(swipe): the odds view and the full-board view share one spot; swipe sideways (or tap the dots) to switch */
    '#v2View{position:relative;touch-action:pan-y;user-select:none;-webkit-user-select:none}#v2View.v2slide{animation:v2Slide .26s cubic-bezier(.2,.8,.2,1)}#v2View.v2slide.back{animation-name:v2SlideB}'+
    '@keyframes v2Slide{0%{opacity:0;transform:translateX(26px)}to{opacity:1;transform:none}}@keyframes v2SlideB{0%{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:none}}'+
    '#v2Dots{display:flex;justify-content:center;align-items:center;gap:14px;margin:2px 0 4px}#v2Dots button{display:flex;align-items:center;gap:6px;background:none;border:0;padding:6px 4px;cursor:pointer;font:600 10px Inter,system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--steel)}'+
    '#v2Dots button i{width:6px;height:6px;border-radius:3px;background:var(--line);transition:.2s}#v2Dots button.on{color:var(--copper-hi)}#v2Dots button.on i{width:16px;background:var(--copper-hi)}'+
    '@media(prefers-reduced-motion:reduce){#v2View.v2slide{animation:none}}';
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
    last=[up,L,stop,locked];
    var AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ', tr=document.getElementById('wTrack'), mt=document.getElementById('wMeters'), run=document.getElementById('wRun');
    var startL=(up.start_code||'A').charAt(0).toUpperCase(), base=AZ.indexOf(startL); if(base<0)base=0;
    var med=Math.round(L), lo=Math.max(0,Math.round(L-1.5)), hi=Math.min(26,Math.round(L+1.5)), cyc=med>=26;
    var span=Math.min(26,Math.max(hi+2,med+2,8));
    var myId=null; try{ myId=typeof window.myBoardId==='function'?window.myBoardId():null; }catch(e){}
    var dOf=function(c){ var i=AZ.indexOf(String(c||'').charAt(0).toUpperCase()); return i<0?-1:((i-base)%26+26)%26; }, bLo=dOf(up.lo), bHi=dOf(up.hi); if(bLo<0||bHi<0||bHi<bLo){ bLo=lo; bHi=hi; }
    var myDist=myId?((AZ.indexOf(String(myId).charAt(0).toUpperCase())-base)%26+26)%26:-1;
    /* #bellwin(nov5) — every call shows only the band ±2 letters, with the bell curve over them */
    var w0=0, w1=span; if(!cyc&&view!=='board'){ w0=Math.max(0,Math.min(bLo,med)-2); w1=Math.min(span,Math.max(bHi,med)+2); }
    if(tr){ var cells='', k, cls, inner;
      for(k=w0;k<=w1;k++){ cls='wire-cell'; inner=AZ[(base+k)%26];
        if(k>=bLo&&k<=bHi)cls+=' band'; if(k===0)cls+=' start'; if(k===med&&!cyc)cls+=' stop'; if(myDist===k)cls+=' youcell';
        if(k===0)inner+='<span class="tick">START</span>'; else if(k===med&&!cyc)inner+='<span class="tick">STOP</span>';
        if(myDist===k&&myDist!==0)inner='<span class="you">\uD83C\uDF83</span>'+inner;
        cells+='<div class="'+cls+'">'+inner+'</div>'; }
      tr.innerHTML=cells; tr.classList.toggle('wide',(w1-w0)>16); }
    /* #bell(nov5) — no more "chance it moves": a bell curve over the letters shows how likely each stop is. Its width
       comes from this engine's own recent misses (graded boards), so it tightens as the engine gets sharper. */
    var graded=rows.filter(function(r){ return r.actual_moved!=null&&r.locked_letters!=null; }).slice(0,8);
    var mae=graded.length?graded.reduce(function(a,r){ return a+Math.abs(+r.locked_letters-r.actual_moved); },0)/graded.length:null;
    var sd=graded.length>=3?Math.max(0.9,mae*1.25):2.5;
    function Phi(x){ var t=1/(1+0.3275911*Math.abs(x)/Math.SQRT2), e=Math.exp(-x*x/2), y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t*e; return x>=0?(1+y)/2:(1-y)/2; }
    var P=[], pmax=0, inBand=0;
    for(k=0;k<=span;k++){ var a=k===0?-Infinity:k-0.5, b=k===span?Infinity:k+0.5;
      var pk=(b===Infinity?1:Phi((b-L)/sd))-(a===-Infinity?0:Phi((a-L)/sd)); P.push(pk); if(pk>pmax)pmax=pk; if(k>=bLo&&k<=bHi)inBand+=pk; }
    var cv=document.getElementById('v2Curve');
    if(tr&&!cv){ cv=document.createElement('div'); cv.id='v2Curve'; tr.parentNode.insertBefore(cv,tr); }
    if(tr&&cv)viewer(tr,cv,cyc);
    if(cv){ if(cyc||view==='board'||(w1-w0)>16){ cv.style.display='none'; } else { cv.style.display=''; var bars='';
        for(k=w0;k<=w1;k++){ var pct=Math.round(P[k]*100), h=pmax>0?Math.max(3,P[k]/pmax*100):3, c2=k===med?'top':(k>=bLo&&k<=bHi?'band':'');
          bars+='<div class="wire-cell v2cb '+c2+'">'+(pct>=1&&h*62/100>=18?'<span class="v2pct">'+pct+'%</span>':'')+'<i style="height:'+h.toFixed(0)+'%"></i></div>'; }
        cv.innerHTML=bars; } }
    if(mt){ mt.style.display='';
      if(!document.getElementById('v2How')){ mt.innerHTML='<details class="race-how v2how" id="v2How"><summary>How sure is this call?</summary><div id="v2HowBody"></div></details>';
        var mo=document.getElementById('myOdds'); if(mo)document.getElementById('v2How').appendChild(mo); }
      var topPct=Math.round((P[med]||0)*100), bandPct=Math.round(inBand*100), stopL=AZ[(base+med)%26];
      var body=cyc?'<p>The numbers say it goes <b>around the book</b> tonight, so there\u2019s no single stop letter to call.</p>':
        '<p><b>Most likely stop: '+stopL+'</b> \u2014 about '+topPct+'% on its own.</p>'+
        '<p><b>'+bandPct+'%</b> chance it stops in the band <b>'+esc(up.lo)+'\u2013'+esc(up.hi)+'</b>.</p>'+
        (mae!=null?'<p>Recent calls missed by about <b>'+(Math.round(mae*10)/10)+' letter'+(Math.round(mae*10)/10===1?'':'s')+'</b> on average (last '+graded.length+' boards). The curve is built from that.</p>':'<p>Not enough graded boards yet, so the curve is drawn wide.</p>')+
        '<p>'+(locked?'This call is <b>locked</b> and won\u2019t change.':'It locks at '+(up.k.slice(-2)==='AM'?'6:30 AM':'4:30 PM')+' and doesn\u2019t move after.')+'</p>';
      var hb=document.getElementById('v2HowBody'); if(hb&&hb.innerHTML!==body)hb.innerHTML=body; }
    if(run){ run.style.display='none'; }
  }
  /* #nov6(swipe): wrap the curve and the letters in one swipeable spot, with two dots under it to show which view is up */
  function setView(v,dir){ if(v===view)return; view=v; try{ localStorage.setItem(LSV,v); }catch(e){}
    var box=document.getElementById('v2View');
    if(last)ladder.apply(null,last);
    if(box){ box.classList.remove('v2slide','back'); void box.offsetWidth; box.classList.add('v2slide'); if(dir<0)box.classList.add('back'); } }
  function viewer(tr,cv,cyc){
    var box=document.getElementById('v2View');
    if(!box){ box=document.createElement('div'); box.id='v2View'; box.setAttribute('data-noswipe','');
      tr.parentNode.insertBefore(box,cv); box.appendChild(cv); box.appendChild(tr);
      var dots=document.createElement('div'); dots.id='v2Dots';
      dots.innerHTML='<button type="button" data-v="odds"><i></i>Odds</button><button type="button" data-v="board"><i></i>Full board</button>';
      box.insertAdjacentElement('afterend',dots);
      dots.addEventListener('click',function(e){ var b=e.target.closest('button[data-v]'); if(b)setView(b.getAttribute('data-v'),b.getAttribute('data-v')==='board'?1:-1); });
      var x0=0,y0=0,on=false;
      box.addEventListener('touchstart',function(e){ if(e.touches.length!==1){ on=false; return; } x0=e.touches[0].clientX; y0=e.touches[0].clientY; on=true; },{passive:true});
      box.addEventListener('touchend',function(e){ if(!on)return; on=false; var t=e.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0;
        if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.4)setView(view==='odds'?'board':'odds',dx<0?1:-1); },{passive:true});
      var mx=null;   /* mouse drag works too, for anyone on a computer */
      box.addEventListener('mousedown',function(e){ mx=e.clientX; });
      window.addEventListener('mouseup',function(e){ if(mx==null)return; var dx=e.clientX-mx; mx=null; if(Math.abs(dx)>40)setView(view==='odds'?'board':'odds',dx<0?1:-1); }); }
    var d=document.getElementById('v2Dots');
    if(d){ d.style.display=cyc?'none':''; [].forEach.call(d.querySelectorAll('button'),function(b){ b.classList.toggle('on',b.getAttribute('data-v')===view); }); }
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
