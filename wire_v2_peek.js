/* wire_v2_peek.js — #v2peek (oct 30). The rebuilt call runs in shadow mode (wire_call_v2_log); members still see
   IN TRAINING. This shows the Keymaster what it's saying: a strip under the Wire card with the upcoming board's call
   (start · stop · band · letters · the inputs · when it locks), then the last six graded boards with the miss.
   Read-only, Keymaster only (hand_count_can). Refreshes every 60 s and whenever the Wire repaints.
   Load once from index.html, after hand_counts.js:  <script src="wire_v2_peek.js?v=oct30a" defer></script> */
(function(){
  'use strict';
  if(window.__wireV2Peek)return; window.__wireV2Peek=true;
  var can=null, lastUid=null, rows=null, t=null;
  function css(){ if(document.getElementById('v2pCSS'))return; var s=document.createElement('style'); s.id='v2pCSS'; s.textContent=
    '#v2p{margin:10px 14px 0;border-radius:12px;background:#0b0d0f;border:1px solid rgba(238,180,107,.35);padding:10px 12px}'+
    '#v2p .h{display:flex;align-items:center;gap:8px;font:600 10px Inter,system-ui,sans-serif;letter-spacing:.14em;color:#eeb46b;text-transform:uppercase}#v2p .h i{font-style:normal;color:#8f979e;margin-left:auto;letter-spacing:.08em}'+
    '#v2p .call{display:flex;align-items:baseline;gap:10px;margin-top:6px}#v2p .call b{font:400 34px Anton,sans-serif;color:#dcd6c9;line-height:1}#v2p .call span{font:700 14px "Barlow Condensed",sans-serif;letter-spacing:.06em;color:#dcd6c9}#v2p .call small{font:600 12px Inter,system-ui,sans-serif;color:#8f979e}'+
    '#v2p .in{margin-top:5px;font:600 11px Inter,system-ui,sans-serif;color:#8f979e;line-height:1.5}'+
    '#v2p .g{margin-top:8px;border-top:1px solid rgba(220,214,201,.08);padding-top:6px;display:grid;grid-template-columns:repeat(3,1fr);gap:4px 8px}#v2p .g div{font:600 11px Inter,system-ui,sans-serif;color:#8f979e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#v2p .g div b{color:#dcd6c9;font-weight:700}#v2p .g div .ok{color:#7fcf8a}#v2p .g div .bad{color:#e8967a}';
    document.head.appendChild(s); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c]; }); }
  function lbl(k){ return k.slice(5,10).replace('-','/')+' '+(k.slice(-2)==='AM'?'day':'night'); }
  function paint(){
    var card=document.getElementById('wireCard'); if(!card||!can||!rows)return;
    var el=document.getElementById('v2p'); if(!el){ css(); el=document.createElement('div'); el.id='v2p'; card.parentNode.insertBefore(el,card.nextSibling); }
    var up=rows.filter(function(r){ return r.actual_moved==null; })[0], done=rows.filter(function(r){ return r.actual_moved!=null&&r.locked_letters!=null; }).slice(0,6);
    var h='<div class="h">\u26A1 Wire v2 \u00B7 shadow call<i>Keymaster only</i></div>';
    if(up){ var fx=k2flex(up.k), inp=up.inputs||{};
      h+='<div class="call"><b>'+esc(up.stop)+'</b><span>'+esc(up.lo)+'\u2013'+esc(up.hi)+' \u00B7 '+(+up.letters).toFixed(1)+' letters</span><small>'+lbl(up.k)+' \u00B7 from '+esc(up.start_code||'?')+'</small></div>'+
         '<div class="in">hall '+esc(inp.hall_forecast)+' \u00B7 PMA '+esc(inp.pma_total)+' \u00B7 last board '+esc(inp.prev1)+' \u00B7 wave '+esc(inp.ew)+' \u00B7 '+(up.locked_at?'LOCKED '+when(up.locked_at):'locks '+(fx?when(fx):'at flex')+' \u00B7 updated '+when(up.computed_at))+'</div>'; }
    else h+='<div class="in">No call yet for the next board \u2014 waiting on the PMA sheet or the hall forecast.</div>';
    if(done.length){ h+='<div class="g">'+done.map(function(r){ var m=Math.abs(+r.locked_letters-r.actual_moved); return '<div>'+lbl(r.k)+' <b>'+(+r.locked_letters).toFixed(0)+'\u2192'+r.actual_moved+'</b> <span class="'+(m<=1?'ok':m<=2?'':'bad')+'">'+(m<=1?'\u2713':'\u00B1'+m.toFixed(0))+'</span></div>'; }).join('')+'</div>'; }
    el.innerHTML=h;
  }
  function k2flex(k){ try{ var d=k.slice(0,10), am=k.slice(-2)==='AM'; return new Date(d+'T'+(am?'06:30':'16:30')+':00'); }catch(e){ return null; } }
  function when(x){ var d=new Date(x); var h=d.getHours(),m=d.getMinutes(); return (h%12||12)+':'+(m<10?'0':'')+m+(h<12?'a':'p'); }
  function load(){ if(!window.SB||!can)return;
    window.SB.from('wire_call_v2_log').select('k,start_code,letters,stop,lo,hi,inputs,computed_at,locked_at,locked_letters,actual_moved').order('d',{ascending:false}).order('shift',{ascending:false}).limit(8)
      .then(function(r){ if(r.error||!Array.isArray(r.data))return; rows=r.data; paint(); }); }
  function check(){ if(!window.SB||!window.__shkUid){ can=false; return; } window.SB.rpc('hand_count_can').then(function(r){ can=!r.error&&r.data===true; if(can)load(); else { var e=document.getElementById('v2p'); e&&e.remove(); } },function(){}); }
  setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; can=null; var e=document.getElementById('v2p'); e&&e.remove(); if(u)setTimeout(check,1500); } },1000);
  setInterval(function(){ if(can)load(); },60000);
  new MutationObserver(function(){ clearTimeout(t); t=setTimeout(function(){ if(can&&rows&&!document.getElementById('v2p'))paint(); },200); }).observe(document.body,{childList:true,subtree:true});
})();
