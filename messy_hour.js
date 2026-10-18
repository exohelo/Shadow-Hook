/* messy_hour.js — #messyhour (oct 17). Messy on da Docks is open ONE HOUR a night (9–10 PM by default) so everyone
   looking is on the dock at the same time instead of trickling in alone. 58 searches, 0 matches said it all.
     · the arcade card says when the door opens (OPENS 9 PM · 2h 14m) and goes neon when it's open
     · inside, outside the hour: GET MESSY is replaced by a closed door with a countdown. The card (age, body, who
       you're into) can still be set up any time — that's the point of the wait
     · 🔔 PING ME WHEN IT OPENS — on by default for everyone who set Messy up; the server pushes the moment the
       door opens (push-messy). This also posts the phone's watch (asks once) so the push can reach it
     · inside the hour: a "CLOSES IN 41m" line so people don't wander off mid-hour
   Server: dates_hours (the Keymaster changes the hour there) · dates_window() · dates_remind(on) · messy_tick cron.
   Load once from index.html, after radio_book.js:  <script src="messy_hour.js?v=oct17a" defer></script> */
(function(){
  'use strict';
  if(window.__messyHour)return; window.__messyHour=true;
  var VAPID='BOIf-N1g5af_QuVRTc9AbScS5YWjUMAX8wSFjfbC4Y6KPVJvLGxzvWrgPSBb38yYvCAuKCJqAGWisb8d-vZpbss';
  var W=null, at=0, remind=true, armed=false;
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var say=function(m){ try{ toast(m); }catch(e){} };

  var st=document.createElement('style'); st.textContent=
    '.gm-messy .mh-when{position:absolute;left:0;right:0;bottom:0;padding:5px 0 6px;text-align:center;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.16em;color:#ffd4ea;background:linear-gradient(0deg,#000c,#0000);pointer-events:none}'+
    '.gm-messy .mh-when.open{color:#ff3d9a;text-shadow:0 0 10px #ff3d9a}.gm-messy{position:relative}'+
    '.mh-door{margin:8px 0 0;padding:16px 14px;border-radius:14px;background:linear-gradient(180deg,#1a0a14,#0b0509);border:1px solid rgba(255,61,154,.35);text-align:center}'+
    '.mh-door .k{font:700 11px Inter,system-ui,sans-serif;letter-spacing:.2em;color:#d7a8c0}.mh-door .t{font:400 44px Anton,sans-serif;letter-spacing:.04em;color:#ff3d9a;text-shadow:0 0 18px #ff3d9a77;line-height:1;margin:6px 0 4px}'+
    '.mh-door .s{font:600 13px Inter,system-ui,sans-serif;color:#a89aa3;line-height:1.5}.mh-door .s b{color:#fff}'+
    '.mh-door .ping{display:inline-flex;align-items:center;gap:8px;margin-top:12px;height:38px;padding:0 14px;border-radius:19px;border:1px solid rgba(255,61,154,.45);background:none;color:#ffd4ea;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.14em;cursor:pointer}.mh-door .ping.on{background:#ff3d9a;border-color:#ff3d9a;color:#fff;box-shadow:0 0 14px #ff3d9a66}'+
    '.mh-left{margin:-4px 0 8px;text-align:center;font:700 12px Inter,system-ui,sans-serif;letter-spacing:.12em;color:#ff3d9a}';
  document.head.appendChild(st);

  function fetchW(cb){ if(!window.SB)return; window.SB.rpc('dates_window').then(function(r){ if(r.error||!r.data)return; W=r.data; at=Date.now(); cb&&cb(); },function(){}); }
  function ms(iso){ var t=Date.parse(iso||''); return isNaN(t)?0:t-Date.now(); }
  function dur(m,short){ if(m<0)m=0; var s=Math.floor(m/1000), h=Math.floor(s/3600), mi=Math.floor(s%3600/60), se=s%60;
    if(short)return h>0?h+'h '+mi+'m':mi+'m'; return (h>0?h+':':'')+(h>0&&mi<10?'0':'')+mi+':'+(se<10?'0':'')+se; }
  function when(iso){ var d=new Date(iso); var h=d.getHours(),m=d.getMinutes(); return (h%12||12)+(m?':'+(m<10?'0':'')+m:'')+(h<12?' AM':' PM'); }
  function isOpen(){ if(!W)return true; if(W.always)return true; if(W.open)return ms(W.closes_at)>0; return ms(W.opens_at)<=0; }

  /* the arcade card */
  function card(){
    var c=document.querySelector('.hcard.gm-messy'); if(!c||!W||W.always)return;
    var b=c.querySelector('.mh-when'); if(!b){ b=document.createElement('div'); b.className='mh-when'; c.appendChild(b); }
    var open=isOpen();
    var txt=open?'\u25CF OPEN NOW \u00B7 CLOSES IN '+dur(ms(W.closes_at),true):'OPENS '+when(W.opens_at)+' \u00B7 '+dur(ms(W.opens_at),true);
    if(b.classList.contains('open')!==open)b.classList.toggle('open',open);
    if(b.textContent!==txt)b.textContent=txt;   /* only when it changes: the observer below watches the whole page */
  }

  /* the door inside */
  function door(){
    var go=document.getElementById('msyGo'); if(!go||!W||W.always)return;
    var body=go.parentNode, old=body.querySelector('.mh-door'), left=body.querySelector('.mh-left');
    if(isOpen()){
      if(old)old.remove(); go.style.display=''; if(go.hasAttribute('data-mh')){ go.disabled=go.getAttribute('data-mh')==='1'; go.removeAttribute('data-mh'); }
      if(!left){ left=document.createElement('div'); left.className='mh-left'; body.insertBefore(left,go); }
      var lt='\u25CF THE DOOR IS OPEN \u00B7 CLOSES IN '+dur(ms(W.closes_at)); if(left.textContent!==lt)left.textContent=lt;
      return;
    }
    if(left)left.remove();
    go.style.display='none'; if(!go.hasAttribute('data-mh')){ go.setAttribute('data-mh',go.disabled?'1':'0'); go.disabled=true; }
    if(!old){
      old=document.createElement('div'); old.className='mh-door';
      old.innerHTML='<div class="k">THE DOOR OPENS AT '+E(when(W.opens_at).toUpperCase())+'</div><div class="t" data-mh="t"></div>'+
        '<div class="s">Messy is open <b>one hour a night</b> \u00B7 '+E(W.label||'')+'<br>Everybody looking is on the dock at once \u2014 that\u2019s how you match.<br>Set up your card now so you\u2019re ready.</div>'+
        '<button type="button" class="ping'+(remind?' on':'')+'">\uD83D\uDD14 '+(remind?'PINGING YOU WHEN IT OPENS':'PING ME WHEN IT OPENS')+'</button>';
      body.insertBefore(old,go);
      old.querySelector('.ping').addEventListener('click',function(){ var b=this; remind=!remind; b.classList.toggle('on',remind); b.textContent='\uD83D\uDD14 '+(remind?'PINGING YOU WHEN IT OPENS':'PING ME WHEN IT OPENS');
        if(window.SB)window.SB.rpc('dates_remind',{p_on:remind}).then(function(){},function(){}); if(remind)arm(); });
    }
    var t=old.querySelector('[data-mh="t"]'), tt=dur(ms(W.opens_at)); if(t&&t.textContent!==tt)t.textContent=tt;
  }
  /* read "remind" + the window straight off the door's own answer (dates_eligible carries both now) */
  function peek(){
    if(!window.SB||!window.__shkUid)return;
    window.SB.rpc('dates_eligible').then(function(r){ var d=r&&r.data; if(!d)return; if(d.window){ W=d.window; at=Date.now(); } if(typeof d.remind==='boolean')remind=d.remind; door(); card(); },function(){});
  }

  /* the phone's watch, so the push can land (members only had one if they'd turned on odds alerts) */
  function b64u8(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')), a=new Uint8Array(r.length); for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i); return a; }
  async function arm(){
    try{
      if(armed||!window.SB||!window.__shkUid||!('Notification' in window)||!navigator.serviceWorker)return;
      var reg=window.SW_REG||await navigator.serviceWorker.ready; if(!reg||!reg.pushManager)return;
      if(Notification.permission==='default'){ var p=await Notification.requestPermission(); if(p!=='granted')return; }
      if(Notification.permission!=='granted')return;
      var sub=await reg.pushManager.getSubscription(); if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u8(VAPID)});
      var j=sub.toJSON();
      await window.SB.from('push_subs').upsert({endpoint:sub.endpoint,p256dh:j.keys&&j.keys.p256dh||'',auth:j.keys&&j.keys.auth||'',handle:(typeof loadAcct==='function'&&(loadAcct()||{}).handle)||null,km:!!window.__isKM,uid:window.__shkUid||null,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      armed=true;
    }catch(e){ try{ console.warn('messy_hour arm',e); }catch(x){} }
  }

  /* the push's link opens the door */
  function fromPush(){ try{ if(/[?&]open=dates\b/.test(location.search)&&typeof window.gameOpen==='function'){ setTimeout(function(){ try{ gameOpen('dates'); }catch(e){} },1800); history.replaceState(null,'',location.pathname); } }catch(e){} }

  var seenGo=null;
  new MutationObserver(function(){
    var go=document.getElementById('msyGo');
    if(go&&go!==seenGo){ seenGo=go; peek(); }
    if(!go)seenGo=null;
    card();
  }).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){ door(); card(); if(Date.now()-at>5*60*1000&&window.__shkUid)fetchW(function(){ door(); card(); }); },1000);
  var lastUid=null; setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; if(u){ fetchW(function(){ card(); }); setTimeout(fromPush,500); } } },1000);
  window.messyHour=function(){ return W; };
})();
