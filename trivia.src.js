/* trivia.js — DOCK TRIVIA, as its own file (#games, oct 10). Loaded by index.html the first time the card is tapped
   (gameLoad('trivia')); nothing in here is parsed at boot. A full-page room (the same .roomscreen as a lobby), arcade
   palette: cyan (you) vs magenta (them), lime for a right answer, yellow for the clock, navy ink.

   Head-to-head duels: 5 ⬡ a side, seven questions, ten seconds each, fastest correct answer takes the point, more
   points takes the 10. The phone never holds an answer — it asks the server for the seven questions (trivia_qs: text +
   four options) and sends every tap to trivia_answer, which grades it against the clock that started on the server
   (your own started_at). Question i opens at started_at + i×13 s: 10 s to tap, 3 s of reveal. All of it is GAMES.sql.
   ASYNC (oct 10): each side runs the seven on its own clock — you play the moment you put the duel up; they play
   whenever they accept, online or not. Fastest right answer per question still takes the point. */
(function(){
  'use strict';
  var esc=function(s){ return (s==null?'':(''+s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); };
  var $=function(id){ return document.getElementById(id); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var hum=function(p){ try{ buzz(p||[20]); }catch(e){} };
  var lite=function(){ try{ return document.documentElement.classList.contains('fx-lite'); }catch(e){ return false; } };
  var ago=function(t){ var d=Math.max(0,Date.now()-new Date(t).getTime()), m=Math.round(d/6e4); if(m<1)return 'just now'; if(m<60)return m+' min'; return Math.round(m/60)+' h'; };
  var me=function(){ try{ var a=(typeof loadAcct==='function'&&loadAcct())||{}; return String(a.handle||'').toUpperCase(); }catch(e){ return ''; } };
  var sb=function(){ return window.SB; };
  var rpc=function(fn,args){ if(!sb())return Promise.reject(new Error('backend off')); return sb().rpc(fn,args||{}).then(function(r){ if(r.error)throw new Error(r.error.message||'the bank refused'); return r.data; }); };
  var refreshBucks=function(){ try{ if(typeof sbRefreshBucks==='function')sbRefreshBucks(); }catch(e){} };

  var T=window.TRIVIA={ _live:false, open:open, close:close };
  var Q_MS=10000, STEP_MS=13000, N=7;
  var CY='#4dd8ff', MG='#ff3d9a', LM='#b7ff3d', YL='#ffe600';

  function css(){
    if($('trvCSS'))return;
    var st=document.createElement('style'); st.id='trvCSS';
    st.textContent=
      '#trvRoom{font-family:"Barlow Condensed",Inter,system-ui,sans-serif;color:#eaf2ff;background:radial-gradient(ellipse 120% 60% at 50% -10%,rgba(77,216,255,.22),rgba(5,7,15,0) 60%),repeating-linear-gradient(0deg,rgba(255,255,255,.025) 0 1px,rgba(0,0,0,0) 1px 4px),#05070f}'
      +'#trvRoom .trv-wrap{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;position:relative}'
      +'.trv-top{display:flex;align-items:center;gap:10px;padding:10px 14px 8px;flex:none;background:linear-gradient(180deg,rgba(77,216,255,.1),rgba(5,7,15,0))}'
      +'.trv-back{width:38px;height:38px;flex:none;border:1px solid rgba(77,216,255,.5);border-radius:8px;background:#0f1420;color:'+CY+';font-size:26px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding-bottom:3px;box-shadow:0 0 12px rgba(77,216,255,.25)}'
      +'.trv-ttl{font-family:"Bungee",sans-serif;font-size:24px;letter-spacing:.02em;color:'+CY+';line-height:1;text-shadow:0 0 18px rgba(77,216,255,.6),0 2px 0 #0a4a66}'
      +'.trv-sub{font-size:12px;font-weight:600;color:#8fa0b8;letter-spacing:.2em;text-transform:uppercase;margin-top:3px}'
      +'.trv-bank{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;font-family:"IBM Plex Mono",monospace}.trv-bank span{font-size:9px;letter-spacing:.18em;color:#8fa0b8}.trv-bank b{font-size:18px;color:'+CY+';text-shadow:0 0 10px rgba(77,216,255,.6);font-weight:500}'
      +'.trv-body{padding:8px 14px 24px;display:flex;flex-direction:column;gap:14px;flex:1}'
      +'.trv-sec{font-size:11px;letter-spacing:.22em;color:#8fa0b8;font-weight:700;display:flex;align-items:center;gap:8px}.trv-sec.hot{color:'+MG+'}.trv-sec.hot:before{content:"";width:8px;height:8px;background:'+MG+';box-shadow:0 0 10px '+MG+';border-radius:1px}'
      +'.hex{clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);display:flex;align-items:center;justify-content:center;font-family:"Bungee",sans-serif;color:#05070f;flex:none}'
      +'.trv-me{display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:linear-gradient(135deg,#141a28,#0b0f1a);border:1px solid rgba(77,216,255,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 8px 24px rgba(0,0,0,.5)}'
      +'.trv-me .nm{font-family:Anton,sans-serif;font-size:20px;letter-spacing:.04em;color:#eaf2ff}.trv-me .rk{font-size:10px;letter-spacing:.18em;color:'+CY+';border:1px solid rgba(77,216,255,.5);border-radius:4px;padding:2px 6px;font-weight:700}'
      +'.trv-me .st{display:flex;gap:14px;font-family:"IBM Plex Mono",monospace;font-size:11px;color:#8fa0b8}.trv-me .st b{color:#eaf2ff;font-size:15px;font-weight:500}'
      +'.trv-big{position:relative;width:100%;padding:18px 16px;border-radius:14px;border:2px solid '+CY+';background:linear-gradient(180deg,#1fa8e0,#0a4a66);color:#05070f;cursor:pointer;display:flex;align-items:center;justify-content:space-between;box-shadow:0 0 28px rgba(77,216,255,.35),inset 0 2px 0 rgba(255,255,255,.3),0 6px 0 #06303f;font-family:"Bungee",sans-serif;font-size:20px;text-align:left}.trv-big small{display:block;font-family:"Barlow Condensed",sans-serif;font-size:12px;font-weight:700;letter-spacing:.16em;margin-top:4px;opacity:.8}.trv-big:disabled{opacity:.5}'
      +'.trv-in{flex:1;min-width:0;box-sizing:border-box;background:#0b0f1a;border:1px solid rgba(77,216,255,.3);border-radius:10px;padding:12px;color:#eaf2ff;font-size:15px;font-weight:600;letter-spacing:.08em}'
      +'.trv-btn{padding:12px 14px;border-radius:10px;border:1px solid rgba(77,216,255,.6);background:#0f1420;color:'+CY+';font-family:"Bungee",sans-serif;font-size:12px;white-space:nowrap;cursor:pointer}.trv-btn.fill{border-color:'+CY+';background:linear-gradient(180deg,'+CY+',#1fa8e0);color:#05070f;box-shadow:0 3px 0 #0a4a66}.trv-btn.gh{border-color:rgba(220,214,201,.18);color:#eaf2ff}.trv-btn:disabled{opacity:.45}'
      +'.trv-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#0b0f1a;border:1px solid rgba(220,214,201,.12)}.trv-row.in{background:linear-gradient(90deg,rgba(255,61,154,.28),#0b0f1a 60%);border-color:rgba(255,61,154,.6);box-shadow:0 0 16px rgba(255,61,154,.25)}'
      +'.trv-row .nm{font-family:Anton,sans-serif;font-size:18px;letter-spacing:.04em;color:#eaf2ff}.trv-row .m{font-size:11px;color:#8fa0b8;letter-spacing:.1em;font-weight:600}'
      +'.trv-pod{display:flex;align-items:flex-end;gap:6px;height:118px}.trv-pod>div{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px}.trv-pod .n{font-family:Anton,sans-serif;font-size:13px;letter-spacing:.04em;color:#eaf2ff}.trv-pod .b{width:100%;border-radius:8px 8px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:6px;font-family:"Bungee",sans-serif;font-size:20px;color:#05070f}'
      +'.trv-face{display:flex;align-items:center;gap:8px;padding:10px 14px 6px}.trv-face .s{display:flex;align-items:center;gap:8px;flex:1;min-width:0}.trv-face .s.r{justify-content:flex-end}.trv-face .nm{font-family:Anton,sans-serif;font-size:15px;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.trv-face .sc{font-family:"Bungee",sans-serif;font-size:26px;line-height:1}.trv-face .vs{font-family:"Bungee",sans-serif;font-size:18px;color:'+MG+';text-shadow:0 0 14px rgba(255,61,154,.9);padding:0 6px}'
      +'.trv-dots{display:flex;gap:5px;padding:0 14px 10px}.trv-dots span{flex:1;height:5px;border-radius:3px;background:#1a2235}.trv-dots span.me{background:'+CY+';box-shadow:0 0 6px rgba(77,216,255,.6)}.trv-dots span.them{background:'+MG+'}.trv-dots span.now{background:#eaf2ff;box-shadow:0 0 10px rgba(234,242,255,.8)}'
      +'.trv-ring{position:relative;width:92px;height:92px;flex:none;border-radius:50%;background:conic-gradient('+YL+' 0 var(--d,360deg),#141a28 var(--d,360deg) 360deg);box-shadow:0 0 24px rgba(255,230,0,.35);display:flex;align-items:center;justify-content:center}.trv-ring div{width:74px;height:74px;border-radius:50%;background:#05070f;display:flex;align-items:center;justify-content:center;font-family:"Bungee",sans-serif;font-size:34px;color:#eaf2ff}'
      +'.trv-q{position:relative;padding:18px 16px;border-radius:14px;background:linear-gradient(135deg,#141a28,#0b0f1a);border:1px solid rgba(77,216,255,.35);box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 10px 30px rgba(0,0,0,.6);font-family:Anton,sans-serif;font-size:26px;line-height:1.18;color:#eaf2ff;letter-spacing:.01em;text-transform:uppercase}.trv-q i{position:absolute;top:-9px;left:14px;padding:2px 8px;background:'+CY+';color:#05070f;font-family:"Bungee",sans-serif;font-size:9px;border-radius:3px;font-style:normal}'
      +'.trv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:auto}'
      +'.trv-opt{display:flex;flex-direction:column;align-items:flex-start;gap:6px;text-align:left;padding:14px;border-radius:12px;background:#0b0f1a;border:1px solid rgba(220,214,201,.14);color:#eaf2ff;cursor:pointer;box-shadow:0 4px 0 #030509;transition:transform .08s}.trv-opt:active{transform:scale(.985)}.trv-opt:disabled{opacity:.55}.trv-opt .l{font-family:"Bungee",sans-serif;font-size:12px;color:#8fa0b8;display:flex;justify-content:space-between;width:100%}.trv-opt .t{font-family:Anton,sans-serif;font-size:19px;letter-spacing:.03em}'
      +'.trv-opt.pick{border:2px solid '+CY+';background:rgba(77,216,255,.14);opacity:1}.trv-opt.yes{border:2px solid #dfff9a;background:linear-gradient(180deg,'+LM+',#5f8f1f);color:#05070f;opacity:1;box-shadow:0 0 24px rgba(183,255,61,.55),0 4px 0 #3a5a12}.trv-opt.yes .l{color:#05070f}.trv-opt.no{border:2px solid '+MG+';background:rgba(255,61,154,.16);opacity:1}'
      +'.trv-rev{text-align:center;font-size:14px;font-weight:600;letter-spacing:.1em;color:#8fa0b8;padding-top:6px;min-height:22px}.trv-rev b{color:'+CY+'}.trv-rev em{color:'+MG+';font-style:normal}'
      +'.trv-count{text-align:center;font-family:"Bungee",sans-serif;font-size:72px;color:'+YL+';padding:40px 0;text-shadow:0 0 30px rgba(255,230,0,.6)}'
      +'.trv-res{display:flex;flex-direction:column;align-items:center;gap:8px;padding:10px 0 6px}.trv-res .w{font-family:"Bungee",sans-serif;font-size:42px;line-height:1;color:'+CY+';text-shadow:0 0 24px rgba(77,216,255,.75),0 4px 0 #0a4a66}.trv-res .w.l{color:'+MG+';text-shadow:0 0 24px rgba(255,61,154,.75),0 4px 0 #6a1040}.trv-res .w.t{color:'+YL+';text-shadow:0 0 24px rgba(255,230,0,.6),0 4px 0 #5c4a0e}'
      +'.trv-tiles{display:flex;align-items:center;gap:10px;width:100%}.trv-tile{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 8px;border-radius:12px;background:#0b0f1a;border:1px solid rgba(220,214,201,.12)}.trv-tile.me{background:linear-gradient(180deg,rgba(77,216,255,.2),#0b0f1a);border-color:rgba(77,216,255,.5)}.trv-tile .n{font-family:Anton,sans-serif;font-size:13px;letter-spacing:.06em;color:#8fa0b8}.trv-tile .s{font-family:"Bungee",sans-serif;font-size:48px;line-height:1;color:#8fa0b8}.trv-tile.me .s{color:'+CY+'}.trv-tile.me .n{color:#eaf2ff}'
      +'.trv-loot{display:flex;gap:8px;width:100%}.trv-loot div{flex:1;display:flex;flex-direction:column;align-items:center;padding:10px 6px;border-radius:10px;background:#0b0f1a;border:1px solid rgba(220,214,201,.12)}.trv-loot b{font-family:"Bungee",sans-serif;font-size:20px;font-weight:400}.trv-loot span{font-size:10px;letter-spacing:.18em;color:#8fa0b8;font-weight:700}'
      +'.trv-rounds{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.trv-rounds div{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px;border-radius:8px;background:#0b0f1a;border:1px solid rgba(220,214,201,.12);font-family:"IBM Plex Mono",monospace;font-size:9px;color:#8fa0b8}.trv-rounds b{font-family:"Bungee",sans-serif;font-size:10px;font-weight:400;color:#8fa0b8}.trv-rounds .me{background:rgba(77,216,255,.18);border-color:rgba(77,216,255,.6)}.trv-rounds .me b{color:'+CY+'}.trv-rounds .them{background:rgba(255,61,154,.18);border-color:rgba(255,61,154,.6)}.trv-rounds .them b{color:'+MG+'}.trv-rounds i{font-style:normal;color:#eaf2ff}'
      +'.trv-board .r{display:flex;gap:8px;padding:9px 4px;border-bottom:1px solid rgba(220,214,201,.12);font-size:12.5px}.trv-board .r b{color:#eaf2ff;flex:1}.trv-board .r span{color:#8fa0b8;min-width:52px;text-align:right}.trv-board .r.me b{color:'+CY+'}'
      +'html.fx-lite #trvRoom .trv-ring{box-shadow:none}';
    document.head.appendChild(st);
  }

  var S={ view:'lobby', lobby:null, duel:null, qs:null, off:0, chan:null, timer:null, mine:{}, theirs:{}, seenQ:-1, polledQ:-1, settled:false, hold:false, relist:null };
  function nowS(){ return Date.now()+S.off; }
  function start(){ return S.duel&&S.duel.started_at?new Date(S.duel.started_at).getTime():0; }
  function host(){ return $('trvRoom'); }
  function wrap(){ var r=host(); return r&&r.querySelector('.trv-wrap'); }
  function top(sub,right){ return '<div class="trv-top"><button type="button" class="trv-back" data-trv="back" aria-label="Back">‹</button><div style="display:flex;flex-direction:column;min-width:0"><div class="trv-ttl">DOCK TRIVIA</div><div class="trv-sub">'+esc(sub||'')+'</div></div>'+(right||'')+'</div>'; }

  function open(){
    css(); var r=host();
    if(!r){ r=document.createElement('div'); r.className='roomscreen'; r.id='trvRoom'; r.innerHTML='<div class="trv-wrap"></div>'; document.body.appendChild(r); r.addEventListener('click',onTap); }
    r.classList.add('on'); hum([15,30,15]);
    try{ if(typeof floorTrack==='function')floorTrack('Dock Trivia'); }catch(e){}
    if(!window.SB||!window.__shkUid){ wrap().innerHTML=top('sign in first — duels ride your card')+'<div class="trv-body"><div class="trv-row"><div class="m">Claim your card and sign in, then come back for a duel.</div></div></div>'; return; }
    lobby();
  }
  function close(){ var r=host(); if(r)r.classList.remove('on'); stopTimer(); unsub(); S.view='closed';
    try{ if(typeof floorTrack==='function')floorTrack((typeof CURRENT_ROOM!=='undefined'&&CURRENT_ROOM)||null); }catch(e){} }
  function onTap(e){
    var b=e.target.closest('[data-trv]'); if(!b)return;
    var k=b.getAttribute('data-trv'), v=b.getAttribute('data-v');
    if(k==='back'){ if(S.view==='duel'&&!S.settled){ if(!confirm('Leave the duel? Your remaining questions score nothing.'))return; close(); } else if(S.view==='lobby')close(); else lobby(); return; }
    try{ act(k,v,b); }catch(err){ say('✗ '+(err&&err.message||err)); }
  }

  /* ── the arena (lobby) ── */
  function lobby(){
    S.view='lobby'; stopTimer();
    wrap().innerHTML=top('loading the table…');
    rpc('trivia_lobby').then(function(L){ S.lobby=L; S.off=new Date(L.now).getTime()-Date.now(); if(L.play&&L.play!==S.skip)return rejoin(L.play);
      if(L.settle&&L.settle.length){ var id=L.settle[0]; return rpc('trivia_settle',{p_id:id}).then(function(d){ refreshBucks(); result(d); }).catch(function(){ drawLobby(); sub(); }); }
      drawLobby(); sub(); })
      .catch(function(e){ var m=String(e.message||e); wrap().innerHTML=top('')+'<div class="trv-body"><div class="trv-row"><div class="m">'+esc(/trivia_lobby|does not exist|schema cache|PGRST202|42883/i.test(m)?'The trivia bank isn’t built yet — the Keymaster runs GAMES.sql once.':m)+'</div></div></div>'; });
  }
  function drawLobby(){
    var L=S.lobby, st=L.stats||{}, w=wrap(); if(!w||S.view!=='lobby')return;
    var open=L.open||[], forMe=open.filter(function(d){ return d.open_to!=='anyone'; }), any=open.filter(function(d){ return d.open_to==='anyone'; });
    var h=top('Head-to-head · 7 Qs · 10 s · fastest right answer wins','<div class="trv-bank"><span>BANK</span><b>'+(L.bucks||0).toLocaleString()+' ⬡</b></div>')+'<div class="trv-body">'
      +'<div class="trv-me"><div class="hex" style="width:64px;height:72px;background:linear-gradient(180deg,'+CY+',#1fa8e0);font-size:26px">'+esc(L.me.charAt(0))+'</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><div style="display:flex;align-items:baseline;gap:8px"><span class="nm">'+esc(L.me)+'</span><span class="rk">'+(st.wins?'IN THE RANKS':'ROOKIE')+'</span></div>'
      +'<div class="st"><span><b>'+(st.wins||0)+'</b> W</span><span><b>'+(st.losses||0)+'</b> L</span><span><b style="color:'+MG+'">×'+(st.streak||0)+'</b> STREAK</span><span><b style="color:'+LM+'">'+(st.best_ms?(st.best_ms/1000).toFixed(2):'—')+'</b>s BEST</span></div></div></div>';
    h+='<button type="button" class="trv-big" data-trv="open" data-v="anyone"><span>CHALLENGE ANYONE<small>5 ⬡ DOWN · WINNER TAKES 10 · YOU RUN NOW, THEY RUN WHEN THEY ACCEPT</small></span><span style="font-size:28px">⚡</span></button>'
      +'<div style="display:flex;gap:6px;margin-top:-6px"><button type="button" class="trv-btn gh" style="flex:1;text-align:left" data-trv="pick">👥 WHO’S ONLINE · RIVALS</button><input class="trv-in" id="trvWho" placeholder="OR A HANDLE…" maxlength="24" autocapitalize="characters" style="flex:1"><button type="button" class="trv-btn" data-trv="open" data-v="who">CALL OUT</button></div>';
    var mine=L.mine||[];
    if(mine.length){ h+='<div><div class="trv-sec">WAITING ON THEM</div>'+mine.map(function(d){ return '<div class="trv-row" style="margin-top:6px"><div style="flex:1;min-width:0"><div class="nm">'+(d.open_to==='anyone'?'ANYONE':esc(d.open_to))+'</div><div class="m">'+(d.played?'YOUR RUN IS IN':'YOUR RUN IS WAITING')+' · '+ago(d.created_at).toUpperCase()+' · 24 H TO ACCEPT</div></div>'+(d.played?'':'<button type="button" class="trv-btn fill" data-trv="result" data-v="'+d.id+'">RUN IT</button>')+'<button type="button" class="trv-btn gh" data-trv="cancel" data-v="'+d.id+'">TAKE BACK</button></div>'; }).join('')+'</div>'; }
    if(forMe.length){ h+='<div><div class="trv-sec hot">INCOMING · THEY CALLED YOU OUT</div>'+forMe.map(function(d){ return row(d,true); }).join('')+'</div>'; }
    h+='<div><div class="trv-sec">OPEN ON THE TABLE</div>'+(any.length?any.map(function(d){ return row(d,false); }).join(''):'<div class="trv-row"><div class="m">NOBODY ON THE TABLE — PUT ONE UP</div></div>')+'</div>';
    var res=L.results||[];
    if(res.length){ h+='<div><div class="trv-sec">RECENT</div>'+res.map(function(d){ var won=d.winner===window.__shkUid, tie=!d.winner, them=d.me_by?d.foe_handle:d.by_handle, a=d.me_by?d.score_by:d.score_foe, b2=d.me_by?d.score_foe:d.score_by; return '<div class="trv-row" style="margin-top:6px"><div style="flex:1;min-width:0"><div class="nm" style="color:'+(won?LM:tie?YL:MG)+'">'+(won?'WON':tie?'DEAD HEAT':'LOST')+' '+a+'–'+b2+' vs '+esc(them||'?')+'</div><div class="m">'+ago(d.finished_at).toUpperCase()+' AGO</div></div><button type="button" class="trv-btn gh" data-trv="result" data-v="'+d.id+'">SEE IT</button></div>'; }).join('')+'</div>'; }
    h+='<div><div class="trv-sec">THE PODIUM</div><div id="trvPod" class="trv-pod"></div></div>'
      +'<div style="display:flex;gap:8px"><button type="button" class="trv-btn gh" style="flex:1" data-trv="board">FULL BOARD</button><button type="button" class="trv-btn gh" style="flex:1" data-trv="submit">WRITE A Q · +10 ⬡</button></div></div>';
    w.innerHTML=h; podium();
    function row(d,inc){ return '<div class="trv-row'+(inc?' in':'')+'" style="margin-top:6px"><div class="hex" style="width:40px;height:46px;background:'+(inc?MG:'#1a2235')+';color:'+(inc?'#05070f':CY)+';font-size:18px">'+esc(d.by_handle.charAt(0))+'</div><div style="flex:1;min-width:0"><div class="nm">'+esc(d.by_handle)+'</div><div class="m">'+(inc?'FOR YOU':'ANYONE')+' · '+ago(d.created_at).toUpperCase()+'</div></div><button type="button" class="trv-btn'+(inc?' fill':'')+'" data-trv="join" data-v="'+d.id+'">'+(inc?'ACCEPT':'FIGHT')+' · 5 ⬡</button></div>'; }
  }
  function picker(){
    var L=S.lobby||{}, my=me(), on=[]; try{ if(typeof FLOOR!=='undefined'&&FLOOR.roster)on=FLOOR.roster.map(function(r){ return String(r.h||'').toUpperCase(); }).filter(function(h){ return h&&h!==my&&h!=='—'; }); }catch(e){}
    on=on.filter(function(h,i){ return on.indexOf(h)===i; }); var riv=(L.rivals||[]).filter(function(h){ return h&&h!==my&&on.indexOf(h)<0; });
    var row=function(h,tag){ return '<div class="trv-row" style="margin-top:6px"><div class="hex" style="width:34px;height:40px;background:#1a2235;color:'+CY+';font-size:15px">'+esc(h.charAt(0))+'</div><div style="flex:1;min-width:0"><div class="nm">'+esc(h)+'</div><div class="m">'+tag+'</div></div><button type="button" class="trv-btn fill" data-trv="callout" data-v="'+esc(h)+'">CALL OUT · 5 ⬡</button></div>'; };
    S.view='pick';
    wrap().innerHTML=top('call somebody out · they run it when they’re back')+'<div class="trv-body">'
      +'<div><div class="trv-sec hot">ONLINE NOW</div>'+(on.length?on.map(function(h){ return row(h,'ON THE FLOOR'); }).join(''):'<div class="trv-row" style="margin-top:6px"><div class="m">NOBODY ELSE ON THE FLOOR RIGHT NOW</div></div>')+'</div>'
      +'<div><div class="trv-sec">RIVALS · PEOPLE YOU’VE DUELED</div>'+(riv.length?riv.map(function(h){ return row(h,'OFFLINE OR NOT · THEY RUN IT WHEN THEY’RE BACK'); }).join(''):'<div class="trv-row" style="margin-top:6px"><div class="m">NO RIVALS YET — CALL SOMEBODY OUT</div></div>')+'</div>'
      +'<button type="button" class="trv-btn gh" data-trv="lobby">← BACK</button></div>';
  }
  function podium(){ rpc('trivia_board').then(function(rows){ var p=$('trvPod'); if(!p)return; var my=me(); var o=[rows[1],rows[0],rows[2]], hts=[62,86,46], ranks=[2,1,3], cols=['linear-gradient(180deg,#8fa0b8,#2a3350)','linear-gradient(180deg,'+YL+',#a3821a)','linear-gradient(180deg,'+MG+',#6a1040)'];
      p.innerHTML=o.map(function(r,i){ return '<div><span class="n"'+(r&&r.handle===my?' style="color:'+CY+'"':'')+'>'+(r?esc(r.handle):'—')+'</span><div class="b" style="height:'+hts[i]+'px;background:'+cols[i]+(i===1?';box-shadow:0 0 20px rgba(255,230,0,.4)':'')+'">'+ranks[i]+'</div></div>'; }).join(''); }).catch(function(){}); }
  function act(k,v,b){
    if(k==='open'){ var to=v==='who'?String(($('trvWho')||{}).value||'').trim():'anyone'; if(v==='who'&&!to){ say('Type a handle, or challenge anyone'); return; }
      b.disabled=true; rpc('trivia_open',{p_to:to}).then(function(d){ hum([20,40,20]); say('⚡ 5 ⬡ down — your run starts now; they play theirs when they accept'); refreshBucks(); enter(d); }).catch(function(e){ b.disabled=false; say('✗ '+e.message); }); }
    else if(k==='cancel'){ b.disabled=true; rpc('trivia_cancel',{p_id:+v}).then(function(){ say('↩ taken back — 5 ⬡ returned'); refreshBucks(); lobby(); }).catch(function(e){ b.disabled=false; say('✗ '+e.message); }); }
    else if(k==='join'){ b.disabled=true; rpc('trivia_join',{p_id:+v}).then(function(d){ refreshBucks(); enter(d); }).catch(function(e){ b.disabled=false; say('✗ '+e.message); lobby(); }); }
    else if(k==='board')board(); else if(k==='submit')submitForm(); else if(k==='lobby'||k==='again')lobby(); else if(k==='send')sendQ(b); else if(k==='ans')answer(+v,b);
    else if(k==='rematch'){ var foeH=foe(); b.disabled=true; rpc('trivia_open',{p_to:foeH}).then(function(d){ hum([20,40,20]); say('⚡ rematch — '+foeH+' gets the call-out'); refreshBucks(); enter(d); }).catch(function(e){ b.disabled=false; say('✗ '+e.message); }); }
    else if(k==='pick')picker(); else if(k==='callout'){ b.disabled=true; rpc('trivia_open',{p_to:v}).then(function(d){ hum([20,40,20]); say('⚡ '+v+' is called out — your run starts now'); refreshBucks(); enter(d); }).catch(function(e){ b.disabled=false; say('✗ '+e.message); }); } else if(k==='result'){ rpc('trivia_state',{p_id:+v}).then(function(d){ if(d.status==='done')return result(d); if(d.status==='open'&&d.by===window.__shkUid&&!d.started_at)return rpc('trivia_run',{p_id:d.id}).then(enter); enter(d); }).catch(function(e){ say('✗ '+e.message); }); }
  }
  function sub(){
    if(S.chan||!sb())return;
    try{ S.chan=sb().channel('trivia-lobby-'+(window.__shkUid||'x')).on('postgres_changes',{event:'*',schema:'public',table:'trivia_duels'},function(p){
        var r=(p&&p.new)||{}; if(!r.id||S.view!=='lobby')return;
        if((r.by===window.__shkUid||r.foe===window.__shkUid)&&r.status==='done'){ say('⚡ a duel settled — check RECENT'); hum([30,40,30]); }
        clearTimeout(S.relist); S.relist=setTimeout(function(){ if(S.view==='lobby')rpc('trivia_lobby').then(function(L){ S.lobby=L; drawLobby(); }).catch(function(){}); },400);
      }).subscribe(); }catch(e){ S.chan=null; }
  }
  function unsub(){ try{ if(S.chan&&sb())sb().removeChannel(S.chan); }catch(e){} S.chan=null; }

  /* ── the duel ── */
  function rejoin(id){ rpc('trivia_state',{p_id:id}).then(enter).catch(function(e){ say('✗ '+e.message); drawLobby(); sub(); }); }
  function enter(d){
    unsub(); S.duel=d; S.off=new Date(d.now).getTime()-Date.now(); S.mine={}; S.theirs={}; S.seenQ=-1; S.polledQ=-1; S.settled=false; S.view='duel';
    (d.answers||[]).forEach(function(a){ (a.uid===window.__shkUid?S.mine:S.theirs)[a.qi]=a; });
    if(d.status==='done'){ result(d); return; }
    if(!d.started_at){ lobby(); return; }
    wrap().innerHTML=top('fetching the questions…');
    rpc('trivia_qs',{p_id:d.id}).then(function(qs){ S.qs=qs; hum([30,50,30]); tick(); S.timer=setInterval(tick,100); }).catch(function(e){ say('✗ '+e.message); S.skip=d.id; S.view='lobby'; rpc('trivia_lobby').then(function(L){ S.lobby=L; drawLobby(); sub(); }).catch(function(){}); });
  }
  function stopTimer(){ if(S.timer){ clearInterval(S.timer); S.timer=null; } }
  function foe(){ var d=S.duel; return d.by===window.__shkUid?(d.foe_handle||(d.open_to==='anyone'?'A TAKER':d.open_to)):d.by_handle; }
  function score(){ var a=0,b=0; for(var i=0;i<N;i++){ var m=S.mine[i], t=S.theirs[i]; var mc=m&&m.correct&&m.ms!=null, tc=t&&t.correct&&t.ms!=null; if(mc&&(!tc||m.ms<t.ms))a++; else if(tc&&(!mc||t.ms<m.ms))b++; } return [a,b]; }
  function dots(qi){ var s=''; for(var i=0;i<N;i++){ var c=''; var m=S.mine[i],t=S.theirs[i]; var mc=m&&m.correct&&m.ms!=null, tc=t&&t.correct&&t.ms!=null; if(i<qi){ if(mc&&(!tc||m.ms<t.ms))c='me'; else if(tc&&(!mc||t.ms<m.ms))c='them'; } if(i===qi)c='now'; s+='<span class="'+c+'"></span>'; } return s; }
  function face(){ var sc=score(); return '<div class="trv-face"><div class="s"><div class="hex" style="width:40px;height:46px;background:linear-gradient(180deg,'+CY+',#1fa8e0);font-size:18px">'+esc(me().charAt(0))+'</div><div style="display:flex;flex-direction:column;min-width:0"><span class="nm">'+esc(me())+'</span><span class="sc" style="color:'+CY+'" id="trvScA">'+sc[0]+'</span></div></div><div class="vs">VS</div><div class="s r"><div style="display:flex;flex-direction:column;min-width:0;align-items:flex-end"><span class="nm">'+esc(foe())+'</span><span class="sc" style="color:'+MG+'" id="trvScB">'+(S.duel.foe?sc[1]:'?')+'</span></div><div class="hex" style="width:40px;height:46px;background:'+MG+';font-size:18px">'+esc((S.duel.foe?foe():'?').charAt(0))+'</div></div></div>'; }
  function tick(){
    var el=nowS()-start(), w=wrap(); if(!w)return;
    if(el<0){ if(S.seenQ!==-2){ S.seenQ=-2; w.innerHTML=top('vs '+foe())+face()+'<div class="trv-count" id="trvCount">3</div><div class="trv-rev">SEVEN QUESTIONS · TEN SECONDS EACH · 5 ⬡ A SIDE</div>'; }
      var n=$('trvCount'); if(n){ var s=Math.ceil(-el/1000); if(n.textContent!==String(s)){ n.textContent=s; hum([10]); } } return; }
    var qi=Math.floor(el/STEP_MS), ph=el%STEP_MS;
    if(qi>=N){ settle(); return; }
    if(qi!==S.seenQ){ S.seenQ=qi; drawQ(qi); }
    var ring=$('trvRing'); if(ring){ var f=ph<Q_MS?1-ph/Q_MS:0; ring.style.setProperty('--d',Math.round(f*360)+'deg'); }
    var tt=$('trvT'); if(tt){ var lf=ph<Q_MS?Math.ceil((Q_MS-ph)/1000):0; if(tt.textContent!==String(lf))tt.textContent=lf; }
    if(ph>=Q_MS)reveal(qi);
  }
  function drawQ(qi){
    var q=S.qs[qi], w=wrap(); if(!q||!w)return;
    w.innerHTML=top('vs '+foe()+' · 10 ⬡ on the table')+face()+'<div class="trv-dots">'+dots(qi)+'</div><div class="trv-body" style="gap:10px;padding-top:4px">'
      +'<div style="display:flex;align-items:center;gap:14px"><div class="trv-ring" id="trvRing"><div id="trvT">10</div></div><div style="display:flex;flex-direction:column;gap:3px"><span style="font-family:Bungee,sans-serif;font-size:13px;color:'+MG+'">ROUND '+(qi+1)+' / '+N+'</span><span style="font-size:12px;letter-spacing:.22em;color:#8fa0b8;font-weight:700">'+esc(String(q.cat||'').toUpperCase())+' · 1 PT · FASTEST TAKES IT</span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#8fa0b8" id="trvThem">'+(S.duel.foe?(S.theirs[qi]?'● '+esc(foe())+' HAS RUN THIS ONE':'○ '+esc(foe())+' HAS NOT RUN THIS YET'):'○ THEY RUN IT WHEN THEY ACCEPT')+'</span></div></div>'
      +'<div class="trv-q"><i>Q'+(qi+1)+'</i>'+esc(q.q)+'</div>'
      +'<div class="trv-grid">'+(q.a||[]).map(function(o,i){ return '<button type="button" class="trv-opt" data-trv="ans" data-v="'+i+'"><span class="l"><span>'+'ABCD'.charAt(i)+'</span><span id="trvL'+i+'"></span></span><span class="t">'+esc(o)+'</span></button>'; }).join('')+'</div>'
      +'<div class="trv-rev" id="trvRev"></div></div>';
    if(S.mine[qi])lock(S.mine[qi].choice);
    if(!lite())hum([12]);
  }
  function lock(pick){ var w=wrap(); if(!w)return; w.querySelectorAll('.trv-opt').forEach(function(b){ b.disabled=true; if(+b.getAttribute('data-v')===pick)b.classList.add('pick'); }); }
  function answer(choice,b){
    var qi=S.seenQ; if(qi<0||S.mine[qi]||S.hold)return; S.hold=true; lock(choice);
    rpc('trivia_answer',{p_id:S.duel.id,p_i:qi,p_choice:choice}).then(function(r){
      S.hold=false; S.mine[qi]={qi:qi,choice:choice,correct:!!r.correct,ms:r.ms};
      var w=wrap(); if(w&&S.seenQ===qi){ var btn=w.querySelector('.trv-opt[data-v="'+choice+'"]'); if(btn){ btn.classList.remove('pick'); btn.classList.add(r.correct?'yes':'no'); } var l=$('trvL'+choice); if(l)l.textContent=r.correct?('✓ '+(r.ms/1000).toFixed(2)+'s'):(r.ms==null?'LATE':'✗'); var rv=$('trvRev'); if(rv)rv.innerHTML=r.correct?'LOCKED IN · NOW IT’S WHO WAS <b>FASTER</b>':(r.ms==null?'⏱ TOO LATE':'✗ NOT THAT ONE'); }
      hum(r.correct?[20,30,20]:[60]);
    }).catch(function(e){ S.hold=false; say('✗ '+e.message); var w=wrap(); if(w&&S.seenQ===qi)w.querySelectorAll('.trv-opt').forEach(function(x){ x.disabled=false; x.classList.remove('pick'); }); });
  }
  function reveal(qi){
    if(S.polledQ===qi)return; S.polledQ=qi; lock(S.mine[qi]?S.mine[qi].choice:-1);
    var rv=$('trvRev'); if(rv&&!S.mine[qi])rv.innerHTML='⏱ NO ANSWER';
    setTimeout(function(){ if(S.view!=='duel'||!S.duel)return;
      rpc('trivia_state',{p_id:S.duel.id}).then(function(d){
        (d.answers||[]).forEach(function(a){ (a.uid===window.__shkUid?S.mine:S.theirs)[a.qi]=a; });
        if(d.status==='done'){ result(d); return; }
        if(S.seenQ!==qi)return; var m=S.mine[qi], t=S.theirs[qi], rv2=$('trvRev'); if(!rv2)return;
        var mc=m&&m.correct&&m.ms!=null, tc=t&&t.correct&&t.ms!=null, who=esc(foe()), line;
        if(mc&&tc)line=(m.ms<t.ms)?'⚡ <b>YOUR POINT</b> — '+(m.ms/1000).toFixed(2)+'s BEATS '+(t.ms/1000).toFixed(2)+'s':(m.ms>t.ms?'<em>'+who+'</em> TOOK IT — '+(t.ms/1000).toFixed(2)+'s':'DEAD HEAT — NOBODY’S POINT');
        else if(mc)line=(d.foe&&(d.by===window.__shkUid?d.foe_started_at:d.by_started_at))?'⚡ <b>YOUR POINT</b>':'✓ <b>'+(m.ms/1000).toFixed(2)+'s</b> ON THE CLOCK · THEY RUN IT LATER'; else if(tc)line='<em>'+who+'</em> TOOK IT IN '+(t.ms/1000).toFixed(2)+'s'; else line=(d.foe?'NOBODY’S POINT':'✗ · THEY RUN IT LATER');
        rv2.innerHTML=line; var sc=score(); var a=$('trvScA'),b=$('trvScB'); if(a)a.textContent=sc[0]; if(b)b.textContent=sc[1];
      }).catch(function(){}); },600+(lite()?400:0));
  }
  function settle(){
    if(S.settled)return; S.settled=true; stopTimer(); wrap().innerHTML=top('the count…');
    var tries=0; (function go(){ rpc('trivia_settle',{p_id:S.duel.id}).then(function(d){ refreshBucks(); result(d); }).catch(function(e){ var m=String(e.message||''); if(/waiting on a taker|still going/i.test(m))return waiting(); if(++tries<4)setTimeout(go,1200); else { say('✗ '+m); lobby(); } }); })();
  }
  function waiting(){
    S.view='wait'; var sc=score(); var who=foe();
    wrap().innerHTML=top('your run is in')+'<div class="trv-body" style="align-items:center">'
      +'<div class="trv-res"><div class="w t" style="font-size:34px">RUN’S IN</div><div style="font-size:13px;letter-spacing:.3em;color:#8fa0b8;font-weight:700;text-align:center">'+(S.duel.status==='open'?'WAITING ON '+(S.duel.open_to==='anyone'?'A TAKER':esc(S.duel.open_to))+' · 24 H':esc(who)+' IS STILL RUNNING THEIRS')+'</div></div>'
      +'<div class="trv-tiles"><div class="trv-tile me"><span class="n">YOUR POINTS SO FAR</span><span class="s">'+sc[0]+'</span></div></div>'
      +'<div class="trv-rev">YOU’LL GET A BUZZ WHEN IT SETTLES · THE RESULT WAITS UNDER RECENT</div>'
      +'<div style="display:flex;flex-direction:column;gap:8px;width:100%;margin-top:auto"><button type="button" class="trv-big" style="justify-content:center" data-trv="again">BACK TO THE ARENA</button></div></div>';
  }
  function result(d){
    S.duel=d; S.settled=true; stopTimer(); S.view='result'; refreshBucks();
    var meBy=d.by===window.__shkUid, mine=meBy?d.score_by:d.score_foe, theirs=meBy?d.score_foe:d.score_by, won=d.winner===window.__shkUid, tie=!d.winner;
    hum(won?[40,60,40,60,120]:tie?[40,40]:[90]);
    var best=null; for(var i=0;i<N;i++){ var m=S.mine[i]; if(m&&m.correct&&m.ms!=null&&(best==null||m.ms<best))best=m.ms; }
    var rounds=''; for(var j=0;j<N;j++){ var mm=S.mine[j],tt=S.theirs[j]; var mc=mm&&mm.correct&&mm.ms!=null, tc=tt&&tt.correct&&tt.ms!=null; var c=(mc&&(!tc||mm.ms<tt.ms))?'me':(tc&&(!mc||tt.ms<mm.ms))?'them':''; rounds+='<div class="'+c+'"><b>'+(j+1)+'</b><span'+(mc?' style="color:#eaf2ff"':'')+'>'+(mc?(mm.ms/1000).toFixed(2):'✗')+'</span><span'+(tc?' style="color:#eaf2ff"':'')+'>'+(tc?(tt.ms/1000).toFixed(2):'✗')+'</span></div>'; }
    wrap().innerHTML=top('round over · vs '+foe())+'<div class="trv-body" style="align-items:center">'
      +'<div class="trv-res"><div class="w'+(won?'':tie?' t':' l')+'">'+(won?'VICTORY':tie?'DEAD HEAT':'DEFEAT')+'</div><div style="font-size:13px;letter-spacing:.3em;color:#8fa0b8;font-weight:700">'+(won?me()+' TAKES IT':tie?'5 ⬡ BACK TO EACH SIDE':esc(foe())+' TAKES IT')+'</div></div>'
      +'<div class="trv-tiles"><div class="trv-tile me"><span class="n">'+esc(me())+'</span><span class="s">'+mine+'</span></div><span style="font-family:Bungee,sans-serif;color:#8fa0b8">–</span><div class="trv-tile"><span class="n">'+esc(foe())+'</span><span class="s">'+theirs+'</span></div></div>'
      +'<div class="trv-loot"><div style="border-color:rgba(183,255,61,.5)"><b style="color:'+LM+'">'+(won?'+10':tie?'+5':'0')+' ⬡</b><span>'+(won?'TO THE BANK':tie?'BACK':'HOUSE')+'</span></div><div style="border-color:rgba(255,61,154,.5)"><b style="color:'+MG+'">×'+((S.lobby&&S.lobby.stats&&S.lobby.stats.streak)||0)+(won?'+1':'')+'</b><span>STREAK</span></div><div style="border-color:rgba(77,216,255,.5)"><b style="color:'+CY+'">'+(best!=null?(best/1000).toFixed(2)+'s':'—')+'</b><span>BEST TODAY</span></div></div>'
      +'<div style="width:100%"><div class="trv-sec">ROUND BY ROUND · YOU / THEM</div><div class="trv-rounds" style="margin-top:5px">'+rounds+'</div></div>'
      +'<div style="display:flex;flex-direction:column;gap:8px;width:100%;margin-top:auto"><button type="button" class="trv-big" style="justify-content:center" data-trv="rematch">REMATCH · 5 ⬡</button><div style="display:flex;gap:8px"><button type="button" class="trv-btn gh" style="flex:1" data-trv="again">NEXT FIGHT</button><button type="button" class="trv-btn gh" style="flex:1" data-trv="board">THE PODIUM</button></div></div></div>';
  }

  /* ── the board ── */
  function board(){
    S.view='board'; wrap().innerHTML=top('wins · streak · best time');
    rpc('trivia_board').then(function(rows){ var my=me();
      wrap().innerHTML=top('wins · streak · best time')+'<div class="trv-body"><div class="trv-board">'+(rows.length?rows.map(function(r,i){ return '<div class="r'+(r.handle===my?' me':'')+'"><span style="min-width:22px;text-align:left">'+(i+1)+'</span><b>'+esc(r.handle)+'</b><span>'+r.wins+' W</span><span>×'+r.best_streak+'</span><span>'+(r.best_ms?(r.best_ms/1000).toFixed(2)+'s':'—')+'</span></div>'; }).join(''):'<div class="trv-row"><div class="m">NOBODY ON THE BOARD YET</div></div>')+'</div><button type="button" class="trv-btn gh" data-trv="lobby">← BACK</button></div>';
    }).catch(function(e){ say('✗ '+e.message); lobby(); });
  }

  /* ── write a question → the Keymaster's Desk ── */
  function submitForm(){
    S.view='submit';
    wrap().innerHTML=top('write a question · 10 ⬡ if it makes the bank')+'<div class="trv-body" style="gap:8px">'
      +'<input class="trv-in" id="trvQ" placeholder="THE QUESTION" maxlength="200">'
      +['A','B','C','D'].map(function(l,i){ return '<div style="display:flex;gap:6px;align-items:center"><label style="display:flex;align-items:center;gap:6px;color:#8fa0b8;font-size:12px;font-family:Bungee,sans-serif"><input type="radio" name="trvOk" value="'+i+'"'+(i===0?' checked':'')+'>'+l+'</label><input class="trv-in" id="trvA'+i+'" placeholder="OPTION '+l+'" maxlength="60"></div>'; }).join('')
      +'<div class="trv-sec">TICK THE RIGHT ONE</div><input class="trv-in" id="trvCat" placeholder="CATEGORY (THE DOCKS, THE ORDER, THE HARBOR…)" maxlength="30">'
      +'<button type="button" class="trv-big" style="justify-content:center" data-trv="send">SEND IT TO THE DESK</button><button type="button" class="trv-btn gh" data-trv="lobby">← BACK</button></div>';
  }
  function sendQ(b){
    var q=String($('trvQ').value||'').trim(), a=[0,1,2,3].map(function(i){ return String($('trvA'+i).value||'').trim(); }), ok=+((wrap().querySelector('input[name=trvOk]:checked')||{}).value||0), cat=String($('trvCat').value||'').trim();
    if(q.length<8){ say('The question wants a few more words'); return; } if(a.some(function(x){ return !x; })){ say('All four options, please'); return; }
    b.disabled=true; rpc('trivia_submit',{p_q:q,p_a:a,p_correct:ok,p_cat:cat||'the docks'}).then(function(){ hum([20,40,20]); say('✍ on the Keymaster’s desk — 10 ⬡ if it makes the bank'); lobby(); }).catch(function(e){ b.disabled=false; say('✗ '+e.message); });
  }

  T._live=true;
  try{ if(typeof window.__trivReady==='function')window.__trivReady(); }catch(e){}
})();
