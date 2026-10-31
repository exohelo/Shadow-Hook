/* The Shadow Hook · ports_ext.js (nov1a) — Phase 3: one app, many halls.
   Loads after ports.js and the harbor packs (harbor_sf.js, harbor_sd.js). Two ideas, kept apart:

   HOME PORT  (profiles.home_port, via ports.js / my_port())
     · every hall table read or written by the app is scoped to it — board_wire, live_wire, drop_wire,
       dispatch_boards, pma_sheets, hall_line_log, mark_draws, hall_counts, board_history
       (we wrap SB.from(): selects/updates/deletes get .eq("port", home); inserts/upserts carry port,
       and upserts on the shift key become onConflict "port,k" — needs PORT-KEYS.sql applied first)
     · realtime channels on those tables get filter "port=eq.<home>"
     · the NWS alert feed, PORTSIG (LA volumes) and the Ports tab start on the home port
   VIEWING PORT  (this session only)
     · the chip in THE HARBOR header: tap it, pick a hall, the map / dock list / lore / legend swap to that
       port's pack. Read-only: drops, marks and calls still go to the home port. Leaving the Ports tab
       puts the home port back.

   Nothing in index.html changes; this file swaps TERMINALS / PORT_GROUPS in place and repaints. */
(function () {
  "use strict";
  if (window.SHK_PORTS) return;

  var HALL = { /* table → the shift-key column (null = no shift key; filter only) */
    board_wire: "k", live_wire: "k", drop_wire: "k", dispatch_boards: "key", pma_sheets: "key",
    hall_line_log: null, mark_draws: "slot", hall_counts: "k", board_history: "k", scan_tape: null
  };
  var LS_HOME = "shk_home_port";
  var S = { home: "lalb", homeSure: false, view: "lalb", packs: {}, applied: null };

  function log() { try { if (window.DEVLOG && DEVLOG.data) DEVLOG.data("ports_ext", Array.prototype.slice.call(arguments)); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* ------------------------------------------------------------------ home port ------------------------------------------------------------------ */
  function homeFromPortJs() {
    try { var c = window.PORT && window.PORT.port && window.PORT.port.code; if (c) return String(c); } catch (e) {}
    return null;
  }
  (function bootHome() {
    var c = homeFromPortJs();
    if (!c) { try { c = localStorage.getItem(LS_HOME); } catch (e) {} }
    if (c) S.home = S.view = c;
  })();
  function setHome(code, sure) {
    code = String(code || "lalb");
    var changed = code !== S.home;
    S.home = code; if (sure) S.homeSure = true;
    try { localStorage.setItem(LS_HOME, code); } catch (e) {}
    if (changed) {
      log("home port →", code);
      if (S.view === S.applied || !S.applied) { S.view = code; applyPack(code); }
      try { document.dispatchEvent(new CustomEvent("shk:home-port", { detail: { code: code } })); } catch (e) {}
      /* data already on the phone was read for the old port: pull again */
      ["liveRefreshAll", "dwPull", "bwPull", "renderHarborBoard"].forEach(function (fn) { try { typeof window[fn] === "function" && window[fn](); } catch (e) {} });
    }
    guardLalbOnly();
  }
  async function confirmHome() {
    var c = homeFromPortJs();
    if (c) { setHome(c, true); return; }
    try {
      if (!window.SB) return;
      var r = await window.SB.rpc("my_port");
      if (r && !r.error && typeof r.data === "string") setHome(r.data, true);
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ LA/LB-only machinery off elsewhere ------------------------------------------ */
  function guardLalbOnly() {
    if (S.home === "lalb") return;
    try { if (window.PORTSIG) { window.PORTSIG.adjust = function () { return null; }; window.PORTSIG.load = function () {}; } } catch (e) {}
  }

  /* ------------------------------------------------------------------ Supabase scoping ------------------------------------------------------------ */
  function addPort(rows) {
    var p = S.home;
    if (Array.isArray(rows)) return rows.map(function (r) { return (r && typeof r === "object" && r.port == null) ? Object.assign({}, r, { port: p }) : r; });
    if (rows && typeof rows === "object" && rows.port == null) return Object.assign({}, rows, { port: p });
    return rows;
  }
  function wrapBuilder(q, table) {
    var key = HALL[table];
    var oSel = q.select, oIns = q.insert, oUp = q.upsert, oUpd = q.update, oDel = q.delete;
    q.select = function () { var b = oSel.apply(q, arguments); try { b = b.eq("port", S.home); } catch (e) {} return b; };
    q.insert = function (rows, opts) { return oIns.call(q, addPort(rows), opts); };
    q.upsert = function (rows, opts) {
      var o = Object.assign({}, opts || {});
      if (key && (o.onConflict === key || !o.onConflict)) o.onConflict = "port," + key;
      return oUp.call(q, addPort(rows), o);
    };
    q.update = function (vals, opts) { var b = oUpd.call(q, vals, opts); try { b = b.eq("port", S.home); } catch (e) {} return b; };
    q.delete = function (opts) { var b = oDel.call(q, opts); try { b = b.eq("port", S.home); } catch (e) {} return b; };
    return q;
  }
  function patchSB() {
    var sb = window.SB;
    if (!sb || sb.__shkPortScoped) return !!sb;
    try {
      var oFrom = sb.from.bind(sb);
      sb.from = function (table) { var q = oFrom(table); return Object.prototype.hasOwnProperty.call(HALL, table) ? wrapBuilder(q, table) : q; };
      var oChan = sb.channel.bind(sb);
      sb.channel = function (name, opts) {
        var ch = oChan(name, opts), oOn = ch.on;
        ch.on = function (type, cfg, cb) {
          try {
            if (type === "postgres_changes" && cfg && cfg.table && Object.prototype.hasOwnProperty.call(HALL, cfg.table) && !cfg.filter)
              cfg = Object.assign({}, cfg, { filter: "port=eq." + S.home });
          } catch (e) {}
          return oOn.call(ch, type, cfg, cb);
        };
        return ch;
      };
      sb.__shkPortScoped = true;
      log("SB scoped to", S.home);
    } catch (e) { log("SB patch failed", String(e)); }
    return true;
  }
  if (!patchSB()) { var tries = 0, t = setInterval(function () { if (patchSB() || ++tries > 40) clearInterval(t); }, 250); }

  /* the NWS alert feed is hardcoded to San Pedro Bay in index.html — point it at the home port */
  try {
    var oFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      try {
        var u = typeof input === "string" ? input : input && input.url;
        if (u && /api\.weather\.gov\/alerts\/active\?point=/.test(u) && S.home !== "lalb") {
          var p = portOf(S.home);
          if (p && p.lat && p.lon) {
            var nu = u.replace(/point=[-\d.]+,[-\d.]+/, "point=" + p.lat + "," + p.lon);
            input = typeof input === "string" ? nu : new Request(nu, input);
          }
        }
      } catch (e) {}
      return oFetch(input, init);
    };
  } catch (e) {}

  /* ------------------------------------------------------------------ the packs ------------------------------------------------------------------ */
  var PORT_META = { /* fallback when ports.js hasn't loaded the ports table yet */
    lalb: { short: "LA/LB", name: "Los Angeles / Long Beach", local: "ILWU Local 13", lat: 33.7701, lon: -118.1937, status: "live" },
    sf: { short: "SF/OAK", name: "San Francisco Bay Area (Oakland)", local: "ILWU Local 10", lat: 37.802, lon: -122.312, status: "planned" },
    sd: { short: "SD", name: "San Diego", local: "ILWU Local 29", lat: 32.7157, lon: -117.1611, status: "planned" }
  };
  function portOf(code) {
    try { var o = window.PORT && window.PORT.port; if (o && o.code === code) return o; } catch (e) {}
    try { var L = window.PORT && (window.PORT.ports || window.PORT.ports_open); if (Array.isArray(L)) { var h = L.find(function (x) { return x && x.code === code; }); if (h) return h; } } catch (e) {}
    return PORT_META[code] || { short: code.toUpperCase(), name: code, status: "planned" };
  }

  function captureLalb() {
    if (S.packs.lalb) return S.packs.lalb;
    var svg = document.getElementById("hmSvg"), foot = document.querySelector("#harborSky .hm-foot");
    var pack = {
      code: "lalb", short: "LA/LB", title: "San Pedro Bay", src: "◆ LA / LONG BEACH",
      aria: svg ? svg.getAttribute("aria-label") : "", svg: svg ? svg.innerHTML : "",
      terminals: (typeof TERMINALS !== "undefined" && Array.isArray(TERMINALS)) ? TERMINALS.slice() : [],
      groups: (typeof PORT_GROUPS !== "undefined" && Array.isArray(PORT_GROUPS)) ? PORT_GROUPS.slice() : [],
      groupOf: (typeof portGroupOf === "function") ? portGroupOf : null,
      legendHtml: foot ? Array.prototype.filter.call(foot.children, function (c) { return !c.classList.contains("hm-zh"); }).map(function (c) { return c.outerHTML; }).join("") : "",
      lore: { ports: Object.assign({}, (window.HARBOR_LORE || {}).ports || {}), docks: Object.assign({}, (window.HARBOR_LORE || {}).docks || {}) }
    };
    S.packs.lalb = pack;
    S.applied = "lalb";
    return pack;
  }
  function packOf(code) {
    if (code === "lalb") return captureLalb();
    var p = window.HARBOR_PACKS && window.HARBOR_PACKS[code];
    if (p && !p.legendHtml) p.legendHtml = (p.legend || []).map(function (l) { return '<span><i style="background:var(--' + l[0] + ');border:1px solid var(--' + l[1] + ')"></i>' + esc(l[2]) + "</span>"; }).join("");
    return p || null;
  }
  function allCodes() {
    var c = ["lalb"];
    try { Object.keys(window.HARBOR_PACKS || {}).forEach(function (k) { c.indexOf(k) < 0 && c.push(k); }); } catch (e) {}
    return c;
  }

  function replaceInPlace(arr, next) { if (!Array.isArray(arr)) return; arr.splice.apply(arr, [0, arr.length].concat(next || [])); }
  function setGroupOf(fn) {
    try { if (typeof portGroupOf === "function" && window.portGroupOf === portGroupOf) window.portGroupOf = fn || S.packs.lalb.groupOf; } catch (e) {}
  }
  function applyPack(code) {
    captureLalb();
    var pack = packOf(code);
    if (!pack) { log("no pack for", code); return false; }
    S.applied = code; S.view = code;
    try { replaceInPlace(typeof TERMINALS !== "undefined" ? TERMINALS : null, pack.terminals); } catch (e) {}
    try { replaceInPlace(typeof PORT_GROUPS !== "undefined" ? PORT_GROUPS : null, pack.groups); } catch (e) {}
    setGroupOf(pack.groupOf);
    try {
      var L = window.HARBOR_LORE = window.HARBOR_LORE || { ports: {}, docks: {} };
      Object.keys(L.ports).forEach(function (k) { delete L.ports[k]; }); Object.assign(L.ports, pack.lore.ports);
      Object.keys(L.docks).forEach(function (k) { delete L.docks[k]; }); Object.assign(L.docks, pack.lore.docks);
    } catch (e) {}
    try {
      var svg = document.getElementById("hmSvg");
      if (svg) { svg.innerHTML = pack.svg; svg.setAttribute("aria-label", pack.aria || ""); svg.style.transform = ""; }
      var foot = document.querySelector("#harborSky .hm-foot");
      if (foot) { var zh = foot.querySelector(".hm-zh"); foot.innerHTML = pack.legendHtml || ""; zh && foot.appendChild(zh); }
      var src = document.getElementById("harborSrc"); src && (src.textContent = pack.src || "");
      var bay = document.querySelector("#harborBoard .hb-top .wire-slot:nth-of-type(2)"); bay && (bay.textContent = pack.title || "");
      var sec = document.getElementById("hbSec"); sec && (sec.textContent = String(pack.terminals.filter(function (t) { return t.security; }).length));
      var tm = document.getElementById("hbTerms"); tm && (tm.textContent = String(pack.terminals.length));
    } catch (e) {}
    repaint();
    paintChip();
    try { document.dispatchEvent(new CustomEvent("shk:port-view", { detail: { code: code, home: S.home } })); } catch (e) {}
    return true;
  }
  function repaint() {
    var q = ""; try { q = (document.getElementById("portSearch") || {}).value || ""; } catch (e) {}
    ["renderPorts", "renderHarborBoard", "refreshDockSheet", "harborHighlight"].forEach(function (fn) {
      try { typeof window[fn] === "function" && (fn === "renderPorts" ? window[fn](q) : window[fn]()); } catch (e) {}
    });
    try { typeof window.closeHarborView === "function" && window.harborViewOpen && window.harborViewOpen() && window.closeHarborView(); } catch (e) {}
  }

  /* ------------------------------------------------------------------ the chip ------------------------------------------------------------------- */
  var CSS = ".hm-pick{margin-left:4px;background:var(--plate-2);border:1px solid var(--line);color:var(--copper-hi);border-radius:8px;padding:5px 9px;font:700 11px/1 Barlow Condensed,sans-serif;letter-spacing:.12em;cursor:pointer;white-space:nowrap;flex:none;text-transform:uppercase}" +
    ".hm-pick.away{border-color:var(--hm-lb-hi,#ff4dd2);color:var(--hm-lb-hi,#ff4dd2)}" +
    ".hm-pickm{position:absolute;z-index:30;left:12px;top:44px;background:var(--plate-2);border:1px solid var(--line);border-radius:10px;padding:6px;min-width:230px;box-shadow:0 10px 30px rgba(0,0,0,.45)}" +
    ".hm-pickm button{display:flex;width:100%;align-items:center;gap:8px;background:none;border:0;color:var(--bone);text-align:left;padding:8px 10px;border-radius:8px;font:600 13px/1.2 Inter,system-ui,sans-serif;cursor:pointer}" +
    ".hm-pickm button:hover,.hm-pickm button:focus{background:rgba(255,255,255,.06);outline:none}" +
    ".hm-pickm button.on{color:var(--copper-hi)}.hm-pickm small{margin-left:auto;font:600 10px/1 Barlow Condensed,sans-serif;letter-spacing:.1em;color:var(--steel);text-transform:uppercase}" +
    ".hm-pickm .st-live{color:#58d68d}.hm-pickm .st-pilot{color:#f5b041}" +
    ".hm-away{margin:0 12px 8px;padding:6px 10px;border:1px dashed var(--hm-lb-line,rgba(255,77,210,.72));border-radius:8px;font:600 11px/1.3 Inter,system-ui,sans-serif;color:var(--steel)}.hm-away b{color:var(--hm-lb-hi,#ff4dd2)}";
  function injectCss() { if (document.getElementById("shkPortsExtCss")) return; var s = document.createElement("style"); s.id = "shkPortsExtCss"; s.textContent = CSS; document.head.appendChild(s); }

  function mountChip() {
    var head = document.querySelector("#harborSky .hm-head");
    if (!head || head.querySelector(".hm-pick")) return;
    injectCss();
    var b = document.createElement("button"); b.type = "button"; b.className = "hm-pick"; b.id = "hmPick"; b.setAttribute("aria-haspopup", "menu");
    var t = head.querySelector(".hm-t"); t ? t.insertAdjacentElement("afterend", b) : head.prepend(b);
    b.addEventListener("click", function (e) { e.stopPropagation(); toggleMenu(); });
    document.addEventListener("click", function () { closeMenu(); });
    paintChip();
  }
  function paintChip() {
    var b = document.getElementById("hmPick"); if (!b) return;
    var p = portOf(S.view), away = S.view !== S.home;
    b.textContent = "◆ " + (p.short || S.view.toUpperCase()) + " ▾";
    b.classList.toggle("away", away);
    b.title = away ? "Exploring " + (p.name || p.short) + " — your hall is " + (portOf(S.home).short || S.home) : "Your hall · tap to explore another port";
    var note = document.getElementById("hmAway"), wrap = document.getElementById("hmWrap");
    if (away) {
      if (!note && wrap) { note = document.createElement("div"); note.id = "hmAway"; note.className = "hm-away"; wrap.insertAdjacentElement("beforebegin", note); }
      if (note) {
        var pk = packOf(S.view) || {};
        note.innerHTML = "Exploring <b>" + esc(p.name || p.short) + "</b> · " + esc(p.local || "") + (pk.hint ? " · " + esc(pk.hint) : "") +
          "<br>Your Wire, drops and MAYDAY stay on <b>" + esc(portOf(S.home).short || S.home) + "</b>. Leaving this tab brings your hall back.";
      }
    } else if (note) note.remove();
  }
  function toggleMenu() { var m = document.getElementById("hmPickMenu"); m ? closeMenu() : openMenu(); }
  function closeMenu() { var m = document.getElementById("hmPickMenu"); m && m.remove(); }
  function openMenu() {
    closeMenu();
    var head = document.querySelector("#harborSky .hm-head"); if (!head) return;
    var m = document.createElement("div"); m.id = "hmPickMenu"; m.className = "hm-pickm"; m.setAttribute("role", "menu");
    m.innerHTML = allCodes().map(function (c) {
      var p = portOf(c), st = String(p.status || (c === "lalb" ? "live" : "planned")).toLowerCase();
      return '<button type="button" role="menuitem" data-code="' + esc(c) + '" class="' + (c === S.view ? "on" : "") + '">' +
        (c === S.home ? "⚓ " : "◆ ") + esc(p.short || c) + ' <span style="opacity:.7;font-weight:500">' + esc(p.local || "") + "</span>" +
        '<small class="st-' + esc(st) + '">' + (c === S.home ? "YOUR HALL" : esc(st)) + "</small></button>";
    }).join("");
    m.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-code]"); if (!b) return;
      e.stopPropagation(); closeMenu(); applyPack(b.getAttribute("data-code"));
    });
    head.style.position = head.style.position || "relative";
    head.appendChild(m);
  }

  /* leaving the Ports tab puts the home port back */
  try {
    new MutationObserver(function () {
      var tab = document.documentElement.dataset.tab || "";
      if (tab && tab !== "ports" && S.view !== S.home) { closeMenu(); applyPack(S.home); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-tab"] });
  } catch (e) {}

  /* ------------------------------------------------------------------ boot ----------------------------------------------------------------------- */
  function boot() {
    captureLalb();
    mountChip();
    guardLalbOnly();
    if (S.home !== "lalb") applyPack(S.home);
    confirmHome();
    var n = 0, w = setInterval(function () { var c = homeFromPortJs(); if (c) { setHome(c, true); clearInterval(w); } else if (++n > 60) clearInterval(w); }, 500);
    document.addEventListener("shk:port", function (e) { try { e.detail && e.detail.code && setHome(e.detail.code, true); } catch (x) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.SHK_PORTS = {
    get home() { return S.home; }, get view() { return S.view; }, get packs() { return S.packs; },
    explore: applyPack, goHome: function () { return applyPack(S.home); }, setHome: setHome, codes: allCodes
  };
})();
