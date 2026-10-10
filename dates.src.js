/* dates.js — MESSY ON DA DOCKS · Singles & Cheaters (#games, oct 10). Loaded by index.html the first time the card is
   tapped (gameLoad('dates')); nothing in here is parsed at boot. A full-page room (the same .roomscreen as a lobby).

   Anonymous ten-minute dates over a Supabase realtime BROADCAST channel. Nothing of the chat is ever stored: the two
   phones agree a key between themselves (ECDH P-256 → AES-GCM, WebCrypto) during pairing and every line is sealed
   before it leaves the phone — the relay only ever sees ciphertext. The server answers one yes/no (dates_eligible),
   keeps who you are / who you're into / your Messy name (dates_setup), takes a tick at the end (dates_done), a rating
   (dates_rate) and a flag (dates_flag: three since the last suspension closes the door — a week, two weeks, then a
   month every time). Nobody is shown a flag, the Desk included.

   THE WIRE
     'messy-queue'  seek {id,sex,into,pk}   every 1.5 s while looking; everyone keeps a 5 s roster
                    pair {from,to,room,pk,sex,into}  the lowest id that FITS proposes (my into ∋ their sex AND theirs ∋ mine)
                    ok   {from,to,room,pk}  the taker answers; both move to the room holding each other's public key
                    gone {id}
     'messy-<room>' x {iv,ct}               every room event sealed: {t:'hi'|'msg'|'ping'|'extend'|'reveal'|'handle'|'bye',…}
                                            hi carries {alias, card}: card = uid, never shown, used only by a flag or a rating
   While the room is open the phone is a ghost on the Hall's floor (window.__messyGhost, read by _flMeta) so the ONLINE
   roster can't be lined up against who just went quiet. */
(function(){
  'use strict';
  var esc=function(s){ return (s==null?'':(''+s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); };
  var $=function(id){ return document.getElementById(id); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var hum=function(p){ try{ buzz(p||[20]); }catch(e){} };
  var lite=function(){ try{ return document.documentElement.classList.contains('fx-lite'); }catch(e){ return false; } };
  var me=function(){ try{ var a=(typeof loadAcct==='function'&&loadAcct())||{}; return String(a.handle||'').toUpperCase(); }catch(e){ return ''; } };
  var sb=function(){ return window.SB; };
  var rpc=function(fn,args){ if(!sb())return Promise.reject(new Error('backend off')); return sb().rpc(fn,args||{}).then(function(r){ if(r.error)throw new Error(r.error.message||'refused'); return r.data; }); };
  var rid=function(n){ var s=''; try{ var u=new Uint8Array(n||8); crypto.getRandomValues(u); for(var i=0;i<u.length;i++)s+=('0'+u[i].toString(16)).slice(-2); }catch(e){ s=Math.random().toString(16).slice(2,2+2*(n||8)); } return s; };
  var b64=function(buf){ var s='',u=new Uint8Array(buf); for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]); return btoa(s); };
  var unb64=function(s){ var b=atob(s),u=new Uint8Array(b.length); for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i); return u.buffer; };

  var D=window.DATES={ _live:false, open:open, close:close };
  var DATE_MS=10*60*1000, EXT_MS=5*60*1000, MAX_EXT=3, EXT_WINDOW=60*1000;
  var NEON='#ff3d9a', VIOLET='#b56cff', GOLD='#ffe600', RED='#ff2d55';
  var ADJ=['Honey','Sugar','Velvet','Satin','Cherry','Candy','Sultry','Smooth','Slippery','Naughty','Dirty','Hot','Wet','Midnight','Late-Shift','Sweet'];
  var NOUN=['Hawser','Deckhand','Lasher','Longshore','Stevedore','Capstan','Twistlock','Spreader','Top Handler','Gantry','Hatch','Reefer','Bollard','Night Shift','Clerk','Crane'];
  var roll=function(){ return ADJ[Math.floor(Math.random()*ADJ.length)]+' '+NOUN[Math.floor(Math.random()*NOUN.length)]; };

  function css(){
    if($('msyCSS'))return;
    var st=document.createElement('style'); st.id='msyCSS';
    st.textContent=
      '#msyRoom{font-family:"Barlow Condensed",Inter,system-ui,sans-serif;color:#f3e9ee;background:radial-gradient(circle at 20% 8%,rgba(255,61,154,.35),rgba(7,5,10,0) 30%),radial-gradient(circle at 85% 14%,rgba(181,108,255,.35),rgba(7,5,10,0) 30%),radial-gradient(circle,rgba(255,255,255,.14) .6px,rgba(0,0,0,0) 1px) 0 0/14px 14px,linear-gradient(180deg,#1a0712 0,#07050a 40%)}'
      +'#msyRoom .msy-wrap{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;position:relative}'
      +'.msy-top{display:flex;align-items:center;gap:10px;padding:10px 14px 6px;flex:none}'
      +'.msy-back{width:40px;height:40px;flex:none;border-radius:50%;border:2px solid '+NEON+';background:linear-gradient(180deg,#2a0b1a,#0b0d0f);color:'+NEON+';font-size:26px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding-bottom:3px;box-shadow:0 0 14px '+NEON+'}'
      +'.msy-kick{font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:10px;letter-spacing:.3em;color:#fff;text-shadow:0 0 6px #fff,0 0 14px '+VIOLET+'}'
      +'.msy-ttl{font-family:Anton,sans-serif;font-size:20px;letter-spacing:.12em;color:'+NEON+';text-shadow:0 0 6px #fff,0 0 16px '+NEON+',0 0 32px '+NEON+'}'
      +'.msy-plate{margin-left:auto;padding:5px 9px;border:2px solid '+RED+';border-radius:4px;font-family:Inter,system-ui,sans-serif;font-weight:800;font-size:9px;letter-spacing:.08em;color:'+RED+';text-shadow:0 0 6px #fff,0 0 12px '+RED+';box-shadow:0 0 12px '+RED+';background:rgba(11,5,9,.6);transform:rotate(3deg);text-align:center;line-height:1.2}'
      +'.msy-sign{margin:8px 14px 0;padding:8px;border-radius:18px;background:radial-gradient(circle,#ffe08a 2.6px,rgba(0,0,0,0) 3.4px) 5px 5px/22px 22px,linear-gradient(180deg,#2a1420,#120912);box-shadow:0 0 30px rgba(255,230,0,.2),0 14px 40px rgba(0,0,0,.7)}'
      +'.msy-sign>div{border-radius:12px;padding:14px 12px 12px;background:radial-gradient(ellipse at 50% 30%,#2b0a1d,#0b0509 75%);border:3px solid '+NEON+';box-shadow:0 0 10px '+NEON+',0 0 30px '+NEON+',inset 0 0 24px rgba(255,61,154,.35);display:flex;flex-direction:column;align-items:center;gap:2px}'
      +'.msy-m1{font-family:"Bungee Shade","Bungee",sans-serif;font-size:52px;line-height:.9;color:'+NEON+';text-shadow:0 0 8px #fff,0 0 20px '+NEON+',0 0 44px '+NEON+'}'
      +'.msy-m2{font-family:"Bungee",sans-serif;font-size:24px;line-height:1;letter-spacing:.04em;background:linear-gradient(180deg,#fff 0,#d9dde3 35%,#6f7780 50%,#e6eaee 65%,#8a9199 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 2px 0 #2a2f35)}'
      +'.msy-tag{margin-top:10px;padding:5px 12px;border:2px solid '+VIOLET+';border-radius:3px;font-family:"Bungee",sans-serif;font-size:13px;letter-spacing:.1em;color:#f4ecff;text-shadow:0 0 6px rgba(181,108,255,.6);box-shadow:0 0 12px '+VIOLET+';transform:rotate(-2deg)}'
      +'.msy-live{margin-top:8px;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:9.5px;letter-spacing:.26em;color:'+RED+';text-shadow:0 0 8px '+RED+'}'
      +'.msy-body{padding:10px 16px 18px;display:flex;flex-direction:column;gap:7px;flex:1}'
      +'.msy-card{padding:8px 12px;border-radius:10px;background:linear-gradient(135deg,#1f0d19,#0d0710);border:1px solid rgba(255,61,154,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 18px rgba(255,61,154,.2);display:flex;flex-direction:column;gap:4px}'
      +'.msy-card.v{background:linear-gradient(135deg,#16091a,#0d0710);border-color:rgba(181,108,255,.45);box-shadow:0 0 16px rgba(181,108,255,.15)}'
      +'.msy-h{font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:11px;letter-spacing:.14em;color:'+NEON+';text-shadow:0 0 8px '+NEON+'}'
      +'.msy-rule{display:flex;gap:10px;align-items:center;font-size:16.5px;line-height:1.3;font-weight:600;color:#f3e9ee}.msy-rule b{color:'+NEON+'}.msy-rule i{flex:none;font-style:normal;font-family:Anton,sans-serif;font-size:19px;color:'+GOLD+';text-shadow:0 0 8px '+GOLD+';width:26px}'
      +'.msy-lock{display:flex;align-items:center;gap:8px;font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:8.5px;letter-spacing:.06em;color:#7fe08a;text-shadow:0 0 8px rgba(127,224,138,.8)}'
      +'.msy-row{display:flex;align-items:center;gap:8px}.msy-row>span{font-family:Inter,system-ui,sans-serif;font-weight:600;font-size:11px;letter-spacing:.1em;color:'+VIOLET+';width:48px;text-shadow:0 0 8px '+VIOLET+'}'
      +'.msy-pick{flex:1;padding:9px 6px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(180deg,#2a1d2a,#130b14);color:#8f8794;font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.06em;cursor:pointer}'
      +'.msy-pick.on{border-color:'+NEON+';background:linear-gradient(180deg,'+NEON+',#8a1d55);color:#0b0509;box-shadow:0 0 14px '+NEON+'}.msy-pick.on.g{border-color:'+GOLD+';background:linear-gradient(180deg,#fff2b0,'+GOLD+' 40%,#a3821a);box-shadow:0 0 14px rgba(255,230,0,.6)}'
      +'.msy-big{position:relative;width:100%;padding:15px 16px;border-radius:14px;border:2px solid '+NEON+';background:linear-gradient(180deg,#ff86c2 0,'+NEON+' 45%,#a21c62 55%,#ff5fb0 100%);color:#0b0509;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;box-shadow:0 0 20px '+NEON+',0 0 50px rgba(255,61,154,.6),inset 0 2px 0 rgba(255,255,255,.6),0 6px 0 #4d0f30;font-family:Anton,sans-serif;font-size:26px;letter-spacing:.08em;margin-top:auto}.msy-big:disabled{opacity:.5}'
      +'.msy-ghost{padding:12px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(180deg,#2a1d2a,#130b14);color:#d7a8c0;font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:12px;letter-spacing:.06em;cursor:pointer}.msy-ghost.v{border-color:'+VIOLET+';color:'+VIOLET+'}'
      +'.msy-foot{font-size:11.5px;font-weight:600;letter-spacing:.1em;color:#fff;text-align:center;text-shadow:0 0 8px rgba(255,61,154,.7)}'
      +'.msy-vip{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:linear-gradient(135deg,#1a1a0a,#0d0d08);border:1px solid rgba(255,230,0,.5)}.msy-vip b{font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:13px;letter-spacing:.08em;color:'+GOLD+'}.msy-vip small{font-size:10px;letter-spacing:.16em;color:#b8a98f;font-weight:700}.msy-vip .n{display:flex;gap:14px;font-family:"IBM Plex Mono",monospace;font-size:11px;color:#b8a98f}.msy-vip .n b{font-family:inherit;color:#f3e9ee;font-size:14px}'
      +'.hex{clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);display:flex;align-items:center;justify-content:center;font-family:"Bungee",sans-serif;color:#0b0509;flex:none}'
      +'.msy-glass{width:100%;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:10px;padding:14px 16px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}'
      +'.msy-chip{padding:6px 12px;border-radius:99px;background:rgba(255,61,154,.14);border:1px solid rgba(255,61,154,.5);color:#ffd1e6;font-size:13px;font-weight:600}.msy-chip.c{background:rgba(77,216,255,.12);border-color:rgba(77,216,255,.45);color:#d6f4ff}'
      +'.msy-alias{flex:1;min-width:0;box-sizing:border-box;background:rgba(0,0,0,.35);border:1px solid rgba(255,61,154,.5);border-radius:12px;padding:10px 14px;color:#fff;font-family:Anton,sans-serif;font-size:26px;letter-spacing:.03em;text-align:center;text-shadow:0 0 10px rgba(255,61,154,.9)}'
      +'.msy-ring{position:relative;width:200px;height:200px;margin:14px auto 0;display:flex;align-items:center;justify-content:center}.msy-ring i{position:absolute;border-radius:50%;border:1px solid rgba(255,61,154,.25)}.msy-ring i:nth-child(1){inset:0}.msy-ring i:nth-child(2){inset:30px;border-color:rgba(255,61,154,.4)}.msy-ring i:nth-child(3){inset:60px;border:2px solid rgba(255,61,154,.6);box-shadow:0 0 24px rgba(255,61,154,.4)}'
      +'.msy-sweep{position:absolute;left:50%;top:50%;width:100px;height:2px;margin-top:-1px;transform-origin:left center;background:linear-gradient(90deg,'+NEON+',rgba(255,61,154,0));animation:msySweep 2.4s linear infinite}@keyframes msySweep{to{transform:rotate(360deg)}}html.fx-lite .msy-sweep{animation:none}'
      +'.msy-look{font-family:Anton,sans-serif;font-size:26px;letter-spacing:.06em;line-height:1.05;color:'+NEON+';text-shadow:0 0 6px #fff,0 0 18px '+NEON+';text-align:center}'
      +'.msy-clk{font-family:Anton,sans-serif;font-size:34px;letter-spacing:.04em;line-height:1;color:'+GOLD+';text-shadow:0 0 14px '+GOLD+'}.msy-clk.low{color:'+RED+';text-shadow:0 0 14px '+RED+'}'
      +'.msy-log{flex:1;min-height:0;overflow:auto;padding:12px 14px 6px;display:flex;flex-direction:column;gap:9px;-webkit-overflow-scrolling:touch}'
      +'.msy-m{max-width:82%;padding:10px 13px;border-radius:4px 16px 16px 16px;font-size:16px;font-weight:500;line-height:1.35;color:#f3e9ee;background:#1b1f23;border:1px solid rgba(220,214,201,.14);word-wrap:break-word}.msy-m.me{margin-left:auto;border-radius:16px 4px 16px 16px;color:#fff;background:linear-gradient(135deg,'+NEON+',#8a1d55);border:0;box-shadow:0 0 14px rgba(255,61,154,.35)}.msy-m.sys{max-width:100%;background:transparent;border:0;text-align:center;color:#8f979e;font-size:12px;letter-spacing:.14em;font-weight:700;padding:2px}'
      +'.msy-in{padding:8px 14px 16px;display:flex;flex-direction:column;gap:8px;border-top:1px solid rgba(255,61,154,.2);flex:none;background:linear-gradient(180deg,rgba(7,8,10,0),#0b0d0f)}.msy-in .r{display:flex;gap:6px}.msy-in input{flex:1;min-width:0;box-sizing:border-box;background:#0e1113;border:1px solid rgba(255,61,154,.35);border-radius:12px;padding:12px 13px;color:#f3e9ee;font-size:16px;font-weight:500}'
      +'.msy-ext{width:100%;padding:14px;border-radius:12px;border:2px solid '+GOLD+';background:linear-gradient(180deg,'+GOLD+',#a3821a);color:#0b0509;font-family:Anton,sans-serif;font-size:19px;letter-spacing:.08em;cursor:pointer;box-shadow:0 0 28px rgba(255,230,0,.45),0 5px 0 #5c4a0e}.msy-ext.wait{opacity:.7}'
      +'.msy-hook{width:52px;height:52px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(180deg,#2a1d2a,#130b14);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:24px;filter:grayscale(1);opacity:.5}.msy-hook.on{border:2px solid '+NEON+';background:linear-gradient(180deg,#ff86c2,'+NEON+' 50%,#a21c62);box-shadow:0 0 16px '+NEON+';filter:none;opacity:1}'
      +'.msy-tg{padding:8px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.15);background:linear-gradient(180deg,#2a1d2a,#130b14);color:#d7a8c0;font-family:Inter,system-ui,sans-serif;font-weight:700;font-size:12px;letter-spacing:.04em;cursor:pointer}.msy-tg.on{border-color:'+NEON+';background:linear-gradient(180deg,'+NEON+',#8a1d55);color:#0b0509}.msy-tg.bad{border-color:'+RED+';color:'+RED+'}.msy-tg.bad.on{background:'+RED+';color:#0b0509}';
    document.head.appendChild(st);
  }

  var S=null, PROF=null;
  function fresh(){ return { view:'door', id:rid(8), kp:null, pub:null, key:null, queue:null, room:null, roomId:'', seen:{}, refused:{}, pending:null, pendAt:0, seekT:null,
    me:'', them:'', themId:'', themCard:'', lines:[], ends:0, ext:0, extMine:false, extTheirs:false, revMine:false, revTheirs:false, theirHandle:'', lastPing:0, tick:null, pingT:null, started:0, over:false, counted:false, hooks:0, tags:{}, _card:'', _room:'' }; }
  function host(){ return $('msyRoom'); }
  function wrap(){ var r=host(); return r&&r.querySelector('.msy-wrap'); }
  function top(t,plate){ return '<div class="msy-top"><button type="button" class="msy-back" data-msy="back" aria-label="Back">‹</button><div style="display:flex;flex-direction:column;gap:1px;min-width:0"><span class="msy-kick">PORT LIFE</span><span class="msy-ttl">'+esc(t||'AFTER HOURS')+'</span></div>'+(plate?'<span class="msy-plate">'+plate+'</span>':'')+'</div>'; }

  function open(){
    css(); var r=host();
    if(!r){ r=document.createElement('div'); r.className='roomscreen'; r.id='msyRoom'; r.innerHTML='<div class="msy-wrap"></div>'; document.body.appendChild(r);
      r.addEventListener('click',onTap); r.addEventListener('keydown',function(e){ if(e.key==='Enter'&&e.target&&e.target.id==='msyText'){ e.preventDefault(); send(); } }); }
    if(!S)S=fresh();
    r.classList.add('on'); hum([15,30,15]);
    window.__messyGhost=true; try{ if(typeof floorTrack==='function')floorTrack(null); }catch(e){}
    if(S.view==='date')return;
    door();
  }
  function askClose(){ if(S&&S.view==='date'){ if(!confirm('Leave the date? The chat is gone for good.'))return; } if(S&&S.view==='queue'){ if(!confirm('Stop looking?'))return; } close(); }
  function close(){ var r=host(); if(r)r.classList.remove('on'); teardown(); S=null;
    window.__messyGhost=false; try{ if(typeof floorTrack==='function')floorTrack((typeof CURRENT_ROOM!=='undefined'&&CURRENT_ROOM)||null); }catch(e){} }
  function teardown(){ if(!S)return;
    try{ if(S.room)sealSend({t:'bye'}); }catch(e){}
    try{ if(S.queue)S.queue.send({type:'broadcast',event:'gone',payload:{id:S.id}}); }catch(e){}
    var q=S.queue, rm=S.room; setTimeout(function(){ [q,rm].forEach(function(c){ try{ if(c&&sb())sb().removeChannel(c); }catch(e){} }); },250);
    clearInterval(S.seekT); clearInterval(S.tick); clearInterval(S.pingT); S.queue=null; S.room=null; S.lines=[]; S.key=null; }
  window.addEventListener('pagehide',function(){ try{ teardown(); S=null; window.__messyGhost=false; }catch(e){} });
  function onTap(e){ var b=e.target.closest('[data-msy]'); if(!b)return; var k=b.getAttribute('data-msy'), v=b.getAttribute('data-v'); try{ act(k,v,b); }catch(err){ say('✗ '+(err&&err.message||err)); } }
  function act(k,v,b){
    if(k==='back'){ if(S.view==='door')close(); else if(S.view==='date')askClose(); else { teardown(); S=fresh(); door(); } }
    else if(k==='sex'){ PROF.sex=v; paintDoor(); } else if(k==='into'){ PROF.into=v; paintDoor(); }
    else if(k==='go')go(b); else if(k==='roll'){ var i=$('msyAlias'); if(i)i.value=roll(); }
    else if(k==='send')send(); else if(k==='extend')extend(); else if(k==='reveal')reveal(true); else if(k==='noreveal')reveal(false);
    else if(k==='flag')flag(b); else if(k==='hook'){ S.hooks=+v; paintRate(); } else if(k==='tag'){ S.tags[v]=!S.tags[v]; paintRate(); }
    else if(k==='rate')rateSend(b); else if(k==='again'){ teardown(); S=fresh(); door(); setTimeout(function(){ var g=$('msyGo'); if(g&&!g.disabled)go(g); },400); }
    else if(k==='done'){ close(); }
  }

  /* ── the door ── */
  function door(){
    S.view='door'; var w=wrap();
    w.innerHTML=top('AFTER HOURS','OPEN<br>ALL NIGHT')
      +'<div class="msy-sign"><div><div class="msy-m1">MESSY</div><div class="msy-m2">ON DA DOCKS</div><div class="msy-tag">SINGLES &amp; CHEATERS</div><div class="msy-live">LIVE · 10 MIN · NO NAMES · NO RECEIPTS</div></div></div>'
      +'<div class="msy-body" id="msyBody"><div class="sub" style="color:#8f979e;text-align:center">checking the door…</div></div>';
    if(!window.SB||!window.__shkUid){ $('msyBody').innerHTML='<div class="msy-card"><div class="msy-h">SIGN IN FIRST</div><div class="msy-rule">Messy is for members. Claim your card and sign in.</div></div>'; return; }
    rpc('dates_eligible').then(function(r){
      if(!r||!r.ok){ $('msyBody').innerHTML='<div class="msy-card"><div class="msy-h">THE DOOR IS SHUT</div><div class="msy-rule">'+esc((r&&r.why)||'not today')+'</div></div>'; return; }
      PROF=PROF||{}; PROF.handle=r.handle; if(!PROF.sex)PROF.sex=r.sex||''; if(!PROF.into)PROF.into=r.into||''; PROF.alias=r.alias||PROF.alias||''; PROF.dates=r.dates||0; PROF.extends=r.extends||0; PROF.rated=r.rated;
      paintDoor();
    }).catch(function(e){ var m=String(e.message||e); $('msyBody').innerHTML='<div class="msy-card"><div class="msy-rule">'+esc(/dates_eligible|does not exist|PGRST202|42883/i.test(m)?'Messy isn’t built yet — run GAMES.sql once in Supabase.':m)+'</div></div>'; });
  }
  function paintDoor(){
    var b=$('msyBody'); if(!b||!PROF)return; var P=PROF;
    var pick=function(k,v,l,on,g){ return '<button type="button" class="msy-pick'+(on?' on':'')+(g?' g':'')+'" data-msy="'+k+'" data-v="'+v+'">'+l+'</button>'; };
    b.innerHTML=
      '<div class="msy-card"><div class="msy-h">HOUSE RULES</div>'
      +'<div class="msy-rule"><i>10</i><span>minutes. Fake names. Messages wipe the second it closes.</span></div>'
      +'<div class="msy-rule"><i>+5</i><span>Extend the time or drop handles — only if you <b>both</b> say so.</span></div>'
      +'<div class="msy-rule"><i>★</i><span>Rate the date!! Repeat offenders of misconduct get suspended from Messy.</span></div>'
      +'<div class="msy-lock" style="margin-top:2px;padding-top:7px;border-top:1px solid rgba(255,61,154,.25)">🔒 ENCRYPTED COMMUNICATION: PHONE TO PHONE</div>'
      +'<div class="msy-lock">🕶 YOU GO INVISIBLE ON THE HALL WHILE YOU’RE IN HERE</div></div>'
      +'<div class="msy-card v"><div class="msy-row"><span>I’M A</span>'+pick('sex','m','MAN',P.sex==='m')+pick('sex','w','WOMAN',P.sex==='w')+'</div>'
      +'<div class="msy-row"><span>INTO</span>'+pick('into','m','MEN',P.into==='m',1)+pick('into','w','WOMEN',P.into==='w',1)+pick('into','b','BOTH',P.into==='b',1)+'</div></div>'
      +'<div class="msy-vip"><div class="hex" style="width:40px;height:46px;background:linear-gradient(180deg,#fff2b0,'+GOLD+' 40%,#a3821a);font-size:11px">VIP</div><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px"><div style="display:flex;align-items:baseline;gap:8px"><b>GOOD STANDING</b><small>TREAT EVERYBODY WITH RESPECT</small></div><div class="n"><span><b>'+P.dates+'</b> DATES</span><span><b style="color:'+NEON+'">'+P.extends+'</b> EXT</span><span><b style="color:'+GOLD+'">'+(P.rated!=null?P.rated:'—')+'</b> RATED</span></div></div></div>'
      +'<button type="button" class="msy-big" id="msyGo" data-msy="go"'+(P.sex&&P.into?'':' disabled')+'>♥ GET MESSY</button>'
      +'<div class="msy-foot">Enter at your own risk. Don’t report me to LRC.</div>';
  }

  /* ── keys: the two phones agree one between themselves ── */
  function makeKeys(){
    return crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},false,['deriveKey']).then(function(kp){ S.kp=kp; return crypto.subtle.exportKey('jwk',kp.publicKey); }).then(function(j){ S.pub={kty:j.kty,crv:j.crv,x:j.x,y:j.y}; });
  }
  function deriveKey(theirPub){
    return crypto.subtle.importKey('jwk',theirPub,{name:'ECDH',namedCurve:'P-256'},false,[]).then(function(pk){
      return crypto.subtle.deriveKey({name:'ECDH',public:pk},S.kp.privateKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']); }).then(function(k){ S.key=k; });
  }
  function sealSend(obj){ if(!S||!S.room||!S.key)return Promise.resolve();
    var iv=crypto.getRandomValues(new Uint8Array(12)), room=S.room;
    return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},S.key,new TextEncoder().encode(JSON.stringify(obj))).then(function(ct){ try{ room.send({type:'broadcast',event:'x',payload:{iv:b64(iv),ct:b64(ct)}}); }catch(e){} }).catch(function(){}); }
  function unseal(p){ if(!S||!S.key||!p||!p.iv)return Promise.resolve(null);
    return crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(unb64(p.iv))},S.key,unb64(p.ct)).then(function(b){ return JSON.parse(new TextDecoder().decode(b)); }).catch(function(){ return null; }); }

  /* ── the queue ── */
  function go(b){
    var P=PROF; if(!P||!P.sex||!P.into){ say('Pick who you are and who you’re into'); return; }
    b.disabled=true;
    rpc('dates_setup',{p_sex:P.sex,p_into:P.into,p_alias:P.alias||null}).then(function(){ return makeKeys(); }).then(function(){ queue(); })
      .catch(function(e){ b.disabled=false; say('✗ '+e.message); });
  }
  function fits(a,b){ var ok=function(into,sex){ return into==='b'||into===sex; }; return ok(a.into,b.sex)&&ok(b.into,a.sex); }
  function queue(){
    S.view='queue'; S.me=PROF.alias||roll();
    wrap().innerHTML=top('AFTER HOURS','')
      +'<div class="msy-body" style="align-items:center;justify-content:center;gap:16px">'
      +'<div class="msy-ring"><i></i><i></i><i></i><div class="msy-sweep"></div><div class="hex" style="width:68px;height:78px;background:linear-gradient(180deg,'+NEON+',#8a1d55);font-size:28px;filter:drop-shadow(0 0 18px '+NEON+')" id="msyMyHex">'+esc(S.me.charAt(0).toUpperCase())+'</div></div>'
      +'<div class="msy-look">LOOKING FOR<br>SOMEBODY MESSY</div><div style="font-size:14px;font-weight:600;color:#8f979e;letter-spacing:.08em;text-align:center">Searching Match… Stay on this screen.</div>'
      +'<div class="msy-glass"><div style="display:flex;align-items:center;gap:8px"><span class="msy-chip">'+(PROF.sex==='m'?'Man':'Woman')+'</span><span style="color:#8f979e;font-size:13px">into</span><span class="msy-chip c">'+({m:'Men',w:'Women',b:'Both'})[PROF.into]+'</span></div>'
      +'<div style="width:100%;height:1px;background:linear-gradient(90deg,rgba(0,0,0,0),rgba(255,255,255,.14),rgba(0,0,0,0))"></div>'
      +'<div style="font-size:11px;font-weight:600;letter-spacing:.18em;color:#8f979e">YOU’LL BE</div>'
      +'<div style="width:100%;display:flex;gap:8px"><input id="msyAlias" class="msy-alias" maxlength="20" value="'+esc(S.me)+'"><button type="button" class="msy-ghost" data-msy="roll" style="width:46px;flex:none" aria-label="Re-roll the name">↻</button></div>'
      +'<div style="font-size:11.5px;color:#8f979e;text-align:center">Keep ours, re-roll it, or type your own. Not your handle.</div></div>'
      +'<span class="msy-lock">🕶 INVISIBLE ON THE HALL</span>'
      +'<button type="button" class="msy-ghost" data-msy="back" style="width:100%">NEVER MIND</button></div>';
    S.queue=sb().channel('messy-queue',{config:{broadcast:{self:false}}})
      .on('broadcast',{event:'seek'},function(p){ var m=p.payload||{}; if(!m.id||m.id===S.id||!m.pk)return; S.seen[m.id]={t:Date.now(),sex:m.sex,into:m.into,pk:m.pk}; propose(); })
      .on('broadcast',{event:'gone'},function(p){ var m=p.payload||{}; delete S.seen[m.id]; if(S.pending===m.id)S.pending=null; })
      .on('broadcast',{event:'pair'},function(p){ var m=p.payload||{}; if(m.to!==S.id||S.view!=='queue'||S.pending||!m.pk)return;
          if(!fits({sex:PROF.sex,into:PROF.into},{sex:m.sex,into:m.into}))return;
          S.pending=m.from; S.queue.send({type:'broadcast',event:'ok',payload:{from:S.id,to:m.from,room:m.room,pk:S.pub}}); enter(m.room,m.from,m.pk); })
      .on('broadcast',{event:'ok'},function(p){ var m=p.payload||{}; if(m.to!==S.id||S.view!=='queue'||S.pending!==m.from||!m.pk)return; enter(m.room,m.from,m.pk); })
      .subscribe(function(st){ if(st==='SUBSCRIBED'){ seek(); S.seekT=setInterval(seek,1500); } });
  }
  function seek(){ if(!S||!S.queue||S.view!=='queue')return;
    var i=$('msyAlias'); if(i){ var v=String(i.value||'').trim().slice(0,20); if(v&&v.toUpperCase()!==me())S.me=v; var h=$('msyMyHex'); if(h)h.textContent=S.me.charAt(0).toUpperCase(); }
    try{ S.queue.send({type:'broadcast',event:'seek',payload:{id:S.id,sex:PROF.sex,into:PROF.into,pk:S.pub}}); }catch(e){}
    var now=Date.now(); Object.keys(S.seen).forEach(function(k){ if(now-S.seen[k].t>5000)delete S.seen[k]; });
    if(S.pending&&now-S.pendAt>3500){ S.refused[S.pending]=1; S.pending=null; }
    propose(); }
  function propose(){ if(!S||S.view!=='queue'||S.pending)return;
    var ids=Object.keys(S.seen).filter(function(k){ return !S.refused[k]&&fits({sex:PROF.sex,into:PROF.into},S.seen[k]); }).sort(); if(!ids.length)return;
    if(S.id>ids[0])return;
    S.pending=ids[0]; S.pendAt=Date.now(); S.roomId=rid(6);
    try{ S.queue.send({type:'broadcast',event:'pair',payload:{from:S.id,to:ids[0],room:S.roomId,pk:S.pub,sex:PROF.sex,into:PROF.into}}); }catch(e){} }

  /* ── the room ── */
  function enter(room,themId,theirPk){
    S.view='date'; S.roomId=room; S.themId=themId; S.them=''; S.lines=[]; S.started=Date.now(); S.ends=S.started+DATE_MS; S.lastPing=Date.now();
    try{ S.queue.send({type:'broadcast',event:'gone',payload:{id:S.id}}); }catch(e){}
    var q=S.queue; setTimeout(function(){ try{ if(q&&sb())sb().removeChannel(q); }catch(e){} },250); S.queue=null; clearInterval(S.seekT);
    hum([30,50,30]); paintRoom();
    deriveKey(theirPk).then(function(){
      S.room=sb().channel('messy-'+room,{config:{broadcast:{self:false}}})
        .on('broadcast',{event:'x'},function(p){ unseal(p.payload).then(function(m){ if(m)onRoom(m); }); })
        .subscribe(function(st){ if(st==='SUBSCRIBED'){ hi(); setTimeout(hi,800); setTimeout(hi,2500); S.pingT=setInterval(function(){ sealSend({t:'ping'}); },5000); } });
      S.tick=setInterval(tick,250);
    }).catch(function(){ say('✗ the phones could not agree a key'); teardown(); S=fresh(); door(); });
  }
  function onRoom(m){
    if(!S||S.view!=='date')return; S.lastPing=Date.now();
    if(m.t==='hi'){ if(!S.them){ S.them=String(m.alias||'Someone').slice(0,20); S.themCard=String(m.card||''); if(S.them===S.me){ S.me=roll(); hi(); } sys(S.them+' is on the dock.'); paintTop(); } }
    else if(m.t==='msg'){ if(!S.over)line(String(m.text||'').slice(0,300),false); if(!lite())hum([10]); }
    else if(m.t==='extend'){ S.extTheirs=true; sys(S.them+' hit extend.'); tryExtend(); }
    else if(m.t==='reveal'){ S.revTheirs=true; sys(S.them+' said yeah.'); tryReveal(); }
    else if(m.t==='handle'){ S.theirHandle=String(m.handle||'').slice(0,24); if(S.revMine&&S.revTheirs)end(true); }
    else if(m.t==='bye'){ left('They slipped off the dock.'); }
  }
  function hi(){ sealSend({t:'hi',alias:S.me,card:window.__shkUid||''}); }
  function paintRoom(){
    wrap().innerHTML=
      '<div class="msy-top"><button type="button" class="msy-back" data-msy="back" aria-label="Leave the date">‹</button><div style="flex:1;display:flex;flex-direction:column;align-items:center;line-height:1"><span class="msy-clk" id="msyClk">10:00</span><span style="font-size:9px;letter-spacing:.24em;color:#8f979e;font-weight:700;margin-top:3px" id="msyClkL">ON THE CLOCK</span></div><button type="button" class="msy-ghost" data-msy="flag" style="width:40px;height:40px;padding:0;flex:none" aria-label="Flag this date">⚑</button></div>'
      +'<div style="display:flex;align-items:center;justify-content:center;gap:10px;padding:0 14px 8px"><div style="display:flex;align-items:center;gap:7px;flex:1;justify-content:flex-end;min-width:0"><span style="font-family:Anton,sans-serif;font-size:14px;letter-spacing:.05em;color:'+NEON+'">'+esc(S.me)+'</span><div class="hex" style="width:28px;height:32px;background:linear-gradient(180deg,'+NEON+',#8a1d55);font-size:12px">'+esc(S.me.charAt(0).toUpperCase())+'</div></div><span style="color:'+NEON+'">♥</span><div style="display:flex;align-items:center;gap:7px;flex:1;min-width:0"><div class="hex" style="width:28px;height:32px;background:#22272c;color:#f3e9ee;font-size:12px" id="msyThemHex">?</div><span style="font-family:Anton,sans-serif;font-size:14px;letter-spacing:.05em;color:#f3e9ee" id="msyThem">…</span></div></div>'
      +'<div class="msy-log" id="msyLog"><div class="msy-m sys">PAIRED · ENCRYPTED · NOTHING SAVED · SAY SOMETHIN’</div></div>'
      +'<div class="msy-in" id="msyIn"><div id="msyExtWrap"></div><div class="r"><input id="msyText" placeholder="say somethin’…" maxlength="300" autocomplete="off"><button type="button" class="msy-ghost v" data-msy="send">SEND</button></div></div>';
  }
  function paintTop(){ var t=$('msyThem'); if(t)t.textContent=S.them||'…'; var h=$('msyThemHex'); if(h)h.textContent=(S.them||'?').charAt(0).toUpperCase(); }
  function sys(t){ var L=$('msyLog'); if(!L)return; var d=document.createElement('div'); d.className='msy-m sys'; d.textContent=t.toUpperCase(); L.appendChild(d); L.scrollTop=L.scrollHeight; }
  function line(text,mine){ var L=$('msyLog'); if(!L)return; var d=document.createElement('div'); d.className='msy-m'+(mine?' me':''); d.textContent=text; L.appendChild(d); L.scrollTop=L.scrollHeight; }
  function send(){ if(!S||S.view!=='date'||S.over)return; var i=$('msyText'); var t=String(i.value||'').trim(); if(!t)return; i.value=''; line(t,true); sealSend({t:'msg',text:t}); }
  function tick(){ if(!S||S.view!=='date')return;
    var lf=S.ends-Date.now(), clk=$('msyClk');
    if(clk){ var s=Math.max(0,Math.ceil(lf/1000)); clk.textContent=Math.floor(s/60)+':'+('0'+(s%60)).slice(-2); clk.classList.toggle('low',lf<=EXT_WINDOW); var l=$('msyClkL'); if(l)l.textContent=lf<=EXT_WINDOW?'LAST MINUTE':'ON THE CLOCK'; }
    if(!S.over&&Date.now()-S.lastPing>20000&&S.them){ left('They slipped off the dock.'); return; }
    if(!S.over&&lf<=EXT_WINDOW&&S.ext<MAX_EXT&&!$('msyExt')){ var w=$('msyExtWrap'); if(w){ w.innerHTML='<button type="button" class="msy-ext" id="msyExt" data-msy="extend">⏳ EXTEND +5 · BOTH MUST TAP</button>'; hum([15,30,15]); } }
    if(!S.over&&lf<=0)over();
  }
  function extend(){ if(S.over||S.extMine)return; S.extMine=true; var b=$('msyExt'); if(b){ b.classList.add('wait'); b.textContent='⏳ WAITING ON THEM…'; } sealSend({t:'extend'}); tryExtend(); }
  function tryExtend(){ if(S.over||!S.extMine||!S.extTheirs||S.ext>=MAX_EXT)return;
    S.ext++; S.ends+=EXT_MS; S.extMine=false; S.extTheirs=false; var w=$('msyExtWrap'); if(w)w.innerHTML=''; sys('Extended — five more minutes.'); hum([20,40,20,40,20]); }
  function over(){ S.over=true; var i=$('msyText'); if(i)i.disabled=true; clearInterval(S.pingT); count(); hum([40,60,40]);
    var w=$('msyIn'); if(w)w.innerHTML='<div style="text-align:center;padding:6px 0 4px"><div class="msy-look" style="font-size:26px">DROP HANDLES?</div><div style="font-size:14px;font-weight:600;color:#8f979e;margin:6px 0 10px">Only if you <b style="color:#f3e9ee">both</b> say yes. Say no and it never happened.</div><div style="display:flex;gap:8px"><button type="button" class="msy-big" style="margin:0;padding:14px;font-size:15px;flex:1" data-msy="reveal">YEAH, DROP IT</button><button type="button" class="msy-ghost" style="flex:1" data-msy="noreveal">NAH, GHOST</button></div><div id="msyRevNote" style="margin-top:8px;font-size:12px;letter-spacing:.14em;font-weight:700;color:'+GOLD+'"></div></div>';
    tryReveal(); }
  function reveal(yes){ if(!S.over)return; if(yes){ S.revMine=true; sealSend({t:'reveal'}); var n=$('msyRevNote'); if(n)n.textContent='WAITING ON '+S.them.toUpperCase()+'…'; tryReveal(); } else end(false); }
  function tryReveal(){ if(!S.over||!S.revMine||!S.revTheirs)return; sealSend({t:'handle',handle:me()}); if(S.theirHandle)end(true); }
  function count(){ if(S.counted)return; S.counted=true; if(Date.now()-S.started<5*60*1000)return; rpc('dates_done',{p_extensions:S.ext}).catch(function(){}); }
  function left(why){ if(!S||S.view!=='date')return; if(S.over&&S.revMine)return; var early=(Date.now()-S.started)<5*60*1000; S.over=true; clearInterval(S.pingT); count(); end(false,why+(early?' Under five minutes — it doesn’t count.':'')); }

  /* ── after: rate the date ── */
  function end(revealed,note){
    if(!S||S.view==='rate')return;
    S.view='rate'; clearInterval(S.tick); clearInterval(S.pingT); var card=S.themCard, them=S.them, room=S.roomId, hn=S.theirHandle;
    var rm=S.room; try{ sealSend({t:'bye'}); }catch(e){} setTimeout(function(){ try{ if(rm&&sb())sb().removeChannel(rm); }catch(e){} },400); S.room=null; S.lines=[]; S.key=null;
    S._card=card; S._room=room; S.hooks=0; S.tags={};
    wrap().innerHTML=top('AFTER HOURS','LAST<br>CALL')
      +'<div class="msy-body" style="gap:12px">'
      +'<div class="msy-card" style="flex-direction:row;align-items:center;gap:12px"><div class="hex" style="width:50px;height:58px;background:linear-gradient(180deg,#3a3f46,#1a1d22);color:#f3e9ee;font-size:20px">'+esc((them||'?').charAt(0).toUpperCase())+'</div><div style="display:flex;flex-direction:column;gap:1px;min-width:0"><span class="msy-h" style="color:'+VIOLET+'">YOUR DATE WITH</span><span style="font-family:Anton,sans-serif;font-size:22px;letter-spacing:.04em">'+esc(them||'?')+(revealed&&hn?' <span style="color:'+NEON+'">· '+esc(hn)+'</span>':'')+'</span><span style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:#d7a8c0">'+(note?esc(note):(S.ext?S.ext+' extension'+(S.ext>1?'s':'')+' · ':'')+(revealed?'handles dropped':'handles kept'))+'</span></div></div>'
      +(card?'<div class="msy-sign" style="margin:0"><div style="padding:14px 12px 12px"><div class="msy-m1" style="font-size:28px">RATE THE DATE</div><div style="display:flex;gap:8px;margin-top:6px" id="msyHooks"></div><div id="msyHookTxt" style="font-family:Bungee,sans-serif;font-size:12px;letter-spacing:.14em;color:#fff;margin-top:6px">TAP THE HOOKS</div></div></div>'
      +'<div class="msy-card v"><div class="msy-h" style="color:'+VIOLET+'">WHAT WERE THEY LIKE</div><div style="display:flex;flex-wrap:wrap;gap:6px" id="msyTags"></div></div>'
      +'<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:rgba(11,5,9,.6);border:1px dashed '+RED+'"><span style="color:'+RED+'">⚑</span><span style="flex:1;font-size:13px;font-weight:600;color:#d7a8c0;line-height:1.4">Out of line? Flag it. Repeat offenders get suspended from Messy.</span><button type="button" class="msy-ghost" data-msy="flag" style="color:'+RED+';border-color:'+RED+'">REPORT</button></div>'
      +'<button type="button" class="msy-big" data-msy="rate" style="margin-top:auto;font-size:20px">SUBMIT RATING</button>':'<div class="msy-card"><div class="msy-rule">Nobody showed. Nothing to rate.</div></div>')
      +'<div style="display:flex;gap:8px"><button type="button" class="msy-ghost v" style="flex:1" data-msy="again">GET MESSY AGAIN</button><button type="button" class="msy-ghost" style="flex:1" data-msy="done">DONE</button></div></div>';
    paintRate();
  }
  var TAGS=['FUNNY','GOOD TALK','SMOOTH','DRY','ONE-WORD ANSWERS','GHOSTED EARLY','OUT OF LINE'];
  function paintRate(){ var h=$('msyHooks'); if(!h)return; var s='';
    for(var i=1;i<=5;i++)s+='<button type="button" class="msy-hook'+(i<=S.hooks?' on':'')+'" data-msy="hook" data-v="'+i+'" aria-label="'+i+' hooks">🪝</button>'; h.innerHTML=s;
    var t=$('msyHookTxt'); if(t)t.textContent=S.hooks?(S.hooks+' HOOK'+(S.hooks>1?'S':'')+' · '+['','NOPE','MEH','ALRIGHT','WOULD GO AGAIN','MESSY AS HELL'][S.hooks]):'TAP THE HOOKS';
    var g=$('msyTags'); if(g)g.innerHTML=TAGS.map(function(x){ return '<button type="button" class="msy-tg'+(x==='OUT OF LINE'?' bad':'')+(S.tags[x]?' on':'')+'" data-msy="tag" data-v="'+x+'">'+x+'</button>'; }).join(''); }
  function rateSend(b){ if(!S.hooks){ say('Tap the hooks first'); return; } b.disabled=true;
    rpc('dates_rate',{p_card:S._card,p_room:S._room,p_hooks:S.hooks,p_tags:Object.keys(S.tags).filter(function(k){ return S.tags[k]; })}).then(function(){ hum([20,40,20]); say('★ rated'); b.textContent='RATED ✓'; }).catch(function(e){ b.disabled=false; say('✗ '+e.message); }); }
  function flag(b){ var card=S._card||S.themCard, room=S._room||S.roomId; if(!card){ say('nothing to flag'); return; }
    if(!confirm('Flag this date for misconduct? It’s anonymous.'))return; b.disabled=true;
    rpc('dates_flag',{p_card:card,p_room:room}).then(function(){ hum([20,40,20]); say('⚑ flagged'); }).catch(function(e){ b.disabled=false; say('✗ '+e.message); }); }

  D._live=true;
  try{ if(typeof window.__datesReady==='function')window.__datesReady(); }catch(e){}
})();
