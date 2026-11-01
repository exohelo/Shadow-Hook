/* The Shadow Hook · ids_board.js (nov1c) — the board for a hall that calls casuals by number, not by letter (Local 10).
   Reads public.ids_board (from the hall_tape rows the bot writes off the pre-tape): where IDs start each shift, how far
   the last ones went, tonight's and tomorrow's jobs (skill / non-skill), the ships by berth, every skilled board's line.
   Shows on the Wire tab for members whose hall is a numbered board, and on the Ports tab when anyone explores that hall.
   For those members it also stands the letter Wire down, so nothing letter-shaped shows for a hall that has no letters. */
(function () {
  "use strict";
  if (window.SHK_IDS) return;
  var S = { rows: {}, at: {} };
  function home() { try { return (window.SHK_PORTS && SHK_PORTS.home) || "lalb"; } catch (e) { return "lalb"; } }
  function view() { try { return (window.SHK_PORTS && SHK_PORTS.view) || home(); } catch (e) { return home(); } }
  function kindOf(code) { return code === "sf" ? "ids" : "letters"; }      /* mirrors ports.board_kind; sf is the first */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n(v) { return v == null ? "—" : Number(v).toLocaleString(); }
  var DOWF = { Sun: "Sunday", Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday" };
  function title(k) { var m = /^(\d{4})-(\d{2})-(\d{2})_(\w{3})_(AM|PM)$/.exec(k || ""); return m ? (DOWF[m[4]] || m[4]) + " " + (m[5] === "AM" ? "dayside" : "nightside") + " · " + (+m[2]) + "/" + (+m[3]) : k; }
  function ago(ts) { var s = (Date.now() - new Date(ts).getTime()) / 1e3; return s < 3600 ? Math.max(1, Math.round(s / 60)) + "m ago" : s < 86400 ? Math.round(s / 3600) + "h ago" : Math.round(s / 86400) + "d ago"; }
  var BOARD_ORDER = ["hold", "dock", "crane", "winch", "lift", "top pick", "prep", "night bees", "day bees"];

  var CSS = ".idb{margin:12px 0}.idb .idb-h{display:flex;align-items:center;gap:8px;padding:12px 14px 4px;font:700 15px/1 Barlow Condensed,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--bone)}" +
    ".idb .idb-h small{margin-left:auto;font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:0;text-transform:none;color:var(--steel)}" +
    ".idb .idb-b{padding:4px 14px 14px;font:13px/1.45 Inter,system-ui,sans-serif;color:var(--bone)}" +
    ".idb .idb-big{display:flex;align-items:baseline;gap:10px;margin:6px 0 2px}.idb .idb-big b{font:800 44px/1 Barlow Condensed,sans-serif;color:var(--copper-hi);letter-spacing:.02em}.idb .idb-big span{color:var(--steel);font-size:12px;letter-spacing:.14em;text-transform:uppercase}" +
    ".idb .idb-sub{color:var(--steel);font-size:12px;margin-bottom:10px}" +
    ".idb .idb-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:8px 0}.idb .idb-tiles div{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:10px;padding:8px}.idb .idb-tiles b{display:block;font:700 20px/1.1 Barlow Condensed,sans-serif;color:var(--bone)}.idb .idb-tiles span{font-size:11px;color:var(--steel);letter-spacing:.08em;text-transform:uppercase}" +
    ".idb .idb-lbl{margin:10px 0 4px;font:700 11px/1 Inter,system-ui,sans-serif;letter-spacing:.16em;color:var(--steel);text-transform:uppercase}" +
    ".idb .idb-ships{display:flex;flex-wrap:wrap;gap:6px}.idb .idb-ships span{padding:4px 9px;border-radius:999px;border:1px solid var(--line);font-size:12px}.idb .idb-ships span i{font-style:normal;color:var(--steel)}" +
    ".idb table{width:100%;border-collapse:collapse;font-size:12.5px}.idb td{padding:5px 0;border-bottom:1px solid var(--line)}.idb td:last-child{text-align:right;color:var(--copper-hi);font-variant-numeric:tabular-nums}" +
    ".idb .idb-hist div{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--line);font-size:12.5px}.idb .idb-hist b{color:var(--copper-hi)}" +
    "html.shk-ids-hall #scr-board > :not(.idb):not(.screen-title){display:none!important}" +
    "html.shk-ids-hall #dpPost{display:none!important}";
  function css() { if (document.getElementById("idbCss")) return; var st = document.createElement("style"); st.id = "idbCss"; st.textContent = CSS; document.head.appendChild(st); }

  async function load(port) {
    if (!window.SB) return [];
    if (S.at[port] && Date.now() - S.at[port] < 60000) return S.rows[port] || [];
    try {
      var r = await window.SB.from("ids_board").select("k,start_ids,next_ids,moved,jobs,skill,nonskill,ships,starts,said_at").eq("port", port).order("k", { ascending: false }).limit(14);
      if (r && !r.error) { S.rows[port] = r.data || []; S.at[port] = Date.now(); }
    } catch (e) {}
    return S.rows[port] || [];
  }
  function card(port, rows) {
    var P = (window.PORT_META_NAMES || {})[port] || (port === "sf" ? "SF / Oakland · ILWU Local 10" : port);
    if (!rows.length) return '<div class="card idb" data-port="' + port + '"><div class="idb-h">📼 The IDs board<small>' + esc(P) + '</small></div><div class="idb-b"><div class="idb-sub">Nothing off the tape yet. The bot reads the hall’s pre-tape and posts each shift here.</div></div></div>';
    var now = new Date(), cur = rows.filter(function (r) { return r.start_ids != null; })[0] || rows[0], next = rows[0];
    var up = rows.filter(function (r) { return r.jobs != null; })[0] || next;
    var starts = up.starts && Object.keys(up.starts).length ? up : rows.filter(function (r) { return r.starts && Object.keys(r.starts).length; })[0];
    var hist = rows.filter(function (r) { return r.moved != null; }).slice(0, 6);
    var h = '<div class="card idb" data-port="' + port + '"><div class="idb-h">📼 The IDs board<small>' + esc(P) + (cur && cur.said_at ? " · off the tape " + ago(cur.said_at) : "") + "</small></div><div class=\"idb-b\">";
    if (cur && cur.start_ids != null) h += '<div class="idb-big"><b>' + n(cur.start_ids) + "</b><span>IDs start · " + esc(title(cur.k)) + "</span></div>" +
      (cur.moved != null ? '<div class="idb-sub">went ' + n(cur.moved) + " numbers, next started at " + n(cur.next_ids) + "</div>" : '<div class="idb-sub">where the IDs are when this shift starts, straight off the hall’s pre-tape</div>');
    if (up && up.jobs != null) h += '<div class="idb-lbl">' + esc(title(up.k)) + '</div><div class="idb-tiles"><div><b>' + n(up.jobs) + "</b><span>possible jobs</span></div><div><b>" + n(up.skill) + "</b><span>skill</span></div><div><b>" + n(up.nonskill) + "</b><span>non-skill</span></div></div>";
    if (up && up.ships && up.ships.length) h += '<div class="idb-lbl">Ships possibly working</div><div class="idb-ships">' + up.ships.map(function (s) { return "<span>Berth " + esc(s.berth) + " <i>· " + n(s.cranes) + " crane" + (s.cranes === 1 ? "" : "s") + (s.status ? " · to " + esc(s.status) : "") + "</i></span>"; }).join("") + "</div>";
    if (starts) {
      var ks = Object.keys(starts.starts).sort(function (a, b) { var x = BOARD_ORDER.indexOf(a), y = BOARD_ORDER.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
      h += '<div class="idb-lbl">Skilled boards · ' + esc(title(starts.k)) + "</div><table>" + ks.map(function (k) { var v = starts.starts[k]; return "<tr><td>" + esc(k.replace(/\b\w/g, function (c) { return c.toUpperCase(); })) + " · line " + n(v.line) + "</td><td>" + esc(v.reg) + "</td></tr>"; }).join("") + "</table>";
    }
    if (hist.length) h += '<div class="idb-lbl">How far the IDs went</div><div class="idb-hist">' + hist.map(function (r) { return "<div><span>" + esc(title(r.k)) + "</span><span>" + n(r.start_ids) + " → " + n(r.next_ids) + " · <b>" + n(r.moved) + "</b></span></div>"; }).join("") + "</div>";
    return h + "</div></div>";
  }
  async function paint() {
    css();
    var hm = home(), vw = view();
    document.documentElement.classList.toggle("shk-ids-hall", kindOf(hm) === "ids");
    try { var so = document.querySelector("#socialFeed .idb-social"); so && kindOf(hm) === "ids" && (so.outerHTML = card(hm, await load(hm)).replace('class="card idb"', 'class="card idb idb-social"')); } catch (e) {}
    /* Wire tab: the member's own hall, if it is a numbered board */
    var wire = document.getElementById("scr-board");
    if (wire) {
      var w = wire.querySelector(".idb");
      if (kindOf(hm) === "ids") { var rows = await load(hm), html = card(hm, rows); if (!w) { var t = wire.querySelector(".screen-title"); (t || wire.firstChild) ? (t ? t.insertAdjacentHTML("afterend", html) : wire.insertAdjacentHTML("afterbegin", html)) : wire.insertAdjacentHTML("afterbegin", html); } else w.outerHTML = html; }
      else if (w) w.remove();
    }
    /* Ports tab: whichever numbered hall is being looked at */
    var ports = document.getElementById("scr-ports"), sky = document.getElementById("harborSky");
    if (ports && sky) {
      var p = ports.querySelector(".idb");
      if (kindOf(vw) === "ids") { var r2 = await load(vw), h2 = card(vw, r2); if (p) p.outerHTML = h2; else sky.insertAdjacentHTML("afterend", h2); }
      else if (p) p.remove();
    }
  }
  /* Social tab: in a numbered hall the letter Dispatch Post is hidden, so the IDs board takes its spot at the top of the
     feed — the same local dispatch card, above the Board everyone shares. The feed redraws itself, so re-seat it. */
  var socBusy = false;
  async function paintSocial() {
    var hm = home(), post = document.getElementById("dpPost");
    var mine = document.querySelector("#socialFeed .idb-social");
    if (kindOf(hm) !== "ids") { mine && mine.remove(); return; }
    if (!post || socBusy) return;
    if (mine && mine.nextElementSibling === post) return;
    socBusy = true;
    try {
      var html = card(hm, await load(hm)).replace('class="card idb"', 'class="card idb idb-social"');
      mine && mine.remove();
      post.insertAdjacentHTML("beforebegin", html);
    } finally { socBusy = false; }
  }
  function watchSocial() {
    var f = document.getElementById("socialFeed"); if (!f || f._idbWatch) return; f._idbWatch = true;
    var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(paintSocial, 200); }).observe(f, { childList: true });
    paintSocial();
  }
  function live() {
    try { window.SB.channel("hall_tape:ids").on("postgres_changes", { event: "*", schema: "public", table: "hall_tape" }, function () { S.at = {}; paint(); }).subscribe(); } catch (e) {}
  }
  function boot() {
    var n = 0, t = setInterval(function () {
      if (window.SB && document.getElementById("scr-board")) { clearInterval(t); paint(); live(); watchSocial(); setInterval(watchSocial, 5000); document.addEventListener("shk:port-view", paint); document.addEventListener("shk:home-port", paint); setInterval(paint, 60000); }
      else if (++n > 120) clearInterval(t);
    }, 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.SHK_IDS = { paint: paint };
})();
