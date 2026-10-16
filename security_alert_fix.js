/* security_alert_fix.js — #secfix (oct 16). The "WAS THIS YOU?" card's buttons call
   window.SB.rpc("security_alert_seen", …) without awaiting it, and a Supabase call that is never awaited never
   sends. So the card came back on every open. This sends the call for real when either button is tapped, marking
   every open alert for the member as seen. Nothing else about the card changes.
   Load once from index.html, after the Supabase client:  <script src="security_alert_fix.js" defer></script>
   Proper fix in index.html when convenient: in alertCard2's clear(), make it
     list.forEach(function(x){ window.SB.rpc("security_alert_seen",{p_id:x.id}).then(function(){}) })        */
(function(){
  'use strict';
  if(window.__secFix)return; window.__secFix=true;
  document.addEventListener('click',function(e){
    var b=e.target.closest('#secMe, #secNotMe'); if(!b||!window.SB)return;
    try{ window.SB.rpc('security_alert_seen',{p_id:null}).then(function(r){ if(r&&r.error)console.warn('security_alert_seen',r.error); },function(err){ console.warn('security_alert_seen',err); }); }catch(x){}
  },true);
})();
