/* perf_guard.js — #perfguard (oct 16). The freeze alarms all show 50–120 decor animations running under a 6–12k-node
   page; a realtime sync or a resize then tips the main thread into a 2–4 s stall. This keeps the look but stops paying
   for what nobody sees:
     1. decor animations (candles, embers, goo drips, bats, claw, pulses) are PAUSED while off-screen, while a sheet /
        game / flyer covers the page, and while the tab is hidden; they resume when visible again
     2. candle glows are capped at 8 and embers at 6 per phone (the rest keep their place, just don't animate)
     3. after a long task over 1.5 s the phone drops into calm mode for the rest of the day: decor animations stop,
        the app's own prefers-reduced-motion rules apply. The Keymaster's device gets the same treatment.
   Load once from index.html, after the season script:  <script src="perf_guard.js" defer></script>
   #pgfast(nov7): the guard itself became a freeze (IRON_KIDD_86's alarm: perf_guard.js 2,123 ms). It found the decor by
   calling getComputedStyle on EVERY element of an ~8,000-node page, and re-ran that 400 ms after ANY change anywhere,
   including the class flips it made itself. Now it asks the browser for the animations that are actually running
   (document.getAnimations, no page walk, no style recalc), re-checks at most once a second when the phone is idle,
   and throws away the change records its own pausing creates. */
(function(){
  'use strict';
  if(window.__perfGuard)return; window.__perfGuard=true;
  var DECOR=/hwlCandle|hwlEmber|hwlCreep|hwlMoon|snFlyX|snFlyY|snFlap|snDrift|cgClaw|dpPulse|dpTapR|cgHaunt|hvFall|hvFlutter|arcDrift|gLet|gEmber/;   /* oct18: + the loops the latest alarms named */
  var CAP={hwlCandle:8,hwlEmber:6}, LS='shadowhook_calm_until', calm=false;
  function st(){ var s=document.createElement('style'); s.id='pgCSS'; s.textContent=
    '.pg-paused{animation-play-state:paused!important}'+
    'html.shk-calm .pg-decor{animation:none!important}'+   /* #oct31: goo drips (snDrop/snNeck3) are no longer decor-paused — they keep dripping */
    'html.shk-calm .hwl-embers{display:none!important}'+
    /* #oct31(drips): calm mode hides the goo layer but keeps the drips dripping */
    'html.shk-calm .sn-decor *{visibility:hidden!important}'+
    'html.shk-calm .sn-decor .sn-drop,html.shk-calm .sn-decor .sn-drop *,html.shk-calm .sn-decor .sn-cone,html.shk-calm .sn-decor .sn-cone *{visibility:visible!important;animation-play-state:running!important}';
    document.head.appendChild(s); }
  function animated(){
    var out=[], seenEl=new Set();
    if(typeof document.getAnimations==='function'){
      /* only what the browser is really animating: tens of entries, not thousands of nodes */
      var A; try{ A=document.getAnimations(); }catch(x){ A=[]; }
      for(var i=0;i<A.length;i++){
        var a=A[i], n=a.animationName, e=a.effect&&a.effect.target;
        if(!n||!e||e.nodeType!==1||seenEl.has(e)||!DECOR.test(n))continue;
        if(e.closest&&e.closest('#demoBar'))continue;
        seenEl.add(e); e.__pgAnim=n; out.push(e);
      }
      /* paused decor drops out of getAnimations' running set on some engines: keep what we already tagged */
      document.querySelectorAll('.pg-decor').forEach(function(e){ if(!seenEl.has(e)&&e.isConnected){ seenEl.add(e); out.push(e); } });
      return out;
    }
    /* very old browsers only: the old walk, but never twice over the same element */
    var all=document.querySelectorAll('body *');
    for(var j=0;j<all.length;j++){ var el=all[j]; var nm=el.__pgAnim; if(nm===undefined){ if(el.closest('#demoBar')){ el.__pgAnim=''; continue; } try{ nm=getComputedStyle(el).animationName||''; }catch(x){ nm=''; } el.__pgAnim=DECOR.test(nm)?nm:''; nm=el.__pgAnim; } if(nm)out.push(el); }
    return out;
  }
  var seen={}, io=null, mo=null, pend=0, idleId=0;
  function selfOnly(recs){ for(var i=0;i<recs.length;i++){ var r=recs[i]; if(r.type!=='attributes'||!r.target.classList||!r.target.classList.contains('pg-decor'))return false; } return true; }
  function later(){
    if(pend)return;
    pend=setTimeout(function(){
      var go=function(){ pend=0; idleId=0; tag(); sweep(); };
      if(window.requestIdleCallback)idleId=requestIdleCallback(go,{timeout:2000}); else go();
    },1000);
  }
  function tag(){
    var list=animated(), counts={};
    list.forEach(function(e){
      if(!e.classList.contains('pg-decor'))e.classList.add('pg-decor');
      var key=(e.__pgAnim.match(/hwlCandle|hwlEmber/)||[''])[0];
      if(key){ counts[key]=(counts[key]||0)+1; if(counts[key]>CAP[key]){ if(!e.classList.contains('pg-paused'))e.classList.add('pg-paused'); e.__pgCapped=true; return; } }
      if(io&&!e.__pgWatched){ e.__pgWatched=true; io.observe(e); }
    });
  }
  function covered(){ return !!document.querySelector('.sheet.on, #rflFlyer.on, #rflFlyer2.on, #gameSheet.on, .game.on, #tvSheet.on, [data-covers="1"].on'); }
  function sweep(){
    var hide=document.hidden||covered();
    document.querySelectorAll('.pg-decor').forEach(function(e){ if(e.__pgCapped)return; var off=!!(hide||e.__pgOff); if(e.classList.contains('pg-paused')!==off)e.classList.toggle('pg-paused',off); });
    if(mo&&selfOnly(mo.takeRecords())===false)later();   /* our own pausing is not a "page change"; anything else still counts */
  }
  function start(){
    st();
    if(window.IntersectionObserver){ io=new IntersectionObserver(function(en){ en.forEach(function(x){ x.target.__pgOff=!x.isIntersecting; }); sweep(); },{rootMargin:'40px'}); }
    if(window.requestIdleCallback)requestIdleCallback(function(){ tag(); sweep(); },{timeout:3000}); else { tag(); sweep(); }
    mo=new MutationObserver(function(recs){
      /* skip batches that are only pg-decor/pg-paused flips on elements we already manage */
      if(!selfOnly(recs))later();
    });
    mo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
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
  /* 4. the floor's presence sync: every member arriving or leaving made every phone repaint the roster at once.
        Coalesce: repaint at most every 3 s (trailing edge, so the last state always lands), never while hidden. */
  function wrapChannel(){
    var SB=window.SB; if(!SB||SB.__pgWrapped||typeof SB.channel!=='function')return false;
    var orig=SB.channel;
    SB.channel=function(topic){
      var ch=orig.apply(this,arguments);
      try{
        var isFloor=/^floor/i.test(String(topic||''))||String(topic||'')===String(window.SHK_FLOOR||'');
        if(isFloor&&typeof ch.on==='function'){
          var on=ch.on;
          ch.on=function(type,filter,fn){
            if(type==='presence'&&filter&&filter.event==='sync'&&typeof fn==='function'){
              var t=null,last=0,GAP=3000, run=function(){ last=Date.now(); t=null; try{ fn.apply(ch,arguments); }catch(e){} };
              var wrapped=function(){ var args=arguments; if(t)return; var wait=Math.max(0,GAP-(Date.now()-last)); if(document.hidden)wait=Math.max(wait,1500); t=setTimeout(function(){ if(document.hidden){ t=null; var onVis=function(){ document.removeEventListener('visibilitychange',onVis); wrapped.apply(null,args); }; document.addEventListener('visibilitychange',onVis); return; } run.apply(null,args); },wait); };
              return on.call(ch,type,filter,wrapped);
            }
            return on.apply(ch,arguments);
          };
        }
      }catch(e){}
      return ch;
    };
    SB.__pgWrapped=true;
    /* if the floor was joined before we got here, rejoin through the wrapper */
    try{ if(typeof window.floorRekey==='function'&&window.__shkUid)window.floorRekey(); }catch(e){}
    return true;
  }
  if(!wrapChannel()){ var wt=setInterval(function(){ if(wrapChannel())clearInterval(wt); },300); setTimeout(function(){ clearInterval(wt); },60000); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start); else start();
})();
