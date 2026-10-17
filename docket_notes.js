/* docket_notes.js — #jobslip (oct 17, v2). The assignment slip the terminal hands you — crane, lane, UTR #, row,
   your break, and the radio channels — typed into the app so it's there after the paper is gone.
   Open a job in DOCKETS (tap the row) → 📋 JOB SLIP sits right under "⚓ The dock":
     · CRANE · LANE (tap 1–6) · UTR # · ROW
     · LUNCH — tap which lunch the job got. Day: EARLY (8–10 & 12–1) · 11–1 · 12–2 · EARLY GO (12–1, home ~2:30).
       Night: EARLY (6–8 & 10–11) · 9–11 · 10–12 · EARLY GO (10–11, home ~12:30). OTHER for a split break.
     · CHANNELS — UTR · CLERK · DOCK BOSS · SUPERCARGO, plus "+ another" for anything else the slip names
       (VSL CLK, EXC CLK, PowerShop…). Each box offers what other casuals have typed for THIS dock (the Radio
       Book's data), and what you type goes into the Radio Book for the next casual — with the crane it went
       with. That's the whole point of the book: it feeds these boxes.
     · NOTES with ⏱ TIME for anything that happened
   Saves as you type. A 📋 on the row means the job has a slip. The slip is private to the member and follows
   their account to their other phones. Nothing here is used for scanning dockets or pay.
   Load once from index.html, after sc_jobs_links.js:  <script src="docket_notes.js?v=oct17b" defer></script> */
(function(){
  'use strict';
  if(window.__dkNotes)return; window.__dkNotes=true;
  function key(){ try{ return typeof K==='function'?K('dknotes'):null; }catch(e){ return null; } }
  function all(){ var k=key(); if(!k)return {}; try{ return JSON.parse(localStorage.getItem(k)||'{}')||{}; }catch(e){ return {}; } }
  function get(id){ return all()[id]||{}; }
  function hasAny(n){ return !!((n.crane||'').trim()||n.lane||(n.utr||'').trim()||(n.row||'').trim()||n.lunch||(n.txt||'').trim()||Object.keys(n.ch||{}).some(function(k){ return (n.ch[k]||'').trim(); })||(n.extra||[]).some(function(x){ return (x.v||'').trim(); })); }
  function put(id,n){ var k=key(); if(!k)return; var a=all(); if(!hasAny(n))delete a[id]; else { n.at=Date.now(); a[id]=n; } try{ localStorage.setItem(k,JSON.stringify(a)); }catch(e){} }

  var LUNCH={
    Day:[ ['early','EARLY','8\u201310 & 12\u20131'], ['11-1','11\u20131','11 AM \u2013 1 PM'], ['12-2','12\u20132','12 \u2013 2 PM'], ['go','EARLY GO','12\u20131 \u00B7 home about 2:30'] ],
    Night:[ ['early','EARLY','6\u20138 & 10\u201311'], ['9-11','9\u201311','9 \u2013 11 PM'], ['10-12','10\u201312','10 PM \u2013 12'], ['go','EARLY GO','10\u201311 \u00B7 home about 12:30'] ]
  };
  var CH=[ ['utr','UTR CH','UTR'], ['clerk','CLERK CH','Clerks'], ['boss','DOCK BOSS','Dock Boss'], ['super','SUPERCARGO','Supercargo'] ]; /* key · label · Radio Book title */
  function jobOf(id){ try{ return (typeof DOCKETS!=='undefined'?DOCKETS:window.DOCKETS||[]).filter(function(x){ return String(x._id)===String(id); })[0]||null; }catch(e){ return null; } }
  function shiftOf(id){ var j=jobOf(id); return j&&j.shift==='Day'?'Day':'Night'; }
  var opened={}; /* slips where the member asked for crane/lane on a non-ship job (this session) */
  function shipWork(id){ try{ var j=jobOf(id); if(!j)return true; var w=typeof dktWorkside==='function'?dktWorkside(j):null; if(!w)return true; return w.side==='ship'&&w.craft!=='clerk'; }catch(e){ return true; } }
  function dockOf(id){ try{ var j=jobOf(id); if(!j)return null; var t=typeof dkTerminal==='function'?dkTerminal(j):null; if(!t&&typeof findTerminal==='function')t=findTerminal(j.terminal); return t?{key:t.berths,name:[t.aka,t.operator].filter(Boolean).join(' \u00B7 ')}:null; }catch(e){ return null; } }
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  function clock(){ var d=new Date(),h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?' AM':' PM'); }

  /* ---------- the Radio Book feeds the channel boxes ---------- */
  var book={}; /* dock → rows */
  function bookLoad(dock,cb){
    if(!dock||!window.SB)return; var k=dock.key;
    window.SB.from('radio_channels').select('id,title,channel,crane,confirms,reports,hidden').eq('dock',k).then(function(r){ if(r.error||!Array.isArray(r.data))return; book[k]=r.data.filter(function(x){ return !x.hidden; }); cb&&cb(); });
  }
  function suggest(dock,title){
    var rows=(dock&&book[dock.key])||[], seen={}, out=[];
    rows.filter(function(r){ return r.title===title; }).sort(function(a,b){ return (b.confirms-b.reports)-(a.confirms-a.reports); }).forEach(function(r){ var v=String(r.channel); if(seen[v])return; seen[v]=1; out.push({v:v,crane:r.crane||''}); });
    return out;
  }
  /* what you typed goes into the book (once per dock · title · channel · crane) */
  function contribute(dock,title,chan,crane){
    if(!dock||!window.SB||!chan)return; chan=String(chan).trim().toUpperCase().replace(/^(CH|CHAN|CHANNEL)\.?\s*/,''); if(!chan)return;
    var rows=book[dock.key]||[]; crane=String(crane||'').trim().toUpperCase();
    if(rows.some(function(r){ return r.title===title&&String(r.channel).toUpperCase()===chan&&String(r.crane||'').toUpperCase()===crane; }))return;
    var me=null; try{ me=(typeof loadAcct==='function'&&(loadAcct()||{}).handle)||null; }catch(e){}
    window.SB.from('radio_channels').insert({dock:dock.key,dock_name:dock.name,title:title,channel:chan,crane:crane||null,note:'from a job slip',by_uid:window.__shkUid||null,by_handle:me}).select('id').then(function(r){ if(!r.error)bookLoad(dock); },function(){});
  }

  var st=document.createElement('style'); st.textContent=
    '.dkn{margin:12px 0 4px;padding:12px;border-radius:14px;background:var(--well,#0b0d0f);border:1px solid var(--line-soft,rgba(220,214,201,.1))}'+
    '.dkn-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.18em;color:var(--copper-hi,#eeb46b)}.dkn-h small{margin-left:auto;font-weight:600;letter-spacing:.06em;color:var(--steel,#8f979e)}'+
    '.dkn-g{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}'+
    '.dkn-f label{display:block;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.16em;color:var(--steel,#8f979e);margin:0 0 4px}'+
    '.dkn input,.dkn textarea{box-sizing:border-box;width:100%;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:500 16px Inter,system-ui,sans-serif;padding:8px 10px;outline:none}'+
    '.dkn input:focus,.dkn textarea:focus{border-color:var(--copper-hi,#eeb46b)}.dkn input.big{font:400 22px Anton,sans-serif;letter-spacing:.04em;text-align:center}.dkn textarea{min-height:84px;resize:vertical;line-height:1.4}'+
    '.dkn-top{display:grid;grid-template-columns:104px 1fr;gap:10px;margin:0 0 10px}.dkn-cr input{height:82px;font-size:40px!important}'+
    '.dkn-lanes{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.dkn-lane{height:38px;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:400 18px Anton,sans-serif;cursor:pointer;padding:0}.dkn-lane.on{background:var(--copper-hi,#eeb46b);border-color:var(--copper-hi,#eeb46b);color:var(--void,#0b0d0f)}'+
    '.dkn-lun{display:flex;gap:5px;flex-wrap:wrap}.dkn-lun button{flex:1;min-width:58px;height:34px;padding:0 6px;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:#000;color:var(--bone,#dcd6c9);font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.06em;cursor:pointer;white-space:nowrap}.dkn-lun button.on{background:var(--copper-hi,#eeb46b);border-color:var(--copper-hi,#eeb46b);color:var(--void,#0b0d0f)}.dkn-lun button.oth{flex:0 0 auto;border-style:dashed}'+
    '.dkn-ld{margin:-4px 0 10px;font:500 12px Inter,system-ui,sans-serif;color:var(--copper-hi,#eeb46b)}.dkn-ld:empty{display:none}'+
    '.dkn-sec{display:flex;align-items:center;gap:8px;margin:12px 0 8px;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.2em;color:var(--steel,#8f979e)}.dkn-sec:after{content:"";flex:1;height:1px;background:var(--line-soft,rgba(220,214,201,.12))}'+
    '.dkn-ch{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dkn-ch input{font:400 20px Anton,sans-serif;letter-spacing:.04em;text-align:center;color:#d8ffb0;background:linear-gradient(180deg,#05070a,#0c1008)}'+
    '.dkn-sg{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.dkn-sg button{height:24px;padding:0 8px;border-radius:12px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:none;color:var(--steel,#8f979e);font:700 11px Inter,system-ui,sans-serif;cursor:pointer}.dkn-sg button.on{border-color:var(--copper-hi,#eeb46b);color:var(--copper-hi,#eeb46b)}'+
    '.dkn-x{display:flex;gap:8px;align-items:flex-end;margin-top:8px}.dkn-x .k{flex:1}.dkn-x .v{flex:1}.dkn-x .rm{flex:none;width:34px;height:40px;border-radius:9px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:none;color:var(--steel,#8f979e);cursor:pointer}'+
    '.dkn-more{margin-top:8px;height:32px;padding:0 12px;border-radius:16px;border:1px dashed var(--line-soft,rgba(220,214,201,.25));background:none;color:var(--steel,#8f979e);font:700 11px Inter,system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}'+
    '.dkn-q{display:flex;gap:6px;margin:0 0 6px}.dkn-q button{height:30px;padding:0 12px;border-radius:15px;border:1px solid var(--line-soft,rgba(220,214,201,.14));background:none;color:var(--bone,#dcd6c9);font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.08em;cursor:pointer}'+
    '.dkn-has{display:inline-block;font-style:normal;margin-left:6px;font:600 11px Inter,system-ui,sans-serif;letter-spacing:.02em;color:var(--copper-hi,#eeb46b);vertical-align:1px;white-space:nowrap}'+
    '.dkn-clr{margin-left:8px;height:24px;padding:0 9px;border-radius:12px;border:1px solid rgba(224,73,46,.45);background:none;color:#e8967a;font:700 10px Inter,system-ui,sans-serif;letter-spacing:.12em;cursor:pointer}.dkn-clr.arm{background:#e0492e;border-color:#e0492e;color:#fff}';
  document.head.appendChild(st);

  function lunchText(id,n){ if(!n.lunch)return ''; if(n.lunch==='other')return 'Lunch: '+(n.lunchText||'\u2014'); var o=LUNCH[shiftOf(id)].filter(function(x){ return x[0]===n.lunch; })[0]; return o?'Lunch '+o[2]:''; }
  function chBox(key,label,val,sugs){
    var chips=sugs.slice(0,5).map(function(s){ return '<button type="button" data-sug="'+E(s.v)+'" class="'+(String(val).toUpperCase()===s.v.toUpperCase()?'on':'')+'">'+E(s.v)+(s.crane?' <i style="opacity:.6;font-style:normal">\u00B7 '+E(s.crane)+'</i>':'')+'</button>'; }).join('');
    return '<div class="dkn-f" data-ch="'+key+'"><label>'+label+'</label><input type="text" maxlength="16" data-chin="'+key+'" value="'+E(val||'')+'" placeholder="\u2014">'+(chips?'<div class="dkn-sg">'+chips+'</div>':'')+'</div>';
  }
  function block(id){
    var n=get(id), ch=n.ch||{}, dock=dockOf(id), lanes='', ship=shipWork(id)||opened[id]||!!((n.crane||'').trim()||n.lane||(n.utr||'').trim()||(n.row||'').trim());
    for(var i=1;i<=6;i++)lanes+='<button type="button" class="dkn-lane'+(String(n.lane)===String(i)?' on':'')+'" data-lane="'+i+'">'+i+'</button>';
    var d=document.createElement('div'); d.className='dkn'; d.setAttribute('data-dkn',id);
    d.innerHTML='<div class="dkn-h">\uD83D\uDCCB JOB SLIP<small class="dkn-s">only you see this</small>'+(hasAny(n)?'<button type="button" class="dkn-clr" title="Clear this slip">\u2715 CLEAR</button>':'')+'</div>'+
      (ship?'<div class="dkn-top"><div class="dkn-f dkn-cr"><label>CRANE #</label><input type="text" class="big dkn-crane" maxlength="12" inputmode="numeric" value="'+E(n.crane||'')+'" placeholder="\u2014"></div><div class="dkn-f dkn-ln"><label>LANE #</label><div class="dkn-lanes">'+lanes+'</div></div></div>'+
      '<div class="dkn-g"><div class="dkn-f"><label>UTR #</label><input type="text" class="dkn-utr" maxlength="12" value="'+E(n.utr||'')+'" placeholder="\u2014"></div><div class="dkn-f"><label>ROW</label><input type="text" class="dkn-row" maxlength="12" value="'+E(n.row||'')+'" placeholder="\u2014"></div></div>'
      :'<button type="button" class="dkn-more dkn-ship" style="margin:0 0 10px">+ CRANE \u00B7 LANE \u00B7 UTR \u00B7 ROW</button>')+
      '<div class="dkn-f" style="margin-bottom:10px"><label>LUNCH</label><div class="dkn-lun">'+LUNCH[shiftOf(id)].map(function(o){ return '<button type="button" data-lunch="'+o[0]+'" class="'+(n.lunch===o[0]?'on':'')+'" title="'+E(o[2])+'">'+o[1]+'</button>'; }).join('')+'<button type="button" class="oth'+(n.lunch==='other'?' on':'')+'" data-lunch="other">\u270E OTHER</button></div></div>'+
      '<div class="dkn-ld">'+E(lunchText(id,n))+'</div>'+
      '<div class="dkn-sec">CHANNELS'+(dock?' \u00B7 '+E(dock.name.split(' \u00B7 ')[0].toUpperCase()):'')+'</div>'+
      '<div class="dkn-ch">'+CH.map(function(c){ return chBox(c[0],c[1],ch[c[0]]||'',suggest(dock,c[2])); }).join('')+'</div>'+
      '<div class="dkn-extra">'+(n.extra||[]).map(function(x,i){ return '<div class="dkn-x" data-xi="'+i+'"><div class="k dkn-f"><label>WHAT</label><input type="text" maxlength="20" data-xk="'+i+'" value="'+E(x.k||'')+'" placeholder="VSL CLK"></div><div class="v dkn-f"><label>CHANNEL</label><input type="text" maxlength="16" data-xv="'+i+'" value="'+E(x.v||'')+'" placeholder="\u2014"></div><button type="button" class="rm" data-xrm="'+i+'">\u2715</button></div>'; }).join('')+'</div>'+
      '<button type="button" class="dkn-more">+ ANOTHER CHANNEL</button>'+
      '<div class="dkn-sec">NOTES</div>'+
      '<div class="dkn-q"><button type="button" data-stamp="">\u23F1 TIME</button></div>'+
      '<textarea class="dkn-txt" maxlength="4000" placeholder="Reminders, anything that happened\u2026">'+E(n.txt||'')+'</textarea>';
    if(dock&&!book[dock.key])bookLoad(dock,function(){ /* refresh the suggestion chips once the book is in */
      var live=document.querySelector('.dkn[data-dkn="'+CSS.escape(id)+'"]'); if(!live)return; var cur=get(live.getAttribute('data-dkn')), cc=cur.ch||{};
      CH.forEach(function(c){ var f=live.querySelector('.dkn-f[data-ch="'+c[0]+'"]'); if(!f)return; var inp=f.querySelector('input'); f.outerHTML=chBox(c[0],c[1],inp.value||cc[c[0]]||'',suggest(dock,c[2])); });
    });
    return d;
  }
  function read(d){
    var on=d.querySelector('.dkn-lane.on'), id=d.getAttribute('data-dkn'), old=get(id), ch={}, extra=[];
    d.querySelectorAll('[data-chin]').forEach(function(i){ ch[i.getAttribute('data-chin')]=i.value; });
    d.querySelectorAll('.dkn-x').forEach(function(x){ extra.push({k:x.querySelector('[data-xk]').value,v:x.querySelector('[data-xv]').value}); });
    var v=function(sel,fb){ var el=d.querySelector(sel); return el?el.value:(fb||''); };
    return {crane:v('.dkn-crane',old.crane), lane:d.querySelector('.dkn-lanes')?(on?+on.getAttribute('data-lane'):0):(old.lane||0), utr:v('.dkn-utr',old.utr), row:v('.dkn-row',old.row),
      lunch:old.lunch||'', lunchText:old.lunchText||'', ch:ch, extra:extra, txt:v('.dkn-txt',old.txt)};
  }
  var saveT=null;
  function save(d){ var n=read(d); put(d.getAttribute('data-dkn'),n); var s=d.querySelector('.dkn-s'); if(s)s.textContent='saved \u2713';
    var h=d.querySelector('.dkn-h'), c=h&&h.querySelector('.dkn-clr'); if(h&&hasAny(n)&&!c){ c=document.createElement('button'); c.type='button'; c.className='dkn-clr'; c.title='Clear this slip'; c.textContent='\u2715 CLEAR'; h.appendChild(c); }
    clearTimeout(saveT); saveT=setTimeout(mark,400); }

  document.addEventListener('input',function(e){ var d=e.target.closest&&e.target.closest('.dkn'); if(d)save(d); });
  /* a channel box, once left, feeds the Radio Book */
  document.addEventListener('focusout',function(e){
    var i=e.target; if(!i||!i.closest||!i.closest('.dkn'))return; var d=i.closest('.dkn'), id=d.getAttribute('data-dkn'), dock=dockOf(id), crane=d.querySelector('.dkn-crane').value;
    if(i.hasAttribute('data-chin')){ var c=CH.filter(function(x){ return x[0]===i.getAttribute('data-chin'); })[0]; if(c)contribute(dock,c[2],i.value,crane); }
    if(i.hasAttribute('data-xv')){ var x=i.closest('.dkn-x'), k=(x.querySelector('[data-xk]').value||'').trim(); if(k)contribute(dock,k.replace(/\s+/g,' ').replace(/\b\w/g,function(m){ return m.toUpperCase(); }),i.value,crane); }
  },true);
  document.addEventListener('click',function(e){
    var d=e.target.closest&&e.target.closest('.dkn'); if(!d)return;
    e.stopPropagation();
    var id=d.getAttribute('data-dkn');
    if(e.target.closest('.dkn-ship')){ opened[id]=1; d.replaceWith(block(id)); var ci=document.querySelector('.dkn[data-dkn="'+CSS.escape(id)+'"] .dkn-crane'); ci&&ci.focus(); return; }
    var clr=e.target.closest('.dkn-clr');
    if(clr){ if(!clr.classList.contains('arm')){ clr.classList.add('arm'); clr.textContent='\u2715 CLEAR IT?'; setTimeout(function(){ clr.classList.remove('arm'); clr.textContent='\u2715 CLEAR'; },3000); return; }
      var k=key(); if(k){ var a=all(); delete a[id]; try{ localStorage.setItem(k,JSON.stringify(a)); }catch(x){} } d.replaceWith(block(id)); mark(); try{ toast('Slip cleared'); }catch(x){} return; }
    var ln=e.target.closest('.dkn-lane');
    if(ln){ var was=ln.classList.contains('on'); d.querySelectorAll('.dkn-lane').forEach(function(b){ b.classList.remove('on'); }); if(!was)ln.classList.add('on'); save(d); return; }
    var lu=e.target.closest('[data-lunch]');
    if(lu){ var cur=get(id), pick=lu.getAttribute('data-lunch');
      if(pick==='other'){ var v=prompt('What was the lunch? (e.g. 10\u201311 & 1\u20132, clerk split)', cur.lunchText||''); if(v==null)return; v=String(v).trim(); cur.lunch=v?'other':''; cur.lunchText=v; }
      else { cur.lunch=cur.lunch===pick?'':pick; cur.lunchText=''; }
      var now=read(d); now.lunch=cur.lunch; now.lunchText=cur.lunchText; put(id,now);
      d.querySelectorAll('[data-lunch]').forEach(function(b){ b.classList.toggle('on',b.getAttribute('data-lunch')===cur.lunch); });
      var ld=d.querySelector('.dkn-ld'); if(ld)ld.textContent=lunchText(id,cur); mark(); return; }
    var sg=e.target.closest('[data-sug]');
    if(sg){ var f=sg.closest('.dkn-f'), inp=f.querySelector('input'); inp.value=inp.value.toUpperCase()===sg.getAttribute('data-sug').toUpperCase()?'':sg.getAttribute('data-sug'); f.querySelectorAll('[data-sug]').forEach(function(b){ b.classList.toggle('on',b===sg&&!!inp.value); }); save(d); return; }
    if(e.target.closest('.dkn-more')){ var n=read(d); n.extra=(n.extra||[]).concat([{k:'',v:''}]); put(id,n); var fresh=block(id); d.replaceWith(fresh); var last=fresh.querySelector('.dkn-x:last-child [data-xk]'); last&&last.focus(); return; }
    var rm=e.target.closest('[data-xrm]');
    if(rm){ var n2=read(d); n2.extra.splice(+rm.getAttribute('data-xrm'),1); put(id,n2); d.replaceWith(block(id)); mark(); return; }
    var q=e.target.closest('[data-stamp]');
    if(q){ var ta=d.querySelector('.dkn-txt'), v2=ta.value; if(v2&&!/\n$/.test(v2))v2+='\n'; ta.value=v2+clock()+' \u2014 '; ta.focus(); try{ ta.setSelectionRange(ta.value.length,ta.value.length); }catch(x){} save(d); }
  });

  /* 📋 on rows that have a slip; the pad inside each opened job, right under The dock */
  function mark(){
    var list=document.getElementById('docketList'); if(!list)return; var a=all();
    list.querySelectorAll('.jx-row[data-id]').forEach(function(r){
      var n=a[r.getAttribute('data-id')], has=!!n, b=r.querySelector('.n b'), i=r.querySelector('.dkn-has');
      var sum=has?[n.crane?'Crane '+n.crane:'',n.lane?'Lane '+n.lane:'',(n.ch&&n.ch.utr)?'UTR ch '+n.ch.utr:''].filter(Boolean).join(' \u00B7 '):'';
      if(has&&!i&&b){ i=document.createElement('i'); i.className='dkn-has'; i.title='Has a job slip'; b.appendChild(i); }
      if(has&&i)i.textContent='\uD83D\uDCCB'+(sum?' '+sum:'');
      else if(!has&&i)i.remove();
    });
  }
  function fill(){
    var list=document.getElementById('docketList'); if(!list)return;
    list.querySelectorAll('.jx-row.lit[data-id]').forEach(function(r){
      var p=r.nextElementSibling; if(!p||p.querySelector('.dkn'))return;
      var id=r.getAttribute('data-id'); if(!id)return;
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
