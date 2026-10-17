/* docket_notes.js — #dknotes (oct 17). A note pad on every job in the docket log, for after you've checked in:
   which crane you were on, which lane (1–6), when your breaks are, anything that happened worth remembering.
   Open a job in DOCKETS (tap the row) → the 📝 JOB NOTES block sits under the job's details.
     · CRANE — a short box ("C26", "crane 12")
     · LANE — tap 1–6 (tap again to clear)
     · LUNCH — tap which lunch the job got. Day: EARLY (8–10 & 12–1) · 11–1 · 12–2 · EARLY GO (12–1, home ~2:30).
       Night: EARLY (6–8 & 10–11) · 9–11 · 10–12 · EARLY GO (10–11, home ~12:30). OTHER for a split break (clerks,
       dock, rail) — type it in. Flex is the same lunch, one more hour of work.
     · ⏱ TIME drops the current time into the notes for anything that happened
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
    var empty=!(n.crane||'').trim()&&!n.lane&&!(n.txt||'').trim()&&!n.lunch;
    if(empty)delete a[id]; else { n.at=Date.now(); a[id]=n; }
    try{ localStorage.setItem(k,JSON.stringify(a)); }catch(e){}
  }
  var LUNCH={
    Day:[ ['early','EARLY','8\u201310 & 12\u20131'], ['11-1','11\u20131','11 AM \u2013 1 PM'], ['12-2','12\u20132','12 \u2013 2 PM'], ['go','EARLY GO','12\u20131 \u00B7 home about 2:30'] ],
    Night:[ ['early','EARLY','6\u20138 & 10\u201311'], ['9-11','9\u201311','9 \u2013 11 PM'], ['10-12','10\u201312','10 PM \u2013 12'], ['go','EARLY GO','10\u201311 \u00B7 home about 12:30'] ]
  };
  function shiftOf(id){ try{ var j=(typeof DOCKETS!=='undefined'?DOCKETS:window.DOCKETS||[]).filter(function(x){ return String(x._id)===String(id); })[0]; return j&&j.shift==='Day'?'Day':'Night'; }catch(e){ return 'Day'; } }
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function clock(){ var d=new Date(),h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?' AM':' PM'); }

  var st=document.createElement('style'); st.textContent=
    '.dkn{margin:12px 0 4px;padding:12px;border-radius:12px;background:var(--well,#0b0d0f);border:1px solid var(--line-soft,rgba(220,214,201,.1))}'+
    '.dkn-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.18em;color:var(--copper-hi,#eeb46b)}.dkn-h small{margin-left:auto;font-weight:600;letter-spacing:.06em;color:var(--steel,#8f979e)}'+
    '.dkn-r{display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap}.dkn-l{flex:none;width:48px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.12em;color:var(--steel,#8f979e)}'+
    '.dkn input,.dkn textarea{box-sizing:border-box;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:500 16px Inter,system-ui,sans-serif;padding:8px 10px;outline:none}'+
    '.dkn input:focus,.dkn textarea:focus{border-color:var(--copper-hi,#eeb46b)}.dkn input{flex:1;min-width:0;max-width:180px}.dkn textarea{display:block;width:100%;min-height:96px;resize:vertical;line-height:1.4}'+
    '.dkn-lanes{display:flex;gap:6px;flex:1}.dkn-lane{flex:1;min-width:34px;height:36px;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:700 15px "Barlow Condensed",sans-serif;cursor:pointer}.dkn-lane.on{background:var(--copper-hi,#eeb46b);border-color:var(--copper-hi,#eeb46b);color:var(--void,#0b0d0f)}'+
    '.dkn-lun{display:flex;gap:5px;flex:1;flex-wrap:wrap}.dkn-lun button{flex:1;min-width:58px;height:34px;padding:0 6px;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.06em;cursor:pointer;white-space:nowrap}.dkn-lun button.on{background:var(--copper-hi,#eeb46b);border-color:var(--copper-hi,#eeb46b);color:var(--void,#0b0d0f)}.dkn-lun button.oth{flex:0 0 auto;border-style:dashed}'+
    '.dkn-ld{margin:-4px 0 10px 56px;font:500 12px Inter,system-ui,sans-serif;color:var(--copper-hi,#eeb46b)}.dkn-ld:empty{display:none}'+
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
      '<div class="dkn-r"><span class="dkn-l">LUNCH</span><div class="dkn-lun">'+LUNCH[shiftOf(id)].map(function(o){ return '<button type="button" data-lunch="'+o[0]+'" class="'+(n.lunch===o[0]?'on':'')+'" title="'+E(o[2])+'">'+o[1]+'</button>'; }).join('')+'<button type="button" class="oth'+(n.lunch==='other'?' on':'')+'" data-lunch="other">\u270E OTHER</button></div></div>'+
      '<div class="dkn-ld">'+E(lunchText(id,n))+'</div>'+
      '<div class="dkn-q"><button type="button" data-stamp="">\u23F1 TIME</button></div>'+
      '<textarea class="dkn-txt" maxlength="4000" placeholder="Breaks, reminders, anything that happened\u2026">'+E(n.txt||'')+'</textarea>';
    return d;
  }
  function lunchText(id,n){ if(!n.lunch)return ''; if(n.lunch==='other')return 'Lunch: '+(n.lunchText||'\u2014'); var o=LUNCH[shiftOf(id)].filter(function(x){ return x[0]===n.lunch; })[0]; return o?'Lunch '+o[2]:''; }
  function read(d){ var on=d.querySelector('.dkn-lane.on'); var id=d.getAttribute('data-dkn'), old=get(id); return {crane:d.querySelector('.dkn-crane').value, lane:on?+on.getAttribute('data-lane'):0, txt:d.querySelector('.dkn-txt').value, lunch:old.lunch||'', lunchText:old.lunchText||''}; }
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
    var lu=e.target.closest('[data-lunch]');
    if(lu){ var id2=d.getAttribute('data-dkn'), cur=get(id2), pick=lu.getAttribute('data-lunch');
      if(pick==='other'){ var v=prompt('What was the lunch? (e.g. 10\u201311 & 1\u20132, clerk split)', cur.lunchText||''); if(v==null)return; v=String(v).trim(); cur.lunch=v?'other':''; cur.lunchText=v; }
      else { cur.lunch=cur.lunch===pick?'':pick; cur.lunchText=''; }
      var now=read(d); now.lunch=cur.lunch; now.lunchText=cur.lunchText; put(id2,now);
      d.querySelectorAll('[data-lunch]').forEach(function(b){ b.classList.toggle('on',b.getAttribute('data-lunch')===cur.lunch); });
      var ld=d.querySelector('.dkn-ld'); if(ld)ld.textContent=lunchText(id2,cur); mark(); return; }
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
      /* lives with the dock: right under "⚓ The dock", above "🚢 The ship" (after the radio bar if it's there) */
      var dock=p.querySelector('.jx-sec.jx-dock'), b=block(id);
      if(dock){ var after=dock.nextElementSibling&&dock.nextElementSibling.classList.contains('rb-job')?dock.nextElementSibling:dock; after.parentNode.insertBefore(b,after.nextSibling); }
      else (p.querySelector('.jx')||p).appendChild(b);
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
