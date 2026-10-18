/* wire_letters.js — #wiremodel (oct 18). The Wire's stop, retrained on what actually happened.
   The server (wire_model) learns, per shift, from the last 10 finished boards:
     jpl  hall jobs per letter moved        dpl  members' posted job drops per letter moved
     a10  letters moved, 10-board average   prev letters the last board moved
     curve  share of a board's drops usually posted by each half hour after 6 AM / 4 PM
   Letters moved = weighted blend (weights that tested best on Sep–Oct, walk-forward):
     day   0.35·hall + 0.45·drops + 0.20·avg     → misses 1.73 letters on average (band ±2.5 = 80% of boards)
     night 0.40·hall + 0.40·drops + 0.20·last    → misses 2.47 (band ±3.3)
   Before drops come in it leans on hall + history (day 0.70/0.30, night 0.60/0.40) and the band is wider; as the
   drop count fills in (projected to its usual finish with the curve) the drop weight phases in.
   ONE answer feeds everything: the pumpkin, "moves about N letters" (no second casual count beside the gold box's),
   the STOP and band on the letter row, and the Hall card. Every prediction is logged next to the result
   (wire_pred_log / wire_scorecard) so the misses stay measured.
   Load once from index.html, after the Wire script:  <script src="wire_letters.js?v=oct18c" defer></script> */
(function(){
  'use strict';
  if(window.__wireLetters)return; window.__wireLetters=true;
  var AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ', NORMAL=45, PRESET={thin:10,normal:45,thick:90};
  var CNT={}, loadedAt=0, lastO=null, walked=null, MODEL=null, modelAt=0, info=null;
  function count(L){ var v=CNT[L]; return typeof v==='number'?v:NORMAL; }
  function counts(){ return AZ.split('').map(count); }
  function avg(){ var c=counts(), s=c.reduce(function(a,x){ return a+x; },0); return s/26||NORMAL; }
  function tier(n){ return n<=22?'thin':n>=68?'thick':'normal'; }

  /* walk: start at base (index of the start letter), consume `hires` casuals letter by letter */
  function walk(base,hires){
    var c=counts(), total=c.reduce(function(a,x){ return a+x; },0)||1, cycles=0, left=hires, i=base;
    if(hires<=0)return {idx:base,cycles:0,letters:0};
    cycles=Math.floor(hires/total); left=hires-cycles*total; var moved=cycles*26;
    while(left>0){ var n=c[i]||1; if(left<=n)break; left-=n; i=(i+1)%26; moved++; }
    return {idx:i,cycles:cycles,letters:moved};
  }

  function shiftNow(){ var slot=''; try{ slot=typeof callSlot!=='undefined'?String(callSlot):String(window.callSlot||''); }catch(e){} return /PM$/.test(slot)?'PM':'AM'; }
  function boardKey(){ try{ return (window._pmaLadder&&window._pmaLadder._key)||(typeof _predKey==='function'?_predKey():'')||window._publishedKey||''; }catch(e){ return ''; } }
  function hallNow(){ var lg=window._pmaLadder; if(lg&&!lg.stop&&+lg.H>0)return +lg.H; return 0; }
  function dropsNow(key){ try{ if(typeof dropKey==='function'&&dropKey()===key&&typeof dropUnion==='function')return +(dropUnion().total||0); }catch(e){} return 0; }
  function dropShare(m,sh){ try{ var n=new Date(), mi=n.getHours()*60+n.getMinutes()-(sh==='AM'?360:960); if(mi<0)return 0; var b=Math.min(9,Math.floor(mi/30)), c=m.curve||{}; var f0=+c[b]||0, f1=b<9?(+c[b+1]||f0):f0; return Math.max(0,Math.min(1,f0+(f1-f0)*((mi%30)/30))); }catch(e){ return 0; } }
  function casualsFor(base,letters){ var n=0; for(var k=0;k<letters;k++)n+=count(AZ[(base+k)%26]); return n; }
  function model(){ if(!window.SB)return; window.SB.rpc('wire_model').then(function(r){ if(r.error||!r.data)return; MODEL=r.data; modelAt=Date.now(); if(lastO)paint(lastO); },function(){}); }

  /* the prediction: letters moved, with a band */
  function predict(o){
    var sh=shiftNow(), m=MODEL&&MODEL[sh], H=hallNow(); if(!m||!H)return null;
    var key=boardKey(), dn=dropsNow(key), share=dn>0?dropShare(m,sh):0;
    var pH=H/(+m.jpl||130), pA=+m.a10||9, pP=(m.prev!=null?+m.prev:pA), w=m.w||{}, w0=m.w0||{};
    var base0=(+w0.hall||0)*pH+(+w0.avg||0)*pA+(+w0.prev||0)*pP;
    var L=base0, band=+m.band0||3.5, mae=+m.mae0||2.5, dW=0, pD=0;
    if(dn>0&&share>=0.25){
      pD=(dn/share)/(+m.dpl||45);
      var full=(+w.hall||0)*pH+(+w.drops||0)*pD+(+w.avg||0)*pA+(+w.prev||0)*pP;
      dW=Math.min(1,share/0.86);            /* drops phase in as they arrive; fully weighted once the usual bulk is in */
      L=(1-dW)*base0+dW*full; band=(1-dW)*(+m.band0||3.5)+dW*(+m.band||2.5); mae=(1-dW)*(+m.mae0||2.5)+dW*(+m.mae||2);
    }
    return {letters:Math.max(0,L), band:band, mae:mae, hall:H, drops:dn, share:share, dW:dW, pH:pH, pD:pD, sh:sh, key:key};
  }

  function paint(o){
    if(!o||typeof o.base!=='number')return;
    var start=AZ[o.base], lg=window._pmaLadder, holds=!!(lg&&lg.stop), P=holds?null:predict(o), L, lo, hi, source;
    if(P){ L=P.letters; lo=Math.max(0,L-P.band); hi=L+P.band; source=P.dW>0?'model+drops':'model'; }
    else { L=Math.max(0,o.med); lo=Math.max(0,o.lo); hi=Math.max(L,o.hi); source='app'; if(o.med<=0)holds=true; }
    var nL=Math.round(L), nLo=Math.round(lo), nHi=Math.round(hi);
    if(nL<1&&!holds&&P)nL=0;
    var stop=AZ[(o.base+nL)%26], loL=AZ[(o.base+nLo)%26], hiL=AZ[(o.base+nHi)%26], cycles=Math.floor(nL/26), hires=casualsFor(o.base,nL);
    if(holds||nL===0){ stop=start; }
    walked={stop:stop,lo:loL,hi:hiL,o:o,hires:hires,letters:nL};
    info=P?{source:source,hall:P.hall,drops:P.drops,share:Math.round(P.share*100)/100,dW:Math.round(P.dW*100)/100,mae:Math.round(P.mae*10)/10}:{source:source};
    try{ var lc=window._lastCall; if(lc&&(lc.stop!==walked.stop||lc.lo!==walked.lo||lc.hi!==walked.hi))window._lastCall=Object.assign({},lc); }catch(e){}
    logPred(o);
    var ps=document.getElementById('predStop'), mv=document.getElementById('wMoves'); if(!ps||!mv)return;
    if(holds||nL===0){ ps.textContent=start; mv.innerHTML='likely <b>holds</b> on '+start; track(0,0,0); return; }
    ps.textContent=cycles>0?'CYCLE':stop;
    var band=(loL===hiL)?'':' \u00B7 between <b>'+loL+'</b> and <b>'+hiL+'</b>';
    var via=P&&P.dW>0?' \u00B7 <span style="opacity:.75">'+Math.round(P.drops).toLocaleString()+' dropped so far</span>':'';
    mv.innerHTML='moves about <b>'+nL+' letter'+(nL===1?'':'s')+'</b> \u00B7 '+start+' &rarr; <b>'+stop+'</b>'+band+(cycles>0?' \u00B7 <b>cycles \u00D7'+cycles+'</b>':'')+via;
    track(nL,nLo,nHi);
    var old=document.getElementById('wlStrip'); if(old)old.remove();
  }
  /* the letter row under the pumpkin: STOP and band from the same answer */
  function track(nL,nLo,nHi){
    var tr=document.getElementById('wTrack'); if(!tr)return; var cells=tr.querySelectorAll('.wire-cell'); if(!cells.length)return;
    cells.forEach(function(c,k){
      c.classList.toggle('band',nL>0&&k>=nLo&&k<=nHi);
      var isStop=nL>0&&k===nL; c.classList.toggle('stop',isStop);
      var t=c.querySelector('.tick:not(.fresh)');
      if(t&&t.textContent==='STOP'&&!isStop)t.remove();
      if(isStop&&!(t&&t.textContent==='STOP')){ if(t&&t.textContent!=='START')t.remove(); var n=document.createElement('span'); n.className='tick'; n.textContent='STOP'; c.appendChild(n); }
    });
    if(nL>=cells.length)cells[cells.length-1].classList.add('band');
  }
  /* what the Wire told people, next to what happened */
  var _logged='';
  function logPred(o){
    try{
      if(!window.SB||!window.__shkUid||!walked)return; var k=boardKey(); if(!k)return;
      var sig=k+'|'+walked.stop+'|'+walked.lo+'|'+walked.hi; if(sig===_logged)return; _logged=sig;
      window.SB.rpc('wire_pred_put',{p:{k:k,stop:walked.stop,lo:walked.lo,hi:walked.hi,letters:walked.letters,hires:walked.hires,hall:info&&info.hall||null,jpl:MODEL&&MODEL[shiftNow()]?MODEL[shiftNow()].jpl:null,
        source:(info&&info.source||'app')+(info&&info.drops?' d'+info.drops+'@'+info.share:''),app_stop:AZ[((o.base+o.med)%26+26)%26],app_med:o.med}}).then(function(){},function(){});
    }catch(e){}
  }
  /* the Hall card reads window._lastCall: keep it on the same answer */
  (function(){ var cur=window._lastCall||null;
    try{ Object.defineProperty(window,'_lastCall',{configurable:true,get:function(){ return cur; },set:function(v){
      if(v&&walked&&lastO&&walked.o===lastO){ v=Object.assign({},v,{stop:walked.stop,lo:walked.lo,hi:walked.hi,headcount:true}); }
      cur=v; }}); }catch(e){}
  })();
  /* Keymaster edits: tap cycles thin → normal → thick; long-press asks for an exact number */
  var pressT=null, pressed=null;
  document.addEventListener('pointerdown',function(e){ var b=e.target.closest('#wlStrip .wl'); if(!b||!window.__isKM)return; pressed=b; pressT=setTimeout(function(){ pressT=null; var L=b.getAttribute('data-wl'), v=prompt('How many casuals are standing on '+L+'?', String(count(L))); if(v!=null&&v!==''&&isFinite(+v))setCount(L,Math.round(+v)); },550); },true);
  document.addEventListener('pointerup',function(e){ if(!pressT||!pressed)return; clearTimeout(pressT); pressT=null; var b=pressed; pressed=null; if(!e.target.closest('#wlStrip .wl'))return; var L=b.getAttribute('data-wl'), t=tier(count(L)), next=t==='thin'?'normal':t==='normal'?'thick':'thin'; setCount(L,PRESET[next]); },true);
  document.addEventListener('pointercancel',function(){ if(pressT)clearTimeout(pressT); pressT=null; pressed=null; },true);
  function setCount(L,n){
    CNT[L]=n; if(lastO)paint(lastO);
    if(!window.SB)return;
    window.SB.rpc('wire_letter_set',{p_letter:L,p_standing:n}).then(function(r){ if(r.error){ try{ toast('\u2717 '+(r.error.message||'did not save')); }catch(x){} load(); } },function(){ load(); });
  }
  function load(){
    if(!window.SB)return;
    window.SB.from('wire_letters').select('letter,standing').then(function(r){ if(r.error||!Array.isArray(r.data))return; CNT={}; r.data.forEach(function(x){ CNT[String(x.letter).toUpperCase()]=+x.standing; }); loadedAt=Date.now(); if(lastO)paint(lastO); });
  }
  function setCount(L,n){
    CNT[L]=n; if(lastO)paint(lastO);
    if(!window.SB)return;
    window.SB.rpc('wire_letter_set',{p_letter:L,p_standing:n}).then(function(r){ if(r.error){ try{ toast('\u2717 '+(r.error.message||'did not save')); }catch(x){} load(); } },function(){ load(); });
  }
  function load(){
    if(!window.SB)return;
    window.SB.from('wire_letters').select('letter,standing').then(function(r){ if(r.error||!Array.isArray(r.data))return; CNT={}; r.data.forEach(function(x){ CNT[String(x.letter).toUpperCase()]=+x.standing; }); loadedAt=Date.now(); if(lastO)paint(lastO); });
  }
  /* hook the Wire's renderer: the app draws, then we re-derive the stop from real headcounts */
  function hook(){
    var orig=window.renderWireStage; if(typeof orig!=='function'||orig.__wl){ return !!(orig&&orig.__wl); }
    var w=function(o){ var r=orig.apply(this,arguments); try{ lastO=o; paint(o); }catch(e){ try{ console.warn('wire_letters',e); }catch(x){} } return r; };
    w.__wl=true; window.renderWireStage=w;
    if(window._lastStageO){ lastO=window._lastStageO; paint(lastO); }
    return true;
  }
  function start(){ load(); model(); if(!hook()){ var t=setInterval(function(){ if(hook())clearInterval(t); },500); }
    setInterval(load,5*60*1000); setInterval(model,30*60*1000);
    setInterval(function(){ if(lastO)paint(lastO); },60000);   /* drops keep coming in: re-figure every minute */ }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start); else start();
  window.wireLettersReload=load;
  window.wireModel=function(){ return {model:MODEL,info:info,answer:walked&&{stop:walked.stop,lo:walked.lo,hi:walked.hi,letters:walked.letters,hires:walked.hires}}; };
})();
