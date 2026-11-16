/* dock_reviews.js — #nov15 DOCK REVIEWS. Yelp for the docks.
   · Ports tab: a "★ DOCK REVIEWS" card (top-rated docks + write a review), stars on every dock row, and a reviews
     strip inside the dock sheet (openDock calls window.rvDock).
   · Dockets: under each open job slip, "★ How was <dock>?" — rate the dock you just worked.
   · Members add their own things to review at a dock: a boss, a clerk, a gate, the lunch truck, gear…
   · Rewards: ⬡25 for the first review of a dock, ⬡10 per item (server caps ⬡150/day). Levels: First Word (1) ·
     Dock Scout (3) · Harbor Critic (10) · Elite of the Order (25). "✓ Worked here" when they have a docket there.
   Server: rv_overview · rv_dock · rv_save · rv_topic_add · rv_mark · rv_remove (Supabase). */
(function(){
  'use strict';
  if(window.__rvOn)return; window.__rvOn=true;
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var T=function(){ try{ return (typeof TERMINALS!=='undefined'?TERMINALS:window.TERMINALS)||[]; }catch(e){ return []; } };
  var key=function(t){ return t?t.operator+'|'+t.berths:''; };
  var nameOf=function(t){ return t?[t.aka,t.operator].filter(Boolean).join(' · '):''; };
  var byKey=function(k){ return T().filter(function(t){ return key(t)===k; })[0]||null; };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var CATS=[['park','Parking'],['bath','Bathrooms'],['food','Food'],['breaks','Breaks honored'],['out','Out on time'],['safe','Safety']];
  var KINDS=[['boss','Boss / foreman'],['clerk','Clerk'],['gate','Gate'],['food','Food / lunch truck'],['gear','Gear / machines'],['other','Something else']];
  var KICON={boss:'🧢',clerk:'📋',gate:'🚧',food:'🌮',gear:'⚙️',other:'⭐'};
  var LV=[[25,'Elite of the Order','👑'],[10,'Harbor Critic','🏆'],[3,'Dock Scout','🧭'],[1,'First Word','✍️']];
  function lvl(n){ for(var i=0;i<LV.length;i++)if(n>=LV[i][0])return LV[i]; return null; }
  function next(n){ for(var i=LV.length-1;i>=0;i--)if(n<LV[i][0])return LV[i]; return null; }
  function stars(v,big){ v=+v||0; var s=''; for(var i=1;i<=5;i++)s+='<i class="'+(v>=i-.25?'on':v>=i-.75?'half':'')+'">★</i>'; return '<span class="rv-st'+(big?' big':'')+'">'+s+'</span>'; }
  function rpc(fn,args){ if(!window.SB)return Promise.reject(new Error('Not connected')); return window.SB.rpc(fn,args||{}).then(function(r){ if(r.error)throw new Error(r.error.message); return r.data; }); }

  /* ---------- styles ---------- */
  var css=document.createElement('style'); css.textContent=
  '.rv-st{color:#5a5347;letter-spacing:1px;white-space:nowrap}.rv-st i{font-style:normal}.rv-st i.on{color:#f5b731}.rv-st i.half{background:linear-gradient(90deg,#f5b731 50%,#5a5347 50%);-webkit-background-clip:text;background-clip:text;color:transparent}.rv-st.big{font-size:22px}'+
  '.rv-card{margin:0 0 14px;padding:14px;border-radius:16px;background:linear-gradient(184deg,var(--plate-2,#1a1712),var(--plate,#12100c) 62%);border:1px solid var(--line,rgba(220,214,201,.16))}'+
  '.rv-h{display:flex;align-items:center;gap:8px;font:400 20px Anton,sans-serif;letter-spacing:.06em;color:var(--bone,#dcd6c9)}.rv-h small{margin-left:auto;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.06em;color:#f5b731}'+
  '.rv-sub{font:500 12.5px Inter,system-ui,sans-serif;color:var(--steel,#8f979e);margin:4px 0 10px}'+
  '.rv-top{display:flex;flex-direction:column;gap:6px}.rv-tr{display:flex;align-items:center;gap:8px;width:100%;padding:8px 10px;border-radius:10px;border:1px solid var(--line-soft,rgba(220,214,201,.1));background:#0006;color:var(--bone,#dcd6c9);font:600 13.5px Inter,system-ui,sans-serif;text-align:left;cursor:pointer}.rv-tr b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rv-tr em{font-style:normal;color:var(--steel,#8f979e);font-size:11.5px}'+
  '.rv-go{display:block;width:100%;height:48px;margin-top:10px;border:0;border-radius:12px;background:linear-gradient(180deg,#f7c84a,#e29b1f);color:#1a1206;font:400 18px Anton,sans-serif;letter-spacing:.08em;cursor:pointer}'+
  '.rv-ghost{display:block;width:100%;height:42px;margin-top:8px;border-radius:12px;border:1px dashed rgba(245,183,49,.5);background:none;color:#f5b731;font:700 13px Inter,system-ui,sans-serif;letter-spacing:.06em;cursor:pointer}'+
  '.rv-pill{display:inline-flex;align-items:center;gap:4px;margin-left:6px;font:700 11px Inter,system-ui,sans-serif;color:#f5b731}'+
  '.rv-dock{margin:12px 0 0;padding:12px;border-radius:14px;background:#0008;border:1px solid rgba(245,183,49,.25)}'+
  '.rvk{margin:10px 0 4px;padding:12px;border-radius:14px;background:linear-gradient(184deg,#1c1608,#100d06);border:1px solid rgba(245,183,49,.35);cursor:pointer}.rvk .rvk-t{font:700 11px Inter,system-ui,sans-serif;letter-spacing:.16em;color:#f5b731}.rvk .rvk-q{font:400 19px Anton,sans-serif;letter-spacing:.03em;color:var(--bone,#dcd6c9);margin:4px 0 6px}.rvk .rvk-s{display:flex;gap:6px}.rvk .rvk-s button{flex:1;height:40px;border-radius:10px;border:1px solid rgba(245,183,49,.35);background:#0008;color:#5a5347;font-size:22px;cursor:pointer}.rvk .rvk-s button.on{color:#f5b731}.rvk .rvk-m{font:500 12px Inter,system-ui,sans-serif;color:var(--steel,#8f979e);margin-top:6px}'+
  '#rvSheet{position:fixed;inset:0;z-index:9000;background:#000b;display:flex;align-items:flex-end;justify-content:center}#rvSheet .rv-in{width:100%;max-width:560px;max-height:92vh;overflow:auto;-webkit-overflow-scrolling:touch;background:var(--bg,#0d0c0a);border-radius:20px 20px 0 0;border-top:1px solid rgba(245,183,49,.4);padding:16px 16px calc(24px + env(safe-area-inset-bottom))}'+
  '#rvSheet .rv-x{float:right;width:38px;height:38px;border-radius:50%;border:1px solid var(--line,rgba(220,214,201,.2));background:none;color:var(--bone,#dcd6c9);font-size:18px;cursor:pointer}'+
  '.rv-k{font:700 11px Inter,system-ui,sans-serif;letter-spacing:.16em;color:#f5b731;margin:0 0 2px}.rv-t{font:400 26px Anton,sans-serif;letter-spacing:.03em;color:var(--bone,#dcd6c9);line-height:1.1}'+
  '.rv-sum{display:flex;align-items:center;gap:10px;margin:8px 0 12px;font:600 13px Inter,system-ui,sans-serif;color:var(--steel,#8f979e)}.rv-sum b{font:400 30px Anton,sans-serif;color:var(--bone,#dcd6c9)}'+
  '.rv-cats{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin:0 0 12px}.rv-cat{display:flex;justify-content:space-between;align-items:center;font:600 12px Inter,system-ui,sans-serif;color:var(--steel,#8f979e)}'+
  '.rv-sec{display:flex;align-items:center;gap:8px;margin:16px 0 8px;font:700 10.5px Inter,system-ui,sans-serif;letter-spacing:.2em;color:var(--steel,#8f979e)}.rv-sec:after{content:"";flex:1;height:1px;background:var(--line-soft,rgba(220,214,201,.12))}'+
  '.rv-item{display:flex;align-items:center;gap:8px;padding:9px 10px;margin:0 0 6px;border-radius:10px;background:#ffffff08;border:1px solid var(--line-soft,rgba(220,214,201,.1));font:600 13.5px Inter,system-ui,sans-serif;color:var(--bone,#dcd6c9);cursor:pointer;width:100%;text-align:left}.rv-item b{flex:1;min-width:0}.rv-item em{font-style:normal;font-size:11px;color:var(--steel,#8f979e)}'+
  '.rv-rev{padding:10px 0;border-bottom:1px solid var(--line-soft,rgba(220,214,201,.1));font:500 13.5px/1.45 Inter,system-ui,sans-serif;color:var(--bone,#dcd6c9)}.rv-rev .who{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font:700 12px Inter,system-ui,sans-serif;color:var(--copper-hi,#eeb46b)}.rv-rev .ok{color:#7fe08a;font-weight:700}.rv-rev .lv{color:#f5b731}.rv-rev .on{font-size:11px;color:var(--steel,#8f979e);font-weight:600}.rv-rev p{margin:4px 0 6px;white-space:pre-wrap;word-break:break-word}.rv-rev .cs{font-size:11.5px;color:var(--steel,#8f979e)}'+
  '.rv-acts{display:flex;gap:8px;margin-top:6px}.rv-acts button{height:30px;padding:0 10px;border-radius:15px;border:1px solid var(--line-soft,rgba(220,214,201,.18));background:none;color:var(--steel,#8f979e);font:700 11.5px Inter,system-ui,sans-serif;cursor:pointer}.rv-acts button.on{color:#f5b731;border-color:#f5b73188}'+
  '.rv-pick{display:flex;gap:6px;margin:6px 0 12px}.rv-pick button{flex:1;height:50px;border-radius:12px;border:1px solid rgba(245,183,49,.35);background:#0008;color:#4a4439;font-size:28px;cursor:pointer}.rv-pick button.on{color:#f5b731}'+
  '.rv-mini{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center;margin:0 0 12px;font:600 12.5px Inter,system-ui,sans-serif;color:var(--steel,#8f979e)}.rv-mini span button{width:28px;height:28px;border:0;background:none;color:#4a4439;font-size:20px;padding:0;cursor:pointer}.rv-mini span button.on{color:#f5b731}'+
  '#rvSheet textarea,#rvSheet input,#rvSheet select{box-sizing:border-box;width:100%;border-radius:10px;border:1px solid var(--line-soft,rgba(220,214,201,.16));background:#000;color:var(--bone,#dcd6c9);font:500 16px Inter,system-ui,sans-serif;padding:10px;outline:none;margin:0 0 10px}#rvSheet textarea{min-height:96px}'+
  '.rv-me{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0 0 10px;border-radius:12px;background:#f5b73114;border:1px solid #f5b73155;font:600 12.5px Inter,system-ui,sans-serif;color:var(--bone,#dcd6c9)}.rv-me b{font-size:20px}.rv-me .bar{height:6px;border-radius:3px;background:#ffffff14;margin-top:5px;overflow:hidden}.rv-me .bar i{display:block;height:100%;background:linear-gradient(90deg,#f7c84a,#e29b1f)}'+
  '.rv-note{font:500 11.5px Inter,system-ui,sans-serif;color:var(--steel,#8f979e);margin:-4px 0 10px}'+
  'html.daylight .rv-card,html.daylight .rv-dock{background:#fffaf0;border-color:#e6d9bd}html.daylight #rvSheet .rv-in{background:#fbf8f1}';
  document.head.appendChild(css);

  /* ---------- data ---------- */
  var OV=null, OVat=0;
  function overview(force){ if(OV&&!force&&Date.now()-OVat<120000)return Promise.resolve(OV); return rpc('rv_overview').then(function(d){ OV=d||{}; OVat=Date.now(); return OV; }); }
  function meCard(me){ var n=+(me&&me.reviews)||0, L=lvl(n), N=next(n), from=L?L[0]:0, pct=N?Math.round((n-from)/(N[0]-from)*100):100;
    return '<div class="rv-me"><b>'+(L?L[2]:'⭐')+'</b><div style="flex:1">'+(L?'<span style="color:#f5b731">'+E(L[1])+'</span> · ':'')+n+' review'+(n===1?'':'s')+(me&&me.helpful?' · '+me.helpful+' found helpful':'')+
      '<div style="color:var(--steel,#8f979e);font-weight:500">'+(N?(N[0]-n)+' more to <b style="font-size:inherit;color:#f5b731">'+E(N[1])+'</b> '+N[2]+' · ⬡25 per new dock':'Top of the Order. Keep the harbor honest.')+'</div><div class="bar"><i style="width:'+pct+'%"></i></div></div></div>'; }

  /* ---------- the sheet ---------- */
  var S=null; /* {dock, data, view, topic} */
  function close(){ var s=document.getElementById('rvSheet'); s&&s.remove(); S=null; }
  function open(dock,view,preset){ var t=byKey(dock); if(!t){ say('That dock isn\'t on the list'); return; }
    S={dock:dock,t:t,data:null,view:view||'read',topic:null,pick:preset||0,cats:{}};
    var s=document.getElementById('rvSheet'); if(!s){ s=document.createElement('div'); s.id='rvSheet'; s.innerHTML='<div class="rv-in"></div>'; document.body.appendChild(s);
      s.addEventListener('click',function(e){ if(e.target===s)close(); }); }
    paint(); load(); }
  function load(){ var d=S&&S.dock; rpc('rv_dock',{p_dock:d}).then(function(x){ if(!S||S.dock!==d)return; S.data=x||{reviews:[],topics:[]};
      var mine=S.data.reviews.filter(function(r){ return r.mine&&!r.topic; })[0]; if(mine&&S.view==='write'&&!S.pick){ S.pick=mine.stars; S.cats=mine.cats||{}; S.tip=mine.tip||''; }
      paint(); }).catch(function(e){ if(S){ S.err=e.message; paint(); } }); }
  function agg(list){ var n=list.length, a=n?list.reduce(function(s,r){ return s+r.stars; },0)/n:0; return {n:n,avg:Math.round(a*10)/10}; }
  function paint(){ var s=document.getElementById('rvSheet'); if(!s||!S)return; var box=s.querySelector('.rv-in'), D=S.data, t=S.t, h='';
    h+='<button type="button" class="rv-x" data-rv="x">✕</button><div class="rv-k">★ DOCK REVIEWS</div><div class="rv-t">'+E(nameOf(t))+'</div>';
    if(!D){ box.innerHTML=h+'<p class="rv-sub" style="margin-top:14px">'+(S.err?'⚠ '+E(S.err):'Loading reviews…')+'</p>'; return; }
    var main=D.reviews.filter(function(r){ return !r.topic; }), A=agg(main);
    if(S.view==='write'||S.view==='topic'){ h+=writeHTML(D,main); box.innerHTML=h; return; }
    if(S.view==='add'){ h+='<div class="rv-sec">ADD SOMETHING TO REVIEW</div><p class="rv-note">A boss, a clerk, a gate, the lunch truck, a machine — anything casuals should know about at this dock.</p>'+
      '<select id="rvKind">'+KINDS.map(function(k){ return '<option value="'+k[0]+'">'+E(k[1])+'</option>'; }).join('')+'</select><input id="rvTitle" maxlength="40" placeholder="Name it — e.g. Big Mike (walking boss), Gate 3, Tacos El Puerto">'+
      '<p class="rv-note">Keep it about the work. No phone numbers, no threats — three reports takes a review down.</p><button type="button" class="rv-go" data-rv="addgo">ADD IT</button><button type="button" class="rv-ghost" data-rv="read">← BACK</button>'; box.innerHTML=h; return; }
    h+='<div class="rv-sum"><b>'+(A.n?A.avg.toFixed(1):'—')+'</b>'+stars(A.avg,true)+'<span>'+A.n+' review'+(A.n===1?'':'s')+'</span></div>';
    if(A.n){ h+='<div class="rv-cats">'+CATS.map(function(c){ var v=main.map(function(r){ return +((r.cats||{})[c[0]])||0; }).filter(Boolean); if(!v.length)return ''; var a=v.reduce(function(x,y){ return x+y; },0)/v.length; return '<div class="rv-cat">'+E(c[1])+' '+stars(a)+'</div>'; }).join('')+'</div>'; }
    var mine=main.filter(function(r){ return r.mine; })[0];
    h+=meCard(D.me);
    h+='<button type="button" class="rv-go" data-rv="write">'+(mine?'✏️ EDIT MY REVIEW':'★ WRITE A REVIEW'+' · +⬡25')+'</button>';
    h+='<div class="rv-sec">ALSO AT THIS DOCK</div>';
    if(D.topics.length)h+=D.topics.map(function(tp){ var L=D.reviews.filter(function(r){ return r.topic===tp.id; }), g=agg(L); return '<button type="button" class="rv-item" data-rv="topic" data-id="'+tp.id+'"><span>'+(KICON[tp.kind]||'⭐')+'</span><b>'+E(tp.title)+'</b>'+(g.n?stars(g.avg)+'<em>'+g.n+'</em>':'<em>be the first · +⬡10</em>')+'</button>'; }).join('');
    else h+='<p class="rv-note">Nothing yet. Add a boss, a gate, the lunch truck…</p>';
    h+='<button type="button" class="rv-ghost" data-rv="add">+ ADD SOMETHING TO REVIEW</button>';
    h+='<div class="rv-sec">WHAT CASUALS SAY</div>'+(main.length?main.map(revHTML).join(''):'<p class="rv-note">No reviews yet. Worked here? Be the first — ⬡25.</p>');
    box.innerHTML=h; }
  function revHTML(r){ var L=lvl(+r.lvl||0), cs=CATS.filter(function(c){ return (r.cats||{})[c[0]]; }).map(function(c){ return c[1]+' '+r.cats[c[0]]+'★'; }).join(' · ');
    return '<div class="rv-rev" data-id="'+r.id+'"><div class="who">'+E(r.handle||'A casual')+(L?'<span class="lv">'+L[2]+' '+E(L[1])+'</span>':'')+(r.verified?'<span class="ok">✓ Worked here</span>':'')+'<span class="on">'+new Date(r.at).toLocaleDateString([], {month:'short',day:'numeric'})+'</span></div>'+
      stars(r.stars)+(r.tip?'<p>'+E(r.tip)+'</p>':'')+(cs?'<div class="cs">'+E(cs)+'</div>':'')+
      '<div class="rv-acts">'+(r.mine?'<button type="button" data-rv="del" data-id="'+r.id+'">Delete</button>':'<button type="button" class="'+(r.marked?'on':'')+'" data-rv="help" data-id="'+r.id+'">👍 Helpful'+(r.helpful?' · '+r.helpful:'')+'</button><button type="button" data-rv="rep" data-id="'+r.id+'">⚑ Report</button>'+(S.data.km?'<button type="button" data-rv="del" data-id="'+r.id+'">Remove</button>':''))+'</div></div>'; }
  function writeHTML(D,main){ var tp=S.view==='topic'?D.topics.filter(function(x){ return x.id===S.topic; })[0]:null, h='';
    if(S.view==='topic'&&!tp)return '<p class="rv-sub">That item is gone.</p>';
    var list=tp?D.reviews.filter(function(r){ return r.topic===tp.id; }):[], mine=tp?list.filter(function(r){ return r.mine; })[0]:null;
    if(tp&&mine&&!S.pick){ S.pick=mine.stars; S.tip=mine.tip||''; }
    h+='<div class="rv-sec">'+(tp?(KICON[tp.kind]||'⭐')+' '+E(tp.title).toUpperCase():'YOUR REVIEW OF THE DOCK')+'</div>';
    if(tp){ var g=agg(list); h+='<div class="rv-sum"><b>'+(g.n?g.avg.toFixed(1):'—')+'</b>'+stars(g.avg,true)+'<span>'+g.n+' rating'+(g.n===1?'':'s')+'</span></div>'; }
    h+='<div class="rv-pick">'+[1,2,3,4,5].map(function(i){ return '<button type="button" data-rv="pick" data-v="'+i+'" class="'+(S.pick>=i?'on':'')+'">★</button>'; }).join('')+'</div>';
    if(!tp)h+='<div class="rv-mini">'+CATS.map(function(c){ var v=+S.cats[c[0]]||0; return '<div>'+E(c[1])+'</div><span>'+[1,2,3,4,5].map(function(i){ return '<button type="button" data-rv="cat" data-c="'+c[0]+'" data-v="'+i+'" class="'+(v>=i?'on':'')+'">★</button>'; }).join('')+'</span>'; }).join('')+'</div>';
    h+='<textarea id="rvTip" maxlength="600" placeholder="'+(tp?'What should casuals know?':'Tips for the next casual — where to park, what to bring, how the breaks go…')+'">'+E(S.tip||'')+'</textarea>';
    h+='<p class="rv-note">Be fair and keep it about the work. No phone numbers or threats.</p>';
    h+='<button type="button" class="rv-go" data-rv="save">'+((tp?mine:main.filter(function(r){ return r.mine; })[0])?'SAVE CHANGES':'POST REVIEW · +⬡'+(tp?10:25))+'</button>';
    if(tp&&list.length)h+='<div class="rv-sec">WHAT CASUALS SAY</div>'+list.map(revHTML).join('');
    h+='<button type="button" class="rv-ghost" data-rv="read">← BACK TO THE DOCK</button>'; return h; }

  document.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('[data-rv]'); if(!b||!S||!b.closest('#rvSheet'))return; var a=b.getAttribute('data-rv'), id=+b.getAttribute('data-id')||0;
    var keepTip=function(){ var x=document.getElementById('rvTip'); if(x)S.tip=x.value; };
    if(a==='x'){ close(); return; }
    if(a==='read'){ S.view='read'; S.topic=null; S.pick=0; S.tip=''; S.cats={}; paint(); return; }
    if(a==='write'){ var mine=S.data.reviews.filter(function(r){ return r.mine&&!r.topic; })[0]; S.view='write'; S.pick=mine?mine.stars:0; S.cats=mine?Object.assign({},mine.cats||{}):{}; S.tip=mine?mine.tip||'':''; paint(); return; }
    if(a==='topic'){ S.view='topic'; S.topic=id; S.pick=0; S.tip=''; paint(); return; }
    if(a==='add'){ S.view='add'; paint(); setTimeout(function(){ var i=document.getElementById('rvTitle'); i&&i.focus(); },50); return; }
    if(a==='pick'){ keepTip(); S.pick=+b.getAttribute('data-v'); paint(); return; }
    if(a==='cat'){ keepTip(); var c=b.getAttribute('data-c'), v=+b.getAttribute('data-v'); S.cats[c]=S.cats[c]===v?0:v; if(!S.cats[c])delete S.cats[c]; paint(); return; }
    if(a==='addgo'){ var title=(document.getElementById('rvTitle').value||'').trim(), kind=document.getElementById('rvKind').value; if(title.length<2){ say('Give it a name'); return; }
      b.disabled=true; rpc('rv_topic_add',{p_dock:S.dock,p_kind:kind,p_title:title}).then(function(nid){ S.topic=+nid; S.view='topic'; S.pick=0; S.tip=''; load(); say('Added — now rate it'); }).catch(function(err){ b.disabled=false; say(err.message); }); return; }
    if(a==='save'){ keepTip(); if(!S.pick){ say('Tap the stars first'); return; } b.disabled=true; b.textContent='POSTING…';
      var before=+(S.data.me&&S.data.me.reviews)||0;
      rpc('rv_save',{p_dock:S.dock,p_topic:S.view==='topic'?S.topic:null,p_stars:S.pick,p_cats:S.view==='topic'?{}:S.cats,p_tip:S.tip||''}).then(function(r){
        var n=+r.reviews||0, L=lvl(n), was=lvl(before);
        if(L&&(!was||L[0]!==was[0]))celebrate(L,r.paid); else say(r.paid?'✓ Posted · +⬡'+r.paid+' Port Bucks':'✓ Review saved');
        OV=null; S.view=S.view==='topic'?'topic':'read'; S.pick=0; S.tip=''; load(); refreshAll(); }).catch(function(err){ b.disabled=false; b.textContent='TRY AGAIN'; say(err.message); }); return; }
    if(a==='help'||a==='rep'){ if(a==='rep'&&!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent='⚑ Report it?'; return; }
      rpc('rv_mark',{p_id:id,p_kind:a==='help'?'helpful':'report'}).then(function(){ if(a==='rep')say('Reported. Thanks for keeping it fair.'); load(); }).catch(function(err){ say(err.message); }); return; }
    if(a==='del'){ if(!b.classList.contains('arm')){ b.classList.add('arm'); b.textContent='Delete it?'; return; }
      rpc('rv_remove',{p_id:id,p_topic:false}).then(function(){ say('Review removed'); OV=null; load(); refreshAll(); }).catch(function(err){ say(err.message); }); return; }
  });
  function celebrate(L,paid){ var d=document.createElement('div'); d.style.cssText='position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);z-index:9500;padding:22px 26px;border-radius:20px;background:linear-gradient(180deg,#2a1f08,#120d04);border:2px solid #f5b731;box-shadow:0 0 60px #f5b73166;text-align:center;color:#f7e7c2;font:600 14px Inter,system-ui,sans-serif;transition:transform .35s cubic-bezier(.2,1.4,.4,1),opacity .4s;opacity:0;pointer-events:none';
    d.innerHTML='<div style="font-size:46px">'+L[2]+'</div><div style="font:400 26px Anton,sans-serif;letter-spacing:.05em;color:#f5b731;margin:4px 0">'+E(L[1]).toUpperCase()+'</div><div>New reviewer rank'+(paid?' · +⬡'+paid:'')+'</div>';
    document.body.appendChild(d); requestAnimationFrame(function(){ d.style.opacity='1'; d.style.transform='translate(-50%,-50%) scale(1)'; });
    setTimeout(function(){ d.style.opacity='0'; setTimeout(function(){ d.remove(); },450); },2600); }

  /* ---------- Ports tab: the card + stars on every row ---------- */
  function portsCard(){ var scr=document.getElementById('scr-ports'); if(!scr||!window.SB||!window.__shkUid)return; var c=document.getElementById('rvCard');
    if(!c){ var anchor=scr.querySelector('.port-console'); if(!anchor)return; c=document.createElement('div'); c.id='rvCard'; c.className='rv-card'; anchor.parentNode.insertBefore(c,anchor); }
    overview().then(function(ov){ var rows=Object.keys(ov).map(function(k){ return [k,ov[k]]; }).filter(function(x){ return byKey(x[0]); }).sort(function(a,b){ return (b[1].avg-a[1].avg)||(b[1].n-a[1].n); });
      var total=rows.reduce(function(s,x){ return s+x[1].n; },0);
      c.innerHTML='<div class="rv-h">★ DOCK REVIEWS<small>'+total+' review'+(total===1?'':'s')+'</small></div><div class="rv-sub">Yelp for the docks — from casuals who worked them. Rate a dock, a boss, a gate, the lunch truck. ⬡25 for your first review of each dock.</div>'+
        (rows.length?'<div class="rv-top">'+rows.slice(0,5).map(function(x){ return '<button type="button" class="rv-tr" data-rvopen="'+E(x[0])+'"><b>'+E(nameOf(byKey(x[0])))+'</b>'+stars(x[1].avg)+'<em>'+x[1].avg.toFixed(1)+' · '+x[1].n+'</em></button>'; }).join('')+'</div>':'<div class="rv-sub" style="color:#f5b731">No reviews yet — be the first and set the bar.</div>')+
        '<button type="button" class="rv-go" data-rvpick="1">★ REVIEW A DOCK</button>';
      rowStars(ov); }).catch(function(){}); }
  function rowStars(ov){ document.querySelectorAll('#portList .pl-row[data-i]').forEach(function(r){ var t=T()[+r.getAttribute('data-i')], o=t&&ov[key(t)], x=r.querySelector('.rv-pill');
      if(!o){ x&&x.remove(); return; } if(!x){ x=document.createElement('span'); x.className='rv-pill'; var l2=r.querySelector('.pl-tag'); (l2||r).appendChild(x); } x.innerHTML='★ '+o.avg.toFixed(1)+' <span style="color:var(--steel,#8f979e);font-weight:600">('+o.n+')</span>'; }); }
  function picker(){ var s=document.getElementById('rvSheet'); if(s)s.remove(); s=document.createElement('div'); s.id='rvSheet';
    var list=T().filter(function(t){ return /^(LA|TI|LB)\b/.test(String(t.berths||'')); }).slice().sort(function(a,b){ return nameOf(a).localeCompare(nameOf(b)); });
    s.innerHTML='<div class="rv-in"><button type="button" class="rv-x" data-rvx="1">✕</button><div class="rv-k">★ DOCK REVIEWS</div><div class="rv-t">Which dock?</div><input id="rvFind" placeholder="Search — TTI, APM, Matson…" style="margin-top:12px">'+
      '<div id="rvList">'+list.map(function(t){ var o=OV&&OV[key(t)]; return '<button type="button" class="rv-item" data-rvopen="'+E(key(t))+'" data-s="'+E((nameOf(t)+' '+t.berths).toLowerCase())+'"><b>'+E(nameOf(t))+'</b>'+(o?stars(o.avg)+'<em>'+o.n+'</em>':'<em>'+E(t.berths)+'</em>')+'</button>'; }).join('')+'</div></div>';
    document.body.appendChild(s); s.addEventListener('click',function(e){ if(e.target===s||e.target.closest('[data-rvx]'))s.remove(); });
    s.querySelector('#rvFind').addEventListener('input',function(){ var q=this.value.toLowerCase().trim(); s.querySelectorAll('#rvList [data-s]').forEach(function(b){ b.style.display=!q||b.getAttribute('data-s').indexOf(q)>=0?'':'none'; }); }); }
  document.addEventListener('click',function(e){ var o=e.target.closest&&e.target.closest('[data-rvopen]'); if(o){ e.preventDefault(); e.stopPropagation(); var k=o.getAttribute('data-rvopen'); var s=document.getElementById('rvSheet'); s&&s.remove(); open(k,'read'); return; }
    if(e.target.closest&&e.target.closest('[data-rvpick]')){ e.preventDefault(); picker(); } },true);

  /* ---------- the dock sheet (openDock calls this) ---------- */
  window.rvDock=function(card,t){ if(!card||!t||!/^(LA|TI|LB)\b/.test(String(t.berths||'')))return; var k=key(t);
    var box=document.createElement('div'); box.className='rv-dock'; box.innerHTML='<div class="rv-h" style="font-size:17px">★ REVIEWS<small>loading…</small></div>';
    var acts=card.querySelector('.hd-acts'); if(acts&&acts.parentNode)acts.parentNode.insertBefore(box,acts.nextSibling); else card.appendChild(box);
    overview().then(function(ov){ var o=ov[k]; box.innerHTML='<div class="rv-h" style="font-size:17px">★ REVIEWS<small>'+(o?o.avg.toFixed(1)+' · '+o.n+' review'+(o.n===1?'':'s'):'none yet')+'</small></div>'+(o?'<div style="margin:4px 0 0">'+stars(o.avg,true)+'</div>':'<div class="rv-sub">Worked here? Be the first — ⬡25.</div>')+
      '<button type="button" class="rv-go" data-rvopen="'+E(k)+'">'+(o?'READ REVIEWS · WRITE ONE':'★ WRITE THE FIRST REVIEW')+'</button>'; }).catch(function(){ box.remove(); }); };

  /* ---------- Dockets: rate the dock you worked, under the job slip ---------- */
  function jobOf(id){ try{ return ((typeof DOCKETS!=='undefined'?DOCKETS:window.DOCKETS)||[]).filter(function(x){ return String(x._id)===String(id); })[0]||null; }catch(e){ return null; } }
  function termOf(j){ try{ var t=typeof dkTerminal==='function'?dkTerminal(j):null; if(!t&&typeof findTerminal==='function')t=findTerminal(j.terminal); return t&&/^(LA|TI|LB)\b/.test(String(t.berths||''))?t:null; }catch(e){ return null; } }
  var MINE={}, MINEat=0;
  function mine(){ if(Date.now()-MINEat<60000)return Promise.resolve(MINE); if(!window.SB||!window.__shkUid)return Promise.resolve(MINE);
    return window.SB.from('dock_reviews').select('dock,stars').eq('uid',window.__shkUid).is('topic_id',null).then(function(r){ MINE={}; (r.data||[]).forEach(function(x){ MINE[x.dock]=x.stars; }); MINEat=Date.now(); return MINE; }); }
  function docketCards(){ var list=document.getElementById('docketList'); if(!list)return;
    list.querySelectorAll('.dkn[data-dkn]').forEach(function(d){ var nx=d.nextElementSibling; if(nx&&nx.classList.contains('rvk'))return; var j=jobOf(d.getAttribute('data-dkn')), t=j&&termOf(j); if(!t)return;
      var k=key(t), c=document.createElement('div'); c.className='rvk'; c.setAttribute('data-k',k);
      c.innerHTML='<div class="rvk-t">★ RATE THIS DOCK</div><div class="rvk-q">How was '+E(t.aka||t.operator)+'?</div><div class="rvk-s">'+[1,2,3,4,5].map(function(i){ return '<button type="button" data-rvk="'+i+'">★</button>'; }).join('')+'</div><div class="rvk-m">Tap the stars — ⬡25 for your first review of this dock. Bosses, gates and the lunch truck too.</div>';
      d.parentNode.insertBefore(c,d.nextSibling);
      mine().then(function(m){ var v=m[k]; if(!v)return; c.querySelectorAll('[data-rvk]').forEach(function(b){ b.classList.toggle('on',+b.getAttribute('data-rvk')<=v); }); c.querySelector('.rvk-m').textContent='You gave it '+v+'★ — tap to update, read what others say, or rate a boss.'; }); }); }
  document.addEventListener('click',function(e){ var c=e.target.closest&&e.target.closest('.rvk'); if(!c)return; e.stopPropagation(); var b=e.target.closest('[data-rvk]'); open(c.getAttribute('data-k'),'write',b?+b.getAttribute('data-rvk'):0); },true);

  /* ---------- wiring ---------- */
  function refreshAll(){ MINEat=0; portsCard(); document.querySelectorAll('.rvk').forEach(function(x){ x.remove(); }); docketCards(); }
  var tm=null; function soon(){ clearTimeout(tm); tm=setTimeout(function(){ docketCards(); var pl=document.getElementById('portList'); if(pl&&OV)rowStars(OV); },60); }
  function hook(){ var dl=document.getElementById('docketList'); if(dl)new MutationObserver(soon).observe(dl,{childList:true,subtree:true});
    var pl=document.getElementById('portList'); if(pl)new MutationObserver(function(){ if(OV)rowStars(OV); }).observe(pl,{childList:true});
    var tries=0, iv=setInterval(function(){ tries++; if(window.SB&&window.__shkUid){ clearInterval(iv); portsCard(); docketCards(); } if(tries>60)clearInterval(iv); },1000);
    document.addEventListener('click',function(e){ if(e.target.closest&&e.target.closest('[data-scr="ports"]'))setTimeout(portsCard,150); }); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook); else hook();
  window.dockReviews={open:open,picker:picker};
})();
