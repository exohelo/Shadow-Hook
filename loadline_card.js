/* loadline_card.js — #loadline(nov26). Puts the Load Line card in the Games row (after Board Games, else after Corral Run)
   and opens load-line.html in the game sheet. Loaded by ports_ext.js. */
(function () {
  "use strict";
  if (window.__llCard) return; window.__llCard = 1;
  var URL = "/load-line.html";
  var st = document.createElement("style");
  st.textContent =
    "html .hcard.gm-ll{position:relative;background:linear-gradient(180deg,#0b0a1400 45%,#0b0a14dd 100%),url(\"data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%20160%20200%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22a%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20offset%3D%220%22%20stop-color%3D%22%230d1f3a%22/%3E%3Cstop%20offset%3D%22.62%22%20stop-color%3D%22%233b2f55%22/%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%230b2551%22/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width%3D%22160%22%20height%3D%22200%22%20fill%3D%22url%28%23a%29%22/%3E%3Cg%20stroke%3D%22%23f5c518%22%20fill%3D%22none%22%3E%3Cpath%20d%3D%22M18%2040v86M44%2040v86%22%20stroke-width%3D%224%22/%3E%3Cpath%20d%3D%22M18%2060l26%2022M44%2060L18%2082%22%20stroke-width%3D%221.5%22%20stroke%3D%22%23a8860c%22/%3E%3Cpath%20d%3D%22M0%2040h160%22%20stroke-width%3D%225%22/%3E%3Cpath%20d%3D%22M20%2038l24-24%204%2024%22%20stroke-width%3D%222%22/%3E%3C/g%3E%3Cpath%20d%3D%22M76%2042v28M88%2042v28%22%20stroke%3D%22%23cbd5e1%22%20stroke-width%3D%221%22/%3E%3Crect%20x%3D%2272%22%20y%3D%2270%22%20width%3D%2220%22%20height%3D%223%22%20fill%3D%22%23f5c518%22/%3E%3Crect%20x%3D%2272%22%20y%3D%2273%22%20width%3D%2220%22%20height%3D%2212%22%20fill%3D%22%23d4573b%22/%3E%3Crect%20y%3D%22138%22%20width%3D%22160%22%20height%3D%2262%22%20fill%3D%22%230b2551%22/%3E%3Cpath%20d%3D%22M30%20120h120l-10%2022H40z%22%20fill%3D%22%231c2b41%22/%3E%3Cpath%20d%3D%22M36%20134h108l-4%208H40z%22%20fill%3D%22%238f2323%22/%3E%3Cg%3E%3Crect%20x%3D%2244%22%20y%3D%22108%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%234a7fc1%22/%3E%3Crect%20x%3D%2263%22%20y%3D%22108%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%233f9a66%22/%3E%3Crect%20x%3D%2282%22%20y%3D%22108%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%23d4573b%22/%3E%3Crect%20x%3D%22101%22%20y%3D%22108%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%233f9a66%22/%3E%3Crect%20x%3D%22120%22%20y%3D%22108%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%234a7fc1%22/%3E%3Crect%20x%3D%2263%22%20y%3D%2296%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%23d4573b%22/%3E%3Crect%20x%3D%2282%22%20y%3D%2296%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%234a7fc1%22/%3E%3Crect%20x%3D%22101%22%20y%3D%2296%22%20width%3D%2218%22%20height%3D%2212%22%20fill%3D%22%233f9a66%22/%3E%3C/g%3E%3Cpath%20d%3D%22M0%20140q20-4%2040%200t40%200%2040%200%2040%200%22%20stroke%3D%22%2393c5fd%22%20stroke-opacity%3D%22.6%22%20fill%3D%22none%22/%3E%3C/svg%3E\") center/cover no-repeat!important;border:2px solid #fbbf24!important}" +
    "html .hcard.gm-ll .hc-kind,html .hcard.gm-ll .hc-ico,html .hcard.gm-ll .hc-name,html .hcard.gm-ll .hc-stat{text-shadow:0 2px 4px #000,0 0 10px #000c}" +
    "html .hcard.gm-ll .hc-ico{font-family:Anton,Impact,sans-serif;color:#fde047!important;-webkit-text-fill-color:#fde047!important;background:none!important;filter:none!important;letter-spacing:1px}" +
    "html .hcard.gm-ll .hc-name{font-family:Anton,Impact,sans-serif;color:#fff!important;-webkit-text-fill-color:#fff!important;letter-spacing:1px}" +
    "html .hcard.gm-ll .hc-stat{color:#fde68a!important}" +
    "html .hcard.gm-ll .ll-new{position:absolute;top:-7px;right:-7px;padding:2px 6px;border-radius:8px;background:#ef4444;color:#fff;font:800 10px/14px Inter,system-ui,sans-serif;letter-spacing:.06em;box-shadow:0 0 0 2px #0b0a14}" +
    "html.ios-store .gm-ll{display:none!important}";
  (document.head || document.documentElement).appendChild(st);

  var NEW_UNTIL = Date.UTC(2026, 11, 10);
  function html() {
    return '<div class="hc-kind gm-c0"><span>1P</span><span>SPEED RUN</span></div><div class="hc-ico gm-c1">LOAD</div><div class="hc-name gm-c2">LINE</div>' +
      '<div class="hc-stat gm-c3">DON’T GET FIRED</div>' + (Date.now() < NEW_UNTIL ? '<span class="ll-new">NEW</span>' : "");
  }
  function paint() {
    var corrals = document.querySelectorAll('[data-hgame="corral"]');
    for (var i = 0; i < corrals.length; i++) {
      var c = corrals[i], row = c.parentNode;
      if (!row || row.querySelector('[data-hgame="loadline"]')) continue;
      var after = c.nextElementSibling && c.nextElementSibling.getAttribute("data-hgame") === "boards" ? c.nextElementSibling : c;
      var el = document.createElement("div");
      el.className = "hcard hk-game gm-ll";
      el.setAttribute("data-hgame", "loadline"); el.setAttribute("data-nofloor", ""); el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
      el.innerHTML = html();
      row.insertBefore(el, after.nextSibling);
    }
  }
  function open() { if (window.shkOpenGame) window.shkOpenGame(URL); else location.href = URL; }
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-hgame="loadline"]');
    if (!t) return; e.preventDefault(); e.stopPropagation(); open();
  }, true);
  var n = 0, wt = setInterval(function () {
    if (typeof window.gameOpen === "function" && !window.gameOpen.__ll) {
      var orig = window.gameOpen;
      window.gameOpen = function (k) { if (k === "loadline") { open(); return; } return orig.apply(this, arguments); };
      window.gameOpen.__ll = 1;
    }
    if (++n > 40) clearInterval(wt);
  }, 500);
  var mo = new MutationObserver(function () { if (document.querySelector('[data-hgame="corral"]')) paint(); });
  function start() { paint(); mo.observe(document.body, { childList: true, subtree: true }); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
