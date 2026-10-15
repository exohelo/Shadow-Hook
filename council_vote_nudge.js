/* council_vote_nudge.js — #votenudge (oct 12). A seated council member who still hasn't voted on a motion 24 hours
   after it went up gets a pop-up every time they open the app or sign in. They can vote Aye / Nay / Pass right there,
   without walking into the chamber, or hit "Later" and get asked again next time.

   The server decides who is asked (sc_vote_due: seat holders only, open motions 24 h+ old, no vote yet) and takes the
   vote through the chamber's own sc_vote, so a vote cast here counts and tallies exactly like one cast in the chamber.
   Load once from index.html, after the Supabase client:  <script src="council_vote_nudge.js" defer></script> */
(function(){
  'use strict';
  if(window.__voteNudge)return; window.__voteNudge=true;
  var esc=function(s){ return (s==null?'':''+s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var hum=function(p){ try{ buzz(p||[20]); }catch(e){} };
  var GOLD='#ffd54a';
  var Q=[], at=0, el=null, busy=false, lastUid=null, lastCheck=0, back=null;

  function css(){
    if(document.getElementById('vnCSS'))return;
    var st=document.createElement('style'); st.id='vnCSS';
    st.textContent=
      '#vnPop{position:fixed;inset:0;z-index:400;display:flex;align-items:flex-end;justify-content:center;background:rgba(3,4,8,.72);'
      +'padding:16px 12px calc(16px + env(safe-area-inset-bottom,0px));opacity:0;transition:opacity .2s;font-family:"Barlow Condensed",Inter,system-ui,sans-serif}'
      +'#vnPop[hidden]{display:none!important}#vnPop.on{opacity:1}@media (min-width:560px){#vnPop{align-items:center}}'
      +'#vnPop .vn-box{width:100%;max-width:440px;max-height:calc(100% - 20px);overflow:auto;border-radius:18px;padding:18px 16px 16px;color:#f3ead6;'
      +'background:linear-gradient(180deg,#1c1626,#0d0b12);border:2px solid '+GOLD+';box-shadow:0 0 0 4px rgba(255,213,74,.12),0 18px 50px rgba(0,0,0,.6);'
      +'transform:translateY(24px);transition:transform .25s cubic-bezier(.2,.9,.3,1)}'
      +'#vnPop.on .vn-box{transform:none}'
      +'#vnPop .vn-k{display:flex;justify-content:space-between;gap:8px;font-weight:700;font-size:12px;letter-spacing:.18em;color:'+GOLD+'}'
      +'#vnPop .vn-k span:last-child{color:#a69fb3;letter-spacing:.08em}'
      +'#vnPop h2{margin:8px 0 4px;font-family:Anton,"Barlow Condensed",sans-serif;font-weight:400;font-size:26px;line-height:1.1;letter-spacing:.01em;color:#fff}'
      +'#vnPop .vn-by{font-size:14px;font-weight:600;color:#a69fb3}'
      +'#vnPop .vn-body{margin:12px 0 0;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);'
      +'font-family:Inter,system-ui,sans-serif;font-size:15px;line-height:1.45;color:#ded6e8;white-space:pre-wrap;max-height:34vh;overflow:auto}'
      +'#vnPop .vn-tally{display:flex;gap:6px;margin:12px 0 0}'
      +'#vnPop .vn-tally div{flex:1;text-align:center;padding:8px 4px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.08);font-size:12px;font-weight:700;letter-spacing:.1em;color:#a69fb3}'
      +'#vnPop .vn-tally b{display:block;font-family:Anton,sans-serif;font-weight:400;font-size:22px;letter-spacing:0;color:#fff}'
      +'#vnPop .vn-need{margin:8px 0 0;font-size:14px;font-weight:600;color:#c9c1d6}'
      +'#vnPop .vn-vote{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:14px 0 0}'
      +'#vnPop .vn-vote button{min-height:52px;border-radius:12px;font-family:Anton,"Barlow Condensed",sans-serif;font-size:20px;letter-spacing:.06em;cursor:pointer;border:2px solid}'
      +'#vnPop .vn-aye{background:linear-gradient(180deg,#b7ff3d,#5f8f1f);border-color:#dfff9a!important;color:#0b1204}'
      +'#vnPop .vn-nay{background:linear-gradient(180deg,#ff6b6b,#a31d1d);border-color:#ffb0b0!important;color:#1a0404}'
      +'#vnPop .vn-pass{background:#221c2c;border-color:rgba(255,255,255,.2)!important;color:#ded6e8}'
      +'#vnPop .vn-vote button:disabled{opacity:.5;cursor:default}'
      +'#vnPop .vn-later{display:block;width:100%;margin:10px 0 0;padding:10px;border:0;background:none;color:#a69fb3;font-family:inherit;font-weight:700;font-size:15px;letter-spacing:.06em;cursor:pointer}'
      +'#vnPop button:focus-visible{outline:2px solid #fff;outline-offset:2px}'
      +'@media (prefers-reduced-motion:reduce){#vnPop,#vnPop .vn-box{transition:none}}';
    document.head.appendChild(st);
  }
  function ago(t){ var h=Math.floor((Date.now()-new Date(t).getTime())/36e5); return h<48?h+' hours':Math.floor(h/24)+' days'; }

  function paint(){
    var m=Q[at]; if(!m){ shut(); return; }
    var cast=m.aye+m.nay, carries=cast>0&&(m.kind==='remove'?m.aye*3>=cast*2:m.aye>m.nay), hrs=Math.max(0,Math.ceil((new Date(m.created_at).getTime()+48*36e5-Date.now())/36e5));
    el.querySelector('.vn-box').innerHTML=
      '<div class="vn-k"><span>THE COUNCIL IS WAITING ON YOUR VOTE</span><span>'+(Q.length>1?(at+1)+' of '+Q.length:'')+'</span></div>'
      +'<h2 id="vnT">'+esc(m.title)+'</h2>'
      +'<div class="vn-by">Put up by '+esc(m.by||'a member')+' · open '+ago(m.created_at)+(m.target?' · seat '+esc(m.target):'')+'</div>'
      +(m.body?'<div class="vn-body">'+esc(m.body)+'</div>':'')
      +'<div class="vn-tally"><div><b>'+m.aye+'</b>AYE</div><div><b>'+m.nay+'</b>NAY</div><div><b>'+m.pass+'</b>PASS</div><div><b>'+(m.seated-m.aye-m.nay-m.pass)+'</b>NOT IN</div></div>'
      +'<p class="vn-need">Voting closes in '+hrs+' hour'+(hrs===1?'':'s')+'. It needs '+(m.kind==='remove'?'\u2154 of':'a majority of')+' the votes cast. '+(cast?'Right now it '+(carries?'carries':'fails')+', '+m.aye+' of '+cast+'.':'No votes yet.')+'</p>'
      +'<div class="vn-vote"><button class="vn-aye" data-vn="aye">AYE</button><button class="vn-nay" data-vn="nay">NAY</button><button class="vn-pass" data-vn="pass">PASS</button></div>'
      +'<button class="vn-later" data-vn="later">Later</button>';
    var f=el.querySelector('.vn-aye'); if(f)setTimeout(function(){ try{ f.focus(); }catch(e){} },60);
  }
  function show(list){
    Q=list; at=0; css();
    if(!el){
      el=document.createElement('div'); el.id='vnPop'; el.setAttribute('role','dialog'); el.setAttribute('aria-modal','true'); el.setAttribute('aria-labelledby','vnT');
      el.innerHTML='<div class="vn-box"></div>'; document.body.appendChild(el);
      el.addEventListener('click',onTap);
      el.addEventListener('keydown',function(e){ if(e.key==='Escape'){ e.stopPropagation(); later(); } });
    }
    back=document.activeElement; paint(); el.hidden=false; void el.offsetWidth; el.classList.add('on'); hum([20,40,20]);
  }
  function shut(){ if(!el)return; el.classList.remove('on'); setTimeout(function(){ if(el&&!el.classList.contains('on'))el.hidden=true; },220); try{ back&&back.focus&&back.focus(); }catch(e){} }
  function later(){ say('We\'ll ask again next time you sign in.'); shut(); }
  function onTap(e){
    if(e.target===el){ later(); return; }
    var b=e.target.closest('[data-vn]'); if(!b||busy)return; var k=b.getAttribute('data-vn');
    if(k==='later'){ later(); return; }
    var m=Q[at]; if(!m)return; busy=true;
    el.querySelectorAll('.vn-vote button').forEach(function(x){ x.disabled=true; });
    window.SB.rpc('sc_vote',{p_motion:m.id,p_choice:k}).then(function(r){
      busy=false;
      if(r.error){ say('✗ '+(r.error.message||'The vote did not go through.')); el.querySelectorAll('.vn-vote button').forEach(function(x){ x.disabled=false; }); return; }
      var res=r.data; hum([15]);
      say(res==='carried'?'✓ Vote cast. The motion carries.':res==='failed'?'✓ Vote cast. The motion fails.':'✓ Your '+k+' is in.');
      at++; if(at<Q.length)paint(); else shut();
    },function(){ busy=false; say('✗ No connection. Try again.'); el.querySelectorAll('.vn-vote button').forEach(function(x){ x.disabled=false; }); });
  }

  function check(){
    var sb=window.SB, uid=window.__shkUid; if(!sb||!uid||busy||(el&&el.classList.contains('on')))return;
    lastCheck=Date.now();
    sb.rpc('sc_vote_due').then(function(r){ if(r&&!r.error&&Array.isArray(r.data)&&r.data.length&&window.__shkUid===uid)show(r.data); },function(){});
  }
  /* every sign-in (and every app open with a saved session): the moment a member's id shows up or changes */
  setInterval(function(){
    var uid=window.__shkUid||null;
    if(uid!==lastUid){ lastUid=uid; if(uid)setTimeout(check,1500); }
  },1000);
  /* the app left open for hours counts as a new visit when it comes back to the front */
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&window.__shkUid&&Date.now()-lastCheck>6*36e5)check(); });
  window.voteNudgeCheck=check;
})();
