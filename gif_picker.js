/* gif_picker.js — #gifs (oct 22). A 🎞 GIF button in the Chamber's attach tray (beside Link and YouTube).
   Tap it → a sheet with a search box and a grid of GIFs from Tenor. Tap a GIF and it posts to the table right away,
   with whatever is typed in the message box as the caption. The GIF goes out as an image attachment (sc_say,
   media [{kind:"image"}]), so it shows up, plays and opens in the lightbox like a photo — no server change.
   SETUP (once): a free Tenor API key from https://developers.google.com/tenor — paste it into TENOR_KEY below
   (or set window.SHK_TENOR_KEY before this script loads). Until then the button says the key is missing.
   Load once from index.html, after chamber_sheet.js:  <script src="gif_picker.js?v=oct22b" defer></script> */
(function(){
  'use strict';
  if(window.__gifPicker)return; window.__gifPicker=true;
  var TENOR_KEY='';                          /* ← paste the Tenor key here */
  var CLIENT='shadowhook', LIMIT=24, FILTER='medium';   /* Tenor content filter: off | low | medium | high */
  var key=function(){ return String(window.SHK_TENOR_KEY||TENOR_KEY||'').trim(); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

  var st=document.createElement('style'); st.id='gifCSS'; st.textContent=
    '#gifSheet{position:fixed;inset:0;z-index:430;display:none;background:#05060aeb;align-items:flex-end;justify-content:center}#gifSheet.on{display:flex}'+
    '#gifSheet .g-in{width:100%;max-width:520px;height:78%;display:flex;flex-direction:column;border-radius:18px 18px 0 0;background:linear-gradient(180deg,#2a0f18,#12060a);border:1px solid rgba(238,180,107,.25);border-bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}'+
    '#gifSheet .g-h{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}#gifSheet .g-h b{font:400 18px Cinzel,Georgia,serif;letter-spacing:.06em;color:#eeb46b}#gifSheet .g-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:#000a;color:#fff;cursor:pointer;font-size:16px}'+
    '#gifSheet .g-s{display:flex;gap:8px;padding:0 14px 10px}#gifSheet .g-s input{flex:1;min-width:0;height:40px;border-radius:12px;border:1px solid rgba(238,180,107,.3);background:rgba(0,0,0,.35);color:#f3e9d8;padding:0 12px;font:500 15px Inter,system-ui,sans-serif;outline:0}'+
    '#gifSheet .g-s button{height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(238,180,107,.45);background:#3a1620;color:#eeb46b;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer}'+
    '#gifSheet .g-grid{flex:1;overflow:auto;padding:0 10px 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-content:start;-webkit-overflow-scrolling:touch}'+
    '#gifSheet .g-grid button{all:unset;cursor:pointer;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#1d0a10;position:relative}#gifSheet .g-grid button img{width:100%;height:100%;object-fit:cover;display:block}'+
    '#gifSheet .g-grid button.busy{opacity:.45}#gifSheet .g-note{grid-column:1/-1;padding:28px 10px;text-align:center;color:#b89a7a;font:500 14px Inter,system-ui,sans-serif;line-height:1.5}'+
        /* a GIF in the table shows whole, not cropped like a photo */
    '#scChamber .sc-att.img .ph img[src*="tenor.com"]{object-fit:contain;background:#000}';
  document.head.appendChild(st);

  /* ---------- the button in the tray ---------- */
  function addButton(){
    var tray=document.getElementById('scTray'); if(!tray||tray.querySelector('[data-scc="att-gif"]'))return;
    var b=document.createElement('button'); b.type='button'; b.setAttribute('data-scc','att-gif'); b.innerHTML='<i>\uD83C\uDF9E</i>GIF';
    var yt=tray.querySelector('[data-scc="att-yt"]'); yt?yt.parentNode.insertBefore(b,yt.nextSibling):tray.appendChild(b);
  }
  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('#scChamber [data-scc="att-gif"]'); if(!b)return;
    ev.preventDefault(); ev.stopImmediatePropagation(); open();
  },true);

  /* ---------- the sheet ---------- */
  var q='', timer=null, posting=false;
  function sheet(){
    var sh=document.getElementById('gifSheet'); if(sh)return sh;
    sh=document.createElement('div'); sh.id='gifSheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true');
    sh.innerHTML='<div class="g-in"><div class="g-h"><b>\uD83C\uDF9E A GIF FOR THE TABLE</b><button class="g-x" type="button" aria-label="Close">\u2715</button></div>'+
      '<div class="g-s"><input id="gifQ" type="search" placeholder="Search Tenor GIFs\u2026" autocomplete="off" enterkeyhint="search"><button type="button" id="gifGo">SEARCH</button></div>'+
      '<div class="g-grid" id="gifGrid"></div></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click',function(e){
      if(e.target===sh||e.target.closest('.g-x')){ shut(); return; }
      if(e.target.closest('#gifGo')){ search(); return; }
      var p=e.target.closest('button[data-gif]'); if(p)pick(p);
    });
    var inp=sh.querySelector('#gifQ');
    inp.addEventListener('input',function(){ clearTimeout(timer); timer=setTimeout(search,350); });
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); clearTimeout(timer); search(); } if(e.key==='Escape')shut(); });
    return sh;
  }
  function open(){
    var sh=sheet(); sh.classList.add('on');
    if(!key()){ grid('<div class="g-note">No Tenor key yet.<br>Keymaster: paste the key into gif_picker.js (TENOR_KEY) and upload it.</div>'); return; }
    var inp=sh.querySelector('#gifQ'); inp.value=q; setTimeout(function(){ try{ inp.focus(); }catch(e){} },50);
    search();
  }
  function shut(){ var sh=document.getElementById('gifSheet'); sh&&sh.classList.remove('on'); }
  function grid(html){ var g=document.getElementById('gifGrid'); if(g)g.innerHTML=html; }

  var seq=0;
  function search(){
    var sh=document.getElementById('gifSheet'); if(!sh||!sh.classList.contains('on'))return;
    q=(sh.querySelector('#gifQ').value||'').trim();
    var k=key(); if(!k)return;
    var url=(q?'https://tenor.googleapis.com/v2/search?q='+encodeURIComponent(q)+'&':'https://tenor.googleapis.com/v2/featured?')+
      'key='+encodeURIComponent(k)+'&client_key='+CLIENT+'&limit='+LIMIT+'&media_filter=gif,tinygif&contentfilter='+FILTER;
    var my=++seq; grid('<div class="g-note">Looking\u2026</div>');
    fetch(url).then(function(r){ if(!r.ok)throw new Error(r.status===401||r.status===403?'Tenor rejected the key':'Tenor is not answering ('+r.status+')'); return r.json(); }).then(function(j){
      if(my!==seq)return;
      var rows=(j&&j.results||[]).map(function(r){ var mf=r.media_formats||{}, full=mf.gif||mf.tinygif, tiny=mf.tinygif||mf.gif; if(!full||!full.url)return ''; return '<button type="button" data-gif="'+E(full.url)+'" data-thumb="'+E(tiny.url)+'" data-title="'+E(r.content_description||r.title||'GIF')+'" aria-label="'+E(r.content_description||'GIF')+'"><img src="'+E(tiny.url)+'" alt="" loading="lazy"></button>'; }).join('');
      grid(rows||'<div class="g-note">Nothing for \u201C'+E(q)+'\u201D. Try another word.</div>');
    }).catch(function(e){ if(my===seq)grid('<div class="g-note">'+E(e&&e.message||'No connection')+'</div>'); });
  }

  /* ---------- post it ---------- */
  function pick(btn){
    if(posting||!window.SB)return;
    var url=btn.getAttribute('data-gif'), thumb=btn.getAttribute('data-thumb')||url, title=btn.getAttribute('data-title')||'GIF';
    var box=document.getElementById('scSay'), txt=box&&box.value.trim()||'';
    posting=true; btn.classList.add('busy');
    window.SB.rpc('sc_say',{p_body:txt,p_media:[{kind:'image',url:url,thumb:thumb,name:title.slice(0,80)}]}).then(function(r){
      posting=false;
      if(r.error){ btn.classList.remove('busy'); say('\u2717 '+(r.error.message||'the table didn\u2019t take it')); return; }
      if(box)box.value=''; try{ var tr=document.getElementById('scTray'); tr&&tr.classList.remove('on'); }catch(e){}
      shut(); try{ navigator.vibrate&&navigator.vibrate([12]); }catch(e){}
      try{ typeof window.scReload==='function'&&window.scReload(); }catch(e){}
    },function(e){ posting=false; btn.classList.remove('busy'); say('\u2717 No connection. Try again.'); });
  }

  new MutationObserver(function(){ addButton(); }).observe(document.documentElement,{childList:true,subtree:true});
  addButton();
})();
