/* The Shadow Hook — harbor_alerts.js (nov21) — #alertstrip
   The Keymaster: Live Alerts used to sit at the bottom of Mayday, where nobody saw them until they went looking.
   Now a slim strip rides under the NEXT DISPATCH clock on EVERY screen — but only while something is actually
   active. A quiet harbor shows nothing. Tap the strip to open the full list; tap again to fold it.
     · Sources: National Weather Service (active alerts for the member's home harbor) + USGS (quakes, last 24h,
       within 120 km, M3.0 and up). Expired NWS alerts are dropped.
     · Colour: red for warnings / Severe / Extreme / quakes M4.5+, gold for watches and advisories.
     · Refreshes on open, every 15 minutes, when the app comes back to the front, and when the home port changes.
     · Mayday's old "Live Alerts" card is hidden (its code is untouched, so nothing else breaks).
   Loaded by ports_ext.js, so index.html did not have to change. */
(function () {
  "use strict";
  if (window.__shkAlertStrip) return;
  window.__shkAlertStrip = true;

  var HARBOR = {                       // [lat, lon, label]
    lalb: [33.754, -118.216, "harbor"],
    sf:   [37.802, -122.312, "bay"],
    sd:   [32.7157, -117.1611, "harbor"]
  };
  var EVERY = 15 * 60 * 1000, lastAt = 0, open = false, items = [], busy = false, lastHome = "";

  function home() { try { return (window.SHK_PORTS && window.SHK_PORTS.home) || "lalb"; } catch (e) { return "lalb"; } }
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function dist(a, b, c, d) {
    var r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
    var h = x * x + Math.cos(a * r) * Math.cos(c * r) * y * y;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function until(iso) {
    if (!iso) return "";
    var d = new Date(iso); if (isNaN(d)) return "";
    var day = d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
    var t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).replace(":00", "");
    return "until " + day + ", " + t;
  }
  function clock(ms) { return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }

  /* ---------------------------------------------------------------- styles */
  function css() {
    if (document.getElementById("haStripCSS")) return;
    var st = document.createElement("style"); st.id = "haStripCSS";
    st.textContent =
      "#haStrip{max-width:460px;margin:0 auto;padding:0 10px 8px;box-sizing:border-box}" +
      "#haStrip[hidden]{display:none!important}" +
      "#haStrip .ha-bar{width:100%;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:11px;border:1px solid #8a6a22;background:#2b2210;color:#f6dc9a;font:inherit;text-align:left;cursor:pointer}" +
      "#haStrip.red .ha-bar{border-color:#a8382a;background:#2e1310;color:#ffc2b5}" +
      "#haStrip .ha-ic{font-size:17px;line-height:1;flex:none}" +
      "#haStrip .ha-tx{flex:1;min-width:0}" +
      "#haStrip .ha-t{display:block;font-size:13.5px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#haStrip .ha-s{display:block;font-size:12px;opacity:.82;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#haStrip .ha-cv{flex:none;font-size:12px;opacity:.8;transition:transform .2s}" +
      "#haStrip.open .ha-cv{transform:rotate(180deg)}" +
      "#haStrip .ha-list{display:none;margin-top:8px;max-height:52vh;overflow-y:auto;overscroll-behavior:contain;padding:10px;border-radius:11px;border:1px solid rgba(160,150,220,.25);background:rgba(13,11,26,.96)}" +
      "#haStrip.open .ha-list{display:block}" +
      "#haStrip .ha-row{padding:9px 10px;margin-bottom:7px;background:rgba(255,255,255,.04);border-left:3px solid #8d87b8}" +
      "#haStrip .ha-row.gold{border-left-color:#f2c14e}#haStrip .ha-row.red{border-left-color:#e2553f}" +
      "#haStrip .ha-row b{display:block;font-size:13.5px;color:#ece8ff}" +
      "#haStrip .ha-row span{display:block;font-size:12.5px;color:#aaa4d4;margin-top:2px;line-height:1.45}" +
      "#haStrip .ha-ft{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:#8d87b8;margin-top:4px}" +
      "#haStrip .ha-ft button{background:none;border:1px solid rgba(160,150,220,.35);color:#cfc9f5;border-radius:8px;padding:5px 10px;font:inherit;font-size:11.5px;cursor:pointer}" +
      /* daylight theme (html.daylight): cream and brown to match the day header instead of a dark slab */
      "html.daylight #haStrip .ha-bar{background:#fbf0d2;border-color:#d8b25a;color:#6b4710}" +
      "html.daylight #haStrip.red .ha-bar{background:#fde7e1;border-color:#dc8a74;color:#8a2a17}" +
      "html.daylight #haStrip .ha-list{background:#fffaf0;border-color:rgba(150,110,40,.28);box-shadow:0 6px 18px rgba(90,60,20,.12)}" +
      "html.daylight #haStrip .ha-row{background:rgba(150,110,40,.07)}" +
      "html.daylight #haStrip .ha-row b{color:#3a2810}" +
      "html.daylight #haStrip .ha-row span{color:#76603d}" +
      "html.daylight #haStrip .ha-row:not(.gold):not(.red){border-left-color:#b9a27a}" +
      "html.daylight #haStrip .ha-ft{color:#8a7550}" +
      "html.daylight #haStrip .ha-ft button{border-color:#c9a76a;color:#6b4710}" +
      /* #hamini(nov21): after a few seconds the strip tucks into a small pill under the header's right edge; tap it to open */
      "#haStrip .ha-n{display:none;font-size:12px;font-weight:700}" +
      "#haStrip.mini{position:absolute;right:10px;top:calc(100% + 6px);width:auto;max-width:none;margin:0;padding:0;z-index:41}" +
      "#haStrip.mini .ha-tx,#haStrip.mini .ha-cv,#haStrip.mini .ha-list{display:none!important}" +
      "#haStrip.mini .ha-bar{width:auto;padding:5px 10px;gap:5px;border-radius:999px;box-shadow:0 2px 10px rgba(0,0,0,.45)}" +
      "#haStrip.mini .ha-ic{font-size:14px}#haStrip.mini .ha-n{display:inline}" +
      "#haStrip.ha-in{animation:haIn .25s ease-out}@keyframes haIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}" +
      /* Mayday's old card goes away (the strip replaces it) */
      ".card:has(#alertsList){display:none!important}";
    (document.head || document.documentElement).appendChild(st);
  }
  function hideOldCard() {
    try { var l = document.getElementById("alertsList"); var c = l && l.closest(".card"); if (c) c.style.display = "none"; } catch (e) {}
  }

  /* ---------------------------------------------------------------- the strip */
  function mount() {
    var el = document.getElementById("haStrip");
    if (el) return el;
    var tb = document.querySelector(".topbar");
    if (!tb) return null;
    el = document.createElement("div");
    el.id = "haStrip"; el.hidden = true;
    el.innerHTML =
      '<button type="button" class="ha-bar" aria-expanded="false"><span class="ha-ic" aria-hidden="true">⚠️</span>' +
      '<span class="ha-n"></span><span class="ha-tx"><span class="ha-t"></span><span class="ha-s"></span></span><span class="ha-cv" aria-hidden="true">▾</span></button>' +
      '<div class="ha-list" role="region" aria-label="Harbor alerts"></div>';
    var con = tb.querySelector(".hdr-console");
    if (con && con.parentNode === tb) tb.insertBefore(el, con.nextSibling); else tb.appendChild(el);
    el.querySelector(".ha-bar").addEventListener("click", function () {
      clearTimeout(miniT);
      if (el.classList.contains("mini")) { el.classList.remove("mini"); open = true; }
      else open = !open;
      el.classList.toggle("open", open);
      this.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) goMini();
    });
    el.addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ha-refresh]");
      if (b) { e.stopPropagation(); load(true); }
    });
    return el;
  }

  var miniT = 0;
  function goMini() {
    var el = document.getElementById("haStrip"); if (!el || el.hidden) return;
    open = false; el.classList.remove("open"); el.classList.add("mini");
    el.classList.remove("ha-in"); void el.offsetWidth; el.classList.add("ha-in");
  }
  function paint() {
    var el = mount(); if (!el) return;
    if (!items.length) { el.hidden = true; open = false; el.classList.remove("open"); return; }
    var top = items[0], red = items.some(function (a) { return a.sev === "red"; });
    el.classList.toggle("red", red);
    var lbl = (HARBOR[home()] || HARBOR.lalb)[2];
    el.querySelector(".ha-ic").textContent = top.quake ? "〰️" : (red ? "🚨" : "⚠️");
    el.querySelector(".ha-t").textContent = top.t + " · " + lbl;
    el.querySelector(".ha-s").textContent = (top.short || "") + (items.length > 1 ? " · +" + (items.length - 1) + " more" : "");
    el.querySelector(".ha-list").innerHTML =
      items.map(function (a) { return '<div class="ha-row ' + (a.sev || "") + '"><b>' + esc(a.t) + "</b><span>" + esc(a.d) + "</span></div>"; }).join("") +
      '<div class="ha-ft"><span>National Weather Service + USGS · checked ' + esc(clock(lastAt)) + '</span><button type="button" data-ha-refresh="1">↻ Check again</button></div>';
    el.querySelector(".ha-n").textContent = items.length > 1 ? String(items.length) : "";
    var wasHidden = el.hidden; el.hidden = false;
    // a new set of alerts shows in full for a few seconds, then tucks away; one already seen this visit starts tucked
    var key = home() + "|" + items.map(function (a) { return a.t; }).join("|"), seen = "";
    try { seen = sessionStorage.getItem("ha_seen") || ""; } catch (e) {}
    if (key !== seen) {
      try { sessionStorage.setItem("ha_seen", key); } catch (e) {}
      el.classList.remove("mini"); clearTimeout(miniT);
      miniT = setTimeout(function () { if (!open) goMini(); }, 6000);
    } else if (wasHidden || !open) { if (!el.classList.contains("mini")) goMini(); }
  }

  /* ---------------------------------------------------------------- the feeds */
  async function load(force) {
    if (busy) return;
    if (!force && Date.now() - lastAt < EVERY - 5000) return;
    busy = true;
    lastHome = home();
    var h = HARBOR[lastHome] || HARBOR.lalb, out = [], ok = 0, now = Date.now();
    try {
      var r = await fetch("https://api.weather.gov/alerts/active?point=" + h[0] + "," + h[1], { headers: { Accept: "application/geo+json" } });
      var j = await r.json(); ok++;
      (j.features || []).forEach(function (f) {
        var p = f.properties || {}, end = p.ends || p.expires;
        if (end && new Date(end).getTime() < now) return;
        if (p.status && p.status !== "Actual") return;
        var sev = (p.severity === "Extreme" || p.severity === "Severe" || /warning/i.test(p.event || "")) ? "red" : "gold";
        var u = until(end);
        out.push({ t: p.event || "Weather alert", short: u, d: (u ? u.charAt(0).toUpperCase() + u.slice(1) : "") + (p.senderName ? " · " + p.senderName : ""), sev: sev, rank: sev === "red" ? 0 : 1 });
      });
    } catch (e) {}
    try {
      var r2 = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
      var j2 = await r2.json(); ok++;
      (j2.features || []).forEach(function (f) {
        var c = (f.geometry && f.geometry.coordinates) || [], p = f.properties || {};
        if (!(p.mag >= 3.0) || dist(h[0], h[1], c[1], c[0]) > 120) return;
        var red = p.mag >= 4.5;
        out.push({ t: "M" + p.mag.toFixed(1) + " earthquake", short: clock(p.time), d: (p.place || "") + " · " + clock(p.time), sev: red ? "red" : (p.mag >= 3.5 ? "gold" : ""), rank: red ? 0 : 2, quake: true });
      });
    } catch (e) {}
    busy = false;
    if (!ok) return;                      // no signal: keep whatever we showed last
    lastAt = Date.now();
    out.sort(function (a, b) { return a.rank - b.rank; });
    items = out.slice(0, 8);
    paint();
  }

  function boot() {
    css(); hideOldCard(); mount();
    load(true);
    setInterval(function () { load(false); }, EVERY);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) load(false); });
    document.addEventListener("shk:port", function () { setTimeout(function () { load(true); }, 800); });
    setTimeout(hideOldCard, 3000);
    /* the home port can settle a few seconds after boot (ports_ext reads it from the profile) */
    [4000, 10000, 30000].forEach(function (ms) { setTimeout(function () { if (home() !== lastHome) load(true); }, ms); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
