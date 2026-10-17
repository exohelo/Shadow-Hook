/* chamber_sheet.js — #chambersheet (oct 17). Two things on the Chamber (#scChamber):
     1. NO SIDEWAYS MOVEMENT. The Chamber is locked to the phone's width: nothing inside it scrolls or pans left/right.
        Long words, links and system lines on the Table wrap instead of pushing the page wider; any scroller that
        still turns out wider than the screen is clipped. Up/down scrolling is untouched.
     2. PULL DOWN TO CLOSE. A hard pull down closes the Chamber: drag down from the header, or from anywhere once
        the list is already at its top. The sheet follows the finger; let go past ~140 px (or flick fast) and it
        closes, otherwise it springs back. Touches that start in the message box are left alone. The ✕ stays.
   Works whether sc.js has loaded yet or not (it watches for #scChamber to appear).
   Load once from index.html, after council_mod.js:  <script src="chamber_sheet.js?v=oct17a" defer></script> */
(function(){
  'use strict';
  if(window.__chamberSheet)return; window.__chamberSheet=true;
  var ID='scChamber', CLOSE_AT=140, FLICK=0.9; /* px, px per ms */

  /* ---------- 1. lock the width ---------- */
  var s=document.createElement('style'); s.id='csCSS'; s.textContent=
    '#'+ID+'{max-width:100vw;overflow-x:hidden!important;overscroll-behavior-x:none;touch-action:pan-y}'+
    '#'+ID+' *{overscroll-behavior-x:none}'+
    '#'+ID+' p,#'+ID+' span,#'+ID+' div,#'+ID+' b,#'+ID+' i,#'+ID+' em,#'+ID+' a{overflow-wrap:anywhere;word-break:normal}'+
    '#'+ID+' img,#'+ID+' video,#'+ID+' canvas,#'+ID+' iframe,#'+ID+' table,#'+ID+' pre{max-width:100%}'+
    '#'+ID+' pre{white-space:pre-wrap}'+
    'html.cs-open,html.cs-open body{overflow-x:hidden!important}'+
    '#'+ID+'.cs-drag{transition:none!important}'+
    '#'+ID+' .cs-grab{display:block;width:44px;height:5px;margin:6px auto 0;border-radius:3px;background:rgba(220,214,201,.28);pointer-events:none}';
  document.head.appendChild(s);

  /* anything still wider than the Chamber (a nowrap line, a fixed width) gets folded to fit */
  function fit(ch){
    var W=ch.clientWidth; if(!W)return;
    var all=ch.querySelectorAll('*');
    for(var i=0;i<all.length;i++){
      var e=all[i];
      /* a list that scrolls up/down must not also scroll sideways */
      if(!e.__csX){ var ox=''; try{ ox=getComputedStyle(e).overflowX; }catch(x){} if(ox==='auto'||ox==='scroll'){ e.__csX=true; e.style.overflowX='hidden'; e.style.touchAction='pan-y'; } }
      if(e.__csFit)continue;
      if(e.offsetWidth>W+1){
        e.__csFit=true;
        e.style.maxWidth='100%'; e.style.minWidth='0';
        try{ if(getComputedStyle(e).whiteSpace==='nowrap')e.style.whiteSpace='normal'; }catch(x){}
      }
    }
    ch.scrollLeft=0;
    ch.querySelectorAll('*').forEach(function(e){ if(e.scrollLeft)e.scrollLeft=0; });
  }

  /* ---------- 2. pull down to close ---------- */
  function panel(ch){
    /* the visible card inside the overlay; if the Chamber is the card itself, move the Chamber */
    var kids=[].slice.call(ch.children).filter(function(k){ return k.offsetHeight>ch.offsetHeight*0.5; });
    return kids.length===1?kids[0]:ch;
  }
  function closeBtn(ch){
    var bs=ch.querySelectorAll('button,[role="button"]');
    for(var i=0;i<bs.length;i++){
      var b=bs[i], t=(b.textContent||'').trim(), a=(b.getAttribute('aria-label')||'')+' '+(b.className||'');
      if(/close|shut/i.test(a)||/^[\u2715\u2716\u00D7xX]$/.test(t))return b;
    }
    return null;
  }
  function close(ch){
    var b=closeBtn(ch);
    if(b){ b.click(); return; }
    try{ if(window.SC&&typeof window.SC.close==='function'){ window.SC.close(); return; } }catch(e){}
    ch.classList.remove('on');
  }
  /* the nearest scroller between the touch and the Chamber; null if the touch is outside any scroller (the header) */
  function scroller(el,ch){
    for(var e=el;e&&e!==ch;e=e.parentElement){
      if(e.scrollHeight>e.clientHeight+2){
        var oy=''; try{ oy=getComputedStyle(e).overflowY; }catch(x){}
        if(oy==='auto'||oy==='scroll')return e;
      }
    }
    return null;
  }
  var d=null; /* drag state */
  function onStart(ev){
    var ch=document.getElementById(ID); if(!ch||!ch.classList.contains('on')||ev.touches.length!==1)return;
    var t=ev.target; if(!ch.contains(t))return;
    if(t.closest('input,textarea,select,[contenteditable="true"],#cmSheet'))return;
    var a=document.activeElement; if(a&&/^(INPUT|TEXTAREA)$/.test(a.tagName))return; /* keyboard up: leave it */
    var sc=scroller(t,ch);
    d={ch:ch,p:panel(ch),sc:sc,x:ev.touches[0].clientX,y:ev.touches[0].clientY,t:Date.now(),dy:0,on:false,dead:false,ly:ev.touches[0].clientY,lt:Date.now(),v:0};
  }
  function onMove(ev){
    if(!d||d.dead)return;
    var tx=ev.touches[0].clientX, ty=ev.touches[0].clientY, dx=tx-d.x, dy=ty-d.y;
    if(!d.on){
      if(Math.abs(dx)<6&&Math.abs(dy)<6)return;
      /* only a downward, mostly-vertical pull, and only when the list under the finger is at its top */
      if(dy<=0||Math.abs(dx)>Math.abs(dy)||(d.sc&&d.sc.scrollTop>0)){ d.dead=true; return; }
      d.on=true; d.ch.classList.add('cs-drag'); d.p.style.transition='none'; d.p.style.willChange='transform';
    }
    ev.preventDefault();
    var now=Date.now(); d.v=(ty-d.ly)/Math.max(1,now-d.lt); d.ly=ty; d.lt=now;
    d.dy=Math.max(0,dy);
    /* follows the finger 1:1 to the close point, then resists */
    var shown=d.dy<=CLOSE_AT?d.dy:CLOSE_AT+(d.dy-CLOSE_AT)*0.45;
    d.p.style.transform='translateY('+shown+'px)';
    d.p.style.opacity=String(Math.max(0.55,1-shown/700));
  }
  function onEnd(){
    if(!d)return; var g=d; d=null;
    if(!g.on)return;
    g.ch.classList.remove('cs-drag');
    var go=g.dy>CLOSE_AT||(g.v>FLICK&&g.dy>40);
    g.p.style.transition='transform .22s ease, opacity .22s ease';
    if(go){
      g.p.style.transform='translateY(100%)'; g.p.style.opacity='0';
      try{ navigator.vibrate&&navigator.vibrate(8); }catch(e){}
      setTimeout(function(){ close(g.ch); reset(g.p); },200);
    } else {
      g.p.style.transform=''; g.p.style.opacity='';
      setTimeout(function(){ reset(g.p); },240);
    }
  }
  function reset(p){ p.style.transition=''; p.style.transform=''; p.style.opacity=''; p.style.willChange=''; }
  document.addEventListener('touchstart',onStart,{passive:true,capture:true});
  document.addEventListener('touchmove',onMove,{passive:false,capture:true});
  document.addEventListener('touchend',onEnd,{passive:true,capture:true});
  document.addEventListener('touchcancel',onEnd,{passive:true,capture:true});

  /* a small grab bar at the top so it reads as pull-down-able */
  function grab(ch){
    var p=panel(ch); if(p.querySelector(':scope > .cs-grab'))return;
    var g=document.createElement('i'); g.className='cs-grab'; g.setAttribute('aria-hidden','true');
    p.insertBefore(g,p.firstChild);
  }

  /* ---------- watch for the Chamber opening / filling ---------- */
  var ft=null;
  function tick(){
    var ch=document.getElementById(ID), open=!!(ch&&ch.classList.contains('on'));
    document.documentElement.classList.toggle('cs-open',open);
    if(!open)return;
    if(matchMedia('(pointer:coarse)').matches)grab(ch);
    clearTimeout(ft); ft=setTimeout(function(){ fit(ch); },120);
  }
  new MutationObserver(tick).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',function(){ var ch=document.getElementById(ID); if(ch){ ch.querySelectorAll('*').forEach(function(e){ e.__csFit=false; }); tick(); } });
  tick();
})();
