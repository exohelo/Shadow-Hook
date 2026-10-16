/* raffle_two.js — #raffletwo (oct 16). index.html paints ONE raffle: the newest live one. This paints every OTHER live
   raffle beside it, so two can sell at once without either ending early. Each extra raffle gets its own chip in the
   header (next to #rflTag), its own banner under the main one (after #rflHost), its own flyer with countdown and buy bar,
   and its own minimize-to-button. Tickets go through the same server calls the main raffle uses — raffle_buy and
   raffle_state, both per raffle id — so entries, odds, caps and the draw are exactly as they'd be for a single raffle.
   Load once from index.html, after the raffle script:  <script src="raffle_two.js" defer></script> */
(function(){
  'use strict';
  if(window.__raffleTwo)return; window.__raffleTwo=true;
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var num=function(n){ return (+n||0).toLocaleString(); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var LS_MIN='shadowhook_rfl2_min', LS_SEEN='shadowhook_rfl2_seen', WINNER_DAYS=5, ROWS=[], ST={}, OPEN=null, qty=1, armed=0, busy=false;

  function phase(r){ if(!r)return 'none'; if(r.status==='drawn')return 'drawn'; if(r.status==='cancelled')return 'cancelled'; if(r.status==='draft')return 'draft'; if(r.status==='closed')return 'closed';
    if(r.opens_at&&new Date(r.opens_at)>Date.now())return 'soon'; if(r.closes_at&&new Date(r.closes_at)<=Date.now())return 'closed'; return 'live'; }
  function left(ts){ if(!ts)return ''; var ms=new Date(ts).getTime()-Date.now(); if(ms<=0)return 'closing'; var d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4),s=Math.floor(ms%6e4/1e3);
    return d>0?d+'d '+h+'h':h>0?h+'h '+m+'m':m+'m '+s+'s'; }
  function clock(ts){ var ms=Math.max(0,new Date(ts).getTime()-Date.now()); var d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4),s=Math.floor(ms%6e4/1e3); return d+'d '+h+'h '+m+'m '+s+'s'; }
  function when(ts){ try{ return new Date(ts).toLocaleString([], {weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }catch(e){ return ''; } }
  function bal(){ try{ if(typeof window.CREDITS==='number')return window.CREDITS; }catch(e){} try{ return +String((document.getElementById('meBucksV')||{}).textContent||'0').replace(/[^\d]/g,'')||0; }catch(e){ return 0; } }
  function safeUrl(u){ u=String(u||'').trim(); var m=/^builtin:([a-z0-9-]+)$/i.exec(u); if(m)return 'shk-raffle-'+m[1].toLowerCase()+'.webp'; return /^(https:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(u)?u:''; }
  function icon(r){ return r.theme==='spooky'?'\uD83C\uDF83':'\uD83C\uDFC0'; }

  /* ---- the main module keeps the newest live raffle; everything else live is ours ---- */
  function mainPick(rows){ return rows.find(function(x){ return x.status==='live'&&phase(x)!=='closed'; })||rows.find(function(x){ return x.status==='live'||x.status==='closed'; })||null; }
  async function load(){
    if(!window.SB)return;
    try{
      var r=await window.SB.from('raffles').select('*').in('status',['live','closed','drawn']).order('created_at',{ascending:false}).limit(12);
      if(r.error)throw r.error;
      var rows=r.data||[], main=mainPick(rows);
      /* ours: every live raffle the main module isn't showing, plus any winner drawn in the last five days */
      ROWS=rows.filter(function(x){ if(main&&x.id===main.id)return false; var ph=phase(x);
        return ph==='live'||ph==='soon'||(ph==='drawn'&&x.drawn_at&&Date.now()-new Date(x.drawn_at)<WINNER_DAYS*864e5); });
      for(var i=0;i<ROWS.length;i++){ try{ var s=await window.SB.rpc('raffle_state',{p_raffle:ROWS[i].id}); if(!s.error&&s.data)ST[ROWS[i].id]=s.data; }catch(e){} }
      paint(); if(OPEN)flyPaint(); reveal();
    }catch(e){ try{ console.warn('raffle_two load',e); }catch(x){} }
  }

  /* ---- borrow the main raffle's CSS for our flyer and chip by cloning its #rflFlyer / #rflTag rules ---- */
  function cloneCss(){
    if(document.getElementById('rfl2CSS'))return;
    var out=[];
    try{ Array.prototype.forEach.call(document.styleSheets,function(sh){ var rules; try{ rules=sh.cssRules; }catch(e){ return; } if(!rules)return;
      Array.prototype.forEach.call(rules,function(rule){ var t=rule.cssText||''; if(/#rflFlyer/.test(t)) out.push(t.replace(/#rflFlyer\b/g,'#rflFlyer2').replace(/#rflTag\b/g,'#rflTag2')); }); }); }catch(e){}
    var st=document.createElement('style'); st.id='rfl2CSS';
    st.textContent=out.join('\n')+
      '\n#rflHost2 .rfl-rail{margin-top:8px}'+
      '#rflFlyer2 .rfl2-stats{display:flex;justify-content:space-around;text-align:center;margin:10px 0 6px}#rflFlyer2 .rfl2-stats b{display:block;font-size:19px;color:var(--copper-hi)}#rflFlyer2 .rfl2-stats span{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--steel)}'+
      '#rflFlyer2 .rfl2-clock{border:1.5px solid rgba(238,180,107,.55);border-radius:14px;padding:10px 12px 9px;text-align:center;background:linear-gradient(180deg,rgba(238,180,107,.12),rgba(238,180,107,.04));margin-bottom:8px}#rflFlyer2 .rfl2-clock .k{font-family:Inter,system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:.24em;color:var(--copper-hi)}#rflFlyer2 .rfl2-clock b{display:block;font-family:Inter,system-ui,sans-serif;font-size:24px;letter-spacing:.04em;color:#fff;margin-top:4px}#rflFlyer2 .rfl2-clock small{display:block;font-size:12.5px;color:var(--steel);margin-top:2px}'+
      '.rfl2-min{display:inline-flex;align-items:center;gap:8px;margin:8px 0 0;padding:8px 14px;border-radius:999px;border:1px solid rgba(238,180,107,.5);background:linear-gradient(184deg,var(--btn-hi),var(--btn-lo));color:var(--copper-hi);font:700 12px/1 "Barlow Condensed",sans-serif;letter-spacing:.12em;cursor:pointer}';
    document.head.appendChild(st);
  }

  function paintChips(){ document.querySelectorAll('[data-rfl2chip]').forEach(function(e){ e.remove(); }); }

  /* ---- banner under the main one (or the minimized button) ---- */
  function paintBanners(){
    var host=document.getElementById('rflHost'); if(!host)return;
    var h2=document.getElementById('rflHost2'); if(!h2){ h2=document.createElement('div'); h2.id='rflHost2'; host.parentNode.insertBefore(h2,host.nextSibling); }
    var mins={}; try{ mins=JSON.parse(localStorage.getItem(LS_MIN)||'{}'); }catch(e){}
    h2.innerHTML=ROWS.map(function(r){
      var th=r.theme||'plain', ph=phase(r), tl=left(r.closes_at), st=ST[r.id]||{};
      if(ph==='drawn') return '<button class="rfl-rail" type="button" data-rfl2="reveal" data-id="'+E(r.id)+'"'+(th==='spooky'?' style="background:linear-gradient(92deg,#c2188f,#8a1cff);border:1.5px solid #b6ff3d;color:#fff"':'')+'><b'+(th==='spooky'?' style="color:#b6ff3d"':'')+'>\uD83C\uDFC6 WINNER</b><span>'+E(r.title)+' \u00B7 '+E(String(r.winner_handle||'\u2014'))+' \u00B7 ticket #'+num(r.winner_ticket)+' of '+num(r.total_at_draw)+'</span>\u25B8</button>';
      var t=E(r.title)+' \u00B7 '+num(r.ticket_price)+' \u2B21'+(ph==='live'&&tl?' \u00B7 ends '+tl:ph==='soon'?' \u00B7 opens '+left(r.opens_at):ph==='closed'?' \u00B7 draw soon':'')+(st.mine?' \u00B7 you hold '+st.mine:'');
      /* same row as the main raffle's rail (label · text · arrow); a spooky raffle keeps its colors by inline style, not by the t-spooky layout */
      var sty=th==='spooky'?' style="background:linear-gradient(92deg,#c2188f,#8a1cff);border:1.5px solid #b6ff3d;color:#fff"':'', bsty=th==='spooky'?' style="color:#b6ff3d"':'';
      return '<button class="rfl-rail" type="button" data-rfl2="open" data-id="'+E(r.id)+'"'+sty+'><b'+bsty+'>'+icon(r)+' RAFFLE</b><span>'+t+'</span>\u25B8</button>';
    }).join('');
  }
  function paint(){ cloneCss(); paintChips(); paintBanners(); }

  document.addEventListener('click',function(e){
    var a=e.target.closest('[data-rfl2]'); if(!a)return;
    var id=a.getAttribute('data-id'), r=ROWS.filter(function(x){ return x.id===id; })[0]; if(!r)return;
    var k=a.getAttribute('data-rfl2');
    if(k==='min'){ e.stopPropagation(); var mins={}; try{ mins=JSON.parse(localStorage.getItem(LS_MIN)||'{}'); }catch(x){} mins[id]=1; try{ localStorage.setItem(LS_MIN,JSON.stringify(mins)); }catch(x){} paintBanners(); return; }
    if(k==='open'){ e.preventDefault(); openFlyer(r); }
    if(k==='reveal'){ e.preventDefault(); try{ typeof window.rflReveal==='function'&&window.rflReveal(r,(ST[r.id]||{}).mine|0); }catch(x){} }
  },true);
  /* the draw: the app's own reveal animation, once per phone, for a raffle the main module isn't painting */
  function reveal(){
    if(!window.__shkUid||typeof window.rflReveal!=='function')return;
    var seen={}; try{ seen=JSON.parse(localStorage.getItem(LS_SEEN)||'{}'); }catch(e){}
    var r=ROWS.filter(function(x){ return phase(x)==='drawn'&&!seen[x.id]; })[0]; if(!r)return;
    seen[r.id]=1; try{ localStorage.setItem(LS_SEEN,JSON.stringify(seen)); }catch(e){}
    setTimeout(function(){ if(!document.getElementById('rflReveal'))window.rflReveal(r,(ST[r.id]||{}).mine|0); },1400);
  }

  /* ---- flyer: same shell as the main one (#rflFlyer2 wears its CSS), countdown + buy bar under the image ---- */
  function sheet(){
    var sh=document.getElementById('rflFlyer2'); if(sh)return sh;
    sh=document.createElement('div'); sh.id='rflFlyer2'; sh.className='sheet'; sh.setAttribute('role','dialog'); sh.setAttribute('aria-modal','true');
    sh.innerHTML='<div class="rfl-fly"><button type="button" class="rfl-fly-x" aria-label="Close">\u2715</button><div class="rfl-fly-scroll"><img alt=""></div><div class="rfl-fly-bar"><div class="rfl-fly-buy" id="rflFlyBuy2"></div></div></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click',function(e){ if(e.target===sh)shut(); });
    sh.querySelector('.rfl-fly-x').addEventListener('click',shut);
    return sh;
  }
  function shut(){ var sh=document.getElementById('rflFlyer2'); if(sh)sh.classList.remove('on'); OPEN=null; armed=0; }
  function openFlyer(r){
    var sh=sheet(), src=safeUrl(r.flyer_url)||safeUrl(r.image_url)||safeUrl(r.banner_url);
    var im=sh.querySelector('img'); if(im.getAttribute('src')!==src)im.src=src; im.alt=r.title||'The raffle';
    sh.classList.toggle('t-spooky',r.theme==='spooky');
    OPEN=r; qty=1; armed=0; flyPaint(); sh.querySelector('.rfl-fly-scroll').scrollTop=0; sh.classList.add('on');
    /* first opening shrinks the banner to a button next time, like the main raffle */
    var mins={}; try{ mins=JSON.parse(localStorage.getItem(LS_MIN)||'{}'); }catch(e){} if(!mins[r.id]){ mins[r.id]=1; try{ localStorage.setItem(LS_MIN,JSON.stringify(mins)); }catch(e){} paintBanners(); }
    try{ typeof sbRefreshBucks==='function'&&sbRefreshBucks(); }catch(e){}
    window.SB.rpc('raffle_state',{p_raffle:r.id}).then(function(s){ if(!s.error&&s.data){ ST[r.id]=s.data; flyPaint(); } });
  }
  function flyPaint(){
    var r=OPEN, box=document.getElementById('rflFlyBuy2'); if(!r||!box)return;
    var st=ST[r.id]||{total:0,entrants:0,mine:0}, ph=phase(r), signed=!!window.__shkUid, b=bal(), cap=+r.max_per_member||0, room=cap?Math.max(0,cap-(+st.mine||0)):99, cost=qty*(+r.ticket_price||0);
    var h='';
    if(r.closes_at) h+='<div class="rfl2-clock"><div class="k">'+icon(r)+' '+(ph==='soon'?'OPENS IN':'THE DRAW IN')+'</div><b id="rfl2Clock">'+clock(ph==='soon'?r.opens_at:r.closes_at)+'</b><small>'+E(when(ph==='soon'?r.opens_at:r.closes_at))+'</small></div>';
    h+='<div class="rfl2-stats"><div><b>'+num(st.total)+'</b><span>tickets in</span></div><div><b>'+num(st.entrants)+'</b><span>casuals</span></div><div><b>'+num(st.mine)+'</b><span>you hold</span></div><div><b>'+num(b)+'</b><span>\u2B21 stack</span></div></div>';
    if(ph==='soon') h+='<p class="sub rfl-fly-note">Tickets go on sale when the clock hits zero.</p>';
    else if(!signed) h+='<button class="btn rfl-fly-go" type="button" data-rfl2b="sign">\uD83C\uDF9F SIGN IN TO BUY TICKETS</button>';
    else if(cap&&room<=0) h+='<p class="sub rfl-fly-note">You hold the max \u2014 '+cap+' tickets. Good luck at the draw.</p>';
    else{
      h+='<div class="rfl-fly-row"><div class="rfl-step"><button type="button" data-rfl2b="minus" aria-label="One fewer">\u2212</button><div class="n">'+qty+'</div><button type="button" data-rfl2b="plus" aria-label="One more">+</button></div>'
        +'<button class="btn rfl-buy rfl-fly-go" type="button" data-rfl2b="buy"'+(b<cost?' disabled':'')+'>'+(armed===1?'TAP AGAIN TO CONFIRM \u00B7 ':'\uD83C\uDF9F BUY '+qty+' TICKET'+(qty>1?'S':'')+' \u00B7 ')+num(cost)+' \u2B21</button></div>';
      var bq=+r.bundle_qty||0, bp=+r.bundle_price||0;
      if(bq&&bp&&room>=bq){ var save=bq*r.ticket_price-bp; h+='<button class="btn-line gold rfl-buy rfl-fly-bundle" type="button" data-rfl2b="bundle"'+(b<bp?' disabled':'')+'>'+(armed===2?'TAP AGAIN TO CONFIRM \u00B7 ':'')+bq+' TICKETS \u00B7 '+num(bp)+' \u2B21'+(save>0?' \u00B7 SAVE '+num(save):'')+'</button>'; }
      if(b<r.ticket_price) h+='<p class="sub rfl-fly-note">You need '+num(r.ticket_price-b)+' more \u2B21 for a ticket.</p>'+(typeof window.bankOpen==='function'?'<button class="btn" type="button" data-rfl2b="bank" style="width:100%;margin-top:6px">\u2B21 OPEN THE BANK</button>':'');
    }
    h+='<div class="rfl-msg sub" id="rfl2Msg"></div>';
    if(st.mine&&st.total){ var odds=Math.round((st.mine||0)/st.total*1e3)/10; h+='<p class="sub rfl-fly-note">Your odds right now: <b>'+st.mine+' in '+num(st.total)+'</b> ('+odds+'%) \u00B7 one ticket is drawn at random on the server</p>'; }
    box.innerHTML=h;
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest('[data-rfl2b]'); if(!b||!OPEN)return; var k=b.getAttribute('data-rfl2b'), r=OPEN;
    if(k==='minus'){ qty=Math.max(1,qty-1); armed=0; flyPaint(); return; }
    if(k==='plus'){ var cap=+r.max_per_member||0, st=ST[r.id]||{}; qty=Math.min(cap?Math.max(1,cap-(+st.mine||0)):99,qty+1); armed=0; flyPaint(); return; }
    if(k==='sign'){ shut(); try{ typeof goGateForHandle==='function'&&goGateForHandle(); }catch(x){} return; }
    if(k==='bank'){ shut(); try{ window.bankOpen(); }catch(x){} return; }
    if(k==='buy'||k==='bundle'){
      var want=k==='buy'?1:2;
      if(armed!==want){ armed=want; flyPaint(); setTimeout(function(){ if(armed===want){ armed=0; flyPaint(); } },4000); return; }
      if(busy)return; busy=true; armed=0;
      window.SB.rpc('raffle_buy',{p_raffle:r.id,p_qty:k==='bundle'?(+r.bundle_qty||qty):qty,p_bundle:k==='bundle'}).then(function(res){
        busy=false;
        if(res.error){ say('\u2717 '+(res.error.message||'That did not go through.')); flyPaint(); return; }
        say('\u2713 You\u2019re in. Good luck at the draw.');
        try{ typeof sbRefreshBucks==='function'&&sbRefreshBucks(); }catch(x){}
        window.SB.rpc('raffle_state',{p_raffle:r.id}).then(function(s){ if(!s.error&&s.data)ST[r.id]=s.data; qty=1; flyPaint(); });
      },function(){ busy=false; say('\u2717 No connection. Try again.'); flyPaint(); });
    }
  },true);

  /* clocks */
  setInterval(function(){ var c=document.getElementById('rfl2Clock'); if(c&&OPEN)c.textContent=clock(phase(OPEN)==='soon'?OPEN.opens_at:OPEN.closes_at); },1000);
  setInterval(function(){ if(ROWS.length)paintChips(); },60000);
  /* load once the member is known, then every few minutes, and whenever the main raffle reloads */
  var lastUid=null; setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; setTimeout(load,1200); } },1000);
  setInterval(load,5*60*1000);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden)load(); });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){ setTimeout(load,1500); }); else setTimeout(load,1500);
  window.raffleTwoReload=load;
})();
