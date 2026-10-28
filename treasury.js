/* treasury.js — #treasury (oct 24). The Chamber's TREASURY tab: the council fund's ledger.
   The Order's share of the money the app brings in goes here and is spent only on events and things that benefit the Order.
   #till(oct28): the server reports that share per month (app_share) as dollars only; the split behind it is the Keymaster's and is never sent here.
   Rules (enforced on the server):
     · every seat holder and the Keymaster can see the ledger; regular members can't.
     · the Treasurer (appointed by the Keymaster, must hold a seat) and the Keymaster keep the books.
     · money IN counts at once. Money OUT must name the council vote (motion) it came from, and only counts
       once the Keymaster signs off; the sign-off is announced at the Table.
     · nothing is deleted: a wrong line is voided with a reason and stays visible, struck through.
   Needs sc.js with the Treasury tab hook (oct24) and the server functions sc_treasury*, sc_treasurer_set.
   Load once from index.html, after sc.js is requested:  <script src="treasury.js?v=oct28a" defer></script> */
(function(){
  'use strict';
  if(window.__scTreasury)return; window.__scTreasury=true;
  var D=null, at=0, busy=false, err='';
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  function $m(c){ var n=Math.abs(+c||0)/100; return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
  function day(d){ try{ var p=String(d).split('-'); return new Date(+p[0],+p[1]-1,+p[2]).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }catch(e){ return d; } }

  var st=document.createElement('style'); st.textContent=
    '.sc-tre{display:flex;flex-direction:column;gap:12px}'+
    '.sc-tre .tb{padding:16px;border-radius:14px;background:linear-gradient(180deg,#1b2a1f,#0f1712);border:1px solid rgba(120,220,150,.28);text-align:center}'+
    '.sc-tre .tb small{display:block;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.2em;color:#8fd3a5}'+
    '.sc-tre .tb b{display:block;font:800 34px "Barlow Condensed",Inter,sans-serif;color:#eafff0;margin:4px 0 8px}'+
    '.sc-tre .tb .r{display:flex;justify-content:center;gap:16px;flex-wrap:wrap;font:600 12px Inter,system-ui,sans-serif;color:#b9c9be}'+
    '.sc-tre .tb .r em{font-style:normal;color:#fff}'+
    '.sc-tre .who{font:600 13px Inter,system-ui,sans-serif;color:#b9b2c4;line-height:1.45}.sc-tre .who b{color:#fff}'+
    '.sc-tre .fm{padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);display:flex;flex-direction:column;gap:8px}'+
    '.sc-tre .fm .k{display:flex;gap:6px}.sc-tre .fm .k button{flex:1;min-height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:none;color:#cfc8da;font:700 13px Inter,system-ui,sans-serif;cursor:pointer}'+
    '.sc-tre .fm .k button.on{background:#eafff0;color:#0f1712;border-color:#eafff0}.sc-tre .fm .k button.on.out{background:#ffd9d9;color:#2a0c0c;border-color:#ffd9d9}'+
    '.sc-tre .fm label{font:600 12px Inter,system-ui,sans-serif;color:#9d96a9}'+
    '.sc-tre .fm input,.sc-tre .fm select{width:100%;box-sizing:border-box;min-height:42px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.3);color:#fff;padding:0 10px;font:500 15px Inter,system-ui,sans-serif}'+
    '.sc-tre .fm .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}'+
    '.sc-tre .go{min-height:44px;border-radius:12px;border:0;background:#8fd3a5;color:#0f1712;font:800 14px Inter,system-ui,sans-serif;letter-spacing:.06em;cursor:pointer}'+
    '.sc-tre .ln{display:flex;gap:10px;align-items:flex-start;padding:11px 0;border-bottom:1px solid rgba(255,255,255,.07)}'+
    '.sc-tre .ln .m{flex:1;min-width:0}.sc-tre .ln .m b{display:block;font:600 14px Inter,system-ui,sans-serif;color:#fff;overflow-wrap:anywhere}'+
    '.sc-tre .ln .m span{display:block;font:500 12px Inter,system-ui,sans-serif;color:#9d96a9;margin-top:2px;line-height:1.4}'+
    '.sc-tre .ln .a{font:800 16px "Barlow Condensed",Inter,sans-serif;white-space:nowrap}.sc-tre .ln .a.in{color:#8fd3a5}.sc-tre .ln .a.out{color:#ff9a9a}'+
    '.sc-tre .ln.void .m b,.sc-tre .ln.void .a{text-decoration:line-through;opacity:.5}'+
    '.sc-tre .tag{display:inline-block;margin-top:5px;padding:2px 8px;border-radius:7px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.04em}'+
    '.sc-tre .ln .m span.tag{display:inline-block}'+
    '.sc-tre .tag.wait{background:#3a2a0b;color:#ffd27a}.sc-tre .tag.ok{background:#12301c;color:#8fd3a5}'+
    '.sc-tre .act{display:flex;gap:6px;margin-top:6px}.sc-tre .act button{min-height:34px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:none;color:#e6e0ee;font:700 12px Inter,system-ui,sans-serif;cursor:pointer}'+
    '.sc-tre .act button.sign{background:#8fd3a5;color:#0f1712;border-color:#8fd3a5}'+
    '.sc-tre .ap{padding:12px;border-radius:12px;background:rgba(143,211,165,.06);border:1px solid rgba(143,211,165,.2)}'+
    '.sc-tre .ap .ln{padding:9px 0}.sc-tre .ap .ln:last-child{border-bottom:0}'+
    '.sc-tre .rule{font:500 12px Inter,system-ui,sans-serif;color:#8a8496;line-height:1.5}';
  document.head.appendChild(st);

  var kind='in';
  function load(force){
    if(busy||!window.SB)return; if(!force&&D&&Date.now()-at<60000)return;
    busy=true;
    window.SB.rpc('sc_treasury').then(function(r){
      busy=false; at=Date.now();
      if(r.error){ err=r.error.message||'the ledger would not open'; } else { D=r.data; err=''; }
      try{ window.scRepaint&&window.scRepaint(); }catch(e){}
    },function(){ busy=false; err='No connection'; try{ window.scRepaint&&window.scRepaint(); }catch(e){} });
  }

  window.scTreasuryHTML=function(w){
    load(false);
    if(!D) return '<p class="sc-p dim">'+(err?E(err):'Opening the ledger\u2026')+'</p>';
    /* the Keymaster previewing a seat sees exactly what that seat sees: the form and buttons only if that seat is the Treasurer */
    var pv=!!(D.is_km&&w&&w.head===false), isKm=pv?false:!!D.is_km,
        canW=pv?!!(D.treasurer&&w.handle&&String(w.handle).toUpperCase()===String(D.treasurer).toUpperCase()):!!D.can_write;
    var h='<div class="sc-tre">';
    h+='<div class="tb"><small>COUNCIL FUND</small><b>'+$m(D.balance_cents)+'</b><div class="r"><span>In <em>'+$m(D.in_cents)+'</em></span><span>Spent <em>'+$m(D.out_cents)+'</em></span>'+((+D.pending_cents)?'<span>Awaiting sign-off <em>'+$m(D.pending_cents)+'</em></span>':'')+'</div></div>';
    h+='<div class="who">Treasurer: <b>'+(D.treasurer?E(D.treasurer):'not appointed yet')+'</b>'+(isKm?' \u00B7 <a href="#" data-tre="appoint" style="color:#8fd3a5">'+(D.treasurer?'change':'appoint')+'</a>':'')+'</div>';
    /* #till(oct28): the Order's share of app revenue, by month — dollars only */
    var ap=(D.app_share||[]);
    if(ap.length){
      var mn=function(m){ var p=String(m).split('-'); return new Date(+p[0],+p[1]-1,1).toLocaleDateString('en-US',{month:'long',year:'numeric'}); };
      h+='<div class="sc-sec">From the app</div><div class="ap">'+ap.map(function(a){
        var owed=Math.max(0,(+a.earned_cents||0)-(+a.paid_cents||0));
        /* #monthend(oct28): the share is paid in once the month is over */
        var sub=a.open?('so far this month \u00B7 paid into the fund at month end'):('paid into the fund '+$m(a.paid_cents)+(owed>0?' \u00B7 <b style="color:#ffd27a;display:inline">'+$m(owed)+' still to come in</b>':' \u00B7 all in'));
        var btn=(isKm&&owed>0&&!a.open)?'<div class="act"><button type="button" class="sign" data-tre="pay" data-m="'+E(a.month)+'" data-c="'+owed+'">Pay '+$m(owed)+' into the fund</button></div>':'';
        return '<div class="ln"><div class="m"><b>'+E(mn(a.month))+'</b><span>'+sub+'</span>'+btn+'</div><div class="a in">'+$m(a.earned_cents)+'</div></div>';
      }).join('')+'</div>';
    }
    if(canW){
      var mo=(D.motions||[]).map(function(m){ return '<option value="'+E(m.id)+'">'+E(m.title)+(m.state?' \u00B7 '+E(m.state):'')+'</option>'; }).join('');
      h+='<div class="fm"><div class="k"><button type="button" data-tre="k-in" class="'+(kind==='in'?'on':'')+'">+ Money in</button><button type="button" data-tre="k-out" class="'+(kind==='out'?'on out':'')+'">\u2212 Money out</button></div>'+
        '<div class="row"><div><label for="treAmt">Amount ($)</label><input id="treAmt" inputmode="decimal" placeholder="250.00"></div><div><label for="treOn">Date</label><input id="treOn" type="date"></div></div>'+
        '<div><label for="treMemo">'+(kind==='in'?'Where it came from':'What it was for')+'</label><input id="treMemo" maxlength="200" placeholder="'+(kind==='in'?'Raffle proceeds, donation\u2026':'Christmas party: hall deposit')+'"></div>'+
        (kind==='out'?'<div><label for="treMo">The council vote that approved it</label><select id="treMo"><option value="">Pick the motion\u2026</option>'+mo+'</select></div>':'')+
        '<button type="button" class="go" data-tre="add">'+(kind==='in'?'RECORD MONEY IN':'RECORD SPENDING \u00B7 SENDS FOR SIGN-OFF')+'</button></div>';
    }
    var rows=(D.entries||[]).map(function(t){
      var wait=t.kind==='out'&&!t.signed&&!t.voided;
      var sub=day(t.on)+(t.by?' \u00B7 by '+E(t.by):'')+(t.motion?' \u00B7 vote: '+E(t.motion):'')+(t.voided?' \u00B7 voided'+(t.void_reason?': '+E(t.void_reason):''):'');
      var tag=t.voided?'':wait?'<span class="tag wait">Awaiting the Keymaster\u2019s sign-off</span>':(t.kind==='out'?'<span class="tag ok">\u2713 Signed off by '+E(t.signed)+'</span>':'');
      var act='';
      if(!t.voided){
        if(wait&&isKm) act+='<button type="button" class="sign" data-tre="sign" data-id="'+t.id+'">Sign off</button>';
        if(canW) act+='<button type="button" data-tre="void" data-id="'+t.id+'">Void</button>';
      }
      return '<div class="ln'+(t.voided?' void':'')+'"><div class="m"><b>'+E(t.memo)+'</b><span>'+sub+'</span>'+tag+(act?'<div class="act">'+act+'</div>':'')+'</div><div class="a '+t.kind+'">'+(t.kind==='in'?'+':'\u2212')+$m(t.cents)+'</div></div>';
    }).join('');
    h+='<div class="sc-sec">The ledger</div>'+(rows||'<p class="sc-p dim">Nothing on the books yet.</p>');
    h+='<p class="rule">The council fund receives the Order\u2019s share of the money the app brings in. It is spent only on events and things that benefit the Order as a whole. Spending needs a council vote and the Keymaster\u2019s sign-off. Only the Treasurer and the Keymaster can enter lines.</p>';
    return h+'</div>';
  };

  function rpc(fn,args){ return window.SB.rpc(fn,args).then(function(r){ if(r.error)throw new Error(r.error.message||'refused'); return r.data; }); }
  function v(id){ var el=document.getElementById(id); return el?String(el.value||'').trim():''; }
  function clear(){ ['treAmt','treMemo','treOn','treMo'].forEach(function(id){ var el=document.getElementById(id); if(el)el.value=''; }); }

  document.addEventListener('click',function(ev){
    var b=ev.target.closest&&ev.target.closest('#scChamber [data-tre]'); if(!b||!window.SB)return;
    ev.preventDefault(); var a=b.getAttribute('data-tre');
    if(a==='k-in'||a==='k-out'){ kind=a==='k-in'?'in':'out'; try{ window.scRepaint(); }catch(e){} return; }
    if(a==='add'){
      var cents=Math.round(parseFloat(v('treAmt').replace(/[$,\s]/g,''))*100);
      if(!(cents>0)){ say('\u2717 Enter an amount'); return; }
      if(!v('treMemo')){ say('\u2717 Say what it is for'); return; }
      if(kind==='out'&&!v('treMo')){ say('\u2717 Pick the council vote that approved it'); return; }
      b.disabled=true;
      rpc('sc_treasury_add',{p_kind:kind,p_cents:cents,p_memo:v('treMemo'),p_motion:kind==='out'?v('treMo'):null,p_on:v('treOn')||null}).then(function(){
        clear(); say(kind==='in'?'\u2713 Recorded':'\u2713 Recorded \u00B7 waiting on the Keymaster'); load(true);
      },function(e){ b.disabled=false; say('\u2717 '+e.message); });
      return;
    }
    if(a==='sign'){
      if(!confirm('Sign off on this spending?'))return;
      rpc('sc_treasury_sign',{p_id:+b.getAttribute('data-id')}).then(function(){ say('\u2713 Signed off'); load(true); },function(e){ say('\u2717 '+e.message); });
      return;
    }
    if(a==='void'){
      var why=prompt('Why is this line being voided? (it stays on the ledger, struck through)'); if(why===null)return;
      rpc('sc_treasury_void',{p_id:+b.getAttribute('data-id'),p_reason:why}).then(function(){ say('\u2713 Voided'); load(true); },function(e){ say('\u2717 '+e.message); });
      return;
    }
    if(a==='pay'){
      var mm=b.getAttribute('data-m'), cc=+b.getAttribute('data-c')||0;
      if(!confirm('Record '+$m(cc)+' into the council fund as the Order\u2019s share for '+mm+'?'))return;
      b.disabled=true;
      rpc('sc_treasury_share_pay',{p_month:mm}).then(function(r){ say('\u2713 '+$m(r&&r.paid_cents)+' paid into the fund'); load(true); },function(e){ b.disabled=false; say('\u2717 '+e.message); });
      return;
    }
    if(a==='appoint'){
      var h=prompt('Treasurer\u2019s handle or Casual ID (must hold a seat):'); if(!h)return;
      rpc('sc_treasurer_set',{p_handle:h}).then(function(r){ say('\u2713 '+(r&&r.treasurer||'Treasurer')+' is the Treasurer'); load(true); },function(e){ say('\u2717 '+e.message); });
    }
  },true);
})();
