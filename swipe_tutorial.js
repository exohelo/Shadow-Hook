/* swipe_tutorial.js — #swipetut (oct 13). One time, for every member: how to get out of the full screens.
   Three short cards, each with a little screen you can actually try it on:
     1. PULL DOWN TO CLOSE   — games, the casino, profiles, member cards, a post on the board
     2. SWIPE SIDEWAYS BACK  — messages, DMs, chat rooms
     3. SWIPE BETWEEN BOARDS — a board's post, left and right to change days
   Seen once per member, not per phone: the server keeps it (member_tips, tip_seen / tip_done), with a local copy so
   it never even asks twice on the same phone. It waits until the member is signed in and nothing else is up (the
   loader, the gate, a sheet, a game, the council entrance or vote pop-up), then shows.
   Replay any time: window.showSwipeTutorial().
   Load once from index.html, after the Supabase client:  <script src="swipe_tutorial.js" defer></script> */
(function(){
  'use strict';
  if(window.__swipeTut)return; window.__swipeTut=true;
  var TIP='swipe_v1', KEY='shk_tip_'+TIP+':';
  var hum=function(p){ try{ buzz(p||[15]); }catch(e){} };
  var RM=false; try{ RM=matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var el=null, step=0, shownFor=null, waiting=null;

  var STEPS=[
    { k:'pull', t:'Pull down to close', s:'Games, the casino, profiles, member cards, a post on the board. Grab the bar at the top, or anywhere while you\u2019re at the top, and pull down.', try:'Try it: pull this screen down', ok:'That\u2019s it.' },
    { k:'side', t:'Swipe sideways to go back', s:'Messages, DMs and chat rooms. Swipe across the screen from anywhere, not just the edge.', try:'Try it: swipe this chat to the right', ok:'Back you go.' },
    { k:'days', t:'Swipe to change boards', s:'On a board\u2019s post, swipe left or right to move between days. Same as the \u2039 \u203a arrows up top.', try:'Try it: swipe left or right', ok:'You\u2019ve got it.' }
  ];

  function css(){
    if(document.getElementById('swtCSS'))return;
    var st=document.createElement('style'); st.id='swtCSS';
    st.textContent=[
      /* #swtarcade — dressed in the app's own arcade skin: its tokens (var(--neon), --plate, --line…) so it follows
         the theme, daylight included; glass card, neon edge, the 3D push buttons */
      '#swtPop{--sw-n:var(--neon,#4de2ff);--sw-v:var(--neon-v,#7b5cff);--sw-p:var(--neon2,#ff4dd2);--sw-l:var(--neon3,#b6ff3d)}',
      '#swtPop{position:fixed;inset:0;z-index:420;display:flex;align-items:flex-end;justify-content:center;background:radial-gradient(90% 60% at 50% 100%,rgba(123,92,255,.22),transparent 70%),rgba(4,2,12,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding:12px 12px calc(12px + env(safe-area-inset-bottom,0px));opacity:0;transition:opacity .22s;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--bone,#ece9f5)}',
      '#swtPop[hidden]{display:none!important}#swtPop.on{opacity:1}@media (min-width:560px){#swtPop{align-items:center}}',
      '#swtPop .swt-box{position:relative;width:100%;max-width:420px;border-radius:22px;padding:20px 16px 14px;overflow:hidden;background:linear-gradient(184deg,rgba(36,31,66,.92),rgba(18,16,31,.97) 64%);border:1px solid var(--line,rgba(160,140,255,.2));backdrop-filter:blur(14px) saturate(1.25);-webkit-backdrop-filter:blur(14px) saturate(1.25);box-shadow:0 24px 60px rgba(4,2,12,.75),inset 0 1px rgba(200,180,255,.16),0 0 0 1px rgba(123,92,255,.08);transform:translateY(22px);transition:transform .28s cubic-bezier(.2,.9,.3,1)}',
      '#swtPop .swt-box:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,var(--sw-n),var(--sw-v) 55%,var(--sw-p));box-shadow:0 0 14px rgba(77,226,255,.55)}',
      '#swtPop .swt-box:after{content:"";position:absolute;right:-60px;top:-60px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(255,77,210,.16),transparent 70%);pointer-events:none}',
      '#swtPop.on .swt-box{transform:none}',
      '#swtPop .swt-k{position:relative;display:flex;justify-content:space-between;align-items:center;font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:13px;letter-spacing:.2em;color:var(--sw-n);text-shadow:0 0 10px rgba(77,226,255,.45)}',
      '#swtPop .swt-k span:last-child{font-family:"IBM Plex Mono",monospace;font-weight:500;font-size:12px;letter-spacing:.06em;color:var(--steel,#9a93b8);text-shadow:none}',
      '#swtPop h2{position:relative;margin:8px 0 6px;padding-left:12px;font-family:Anton,sans-serif;font-weight:400;font-size:28px;line-height:1.05;letter-spacing:.03em;text-transform:uppercase;color:#fff}',
      '#swtPop h2:before{content:"";position:absolute;left:0;top:12%;bottom:12%;width:3px;border-radius:2px;background:linear-gradient(180deg,var(--sw-n),var(--sw-v));box-shadow:0 0 12px rgba(77,226,255,.45)}',
      '#swtPop p{position:relative;margin:0;font-size:15px;line-height:1.45;color:var(--steel,#b5afd0)}',
      /* the little phone you can practice on */
      '#swtPop .swt-stage{position:relative;height:230px;margin:14px 0 10px;border-radius:18px;overflow:hidden;background:radial-gradient(80% 60% at 50% 0%,rgba(123,92,255,.18),transparent 70%),var(--well,#0d0b18);border:1px solid var(--line,rgba(160,140,255,.2));box-shadow:inset 0 2px 10px rgba(0,0,0,.5);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}',
      '#swtPop .swt-stage.dragging{cursor:grabbing}',
      '#swtPop .swt-under{position:absolute;inset:0;display:grid;place-items:center;font-family:Anton,sans-serif;font-size:18px;letter-spacing:.14em;color:rgba(154,147,184,.45)}',
      '#swtPop .swt-scr{position:absolute;inset:10px;border-radius:14px;background:linear-gradient(184deg,var(--plate-3,#241f42),var(--plate,#12101f) 70%);border:1px solid rgba(123,92,255,.45);box-shadow:0 12px 28px rgba(4,2,12,.6),inset 0 1px rgba(200,180,255,.18),0 0 18px rgba(123,92,255,.18);display:flex;flex-direction:column;gap:8px;padding:22px 12px 12px;will-change:transform}',
      '#swtPop .swt-grip{position:absolute;left:50%;top:8px;width:40px;height:5px;margin-left:-20px;border-radius:3px;background:var(--sw-n);box-shadow:0 0 10px rgba(77,226,255,.7)}',
      '#swtPop .swt-bar{height:12px;border-radius:6px;background:rgba(160,140,255,.16)}',
      '#swtPop .swt-bar.w6{width:60%}#swtPop .swt-bar.w8{width:80%}#swtPop .swt-bar.w4{width:40%}#swtPop .swt-bar.hi{background:linear-gradient(90deg,var(--sw-n),var(--sw-v));opacity:.7}',
      '#swtPop .swt-msg{max-width:72%;padding:8px 11px;border-radius:14px 14px 14px 4px;background:var(--bubble,#1e1938);border:1px solid rgba(160,140,255,.18);font-size:13px;color:var(--bone,#ece9f5)}',
      '#swtPop .swt-msg.me{margin-left:auto;border-radius:14px 14px 4px 14px;background:linear-gradient(135deg,rgba(77,226,255,.28),rgba(123,92,255,.32));border-color:rgba(77,226,255,.45);color:#fff}',
      '#swtPop .swt-day{font-family:Anton,sans-serif;font-size:30px;color:#fff;text-align:center;margin:8px 0 2px;letter-spacing:.04em;text-shadow:0 0 16px rgba(77,226,255,.45)}',
      '#swtPop .swt-arrows{display:flex;justify-content:space-between;font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:14px;letter-spacing:.06em;color:var(--sw-n)}',
      /* the finger that shows how */
      '#swtPop .swt-hand{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:radial-gradient(circle,#fff 0 26%,rgba(77,226,255,.55) 27% 52%,transparent 54%);box-shadow:0 0 0 2px rgba(77,226,255,.75),0 0 24px rgba(77,226,255,.6);pointer-events:none;opacity:0;z-index:3}',
      '#swtPop .swt-stage.demo-pull .swt-hand{left:50%;top:36px;animation:swtHandPull 2.4s ease-in-out infinite}',
      '#swtPop .swt-stage.demo-pull .swt-scr{animation:swtScrPull 2.4s ease-in-out infinite}',
      '@keyframes swtHandPull{0%{opacity:0;transform:none}12%{opacity:1;transform:none}60%{opacity:1;transform:translateY(130px)}75%{opacity:0;transform:translateY(130px)}100%{opacity:0}}',
      '@keyframes swtScrPull{0%,12%{transform:none}60%{transform:translateY(130px)}75%{transform:translateY(130px);opacity:.3}76%{transform:none;opacity:0}100%{transform:none;opacity:1}}',
      '#swtPop .swt-stage.demo-side .swt-hand{left:22%;top:50%;animation:swtHandSide 2.4s ease-in-out infinite}',
      '#swtPop .swt-stage.demo-side .swt-scr{animation:swtScrSide 2.4s ease-in-out infinite}',
      '@keyframes swtHandSide{0%{opacity:0;transform:none}12%{opacity:1;transform:none}60%{opacity:1;transform:translateX(190px)}75%{opacity:0;transform:translateX(190px)}100%{opacity:0}}',
      '@keyframes swtScrSide{0%,12%{transform:none}60%{transform:translateX(190px)}75%{transform:translateX(190px);opacity:.3}76%{transform:none;opacity:0}100%{transform:none;opacity:1}}',
      '#swtPop .swt-stage.demo-days .swt-hand{left:75%;top:55%;animation:swtHandDays 2.6s ease-in-out infinite}',
      '#swtPop .swt-stage.demo-days .swt-scr{animation:swtScrDays 2.6s ease-in-out infinite}',
      '@keyframes swtHandDays{0%{opacity:0;transform:none}12%{opacity:1;transform:none}55%{opacity:1;transform:translateX(-150px)}70%{opacity:0;transform:translateX(-150px)}100%{opacity:0}}',
      '@keyframes swtScrDays{0%,12%{transform:none}50%{transform:translateX(-46px)}62%,100%{transform:none}}',
      '#swtPop .swt-stage.done .swt-hand,#swtPop .swt-stage.touched .swt-hand{display:none}#swtPop .swt-stage.done .swt-scr,#swtPop .swt-stage.touched .swt-scr{animation:none}',
      '#swtPop .swt-stage.done{border-color:rgba(182,255,61,.55);box-shadow:inset 0 2px 10px rgba(0,0,0,.5),0 0 18px rgba(182,255,61,.25)}',
      '#swtPop .swt-try{font-family:"Barlow Condensed",sans-serif;font-weight:700;font-size:15px;letter-spacing:.08em;text-transform:uppercase;color:var(--steel,#9a93b8);text-align:center;min-height:20px}',
      '#swtPop .swt-try.ok{color:var(--sw-l);text-shadow:0 0 10px rgba(182,255,61,.45)}',
      '#swtPop .swt-foot{position:relative;display:flex;align-items:center;gap:10px;margin-top:14px}',
      '#swtPop .swt-dots{flex:1;display:flex;gap:6px}',
      '#swtPop .swt-dots i{width:8px;height:8px;border-radius:50%;background:rgba(160,140,255,.22);transition:width .2s}#swtPop .swt-dots i.on{width:24px;border-radius:4px;background:linear-gradient(90deg,var(--sw-n),var(--sw-v));box-shadow:0 0 10px rgba(77,226,255,.5)}',
      '#swtPop .swt-skip{border:0;background:none;color:var(--steel,#9a93b8);font:600 14px/1 Inter,system-ui,sans-serif;padding:12px 8px;cursor:pointer}',
      '#swtPop .swt-next{min-width:118px;min-height:48px;padding:0 20px;border-radius:12px;cursor:pointer;font-family:Anton,sans-serif;font-size:17px;letter-spacing:.08em;text-transform:uppercase;color:#fff;background:linear-gradient(184deg,rgba(77,226,255,.42),rgba(12,20,32,.92));border:1px solid rgba(77,226,255,.6);box-shadow:0 6px rgba(18,86,110,.55),0 10px 24px rgba(4,2,12,.5),inset 0 1px rgba(200,240,255,.22);text-shadow:0 0 10px rgba(77,226,255,.6);transition:transform .1s ease,box-shadow .1s ease}',
      '#swtPop .swt-next:active{transform:translateY(4px);box-shadow:0 2px rgba(18,86,110,.55),0 4px 12px rgba(4,2,12,.5),inset 0 1px rgba(200,240,255,.18)}',
      '#swtPop button:focus-visible{outline:2px solid var(--sw-n);outline-offset:2px}',
      /* daylight: the light card */
      'html.daylight #swtPop{background:rgba(40,30,80,.35)}',
      'html.daylight #swtPop .swt-box{background:linear-gradient(184deg,#fdfcff,#f5f2ff 70%);border-color:rgba(123,92,255,.25);box-shadow:0 18px 44px rgba(60,40,120,.25),inset 0 1px #fff}',
      'html.daylight #swtPop h2,html.daylight #swtPop .swt-day{color:#1a1430;text-shadow:none}html.daylight #swtPop p{color:#5b5476}',
      'html.daylight #swtPop .swt-stage{background:#eeeaff}html.daylight #swtPop .swt-scr{background:linear-gradient(184deg,#fff,#f3f0ff);border-color:rgba(123,92,255,.35)}',
      'html.daylight #swtPop .swt-msg{background:#fff;color:#1a1430}html.daylight #swtPop .swt-msg.me{color:#1a1430}',
      'html.daylight #swtPop .swt-next{color:#0b2a36;text-shadow:none;background:linear-gradient(184deg,#9ff0ff,#4de2ff)}',
      '@media (prefers-reduced-motion:reduce){#swtPop .swt-hand{animation:none!important;opacity:0!important}#swtPop .swt-scr{animation:none!important}#swtPop,#swtPop .swt-box{transition:none}}'
    ].join('');
    document.head.appendChild(st);
  }

  function stageHTML(k){
    var inner=k==='pull'
      ? '<i class="swt-grip"></i><div class="swt-bar w6 hi"></div><div class="swt-bar w8"></div><div class="swt-bar"></div><div class="swt-bar w4"></div><div class="swt-bar w8"></div>'
      : k==='side'
      ? '<div class="swt-bar w4 hi"></div><div class="swt-msg">you on tonight?</div><div class="swt-msg me">on the night side</div><div class="swt-msg">see you at the board</div>'
      : '<div class="swt-arrows"><span>\u2039 Mon</span><span>Wed \u203a</span></div><div class="swt-day" id="swtDay">TUESDAY</div><div class="swt-bar w8"></div><div class="swt-bar w6"></div>';
    var under=k==='pull'?'THE HALL':k==='side'?'YOUR MESSAGES':'';
    return '<div class="swt-stage demo-'+k+'" aria-hidden="true"><div class="swt-under">'+under+'</div><div class="swt-scr">'+inner+'</div><i class="swt-hand"></i></div>';
  }
  function paint(){
    var S=STEPS[step], last=step===STEPS.length-1;
    el.querySelector('.swt-box').innerHTML=
      '<div class="swt-k"><span>GETTING AROUND</span><span>'+(step+1)+' of '+STEPS.length+'</span></div>'
      +'<h2 id="swtT">'+S.t+'</h2><p>'+S.s+'</p>'
      +stageHTML(S.k)
      +'<div class="swt-try">'+S.try+'</div>'
      +'<div class="swt-foot"><div class="swt-dots">'+STEPS.map(function(_,i){ return '<i class="'+(i===step?'on':'')+'"></i>'; }).join('')+'</div>'
      +(last?'':'<button type="button" class="swt-skip" data-swt="skip">Skip</button>')
      +'<button type="button" class="swt-next" data-swt="next">'+(last?'Got it':'Next')+'</button></div>';
    wire(el.querySelector('.swt-stage'), S.k);
    setTimeout(function(){ try{ el.querySelector('.swt-next').focus({preventScroll:true}); }catch(e){} },80);
  }

  /* the practice screen follows a finger (or a mouse) and does the real thing */
  function wire(stage,k){
    var scr=stage.querySelector('.swt-scr'), x0=null, y0=0, dx=0, dy=0, done=false, days=['MONDAY','TUESDAY','WEDNESDAY'], di=1;
    function pt(e){ var t=e.touches?e.touches[0]:e; return {x:t.clientX,y:t.clientY}; }
    function start(e){ if(done&&k!=='days')return; var p=pt(e); x0=p.x; y0=p.y; dx=dy=0; stage.classList.add('touched','dragging'); scr.style.transition='none'; scr.style.opacity=''; }
    function move(e){ if(x0==null)return; var p=pt(e); dx=p.x-x0; dy=p.y-y0;
      if(k==='pull')scr.style.transform='translateY('+Math.max(0,dy)+'px)';
      else if(k==='side')scr.style.transform='translateX('+Math.max(0,dx)+'px)';
      else scr.style.transform='translateX('+(dx*.35)+'px)';
      if(e.cancelable)e.preventDefault(); }
    function end(){ if(x0==null)return; x0=null; stage.classList.remove('dragging'); scr.style.transition='transform .25s cubic-bezier(.2,.9,.3,1),opacity .25s';
      var hit=k==='pull'?dy>70:k==='side'?dx>70:Math.abs(dx)>50;
      if(k==='days'&&hit){ di=Math.max(0,Math.min(2,di+(dx<0?1:-1))); var d=stage.querySelector('#swtDay'); if(d)d.textContent=days[di]; scr.style.transform=''; }
      else if(hit){ scr.style.transform=k==='pull'?'translateY(110%)':'translateX(110%)'; scr.style.opacity='0';
        setTimeout(function(){ scr.style.transition='opacity .3s'; scr.style.transform=''; scr.style.opacity='1'; },700); }
      else scr.style.transform='';
      if(hit&&!done){ done=true; hum([12,30,12]); stage.classList.add('done'); var t=el.querySelector('.swt-try'); if(t){ t.textContent='\u2713 '+STEPS[step].ok; t.classList.add('ok'); }
        if(step<STEPS.length-1)setTimeout(function(){ if(el&&el.classList.contains('on')&&STEPS[step].k===k){ step++; paint(); } },1100); } }
    stage.addEventListener('touchstart',start,{passive:true});
    stage.addEventListener('touchmove',move,{passive:false});
    stage.addEventListener('touchend',end); stage.addEventListener('touchcancel',end);
    stage.addEventListener('mousedown',function(e){ start(e); var mm=function(ev){ move(ev); }, mu=function(){ window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu); end(); };
      window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu); });
  }

  function open(){
    css(); step=0;
    if(!el){
      el=document.createElement('div'); el.id='swtPop'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-labelledby','swtT');
      el.innerHTML='<div class="swt-box"></div>'; document.body.appendChild(el);
      el.addEventListener('click',function(e){ var b=e.target.closest('[data-swt]'); if(!b)return; var a=b.getAttribute('data-swt');
        if(a==='skip'){ finish(); return; }
        if(a==='next'){ if(step<STEPS.length-1){ step++; paint(); hum([10]); } else finish(); } });
      el.addEventListener('keydown',function(e){ if(e.key==='Escape'){ e.stopPropagation(); finish(); } });
    }
    paint(); el.hidden=false; void el.offsetWidth; el.classList.add('on'); hum([15,40,15]);
  }
  function finish(){
    if(!el)return; el.classList.remove('on'); setTimeout(function(){ if(el&&!el.classList.contains('on'))el.hidden=true; },240);
    var uid=window.__shkUid; if(!uid)return;
    try{ localStorage.setItem(KEY+uid,'1'); }catch(e){}
    try{ window.SB&&window.SB.rpc('tip_done',{p_tip:TIP}).then(function(){},function(){}); }catch(e){}
  }

  /* only when nothing else is on screen */
  function clear(){
    var D=document.documentElement;
    if(document.hidden||document.getElementById('boot')||D.classList.contains('at-gate'))return false;
    if(document.querySelector('.sheet.on,.dlg.on,.roomscreen.on,#pmCasino.on,#vnPop.on,#scGate.on,[id$="View"].on'))return false;
    try{ if(typeof window.pmIsOpen==='function'&&window.pmIsOpen())return false; }catch(e){}
    var a=document.activeElement; if(a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName))return false;
    return true;
  }
  function waitThenOpen(uid){
    clearInterval(waiting); var calm=0;
    waiting=setInterval(function(){
      if(window.__shkUid!==uid){ clearInterval(waiting); return; }
      calm=clear()?calm+1:0;
      if(calm>=3){ clearInterval(waiting); if(!(el&&el.classList.contains('on')))open(); }   /* ~3 s of nothing else up */
    },1000);
  }
  function check(uid){
    try{ if(localStorage.getItem(KEY+uid))return; }catch(e){}
    var sb=window.SB; if(!sb)return;
    sb.rpc('tip_seen',{p_tip:TIP}).then(function(r){
      if(!r||r.error||window.__shkUid!==uid)return;
      if(r.data===true){ try{ localStorage.setItem(KEY+uid,'1'); }catch(e){} return; }
      waitThenOpen(uid);
    },function(){});
  }
  setInterval(function(){
    var uid=window.__shkUid||null;
    if(uid&&uid!==shownFor){ shownFor=uid; setTimeout(function(){ check(uid); },2500); }
    if(!uid)shownFor=null;
  },1000);

  window.showSwipeTutorial=open;
})();
