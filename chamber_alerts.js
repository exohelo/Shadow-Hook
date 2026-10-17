/* chamber_alerts.js — #chamberalerts (oct 16). Two things the Chamber was missing:
     1. a NUMBER on the crest: how many words have landed on the Table since you last walked in (sc_unread), updated
        live as they land, cleared when you open the Chamber
     2. closed-app pushes for the council: a seat holder's phone is only pushed if it has posted a watch (push_subs),
        and until now that only happened when someone turned on odds alerts. Now every council member's phone posts
        its watch on sign-in (asking once for permission), so push-chamber can reach it when the app is closed.
   Load once from index.html, after sc.js:  <script src="chamber_alerts.js" defer></script> */
(function(){
  'use strict';
  if(window.__chamberAlerts)return; window.__chamberAlerts=true;
  var LS='shk_sc_seen', VAPID='BOIf-N1g5af_QuVRTc9AbScS5YWjUMAX8wSFjfbC4Y6KPVJvLGxzvWrgPSBb38yYvCAuKCJqAGWisb8d-vZpbss';
  var n=0, council=false, lastUid=null;
  function css(){ var s=document.createElement('style'); s.textContent='.sc-ribbon .sc-n{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e0492e;color:#fff;font:800 11px/18px Inter,system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px var(--void,#0b0d0f);pointer-events:none}.sc-ribbon .sc-n:empty{display:none}'; document.head.appendChild(s); }
  function since(){ try{ return localStorage.getItem(LS)||''; }catch(e){ return ''; } }
  function badge(){ var r=document.querySelector('.sc-ribbon'); if(!r)return; var b=r.querySelector('.sc-n'); if(!b){ b=document.createElement('span'); b.className='sc-n'; r.appendChild(b); } b.textContent=n>0?(n>99?'99+':String(n)):''; r.setAttribute('aria-label','The Shadow Council'+(n?' \u00B7 '+n+' new':'')); }
  function count(){
    if(!window.SB||!window.__shkUid)return;
    window.SB.rpc('sc_unread',{p_since:since()||null}).then(function(r){ if(r.error)return; council=true; n=+r.data||0; badge(); },function(){});
  }
  var _seenT=0;
  function seen(){ try{ localStorage.setItem(LS,new Date().toISOString()); }catch(e){} n=0; badge();
    /* the server keeps it too: that's the read receipt (sc_seen) */
    if(window.SB&&council&&Date.now()-_seenT>30000){ _seenT=Date.now(); window.SB.rpc('sc_mark_seen').then(function(){},function(){}); } }
  /* the crest opens the Chamber: that's "seen" */
  document.addEventListener('click',function(e){ if(e.target.closest('.sc-ribbon'))setTimeout(seen,300); },true);
  new MutationObserver(function(){ var sh=document.getElementById('scChamber'); if(sh&&sh.classList.contains('on')&&n)seen(); }).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
  /* live: a new word on the Table bumps the number (and the app's own in-app alert still fires) */
  function live(){
    if(!window.SB||window.__caRT)return; try{
      window.__caRT=window.SB.channel('chamber-alerts').on('postgres_changes',{event:'INSERT',schema:'public',table:'sc_table'},function(p){ var row=p&&p.new; if(!row||row.uid===window.__shkUid)return; var sh=document.getElementById('scChamber'); if(sh&&sh.classList.contains('on')&&!document.hidden){ seen(); return; } n++; badge(); }).subscribe();
    }catch(e){}
  }
  /* closed-app pushes: a council member's phone posts its watch */
  function b64u8(s){ var p='='.repeat((4-s.length%4)%4), r=atob((s+p).replace(/-/g,'+').replace(/_/g,'/')), a=new Uint8Array(r.length); for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i); return a; }
  async function arm(){
    try{
      if(!council||!window.SB||!('Notification' in window)||!navigator.serviceWorker)return;
      var reg=window.SW_REG||await navigator.serviceWorker.ready; if(!reg||!reg.pushManager)return;
      if(Notification.permission==='default'){ var k='shk_sc_push_asked'; if(localStorage.getItem(k))return; localStorage.setItem(k,'1'); var p=await Notification.requestPermission(); if(p!=='granted')return; }
      if(Notification.permission!=='granted')return;
      var sub=await reg.pushManager.getSubscription(); if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u8(VAPID)});
      var j=sub.toJSON();
      await window.SB.from('push_subs').upsert({endpoint:sub.endpoint,p256dh:j.keys&&j.keys.p256dh||'',auth:j.keys&&j.keys.auth||'',handle:(typeof loadAcct==='function'&&(loadAcct()||{}).handle)||null,km:!!window.__isKM,uid:window.__shkUid||null,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
    }catch(e){ try{ console.warn('chamber_alerts arm',e); }catch(x){} }
  }
  css();
  setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; council=false; n=0; badge(); if(u){ setTimeout(function(){ count(); live(); setTimeout(arm,2500); },1500); } } },1000);
  setInterval(count,3*60*1000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden)count(); });
  window.chamberAlertsArm=arm;
})();
