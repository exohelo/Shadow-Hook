/* perf_guard.js — #perfguard (oct 16). The freeze alarms all show 50–120 decor animations running under a 6–12k-node
   page; a realtime sync or a resize then tips the main thread into a 2–4 s stall. This keeps the look but stops paying
   for what nobody sees:
     1. decor animations (candles, embers, goo drips, bats, claw, pulses) are PAUSED while off-screen, while a sheet /
        game / flyer covers the page, and while the tab is hidden; they resume when visible again
     2. candle glows are capped at 8 and embers at 6 per phone (the rest keep their place, just don't animate)
     3. after a long task over 1.5 s the phone drops into calm mode for the rest of the day: decor animations stop,
        the app's own prefers-reduced-motion rules apply. The Keymaster's device gets the same treatment.
   Load once from index.html, after the season script:  <script src="perf_guard.js" defer></script> */
(function(){
  'use strict';
  if(window.__perfGuard)return; window.__perfGuard=true;
  var DECOR=/hwlCandle|hwlEmber|snNeck3|snDrop|snFlyX|snFlyY|snFlap|cgClaw|dpPulse|cgHaunt|hvFall|hvFlutter/;
  var CAP={hwlCandle:8,hwlEmber:6}, LS='shadowhook_calm_until', calm=false;
  function st(){ var s=document.createElement('style'); s.id='pgCSS'; s.textContent=
    '.pg-paused{animation-play-state:paused!important}'+
    'html.shk-calm .pg-decor{animation:none!important}'+
    'html.shk-calm .sn-decor,html.shk-calm .hwl-embers{display:none!important}';
    document.head.appendChild(s); }
  function animated(){ var out=[]; var all=document.querySelectorAll('body *'); for(var i=0;i<all.length;i++){ var e=all[i]; if(e.closest('#demoBar'))continue; var n=e.__pgAnim; if(n===undefined){ try{ n=getComputedStyle(e).animationName||''; }catch(x){ n=''; } e.__pgAnim=DECOR.test(n)?n:''; n=e.__pgAnim; } if(n)out.push(e); } return out; }
  var seen={}, io=null;
  function tag(){
    var list=animated(), counts={};
    list.forEach(function(e){
      e.classList.add('pg-decor');
      var key=(e.__pgAnim.match(/hwlCandle|hwlEmber/)||[''])[0];
      if(key){ counts[key]=(counts[key]||0)+1; if(counts[key]>CAP[key]){ e.classList.add('pg-paused'); e.__pgCapped=true; return; } }
      if(io&&!e.__pgWatched){ e.__pgWatched=true; io.observe(e); }
    });
  }
  function covered(){ return !!document.querySelector('.sheet.on, #rflFlyer.on, #rflFlyer2.on, #gameSheet.on, .game.on, #tvSheet.on, [data-covers="1"].on'); }
  function sweep(){
    var hide=document.hidden||covered();
    document.querySelectorAll('.pg-decor').forEach(function(e){ if(e.__pgCapped)return; var off=hide||e.__pgOff; e.classList.toggle('pg-paused',!!off); });
  }
  function start(){
    st();
    if(window.IntersectionObserver){ io=new IntersectionObserver(function(en){ en.forEach(function(x){ x.target.__pgOff=!x.isIntersecting; }); sweep(); },{rootMargin:'40px'}); }
    tag(); sweep();
    new MutationObserver(function(){ clearTimeout(start._t); start._t=setTimeout(function(){ tag(); sweep(); },400); }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    document.addEventListener('visibilitychange',sweep);
    /* calm mode: remembered until local midnight */
    try{ var until=+localStorage.getItem(LS)||0; if(until>Date.now()){ calm=true; document.documentElement.classList.add('shk-calm'); } }catch(e){}
    if(window.PerformanceObserver){ try{ new PerformanceObserver(function(l){ l.getEntries().forEach(function(en){ if(en.duration>1500&&!calm)goCalm(en.duration); }); }).observe({type:'longtask',buffered:true}); }catch(e){} }
  }
  function goCalm(ms){
    calm=true; document.documentElement.classList.add('shk-calm');
    var d=new Date(); d.setHours(24,0,0,0); try{ localStorage.setItem(LS,String(d.getTime())); }catch(e){}
    try{ console.info('perf_guard: calm mode after a '+Math.round(ms)+'ms stall'); }catch(e){}
  }
  window.perfGuardCalm=function(on){ if(on===false){ calm=false; document.documentElement.classList.remove('shk-calm'); try{ localStorage.removeItem(LS); }catch(e){} } else goCalm(0); };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start); else start();
})();
