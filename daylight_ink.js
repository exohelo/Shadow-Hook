/* daylight_ink.js — #dayink(nov27). Yellow is hard to read on the white daytime look, so in daylight every yellow that
   carries text, a dot or a thin border turns deep amber. Nights keep their gold.
   (yellow here means yellow through light orange)
   1) the color settings that come out yellow (the Christmas skin's --neon3 / --dp-live, the council's --sc-gold set)
   2) a light pass over the page for yellow written straight into a style: yellow text, or a yellow border, sitting on a
      light background gets the amber instead. Yellow buttons with dark text are left alone (they read fine).
   Undone the moment the app goes back to its night look. Loaded by ports_ext.js. */
(function () {
  "use strict";
  if (window.__dayInk) return; window.__dayInk = 1;
  var H = document.documentElement, INK = "#8a5a00", INK_LO = "rgba(138,90,0,.35)";
  var st = document.createElement("style"); st.id = "dayInkCSS";
  st.textContent =
    "html.daylight{--neon3:" + INK + "!important;--dp-live:" + INK + "!important;--sc-gold:#8a6510!important;--sc-gold-hi:#7a5600!important;--sc-gold-lo:" + INK_LO + "!important;--gold:" + INK + "!important;--yellow:" + INK + "!important;--amber:" + INK + "!important}";
  (document.head || H).appendChild(st);

  function rgb(s) { var m = s && s.match(/[\d.]+/g); return m && m.length >= 3 ? m.map(Number) : null; }
  function lum(c) { function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
  function yellow(c) {
    if (!c || (c.length > 3 && c[3] < 0.3)) return false;
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), h = 0;
    if (mx === mn) return false;
    var d = mx - mn; h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    var s = d / mx;
    return h >= 30 && h <= 64 && s > 0.3 && lum(c) > 0.3;
  }
  function bgUnder(e) { // the first solid background behind an element
    for (var n = e; n && n.nodeType === 1; n = n.parentElement) {
      var c = rgb(getComputedStyle(n).backgroundColor);
      if (c && !(c.length > 3 && c[3] < 0.5)) return c;
    }
    return [255, 255, 255];
  }
  function ownText(e) { for (var n = e.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.textContent.trim()) return true; return false; }
  var SKIP = "canvas,svg,img,video,iframe,.screen-title,.xm-script,#xmHarbor,#xmCity,.xm-lights,.xb-box,.xb-enter,.xm-bebas";

  function pass() {
    if (!H.classList.contains("daylight")) return undo();
    var all = document.body ? document.body.getElementsByTagName("*") : [], n = 0;
    for (var i = 0; i < all.length && n < 6000; i++) {
      var e = all[i]; n++;
      if (e.__dyk || !e.getClientRects().length) continue;
      if (e.closest && e.closest(SKIP)) continue;
      var cs = getComputedStyle(e), hit = false;
      var col = rgb(cs.color);
      if (yellow(col) && ownText(e) && lum(bgUnder(e)) > 0.55) { e.style.setProperty("color", INK, "important"); hit = true; }
      var bc = rgb(cs.borderTopColor);
      if (parseFloat(cs.borderTopWidth) > 0 && parseFloat(cs.borderTopWidth) <= 3 && yellow(bc) && lum(bgUnder(e.parentElement || e)) > 0.55) {
        e.style.setProperty("border-color", INK_LO, "important"); hit = true;
      }
      if (hit) { e.__dyk = 1; e.setAttribute("data-dayink", ""); }
    }
  }
  function undo() {
    var el = document.querySelectorAll("[data-dayink]");
    for (var i = 0; i < el.length; i++) { el[i].style.removeProperty("color"); el[i].style.removeProperty("border-color"); el[i].removeAttribute("data-dayink"); el[i].__dyk = 0; }
  }

  var busy = 0;
  function soon() { if (busy) return; busy = 1; setTimeout(function () { busy = 0; try { pass(); } catch (e) {} }, 700); }
  function start() {
    soon();
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var r = recs[i];
        if (r.type === "attributes" && r.target === H) { if (!H.classList.contains("daylight")) undo(); soon(); return; }
        if (r.type === "childList" && r.addedNodes.length) { soon(); return; }
      }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    setInterval(soon, 15000);
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
