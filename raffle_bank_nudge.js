/* raffle_bank_nudge.js — #rflbank (oct 16). When the raffle flyer or sheet tells a member they're short on Port Bucks
   ("You need N more ⬡ …"), add an ⬡ OPEN THE BANK button under it that opens the Bank (window.bankOpen), the same
   way the Armory's broke-sheet does. The earn-it-free line stays. Nothing here changes prices, caps, or the draw.
   Load once from index.html, after the raffle script:  <script src="raffle_bank_nudge.js" defer></script> */
(function(){
  'use strict';
  if(window.__rflBank)return; window.__rflBank=true;
  function nudge(box){
    if(!box||box.querySelector('.rfl-bank-go'))return;
    var note=null;
    box.querySelectorAll('.rfl-fly-note, .sub').forEach(function(p){ if(!note&&/You need [\d,]+ more/.test(p.textContent||''))note=p; });
    if(!note)return;
    var open=!(typeof window.mintOpen==='function')||window.mintOpen();
    var b=document.createElement('button');
    b.type='button'; b.className='btn rfl-bank-go'; b.style.cssText='width:100%;margin:8px 0 4px';
    b.innerHTML='\u2B21 OPEN THE BANK'+(open?'':' <span style="opacity:.75;font-size:11px;letter-spacing:.12em">\u00B7 MINT OPENS SOON</span>');
    b.addEventListener('click',function(){
      try{ var sh=document.getElementById('rflFlyer'); sh&&sh.classList.remove('on'); }catch(e){}
      try{ var s2=document.getElementById('rflSheet'); s2&&s2.classList.remove('on'); }catch(e){}
      try{ typeof window.bankOpen==='function'?window.bankOpen():(typeof gotoTab==='function'&&gotoTab('armory')); }catch(e){}
    });
    note.parentNode.insertBefore(b,note);
  }
  /* the draw clock's pumpkin is hardcoded; on a raffle that isn't the spooky theme, show a ball instead */
  function clockIcon(){
    document.querySelectorAll('#rflFClock, #rflClock, .rfl-fly-clock').forEach(function(c){
      var spooky=!!(c.closest('.t-spooky'));
      if(!spooky&&c.firstChild&&c.firstChild.nodeType===3&&/\uD83C\uDF83/.test(c.firstChild.nodeValue)) c.firstChild.nodeValue=c.firstChild.nodeValue.replace(/\uD83C\uDF83/,'\uD83C\uDFC0');
    });
  }
  /* #rflshort (oct 18): a member who's short used to get a greyed-out BUY that did nothing when tapped. Now BUY stays
     live and a short tap goes straight to the Bank — the main raffle's flyer and sheet (raffle_two.js does its own). */
  function unlock(box){
    if(!box)return;
    box.querySelectorAll('.rfl-buy[disabled]').forEach(function(b){ if(b.closest('[data-rfl2b]')||b.hasAttribute('data-rfl2b'))return; b.disabled=false; b.setAttribute('data-short','1'); });
  }
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('.rfl-buy[data-short]'); if(!b||b.hasAttribute('data-rfl2b'))return;
    e.preventDefault(); e.stopImmediatePropagation();
    var note=null, box=b.closest('#rflFlyBuy,#rflSheet'); if(box)box.querySelectorAll('.rfl-fly-note, .sub').forEach(function(p){ var m=/You need ([\d,]+) more/.exec(p.textContent||''); if(m&&!note)note=m[1]; });
    try{ toast('\u2B21 '+(note?'You need '+note+' more \u2B21 \u2014 ':'Not enough \u2B21 \u2014 ')+'opening the Bank'); }catch(x){}
    try{ var sh=document.getElementById('rflFlyer'); sh&&sh.classList.remove('on'); }catch(x){}
    try{ var s2=document.getElementById('rflSheet'); s2&&s2.classList.remove('on'); }catch(x){}
    setTimeout(function(){ try{ typeof window.bankOpen==='function'?window.bankOpen():(typeof gotoTab==='function'&&gotoTab('armory')); }catch(x){} },150);
  },true);
  function scan(){ ['rflFlyBuy','rflSheet'].forEach(function(id){ var el=document.getElementById(id); if(el){ nudge(el); unlock(el); } }); clockIcon(); }
  new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  scan();
})();
