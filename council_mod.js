/* council_mod.js — #councilmod (oct 17, moved oct 18). Every seat holder can strike marks and void job drops that members post.
   A ⚖ STRIKE button sits in the Dispatch Post room's dock, beside LOG JOBS · MARK · CLICK, for council members only. It opens a sheet listing the last 36 hours
   of marks (the count) and drops (what came down), newest first, each with a ✕ — tap once to arm, again to strike.
   Strikes go through council_strike_mark / council_void_drop on the server, which check the seat and log every strike
   (council_strikes: what, who, when, and a snapshot of the row) so nothing disappears without a record.
   oct22: seat holders (not only the Keymaster) can void drops — the server guard was refusing them. JOB DROPS rows show
   their wave (FLEX / 1ST / 2ND); tap it to move the drop (dispatcher called 1st early), optionally with every later Flex drop
   on that board. Moves go through council_move_drops (logged in council_strikes as kind 'move'). Every phone re-reads the
   waves when they change, and the ear who logged a moved drop gets the new wave on their own phone too.
   Load once from index.html, after the Wire script:  <script src="council_mod.js?v=oct22a" defer></script> */
(function(){
  'use strict';
  if(window.__councilMod)return; window.__councilMod=true;
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var council=false, rows=[], armed=null, busy=false, lastUid=null;
  function css(){ var s=document.createElement('style'); s.id='cmCSS'; s.textContent=
    '#cmBtn{display:none}#cmBtn.on{display:flex}#dpRoomDock .cm-strike{color:#e8967a;border-color:rgba(205,75,42,.5)}'+
    '#cmSheet{position:fixed;inset:0;z-index:420;display:none;background:#05060aeb;align-items:flex-end;justify-content:center}#cmSheet.on{display:flex}'+
    '#cmSheet .cm-in{width:100%;max-width:520px;max-height:88%;display:flex;flex-direction:column;border-radius:18px 18px 0 0;background:linear-gradient(180deg,#1b1f23,#0b0d0f);border:1px solid rgba(220,214,201,.14);border-bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}'+
    '#cmSheet .cm-h{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid rgba(220,214,201,.08)}#cmSheet .cm-h b{font:400 18px Anton,sans-serif;letter-spacing:.06em;color:#dcd6c9}#cmSheet .cm-h small{font:600 11px Inter,system-ui,sans-serif;letter-spacing:.1em;color:#8f979e}#cmSheet .cm-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:#000a;color:#fff;cursor:pointer}'+
    '#cmSheet .cm-tabs{display:flex;gap:6px;padding:10px 16px 0}#cmSheet .cm-tabs button{flex:1;height:36px;border-radius:9px;border:1px solid rgba(220,214,201,.14);background:#14171a;color:#8f979e;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer}#cmSheet .cm-tabs button.on{color:#eeb46b;border-color:rgba(238,180,107,.5)}'+
    '#cmSheet .cm-list{overflow:auto;padding:10px 16px 16px}#cmSheet .cm-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;background:#0b0d0f;border:1px solid rgba(220,214,201,.07);margin-bottom:6px}#cmSheet .cm-row.void{opacity:.45}#cmSheet .cm-row .tm{flex:none;width:46px;font:600 11px Inter,system-ui,sans-serif;color:#8f979e}'+
    '#cmSheet .cm-row .nn{flex:1;min-width:0}#cmSheet .cm-row .nn b{display:block;font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.04em;color:#dcd6c9}#cmSheet .cm-row .nn span{display:block;font-size:12px;color:#8f979e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
    '#cmSheet .cm-row .x{flex:none;min-width:34px;height:34px;padding:0 10px;border-radius:9px;border:1px solid rgba(205,75,42,.45);background:none;color:#e8967a;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.08em;cursor:pointer}#cmSheet .cm-row .x.arm{background:#cd4b2a;color:#fff;border-color:#cd4b2a}#cmSheet .cm-row .x:disabled{opacity:.4}'+
    '#cmSheet .cm-empty{padding:30px 10px;text-align:center;color:#8f979e;font-size:14px}'+
    '#cmSheet .cm-ph{flex:none;height:30px;padding:0 9px;border-radius:8px;border:1px solid rgba(238,180,107,.45);background:none;color:#eeb46b;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.08em;cursor:pointer}#cmSheet .cm-ph.clk{border-style:dashed}#cmSheet .cm-ph.on{background:#eeb46b;color:#1b1f23}'+
    '#cmSheet .cm-mv{margin:-2px 0 8px;padding:10px;border-radius:12px;background:#14171a;border:1px solid rgba(238,180,107,.3)}#cmSheet .cm-mv .r{display:flex;gap:6px;align-items:center;flex-wrap:wrap}#cmSheet .cm-mv .r+.r{margin-top:8px}#cmSheet .cm-mv small{font:600 12px Inter,system-ui,sans-serif;color:#8f979e}'+
    '#cmSheet .cm-mv button{height:34px;padding:0 12px;border-radius:9px;border:1px solid rgba(238,180,107,.45);background:none;color:#eeb46b;font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.08em;cursor:pointer}#cmSheet .cm-mv button.cur{opacity:.35;pointer-events:none}#cmSheet .cm-mv label{display:flex;gap:8px;align-items:center;font:600 13px Inter,system-ui,sans-serif;color:#dcd6c9;cursor:pointer}#cmSheet .cm-mv input{width:18px;height:18px;accent-color:#eeb46b}';
    document.head.appendChild(s); }
  function when(ts){ var d=new Date(+ts); var h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?'a':'p'); }
  /* #cmdock (oct 18): the strike lives where marks and drops are made — the Dispatch Post room's dock, beside
     LOG JOBS · MARK · CLICK — and only for seat holders. Nothing on the Wire's front page. */
  function btn(){
    var dock=document.getElementById('dpRoomDock'); if(!dock||!dock.querySelector('[data-dp="log"]'))return null;
    var b=dock.querySelector('#cmBtn'); if(b)return b;
    b=document.createElement('button'); b.id='cmBtn'; b.type='button'; b.className='dp-dk cm-strike';
    b.setAttribute('aria-label','Council: strike a mark or a job drop');
    b.innerHTML='<span style="font-size:18px;line-height:1">\u2696</span><span>STRIKE</span>';
    b.addEventListener('click',function(e){ e.stopPropagation(); open(); });
    dock.appendChild(b); return b;
  }
  var tab='mark';
  function sheet(){
    var sh=document.getElementById('cmSheet'); if(sh)return sh;
    sh=document.createElement('div'); sh.id='cmSheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true');
    sh.innerHTML='<div class="cm-in"><div class="cm-h"><div><b>THE COUNCIL STRIKES</b><br><small>LAST 36 HOURS \u00B7 TAP \u2715 TWICE \u00B7 TAP A WAVE TO MOVE IT \u00B7 ALL LOGGED</small></div><button class="cm-x" type="button" aria-label="Close">\u2715</button></div><div class="cm-tabs"><button type="button" data-cmt="mark" class="on">MARKS</button><button type="button" data-cmt="drop">JOB DROPS</button></div><div class="cm-list" id="cmList"></div></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click',function(e){ if(e.target===sh||e.target.closest('.cm-x')){ shut(); return; } var t=e.target.closest('[data-cmt]'); if(t){ tab=t.getAttribute('data-cmt'); sh.querySelectorAll('[data-cmt]').forEach(function(x){ x.classList.toggle('on',x===t); }); armed=null; mv=null; paint(); return; }
      var c=e.target.closest('.cm-ph[data-mv]'); if(c){ var id=c.getAttribute('data-mv'); mv=(mv&&mv.ref===id)?null:{ref:id,later:false}; armed=null; paint(); return; }
      var lt=e.target.closest('input[data-mvlater]'); if(lt){ if(mv)mv.later=lt.checked; return; }
      var go=e.target.closest('button[data-mvto]'); if(go){ move(go.getAttribute('data-mvto')); return; }
      var x=e.target.closest('.x[data-ref]'); if(x)strike(x); });
    return sh;
  }
  function shut(){ var sh=document.getElementById('cmSheet'); if(sh)sh.classList.remove('on'); armed=null; mv=null; }
  function open(){ var sh=sheet(); sh.classList.add('on'); paint(); load(); }
  function paint(){
    var el=document.getElementById('cmList'); if(!el)return;
    var list=rows.filter(function(r){ return r.kind===tab; });
    if(!list.length){ el.innerHTML='<div class="cm-empty">'+(tab==='mark'?'No marks on the count in the last 36 hours.':'No job drops in the last 36 hours.')+'</div>'; return; }
    el.innerHTML=list.map(function(r){
      var isArm=armed===r.kind+':'+r.ref;
      var main=r.kind==='mark'?E(r.pos)+(r.cat?' \u00B7 '+E(r.cat):''):'+'+E(r.n)+' '+E(r.cat||'');
      var w=r.kind==='drop'?wave(r):'', open=mv&&r.kind==='drop'&&mv.ref===r.ref;
      var chip=(r.kind==='drop'&&!r.voided)?'<button type="button" class="cm-ph'+(r.ph?'':' clk')+(open?' on':'')+'" data-mv="'+E(r.ref)+'" aria-label="Wave '+E(w)+', tap to move" title="'+(r.ph?'logged as ':'by the clock: ')+E(w)+'">'+E(w)+'</button>':'';
      var row='<div class="cm-row'+(r.voided?' void':'')+'"><div class="tm">'+when(r.ts)+'</div><div class="nn"><b>'+main+'</b><span>'+E(r.by_handle||'a casual')+(r.voided?' \u00B7 already struck':'')+'</span></div>'+chip+(r.voided?'':'<button type="button" class="x'+(isArm?' arm':'')+'" data-ref="'+E(r.ref)+'" data-kind="'+E(r.kind)+'">'+(isArm?'STRIKE':'\u2715')+'</button>')+'</div>';
      if(open){
        var lat=laterSame(r);
        row+='<div class="cm-mv"><div class="r"><small>Move to</small>'+['FLEX','1ST','2ND'].map(function(p){ return '<button type="button" data-mvto="'+p+'"'+(p===w&&!lat.length?' class="cur"':'')+'>'+p+'</button>'; }).join('')+'</div>'+
          (lat.length?'<div class="r"><label><input type="checkbox" data-mvlater'+(mv.later?' checked':'')+'> and the '+lat.length+' later '+E(w)+' drop'+(lat.length===1?'':'s')+' on this board</label></div>':'')+'</div>';
      }
      return row;
    }).join('');
  }
  var mv=null;
  function wave(r){ if(r.ph)return r.ph; try{ return typeof dropPhase==='function'?dropPhase(+r.ts):'?'; }catch(e){ return '?'; } }
  /* later drops on the same board in the same wave (the rest of an early-1st run) */
  function laterSame(r){ var w=wave(r); return rows.filter(function(q){ return q.kind==='drop'&&!q.voided&&q.k===r.k&&q.ref!==r.ref&&+q.ts>+r.ts&&wave(q)===w; }); }
  function move(to){
    if(!mv||busy||!window.SB)return; var r=rows.find(function(q){ return q.kind==='drop'&&q.ref===mv.ref; }); if(!r)return;
    var list=[r].concat(mv.later?laterSame(r):[]).filter(function(q){ return wave(q)!==to; });
    if(!list.length){ mv=null; paint(); return; }
    busy=true;
    window.SB.rpc('council_move_drops',{p_cids:list.map(function(q){ return q.ref; }),p_ph:to}).then(function(res){
      busy=false; if(res.error){ say('\u2717 '+(res.error.message||'the wire kept it')); return; }
      var n=+res.data||list.length; list.forEach(function(q){ q.ph=to; }); mv=null; paint();
      say('\u2713 '+n+' drop'+(n===1?'':'s')+' moved to '+(to==='1ST'?'1st':to==='2ND'?'2nd':'Flex'));
      try{ typeof dwPull==='function'&&dwPull(); }catch(e){} try{ typeof dpRefresh==='function'&&dpRefresh(); }catch(e){}
    },function(){ busy=false; say('\u2717 No connection. Try again.'); });
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
  function check(){ if(!window.SB||!window.__shkUid)return; window.SB.rpc('sc_am_council').then(function(r){ council=!r.error&&r.data===true; if(council){ var b=btn(); if(b)b.classList.add('on'); } else { var x=document.getElementById('cmBtn'); x&&x.remove(); } },function(){}); }
  css();
  try{ var oldB=document.querySelector('#scr-board #cmBtn'); oldB&&oldB.remove(); }catch(e){}
  setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; council=false; var b=document.getElementById('cmBtn'); if(b)b.classList.remove('on'); if(u)setTimeout(check,1500); } },1000);
  new MutationObserver(function(){ if(council){ var b=btn(); if(b)b.classList.add('on'); } }).observe(document.body,{childList:true,subtree:true});
  /* #cmwave (oct 22): when the council moves a drop, every phone repaints the waves (the app's own refresh only watches
     counts and strikes), and the ear who logged it gets the new wave in their own saved log: their phone reads its own
     copy first, so without this it would keep showing the old wave. */
  (function(){
    var sig='';
    function sync(){
      try{
        if(typeof dropKey!=='function')return; var k=dropKey(), wire=(window.DW||{})[k]||[], by={}, s=k+'#', changed=false;
        wire.forEach(function(d){ if(d&&d.cid){ by[d.cid]=d.ph||''; s+=d.cid+':'+(d.ph||'')+','; } });
        if(typeof dropData==='function'&&typeof dropSave==='function'){
          var o=dropData(); (o.drops||[]).forEach(function(x){ var p=x&&x.cid&&by[x.cid]; if(p&&p!==x.ph){ x.ph=p; changed=true; } });
          if(changed)dropSave(o);
        }
        if(s!==sig||changed){ var first=!sig; sig=s; if(!first||changed){ try{ renderDropLog(); }catch(e){} try{ typeof dpRefresh==='function'&&dpRefresh(); }catch(e){} } }
      }catch(e){}
    }
    function wrap(){ var f=window.dwPull; if(typeof f!=='function')return false; if(f.__cm)return true;
      var w=async function(){ var r=await f.apply(this,arguments); sync(); return r; }; w.__cm=true; window.dwPull=w; return true; }
    if(!wrap()){ var t=setInterval(function(){ if(wrap())clearInterval(t); },1000); }
  })();
  window.councilModOpen=open;
})();
