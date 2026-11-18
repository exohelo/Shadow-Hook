/* thousand.js — #nov17 1,000 MEMBERS.
   · "Founding 1,000" mark (wall index 121) for the first 1,000 members. The server already put it on 907 walls;
     this tops up anyone whose wall row didn't exist yet (server list: founding_1000 / shk_founder_rank()).
     It goes on quietly — no Port Bucks, like the Council mark — with a one-time "you're Founder #N" card.
   · The "1,000 STRONG" theme: gold on black, a ribbon across the top and one burst of gold confetti per visit.
     Turned on fleet-wide by km_flags.season = 'thousand' (a cron puts it back to auto after 24 hours). */
(function(){
  'use strict';
  if(window.__k1000)return; window.__k1000=true;
  var IX=121;
  var css=document.createElement('style'); css.textContent=
  'html.season-thousand{--copper:#d9a12b;--copper-hi:#f7d36b;--ember:#b8860b;--scg:247,211,107;--neon:#f7d36b;--neon2:#d9a12b;--neon3:#fff1c2;--neon-v:#8a6a1c;--glow:0 0 12px rgba(247,211,107,.45);--glow2:0 0 14px rgba(217,161,43,.45)}'+
  'html.season-thousand body{background:#0a0806}'+
  'html.season-thousand .topbar{background:rgba(14,11,6,.9)!important;border-bottom:2px solid #d9a12b}'+
  'html.season-thousand .nav{background:rgba(14,11,6,.95)!important;border-top:2px solid #d9a12b}'+
  'html.season-thousand .card:before{background:linear-gradient(90deg,transparent,#f7d36b,#d9a12b,#f7d36b,transparent)!important;height:3px}'+
  'html.season-thousand .card-h:before{background:linear-gradient(180deg,#f7d36b,#8a6a1c)}'+
  'html.season-thousand .arc-aurora i:nth-child(1){background:radial-gradient(circle,rgba(217,161,43,.45),transparent 68%)}'+
  'html.season-thousand .arc-aurora i:nth-child(2){background:radial-gradient(circle,rgba(247,211,107,.28),transparent 68%)}'+
  'html.season-thousand .arc-aurora i:nth-child(3){background:radial-gradient(circle,rgba(255,241,194,.18),transparent 70%)}'+
  'html.season-thousand body:before{background:radial-gradient(ellipse 120% 60% at 50% -8%,rgba(247,211,107,.16),transparent 58%)}'+
  'html.season-thousand .boot-frame:after{content:"\\2693  1,000 STRONG  \\2693";display:block;margin-top:14px;text-align:center;font:800 16px/1.3 Inter,system-ui,sans-serif;letter-spacing:.2em;color:#f7d36b;text-shadow:0 2px 14px rgba(0,0,0,.7)}'+
  'html.season-thousand.daylight{--copper:#8a6a1c;--copper-hi:#b8860b;--neon:#8a6a1c;--neon2:#b8860b;--neon-v:#8a6a1c}html.season-thousand.daylight body{background:#fbf6e8}'+
  'html.season-thousand.daylight .topbar,html.season-thousand.daylight .nav{background:rgba(255,252,243,.95)!important}'+
  '#k1Rib{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 64px);z-index:8000;width:max-content;max-width:calc(100vw - 20px);box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:9px 12px 9px 16px;border-radius:999px;background:linear-gradient(180deg,#2a1f08,#130e05);border:1.5px solid #f7d36b;box-shadow:0 8px 30px rgba(0,0,0,.55),0 0 24px rgba(247,211,107,.35);color:#fff1c2;font:700 13px Inter,system-ui,sans-serif;letter-spacing:.04em;animation:k1in .5s cubic-bezier(.2,1.3,.4,1)}'+
  '#k1Rib b{font:400 17px Anton,sans-serif;letter-spacing:.08em;color:#f7d36b;white-space:nowrap;flex:none}#k1Rib span{line-height:1.25}#k1Rib>span:first-child{flex:none}#k1Rib button{flex:none}#k1Rib button{border:0;background:none;color:#c9b27a;font-size:16px;padding:2px 4px;cursor:pointer}'+
  '@keyframes k1in{from{opacity:0;transform:translate(-50%,-14px)}to{opacity:1;transform:translate(-50%,0)}}'+
  '#k1Card{position:fixed;inset:0;z-index:9100;background:#000c;display:flex;align-items:center;justify-content:center;padding:20px}'+
  '#k1Card .in{max-width:380px;width:100%;text-align:center;padding:26px 22px 20px;border-radius:22px;background:radial-gradient(circle at 50% 0,#3a2a0a,#120d05 70%);border:2px solid #f7d36b;box-shadow:0 0 60px rgba(247,211,107,.35);color:#fff1c2;font:500 14px/1.5 Inter,system-ui,sans-serif}'+
  '#k1Card .big{font-size:56px;line-height:1}#k1Card .t{font:400 30px Anton,sans-serif;letter-spacing:.05em;color:#f7d36b;margin:6px 0 2px}#k1Card .n{font:700 12px Inter,system-ui,sans-serif;letter-spacing:.22em;color:#c9b27a}'+
  '#k1Card button{margin-top:16px;width:100%;height:48px;border:0;border-radius:12px;background:linear-gradient(180deg,#f7d36b,#d9a12b);color:#1a1206;font:400 18px Anton,sans-serif;letter-spacing:.1em;cursor:pointer}';
  document.head.appendChild(css);

  function on(){ return document.documentElement.classList.contains('season-thousand'); }
  function ss(k,v){ try{ if(v===undefined)return sessionStorage.getItem(k); sessionStorage.setItem(k,v); }catch(e){ return null; } }
  function ls(k,v){ try{ if(v===undefined)return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }

  /* one burst of gold confetti */
  function confetti(){ try{ if(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    var c=document.createElement('canvas'), x=c.getContext('2d'), W=c.width=innerWidth*devicePixelRatio, H=c.height=innerHeight*devicePixelRatio;
    c.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:9200;pointer-events:none'; document.body.appendChild(c);
    var cols=['#f7d36b','#d9a12b','#fff1c2','#b8860b','#ffffff'], P=[], i;
    for(i=0;i<160;i++)P.push({x:W*(.2+.6*Math.random()),y:H*.32,vx:(Math.random()-.5)*W*.018,vy:-(H*.008+Math.random()*H*.016),r:(4+Math.random()*6)*devicePixelRatio,a:Math.random()*6,va:(Math.random()-.5)*.3,c:cols[i%cols.length]});
    var t0=performance.now();
    (function f(t){ var el=t-t0; x.clearRect(0,0,W,H);
      P.forEach(function(p){ p.vy+=H*.00045; p.vx*=.992; p.x+=p.vx; p.y+=p.vy; p.a+=p.va; x.save(); x.translate(p.x,p.y); x.rotate(p.a); x.globalAlpha=Math.max(0,1-el/3400); x.fillStyle=p.c; x.fillRect(-p.r/2,-p.r/4,p.r,p.r/2); x.restore(); });
      if(el<3500)requestAnimationFrame(f); else c.remove(); })(t0);
  }catch(e){} }

  /* banner runs through Thu Nov 19 (PT) on whatever skin is up; closing it hides it for that visit */
  function live(){ return on()||Date.now()<Date.parse('2026-11-20T08:00:00Z'); }
  function ribbon(){ if(!live()||document.getElementById('k1Rib')||ss('k1rib'))return;
    if(document.documentElement.classList.contains('at-gate'))return;
    var r=document.createElement('div'); r.id='k1Rib';
    r.innerHTML='<span>⚓</span><b>1,000 STRONG</b><span>thank you for building the Order</span><button type="button" aria-label="Close">✕</button>';
    document.body.appendChild(r); if(!ss('k1boom')){ ss('k1boom','1'); confetti(); }
    r.querySelector('button').addEventListener('click',function(){ ss('k1rib','1'); r.remove(); }); }

  /* the Founding 1,000 mark */
  function wallKey(){ try{ return typeof K==='function'?K('badges'):null; }catch(e){ return null; } }
  function hasMark(){ var k=wallKey(); if(!k)return false; try{ var w=JSON.parse(localStorage.getItem(k)||'[]'); return Array.isArray(w)&&w.indexOf(IX)>=0; }catch(e){ return false; } }
  function giveMark(){ var k=wallKey(); if(!k)return; try{
      var raw=localStorage.getItem(k); if(raw==='')return; var w=raw===null?[]:JSON.parse(raw); if(!Array.isArray(w)||w.indexOf(IX)>=0)return;
      if(raw===null&&typeof BADGES!=='undefined')BADGES.forEach(function(b,i){ if(b[2]&&w.indexOf(i)<0)w.push(i); });
      w.push(IX); localStorage.setItem(k,JSON.stringify(w));
      try{ var pk=K('markspaid'), p=JSON.parse(localStorage.getItem(pk)||'null'); if(Array.isArray(p)&&p.indexOf(IX)<0){ p.push(IX); localStorage.setItem(pk,JSON.stringify(p)); } }catch(e){}
      if(typeof BADGES!=='undefined'&&BADGES[IX]){ BADGES[IX][2]=1; if(typeof renderBadges==='function')renderBadges(); }
    }catch(e){} }
  function founderCard(rank){ var key='shk_k1card_'+(window.__shkUid||''); if(ls(key))return; ls(key,'1');
    var d=document.createElement('div'); d.id='k1Card';
    d.innerHTML='<div class="in"><div class="big">⚓</div><div class="n">THE ORDER HIT 1,000</div><div class="t">FOUNDING 1,000</div>'+
      '<div>You’re <b style="color:#f7d36b">Founder #'+rank+'</b> — one of the first thousand in the Order. A legendary mark is on your wall for good. Nobody who joins from here can ever earn it.</div>'+
      '<button type="button">WEAR IT PROUD</button></div>';
    document.body.appendChild(d); confetti();
    d.addEventListener('click',function(e){ if(e.target===d||e.target.tagName==='BUTTON')d.remove(); }); }
  function founder(){ if(!window.SB||!window.__shkUid)return false;
    window.SB.rpc('shk_founder_rank').then(function(r){ var rank=r&&r.data; if(!rank)return; giveMark(); founderCard(rank); }).catch(function(){});
    return true; }

  var tries=0, iv=setInterval(function(){ tries++; if(founder()||tries>90)clearInterval(iv); },1000);
  setTimeout(ribbon,2500);
  new MutationObserver(function(){ if(live())setTimeout(ribbon,800); }).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
})();
