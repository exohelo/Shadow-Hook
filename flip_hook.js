/* #flip(nov24) — adds THE FLIP card to the game cards (after Board Games, or after Corral Run) and sends taps to /flip.html.
   Loaded by ports_ext.js. The card shows how many open flips you're in (flip_lobby), refreshed every 2 minutes. */
(function () {
  if (window.__flipHook) return; window.__flipHook = 1;
  var open = 0;
  var css = document.createElement("style");
  css.textContent =
    ".hcard.gm-flip{background:linear-gradient(135deg,#3a2a05 0,#1b1438 55%,#2b1d52 100%);border:2px solid #fbbf24;box-shadow:0 0 8px #fbbf24,0 0 18px #fbbf2455,inset 0 0 14px #fbbf2433;position:relative}" +
    ".hcard.gm-flip .hc-ico{font-family:Anton,Impact,sans-serif;color:#fde68a;letter-spacing:1px}" +
    ".hcard.gm-flip .hc-name{font-family:Anton,Impact,sans-serif;color:#fff;letter-spacing:1px}" +
    ".hcard.gm-flip .hc-stat{color:#fcd34d}" +
    ".hcard.gm-flip .fl-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#ef4444;color:#fff;font:700 12px/20px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #0b0a14}";
  (document.head || document.documentElement).appendChild(css);

  function cardHTML() {
    return '<div class="hc-kind gm-c0"><span>2–12</span><span>FAIR</span></div><div class="hc-ico gm-c1">🪙 THE</div><div class="hc-name gm-c2">FLIP</div>' +
      '<div class="hc-stat gm-c3">' + (open ? open + " OPEN" : "WHO GOES FIRST") + '</div>' + (open ? '<span class="fl-badge">' + open + "</span>" : "");
  }
  function paint() {
    var corrals = document.querySelectorAll('[data-hgame="corral"]');
    for (var i = 0; i < corrals.length; i++) {
      var c = corrals[i], par = c.parentNode;
      var have = par.querySelector('[data-hgame="flip"]');
      if (have) { refresh(have); continue; }
      var after = c.nextElementSibling && c.nextElementSibling.getAttribute("data-hgame") === "boards" ? c.nextElementSibling : c;
      var el = document.createElement("div");
      el.className = "hcard hk-game gm-flip" + (open ? " is-hot" : "");
      el.setAttribute("data-hgame", "flip"); el.setAttribute("data-nofloor", ""); el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
      el.innerHTML = el.__h = cardHTML();
      par.insertBefore(el, after.nextSibling);
    }
  }
  function refresh(el) {
    var h = cardHTML();
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; el.classList.toggle("is-hot", !!open); }
  }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-hgame="flip"]');
    if (!t) return; e.preventDefault(); e.stopPropagation(); (window.shkOpenGame ? window.shkOpenGame("/flip.html") : (location.href = "/flip.html"));
  }, true);
  var wrapN = 0, wrapT = setInterval(function () {
    if (typeof window.gameOpen === "function" && !window.gameOpen.__flip) {
      var orig = window.gameOpen;
      window.gameOpen = function (k) { if (k === "flip") { (window.shkOpenGame ? window.shkOpenGame("/flip.html") : (location.href = "/flip.html")); return; } return orig.apply(this, arguments); };
      window.gameOpen.__flip = 1;
    }
    if (++wrapN > 40) clearInterval(wrapT);
  }, 500);

  function count() {
    try {
      var sb = window.SB; if (!sb || !sb.rpc) return;
      sb.auth.getSession().then(function (r) {
        if (!r || !r.data || !r.data.session) return;
        return sb.rpc("flip_lobby").then(function (x) {
          if (!x || x.error || !x.data) return;
          var n = 0; (x.data.flips || []).forEach(function (f) { if (f.status === "open") n++; });
          if (n !== open) { open = n; paint(); }
        });
      }).catch(function () {});
    } catch (e) {}
  }
  var pt = 0, mo = new MutationObserver(function () { if (pt) return; pt = setTimeout(function () { pt = 0; if (document.querySelector('[data-hgame="corral"]')) paint(); }, 250); });
  function start() {
    paint(); mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(count, 3000); setInterval(function () { if (!document.hidden) count(); }, 120000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) count(); });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
