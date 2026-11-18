/* The Shadow Hook · notifs.js (nov1g) — who liked your post, commented on it, replied to you, or tagged you (@handle).
   Rows are written on the server by triggers (public.notifs); this file shows them: a 🔔 in the header with the unseen
   count, a sheet with the list, live updates, and a tap takes you to the post. */
(function () {
  "use strict";
  if (window.SHK_NOTIFS) return;
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
  var WORD = { race: "called you out on Corral Run", racelive: "wants a LIVE race on Corral Run", raced: "raced you on Corral Run", racenope: "passed on your Corral Run race", join: "asked to join", like: "liked your post", clike: "liked your comment", comment: "commented on your post", reply: "replied to you", mention: "tagged you" };
  var ICON = { race: "🏁", racelive: "🔴", raced: "🏁", racenope: "🚫", join: "🚪", like: "❤️", clike: "❤️", comment: "💬", reply: "↩️", mention: "@" };

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
    if (!sb() || !me() || IP.cur || IP.busy || document.hidden) return;
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
    if (yes) { location.href = "/corral-run.html?" + (x.t === "heat" ? "heat=" : "race=") + x.id + "&go=1"; return; }
    try { await sb().rpc(x.t === "heat" ? "cr_heat_decline" : "cr_decline", { p_id: x.id }); try { typeof toast === "function" && toast("Passed — " + x.by + " knows"); } catch (e) {} } catch (e) {}
    IP.skip[x.t + x.id] = 1; IP.busy = false; hidePop(); setTimeout(function () { checkInv(true); }, 600);
  }

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
      location.href = "/corral-run.html" + (mm ? (mm[1] === "ch" ? "?heat=" : "?race=") + mm[2] : "");
      return;
    }
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
