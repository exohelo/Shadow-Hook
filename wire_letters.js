/* wire_letters.js — #wireletters (oct 16). The Wire predicts how many LETTERS the board moves, as if every letter held
   the same number of casuals. The hall isn't like that: a thin letter with ten standing goes by in one call, a thick
   one holds the board. This keeps the app's prediction of HOW MUCH work drops (the hard part) and fixes WHERE it lands:
     - the Keymaster sets how many casuals are standing on each letter (THIN ≈ 10 · NORMAL ≈ 45 · THICK ≈ 90, or an
       exact number); every phone reads the table (wire_letters)
     - the app's median / low / high letters-moved are turned into casual hires using the average headcount, then
       walked from the start letter subtracting each letter's real headcount, wrapping past Z and counting cycles
     - the stop is shown as a BAND (low → high), not one letter, because the jobs that drop are the uncertain part
   Load once from index.html, after the Wire script:  <script src="wire_letters.js" defer></script> */
(function(){
  'use strict';
  if(window.__wireLetters)return; window.__wireLetters=true;
  var AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ', NORMAL=45, PRESET={thin:10,normal:45,thick:90};
  var CNT={}, loadedAt=0, lastO=null, walked=null;
  /* #wl4 (oct 18): calibrate on what boards actually did. For each of the last boards with a result and a hall count
     we add up the real headcount of every letter it moved through, so "hall jobs per casual hired" is learned with
     the same standings the walk uses. Learned per shift from the last 10; the band is the rule's recent error. */
  var CAL={AM:null,PM:null}, calAt=0;
  function casualsBetween(start,end){ var a=AZ.indexOf(String(start||'')[0]), b=AZ.indexOf(String(end||'')[0]); if(a<0||b<0)return 0; var n=0, i=a; while(i!==b){ n+=count(AZ[i]); i=(i+1)%26; if(n>5000)break; } return n; }
  function calibrate(){
    if(!window.SB)return;
    window.SB.rpc('wire_recent_boards',{p_n:24}).then(function(r){ if(r.error||!Array.isArray(r.data))return;
      ['AM','PM'].forEach(function(sh){
        var rows=r.data.filter(function(x){ return x.k.slice(-2)===sh; }).slice(0,10), jobs=0, cas=0, errs=[];
        rows.forEach(function(x){ var c=casualsBetween(x.start_card,x.end_card); if(c>0){ jobs+=x.hall; cas+=c; } });
        if(cas>0){ var jpc=jobs/cas;
          /* how far off this rule was on each of those boards, in letters */
          rows.forEach(function(x){ var c=casualsBetween(x.start_card,x.end_card); if(c<=0)return; var predL=walk(AZ.indexOf(x.start_card[0]),x.hall/jpc).letters; errs.push(Math.abs(predL-x.act)); });
          var mae=errs.length?errs.reduce(function(a,b){ return a+b; },0)/errs.length:2.5;
          CAL[sh]={jpc:jpc,n:rows.length,mae:Math.max(1.5,mae),upto:rows[0]&&rows[0].k}; }
      });
      calAt=Date.now(); if(lastO)paint(lastO);
    },function(){});
  }
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
  function walkLetters(base,L){ var n=Math.max(0,Math.round(L)); return {idx:(base+n)%26,cycles:Math.floor(n/26),letters:n}; }
  var walkedCal=null;
  function paint(o){
    if(!o||typeof o.base!=='number')return;
    /* #wl3 (oct 18): ONE number of casual hires drives everything. The app's own count ("→ ~311 to casuals",
       window._pmaLadder.casual) wins when it's there; letters-moved × average headcount only fills in when it isn't.
       The low/high band scales off the same number. Pumpkin, "about N casuals", the letter track and the Hall card
       all read this one walk. */
    var a=avg(), start=AZ[o.base], lg=window._pmaLadder, hires, lo, hi, w, source='app';
    var slot=''; try{ slot=typeof callSlot!=='undefined'?String(callSlot):String(window.callSlot||''); }catch(e){} var sh=/PM$/.test(slot)?'PM':'AM', cal=CAL[sh], H=lg&&!lg.stop&&+lg.H>0?+lg.H:0;
    if(cal&&H>0&&o.med>0){
      /* calibrated: hall jobs ÷ learned jobs-per-casual, then walked through the real headcounts */
      hires=H/cal.jpc; source='calib';
      w=walk(o.base,hires);
      var bandL=cal.mae;   /* letters either side */
      lo=walkLetters(o.base,Math.max(0,w.letters-bandL)); hi=walkLetters(o.base,w.letters+bandL);
    } else {
      if(lg&&!lg.stop&&+lg.casual>0&&o.med>0){ hires=+lg.casual; source='app-casual'; } else hires=Math.max(0,o.med)*a;
      var per=o.med>0?hires/o.med:a;
      w=walk(o.base,hires); lo=walk(o.base,Math.max(0,o.lo)*per); hi=walk(o.base,Math.max(0,o.hi)*per);
      if(lo.letters>w.letters)lo=w; if(hi.letters<w.letters)hi=w;
    }
    walkedCal={source:source,H:H,jpc:cal&&cal.jpc};
    var stop=AZ[w.idx], loL=AZ[lo.idx], hiL=AZ[hi.idx], holds=o.med<=0||(lg&&lg.stop);
    walked={stop:holds?start:stop,lo:loL,hi:hiL,o:o,hires:Math.round(hires),letters:w.letters};   /* the Hall card reads this too (see _lastCall below) */
    logPred(o,walked,holds);
    try{ var lc=window._lastCall; if(lc&&(lc.stop!==walked.stop||lc.lo!==walked.lo||lc.hi!==walked.hi))window._lastCall=Object.assign({},lc); }catch(e){}
    var ps=document.getElementById('predStop'), mv=document.getElementById('wMoves'); if(!ps||!mv)return;
    if(holds){ ps.textContent=start; mv.innerHTML='likely <b>holds</b> on '+start; }
    else{
      ps.textContent=w.cycles>0?'CYCLE':stop;
      var band=(loL===hiL)?'':' \u00B7 between <b>'+loL+'</b> and <b>'+hiL+'</b>';
      var cyc=w.cycles>0?' \u00B7 <b>cycles \u00D7'+w.cycles+'</b>':'';
      mv.innerHTML='about <b>'+Math.round(hires).toLocaleString()+' casuals</b> \u00B7 '+start+' &rarr; <b>'+stop+'</b>'+band+cyc;
    }
    track(holds?{letters:0,cycles:0}:w,holds?{letters:0}:lo,holds?{letters:0}:hi);
    var old=document.getElementById('wlStrip'); if(old)old.remove();
  }
  /* the letter track under the pumpkin: STOP and the band come from the same walk */
  function track(w,lo,hi){
    var tr=document.getElementById('wTrack'); if(!tr)return;
    var cells=tr.querySelectorAll('.wire-cell'); if(!cells.length)return;
    var cyc=w.cycles>0;
    cells.forEach(function(c,k){
      c.classList.toggle('band',!cyc&&k>=lo.letters&&k<=hi.letters);
      var isStop=!cyc&&k===w.letters&&k>0;
      c.classList.toggle('stop',isStop);
      var t=c.querySelector('.tick:not(.fresh)');
      if(t&&t.textContent==='STOP'&&!isStop)t.remove();
      if(isStop&&!(t&&t.textContent==='STOP')){ if(t&&t.textContent!=='START')t.remove(); var n=document.createElement('span'); n.className='tick'; n.textContent='STOP'; c.appendChild(n); }
    });
    /* the stop may be past the end of the track the app drew */
    if(!cyc&&w.letters>=cells.length){ var last=cells[cells.length-1]; last.classList.add('band'); }
  }
  /* the letter strip: what the Keymaster set, thin letters dim and small; tap to change when you're the Keymaster */
  function strip(o,w,lo,hi){
    var tr=document.getElementById('wTrack'); if(!tr)return;
    var el=document.getElementById('wlStrip'); if(!el){ el=document.createElement('div'); el.id='wlStrip'; tr.parentNode.insertBefore(el,tr.nextSibling); css(); }
    var km=!!window.__isKM, inBand=function(i){ var a=lo.idx,b=hi.idx; if(a<=b)return i>=a&&i<=b; return i>=a||i<=b; };
    el.innerHTML='<div class="wl-k">STANDING ON EACH LETTER'+(km?' \u00B7 <span>tap a letter to change it</span>':'')+'</div><div class="wl-row">'+AZ.split('').map(function(L,i){
      var n=count(L), t=tier(n), cls='wl '+t+(i===o.base?' start':'')+(i===w.idx?' stop':'')+(inBand(i)?' band':'');
      return '<button type="button" class="'+cls+'" data-wl="'+L+'"'+(km?'':' disabled')+'><b>'+L+'</b><i>'+n+'</i></button>';
    }).join('')+'</div>'+(km?'<div class="wl-help">THIN 10 \u00B7 NORMAL 45 \u00B7 THICK 90 \u00B7 long-press for an exact number</div>':'');
  }
  function css(){
    var st=document.createElement('style'); st.textContent=
      '#wlStrip{margin:6px 2px 10px}#wlStrip .wl-k{font:700 10px Inter,system-ui,sans-serif;letter-spacing:.2em;color:var(--steel);margin:0 0 6px}#wlStrip .wl-k span{letter-spacing:.04em;text-transform:none;font-weight:600;color:var(--copper)}'+
      '#wlStrip .wl-row{display:grid;grid-template-columns:repeat(13,1fr);gap:3px}'+
      '#wlStrip .wl{border:1px solid var(--line-soft);border-radius:6px;background:var(--well);padding:3px 0 2px;text-align:center;font:inherit;color:var(--bone);cursor:pointer;line-height:1}#wlStrip .wl:disabled{cursor:default}'+
      '#wlStrip .wl b{display:block;font:700 12px "Barlow Condensed",sans-serif;letter-spacing:.04em}#wlStrip .wl i{display:block;font:600 8.5px Inter,system-ui,sans-serif;font-style:normal;color:var(--steel);margin-top:1px}'+
      '#wlStrip .wl.thin{opacity:.55;transform:scale(.9)}#wlStrip .wl.thick{border-color:rgba(238,180,107,.5)}#wlStrip .wl.band{background:rgba(238,180,107,.1)}'+
      '#wlStrip .wl.start{border-color:var(--copper-hi);color:var(--copper-hi)}#wlStrip .wl.stop{background:var(--copper-hi);color:var(--void)}#wlStrip .wl.stop i{color:var(--void)}'+
      '#wlStrip .wl-help{font:600 10px Inter,system-ui,sans-serif;letter-spacing:.08em;color:var(--steel);margin-top:6px;text-align:center}';
    document.head.appendChild(st);
  }
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
    window.SB.from('wire_letters').select('letter,standing').then(function(r){ if(r.error||!Array.isArray(r.data))return; CNT={}; r.data.forEach(function(x){ CNT[String(x.letter).toUpperCase()]=+x.standing; }); loadedAt=Date.now(); if(!calAt)calibrate(); if(lastO)paint(lastO); });
  }
  /* hook the Wire's renderer: the app draws, then we re-derive the stop from real headcounts */
  function hook(){
    var orig=window.renderWireStage; if(typeof orig!=='function'||orig.__wl){ return !!(orig&&orig.__wl); }
    var w=function(o){ var r=orig.apply(this,arguments); try{ lastO=o; paint(o); }catch(e){ try{ console.warn('wire_letters',e); }catch(x){} } return r; };
    w.__wl=true; window.renderWireStage=w;
    if(window._lastStageO){ lastO=window._lastStageO; paint(lastO); }
    return true;
  }
  /* #wl2 (oct 17): the Hall card's PREDICTION tile reads window._lastCall, which the app sets from letters-moved
     right after it draws the Wire. Swap in the headcount walk so both screens say the same letter. */
  (function(){ var cur=window._lastCall||null;
    try{ Object.defineProperty(window,'_lastCall',{configurable:true,get:function(){ return cur; },set:function(v){
      if(v&&walked&&lastO&&walked.o===lastO){ v=Object.assign({},v,{stop:walked.stop,lo:walked.lo,hi:walked.hi,headcount:true}); }
      cur=v; }}); }catch(e){}
  })();
  var _logged='';
  function logPred(o,wk,holds){
    try{
      if(!window.SB||!window.__shkUid)return; var k=''; try{ k=(window._pmaLadder&&window._pmaLadder._key)||(typeof _predKey==='function'?_predKey():'')||window._publishedKey||''; }catch(e){} if(!k)return;
      var sig=k+'|'+wk.stop+'|'+wk.lo+'|'+wk.hi+'|'+wk.hires; if(sig===_logged)return; _logged=sig;
      window.SB.rpc('wire_pred_put',{p:{k:k,stop:wk.stop,lo:wk.lo,hi:wk.hi,letters:wk.letters,hires:wk.hires,hall:walkedCal&&walkedCal.H||null,jpl:walkedCal&&walkedCal.jpc?Math.round(walkedCal.jpc*100)/100:null,source:walkedCal&&walkedCal.source||'app',app_stop:AZ[((o.base+o.med)%26+26)%26],app_med:o.med}}).then(function(){},function(){});
    }catch(e){}
  }
  function start(){ load(); calibrate(); setInterval(calibrate,30*60*1000); if(!hook()){ var t=setInterval(function(){ if(hook())clearInterval(t); },500); } setInterval(load,5*60*1000); }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start); else start();
  window.wireLettersReload=load;
})();
