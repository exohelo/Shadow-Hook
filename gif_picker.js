/* gif_picker.js — #gifs (oct 22d). A 🎞 GIF button in the Chamber's attach tray (beside Link and YouTube).
   Tap it → a sheet with a search box and a grid of GIFs. Tap a GIF and it posts to the table right away,
   with whatever is typed in the message box as the caption. The GIF goes out as an image attachment (sc_say,
   media [{kind:"image"}]), so it shows up, plays and opens in the lightbox like a photo — no server change.
   oct22c: Tenor's API was shut down by Google (no new keys since Jan 13 2026, requests fail since Jun 30 2026).
   The picker now uses KLIPY (free, the usual Tenor replacement) or GIPHY — whichever key is set, KLIPY first.
   SETUP (once), either one:
     KLIPY: free key at https://klipy.com/developers → paste into KLIPY_KEY below
     GIPHY: key at https://developers.giphy.com      → paste into GIPHY_KEY below
   (or set window.SHK_KLIPY_KEY / window.SHK_GIPHY_KEY before this script loads).
   Until a key is set, members don't see the GIF button at all; the Keymaster sees it with a setup note.
   Load once from index.html, after chamber_sheet.js:  <script src="gif_picker.js?v=oct22d" defer></script> */
(function(){
  'use strict';
  if(window.__gifPicker)return; window.__gifPicker=true;
  var KLIPY_KEY='ohQ3SvGCdWnGKTkxpafXpLZ48T5sV7Z2VLyKLisMzKp79RrM3QJvHi0BR5uw2C4v';   /* KLIPY key (ShadowHook-WEB, test tier) */
  var GIPHY_KEY='';                          /* ← or a GIPHY key here */
  var LIMIT=24, RATING='pg-13';              /* GIPHY content rating: g | pg | pg-13 | r */
  function kKey(){ return String(window.SHK_KLIPY_KEY||KLIPY_KEY||'').trim(); }
  function gKey(){ return String(window.SHK_GIPHY_KEY||GIPHY_KEY||'').trim(); }
  function prov(){ return kKey()?'klipy':gKey()?'giphy':''; }
  var NAME={klipy:'KLIPY',giphy:'GIPHY'};
  var say=function(m){ try{ toast(m); }catch(e){} };
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  /* KLIPY asks for a customer id: a random id per phone, never the member's account id */
  function cid(){ try{ var v=localStorage.getItem('shk_gif_cid'); if(!v){ v='p'+Math.random().toString(36).slice(2,12); localStorage.setItem('shk_gif_cid',v); } return v; }catch(e){ return 'shk'; } }

  var st=document.createElement('style'); st.id='gifCSS'; st.textContent=
    '#gifSheet{position:fixed;inset:0;z-index:430;display:none;background:#05060aeb;align-items:flex-end;justify-content:center}#gifSheet.on{display:flex}'+
    '#gifSheet .g-in{width:100%;max-width:520px;height:78%;display:flex;flex-direction:column;border-radius:18px 18px 0 0;background:linear-gradient(180deg,#2a0f18,#12060a);border:1px solid rgba(238,180,107,.25);border-bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}'+
    '#gifSheet .g-h{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}#gifSheet .g-h b{font:400 18px Cinzel,Georgia,serif;letter-spacing:.06em;color:#eeb46b}#gifSheet .g-x{margin-left:auto;width:32px;height:32px;border-radius:50%;border:0;background:#000a;color:#fff;cursor:pointer;font-size:16px}'+
    '#gifSheet .g-s{display:flex;gap:8px;padding:0 14px 10px}#gifSheet .g-s input{flex:1;min-width:0;height:40px;border-radius:12px;border:1px solid rgba(238,180,107,.3);background:rgba(0,0,0,.35);color:#f3e9d8;padding:0 12px;font:500 15px Inter,system-ui,sans-serif;outline:0}'+
    '#gifSheet .g-s button{height:40px;padding:0 14px;border-radius:12px;border:1px solid rgba(238,180,107,.45);background:#3a1620;color:#eeb46b;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer}'+
    '#gifSheet .g-grid{flex:1;overflow:auto;padding:0 10px 12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;align-content:start;-webkit-overflow-scrolling:touch}'+
    '#gifSheet .g-grid button{all:unset;cursor:pointer;aspect-ratio:1;border-radius:10px;overflow:hidden;background:#1d0a10;position:relative}#gifSheet .g-grid button img{width:100%;height:100%;object-fit:cover;display:block}'+
    '#gifSheet .g-grid button:focus-visible{outline:2px solid #eeb46b;outline-offset:2px}'+
    '#gifSheet .g-grid button.busy{opacity:.45}#gifSheet .g-note{grid-column:1/-1;padding:28px 10px;text-align:center;color:#b89a7a;font:500 14px Inter,system-ui,sans-serif;line-height:1.5}'+
    /* a GIF in the table shows whole, not cropped like a photo */
    '#scChamber .sc-att.img .ph img[src*="klipy.com"],#scChamber .sc-att.img .ph img[src*="giphy.com"],#scChamber .sc-att.img .ph img[src*="tenor.com"]{object-fit:contain;background:#000}';
  document.head.appendChild(st);

  /* ---------- the button in the tray (members only see it once a key is set) ---------- */
  function addButton(){
    var tray=document.getElementById('scTray'); if(!tray)return;
    var have=tray.querySelector('[data-scc="att-gif"]'), show=!!prov()||!!window.__isKM;
    if(!show){ if(have)have.remove(); return; }
    if(have)return;
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
    sh=document.createElement('div'); sh.id='gifSheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true'); sh.setAttribute('aria-label','Pick a GIF');
    sh.innerHTML='<div class="g-in"><div class="g-h"><b>\uD83C\uDF9E A GIF FOR THE TABLE</b><button class="g-x" type="button" aria-label="Close">\u2715</button></div>'+
      '<div class="g-s"><input id="gifQ" type="search" placeholder="Search GIFs\u2026" autocomplete="off" enterkeyhint="search"><button type="button" id="gifGo">SEARCH</button></div>'+
      '<div class="g-grid" id="gifGrid"></div></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click',function(e){
      if(e.target===sh||e.target.closest('.g-x')){ shut(); return; }
      if(e.target.closest('#gifGo')){ search(); return; }
      var p=e.target.closest('button[data-gif]'); if(p)pick(p);
    });
    sh.addEventListener('keydown',function(e){ if(e.key==='Escape')shut(); });
    var inp=sh.querySelector('#gifQ');
    inp.addEventListener('input',function(){ clearTimeout(timer); timer=setTimeout(search,350); });
    inp.addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); clearTimeout(timer); search(); } });
    return sh;
  }
  function open(){
    var sh=sheet(), p=prov(); sh.classList.add('on');
    var inp=sh.querySelector('#gifQ');
    /* attribution lives in the search box, as both services allow */
    inp.placeholder=p?'Search '+NAME[p]+'\u2026':'Search GIFs\u2026';
    if(!p){ grid('<div class="g-note">No GIF key yet (Tenor\u2019s API was shut down by Google).<br>Get a free key at klipy.com/developers and paste it into gif_picker.js (KLIPY_KEY).<br><span style="opacity:.7">Members don\u2019t see the GIF button until a key is set.</span></div>'); return; }
    inp.value=q; setTimeout(function(){ try{ inp.focus(); }catch(e){} },50);
    search();
  }
  function shut(){ var sh=document.getElementById('gifSheet'); sh&&sh.classList.remove('on'); }
  function grid(html){ var g=document.getElementById('gifGrid'); if(g)g.innerHTML=html; }

  /* ---------- providers: each returns [{full,thumb,title}] ---------- */
  function urlFor(p,q){
    if(p==='klipy'){
      var base='https://api.klipy.com/api/v1/'+encodeURIComponent(kKey())+'/gifs/';
      return base+(q?'search?q='+encodeURIComponent(q)+'&':'trending?')+'page=1&per_page='+LIMIT+'&customer_id='+encodeURIComponent(cid())+'&locale=en';
    }
    return 'https://api.giphy.com/v1/gifs/'+(q?'search?q='+encodeURIComponent(q)+'&':'trending?')+'api_key='+encodeURIComponent(gKey())+'&limit='+LIMIT+'&rating='+RATING+'&bundle=messaging_non_clips';
  }
  function rowsOf(p,j){
    var out=[];
    if(p==='klipy'){
      var d=j&&j.data, list=Array.isArray(d)?d:(d&&Array.isArray(d.data)?d.data:[]);
      list.forEach(function(it){
        if(!it||it.type==='ad'||!it.file)return;   /* skip KLIPY ad tiles */
        var f=it.file, g=function(s){ return f[s]&&f[s].gif&&f[s].gif.url||''; };
        var full=g('md')||g('hd')||g('sm'), thumb=g('sm')||g('xs')||full;
        if(full)out.push({full:full,thumb:thumb,title:it.title||'GIF'});
      });
    } else {
      (j&&j.data||[]).forEach(function(it){
        var im=it&&it.images||{}, u=function(k){ return im[k]&&im[k].url||''; };
        var full=u('downsized_medium')||u('downsized')||u('original'), thumb=u('fixed_width_small')||u('fixed_width')||full;
        if(full)out.push({full:full,thumb:thumb,title:it.alt_text||it.title||'GIF'});
      });
    }
    return out;
  }

  var seq=0;
  function search(){
    var sh=document.getElementById('gifSheet'); if(!sh||!sh.classList.contains('on'))return;
    var p=prov(); if(!p)return;
    q=(sh.querySelector('#gifQ').value||'').trim();
    var my=++seq; grid('<div class="g-note">Looking\u2026</div>');
    fetch(urlFor(p,q)).then(function(r){
      if(!r.ok)throw new Error(r.status===401||r.status===403?NAME[p]+' rejected the key':r.status===429?NAME[p]+' is busy. Try again in a minute.':NAME[p]+' is not answering ('+r.status+')');
      return r.json();
    }).then(function(j){
      if(my!==seq)return;
      var rows=rowsOf(p,j).map(function(r){ return '<button type="button" data-gif="'+E(r.full)+'" data-thumb="'+E(r.thumb)+'" data-title="'+E(r.title)+'" aria-label="'+E(r.title)+'"><img src="'+E(r.thumb)+'" alt="" loading="lazy"></button>'; }).join('');
      grid(rows||(q?'<div class="g-note">Nothing for \u201C'+E(q)+'\u201D. Try another word.</div>':'<div class="g-note">Type a word to search.</div>'));
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
    },function(){ posting=false; btn.classList.remove('busy'); say('\u2717 No connection. Try again.'); });
  }

  /* watch for the Chamber's tray; throttled so it isn't run on every DOM change */
  var mt=null;
  new MutationObserver(function(){ if(mt)return; mt=setTimeout(function(){ mt=null; addButton(); },300); }).observe(document.body,{childList:true,subtree:true});
  addButton();
})();
