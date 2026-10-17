/* docket_notes.js — #dknotes (oct 17). A note pad on every job in the docket log, for after you've checked in:
   which crane you were on, which lane (1–6), when your breaks are, anything that happened worth remembering.
   Open a job in DOCKETS (tap the row) → the 📝 JOB NOTES block sits under the job's details.
     · CRANE — a short box ("C26", "crane 12")
     · LANE — tap 1–6 (tap again to clear)
     · quick stamps: ☕ BREAK · 🍔 LUNCH · ⏱ TIME drop the current time into the notes ("2:10 PM — Break")
     · the notes box itself — anything else
   Saves as you type. A 📝 on the row means the job has notes. Notes are private to the member and follow their
   account to their other phones (same cloud copy as the docket log). Nothing here is used for scanning or pay.
   Load once from index.html, after sc_jobs_links.js:  <script src="docket_notes.js?v=oct17a" defer></script> */
(function(){
  'use strict';
  if(window.__dkNotes)return; window.__dkNotes=true;
  function key(){ try{ return typeof K==='function'?K('dknotes'):null; }catch(e){ return null; } }
  function all(){ var k=key(); if(!k)return {}; try{ return JSON.parse(localStorage.getItem(k)||'{}')||{}; }catch(e){ return {}; } }
  function get(id){ return all()[id]||{}; }
  function put(id,n){
    var k=key(); if(!k)return; var a=all();
    var empty=!(n.crane||'').trim()&&!n.lane&&!(n.txt||'').trim();
    if(empty)delete a[id]; else { n.at=Date.now(); a[id]=n; }
    try{ localStorage.setItem(k,JSON.stringify(a)); }catch(e){}
  }
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function clock(){ var d=new Date(),h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?' AM':' PM'); }

  var st=document.createElement('style'); st.textContent=
    '.dkn{margin:12px 0 4px;padding:12px;border-radius:12px;background:var(--well,#0b0d0f);border:1px solid var(--line-soft,rgba(220,214,201,.1))}'+
    '.dkn-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.18em;color:var(--copper-hi,#eeb46b)}.dkn-h small{margin-left:auto;font-weight:600;letter-spacing:.06em;color:var(--steel,#8f979e)}'+
    '.dkn-r{display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap}.dkn-l{flex:none;width:48px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.12em;color:var(--steel,#8f979e)}'+
    '.dkn input,.dkn textarea{box-sizing:border-box;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:500 16px Inter,system-ui,sans-serif;padding:8px 10px;outline:none}'+
    '.dkn input:focus,.dkn textarea:focus{border-color:var(--copper-hi,#eeb46b)}.dkn input{flex:1;min-width:0;max-width:180px}.dkn textarea{display:block;width:100%;min-height:96px;resize:vertical;line-height:1.4}'+
    '.dkn-lanes{display:flex;gap:6px;flex:1}.dkn-lane{flex:1;min-width:34px;height:36px;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:700 15px "Barlow Condensed",sans-serif;cursor:pointer}.dkn-lane.on{background:var(--copper-hi,#eeb46b);border-color:var(--copper-hi,#eeb46b);color:var(--void,#0b0d0f)}'+
    '.dkn-q{display:flex;gap:6px;margin:0 0 8px;flex-wrap:wrap}.dkn-q button{height:32px;padding:0 12px;border-radius:16px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:none;color:var(--bone,#dcd6c9);font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.08em;cursor:pointer}'+
    '.dkn-has{font-style:normal;margin-left:6px;font-size:.85em}';
  document.head.appendChild(st);

  function block(id){
    var n=get(id), lanes='';
    for(var i=1;i<=6;i++)lanes+='<button type="button" class="dkn-lane'+(String(n.lane)===String(i)?' on':'')+'" data-lane="'+i+'">'+i+'</button>';
    var d=document.createElement('div'); d.className='dkn'; d.setAttribute('data-dkn',id);
    d.innerHTML='<div class="dkn-h">\uD83D\uDCDD JOB NOTES<small class="dkn-s">only you see these</small></div>'+
      '<div class="dkn-r"><span class="dkn-l">CRANE</span><input type="text" class="dkn-crane" maxlength="24" placeholder="e.g. C26" value="'+E(n.crane||'')+'"></div>'+
      '<div class="dkn-r"><span class="dkn-l">LANE</span><div class="dkn-lanes">'+lanes+'</div></div>'+
      '<div class="dkn-q"><button type="button" data-stamp="Break">\u2615 BREAK</button><button type="button" data-stamp="Lunch">\uD83C\uDF54 LUNCH</button><button type="button" data-stamp="">\u23F1 TIME</button></div>'+
      '<textarea class="dkn-txt" maxlength="4000" placeholder="Breaks, reminders, anything that happened\u2026">'+E(n.txt||'')+'</textarea>';
    return d;
  }
  function read(d){ var on=d.querySelector('.dkn-lane.on'); return {crane:d.querySelector('.dkn-crane').value, lane:on?+on.getAttribute('data-lane'):0, txt:d.querySelector('.dkn-txt').value}; }
  var saveT=null;
  function save(d){
    put(d.getAttribute('data-dkn'),read(d));   /* straight to the phone, so a redraw can't lose a word */
    var s=d.querySelector('.dkn-s'); if(s)s.textContent='saved \u2713';
    clearTimeout(saveT); saveT=setTimeout(mark,400);
  }

  /* events (delegated; the docket row's own click toggle lives on the row, not on this panel) */
  document.addEventListener('input',function(e){ var d=e.target.closest&&e.target.closest('.dkn'); if(d)save(d); });
  document.addEventListener('click',function(e){
    var d=e.target.closest&&e.target.closest('.dkn'); if(!d)return;
    e.stopPropagation();
    var ln=e.target.closest('.dkn-lane');
    if(ln){ var was=ln.classList.contains('on'); d.querySelectorAll('.dkn-lane').forEach(function(b){ b.classList.remove('on'); }); if(!was)ln.classList.add('on'); save(d); return; }
    var q=e.target.closest('[data-stamp]');
    if(q){ var ta=d.querySelector('.dkn-txt'), w=q.getAttribute('data-stamp'), line=clock()+' \u2014 '+(w?w+' ':'');
      var v=ta.value; if(v&&!/\n$/.test(v))v+='\n'; ta.value=v+line; ta.focus(); try{ ta.setSelectionRange(ta.value.length,ta.value.length); }catch(x){} save(d); }
  });

  /* 📝 on rows that have notes; the pad inside each opened job */
  function mark(){
    var list=document.getElementById('docketList'); if(!list)return; var a=all();
    list.querySelectorAll('.jx-row[data-id]').forEach(function(r){
      var has=!!a[r.getAttribute('data-id')], b=r.querySelector('.n b'), i=r.querySelector('.dkn-has');
      if(has&&!i&&b){ i=document.createElement('i'); i.className='dkn-has'; i.title='Has notes'; i.textContent='\uD83D\uDCDD'; b.appendChild(i); }
      else if(!has&&i)i.remove();
    });
  }
  function fill(){
    var list=document.getElementById('docketList'); if(!list)return;
    list.querySelectorAll('.jx-row.lit[data-id]').forEach(function(r){
      var p=r.nextElementSibling; if(!p||p.querySelector('.dkn'))return;
      var id=r.getAttribute('data-id'); if(!id)return;
      (p.querySelector('.jx')||p).appendChild(block(id));
    });
    mark();
  }
  var t=null;
  function hook(){
    var list=document.getElementById('docketList'); if(!list){ setTimeout(hook,1000); return; }
    new MutationObserver(function(){ clearTimeout(t); t=setTimeout(fill,40); }).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    fill();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook); else hook();
  window.docketNotes=function(id){ return id?get(id):all(); };
})();
