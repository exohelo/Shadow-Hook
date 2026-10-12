/* pmoney.js — P MONEY CASINO AND RESORT (#pmcasino, oct 12). Loaded on demand by gamesLazyJS, the same
   way trivia.js and dates.js are: a casual who never taps the card never downloads a byte of it.

   The casino itself is pmoney.html, opened full screen in a frame over the app. The frame keeps its
   styles (it has its own .card, .toast, .tab and body rules) from ever touching the app's, and the
   app's from touching it. The bar on top takes the member back to the Order; so does the phone's
   Back button, through closeTop() (window.pmIsOpen / window.pmClose).

   Chips in the casino are DEMO chips, kept on the phone. Nothing here reads or moves Port Bucks. */
(function(){
  var el=null;

  function css(){
    if(document.getElementById('pmCasinoSheetCSS'))return;
    var st=document.createElement('style'); st.id='pmCasinoSheetCSS';
    st.textContent=
      '#pmCasino{position:fixed;inset:0;z-index:200;display:none;flex-direction:column;background:#14021f;'+
        'padding-bottom:env(safe-area-inset-bottom,0px)}'+
      '#pmCasino.on{display:flex;animation:pmIn .28s cubic-bezier(.2,.9,.3,1)}'+
      '@keyframes pmIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}'+
      '#pmCasino .pm-bar{flex:none;display:flex;align-items:center;gap:10px;'+
        'padding:calc(8px + env(safe-area-inset-top,0px)) 12px 8px;'+
        'background:linear-gradient(180deg,#4a0e7a,#2a0846);border-bottom:2px solid #ffd54a;'+
        'box-shadow:0 4px 14px rgba(0,0,0,.45)}'+
      '#pmCasino .pm-x{flex:none;border:2px solid #ffd54a;border-radius:999px;padding:6px 12px;'+
        'background:linear-gradient(180deg,#6d24ad,#3a0a63);color:#fff1c4;font:700 14px/1 system-ui,sans-serif;cursor:pointer}'+
      '#pmCasino .pm-x:focus-visible{outline:2px solid #fff;outline-offset:2px}'+
      '#pmCasino .pm-t{flex:1;min-width:0;text-align:center;font-family:Bungee,sans-serif;font-size:14px;white-space:nowrap;'+
        'overflow:hidden;text-overflow:ellipsis;background:linear-gradient(180deg,#fffdf0,#ffc928 55%,#e08a00);'+
        '-webkit-background-clip:text;background-clip:text;color:transparent}'+
      '#pmCasino .pm-tag{flex:none;font:700 11px/1 system-ui,sans-serif;color:#ff8fd0;border:1px solid #ff8fd080;'+
        'border-radius:999px;padding:4px 8px}'+
      '#pmCasino iframe{flex:1;width:100%;border:0;background:#14021f;display:block}'+
      'html.pm-lock,html.pm-lock body{overflow:hidden}'+
      '@media (prefers-reduced-motion:reduce){#pmCasino.on{animation:none}}';
    document.head.appendChild(st);
  }

  function build(){
    css();
    el=document.createElement('div');
    el.id='pmCasino';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-modal','true');
    el.setAttribute('aria-label','P Money Casino and Resort');
    el.innerHTML='<div class="pm-bar"><button type="button" class="pm-x">\u2039 The Order</button>'+
      '<span class="pm-t">P Money Casino &amp; Resort</span><span class="pm-tag">demo chips</span></div>'+
      '<iframe title="P Money Casino and Resort" allow="autoplay"></iframe>';
    document.body.appendChild(el);
    el.querySelector('.pm-x').addEventListener('click',close);
  }

  function open(){
    if(!el)build();
    var f=el.querySelector('iframe');
    if(!f.getAttribute('src'))f.setAttribute('src','pmoney.html?v='+encodeURIComponent(window.SHK_BUILD||''));
    el.classList.add('on');
    document.documentElement.classList.add('pm-lock');
    setTimeout(function(){try{f.focus()}catch(e){}},300);
  }

  function close(){
    if(!el)return;
    el.classList.remove('on');
    document.documentElement.classList.remove('pm-lock');
    /* the casino hums while a crane lift is in the air; going quiet when the member leaves */
    try{el.querySelector('iframe').contentWindow.postMessage({pm:'hide'},location.origin);}catch(e){}
  }

  function isOpen(){return !!(el&&el.classList.contains('on'));}

  window.pmIsOpen=isOpen;
  window.pmClose=close;
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen())close();});

  window.PMONEY={_live:true,open:open,close:close};
  try{window.__pmReady&&window.__pmReady();}catch(e){}
})();
