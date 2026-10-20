/* theme_switch.js — #stillmode (oct 20). The season theme was costing phones too much.
     · the season theme (Halloween now, whatever's next later) is OFF by default. Each member can turn it on in
       Profile → 🎃 Season theme. index.html checks the same setting before the first paint, so there's no flash.
     · theme OFF: the app is STILL — every looping animation is stopped (dripping goo, bats, candles, embers,
       lanterns, pulsing glows, bobbing crowns). One-shot animations and loading spinners still play.
     · theme ON (oct 20b): the season's animations run again for the members who chose it. perf_guard.js still
       pauses them off-screen / behind a sheet / in a hidden tab, and still drops a phone into calm mode after a
       long freeze, so slow phones stay protected.
   Setting: localStorage shadowhook_theme = "on" | (anything else = off). Per phone.
   Load once from index.html, after room_fast.js:  <script src="theme_switch.js?v=oct20b" defer></script> */
(function(){
  'use strict';
  if(window.__themeSwitch)return; window.__themeSwitch=true;
  var KEY='shadowhook_theme';
  function themeOn(){ try{ return localStorage.getItem(KEY)==='on'; }catch(e){ return false; } }

  /* ---------- still: stop every endless animation ---------- */
  var KEEP=/spin|load|rotat|reel|shimmer|skeleton|typing|caret|blink-cursor/i;   /* spinners & loaders keep moving */
  var st=document.createElement('style'); st.textContent=
    /* the season's own decoration layers, when the theme is off */
    'html:not(.season-halloween) .sn-decor,html:not(.season-halloween) .hwl-embers{display:none!important}'+
    /* belt and braces for the known loops, in case a browser can't stop them from script */
    'html.shk-still .pg-decor{animation:none!important}';
  document.head.appendChild(st);
  var stopped=0, held=[];
  function setStill(){ document.documentElement.classList.toggle('shk-still',!themeOn()); }
  setStill();
  /* theme turned on: restart what was stopped */
  function wake(){
    var list=held; held=[];
    list.forEach(function(a){ try{ a.play(); }catch(e){} });
    /* anything the browser dropped for good: nudge its style so the animation starts again */
    try{ document.querySelectorAll('.pg-decor').forEach(function(el){ var v=el.style.animationName; el.style.animationName='none'; void el.offsetWidth; el.style.animationName=v; }); }catch(e){}
  }
  function still(){
    try{
      if(themeOn()||!document.getAnimations)return;
      var list=document.getAnimations();
      for(var i=0;i<list.length;i++){
        var a=list[i]; if(a.playState==='idle'||a._shkKept)continue;
        var name=a.animationName||'', t=a.effect&&a.effect.getComputedTiming?a.effect.getComputedTiming():null;
        if(!t||t.iterations!==Infinity){ continue; }               /* one-shot animations finish on their own */
        if(KEEP.test(name)){ a._shkKept=1; continue; }
        var el=a.effect&&a.effect.target; if(el&&el.closest&&el.closest('[data-keep-motion]')){ a._shkKept=1; continue; }
        try{ a.cancel(); stopped++; if(held.indexOf(a)<0)held.push(a); }catch(e){}
      }
    }catch(e){}
  }
  var t=null;
  function soon(){ clearTimeout(t); t=setTimeout(still,250); }
  new MutationObserver(soon).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',function(){ if(!document.hidden)soon(); });
  setInterval(still,4000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',still); else still();

  /* ---------- the switch in Profile ---------- */
  function apply(){
    try{ if(typeof window.applySeason==='function')window.applySeason(); }catch(e){}
    setStill(); if(themeOn())wake();
    var sw=document.getElementById('themeSw'); if(sw){ sw.classList.toggle('on',themeOn()); sw.setAttribute('aria-checked',String(themeOn())); }
    soon();
  }
  function box(){
    var size=document.getElementById('sizeBox'); if(!size||document.getElementById('themeBox'))return;
    var b=document.createElement('div'); b.className='albox'; b.id='themeBox';
    b.innerHTML='<h4>\uD83C\uDF83 Season theme</h4><div class="alrow"><div class="alm"><div class="alt">Show the season theme</div>'+
      '<div class="als">Off: the plain app, still and lighter on your phone. On: the season\u2019s look, moving goo, bats and candles included.</div></div>'+
      '<button class="alsw" id="themeSw" type="button" role="switch" aria-checked="false" aria-label="Show the season theme"><i></i></button></div>';
    size.parentNode.insertBefore(b,size);
    b.querySelector('#themeSw').addEventListener('click',function(){
      var on=!themeOn(); try{ localStorage.setItem(KEY,on?'on':'off'); }catch(e){}
      apply(); try{ toast(on?'\uD83C\uDF83 Season theme on':'Season theme off \u00B7 the app stands still'); }catch(e){}
    });
    apply();
  }
  new MutationObserver(function(){ if(!document.getElementById('themeBox'))box(); }).observe(document.body,{childList:true,subtree:true});
  box();
  window.shkStill={stopped:function(){ return stopped; }, run:still};
})();
