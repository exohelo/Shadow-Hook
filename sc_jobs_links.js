/* sc_jobs_links.js — #jobslinks (oct 17). Three fixes on the Chamber's Jobs tab:
     1. ILWU SHEET: "⬇ Download" went to the ilwu13.com front page, not the file. It now opens the board's own
        PDF, built the same way the dispatch bot finds it:
          day board (AM)   → Dispatches/Dayside-Final/MMDDYYD.pdf      (named for that morning)
          night board (PM) → Dispatches/Nightside-Final/MMDDYYN.pdf    (night final)
                           + Dispatches/Day-Night-Early/MMDDYYE.pdf    (early count, its own button)
        Same on the "Put away" row.
     2. PMA SHEET: adds "↗ PMA dispatch list" under "Open PMA in your browser" — PMA's general LA/LB Dispatch
        page, for when the direct link doesn't land on the right sheet.
     3. ILWU SHEET: "⌨ Type every column in" is removed — "✎ Check & correct" does the same job.
   Load once from index.html, after hall_line_bot.js:  <script src="sc_jobs_links.js?v=oct17a" defer></script> */
(function(){
  'use strict';
  if(window.__scJobsLinks)return; window.__scJobsLinks=true;
  var ROOT='https://ilwu13.com/wp-content/uploads/simple-file-list/Dispatches/';
  var PMA_LIST='https://www.pmanet.org/members/bulletins-and-notices/la-lb-dispatch/';
  function pdfs(key){
    var m=/^(\d{4})-(\d{2})-(\d{2})_[A-Za-z]{3}_(AM|PM)$/.exec(String(key||'')); if(!m)return [];
    var stem=m[2]+m[3]+m[1].slice(2);
    return m[4]==='AM'
      ? [{u:ROOT+'Dayside-Final/'+stem+'D.pdf',t:'\u2B07 Day final'}]
      : [{u:ROOT+'Nightside-Final/'+stem+'N.pdf',t:'\u2B07 Night final'},{u:ROOT+'Day-Night-Early/'+stem+'E.pdf',t:'\u2B07 Early count'}];
  }
  function sheetKey(){ try{ var s=window.HOUSE_CHORES&&window.HOUSE_CHORES.sheetKey(); return s&&s.key; }catch(e){ return null; } }
  function fixDownloads(scope,key){
    var list=pdfs(key); if(!list.length)return;
    var b=scope.querySelector('[data-sch="out"]:not([data-jl])'); if(!b)return;
    b.setAttribute('data-jl','1'); b.setAttribute('data-u',list[0].u); b.innerHTML=list[0].t;
    for(var i=1;i<list.length;i++){
      var c=b.cloneNode(false); c.setAttribute('data-u',list[i].u); c.innerHTML=list[i].t; b.parentNode.insertBefore(c,b.nextSibling); b=c;
    }
  }
  function paint(){
    var sh=document.getElementById('scChamber'); if(!sh||!sh.classList.contains('on'))return;
    /* 3. one way to fix the sheet */
    sh.querySelectorAll('[data-sch="enter"][data-w="nums-ilwu"]').forEach(function(b){ b.remove(); });
    /* 1. the real PDFs */
    var key=sheetKey();
    if(key){
      var job=sh.querySelector('.sc-job[data-scjob="sheet"]'); if(job)fixDownloads(job,key);
      sh.querySelectorAll('.sc-away').forEach(function(a){ if(/ILWU sheet/.test(a.textContent||''))fixDownloads(a,key); });
    }
    /* 2. PMA's general dispatch page */
    var pj=sh.querySelector('.sc-job[data-scjob="pma"]');
    if(pj&&!pj.querySelector('[data-jl="pmalist"]')){
      var open=pj.querySelector('.sc-step [data-sch="out"]');
      if(open){
        var g=document.createElement('button'); g.type='button'; g.className='sc-btn ghost sm'; g.setAttribute('data-sch','out');
        g.setAttribute('data-u',PMA_LIST); g.setAttribute('data-jl','pmalist'); g.style.cssText='width:100%;margin-top:6px;box-sizing:border-box';
        g.innerHTML='\u2197 PMA dispatch list';
        open.parentNode.insertBefore(g,open.nextSibling);
      }
    }
  }
  var t=null;
  new MutationObserver(function(){ clearTimeout(t); t=setTimeout(paint,50); }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
})();
