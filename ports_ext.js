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

   THE BOARD (stories) is shared by every hall; each post carries the hall it came from (stories.port, set by a
     trigger from the poster's home port) and this file paints that hall under the poster's name.

   Nothing in index.html changes; this file swaps TERMINALS / PORT_GROUPS in place and repaints. */
(function () {
  "use strict";
  if (window.SHK_PORTS) return;

  var HALL = { /* table → the shift-key column (null = no shift key; filter only) */
    board_wire: "k", live_wire: "k", drop_wire: "k", dispatch_boards: "key", pma_sheets: "key",
    hall_line_log: null, mark_draws: "slot", hall_counts: "k", board_history: "k", scan_tape: null, scan_lessons: null
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
    patchScanner(code);
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
  function addPort(rows, table) {
    var p = (table === "scan_lessons" || table === "scan_samples") && S.teachPort || S.home;
    if (Array.isArray(rows)) return rows.map(function (r) { return (r && typeof r === "object" && r.port == null) ? Object.assign({}, r, { port: p }) : r; });
    if (rows && typeof rows === "object" && rows.port == null) return Object.assign({}, rows, { port: p });
    return rows;
  }
  function wrapBuilder(q, table) {
    var key = HALL[table];
    var oSel = q.select, oIns = q.insert, oUp = q.upsert, oUpd = q.update, oDel = q.delete;
    q.select = function () { var b = oSel.apply(q, arguments); try { b = b.eq("port", S.home); } catch (e) {} return b; };
    q.insert = function (rows, opts) { return oIns.call(q, addPort(rows, table), opts); };
    q.upsert = function (rows, opts) {
      var o = Object.assign({}, opts || {});
      if (key && (o.onConflict === key || !o.onConflict)) o.onConflict = "port," + key;
      return oUp.call(q, addPort(rows, table), o);
    };
    q.update = function (vals, opts) { var b = oUpd.call(q, vals, opts); try { b = b.eq("port", S.home); } catch (e) {} return b; };
    q.delete = function (opts) { var b = oDel.call(q, opts); try { b = b.eq("port", S.home); } catch (e) {} return b; };
    return q;
  }
  /* The Board: stories are shared by every hall; we add "port" to the app's column list and remember id → port */
  var STORY_PORT = {};
  function wrapStories(q) {
    var oSel = q.select;
    q.select = function (cols, opts) {
      try { if (typeof cols === "string" && cols !== "*" && !/\bport\b/.test(cols)) cols += ",port"; } catch (e) {}
      var b = oSel.call(q, cols, opts);
      try {
        var oThen = b.then.bind(b);
        b.then = function (ok, err) {
          return oThen(function (r) {
            try { (r && r.data || []).forEach(function (x) { if (x && x.id != null) STORY_PORT[String(x.id)] = x.port || null; }); paintStoryPorts(); } catch (e) {}
            return ok ? ok(r) : r;
          }, err);
        };
      } catch (e) {}
      return b;
    };
    return q;
  }
  function patchSB() {
    var sb = window.SB;
    if (!sb || sb.__shkPortScoped) return !!sb;
    try {
      var oFrom = sb.from.bind(sb);
      sb.from = function (table) {
        var q = oFrom(table);
        if (table === "stories") return wrapStories(q);
        return Object.prototype.hasOwnProperty.call(HALL, table) ? wrapBuilder(q, table) : q;
      };
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
    if (S.view !== code) S.viewKey = null;
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
      var view = (pack.views || []).find(function (v) { return v.key === S.viewKey; }) || (pack.views || [])[0] || null;
      if (svg) { svg.innerHTML = view ? view.svg : pack.svg; svg.setAttribute("aria-label", (view && view.aria) || pack.aria || ""); }
      paintViews(pack, view);
      /* the map keeps its own zoom state (translate+scale on the svg); go back to "the whole bay" for the new port */
      try { var fit = document.querySelector("#hmWrap .hm-zc button[data-z=fit]"); if (fit && !fit.disabled) fit.click(); } catch (e) {}
      var foot = document.querySelector("#harborSky .hm-foot");
      if (foot) { var zh = foot.querySelector(".hm-zh"); foot.innerHTML = pack.legendHtml || ""; zh && foot.appendChild(zh); }
      var src = document.getElementById("harborSrc"); src && (src.textContent = pack.src || "");
      var bay = document.querySelector("#harborBoard .hb-top .wire-slot:nth-of-type(2)"); bay && (bay.textContent = (view && view.title) || pack.title || "");
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

  /* ------------------------------------------------------------------ the docket scanner, per port ------------------------------------------------ */
  /* The reader (Tesseract + parseDocket) resolves what it reads against TERMINALS, so the operator names already follow
     the port. Two LA/LB-isms live outside that list: berthCandidates() only accepts TI/LB/LA prefixes, and SCAN_TERMS
     is the token list the reader hunts for on the slip. Both are fixed here without touching index.html. */
  var SCAN_TOKENS = {
    sf: ["OICT", "OAKLAND", "OUTER HARBOR", "MIDDLE HARBOR", "BEN NUTTER", "NUTTER", "HOWARD", "TRAPAC", "EVERPORT", "ETS", "MATSON", "SSA",
         "PASHA", "PIER 80", "PIER 96", "PIER 94", "PIER 92", "PIER 27", "PIER 35", "PIER 70", "RICHMOND", "BENICIA", "REDWOOD", "AMPORTS", "LEVIN"],
    sd: ["TENTH", "10TH", "TAMT", "NCMT", "NATIONAL CITY", "DOLE", "B STREET", "BROADWAY", "PASHA", "CRUISE"]
  };
  var BERTH_PREFIX = /^(OAK|SF|SD|PIER)\s*/;
  function patchScanner(code) {
    try {
      if (typeof window.berthCandidates === "function" && !window.berthCandidates.__shk) {
        var oBC = window.berthCandidates;
        var w = function (raw) {
          var q = String(raw || "").trim().toUpperCase().replace(/\s+/g, " ");
          if (S.home !== "lalb") q = q.replace(BERTH_PREFIX, "");
          return oBC(q);
        };
        w.__shk = true; window.berthCandidates = w;
      }
    } catch (e) {}
    try {
      if (typeof SCAN_TERMS !== "undefined" && Array.isArray(SCAN_TERMS) && SCAN_TOKENS[code])
        SCAN_TOKENS[code].forEach(function (t) { SCAN_TERMS.indexOf(t) < 0 && SCAN_TERMS.push(t); });
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ the reader gate + samples + the Keymaster's bench ------------------------- */
  /* A hall whose reader is not open yet (ports.scan_open=false) never seals a scanned docket on its own: every scan goes
     through the confirm form, and each one lands in scan_samples with what the reader read and what the member said.
     (The bench card that replayed those on the Ports tab was removed Nov 1; the samples still land in scan_samples.) */
  S.scanOpen = { lalb: true }; S.teachPort = null; S.forcedHandoff = false;
  async function loadScanOpen() {
    try {
      if (!window.SB) return;
      var r = await window.SB.from("ports").select("code,scan_open");
      if (r && !r.error && Array.isArray(r.data)) r.data.forEach(function (x) { S.scanOpen[x.code] = !!x.scan_open; });
    } catch (e) {}
  }
  function gateClosed() { return S.home !== "lalb" && !S.scanOpen[S.home]; }
  function truthOf(j) { if (!j) return null; return { terminal: j.terminal || null, berth: j.berth || null, ship: j.ship || null, category: j.category || null, date: j.date || null, shift: j.shift || null, pos: j.pos || null }; }
  function docketById(id) { try { if (typeof DOCKETS !== "undefined" && Array.isArray(DOCKETS)) return DOCKETS.find(function (d) { return d && (d._id === id || d._uid === id); }) || null; } catch (e) {} return null; }
  async function sampleInsert(row) {
    try {
      if (!window.SB || !window.__shkUid) return null;
      var a = {}; try { a = (typeof loadAcct === "function" && loadAcct()) || {}; } catch (e) {}
      var r = await window.SB.from("scan_samples").insert(Object.assign({ owner: window.__shkUid, by_handle: a.handle || null, port: S.teachPort || S.home }, row)).select("id").single();
      return r && !r.error && r.data ? r.data.id : null;
    } catch (e) { return null; }
  }
  function patchScanFlow() {
    try {
      if (typeof window.sealScan === "function" && !window.sealScan.__shk) {
        var oSeal = window.sealScan;
        var w = function (p) {
          if (gateClosed() && typeof window.scanHandOff === "function") {
            S.forcedHandoff = true;
            try { if (typeof toast === "function") toast("The reader is still learning " + (portOf(S.home).short || S.home) + " slips — check it and seal by hand"); } catch (e) {}
            return window.scanHandOff(p);
          }
          return oSeal.apply(this, arguments);
        };
        w.__shk = true; window.sealScan = w;
      }
      if (typeof window.scanRawKeep === "function" && !window.scanRawKeep.__shk) {
        var oKeep = window.scanRawKeep;
        var k = function (id, last) {
          var r = oKeep.apply(this, arguments);
          try {
            if (S.home !== "lalb" && last && last.text) {
              var j = docketById(id), confirmed = S.forcedHandoff; S.forcedHandoff = false;
              sampleInsert({ docket_id: String(id || ""), ocr_text: String(last.text).slice(0, 4000), parsed: last.p || null, truth: truthOf(j), confirmed: confirmed });
            }
          } catch (e) {}
          return r;
        };
        k.__shk = true; window.scanRawKeep = k;
      }
      if (typeof window.scanLearnFromEdit === "function" && !window.scanLearnFromEdit.__shk) {
        var oEdit = window.scanLearnFromEdit;
        var ed = function (id, sealed) {
          var r = oEdit.apply(this, arguments);
          try { if (S.home !== "lalb" && window.SB && window.__shkUid && id) window.SB.from("scan_samples").update({ truth: truthOf(sealed), confirmed: true }).eq("docket_id", String(id)).eq("owner", window.__shkUid).then(function () {}); } catch (e) {}
          return r;
        };
        ed.__shk = true; window.scanLearnFromEdit = ed;
      }
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ the Board: hall under the name ---------------------------------------------- */
  var PORT_LABEL = { lalb: "Los Angeles · Long Beach", sf: "San Francisco · Oakland", sd: "San Diego" };
  function portLabel(code) { var p = portOf(code); return PORT_LABEL[code] || (p && p.name) || String(code || "").toUpperCase(); }
  /* the city a dock sits in, by the port's berth groups */
  var CITY = { lalb: { LA: "Los Angeles", TI: "Terminal Island", LB: "Long Beach" }, sf: { OH: "Oakland", IH: "Oakland", RL: "Oakland", SF: "San Francisco", BY: "Bay Area" }, sd: { SD: "San Diego", NC: "National City" } };
  function groupOfIn(code, t) {
    var pk = packOf(code);
    try { if (pk && typeof pk.groupOf === "function") { var g = pk.groupOf(t); if (g) return g; } } catch (e) {}
    var b = String(t.berths || "").toUpperCase();
    if (code === "lalb") return /^LB/.test(b) ? "LB" : /^TI/.test(b) ? "TI" : /^(LA|OH|SP)/.test(b) ? "LA" : "YD";
    return "YD";
  }
  /* "PA · China Shipping" (the #dockping tag: operator · aka) → the terminal, then its city */
  function dockCity(code, tag) {
    var pk = packOf(code); if (!pk || !tag) return null;
    var parts = String(tag).split("·").map(function (x) { return x.trim().toLowerCase(); }), op = parts[0] || "", rest = parts.slice(1).join(" ");
    var hit = null;
    (pk.terminals || []).some(function (t) {
      var o = String(t.operator || "").toLowerCase();
      if (o !== op) return false;
      var hay = (String(t.aka || "") + " " + String(t.berths || "")).toLowerCase();
      if (!rest || hay.indexOf(rest.split(" / ")[0]) >= 0 || hay.indexOf(rest) >= 0) { hit = t; return true; }
      return false;
    });
    if (!hit) (pk.terminals || []).some(function (t) { if (String(t.operator || "").toLowerCase() === op) { hit = t; return true; } return false; });
    if (!hit) return null;
    var g = groupOfIn(code, hit);
    return (CITY[code] || {})[g] || null;
  }
  function paintStoryPorts() {
    var cards = document.querySelectorAll(".bpost[data-sid]");
    if (!cards.length) return;
    injectCss();
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], who = c.querySelector(".bp-who"); if (!who) continue;
      var sid = c.getAttribute("data-sid"), code = STORY_PORT[sid];
      if (code === undefined) code = /^srv|^loc|^tmp/.test(sid) || c.classList.contains("mine") ? S.home : null;
      if (!code) continue;
      /* the on-shift dock tag (#dockping) folds into the pill: ⚓ LONG BEACH · PCT · Pier J · on shift */
      var dockEl = c.querySelector(".bp-dock span"), tag = "";
      if (dockEl) { tag = dockEl.textContent.replace(/^\s*📍\s*/, "").replace(/\s*·\s*on shift\s*$/i, "").trim(); }
      var city = tag ? dockCity(code, tag) : null;
      var text = "⚓ " + (city || portLabel(code)) + (tag ? " · " + tag + " · on shift" : "");
      var el = who.querySelector(".bp-port");
      if (!el) { el = document.createElement("i"); el.className = "bp-port"; who.appendChild(el); }
      if (el.getAttribute("data-port") !== code || el.textContent !== text) {
        el.setAttribute("data-port", code);
        el.className = "bp-port p-" + code + (code === S.home ? " home" : "") + (tag ? " shift" : "");
        el.textContent = text;
        el.title = (portOf(code).local || "") + " · " + (portOf(code).name || code) + (tag ? " · tagged at " + tag : "");
      }
      if (dockEl && dockEl.parentNode && !dockEl.parentNode.hidden) dockEl.parentNode.hidden = true;
    }
  }
  try {
    var _spT = 0;
    new MutationObserver(function () { if (_spT) return; _spT = setTimeout(function () { _spT = 0; paintStoryPorts(); }, 120); })
      .observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  /* ------------------------------------------------------------------ a port with several frames (Oakland · San Francisco · the Bay) ----------- */
  S.viewKey = null;
  function paintViews(pack, view) {
    var row = document.getElementById("hmViews"), wrap = document.getElementById("hmWrap");
    if (!pack.views || pack.views.length < 2) { row && row.remove(); return; }
    injectCss();
    if (!row && wrap) { row = document.createElement("div"); row.id = "hmViews"; row.className = "hm-views"; wrap.insertAdjacentElement("beforebegin", row); row.addEventListener("click", function (e) { var b = e.target.closest("button[data-view]"); b && setView(b.getAttribute("data-view")); }); }
    if (!row) return;
    row.innerHTML = pack.views.map(function (v) { return '<button type="button" data-view="' + esc(v.key) + '" class="' + (view && view.key === v.key ? "on" : "") + '">' + esc(v.label) + "</button>"; }).join("");
  }
  function setView(key) {
    var pack = packOf(S.view); if (!pack || !pack.views) return;
    var v = pack.views.find(function (x) { return x.key === key; }); if (!v) return;
    S.viewKey = key;
    try {
      var svg = document.getElementById("hmSvg");
      if (svg) { svg.innerHTML = v.svg; svg.setAttribute("aria-label", v.aria || ""); }
      var bay = document.querySelector("#harborBoard .hb-top .wire-slot:nth-of-type(2)"); bay && (bay.textContent = v.title || pack.title || "");
      var fit = document.querySelector("#hmWrap .hm-zc button[data-z=fit]"); if (fit && !fit.disabled) fit.click();
    } catch (e) {}
    paintViews(pack, v);
    try { typeof window.harborHighlight === "function" && window.harborHighlight(); } catch (e) {}
  }

  /* ------------------------------------------------------------------ the chip ------------------------------------------------------------------- */
  var CSS = ".hm-pick{margin-left:4px;background:var(--plate-2);border:1px solid var(--line);color:var(--copper-hi);border-radius:8px;padding:5px 9px;font:700 11px/1 Barlow Condensed,sans-serif;letter-spacing:.12em;cursor:pointer;white-space:nowrap;flex:none;text-transform:uppercase}" +
    ".hm-pick.away{border-color:var(--hm-lb-hi,#ff4dd2);color:var(--hm-lb-hi,#ff4dd2)}" +
    ".hm-pickm{position:absolute;z-index:30;left:12px;top:44px;background:var(--plate-2);border:1px solid var(--line);border-radius:10px;padding:6px;min-width:230px;box-shadow:0 10px 30px rgba(0,0,0,.45)}" +
    ".hm-pickm button{display:flex;width:100%;align-items:center;gap:8px;background:none;border:0;color:var(--bone);text-align:left;padding:8px 10px;border-radius:8px;font:600 13px/1.2 Inter,system-ui,sans-serif;cursor:pointer}" +
    ".hm-pickm button:hover,.hm-pickm button:focus{background:rgba(255,255,255,.06);outline:none}" +
    ".hm-pickm button.on{color:var(--copper-hi)}.hm-pickm small{margin-left:auto;font:600 10px/1 Barlow Condensed,sans-serif;letter-spacing:.1em;color:var(--steel);text-transform:uppercase}" +
    ".hm-pickm .st-live{color:#58d68d}.hm-pickm .st-pilot{color:#f5b041}" +
    ".bp-port{display:inline-flex;align-items:center;gap:4px;align-self:flex-start;margin-top:2px;padding:2px 7px;border-radius:999px;font:700 9.5px/1.2 Barlow Condensed,sans-serif;letter-spacing:.12em;text-transform:uppercase;font-style:normal;background:var(--hm-la,rgba(77,226,255,.17));border:1px solid var(--hm-la-line,rgba(77,226,255,.5));color:var(--hm-la-hi,#4de2ff)}" +
    ".bp-port.p-sf{background:var(--hm-lb,rgba(255,77,210,.15));border-color:var(--hm-lb-line,rgba(255,77,210,.5));color:var(--hm-lb-hi,#ff4dd2)}" +
    ".bp-port.p-sd{background:rgba(255,196,61,.15);border-color:rgba(255,196,61,.55);color:#ffc43d}" +
    ".bp-port.shift{letter-spacing:.08em;white-space:normal;line-height:1.35}" +
    ".hm-views{display:flex;gap:6px;margin:0 12px 8px}.hm-views button{flex:1;background:var(--plate-2);border:1px solid var(--line);color:var(--steel);border-radius:8px;padding:6px 8px;font:700 11px/1 Barlow Condensed,sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}.hm-views button.on{color:var(--copper-hi);border-color:var(--copper-hi)}" +
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
    paintStoryPorts();
    patchScanFlow();
    loadScanOpen();
    guardLalbOnly();
    patchScanner(S.home);
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
