/* The Shadow Hook · notifs.js (nov1g) — who liked your post, commented on it, replied to you, or tagged you (@handle).
   Rows are written on the server by triggers (public.notifs); this file shows them: a 🔔 in the header with the unseen
   count, a sheet with the list, live updates, and a tap takes you to the post. */
(function () {
  "use strict";
  if (window.SHK_NOTIFS) return;
  /* #hookicon(nov18): browsers hold on to an old tab / shortcut icon for days; pointing the links at a versioned URL makes them fetch the purple hook now */
  try { [["icon", "icon-192.png"], ["apple-touch-icon", "apple-touch-icon.png"]].forEach(function (r) { var l = document.querySelector('link[rel="' + r[0] + '"]'); if (l && !/\?v=hook2/.test(l.getAttribute("href") || "")) l.setAttribute("href", r[1] + "?v=hook2"); }); } catch (e) {}
  /* #nov1(gate) — the hall gate (hall_gate.js) rides in with this file until index.html carries its own tag */
  try { if (!window.SHK_HALL_GATE && !document.querySelector('script[src*="hall_gate.js"]')) { var hg = document.createElement("script"); hg.src = "hall_gate.js?v=nov1a"; hg.defer = true; (document.head || document.documentElement).appendChild(hg); } } catch (e) {}
  var S = { rows: [], unseen: 0, chan: null, at: 0, known: null };
  /* #ping(nov18): a two-note chime when an alert lands while the app is open. Phones only let a page make sound after a
     first tap, so the sound is unlocked on the first touch anywhere. Members can switch it off in the alerts sheet. */
  var AC = null;
  function pingOn() { try { return localStorage.getItem("shk_ntping") !== "0"; } catch (e) { return true; } }
  function unlock() { try { if (!AC) { var C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === "suspended") AC.resume(); } catch (e) {} }
  ["pointerdown", "touchstart", "keydown"].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true, capture: true }); });
  function ping() {
    if (!pingOn()) return;
    try { navigator.vibrate && navigator.vibrate([18, 60, 18]); } catch (e) {}
    try {
      unlock(); if (!AC || AC.state !== "running") return;
      var t = AC.currentTime;
      [[880, 0], [1318.5, 0.11]].forEach(function (n) {
        var o = AC.createOscillator(), g = AC.createGain(); o.type = "sine"; o.frequency.setValueAtTime(n[0], t + n[1]);
        g.gain.setValueAtTime(0.0001, t + n[1]); g.gain.exponentialRampToValueAtTime(0.18, t + n[1] + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1] + 0.32);
        o.connect(g); g.connect(AC.destination); o.start(t + n[1]); o.stop(t + n[1] + 0.34);
      });
    } catch (e) {}
  }
  function sb() { return window.SB; }
  function me() { return window.__shkUid || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ago(ts) { var s = (Date.now() - new Date(ts).getTime()) / 1e3; return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; }
  var WORD = { race: "called you out on Corral Run", racelive: "wants a LIVE race on Corral Run", raced: "raced you on Corral Run", racenope: "passed on your Corral Run race", news: "", join: "asked to join", like: "liked your post", clike: "liked your comment", comment: "commented on your post", reply: "replied to you", mention: "tagged you" };
  var ICON = { race: "🏁", racelive: "🔴", raced: "🏁", racenope: "🚫", news: "📲", join: "🚪", like: "❤️", clike: "❤️", comment: "💬", reply: "↩️", mention: "@" };

  /* #nov1(rfltag): the floating RAFFLE tag under the header repeats the raffle strip that already runs across the top
     of every tab; the tag is retired */
  try { var rt = document.createElement("style"); rt.id = "rflTagOff"; rt.textContent = "#rflTag,#rflTag.on{display:none!important}"; (document.head || document.documentElement).appendChild(rt); } catch (e) {}
  var CSS = "#hcnt{position:relative}#hcnt.quiet{background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.22)!important;box-shadow:none!important;animation:none!important;color:inherit!important;opacity:.8}#hcnt.quiet #hcNtN{display:none}html.daylight #hcnt.quiet{background:rgba(0,0,0,.05)!important;border-color:rgba(0,0,0,.18)!important}" +
    "#ntSheet{position:fixed;inset:0;z-index:95;display:none;background:rgba(0,0,0,.55)}#ntSheet.on{display:block}" +
    "#ntSheet .nt-p{position:absolute;left:0;right:0;bottom:0;max-height:78vh;overflow:auto;background:var(--plate-2,#15171b);border-top:1px solid var(--line,#333);border-radius:18px 18px 0 0;padding:14px 14px calc(18px + env(safe-area-inset-bottom,0px))}" +
    "#ntSheet .nt-h{display:flex;align-items:center;gap:8px;margin-bottom:8px;font:700 15px/1 Barlow Condensed,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--bone,#eee)}" +
    "#ntSheet .nt-h button{margin-left:auto;background:none;border:0;color:var(--steel,#999);font-size:20px;cursor:pointer}" +
    "#ntSheet .nt-it{display:flex;gap:10px;align-items:flex-start;padding:10px 6px;border-bottom:1px solid var(--line,#2a2a2a);cursor:pointer;border-radius:8px}" +
    "#ntSheet .nt-it.new{background:rgba(232,163,61,.08)}#ntSheet .nt-it:hover{background:rgba(255,255,255,.04)}" +
    "#ntSheet .nt-ic{flex:0 0 30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);font-size:14px;color:var(--copper-hi,#e8a33d);font-weight:700}" +
    "#ntSheet .nt-tx{flex:1;min-width:0;font:13px/1.4 Inter,system-ui,sans-serif;color:var(--bone,#eee)}#ntSheet .nt-tx b{color:var(--copper-hi,#e8a33d)}" +
    "#ntSheet .nt-sn{display:block;color:var(--steel,#999);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ntSheet .nt-t{flex:0 0 auto;font:12px Inter,system-ui,sans-serif;color:var(--steel,#999)}" +
    "#ntSheet .nt-none{padding:24px 8px;text-align:center;color:var(--steel,#999);font:13px Inter,system-ui,sans-serif}" +
    ".bpost.nt-flash{outline:2px solid var(--copper-hi,#e8a33d);outline-offset:3px;transition:outline-color 1.2s}";
  function css() { if (document.getElementById("ntCss")) return; var st = document.createElement("style"); st.id = "ntCss"; st.textContent = CSS; document.head.appendChild(st); }

  function bell() {
    var b = document.getElementById("hcnt");
    if (b) return b;
    var host = document.querySelector(".hdr-console .hc-right"); if (!host) return null;
    css();
    b = document.createElement("button"); b.type = "button"; b.className = "hdr-msg"; b.id = "hcnt"; b.style.display = "none";
    b.setAttribute("aria-label", "Notifications"); b.innerHTML = '<span class="ic">🔔</span><i id="hcNtN"></i>';
    host.insertBefore(b, host.firstChild);
    b.addEventListener("click", open);
    return b;
  }
  function paintBell() {
    var b = bell(); if (!b) return;
    /* #bellalways(nov18): the bell stays in the header for anyone signed in — dim when nothing is new, the count when there is */
    b.style.display = me() ? "" : "none";
    b.classList.toggle("quiet", !S.unseen);
    var n = document.getElementById("hcNtN"); if (n) n.textContent = S.unseen ? (S.unseen > 99 ? "99+" : String(S.unseen)) : "";
    b.title = S.unseen ? S.unseen + " new" : "Notifications";
  }

  /* #appstore(nov18): the iPhone app is on the App Store. Every visitor on the website gets a one-time card: iPhones get the
     download button, Android gets "coming soon to the Play Store", computers get both lines. Never inside the phone apps. */
  (function () {
    var URL = "https://apps.apple.com/us/app/shadow-hook/id6833596735", KEY = "shk_appstore_card1";
    try {
      var ua = navigator.userAgent || "", ios = /iPhone|iPod|iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
      var native = !!(window.SHK_IOS || (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()));
      if (native || localStorage.getItem(KEY)) return;   /* #appstore2: everyone sees it; Android and computers get "coming soon to the Play Store" */
    } catch (e) { return; }
    function show() {
      if (document.getElementById("asCard") || document.getElementById("ntPop") && document.getElementById("ntPop").classList.contains("on")) return;
      var st = document.createElement("style");
      st.textContent = "#asCard{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:94;max-width:420px;margin:0 auto;background:var(--plate-2,#15171b);border:1.5px solid #7c5cff;border-radius:18px;padding:16px 14px 12px;box-shadow:0 18px 50px rgba(0,0,0,.55);display:flex;gap:12px;align-items:center;animation:asIn .3s ease-out;font-family:Inter,system-ui,sans-serif}" +
        "@keyframes asIn{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}#asCard img{width:54px;height:54px;border-radius:13px;flex:none}" +
        "#asCard .t{font:800 17px/1.15 Barlow Condensed,sans-serif;letter-spacing:.04em;color:var(--bone,#eee)}#asCard .s{font-size:12.5px;color:var(--steel,#999);margin-top:3px;line-height:1.35}" +
        "#asCard a{display:inline-block;margin-top:9px;background:#7c5cff;color:#fff;font:700 13px Inter,system-ui,sans-serif;padding:9px 14px;border-radius:10px;text-decoration:none}#asCard .x{position:absolute;top:6px;right:8px;background:none;border:0;color:var(--steel,#999);font-size:18px;cursor:pointer}";
      document.head.appendChild(st);
      var c = document.createElement("div"); c.id = "asCard"; c.setAttribute("role", "dialog"); c.setAttribute("aria-label", "Get the iPhone app");
      var andr = /Android/i.test(navigator.userAgent || "");
      c.innerHTML = '<img src="/icon-192.png?v=hook2" alt=""><div style="flex:1;min-width:0"><div class="t">📲 THE SHADOW HOOK IS ON THE APP STORE</div>' +
        (ios ? '<div class="s">Get the iPhone app: faster, with dispatch alerts and Corral Run.</div><a href="' + URL + '" id="asGo">Download on the App Store</a>'
             : '<div class="s">' + (andr ? 'Android: coming soon to the Play Store.' : 'iPhone: download it now. Android: coming soon to the Play Store.') + '</div>' + (andr ? '' : '<a href="' + URL + '" id="asGo">See it on the App Store</a>')) +
        '</div><button type="button" class="x" aria-label="Close">✕</button>';
      document.body.appendChild(c);
      var done = function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} c.remove(); };
      c.querySelector(".x").addEventListener("click", done);
      var go = c.querySelector("#asGo"); go && go.addEventListener("click", function () { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} });
    }
    var tries = 0, t = setInterval(function () { if (document.body && (++tries > 3)) { clearInterval(t); show(); } }, 1000);
  })();

  /* #crframe(nov18): Corral Run opens inside the app, under the header, so the header (bell, dispatch clock, menu)
     stays on screen. The game asks to close with a postMessage (pull down / side drag / back). */
  var CRF = null;
  function crTop() { var t = document.querySelector(".topbar"); return t ? Math.max(0, Math.round(t.getBoundingClientRect().bottom)) : 0; }
  function crPlace() { if (CRF) CRF.style.top = crTop() + "px"; }
  function crOpen(q) {
    var src = "/corral-run.html" + (q || "");
    if (CRF) { CRF.querySelector("iframe").src = src; return; }
    CRF = document.createElement("div"); CRF.id = "crFrame";
    CRF.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:41;background:#0b0a14;padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box";
    CRF.innerHTML = '<iframe title="Corral Run" allow="autoplay; vibrate" style="display:block;width:100%;height:100%;border:0;background:#0b0a14"></iframe>';
    CRF.querySelector("iframe").src = src;
    document.body.appendChild(CRF); crPlace(); try { obOff(); } catch (e) {}
    document.documentElement.style.overflow = "hidden";
    try { history.pushState({ crf: 1 }, "", location.href); } catch (e) {}
  }
  function crClose(fromPop) {
    if (!CRF) return; CRF.remove(); CRF = null; document.documentElement.style.overflow = "";
    if (!fromPop) try { if (history.state && history.state.crf) history.back(); } catch (e) {}
    setTimeout(function () { load(); }, 300);
  }
  window.addEventListener("resize", crPlace);
  window.addEventListener("popstate", function () { if (CRF) crClose(true); });
  window.addEventListener("message", function (e) { if (e.origin === location.origin && e.data && e.data.cr === "close") crClose(false); });
  (function hook() {
    var og = window.gameOpen;
    if (typeof og !== "function") { setTimeout(hook, 500); return; }
    if (og.__crf) return;
    var w = function (k) { if (k === "corral") { crOpen(""); return; } return og.apply(this, arguments); };
    w.__crf = true; window.gameOpen = w;
  })();

  /* #invpop(nov18): a Corral Run invite pops up in the middle of the app with ACCEPT / DECLINE instead of only a toast
     up top. Decline tells the sender right away (1v1: their 5 ⬡ comes back); accept opens the game straight into the race. */
  var IP = { cur: null, skip: {}, at: 0, busy: false };
  var MAPN = { pier1c: "Maersk · Pier 400", china: "China Shipping · Berth 100", yangming: "Yang Ming · Berth 121" };
  var IPCSS = "#ntPop{position:fixed;inset:0;z-index:96;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.6);padding:18px}#ntPop.on{display:flex}" +
    "#ntPop .ip{width:100%;max-width:360px;background:var(--plate-2,#15171b);border:1.5px solid var(--copper-hi,#e8a33d);border-radius:18px;padding:18px 16px 14px;text-align:center;box-shadow:0 18px 50px rgba(0,0,0,.55);animation:ntIpIn .22s ease-out}" +
    "@keyframes ntIpIn{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}" +
    "#ntPop .ipT{font:700 13px Barlow Condensed,sans-serif;letter-spacing:.2em;color:var(--copper-hi,#e8a33d)}#ntPop .ipW{font:800 25px/1.1 Barlow Condensed,sans-serif;color:var(--bone,#eee);margin:6px 0 4px}" +
    "#ntPop .ipS{font:13px/1.4 Inter,system-ui,sans-serif;color:var(--steel,#999);margin-bottom:14px}#ntPop .ipB{display:flex;gap:10px}" +
    "#ntPop .ipB button{flex:1;border-radius:12px;padding:13px 8px;font:800 17px Barlow Condensed,sans-serif;letter-spacing:.08em;cursor:pointer}" +
    "#ntPop .no{background:transparent;border:1.5px solid var(--line,#444);color:var(--bone,#eee)}#ntPop .yes{background:var(--copper-hi,#e8a33d);border:0;color:#1a1206}" +
    "#ntPop .ipL{margin-top:10px;background:none;border:0;color:var(--steel,#999);font:12px Inter,system-ui,sans-serif;cursor:pointer}#ntPop button:disabled{opacity:.5}";
  function pop() {
    var el = document.getElementById("ntPop"); if (el) return el;
    var st = document.createElement("style"); st.textContent = IPCSS; document.head.appendChild(st);
    el = document.createElement("div"); el.id = "ntPop"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Race invite");
    el.innerHTML = '<div class="ip"><div class="ipT">🏁 INVITED TO RACE</div><div class="ipW" id="ntIpW"></div><div class="ipS" id="ntIpS"></div><div class="ipB"><button type="button" class="no" id="ntIpNo">DECLINE</button><button type="button" class="yes" id="ntIpYes">ACCEPT · 5 ⬡</button></div><button type="button" class="ipL" id="ntIpL">not now</button></div>';
    document.body.appendChild(el);
    el.querySelector("#ntIpYes").addEventListener("click", function () { answer(true); });
    el.querySelector("#ntIpNo").addEventListener("click", function () { answer(false); });
    el.querySelector("#ntIpL").addEventListener("click", function () { if (IP.cur) IP.skip[IP.cur.t + IP.cur.id] = 1; hidePop(); });
    return el;
  }
  function hidePop() { IP.cur = null; var el = document.getElementById("ntPop"); el && el.classList.remove("on"); }
  function showPop(x) {
    var el = pop(); IP.cur = x; var m = (MAPN[x.map] || "Maersk").split(" · ")[0];
    el.querySelector("#ntIpW").textContent = x.t === "heat" ? x.by + "'s " + x.size + "-player race" : x.by + (x.live ? " wants a LIVE race" : " called you out");
    el.querySelector("#ntIpS").textContent = x.t === "heat" ? m + " · " + x.n + "/" + x.size + " in · 5 ⬡ a seat, winner takes the pot" : m + " · " + (x.live ? "start together · " : "race their ghost · ") + "5 ⬡ each, winner takes 10 ⬡";
    el.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
    el.classList.add("on");
  }
  async function checkInv(force) {
    if (!sb() || !me() || IP.cur || IP.busy || document.hidden || CRF) return;   /* inside the game, the game asks */
    if (!force && Date.now() - IP.at < 15e3) return; IP.at = Date.now();
    try {
      var r = await sb().rpc("cr_pending"); if (!r || r.error || !r.data || IP.cur) return;
      var x = (r.data.list || []).filter(function (y) { return !IP.skip[y.t + y.id]; })[0]; if (x) showPop(x);
    } catch (e) {}
  }
  async function answer(yes) {
    var x = IP.cur; if (!x || IP.busy) return; IP.busy = true;
    pop().querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    try { if (S.unseen) { await sb().rpc("notifs_seen_all"); S.rows.forEach(function (y) { y.seen_at = y.seen_at || new Date().toISOString(); }); S.unseen = 0; paintBell(); } } catch (e) {}
    if (yes) { IP.busy = false; hidePop(); crOpen("?" + (x.t === "heat" ? "heat=" : "race=") + x.id + "&go=1"); return; }
    try { await sb().rpc(x.t === "heat" ? "cr_heat_decline" : "cr_decline", { p_id: x.id }); try { typeof toast === "function" && toast("Passed — " + x.by + " knows"); } catch (e) {} } catch (e) {}
    IP.skip[x.t + x.id] = 1; IP.busy = false; hidePop(); setTimeout(function () { checkInv(true); }, 600);
  }

  /* #openbar(nov18): a small bar just above the menu when a game lobby is open to anyone on the app ("LUCBONE's
     6-player race is open · JOIN / ✕"). public.open_games() lists them in one shape, so trivia and later games
     only need a new branch there. ✕ hides that one lobby on this phone. Not shown inside a game. */
  var OB = { cur: null, t: 0, busy: false };
  function obGone() { try { return JSON.parse(localStorage.getItem("shk_ob_x") || "[]"); } catch (e) { return []; } }
  function obHide(x) { try { var a = obGone(); a.push(x); localStorage.setItem("shk_ob_x", JSON.stringify(a.slice(-40))); } catch (e) {} }
  function obEl() {
    var el = document.getElementById("obBar"); if (el) return el;
    var st = document.createElement("style");
    st.textContent = "#obBar{position:fixed;left:10px;right:10px;z-index:93;max-width:520px;margin:0 auto;display:none;align-items:center;gap:10px;padding:9px 9px 9px 12px;border-radius:14px;background:rgba(23,18,43,.96);border:1.5px solid #fbbf24;box-shadow:0 8px 24px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif;animation:obIn .25s ease-out}" +
      "#obBar.on{display:flex}@keyframes obIn{from{transform:translateY(12px);opacity:0}to{transform:none;opacity:1}}#obBar .i{font-size:20px;flex:none}" +
      "#obBar .tx{flex:1;min-width:0;color:#fff}#obBar .t{font:800 15px/1.15 Barlow Condensed,sans-serif;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#obBar .s{font:600 11.5px/1.3 Inter,system-ui,sans-serif;color:#c9c1e0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#obBar .j{flex:none;height:34px;padding:0 14px;border-radius:9px;border:0;background:#fbbf24;color:#1a1206;font:800 14px Barlow Condensed,sans-serif;letter-spacing:.06em;cursor:pointer}" +
      "#obBar .x{flex:none;width:30px;height:34px;border-radius:9px;border:1px solid #6b6290;background:transparent;color:#d8d2ee;font:700 15px Inter;cursor:pointer}";
    document.head.appendChild(st);
    el = document.createElement("div"); el.id = "obBar"; el.setAttribute("role", "status");
    el.innerHTML = '<span class="i"></span><div class="tx"><div class="t"></div><div class="s"></div></div><button type="button" class="j">JOIN</button><button type="button" class="x" aria-label="Not now">✕</button>';
    document.body.appendChild(el);
    el.querySelector(".j").addEventListener("click", function () { var x = OB.cur; if (!x) return; obOff(); if (/^\/corral-run\.html/.test(x.go)) crOpen(x.go.replace(/^\/corral-run\.html/, "")); else location.href = x.go; });
    el.querySelector(".x").addEventListener("click", function () { if (OB.cur) obHide(OB.cur.key); obOff(); });
    return el;
  }
  function obPlace(el) {
    var nav = document.querySelector(".nav"), r = nav && nav.getBoundingClientRect();
    if (r && r.width < innerWidth / 2) { el.style.bottom = "14px"; el.style.left = (Math.round(r.right) + 12) + "px"; }   /* side menu on wide screens */
    else { el.style.left = "10px"; el.style.bottom = ((r ? Math.round(innerHeight - r.top) : 70) + 8) + "px"; }
  }
  function obOff() { OB.cur = null; var el = document.getElementById("obBar"); el && el.classList.remove("on"); }
  async function obCheck() {
    if (!sb() || !me() || document.hidden || OB.busy) return;
    if (CRF || IP.cur || document.getElementById("asCard")) { obOff(); return; }   /* inside a game, a direct invite is up, or the App Store card is showing */
    OB.busy = true;
    try {
      var r = await sb().rpc("open_games"); var L = (r && !r.error && Array.isArray(r.data)) ? r.data : [];
      var gone = obGone(), x = L.filter(function (y) { return gone.indexOf(y.key) < 0; })[0];
      if (!x) { obOff(); return; }
      var el = obEl(); OB.cur = x;
      el.querySelector(".i").textContent = x.icon || "🎮"; el.querySelector(".t").textContent = x.title || "A game is open"; el.querySelector(".s").textContent = x.sub || "";
      obPlace(el); el.classList.add("on");
    } catch (e) {} finally { OB.busy = false; }
  }
  setInterval(obCheck, 15000); setTimeout(obCheck, 4000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) setTimeout(obCheck, 900); });
  window.addEventListener("resize", function () { var el = document.getElementById("obBar"); el && el.classList.contains("on") && obPlace(el); });

  async function load() {
    if (!sb() || !me()) return;
    try {
      var r = await sb().from("notifs").select("id,kind,actor_handle,story_id,comment_id,snippet,created_at,seen_at").eq("uid", me()).order("created_at", { ascending: false }).limit(60);
      if (r && !r.error) {
        var rows = r.data || [], fresh = false;
        if (S.known) rows.forEach(function (x) { if (!x.seen_at && !S.known[x.id]) fresh = true; });
        S.known = S.known || {}; rows.forEach(function (x) { S.known[x.id] = 1; });
        S.rows = rows; S.unseen = S.rows.filter(function (x) { return !x.seen_at; }).length; S.at = Date.now();
        if (fresh) ping();   /* one that slipped past the live wire (the phone napped) still chimes once */
      }
    } catch (e) {}
    paintBell(); paintList();
    checkInv(false);
  }
  function live() {
    if (S.chan || !sb() || !me()) return;
    try {
      S.chan = sb().channel("notifs:" + me()).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifs", filter: "uid=eq." + me() }, function (p) {
        var x = p && p.new; if (!x) return;
        if (S.known && S.known[x.id]) return; (S.known = S.known || {})[x.id] = 1;
        S.rows.unshift(x); S.unseen++; paintBell(); paintList(); ping();
        if (x.kind === "race" || x.kind === "racelive") { setTimeout(function () { checkInv(true); }, 400); return; }   /* the pop-up is the alert */
        try { typeof toast === "function" && toast((ICON[x.kind] || "🔔") + " " + (x.actor_handle || "Someone") + " " + (WORD[x.kind] || "")); } catch (e) {}
      }).subscribe();
    } catch (e) {}
  }

  function sheet() {
    var el = document.getElementById("ntSheet"); if (el) return el;
    css();
    el = document.createElement("div"); el.id = "ntSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Notifications");
    el.innerHTML = '<div class="nt-p"><div class="nt-h">🔔 Notifications<span id="ntSnd" role="button" tabindex="0" style="margin-left:auto;font:600 12px Inter,system-ui,sans-serif;letter-spacing:.04em;text-transform:none;color:var(--steel,#999);cursor:pointer;padding:4px 8px;border:1px solid var(--line,#333);border-radius:999px"></span><button type="button" aria-label="Close" style="margin-left:6px">✕</button></div><div id="ntList"></div></div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el || e.target.closest(".nt-h button")) { close(); return; }
      if (e.target.closest("#ntSnd")) { try { localStorage.setItem("shk_ntping", pingOn() ? "0" : "1"); } catch (x) {} sndLabel(); if (pingOn()) { unlock(); setTimeout(ping, 30); } return; }
      var it = e.target.closest(".nt-it[data-i]"); if (it) { var x = S.rows[+it.getAttribute("data-i")]; close(); go(x); }
    });
    return el;
  }
  function sndLabel() { var t = document.getElementById("ntSnd"); if (t) t.textContent = pingOn() ? "🔊 Sound on" : "🔇 Sound off"; }
  function paintList() {
    var L = document.getElementById("ntList"); if (!L) return;
    if (!S.rows.length) { L.innerHTML = '<div class="nt-none">Nothing yet. Likes, comments, replies, @tags and Corral Run races show up here.</div>'; return; }
    L.innerHTML = S.rows.map(function (x, i) {
      return '<div class="nt-it' + (x.seen_at ? "" : " new") + '" data-i="' + i + '"><div class="nt-ic">' + (ICON[x.kind] || "🔔") + '</div><div class="nt-tx"><b>' + esc(x.actor_handle || "Someone") + "</b> " + esc(WORD[x.kind] || "") +
        (x.snippet ? '<span class="nt-sn">' + esc(x.snippet) + "</span>" : "") + '</div><div class="nt-t">' + ago(x.created_at) + "</div></div>";
    }).join("");
  }
  async function open() {
    sheet().classList.add("on"); paintList(); sndLabel();
    if (!S.at || Date.now() - S.at > 3e4) load();
    if (S.unseen) {
      try { await sb().rpc("notifs_seen_all"); } catch (e) {}
      S.rows.forEach(function (x) { x.seen_at = x.seen_at || new Date().toISOString(); }); S.unseen = 0; paintBell();
    }
  }
  function close() { var el = document.getElementById("ntSheet"); el && el.classList.remove("on"); }

  /* tap → the Social tab, the post itself; for a comment, reply or tag in comments, its comments open too */
  function go(x) {
    if (!x) return;
    if (/^race/.test(x.kind || "")) {   /* #corral(nov18): a Corral Run call-out, live invite or result opens the game on that race */
      var mm = /^(cr|ch):(\d+)$/.exec(String(x.story_id || ""));   /* cr: a 1v1 race, ch: a 4/6-player race */
      crOpen(mm ? (mm[1] === "ch" ? "?heat=" : "?race=") + mm[2] : "");
      return;
    }
    if (x.kind === "news") { var u = String(x.story_id || ""); if (/^https:\/\//.test(u)) location.href = u; else open(); return; }   /* #appstore(nov18): a notice from the Order, with a link */
    if (x.kind === "join") {   /* a hall join request: the Ports tab, looking at that hall, where the Let in / Decline card is */
      try { var pb = document.querySelector('.nav button[data-scr="ports"]'); pb && pb.click(); } catch (e) {}
      setTimeout(function () { try { window.SHK_PORTS && SHK_PORTS.explore(/SD ·/.test(x.snippet || "") ? "sd" : "sf"); window.SHK_HALL_GATE && SHK_HALL_GATE.requests(); } catch (e) {} }, 400);
      return;
    }
    try { var nb = document.querySelector('.nav button[data-scr="order"]'); nb && nb.click(); } catch (e) {}
    var tries = 0;
    (function find() {
      var post = x.story_id && document.querySelector('.bpost[data-sid="' + String(x.story_id).replace(/"/g, "") + '"]');
      if (!post) { if (++tries < 12) return setTimeout(find, 250); try { typeof toast === "function" && toast("That post is further back on the Board"); } catch (e) {} return; }
      try { post.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { post.scrollIntoView(); }
      post.classList.add("nt-flash"); setTimeout(function () { post.classList.remove("nt-flash"); }, 1800);
      if (x.kind !== "like") { var cb = post.querySelector("[data-bcm]"); if (cb) setTimeout(function () { cb.click(); }, 500); }
    })();
  }

  /* a tapped phone alert (push-notif sends go:"notifs:<id>"): an open app is told by the service worker; a cold start
     carries it in the hash. Either way, land on the post it was about, and clear it as seen. */
  async function fromAlert(tag) {
    var m = /^notifs(?::(\d+))?$/.exec(String(tag || "")); if (!m) return false;
    await load();
    var x = m[1] ? S.rows.find(function (r) { return String(r.id) === m[1]; }) : null;
    if (x) {
      try { await sb().from("notifs").update({ seen_at: new Date().toISOString() }).eq("id", x.id); x.seen_at = x.seen_at || new Date().toISOString(); S.unseen = S.rows.filter(function (r) { return !r.seen_at; }).length; paintBell(); } catch (e) {}
      go(x);
    } else open();
    return true;
  }
  try {
    navigator.serviceWorker && navigator.serviceWorker.addEventListener("message", function (e) {
      var d = e && e.data; if (d && d.type === "ALERT_TAP" && /^notifs/.test(String(d.go || ""))) fromAlert(d.go);
    });
  } catch (e) {}
  function boot() {
    var n = 0, t = setInterval(function () {
      if (sb() && me() && document.querySelector(".hdr-console .hc-right")) { clearInterval(t); bell(); load(); live();
        try { var hm = /#go=(notifs[^&]*)/.exec(location.hash || ""); if (hm) { fromAlert(decodeURIComponent(hm[1])); history.replaceState(null, "", location.pathname + location.search); } } catch (e) {} setInterval(load, 120000); document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); }); }
      else if (++n > 120) clearInterval(t);
    }, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.SHK_NOTIFS = { open: open, load: load, get rows() { return S.rows; } };
})();
