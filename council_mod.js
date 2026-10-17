/* council_mod.js — #councilmod (oct 17). Every seat holder can now strike marks and void job drops that members post.
   A ⚖ STRIKE button sits at the top of the Wire for council members only. It opens a sheet listing the last 36 hours
   of marks (the count) and drops (what came down), newest first, each with a ✕ — tap once to arm, again to strike.
   Strikes go through council_strike_mark / council_void_drop on the server, which check the seat and log every strike
   (council_strikes: what, who, when, and a snapshot of the row) so nothing disappears without a record.
   Load once from index.html, after the Wire script:  <script src="council_mod.js" defer></script> */
(function(){
  'use strict';
  if(window.__councilMod)return; window.__councilMod=true;
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var council=false, rows=[], armed=null, busy=false, lastUid=null;
  function css(){ var s=document.createElement('style'); s.id='cmCSS'; s.textContent=
    '#cmBtn{display:none;align-items:center;gap:8px;margin:0 0 10px;padding:9px 14px;border-radius:12px;border:1px solid rgba(205,75,42,.5);background:linear-gradient(184deg,#2a1812,#140c0a);color:#e8967a;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.16em;cursor:pointer}#cmBtn.on{display:inline-flex}'+
    '#cmSheet{position:fixed;inset:0;z-index:420;display:none;background:#05060aeb;align-items:flex-end;justify-content:center}#cmSheet.on{display:flex}'+
    '#cmSheet .cm-in{width:100%;max-width:520px;max-height:88%;display:flex;flex-direction:column;border-radius:18px 18px 0 0;background:linear-gradient(180deg,#1b1f23,#0b0d0f);border:1px solid rgba(220,214,201,.14);border-bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}'+
    '#cmSheet .cm-h{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid rgba(220,214,201,.08)}#cmSheet .cm-h b{font:400 18px Anton,sans-serif;letter-spacing:.06em;color:#dcd6c9}#cmSheet .cm-h small{font:600 11px Inter,system-ui,sans-serif;letter-spacing:.1em;color:#8f979e}#cmSheet .cm-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:#000a;color:#fff;cursor:pointer}'+
    '#cmSheet .cm-tabs{display:flex;gap:6px;padding:10px 16px 0}#cmSheet .cm-tabs button{flex:1;height:36px;border-radius:9px;border:1px solid rgba(220,214,201,.14);background:#14171a;color:#8f979e;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer}#cmSheet .cm-tabs button.on{color:#eeb46b;border-color:rgba(238,180,107,.5)}'+
    '#cmSheet .cm-list{overflow:auto;padding:10px 16px 16px}#cmSheet .cm-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:#0b0d0f;border:1px solid rgba(220,214,201,.07);margin-bottom:6px}#cmSheet .cm-row.void{opacity:.45}#cmSheet .cm-row .tm{flex:none;width:46px;font:600 11px Inter,system-ui,sans-serif;color:#8f979e}'+
    '#cmSheet .cm-row .nn{flex:1;min-width:0}#cmSheet .cm-row .nn b{display:block;font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.04em;color:#dcd6c9}#cmSheet .cm-row .nn span{display:block;font-size:12px;color:#8f979e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '#cmSheet .cm-row .x{flex:none;min-width:34px;height:34px;padding:0 10px;border-radius:9px;border:1px solid rgba(205,75,42,.45);background:none;color:#e8967a;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.08em;cursor:pointer}#cmSheet .cm-row .x.arm{background:#cd4b2a;color:#fff;border-color:#cd4b2a}#cmSheet .cm-row .x:disabled{opacity:.4}'+
    '#cmSheet .cm-empty{padding:30px 10px;text-align:center;color:#8f979e;font-size:14px}';
    document.head.appendChild(s); }
  function when(ts){ var d=new Date(+ts); var h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?'a':'p'); }
  function btn(){
    var b=document.getElementById('cmBtn'); if(b)return b;
    var scr=document.getElementById('scr-board'); if(!scr)return null;
    var t=scr.querySelector('.screen-title'); b=document.createElement('button'); b.id='cmBtn'; b.type='button'; b.innerHTML='\u2696 STRIKE A MARK OR DROP'; b.addEventListener('click',open);
    if(t&&t.parentNode)t.parentNode.insertBefore(b,t.nextSibling); else scr.insertBefore(b,scr.firstChild);
    return b;
  }
  var tab='mark';
  function sheet(){
    var sh=document.getElementById('cmSheet'); if(sh)return sh;
    sh=document.createElement('div'); sh.id='cmSheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true');
    sh.innerHTML='<div class="cm-in"><div class="cm-h"><div><b>THE COUNCIL STRIKES</b><br><small>LAST 36 HOURS \u00B7 TAP \u2715 TWICE \u00B7 EVERY STRIKE IS LOGGED</small></div><button class="cm-x" type="button" aria-label="Close">\u2715</button></div><div class="cm-tabs"><button type="button" data-cmt="mark" class="on">MARKS</button><button type="button" data-cmt="drop">JOB DROPS</button></div><div class="cm-list" id="cmList"></div></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click',function(e){ if(e.target===sh||e.target.closest('.cm-x')){ shut(); return; } var t=e.target.closest('[data-cmt]'); if(t){ tab=t.getAttribute('data-cmt'); sh.querySelectorAll('[data-cmt]').forEach(function(x){ x.classList.toggle('on',x===t); }); armed=null; paint(); return; }
      var x=e.target.closest('.x[data-ref]'); if(x)strike(x); });
    return sh;
  }
  function shut(){ var sh=document.getElementById('cmSheet'); if(sh)sh.classList.remove('on'); armed=null; }
  function open(){ var sh=sheet(); sh.classList.add('on'); paint(); load(); }
  function paint(){
    var el=document.getElementById('cmList'); if(!el)return;
    var list=rows.filter(function(r){ return r.kind===tab; });
    if(!list.length){ el.innerHTML='<div class="cm-empty">'+(tab==='mark'?'No marks on the count in the last 36 hours.':'No job drops in the last 36 hours.')+'</div>'; return; }
    el.innerHTML=list.map(function(r){
      var isArm=armed===r.kind+':'+r.ref;
      var main=r.kind==='mark'?E(r.pos)+(r.cat?' \u00B7 '+E(r.cat):''):'+'+E(r.n)+' '+E(r.cat||'');
      return '<div class="cm-row'+(r.voided?' void':'')+'"><div class="tm">'+when(r.ts)+'</div><div class="nn"><b>'+main+'</b><span>'+E(r.by_handle||'a casual')+(r.voided?' \u00B7 already struck':'')+'</span></div>'+(r.voided?'':'<button type="button" class="x'+(isArm?' arm':'')+'" data-ref="'+E(r.ref)+'" data-kind="'+E(r.kind)+'">'+(isArm?'STRIKE':'\u2715')+'</button>')+'</div>';
    }).join('');
  }
  function strike(x){
    var ref=x.getAttribute('data-ref'), kind=x.getAttribute('data-kind'), key=kind+':'+ref;
    if(armed!==key){ armed=key; paint(); setTimeout(function(){ if(armed===key){ armed=null; paint(); } },4000); return; }
    if(busy||!window.SB)return; busy=true; armed=null; x.disabled=true;
    var call=kind==='mark'?window.SB.rpc('council_strike_mark',{p_id:+ref,p_reason:'struck by the council'}):window.SB.rpc('council_void_drop',{p_cid:ref,p_reason:'struck by the council'});
    call.then(function(r){ busy=false; if(r.error){ say('\u2717 '+(r.error.message||'the wire kept it')); paint(); return; }
      say(kind==='mark'?'\u2713 Mark struck off the count':'\u2713 Drop voided'); rows=rows.filter(function(q){ return !(q.kind===kind&&q.ref===ref); }); paint();
      try{ typeof sbLoadLiveCalls==='function'&&sbLoadLiveCalls(); }catch(e){} try{ typeof dpRefresh==='function'&&dpRefresh(); }catch(e){}
    },function(){ busy=false; say('\u2717 No connection. Try again.'); paint(); });
  }
  function load(){ if(!window.SB||!council)return; window.SB.rpc('council_wire_recent').then(function(r){ if(r.error||!Array.isArray(r.data))return; rows=r.data; paint(); }); }
  function check(){ if(!window.SB||!window.__shkUid)return; window.SB.rpc('sc_am_council').then(function(r){ council=!r.error&&r.data===true; var b=btn(); if(b)b.classList.toggle('on',council); },function(){}); }
  css();
  setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; council=false; var b=document.getElementById('cmBtn'); if(b)b.classList.remove('on'); if(u)setTimeout(check,1500); } },1000);
  new MutationObserver(function(){ if(council){ var b=btn(); if(b)b.classList.add('on'); } }).observe(document.body,{childList:true,subtree:true});
  window.councilModOpen=open;
})();
