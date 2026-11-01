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
      if (svg) { svg.innerHTML = pack.svg; svg.setAttribute("aria-label", pack.aria || ""); }
      /* the map keeps its own zoom state (translate+scale on the svg); go back to "the whole bay" for the new port */
      try { var fit = document.querySelector("#hmWrap .hm-zc button[data-z=fit]"); if (fit && !fit.disabled) fit.click(); } catch (e) {}
      var foot = document.querySelector("#harborSky .hm-foot");
      if (foot) { var zh = foot.querySelector(".hm-zh"); foot.innerHTML = pack.legendHtml || ""; zh && foot.appendChild(zh); }
      var src = document.getElementById("harborSrc"); src && (src.textContent = pack.src || "");
      var bay = document.querySelector("#harborBoard .hb-top .wire-slot:nth-of-type(2)"); bay && (bay.textContent = pack.title || "");
      var sec = document.getElementById("hbSec"); sec && (sec.textContent = String(pack.terminals.filter(function (t) { return t.security; }).length));
      var tm = document.getElementById("hbTerms"); tm && (tm.textContent = String(pack.terminals.length));
    } catch (e) {}
    repaint();
    paintChip();
    try { bench.parsed = null; bench.sampleId = null; refreshBench(); } catch (e) {}
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
     The Keymaster's bench (Ports tab) replays those, or a pasted slip, and teaches the reader for that hall. */
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

  /* ---- the bench (Keymaster only) ---- */
  var BENCH_CSS = ".sb-card{margin:12px 0}.sb-card .sb-h{display:flex;align-items:center;gap:8px;padding:10px 12px 6px;font:700 15px/1 Barlow Condensed,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--bone)}" +
    ".sb-card .sb-h small{margin-left:auto;font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:0;text-transform:none;color:var(--steel)}" +
    ".sb-body{padding:0 12px 12px;font:13px/1.4 Inter,system-ui,sans-serif;color:var(--bone)}.sb-stat{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--steel);font-size:12px;margin-bottom:8px}.sb-stat b{color:var(--copper-hi)}" +
    ".sb-row{display:flex;gap:8px;margin:6px 0}.sb-row>*{flex:1 1 0;min-width:0}.sb-body textarea,.sb-body input{width:100%;box-sizing:border-box;background:var(--plate-2);border:1px solid var(--line);border-radius:8px;color:var(--bone);padding:8px;font:13px/1.3 Inter,system-ui,sans-serif}.sb-body textarea{min-height:90px}" +
    ".sb-btn{background:var(--plate-2);border:1px solid var(--line);color:var(--copper-hi);border-radius:8px;padding:8px 12px;font:700 12px/1 Barlow Condensed,sans-serif;letter-spacing:.1em;cursor:pointer;text-transform:uppercase}.sb-btn.go{border-color:var(--copper-hi)}.sb-btn.danger{color:#ff6a6a}" +
    ".sb-parse{display:grid;grid-template-columns:auto 1fr 1fr;gap:4px 10px;font-size:12px;margin:8px 0}.sb-parse i{color:var(--steel);font-style:normal}.sb-parse .bad{color:#ff6a6a}.sb-parse .ok{color:#58d68d}" +
    ".sb-list{margin-top:8px;border-top:1px solid var(--line)}.sb-it{padding:7px 0;border-bottom:1px solid var(--line);font-size:12px;display:flex;gap:8px;align-items:flex-start;cursor:pointer}.sb-it .k{color:var(--steel);flex:0 0 58px}.sb-it .ok{color:#58d68d}.sb-it .bad{color:#ff6a6a}.sb-it .no{color:var(--steel)}" +
    ".sb-note{color:var(--steel);font-size:11px;margin-top:6px}";
  var FIELDS = ["terminal", "berth", "ship", "category", "date", "shift"];
  var bench = { text: "", parsed: null, samples: [], status: null, sampleId: null };
  function isKM() { try { return !!window.__isKM || (typeof prvKm === "function" && prvKm()); } catch (e) { return false; } }
  function mountBench() {
    if (!isKM()) return;
    var after = document.getElementById("harborSky"); if (!after || document.getElementById("scanBench")) return;
    var st = document.getElementById("shkBenchCss"); if (!st) { st = document.createElement("style"); st.id = "shkBenchCss"; st.textContent = BENCH_CSS; document.head.appendChild(st); }
    var card = document.createElement("div"); card.className = "card sb-card"; card.id = "scanBench";
    after.insertAdjacentElement("afterend", card);
    card.addEventListener("click", onBenchClick);
    card.addEventListener("change", function (e) { if (e.target && e.target.id === "sbPhoto" && e.target.files && e.target.files[0]) benchOCR(e.target.files[0]); });
    card.addEventListener("input", function (e) { if (e.target && e.target.id === "sbText") bench.text = e.target.value; });
    refreshBench();
  }
  async function refreshBench() {
    var card = document.getElementById("scanBench"); if (!card) return;
    var code = S.view, p = portOf(code);
    try { var r = await window.SB.rpc("scan_port_status", { p_port: code }); bench.status = r && !r.error ? r.data : null; } catch (e) { bench.status = null; }
    try { var q = await window.SB.from("scan_samples").select("id,docket_id,by_handle,parsed,truth,confirmed,created_at,ocr_text").eq("port", code).order("id", { ascending: false }).limit(12); bench.samples = q && !q.error ? q.data || [] : []; } catch (e) { bench.samples = []; }
    var st = bench.status || {}, open = !!st.scan_open;
    var html = '<div class="sb-h">🔬 Scan bench <span style="color:var(--copper-hi)">' + esc(p.short || code) + "</span><small>Keymaster · " + (open ? "reader OPEN" : "reader LEARNING") + "</small></div><div class=\"sb-body\">";
    html += '<div class="sb-stat"><span>samples <b>' + (st.samples || 0) + "</b></span><span>confirmed <b>" + (st.confirmed || 0) + "</b></span><span>reader agreed <b>" + (st.agree || 0) + "</b></span><span>lessons <b>" + (st.lessons || 0) + "</b></span></div>";
    if (code !== "lalb") html += '<div class="sb-row"><button type="button" class="sb-btn ' + (open ? "danger" : "go") + '" data-sb="gate">' + (open ? "Close the reader · back to learning" : "Open the reader for " + esc(p.short || code)) + "</button></div>";
    html += '<div class="sb-note">Paste a slip’s text, or shoot a photo of one, and see what the reader makes of it. Fix the right column and teach it — the lesson is filed under ' + esc(p.short || code) + " only.</div>";
    html += '<textarea id="sbText" placeholder="the slip’s text — one line per line on the slip">' + esc(bench.text) + "</textarea>";
    html += '<div class="sb-row"><button type="button" class="sb-btn go" data-sb="read">Read it</button><label class="sb-btn" style="text-align:center">📷 Photo<input id="sbPhoto" type="file" accept="image/*" capture="environment" style="display:none"></label></div>';
    if (bench.parsed) {
      html += '<div class="sb-parse"><i></i><i>the reader read</i><i>the truth</i>';
      FIELDS.forEach(function (f) { var v = bench.parsed[f === "category" ? "cat" : f]; html += "<i>" + f + '</i><span class="' + (v ? "" : "bad") + '">' + esc(v || "—") + '</span><input data-f="' + f + '" value="' + esc(bench.truth && bench.truth[f] || v || "") + '">'; });
      html += '</div><div class="sb-row"><button type="button" class="sb-btn go" data-sb="teach">Teach the reader</button></div>';
    }
    if (bench.samples.length) {
      html += '<div class="sb-list">';
      bench.samples.forEach(function (x) {
        var pt = x.parsed || {}, tr = x.truth || {}, agree = tr.terminal && String(pt.terminal || "").toUpperCase() === String(tr.terminal).toUpperCase() && String(pt.berth || "") === String(tr.berth || "");
        html += '<div class="sb-it" data-sid="' + x.id + '"><span class="k">' + esc(x.by_handle || "—") + "</span><span>read <b>" + esc(pt.terminal || "?") + " " + esc(pt.berth || "") + "</b>" +
          (x.confirmed ? ' → said <b>' + esc(tr.terminal || "?") + " " + esc(tr.berth || "") + '</b> <span class="' + (agree ? "ok" : "bad") + '">' + (agree ? "✓ agreed" : "✗ differs") + "</span>" : ' <span class="no">· unconfirmed</span>') + "</span></div>";
      });
      html += "</div>";
    }
    html += "</div>";
    card.innerHTML = html;
  }
  function benchRead() {
    var t = (document.getElementById("sbText") || {}).value || bench.text; bench.text = t;
    try { bench.parsed = typeof parseDocket === "function" ? parseDocket(t, null) : null; } catch (e) { bench.parsed = null; }
    bench.truth = null; refreshBench();
  }
  async function benchOCR(file) {
    try {
      var card = document.getElementById("scanBench"); var ta = document.getElementById("sbText"); if (ta) ta.value = "reading the photo…";
      if (typeof getOCR !== "function") { if (ta) ta.value = "the reader is not loaded on this phone"; return; }
      var worker = await getOCR(); var img = new Image(); var url = URL.createObjectURL(file);
      await new Promise(function (res, rej) { img.onload = res; img.onerror = rej; img.src = url; });
      var r = await worker.recognize(img); bench.text = (r && r.data && r.data.text) || "";
      benchRead();
    } catch (e) { var ta2 = document.getElementById("sbText"); if (ta2) ta2.value = "couldn’t read the photo: " + e; }
  }
  async function benchTeach() {
    var card = document.getElementById("scanBench"); if (!card) return;
    var truth = {}; card.querySelectorAll(".sb-parse input[data-f]").forEach(function (i) { truth[i.getAttribute("data-f")] = i.value.trim() || null; });
    bench.truth = truth;
    S.teachPort = S.view;
    try { if (typeof scanLearn === "function") scanLearn(bench.text, bench.parsed, Object.assign({}, truth)); } catch (e) {}
    try { if (bench.sampleId) await window.SB.from("scan_samples").update({ truth: truth, confirmed: true }).eq("id", bench.sampleId); else await sampleInsert({ docket_id: null, ocr_text: bench.text.slice(0, 4000), parsed: bench.parsed, truth: truth, confirmed: true, note: "bench" }); } catch (e) {}
    S.teachPort = null;
    try { typeof toast === "function" && toast("✎ Taught the " + (portOf(S.view).short || S.view) + " reader"); } catch (e) {}
    bench.sampleId = null; refreshBench();
  }
  async function benchGate() {
    var code = S.view, open = !!(bench.status && bench.status.scan_open);
    try { var r = await window.SB.from("ports").update({ scan_open: !open }).eq("code", code); if (r && r.error) throw r.error; S.scanOpen[code] = !open; } catch (e) { try { typeof toast === "function" && toast("the wire refused it: " + (e && e.message || e)); } catch (x) {} }
    refreshBench();
  }
  function onBenchClick(e) {
    var b = e.target.closest("[data-sb]"); if (b) { var k = b.getAttribute("data-sb"); if (k === "read") benchRead(); else if (k === "teach") benchTeach(); else if (k === "gate") benchGate(); return; }
    var it = e.target.closest(".sb-it[data-sid]"); if (it) { var x = bench.samples.find(function (y) { return String(y.id) === it.getAttribute("data-sid"); }); if (x) { bench.text = x.ocr_text || ""; bench.parsed = x.parsed || null; bench.truth = x.truth || null; bench.sampleId = x.id; refreshBench(); } }
  }

  /* ------------------------------------------------------------------ the Board: hall under the name ---------------------------------------------- */
  var PORT_LABEL = { lalb: "Los Angeles · Long Beach", sf: "San Francisco · Oakland", sd: "San Diego" };
  function portLabel(code) { var p = portOf(code); return PORT_LABEL[code] || (p && p.name) || String(code || "").toUpperCase(); }
  function paintStoryPorts() {
    var cards = document.querySelectorAll(".bpost[data-sid]");
    if (!cards.length) return;
    injectCss();
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], who = c.querySelector(".bp-who"); if (!who) continue;
      var sid = c.getAttribute("data-sid"), code = STORY_PORT[sid];
      if (code === undefined) code = /^srv|^loc|^tmp/.test(sid) || c.classList.contains("mine") ? S.home : null;
      if (!code) continue;
      var el = who.querySelector(".bp-port");
      if (!el) { el = document.createElement("i"); el.className = "bp-port"; who.appendChild(el); }
      if (el.getAttribute("data-port") !== code) {
        el.setAttribute("data-port", code);
        el.className = "bp-port p-" + code + (code === S.home ? " home" : "");
        el.textContent = "⚓ " + portLabel(code);
        el.title = (portOf(code).local || "") + " · " + (portOf(code).name || code);
      }
    }
  }
  try {
    var _spT = 0;
    new MutationObserver(function () { if (_spT) return; _spT = setTimeout(function () { _spT = 0; paintStoryPorts(); }, 120); })
      .observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

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
    var bn = 0, bt = setInterval(function () { mountBench(); if (document.getElementById("scanBench") || ++bn > 40) clearInterval(bt); }, 1500);
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
