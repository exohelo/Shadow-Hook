/* hand_counts.js — #handcount (oct 30). The hall's hand count of jobs that came down, by job type, typed in
   from the binder photos. Keymaster only. Adds a ✍ HAND COUNT box to Profile (above Size): pick the date and
   AM/PM, type Basic Longshore · UTR · Basic Clerk · Key Clerk — the total fills itself (or type the box's
   total if the sheet's total differs from the sum). SAVE writes hall_counts + board_history via hand_count_put;
   the last 14 entries show underneath, each with what the board actually moved. Tap an entry to edit it.
   Nothing here touches the Wire's call; the counts sharpen the jobs-per-letter rate the next time it's refit.
   Load once from index.html, after theme_switch.js:  <script src="hand_counts.js?v=oct30a" defer></script> */
(function(){
  'use strict';
  if(window.__handCounts)return; window.__handCounts=true;
  var say=function(m){ try{ toast(m); }catch(e){} };
  var can=null, lastUid=null;
  var DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  function keyFor(iso,sh){ var d=new Date(iso+'T12:00:00'); return iso+'_'+DOW[d.getDay()]+'_'+sh; }
  function todayISO(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function css(){ if(document.getElementById('hcCSS'))return; var s=document.createElement('style'); s.id='hcCSS'; s.textContent=
    '#hcBox .hc-row{display:flex;gap:8px;margin-top:8px}#hcBox .hc-row>*{flex:1;min-width:0}'+
    '#hcBox input,#hcBox select{width:100%;height:38px;border-radius:9px;border:1px solid rgba(220,214,201,.18);background:#0b0d0f;color:#dcd6c9;padding:0 10px;font:600 14px Inter,system-ui,sans-serif;box-sizing:border-box}'+
    '#hcBox label{display:block;font:600 10px Inter,system-ui,sans-serif;letter-spacing:.1em;color:#8f979e;margin-bottom:3px;text-transform:uppercase}'+
    '#hcBox .hc-sh{display:flex;gap:6px}#hcBox .hc-sh button{flex:1;height:38px;border-radius:9px;border:1px solid rgba(220,214,201,.14);background:#14171a;color:#8f979e;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer}#hcBox .hc-sh button.on{color:#eeb46b;border-color:rgba(238,180,107,.5)}'+
    '#hcBox .hc-save{width:100%;margin-top:10px}#hcBox .hc-list{margin-top:10px}#hcBox .hc-it{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:#0b0d0f;border:1px solid rgba(220,214,201,.07);margin-bottom:5px;cursor:pointer}'+
    '#hcBox .hc-it b{font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.04em;color:#dcd6c9;flex:none;width:112px}#hcBox .hc-it span{font-size:12px;color:#8f979e;flex:1}#hcBox .hc-it i{font:700 13px "Barlow Condensed",sans-serif;color:#eeb46b;font-style:normal}'+
    '#hcBox .hc-del{margin-top:6px;background:none;border:0;color:#e8967a;font:600 11px Inter,system-ui,sans-serif;letter-spacing:.1em;cursor:pointer;display:none}';
    document.head.appendChild(s); }
  var sh='AM';
  function box(){
    var size=document.getElementById('sizeBox'); if(!size||document.getElementById('hcBox')||!can)return;
    css();
    var b=document.createElement('div'); b.className='albox'; b.id='hcBox';
    b.innerHTML='<h4>\u270D Hand count</h4><div class="als" style="margin-bottom:4px">Jobs that came down, from the binder. Total fills itself; change it if the sheet\u2019s box says otherwise.</div>'+
      '<div class="hc-row"><div><label>Date</label><input type="date" id="hcDate"></div><div><label>Board</label><div class="hc-sh"><button type="button" data-sh="AM" class="on">DAY</button><button type="button" data-sh="PM">NIGHT</button></div></div></div>'+
      '<div class="hc-row"><div><label>Longshore</label><input type="number" inputmode="numeric" id="hcL" min="0"></div><div><label>UTR</label><input type="number" inputmode="numeric" id="hcU" min="0"></div></div>'+
      '<div class="hc-row"><div><label>Basic clerk</label><input type="number" inputmode="numeric" id="hcB" min="0"></div><div><label>Key clerk</label><input type="number" inputmode="numeric" id="hcK" min="0"></div></div>'+
      '<div class="hc-row"><div><label>Total</label><input type="number" inputmode="numeric" id="hcT" min="0" placeholder="sum"></div></div>'+
      '<button type="button" class="btn hc-save" id="hcSave">SAVE COUNT</button><button type="button" class="hc-del" id="hcDel">REMOVE THIS ENTRY</button>'+
      '<div class="hc-list" id="hcList"></div>';
    size.parentNode.insertBefore(b,size);
    b.querySelector('#hcDate').value=todayISO();
    b.querySelector('#hcDate').max=todayISO();
    b.addEventListener('click',function(e){
      var t=e.target.closest('[data-sh]'); if(t){ sh=t.getAttribute('data-sh'); b.querySelectorAll('[data-sh]').forEach(function(x){ x.classList.toggle('on',x===t); }); fill(); return; }
      var it=e.target.closest('.hc-it'); if(it){ var k=it.getAttribute('data-k'); b.querySelector('#hcDate').value=k.slice(0,10); sh=k.slice(-2); b.querySelectorAll('[data-sh]').forEach(function(x){ x.classList.toggle('on',x.getAttribute('data-sh')===sh); }); fill(); return; }
      if(e.target.id==='hcSave')save(false);
      if(e.target.id==='hcDel'&&confirm('Remove this hand count?'))save(true);
    });
    ['hcL','hcU','hcB','hcK'].forEach(function(id){ b.querySelector('#'+id).addEventListener('input',sum); });
    b.querySelector('#hcDate').addEventListener('change',fill);
    list();
  }
  var recent=[];
  function num(id){ var v=document.getElementById(id).value; return v===''?null:+v; }
  function sum(){ var t=document.getElementById('hcT'); var s=(num('hcL')||0)+(num('hcU')||0)+(num('hcB')||0)+(num('hcK')||0); t.placeholder=String(s); if(!t.__typed)t.value=s||''; }
  function fill(){
    var k=keyFor(document.getElementById('hcDate').value,sh), r=recent.filter(function(x){ return x.k===k; })[0];
    ['hcL','hcU','hcB','hcK','hcT'].forEach(function(id,i){ var el=document.getElementById(id); el.value=r?(r[['longshore','utr','basic_clerk','key_clerk','total'][i]]==null?'':r[['longshore','utr','basic_clerk','key_clerk','total'][i]]):''; el.__typed=false; });
    document.getElementById('hcDel').style.display=r?'block':'none';
    document.getElementById('hcSave').textContent=r?'UPDATE COUNT':'SAVE COUNT';
  }
  function save(del){
    if(!window.SB)return; var iso=document.getElementById('hcDate').value; if(!iso){ say('Pick the date'); return; }
    var k=keyFor(iso,sh), p={longshore:num('hcL'),utr:num('hcU'),basic_clerk:num('hcB'),key_clerk:num('hcK'),total:num('hcT')};
    if(del)p={'delete':'1'}; else if(p.longshore==null&&p.utr==null&&p.basic_clerk==null&&p.key_clerk==null&&p.total==null){ say('Type the numbers first'); return; }
    var btn=document.getElementById('hcSave'); btn.disabled=true;
    window.SB.rpc('hand_count_put',{p_key:k,p:p}).then(function(r){ btn.disabled=false;
      if(r.error||!r.data||!r.data.ok){ say('\u2717 '+((r.data&&r.data.why)||(r.error&&r.error.message)||'not saved')); return; }
      say(del?'Removed':'\u2713 '+k.replace(/_/g,' ')+' \u00B7 '+r.data.total+' jobs'+(r.data.in_history?'':' (board not on the record yet \u2014 it joins when the end card lands)'));
      list();
    },function(){ btn.disabled=false; say('\u2717 No connection. Try again.'); });
  }
  function list(){
    if(!window.SB)return;
    window.SB.rpc('hand_count_recent').then(function(r){ if(r.error||!Array.isArray(r.data))return; recent=r.data;
      var el=document.getElementById('hcList'); if(!el)return;
      el.innerHTML=recent.map(function(x){ var d=x.k.slice(5,10).replace('-','/'), lbl=d+' '+(x.k.slice(-2)==='AM'?'day':'night');
        return '<div class="hc-it" data-k="'+x.k+'"><b>'+lbl+'</b><span>'+[x.longshore,x.utr,x.basic_clerk,x.key_clerk].map(function(v){ return v==null?'\u2013':v; }).join(' \u00B7 ')+'</span><i>'+x.total+(x.moved!=null?' \u00B7 '+x.moved+'L':'')+'</i></div>'; }).join('')||'<div class="als">No counts yet.</div>';
      fill();
    });
  }
  document.addEventListener('input',function(e){ if(e.target&&e.target.id==='hcT')e.target.__typed=e.target.value!==''; });
  function check(){ if(!window.SB||!window.__shkUid){ can=false; return; } window.SB.rpc('hand_count_can').then(function(r){ can=!r.error&&r.data===true; if(can)box(); else { var b=document.getElementById('hcBox'); b&&b.remove(); } },function(){}); }
  setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; can=null; var b=document.getElementById('hcBox'); b&&b.remove(); if(u)setTimeout(check,1500); } },1000);
  new MutationObserver(function(){ if(can&&!document.getElementById('hcBox'))box(); }).observe(document.body,{childList:true,subtree:true});
})();
