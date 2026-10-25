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
   oct20: the letter row always reaches the stop and the whole band (#wlstrip); Runaway / cycle watch odds come from
   the Wire's own answer (#wlrun); thin letters are walked per letter with the app's ladder, anywhere ahead (#wlladder).
   Load once from index.html, after the Wire script:  <script src="wire_letters.js?v=oct25a" defer></script> */
(function(){
  'use strict';
  if(window.__wireLetters)return; window.__wireLetters=true;
  /* #thinfit (oct 22): fitted on 63 nights since Aug 15 — a thin letter counts about a third of a full one (best 0.30;
     0.35 chosen to be safe). Days unchanged: the ladder made no difference on 61 morning boards. */
  if(!(+window.WIRE_THIN_W>0))window.WIRE_THIN_W=0.35;
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
  /* #wlpma (oct 19): the PMA sheet. On DAY boards, how far the board moves follows the PMA total (more → further),
     the come-backs (more → further) and the steady (more → shorter) — tested leave-one-out on every day board with a
     PMA sheet: about 2.3 letters average miss including the Oct 16 cycle, 1.4 without, better than the hall count alone.
     Night boards showed no pattern with the PMA numbers yet, so nights don't use them. The model refits itself every
     time a new day board finishes, so the weights grow with the data. */
  var PMA={rows:{},now:null,nowKey:'',fit:{}};
  function pmaLoad(){
    if(!window.SB)return;
    ['AM'].forEach(function(sh){ window.SB.rpc('wire_pma_rows',{p_sh:sh}).then(function(r){ if(r.error||!Array.isArray(r.data))return; PMA.rows[sh]=r.data; PMA.fit[sh]=pmaFit(r.data); if(lastO)paint(lastO); },function(){}); });
  }
  function pmaNow(key){
    if(!window.SB||!key||PMA.nowKey===key)return; PMA.nowKey=key; PMA.now=null;
    window.SB.from('pma_sheets').select('data').eq('key',key).limit(1).then(function(r){ var d=r&&!r.error&&r.data&&r.data[0]&&r.data[0].data; var t=d&&d.los&&d.los['Total Longshore']&&d.los['Total Longshore'].Total;
      if(t&&+t.T>1000){ PMA.now={pt:+t.T,pb:+t.B||0,ps:+t.S||0}; if(lastO)paint(lastO); } },function(){});
  }
  /* ridge regression, letters ~ PMA total + come-backs + steady (standardized, lambda 2) */
  function pmaFit(rows){
    rows=(rows||[]).filter(function(r){ return r.pt>0&&r.act>0; }); if(rows.length<8)return null;
    var F=['pt','pb','ps'], n=rows.length, mu=[0,0,0], sd=[0,0,0];
    F.forEach(function(f,i){ var m=0; rows.forEach(function(r){ m+=+r[f]; }); m/=n; var v=0; rows.forEach(function(r){ v+=Math.pow(+r[f]-m,2); }); mu[i]=m; sd[i]=Math.sqrt(v/n)||1; });
    var X=rows.map(function(r){ return [1].concat(F.map(function(f,i){ return (+r[f]-mu[i])/sd[i]; })); }), y=rows.map(function(r){ return +r.act; });
    var A=[[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], b=[0,0,0,0];
    for(var a=0;a<n;a++)for(var i=0;i<4;i++){ b[i]+=X[a][i]*y[a]; for(var j=0;j<4;j++)A[i][j]+=X[a][i]*X[a][j]; }
    for(var d=1;d<4;d++)A[d][d]+=2;
    for(var c=0;c<4;c++){ var piv=c; for(var r2=c+1;r2<4;r2++)if(Math.abs(A[r2][c])>Math.abs(A[piv][c]))piv=r2; var t=A[c];A[c]=A[piv];A[piv]=t; var tb=b[c];b[c]=b[piv];b[piv]=tb; if(Math.abs(A[c][c])<1e-9)return null;
      for(var r3=0;r3<4;r3++){ if(r3===c)continue; var f2=A[r3][c]/A[c][c]; for(var j2=c;j2<4;j2++)A[r3][j2]-=f2*A[c][j2]; b[r3]-=f2*b[c]; } }
    var w=b.map(function(v,i){ return v/A[i][i]; });
    return {w:w,mu:mu,sd:sd,n:n};
  }
  function pmaPredict(sh){ var f=PMA.fit[sh], x=PMA.now; if(!f||!x)return null; var v=[x.pt,x.pb,x.ps]; var L=f.w[0]; for(var i=0;i<3;i++)L+=f.w[i+1]*(v[i]-f.mu[i])/f.sd[i]; return Math.max(0,Math.min(26,L)); }
  /* #wlheard (oct 19): the count the hall's recording announces ("we have 922"). On day boards it has run about
     1 letter per 100, within ~1.5 letters — the best single number we have, and it's known the night before. */
  var HEARD={key:'',v:null};
  function heardLoad(key){ if(!window.SB||!key||HEARD.key===key)return; HEARD.key=key; HEARD.v=null;
    window.SB.rpc('wire_heard',{p_key:key}).then(function(r){ if(!r.error&&r.data){ HEARD.v=r.data; if(lastO)paint(lastO); } },function(){}); }
  function heardLetters(sh){ var v=HEARD.v; if(!v||!(+v.n>200)||!v[sh]||!(+v[sh].per>0))return null; return +v.n*(+v[sh].per); }
  /* #wlthin (oct 19): thin letters. When the app knows the start letters were worked on the last board (only the
     flops left), each of those letters costs only part of a full letter (o.cycle.thinW, ~58%) until the fresh
     letter (o.cycle.fd letters out). The model's answer is in FULL letters; this walks it through the thin ones. */
  /* #wlladder (oct 20): walk the full-letter answer through the app's own per-letter thin weights (o.ladder.w,
     1 = full letter, less = only the flops left because those cards worked the last board). This covers thin
     letters anywhere ahead (like F→L tonight, 20 out), not only when the board opens on them. */
  function ladW(o){ var lad=o&&o.ladder; if(shiftNow()!=='PM'||!lad||!lad.any||!Array.isArray(lad.w))return null;   /* nights only until days are tested */ var f=+window.WIRE_THIN_W, tw=+lad.thinW||0.58;
    return lad.w.map(function(x){ x=+x; if(!(x>0))x=1; if(f>0&&tw<1){ var th=(1-x)/(1-tw); x=1-th*(1-Math.max(0.15,Math.min(1,f))); } return Math.max(0.15,Math.min(1,x)); }); }
  function thinWalk(o,L){
    var w=ladW(o);
    if(w){ var cum=0; for(var K=0;K<w.length;K++){ if(cum+w[K]>=L)return K+(L-cum)/w[K]; cum+=w[K]; } return w.length+(L-cum); }
    var c=o&&o.cycle; if(!c||!c.opensThin||!(+c.fd>0))return L;
    var w=+window.WIRE_THIN_W||+c.thinW||0.58; w=Math.max(0.15,Math.min(1,w));
    var k=0, rem=L; while(rem>1e-6&&k<60){ rem-=(k<c.fd?w:1); k++; }
    return k-(rem<0?(-rem)/(k-1<c.fd?w:1):0);   /* fractional, so rounding stays fair */
  }
  function model(){ if(!window.SB)return; window.SB.rpc('wire_model').then(function(r){ if(r.error||!r.data)return; MODEL=r.data; modelAt=Date.now(); if(lastO)paint(lastO); },function(){}); }

  /* the prediction: letters moved, with a band */
  function predict(o){
    var sh=shiftNow(), m=MODEL&&MODEL[sh], H=hallNow(); if(!m||!H)return null;
    var key=boardKey(), dn=dropsNow(key), share=dn>0?dropShare(m,sh):0;
    var pH=H/(+m.jpl||130), pA=+m.a10||9, pP=(m.prev!=null?+m.prev:pA), w=m.w||{}, w0=m.w0||{};
    var base0=(+w0.hall||0)*pH+(+w0.avg||0)*pA+(+w0.prev||0)*pP;
    pmaNow(key); var pP2=pmaPredict(sh);   /* the PMA sheet: leads before the drops, still counts after */
    heardLoad(key); var pHd=heardLetters(sh);
    if(pHd!=null)base0=(sh==='AM'?0.6:0.4)*pHd+(sh==='AM'?0.4:0.6)*base0;
    if(pP2!=null)base0=0.3*pP2+0.7*base0;   /* oct19 backtest: PMA untested past 6 boards — a voice, not the lead, until it earns more */
    var L=base0, band=+m.band0||3.5, mae=+m.mae0||2.5, dW=0, pD=0;
    if(dn>0&&share>=0.25){
      pD=(dn/share)/(+m.dpl||45);
      var full=(+w.hall||0)*pH+(+w.drops||0)*pD+(+w.avg||0)*pA+(+w.prev||0)*pP;
      /* once drops are in, drops alone beat every blend on day boards (oct19 backtest, 46 boards) */
      if(pHd!=null)full=0.7*full+0.3*pHd;
      dW=Math.min(1,share/0.86);            /* drops phase in as they arrive; fully weighted once the usual bulk is in */
      L=(1-dW)*base0+dW*full; band=(1-dW)*(+m.band0||3.5)+dW*(+m.band||2.5); mae=(1-dW)*(+m.mae0||2.5)+dW*(+m.mae||2);
    }
    /* #learn (oct 25): the server measures the model's recent misses (graded against the board) and the call
       corrects for them; the correction fades as the night's own drops come in. */
    var bias=+m.bias||0; L=L-bias*(1-dW);
    return {letters:Math.max(0,L), band:band, mae:mae, bias:bias, hall:H, drops:dn, share:share, dW:dW, pH:pH, pD:pD, pma:pP2, heard:pHd, sh:sh, key:key};
  }

  /* #wlock (oct 20): once dispatch is live (flex 6:30 AM / 4:30 PM) the call is LOCKED — the first phone past the line
     writes it to the server, every phone shows that same answer until the next board, and the scorecard grades it. */
  var LOCK={key:'',v:null,asked:0,putting:false};
  function flexOf(key){ var m=/^(\d{4})-(\d{2})-(\d{2})_[A-Za-z]{3}_(AM|PM)$/.exec(key||''); if(!m)return null; return new Date(+m[1],+m[2]-1,+m[3],m[4]==='AM'?6:16,30).getTime(); }
  function lockGet(key){ if(!window.SB||!key)return; if(LOCK.key!==key){ LOCK={key:key,v:null,asked:0,putting:false,got:false}; } var fx=flexOf(key), live=fx&&Date.now()>=fx; if((LOCK.v&&live)||Date.now()-LOCK.asked<(live?20000:120000))return; LOCK.asked=Date.now();
    window.SB.rpc('wire_lock_get',{p_key:key}).then(function(r){ if(LOCK.key!==key)return; LOCK.got=true; if(r&&!r.error&&r.data&&r.data.stop)LOCK.v=r.data; if(lastO)paint(lastO); },function(){}); }
  function lockPut(key,ans){ if(!window.SB||LOCK.putting||LOCK.v)return; LOCK.putting=true;
    window.SB.rpc('wire_lock_put',{p_key:key,p:ans}).then(function(r){ LOCK.putting=false; if(LOCK.key===key&&r&&!r.error&&r.data&&r.data.stop){ LOCK.v=r.data; if(lastO)paint(lastO); } },function(){ LOCK.putting=false; }); }
  function lockedPaint(o,L){
    var ps=document.getElementById('predStop'), mv=document.getElementById('wMoves'); if(!ps||!mv)return;
    var start=AZ[o.base], n=Math.round(+L.letters||0), at=new Date(L.at), hh=at.getHours(), t=(hh%12||12)+':'+String(at.getMinutes()).padStart(2,'0')+(hh<12?' AM':' PM');
    if(ps.textContent!==L.stop)ps.textContent=L.stop;
    var th=thinList(o,n), html=(L.km?'\uD83D\uDD11 <b>the Keymaster\u2019s call</b>':'\uD83D\uDD12 <b>locked</b> \u00B7 does not move during dispatch')+' \u00B7 '+start+' &rarr; <b>'+L.stop+'</b>'+(L.lo&&L.hi&&L.lo!==L.hi?' \u00B7 between <b>'+L.lo+'</b> and <b>'+L.hi+'</b>':'')+(th.length?' \u00B7 thin: '+th.join(', '):'');
    if(mv.innerHTML!==html)mv.innerHTML=html;
    var loN=((AZ.indexOf(L.lo)-o.base)%26+26)%26, hiN=((AZ.indexOf(L.hi)-o.base)%26+26)%26; if(hiN<loN)hiN+=26;
    track(n,loN,hiN);
  }
  (function(){ var t=null;
    document.addEventListener('pointerdown',function(e){ if(!window.__isKM||!e.target.closest||!e.target.closest('#predStop'))return; t=setTimeout(function(){ t=null;
      var key=boardKey(); if(!key||!lastO)return; var v=prompt('Your call for this board — the letter it ends on (optionally the range, like J or J H L):', LOCK.v&&LOCK.v.stop||(walked&&walked.stop)||''); if(v==null)return;
      var parts=String(v).toUpperCase().match(/[A-Z]/g)||[]; if(!parts.length)return;
      var stop=parts[0], lo=parts[1]||stop, hi=parts[2]||stop, n=((AZ.indexOf(stop)-lastO.base)%26+26)%26;
      window.SB.rpc('wire_lock_put',{p_key:key,p:{km:true,stop:stop,lo:lo,hi:hi,letters:n}}).then(function(r){ if(r&&r.data&&r.data.stop){ LOCK.key=key; LOCK.v=r.data; LOCK.got=true; paint(lastO); try{ toast('\uD83D\uDD11 Locked: '+stop); }catch(x){} } else { try{ toast('\u2717 '+((r&&r.data&&r.data.why)||'did not lock')); }catch(x){} } });
    },700); },true);
    ['pointerup','pointercancel','pointerleave'].forEach(function(ev){ document.addEventListener(ev,function(){ if(t){ clearTimeout(t); t=null; } },true); });
  })();
  function paint(o){
    if(!o||typeof o.base!=='number')return;
    var _k=boardKey(), _fx=flexOf(_k), _live=_fx&&Date.now()>=_fx;
    lockGet(_k);
    if(_live||(LOCK.key===_k&&LOCK.v)){ if(LOCK.key===_k&&LOCK.v){ walked={stop:LOCK.v.stop,lo:LOCK.v.lo,hi:LOCK.v.hi,o:o,letters:+LOCK.v.letters||0,hires:0,full:fullAt(o,+LOCK.v.letters||0),sd:2.5}; lockedPaint(o,LOCK.v); return; } }
    var start=AZ[o.base], lg=window._pmaLadder, holds=!!(lg&&lg.stop), P=holds?null:predict(o), L, lo, hi, source;
    if(P){ var Lf=P.letters; L=thinWalk(o,Lf); lo=thinWalk(o,Math.max(0,Lf-P.band)); hi=thinWalk(o,Lf+P.band); source=(P.dW>0?'model+drops':'model')+(P.pma!=null?'+pma':'')+(P.heard!=null?'+heard':'')+(L!==Lf?'+thin':''); }
    else { L=Math.max(0,o.med); lo=Math.max(0,o.lo); hi=Math.max(L,o.hi); source='app'; if(o.med<=0)holds=true; }
    var nL=Math.round(L), nLo=Math.round(lo), nHi=Math.round(hi);
    if(nL<1&&!holds&&P)nL=0;
    var stop=AZ[(o.base+nL)%26], loL=AZ[(o.base+nLo)%26], hiL=AZ[(o.base+nHi)%26], cycles=Math.floor(nL/26), hires=casualsFor(o.base,nL);
    if(holds||nL===0){ stop=start; }
    walked={stop:stop,lo:loL,hi:hiL,o:o,hires:hires,letters:nL,full:P?P.letters:null,sd:P?Math.max(1.5,(P.mae||2.5)*1.25):null};
    info=P?{source:source,heard:P.heard!=null?Math.round(P.heard*10)/10:null,full:Math.round(P.letters*10)/10,pma:P.pma!=null?Math.round(P.pma*10)/10:null,hall:P.hall,drops:P.drops,share:Math.round(P.share*100)/100,dW:Math.round(P.dW*100)/100,mae:Math.round(P.mae*10)/10}:{source:source};
    try{ var lc=window._lastCall; if(lc&&(lc.stop!==walked.stop||lc.lo!==walked.lo||lc.hi!==walked.hi))window._lastCall=Object.assign({},lc); }catch(e){}
    logPred(o);
    if(_live&&!holds&&P&&LOCK.key===_k&&LOCK.got&&!LOCK.v)lockPut(_k,{stop:walked.stop,lo:walked.lo,hi:walked.hi,letters:walked.letters,note:(info&&info.source||'')});
    var ps=document.getElementById('predStop'), mv=document.getElementById('wMoves'); if(!ps||!mv)return;
    if(holds||nL===0){ ps.textContent=start; mv.innerHTML='likely <b>holds</b> on '+start; track(0,0,0); return; }
    ps.textContent=cycles>0?'CYCLE':stop;
    var band=(loL===hiL)?'':' \u00B7 between <b>'+loL+'</b> and <b>'+hiL+'</b>';
    var via=P&&P.dW>0?' \u00B7 <span style="opacity:.75">'+Math.round(P.drops).toLocaleString()+' dropped so far</span>':'';
    mv.innerHTML=whyLine(o,P?Math.round(P.letters):nL,nL,start,stop,band,(cycles>0?' \u00B7 <b>cycles \u00D7'+cycles+'</b>':'')+via);
    track(nL,nLo,nHi);
    dropLine(P,nL);
    var old=document.getElementById('wlStrip'); if(old)old.remove();
  }
  /* #wldrops (oct 19): the gold box's "→ ~N to casuals" was the app's old hall-sheet guess (507), not what the Wire
     predicts. It now says how many jobs the Wire expects to DROP: before drops, letters × drops-per-letter for this
     shift (recorded drops — the 50–100 unreported adds are already inside that rate); once drops post, the count
     so far projected to its usual finish. */
  function dropLine(P,nL){
    try{
      var el=document.getElementById('wSrc'); if(!el||!P)return; var m=MODEL&&MODEL[P.sh]; if(!m||!(+m.dpl>0))return;
      var est, how;
      if(P.drops>0&&P.share>=0.25){ est=Math.round(P.drops/P.share); how=Math.round(P.drops).toLocaleString()+' in, ~'+est.toLocaleString()+' by the finish'; }
      else { est=Math.round((+P.letters||nL)*(+m.dpl)/10)*10; how='~'+est.toLocaleString()+' jobs to drop'; }   /* full letters, not thin ones */
      var t=el.textContent, nt=t.replace(/\u2192 ~[\d,]+ to casuals|\u2192 ~[\d,]+ jobs to drop|\u2192 [\d,]+ in, ~[\d,]+ by the finish/, '\u2192 '+how);
      if(nt===t&&t.indexOf('\u2192 ')<0)return;
      if(nt!==t)el.textContent=nt;
    }catch(e){}
  }
  /* #wlrun (oct 20): Runaway Watch / cycle watch used the app's old odds while the pumpkin showed the Wire's call
     (16 letters next to "10+ about even"). The odds now come from the same answer: full letters Lf with spread sd,
     walked through the same thin letters. */
  function oddsWord(p){ return p>=.85?'near certain':p>=.6?'better than even':p>=.4?'about even':'about 1-in-'+Math.max(2,Math.round(1/Math.max(p,1e-6))); }
  function ncdf(z){ var t=1/(1+0.2316419*Math.abs(z)), d=0.3989423*Math.exp(-z*z/2), q=d*t*(0.3193815+t*(-0.3565638+t*(1.781478+t*(-1.821256+t*1.330274)))); return z>0?1-q:q; }
  /* #wlwhy (oct 22): the line says what the call did, not a constant — "10 full letters · thin: D, G · lands on H" */
  function thinList(o,n){ var w=ladW(o); if(!w)return []; var out=[]; for(var k=1;k<=n&&k<w.length;k++)if(w[k]<0.9)out.push(AZ[(o.base+k)%26]); return out; }
  function whyLine(o,fullN,nL,start,stop,band,extra){ var th=thinList(o,nL); return '<b>'+fullN+' full letter'+(fullN===1?'':'s')+'</b>'+(th.length?' \u00B7 thin: <b>'+th.join(', ')+'</b>':'')+' \u00B7 '+start+' &rarr; <b>'+stop+'</b>'+band+extra; }
  function fullAt(o,x){ var w=ladW(o); if(!w)return x; var s2=0; for(var k=0;k<x&&k<w.length;k++)s2+=w[k]; return s2+Math.max(0,x-w.length); }
  function pAtLeast(o,Lf,sd,x){ return 1-ncdf((fullAt(o,x)-0.5-Lf)/sd); }
  function runLine(o,Lf,sd){
    var run=document.getElementById('wRun'); if(!run||!o)return; sd=Math.max(1.5,sd||2.5);
    var c=o.cycle, html, cls;
    if(c&&c.opensThin&&c.fresh&&+c.fd>0){
      var pf=pAtLeast(o,Lf,sd,+c.fd), thinPct=Math.round((+c.thinW||0.58)*100);
      var body='<span class="rw-c"><b>'+c.letter+'</b>&rarr;<b>'+c.end+'</b> worked '+c.when+' &mdash; only the flops left, about '+thinPct+'% of a full letter &middot; fresh from <b>'+c.fresh+'</b>, <b>'+c.fd+' letter'+(c.fd===1?'':'s')+'</b> out</span>';
      cls=pf>=.5?'wire-runaway cyc':'wire-runaway cyc watch';
      html='<span class="rw-l">&#10227; thin letters &middot; '+(pf>=.12?oddsWord(pf)+(pf>=.5?' the call reaches the fresh ones':' it reaches the fresh ones'):'expect movement')+'</span>'+body;
    } else if(c&&c.opensThin){ return; }
    else {
      var pc=(c&&+c.d>0)?pAtLeast(o,Lf,sd,+c.d):0;
      if(pc>=.12){
        var body2='<span class="rw-c"><b>'+c.letter+'</b> is <b>'+c.d+' letter'+(c.d===1?'':'s')+'</b> out &middot; '+c.letter+'&rarr;'+c.end+' worked '+c.when+'</span>';
        cls=pc>=.5?'wire-runaway cyc':'wire-runaway cyc watch';
        html='<span class="rw-l">&#10227; cycle '+(pc>=.5?'alert':'watch')+' &middot; '+oddsWord(pc)+'</span>'+body2;
      } else {
        var p6=pAtLeast(o,Lf,sd,6), p10=pAtLeast(o,Lf,sd,10);
        if(p6>=.12){ cls='wire-runaway'; html='<span class="rw-l">&#9888; runaway watch</span><span class="rw-n">6+ letters <b>'+oddsWord(p6)+'</b>'+(p10>=.08?' &middot; 10+ <b>'+oddsWord(p10)+'</b>':'')+'</span>'; }
        else { cls='wire-runaway steady'; html='steady run &middot; no blowout signal'; }
      }
    }
    run.style.display='block'; if(run.className!==cls)run.className=cls; if(run.innerHTML!==html)run.innerHTML=html;
  }
  /* the letter row under the pumpkin: STOP and band from the same answer */
  function track(nL,nLo,nHi){
    var tr=document.getElementById('wTrack'); if(!tr)return; var cells=tr.querySelectorAll('.wire-cell'); if(!cells.length)return;
    /* #wlstrip (oct 20): the app draws the row only as far as its own guess (+2). When the Wire's call or band runs
       past that, the stop and the end of the band went missing. Add the missing letters, and wrap the row when long. */
    var need=Math.min(26,Math.max(nL,nHi)+1);
    if(cells.length<=need&&lastO){
      var o=lastO, w=ladW(o), restAt=o.cycle&&+o.cycle.d>0?+o.cycle.d:-1;
      for(var k2=cells.length;k2<=need;k2++){
        var d=document.createElement('div'); d.className='wire-cell'+((w?(w[k2]!=null&&w[k2]<0.9):(restAt>0&&k2>=restAt))?' rest':''); d.textContent=AZ[(o.base+k2)%26]; tr.appendChild(d);
      }
      cells=tr.querySelectorAll('.wire-cell');
    }
    tr.classList.toggle('wide',cells.length>17);
    if(lastO){ var wr=ladW(lastO); if(wr)cells.forEach(function(c,k){ c.classList.toggle('rest',k>0&&k<wr.length&&wr[k]<0.9); }); }
    cells.forEach(function(c,k){
      c.classList.toggle('band',nL>0&&k>=nLo&&k<=nHi);
      var isStop=nL>0&&k===nL; c.classList.toggle('stop',isStop);
      var t=c.querySelector('.tick:not(.fresh)');
      if(t&&t.textContent==='STOP'&&!isStop)t.remove();
      if(isStop&&!(t&&t.textContent==='STOP')){ if(t&&t.textContent!=='START')t.remove(); var n=document.createElement('span'); n.className='tick'; n.textContent='STOP'; c.appendChild(n); }
    });
    if(nL>=cells.length)cells[cells.length-1].classList.add('band');
    if(lastO)try{ runLine(lastO,(walked&&walked.full!=null)?walked.full:nL,walked&&walked.sd); }catch(e){}
  }
  /* what the Wire told people, next to what happened */
  var _logged='';
  function logPred(o){
    try{
      if(!window.SB||!window.__shkUid||!walked)return; var k=boardKey(); if(!k)return;
      var sig=k+'|'+walked.stop+'|'+walked.lo+'|'+walked.hi; if(sig===_logged)return; _logged=sig;
      window.SB.rpc('wire_pred_put',{p:{k:k,stop:walked.stop,lo:walked.lo,hi:walked.hi,letters:walked.letters,hires:walked.hires,hall:info&&info.hall||null,jpl:MODEL&&MODEL[shiftNow()]?MODEL[shiftNow()].jpl:null,
        source:(info&&info.source||'app')+(info&&info.drops?' d'+info.drops+'@'+info.share:''),app_stop:AZ[((o.base+o.med)%26+26)%26],app_med:o.med,full:walked.full,thin_w:(+window.WIRE_THIN_W||(o.ladder&&+o.ladder.thinW)||0.58),ladder:(function(){ var w=ladW(o); return w?w.slice(0,27).map(function(x){ return Math.round(x*100)/100; }):null; })()}}).then(function(){},function(){});
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
  function start(){ load(); model(); pmaLoad(); setInterval(pmaLoad,30*60*1000); if(!hook()){ var t=setInterval(function(){ if(hook())clearInterval(t); },500); }
    setInterval(load,5*60*1000); setInterval(model,30*60*1000);
    setInterval(function(){ if(lastO)paint(lastO); },60000);   /* drops keep coming in: re-figure every minute */ }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start); else start();
  window.wireLettersReload=load;
  window.wireModel=function(){ return {model:MODEL,info:info,answer:walked&&{stop:walked.stop,lo:walked.lo,hi:walked.hi,letters:walked.letters,hires:walked.hires}}; };
})();
