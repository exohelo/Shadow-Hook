/* The Shadow Hook · notifs.js (nov1f) — who liked your post, commented on it, replied to you, or tagged you (@handle).
   Rows are written on the server by triggers (public.notifs); this file shows them: a 🔔 in the header with the unseen
   count, a sheet with the list, live updates, and a tap takes you to the post. */
(function () {
  "use strict";
  if (window.SHK_NOTIFS) return;
  /* #nov1(gate) — the hall gate (hall_gate.js) rides in with this file until index.html carries its own tag */
  try { if (!window.SHK_HALL_GATE && !document.querySelector('script[src*="hall_gate.js"]')) { var hg = document.createElement("script"); hg.src = "hall_gate.js?v=nov1a"; hg.defer = true; (document.head || document.documentElement).appendChild(hg); } } catch (e) {}
  var S = { rows: [], unseen: 0, chan: null, at: 0 };
  function sb() { return window.SB; }
  function me() { return window.__shkUid || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ago(ts) { var s = (Date.now() - new Date(ts).getTime()) / 1e3; return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + "m" : s < 86400 ? Math.round(s / 3600) + "h" : Math.round(s / 86400) + "d"; }
  var WORD = { join: "asked to join", like: "liked your post", clike: "liked your comment", comment: "commented on your post", reply: "replied to you", mention: "tagged you" };
  var ICON = { join: "🚪", like: "❤️", clike: "❤️", comment: "💬", reply: "↩️", mention: "@" };

  /* #nov1(rfltag): the floating RAFFLE tag under the header repeats the raffle banner already on Social; while that
     banner is on the page the tag stays hidden */
  try { var rt = document.createElement("style"); rt.id = "rflTagOff"; rt.textContent = "html:has(.rfl-bn) #rflTag{display:none!important}"; (document.head || document.documentElement).appendChild(rt); } catch (e) {}
  var CSS = "#hcnt{position:relative}#hcnt.quiet{opacity:.55}" +
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
    /* the bell shows only while something is new; once opened it goes away until the next one */
    b.style.display = me() && S.unseen > 0 ? "" : "none";
    b.classList.toggle("quiet", !S.unseen);
    var n = document.getElementById("hcNtN"); if (n) n.textContent = S.unseen ? (S.unseen > 99 ? "99+" : String(S.unseen)) : "";
    b.title = S.unseen ? S.unseen + " new" : "Notifications";
  }

  async function load() {
    if (!sb() || !me()) return;
    try {
      var r = await sb().from("notifs").select("id,kind,actor_handle,story_id,comment_id,snippet,created_at,seen_at").eq("uid", me()).order("created_at", { ascending: false }).limit(60);
      if (r && !r.error) { S.rows = r.data || []; S.unseen = S.rows.filter(function (x) { return !x.seen_at; }).length; S.at = Date.now(); }
    } catch (e) {}
    paintBell(); paintList();
  }
  function live() {
    if (S.chan || !sb() || !me()) return;
    try {
      S.chan = sb().channel("notifs:" + me()).on("postgres_changes", { event: "INSERT", schema: "public", table: "notifs", filter: "uid=eq." + me() }, function (p) {
        var x = p && p.new; if (!x) return;
        S.rows.unshift(x); S.unseen++; paintBell(); paintList();
        try { typeof toast === "function" && toast((ICON[x.kind] || "🔔") + " " + (x.actor_handle || "Someone") + " " + (WORD[x.kind] || "")); } catch (e) {}
      }).subscribe();
    } catch (e) {}
  }

  function sheet() {
    var el = document.getElementById("ntSheet"); if (el) return el;
    css();
    el = document.createElement("div"); el.id = "ntSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Notifications");
    el.innerHTML = '<div class="nt-p"><div class="nt-h">🔔 Notifications<button type="button" aria-label="Close">✕</button></div><div id="ntList"></div></div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      if (e.target === el || e.target.closest(".nt-h button")) { close(); return; }
      var it = e.target.closest(".nt-it[data-i]"); if (it) { var x = S.rows[+it.getAttribute("data-i")]; close(); go(x); }
    });
    return el;
  }
  function paintList() {
    var L = document.getElementById("ntList"); if (!L) return;
    if (!S.rows.length) { L.innerHTML = '<div class="nt-none">Nothing yet. Likes, comments, replies and @tags on your posts show up here.</div>'; return; }
    L.innerHTML = S.rows.map(function (x, i) {
      return '<div class="nt-it' + (x.seen_at ? "" : " new") + '" data-i="' + i + '"><div class="nt-ic">' + (ICON[x.kind] || "🔔") + '</div><div class="nt-tx"><b>' + esc(x.actor_handle || "Someone") + "</b> " + esc(WORD[x.kind] || "") +
        (x.snippet ? '<span class="nt-sn">' + esc(x.snippet) + "</span>" : "") + '</div><div class="nt-t">' + ago(x.created_at) + "</div></div>";
    }).join("");
  }
  async function open() {
    sheet().classList.add("on"); paintList();
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
