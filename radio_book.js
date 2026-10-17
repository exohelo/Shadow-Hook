/* radio_book.js — #radio (oct 17). The Order's radio book: which ZONE and CHANNEL to tune for each dock.
   Every member adds what they learn on a job; everyone sees it; a ✓ says it's right, a 🚩 says it's wrong.
   The book is locked to each dock (zones and channels differ by port and terminal), so you pick the dock first.
     · open it: 📻 RADIO BOOK at the top of THE PORTS, or 📻 RADIO on any job in your docket log (opens on that dock)
     · each line: TITLE (Dock Boss, Discharge, Loadout, Flip line, Dock work, Rails, Clerks, Trans, Top, Security,
       PowerShop, Supercargo, Dispatch, or your own) · ZONE · CHANNEL · crane it goes with (if any) · call sign ·
       note · who added it · ✓ n · 🚩 n
     · a line with 3+ flags (more flags than ✓s) drops out of the list; the Keymaster can strike any line
     · the list is live: a channel someone adds on the dock shows up on every phone
   Tables: radio_channels, radio_votes · RPC radio_vote, radio_my_votes.
   Load once from index.html, after docket_notes.js:  <script src="radio_book.js?v=oct17a" defer></script> */
(function(){
  'use strict';
  if(window.__radioBook)return; window.__radioBook=true;
  var TITLES=['Dock Boss','Discharge','Loadout','Flip line','Dock work','Rails','Clerks','Trans','Top','Security','PowerShop','Supercargo','Other'];
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var dock=null, rows=[], mine={}, busy=false, rt=null, filt='';

  var HUE={'Dock Boss':'#eeb46b','Dispatch':'#eeb46b','Supercargo':'#eeb46b','Discharge':'#9fe870','Loadout':'#6cc7ff','Flip line':'#6cc7ff','Dock work':'#5dcaa5','Rails':'#5dcaa5','Clerks':'#b9a6ff','Trans':'#f0997b','Top':'#f0997b','Security':'#ff6b6b','PowerShop':'#ffb347'};
  function hue(t){ return HUE[t]||'#c9c3b6'; }
  var st=document.createElement('style'); st.textContent=
    '@keyframes rbIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes rbLed{0%,100%{opacity:1}50%{opacity:.35}}@keyframes rbUp{from{transform:translateY(100%)}to{transform:none}}'+
    '#rbBtn{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 12px;padding:12px 14px;border-radius:14px;border:1px solid rgba(238,180,107,.4);background:linear-gradient(184deg,#241a12,#120d0a);color:#dcd6c9;cursor:pointer;text-align:left;box-shadow:inset 0 1px 0 #ffffff12}#rbBtn .ic{flex:none;width:40px;height:40px;border-radius:12px;background:radial-gradient(circle at 30% 30%,#2b2114,#0b0d0f);border:1px solid rgba(238,180,107,.35);display:flex;align-items:center;justify-content:center;font-size:20px}#rbBtn b{display:block;font:700 13px "Barlow Condensed",sans-serif;letter-spacing:.16em;color:#eeb46b}#rbBtn span{display:block;font:500 12px Inter,system-ui,sans-serif;color:#8f979e;margin-top:2px}#rbBtn i{margin-left:auto;font-style:normal;color:#eeb46b;font-size:18px}'+
    '.rb-job{display:flex;align-items:center;gap:10px;width:100%;margin:10px 0 0;padding:10px 12px;border-radius:12px;border:1px solid rgba(238,180,107,.35);background:linear-gradient(184deg,#1f170f,#0f0c08);color:#dcd6c9;cursor:pointer;text-align:left}.rb-job b{font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.14em;color:#eeb46b}.rb-job span{font:500 12px Inter,system-ui,sans-serif;color:#8f979e;margin-left:auto}'+
    '#rbSheet{position:fixed;inset:0;z-index:430;display:none;background:#05060aeb;align-items:flex-end;justify-content:center}#rbSheet.on{display:flex}'+
    '#rbSheet .rb-in{width:100%;max-width:520px;height:94%;display:flex;flex-direction:column;border-radius:22px 22px 0 0;background:#0b0d10;border:1px solid rgba(238,180,107,.22);border-bottom:0;overflow:hidden;animation:rbUp .28s cubic-bezier(.2,.8,.2,1)}'+
    /* the faceplate */
    '#rbSheet .rb-h{flex:none;padding:10px 16px 0;background:linear-gradient(180deg,#23272c 0%,#15181c 55%,#0f1114 100%);border-bottom:1px solid rgba(238,180,107,.18);position:relative}#rbSheet .rb-h:before{content:"";position:absolute;left:0;right:0;top:46px;height:8px;background:repeating-linear-gradient(90deg,transparent 0 9px,rgba(238,180,107,.18) 9px 10px),repeating-linear-gradient(90deg,transparent 0 49px,rgba(238,180,107,.45) 49px 50px);background-size:10px 100%,50px 100%;pointer-events:none;opacity:.8}'+
    '#rbSheet .rb-grab{width:40px;height:4px;border-radius:2px;background:rgba(220,214,201,.25);margin:0 auto 10px}'+
    '#rbSheet .rb-t{display:flex;align-items:center;gap:10px;position:relative;z-index:1}#rbSheet .rb-t b{font:400 21px Anton,sans-serif;letter-spacing:.07em;color:#f2ead8;text-shadow:0 1px 0 #000}#rbSheet .rb-live{display:inline-flex;align-items:center;gap:5px;font:700 9px Inter,system-ui,sans-serif;letter-spacing:.18em;color:#9fe870;margin-left:4px}#rbSheet .rb-live:before{content:"";width:6px;height:6px;border-radius:50%;background:#9fe870;box-shadow:0 0 8px #9fe870;animation:rbLed 1.6s infinite}#rbSheet .rb-x{margin-left:auto;flex:none;width:32px;height:32px;border-radius:50%;border:1px solid #ffffff1c;background:#ffffff10;color:#fff;cursor:pointer}'+
    '#rbSheet .rb-dock{position:relative;margin:18px 0 0}#rbSheet .rb-dock select{box-sizing:border-box;width:100%;appearance:none;-webkit-appearance:none;border-radius:12px;border:1px solid rgba(238,180,107,.5);background:linear-gradient(180deg,#0a0c08,#121409);color:#ffd27a;font:700 15px "Barlow Condensed",sans-serif;letter-spacing:.12em;padding:12px 40px 12px 44px;outline:none;box-shadow:inset 0 2px 10px #000c,0 0 0 3px #eeb46b14;text-shadow:0 0 10px #ffd27a66}#rbSheet .rb-dock:before{content:"DOCK";position:absolute;left:12px;top:50%;transform:translateY(-50%);font:700 9px Inter,system-ui,sans-serif;letter-spacing:.18em;color:#8f979e;pointer-events:none}#rbSheet .rb-dock:after{content:"\\25BE";position:absolute;right:14px;top:50%;transform:translateY(-50%);color:#eeb46b;pointer-events:none}'+
    '#rbSheet .rb-how{display:flex;align-items:center;gap:8px;margin:10px 0 0;font:600 11px Inter,system-ui,sans-serif;letter-spacing:.08em;color:#8f979e}#rbSheet .rb-how em{font-style:normal;padding:3px 9px;border-radius:7px;background:#000;border:1px solid #ffffff14;color:#ffd27a;font-weight:700;letter-spacing:.14em}'+
    '#rbSheet .rb-chips{display:flex;gap:6px;overflow-x:auto;padding:10px 0 12px;scrollbar-width:none}#rbSheet .rb-chips::-webkit-scrollbar{display:none}#rbSheet .rb-chips button{flex:none;height:30px;padding:0 12px;border-radius:15px;border:1px solid rgba(220,214,201,.14);background:#ffffff08;color:#b7b1a4;font:700 11px "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s}#rbSheet .rb-chips button.on{background:var(--h,#eeb46b);border-color:var(--h,#eeb46b);color:#0b0d0f}#rbSheet .rb-chips button i{font-style:normal;opacity:.7;margin-left:4px}'+
    '#rbSheet .rb-list{flex:1;overflow:auto;padding:6px 16px 16px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:radial-gradient(120% 60% at 50% 0%,#15181c,#0b0d10 60%)}'+
    '#rbSheet .rb-g{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:8px;padding:10px 2px 6px;background:#0b0d10f2;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.22em;color:var(--h,#eeb46b)}#rbSheet .rb-g:before{content:"";width:8px;height:8px;border-radius:2px;background:var(--h,#eeb46b);box-shadow:0 0 8px var(--h,#eeb46b)}#rbSheet .rb-g i{font-style:normal;color:#8f979e;letter-spacing:.04em}'+
    '#rbSheet .rb-row{display:flex;align-items:stretch;gap:12px;padding:10px 10px 10px 12px;border-radius:16px;background:linear-gradient(180deg,#191d22,#121519);border:1px solid rgba(220,214,201,.09);border-left:3px solid var(--h,#eeb46b);margin-bottom:9px;animation:rbIn .25s both;box-shadow:0 6px 16px #0006}#rbSheet .rb-row.bad{opacity:.45;filter:saturate(.3)}#rbSheet .rb-row.me{box-shadow:0 0 0 1px rgba(238,180,107,.35),0 6px 16px #0006}'+
    /* the display */
    '#rbSheet .rb-ch{flex:none;width:88px;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;background:linear-gradient(180deg,#05070a,#0c1008);border:1px solid #000;box-shadow:inset 0 0 0 1px #ffffff0e,inset 0 3px 12px #000;padding:8px 4px;position:relative;overflow:hidden}#rbSheet .rb-ch:after{content:"";position:absolute;inset:0;background:repeating-linear-gradient(180deg,transparent 0 2px,#0000003d 2px 3px);pointer-events:none}'+
    '#rbSheet .rb-ch i{font:700 9px Inter,system-ui,sans-serif;letter-spacing:.16em;font-style:normal;color:#6f7a6b}#rbSheet .rb-ch i.z{color:#ffd27a;text-shadow:0 0 8px #ffd27a88}#rbSheet .rb-ch b{font:400 30px Anton,sans-serif;letter-spacing:.03em;color:#d8ffb0;line-height:1;margin:3px 0;text-shadow:0 0 14px #9fe870aa,0 0 2px #fff}'+
    '#rbSheet .rb-ch .ok{position:absolute;top:4px;right:4px;font:800 8px Inter,system-ui,sans-serif;letter-spacing:.1em;padding:2px 5px;border-radius:5px;background:#eeb46b;color:#0b0d0f}'+
    '#rbSheet .rb-nn{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;justify-content:center}#rbSheet .rb-nn b{font:700 16px "Barlow Condensed",sans-serif;letter-spacing:.05em;color:#f2ead8}#rbSheet .rb-nn span{font-size:12px;color:#9aa2a9;line-height:1.35;overflow-wrap:anywhere}#rbSheet .rb-nn .tg{display:inline-flex;flex-wrap:wrap;gap:4px}#rbSheet .rb-nn .tg em{font-style:normal;font:600 11px Inter,system-ui,sans-serif;padding:3px 8px;border-radius:7px;background:#ffffff0c;border:1px solid #ffffff10;color:#d6d0c3}'+
    '#rbSheet .rb-v{display:flex;gap:6px;margin-top:5px;align-items:center}#rbSheet .rb-v button{height:28px;padding:0 11px;border-radius:14px;border:1px solid rgba(220,214,201,.16);background:#ffffff06;color:#c9c3b6;font:700 12px Inter,system-ui,sans-serif;cursor:pointer;transition:transform .1s}#rbSheet .rb-v button:active{transform:scale(.94)}#rbSheet .rb-v button.on{background:#eeb46b;border-color:#eeb46b;color:#0b0d0f;box-shadow:0 0 12px #eeb46b55}#rbSheet .rb-v button.rep.on{background:#e0492e;border-color:#e0492e;color:#fff;box-shadow:0 0 12px #e0492e66}#rbSheet .rb-v .by{margin-left:auto;font:500 11px Inter,system-ui,sans-serif;color:#8f979e}#rbSheet .rb-v .del{color:#8f979e;border-color:transparent;background:none}'+
    '#rbSheet .rb-empty{padding:40px 18px;text-align:center;color:#9aa2a9;font-size:14px;line-height:1.6}#rbSheet .rb-empty .big{width:72px;height:72px;margin:0 auto 14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#2b2114,#0b0d0f);border:1px solid rgba(238,180,107,.35);display:flex;align-items:center;justify-content:center;font-size:34px;box-shadow:0 0 30px #eeb46b22}#rbSheet .rb-empty b{color:#f2ead8}'+
    '#rbFoot{flex:none;padding:10px 16px calc(12px + env(safe-area-inset-bottom,0px));border-top:1px solid rgba(238,180,107,.18);background:linear-gradient(180deg,#15181c,#0f1114)}#rbSheet .rb-add{width:100%;height:48px;border-radius:14px;border:0;background:linear-gradient(180deg,#ffd27a,#e9a94f);color:#1a1206;font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.18em;cursor:pointer;box-shadow:0 6px 18px #eeb46b40,inset 0 1px 0 #fff6}#rbFoot.open .rb-add{background:#ffffff0a;border:1px solid rgba(220,214,201,.2);color:#8f979e;box-shadow:none}'+
    '#rbSheet .rb-form{display:none;margin:10px 0 0;max-height:52vh;overflow:auto;padding:12px;border-radius:14px;background:#0b0d10;border:1px solid rgba(238,180,107,.25)}#rbSheet .rb-form.on{display:block;animation:rbIn .2s}#rbSheet .rb-form .r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}#rbSheet .rb-form .r1{margin-top:8px}#rbSheet .rb-form label{display:block;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.18em;color:#8f979e;margin:0 0 4px}'+
    '#rbSheet .rb-form select,#rbSheet .rb-form input{box-sizing:border-box;width:100%;border-radius:10px;border:1px solid rgba(220,214,201,.16);background:#000;color:#dcd6c9;font:500 16px Inter,system-ui,sans-serif;padding:10px 12px;outline:none}#rbSheet .rb-form select:focus,#rbSheet .rb-form input:focus{border-color:#eeb46b;box-shadow:0 0 0 3px #eeb46b22}#rbSheet .rb-form .big input{font:400 28px Anton,sans-serif;letter-spacing:.04em;text-align:center;color:#d8ffb0;text-shadow:0 0 12px #9fe87088;background:linear-gradient(180deg,#05070a,#0c1008)}'+
    '#rbSheet .rb-form .go{margin-top:12px;width:100%;height:48px;border-radius:14px;border:0;background:linear-gradient(180deg,#ffd27a,#e9a94f);color:#1a1206;font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.18em;cursor:pointer;box-shadow:0 6px 18px #eeb46b40}#rbSheet .rb-form .go:disabled{opacity:.5}';
  st.textContent+='#rbSheet .rb-my{margin-top:6px}#rbSheet .rb-my button{height:24px;padding:0 9px;border-radius:12px;border:1px dashed rgba(220,214,201,.25);background:none;color:#8f979e;font:600 11px Inter,system-ui,sans-serif;cursor:pointer}#rbSheet .rb-my .mt{display:block;font-size:12px;line-height:1.35;color:#ffd27a;padding:6px 9px;border-radius:9px;background:#eeb46b12;border:1px solid #eeb46b33;cursor:pointer;overflow-wrap:anywhere}#rbSheet .rb-my .mt:before{content:"🔒 my note · ";font-size:10px;letter-spacing:.1em;color:#8f979e}#rbSheet .rb-my input{box-sizing:border-box;width:100%;margin-top:4px;border-radius:9px;border:1px solid rgba(238,180,107,.4);background:#000;color:#ffd27a;font:500 14px Inter,system-ui,sans-serif;padding:8px 10px;outline:none}';
  st.textContent+='@media (prefers-reduced-motion:reduce){#rbSheet *,#rbSheet .rb-in{animation:none!important}}';
  document.head.appendChild(st);

  /* my own notes on a line: private, on this account only (synced to my other phones with the rest of my log) */
  function pkey(){ try{ return typeof K==='function'?K('rbnotes'):null; }catch(e){ return null; } }
  function pall(){ var k=pkey(); if(!k)return {}; try{ return JSON.parse(localStorage.getItem(k)||'{}')||{}; }catch(e){ return {}; } }
  function pget(id){ return pall()[id]||''; }
  function pput(id,v){ var k=pkey(); if(!k)return; var a=pall(); v=String(v||'').trim(); if(v)a[id]=v; else delete a[id]; try{ localStorage.setItem(k,JSON.stringify(a)); }catch(e){} }
  function docks(){ try{ return (typeof TERMINALS!=='undefined'?TERMINALS:window.TERMINALS||[]).map(function(t){ return {key:t.berths,name:[t.aka,t.operator].filter(Boolean).join(' \u00B7 ')+(t.berths&&t.berths!==t.operator?' \u00B7 '+t.berths:'')}; }); }catch(e){ return []; } }
  function dockName(k){ var d=docks().filter(function(x){ return x.key===k; })[0]; return d?d.name:k; }
  function me(){ try{ return (typeof loadAcct==='function'&&(loadAcct()||{}).handle)||null; }catch(e){ return null; } }

  function sheet(){
    var sh=document.getElementById('rbSheet'); if(sh)return sh;
    sh=document.createElement('div'); sh.id='rbSheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true'); sh.setAttribute('data-covers','1');
    sh.innerHTML='<div class="rb-in"><div class="rb-h"><div class="rb-grab"></div><div class="rb-t"><b>\uD83D\uDCFB THE RADIO BOOK</b><button class="rb-x" type="button" aria-label="Close">\u2715</button></div>'+
      '<div class="rb-dock"><select id="rbDock"></select></div>'+
      '<div class="rb-how">TUNE <em>ZONE</em> \u2192 <em>CHANNEL</em> <span style="margin-left:auto">\u2713 right \u00B7 \uD83D\uDEA9 wrong</span></div>'+
      '<div class="rb-chips" id="rbChips"></div></div>'+
      '<div class="rb-list"><div id="rbList"></div></div><div id="rbFoot"></div></div>';
    document.body.appendChild(sh);
    sh.querySelector('#rbFoot').innerHTML='<button type="button" class="rb-add">+ ADD A CHANNEL</button><div class="rb-form" id="rbForm"><label>WHAT IS IT</label><select id="rbTitle">'+TITLES.map(function(t){ return '<option>'+t+'</option>'; }).join('')+'</select>'+
      '<div class="r1" id="rbOtherWrap" style="display:none"><label>NAME IT</label><input id="rbOther" maxlength="30" placeholder="Hatch boss, Gear, Gate\u2026"></div>'+
      '<div class="r2 big"><div><label>ZONE</label><input id="rbZone" maxlength="12" placeholder="2"></div><div><label>CHANNEL</label><input id="rbChan" maxlength="16" placeholder="13"></div></div>'+
      '<div class="r2"><div><label>CRANE (IF ANY)</label><input id="rbCrane" maxlength="16" placeholder="C26"></div><div><label>CALL SIGN (IF ANY)</label><input id="rbHandle" maxlength="30" placeholder="Dock Boss 2"></div></div>'+
      '<div class="r1"><label>NOTE \u00B7 EVERYBODY SEES IT</label><input id="rbNote" maxlength="140" placeholder="UTR side \u00B7 nights only \u00B7 ask for Manny"></div>'+
      '<div class="r1"><label>\uD83D\uDD12 MY NOTE \u00B7 ONLY YOU</label><input id="rbMine" maxlength="200" placeholder="What to remember next time you\u2019re here"></div>'+
      '<button type="button" class="go">ADD IT TO THE BOOK</button></div>';
    sh.querySelector('#rbTitle').addEventListener('change',function(){ document.getElementById('rbOtherWrap').style.display=this.value==='Other'?'block':'none'; });
    sh.addEventListener('click',function(e){
      if(e.target===sh||e.target.closest('.rb-x')){ shut(); return; }
      var v=e.target.closest('[data-vote]'); if(v){ vote(+v.getAttribute('data-id'),v.getAttribute('data-vote')); return; }
      var d=e.target.closest('[data-del]'); if(d){ strike(+d.getAttribute('data-del'),d); return; }
      var my=e.target.closest('.rb-my'); if(my&&!e.target.closest('input')){ var id=my.getAttribute('data-my'); my.innerHTML='<input maxlength="200" placeholder="For you only \u2014 what to remember next time" value="'+E(pget(id))+'">'; var inp=my.querySelector('input'); inp.focus(); var done=function(){ pput(id,inp.value); my.innerHTML=pget(id)?'<span class="mt">'+E(pget(id))+'</span>':'<button type="button">\u270E my note \u00B7 only you</button>'; }; inp.addEventListener('blur',done); inp.addEventListener('keydown',function(ev){ if(ev.key==='Enter'){ ev.preventDefault(); inp.blur(); } }); return; }
      if(e.target.closest('.rb-add')){ var f=document.getElementById('rbForm'), on=!f.classList.contains('on'); f.classList.toggle('on',on); document.getElementById('rbFoot').classList.toggle('open',on); e.target.closest('.rb-add').textContent=on?'\u2715 NEVER MIND':'+ ADD A CHANNEL'; if(on)f.querySelector('select').focus(); return; }
      var c=e.target.closest('#rbChips button'); if(c){ filt=c.getAttribute('data-f'); paint(); return; }
      if(e.target.closest('.rb-form .go')){ add(); return; }
    });
    sh.querySelector('#rbDock').addEventListener('change',function(){ dock=this.value; load(); });
    sh.querySelector('#rbDock').addEventListener('click',function(e){ e.stopPropagation(); });
    return sh;
  }
  function shut(){ var sh=document.getElementById('rbSheet'); if(sh)sh.classList.remove('on'); }
  function open(k){
    var sh=sheet(), sel=sh.querySelector('#rbDock'), list=docks();
    sel.innerHTML='<option value="">\u2014 pick the dock \u2014</option>'+list.map(function(d){ return '<option value="'+E(d.key)+'">'+E(d.name)+'</option>'; }).join('');
    dock=k&&list.some(function(d){ return d.key===k; })?k:(dock||'');
    sel.value=dock; sh.classList.add('on'); rows=[]; mine={}; paint(); load(); live();
  }

  function load(){
    if(!window.SB||!dock){ paint(); return; }
    var k=dock;
    window.SB.from('radio_channels').select('*').eq('dock',k).order('title').order('confirms',{ascending:false}).then(function(r){ if(k!==dock||r.error||!Array.isArray(r.data))return; rows=r.data; paint(); });
    window.SB.rpc('radio_my_votes',{p_dock:k}).then(function(r){ if(k!==dock||r.error||!Array.isArray(r.data))return; mine={}; r.data.forEach(function(v){ mine[v.ch_id]=v.kind; }); paint(); },function(){});
  }
  function live(){
    if(rt||!window.SB)return;
    try{ rt=window.SB.channel('radio-book').on('postgres_changes',{event:'*',schema:'public',table:'radio_channels'},function(p){ var row=p.new||p.old; if(row&&row.dock===dock)load(); }).subscribe(); }catch(e){}
  }
  function paint(){
    var el=document.getElementById('rbList'), chips=document.getElementById('rbChips'), ft=document.getElementById('rbFoot'); if(!el)return;
    var km=!!window.__isKM, uid=window.__shkUid||null;
    if(ft)ft.style.display=dock?'block':'none';
    if(!dock){ chips.innerHTML=''; el.innerHTML='<div class="rb-empty"><div class="big">\uD83D\uDCFB</div><b>Pick the dock you\u2019re on.</b><br>Zones and channels change from dock to dock, so each one keeps its own page.</div>'; return; }
    var live=rows.filter(function(r){ return !r.hidden||km; });
    var byT={}; live.forEach(function(r){ var t=r.title||'Other'; (byT[t]=byT[t]||[]).push(r); });
    var order=function(a,b){ var ia=TITLES.indexOf(a),ib=TITLES.indexOf(b); if(ia<0)ia=99; if(ib<0)ib=99; return ia-ib||a.localeCompare(b); };
    var keys=Object.keys(byT).sort(order);
    if(filt&&!byT[filt])filt='';
    chips.innerHTML=keys.length>1?'<button type="button" data-f="" class="'+(filt?'':'on')+'">ALL<i>'+live.length+'</i></button>'+keys.map(function(k){ return '<button type="button" data-f="'+E(k)+'" class="'+(filt===k?'on':'')+'" style="--h:'+hue(k)+'">'+E(k.toUpperCase())+'<i>'+byT[k].length+'</i></button>'; }).join(''):'';
    if(!live.length){ el.innerHTML='<div class="rb-empty"><div class="big">\uD83D\uDCFB</div>Nothing in the book for <b>'+E(dockName(dock))+'</b> yet.<br>You\u2019re the first \u2014 add what you know and the next casual here will have it.</div>'; return; }
    var out='';
    keys.forEach(function(t){
      if(filt&&t!==filt)return;
      out+='<div class="rb-g" style="--h:'+hue(t)+'">'+E(t.toUpperCase())+'<i>'+byT[t].length+'</i></div>'+byT[t].map(function(r,ix){
        var bad=r.hidden||(r.reports>r.confirms&&r.reports>=2), m=mine[r.id]||'', own=uid&&r.by_uid===uid;
        var tags=[r.crane?'\uD83C\uDFD7 crane '+r.crane:'',r.handle?'\uD83D\uDCE2 \u201C'+r.handle+'\u201D':''].filter(Boolean);
        var ok=(r.confirms||0)>=5&&!(r.reports>0);
        return '<div class="rb-row'+(bad?' bad':'')+(own?' me':'')+'" style="--h:'+hue(t)+';animation-delay:'+Math.min(ix*35,300)+'ms"><div class="rb-ch">'+(ok?'<span class="ok">\u2713 SOLID</span>':'')+'<i class="z">'+(r.zone?'ZONE '+E(r.zone):'ZONE ?')+'</i><b>'+E(r.channel)+'</b><i>CHANNEL</i></div>'+
          '<div class="rb-nn"><b>'+E(r.title)+'</b>'+(tags.length?'<span class="tg">'+tags.map(function(x){ return '<em>'+E(x)+'</em>'; }).join('')+'</span>':'')+(r.note?'<span>'+E(r.note)+'</span>':'')+
          (bad?'<span style="color:#e8967a">\u26A0 '+r.reports+' said this is wrong</span>':'')+
          '<div class="rb-my" data-my="'+r.id+'">'+(pget(r.id)?'<span class="mt">'+E(pget(r.id))+'</span>':'<button type="button">\u270E my note \u00B7 only you</button>')+'</div>'+
          '<div class="rb-v"><button type="button" class="'+(m==='confirm'?'on':'')+'" data-vote="confirm" data-id="'+r.id+'">\u2713 '+(r.confirms||0)+'</button><button type="button" class="rep'+(m==='report'?' on':'')+'" data-vote="report" data-id="'+r.id+'">\uD83D\uDEA9 '+(r.reports||0)+'</button>'+
          '<span class="by">'+(own?'you':E(r.by_handle||'a casual'))+'</span>'+((km||own)?'<button type="button" class="del" data-del="'+r.id+'" title="Strike it">\u2715</button>':'')+'</div></div></div>';
      }).join('');
    });
    el.innerHTML=out;
  }
  function vote(id,kind){
    if(busy||!window.SB)return; busy=true;
    window.SB.rpc('radio_vote',{p_id:id,p_kind:kind}).then(function(r){ busy=false; if(r.error||!r.data||!r.data.ok){ say('\u2717 '+(r.error&&r.error.message||'sign in to vote')); return; }
      mine[id]=r.data.mine||''; rows.forEach(function(x){ if(x.id===id){ x.confirms=r.data.confirms; x.reports=r.data.reports; x.hidden=r.data.reports>=3&&r.data.reports>r.data.confirms; } }); paint();
      if(kind==='report'&&mine[id]==='report')say('\uD83D\uDEA9 Flagged. Add the right one below if you know it.');
    },function(){ busy=false; say('\u2717 No connection.'); });
  }
  function strike(id,b){
    if(b.getAttribute('data-arm')!=='1'){ b.setAttribute('data-arm','1'); b.textContent='STRIKE?'; setTimeout(function(){ b.removeAttribute('data-arm'); b.textContent='\u2715'; },3000); return; }
    window.SB.from('radio_channels').delete().eq('id',id).then(function(r){ if(r.error){ say('\u2717 '+r.error.message); return; } rows=rows.filter(function(x){ return x.id!==id; }); paint(); say('\u2713 Struck from the book'); });
  }
  function add(){
    if(!window.SB||!dock)return;
    var g=function(id){ return (document.getElementById(id).value||'').trim(); };
    var title=g('rbTitle'); if(title==='Other')title=g('rbOther');
    var zone=g('rbZone').replace(/^zone\s*/i,'').toUpperCase(), chan=g('rbChan').replace(/^(ch|chan|channel)\.?\s*/i,'').toUpperCase();
    if(!title){ say('Name what the channel is for.'); return; }
    if(!chan){ say('Which channel? That\u2019s the one thing the book needs.'); document.getElementById('rbChan').focus(); return; }
    var dup=rows.some(function(r){ return r.title.toLowerCase()===title.toLowerCase()&&String(r.channel).toLowerCase()===chan.toLowerCase()&&String(r.zone||'').toLowerCase()===zone.toLowerCase()&&String(r.crane||'').toLowerCase()===g('rbCrane').toLowerCase(); });
    if(dup){ say('That one\u2019s already in the book \u2014 give it a \u2713 instead.'); return; }
    var btn=document.querySelector('#rbForm .go'); btn.disabled=true;
    window.SB.from('radio_channels').insert({dock:dock,dock_name:dockName(dock),title:title,zone:zone||null,channel:chan,crane:g('rbCrane')||null,handle:g('rbHandle')||null,note:g('rbNote')||null,by_uid:window.__shkUid||null,by_handle:me()}).select('id').then(function(r){
      btn.disabled=false;
      if(r.error){ say('\u2717 '+(r.error.message||'didn\u2019t save')); return; }
      try{ var nid=r.data&&r.data[0]&&r.data[0].id; if(nid&&g('rbMine'))pput(nid,g('rbMine')); }catch(x){}
      say('\u2713 In the book. Every casual on '+dockName(dock).split(' \u00B7 ')[0]+' can see it now.');
      ['rbZone','rbChan','rbCrane','rbHandle','rbNote','rbMine','rbOther'].forEach(function(id){ document.getElementById(id).value=''; }); document.getElementById('rbForm').classList.remove('on'); document.getElementById('rbFoot').classList.remove('open'); document.querySelector('#rbFoot .rb-add').textContent='+ ADD A CHANNEL'; load();
    },function(){ btn.disabled=false; say('\u2717 No connection.'); });
  }

  /* ways in: THE PORTS, and each job in the log */
  function dockOfRow(r){
    try{ var id=r.getAttribute('data-id'), j=(typeof DOCKETS!=='undefined'?DOCKETS:window.DOCKETS||[]).filter(function(x){ return String(x._id)===String(id); })[0]; if(!j)return null;
      var t=typeof dkTerminal==='function'?dkTerminal(j):null; if(!t&&typeof findTerminal==='function')t=findTerminal(j.terminal); return t?t.berths:null; }catch(e){ return null; }
  }
  function ways(){
    var scr=document.getElementById('scr-ports');
    if(scr&&!document.getElementById('rbBtn')){ var t=scr.querySelector('.screen-title'), b=document.createElement('button'); b.id='rbBtn'; b.type='button'; b.innerHTML='<span class="ic">\uD83D\uDCFB</span><span><b>THE RADIO BOOK</b><span>Zone and channel for every dock \u00B7 everybody adds</span></span><i>\u203A</i>'; b.addEventListener('click',function(){ open(null); }); if(t&&t.parentNode)t.parentNode.insertBefore(b,t.nextSibling); else scr.insertBefore(b,scr.firstChild); }
    var list=document.getElementById('docketList'); if(!list)return;
    list.querySelectorAll('.jx-row.lit[data-id]').forEach(function(r){
      var p=r.nextElementSibling; if(!p||p.querySelector('.rb-job'))return;
      var k=dockOfRow(r); if(!k)return;
      var b=document.createElement('button'); b.type='button'; b.className='rb-job'; b.setAttribute('data-dock',k); b.innerHTML='\uD83D\uDCFB <b>RADIO BOOK</b><span>'+E(dockName(k).split(' \u00B7 ').slice(0,2).join(' \u00B7 '))+' \u203A</span>';
      b.addEventListener('click',function(e){ e.stopPropagation(); open(k); });
      var dk=p.querySelector('.dkn'); if(dk)dk.parentNode.insertBefore(b,dk); else (p.querySelector('.jx')||p).appendChild(b);
    });
  }
  var t=null;
  new MutationObserver(function(){ clearTimeout(t); t=setTimeout(ways,60); }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  ways();
  window.radioOpen=open;
})();
