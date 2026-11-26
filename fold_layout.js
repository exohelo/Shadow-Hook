/* fold_layout.js — #foldlayout(nov26). The app laid out for the iPhone Duo (and anything shaped like it).
     html.fold-wide   open, sideways (~890–951 × 626–669): a two-page spread. The nav is a slim rail, the two
                      columns sit either side of the fold (no 84% zoom), a Midjourney harbor shows in the margins,
                      a brass seam runs down the fold, and long cards scroll inside themselves so each page scrolls
                      on its own.
     html.fold-tall   open, upright (~626–669 × 890–951): the slim rail on the left plus one wide column.
     html.fold-closed the outer screen and half-screen Split View (~440–500 wide, ≤720 tall): tighter spacing so
                      the short screen holds more.
   In every mode: any row that is wider than its box scrolls sideways instead of being cut off or squeezed,
   and pop-up sheets scroll when they are taller than the screen. Loaded by ports_ext.js. */
(function () {
  "use strict";
  if (window.__foldLay) return; window.__foldLay = 1;
  var MJ = "https://cdn.midjourney.com/", PANO = "59946218-f6c4-4bfe-86a6-cf7202f4427d/0_2", MEDAL = "f204ff4b-e2e9-4e5c-9714-be93d6aca0a6/0_1";
  var H = document.documentElement, MODES = ["fold-wide", "fold-tall", "fold-closed"];

  function mode() {
    var w = innerWidth, h = innerHeight;
    if (w >= 840 && w <= 1010 && h >= 560 && h <= 720) return "fold-wide";
    if (w >= 600 && w <= 700 && h >= 820 && h <= 1010) return "fold-tall";
    if (w >= 440 && w <= 500 && h >= 560 && h <= 720) return "fold-closed";
    return "";
  }

  var A = "html.fold-wide ", T = "html.fold-tall ", C = "html.fold-closed ", F = "html.fold-on ";
  /* the slim rail (wide + tall): [selector, rules] */
  var RAIL = [
    [".nav", "position:fixed!important;top:var(--tbH,0px)!important;bottom:0!important;left:0!important;right:auto!important;width:76px!important;border-top:0!important;border-right:1px solid var(--line)!important;background:#0a0812e6!important;clip-path:none!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:none!important;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:none"],
    [".nav::-webkit-scrollbar", "display:none"],
    [".nav:before,.nav:after", "display:none!important"],
    [".nav .nav-in", "max-width:none!important;height:auto!important;min-height:100%;display:grid!important;grid-template-columns:1fr!important;grid-auto-rows:min-content;align-content:start;gap:4px;padding:12px 6px 90px!important"],
    [".nav .nav-in button", "padding:10px 0 8px!important;font-size:9.5px!important;border-radius:13px;width:100%"],
    [".nav button .ico", "font-size:21px!important"],
    [".nav button.on", "background:#eeb46b1f!important"],
    [".nav .fold-medal", "position:fixed;left:14px;bottom:calc(14px + env(safe-area-inset-bottom));width:48px;height:48px;opacity:.85;pointer-events:none;filter:drop-shadow(0 3px 6px #000a);animation:foldSpin 40s linear infinite"],
    ["html.daylight .nav", "background:#faf6eeeb!important"],
    [".sheet", "align-items:center;padding:20px"],
    [".sheet-card", "border-radius:22px;max-height:calc(100dvh - 40px);overflow-y:auto;overscroll-behavior:contain"]
  ];
  function scope(rules, pre) {
    return rules.map(function (r) {
      return r[0].split(",").map(function (s) { s = s.trim(); return s.indexOf("html.") === 0 ? pre.trim() + s.slice(4) : pre + s; }).join(",") + "{" + r[1] + "}";
    }).join("");
  }

  var SCR = "#scr-ledger,#scr-board,#scr-dockets,#scr-mayday,#orderView,#msgView,#portList,#scr-ports";
  function each(pre, list, rest) { return list.split(",").map(function (s) { return pre + s; }).join(",") + rest; }

  var css =
    "@keyframes foldSpin{to{transform:rotate(360deg)}}" +
    scope(RAIL, A) + scope(RAIL, T) +
    /* ---- open, sideways: the two-page spread ---- */
    A + "{zoom:1!important;--rail:76px;--cg:44px;--col:calc(100vw - 2 * var(--rail) - 8px);--cw:calc((var(--col) - 32px - var(--cg)) / 2);--cmin:calc(var(--cw) - 4px)}" +
    A + "#app{padding-left:0!important}" +
    A + ".stage," + A + ".headrow," + A + ".livebar-in," + A + ".hdr-console{max-width:var(--col)!important;margin-left:auto!important;margin-right:auto!important;left:0!important}" +
    each(A, SCR, "{column-count:2!important;column-width:auto!important;column-gap:var(--cg)!important;column-fill:balance}") +
    A + "#scr-ports>#portList{column-count:2!important}" +
    A + "#bankStrip{right:calc(var(--rail) + 47px)!important}" + A + ".dayBtn{right:calc(var(--rail) + 10px)!important}" +
    A + "#rflTag{left:calc(var(--rail) + 12px)!important}" + "html.fold-wide #hwMusicBtn{right:calc(var(--rail) + 14px)!important}" +
    A + "body{background:var(--void) url('" + MJ + PANO + "_640_N.webp') center/cover fixed no-repeat}" +
    A + "body:before{background:radial-gradient(ellipse 46% 120% at 50% 50%,rgba(11,13,15,.94) 60%,rgba(11,13,15,.55))!important}" +
    A + "body:after{content:'';position:fixed;top:0;bottom:0;left:50%;width:2px;margin-left:-1px;z-index:0;pointer-events:none;background:linear-gradient(180deg,transparent,rgba(238,180,107,.35) 18%,rgba(238,180,107,.5) 50%,rgba(238,180,107,.35) 82%,transparent);box-shadow:0 0 14px rgba(238,180,107,.25)}" +
    "html.daylight.fold-wide body:before{background:radial-gradient(ellipse 46% 120% at 50% 50%,rgba(246,242,231,.96) 60%,rgba(246,242,231,.6))!important}" +
    /* a long card scrolls inside itself so each page scrolls on its own */
    A + ".fold-y{max-height:calc(100dvh - var(--tbH,60px) - 60px);overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:rgba(238,180,107,.4) transparent;-webkit-mask-image:linear-gradient(180deg,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(180deg,#000 calc(100% - 26px),transparent)}" +
    A + ".fold-y.fold-end{-webkit-mask-image:none;mask-image:none}" +
    /* ---- open, upright: rail + one wide column ---- */
    T + "{zoom:1!important;--rail:76px;--col:min(620px,calc(100vw - var(--rail)))}" +
    T + "#app{padding-left:var(--rail)!important}" +
    T + ".stage," + T + ".headrow," + T + ".livebar-in," + T + ".hdr-console{max-width:var(--col)!important}" +
    T + ".hdr-console{left:calc(var(--rail) / 2)!important}" +
    each(T, SCR, "{columns:auto!important;column-count:auto!important;column-width:auto!important}") +
    T + "#bankStrip{right:max(47px,calc(50% - var(--col) / 2 - var(--rail) / 2 + 47px))!important}" +
    T + ".dayBtn{right:max(10px,calc(50% - var(--col) / 2 - var(--rail) / 2 + 10px))!important}" +
    /* ---- closed outer screen / Split View: tighter ---- */
    C + ".card{margin-bottom:12px;border-radius:16px}" +
    C + ".card-h{padding:11px 15px}" + C + ".card-b{padding:12px 15px 14px}" +
    C + ".screen-title{font-size:23px}" +
    C + ".nav button{padding:5px 0!important}" + C + ".nav button .ico{font-size:18px}" +
    C + ".sheet-card{max-height:calc(100dvh - 12px);overflow-y:auto;overscroll-behavior:contain}" +
    C + "#scr-mayday .md-hero{height:126px}" + C + "#scr-mayday .md-hero b{font-size:40px}" +
    /* ---- every mode: rows that are wider than their box scroll sideways ---- */
    F + ".fold-x{overflow-x:auto!important;overflow-y:hidden;flex-wrap:nowrap!important;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;scroll-snap-type:x proximity;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 22px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 22px),transparent)}" +
    F + ".fold-x.fold-end{-webkit-mask-image:none;mask-image:none}" +
    F + ".fold-x::-webkit-scrollbar{display:none}" +
    F + ".fold-x>*{flex-shrink:0;scroll-snap-align:start}" +
    "@media (prefers-reduced-motion:reduce){html .nav .fold-medal{animation:none}}";

  var st = document.createElement("style"); st.id = "foldCSS"; st.textContent = css;
  function mount() { (document.body || document.documentElement).appendChild(st); } /* after the page's own styles, so ties go to this file */

  /* ---- scrollers ---- */
  var SKIP = "canvas,svg,video,img,input,textarea,select,.nav,.nav *,.topbar,.topbar *,[contenteditable],.leaflet-container,.leaflet-container *";
  function clipped(el, cs) { var o = cs.overflowX; return o === "visible" || o === "hidden" || o === "clip"; }
  function fadeEnd(el, axis) {
    var end = axis === "x" ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 : el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    el.classList.toggle("fold-end", end);
  }
  function hook(el, axis) {
    if (el.__foldHook) return; el.__foldHook = 1;
    el.addEventListener("scroll", function () { fadeEnd(el, axis); }, { passive: true }); fadeEnd(el, axis);
  }
  function scan() {
    if (!H.classList.contains("fold-on")) return;
    var root = document.querySelector(".screen.on,.screen.active") || document.getElementById("app") || document.body;
    var all = root.querySelectorAll("div,ul,ol,nav,section,table,p");
    for (var i = 0; i < all.length && i < 4000; i++) {
      var el = all[i];
      if (el.classList.contains("fold-x") || el.classList.contains("card") || el.classList.contains("screen")) continue;
      if (el.closest && el.closest(SKIP)) continue;
      if (el.scrollWidth <= el.clientWidth + 6 || el.clientWidth < 120 || !el.children.length) continue;
      var cs = getComputedStyle(el);
      if (cs.textOverflow === "ellipsis" || cs.position === "fixed" || cs.display.indexOf("inline") === 0 || !clipped(el, cs)) continue;
      if (el.tagName === "TABLE") { var w = document.createElement("div"); w.className = "fold-x"; el.parentNode.insertBefore(w, el); w.appendChild(el); el = w; }
      else el.classList.add("fold-x");
      el.setAttribute("data-noswipe", ""); /* the tab-swipe gesture leaves sideways scrollers alone */
      hook(el, "x");
    }
    if (H.classList.contains("fold-wide")) {
      var lim = innerHeight - 120, cards = root.querySelectorAll(".card>.card-b,.card>[id$='List'],.card>[id$='Feed']");
      for (var j = 0; j < cards.length; j++) {
        var b = cards[j]; if (b.classList.contains("fold-y")) continue;
        if (b.scrollHeight > lim * 1.15) { var o = getComputedStyle(b).overflowY; if (o === "auto" || o === "scroll") continue; b.classList.add("fold-y"); hook(b, "y"); }
      }
    }
  }
  function unscan() {
    [].forEach.call(document.querySelectorAll(".fold-y"), function (el) { el.classList.remove("fold-y"); });
  }

  var medal = null;
  function dressRail() {
    var nav = document.querySelector(".nav"); if (!nav || nav.querySelector(".fold-medal")) return;
    var im = new Image(); im.crossOrigin = "anonymous";
    im.onload = function () {
      try {
        var c = document.createElement("canvas"), W = 160; c.width = W; c.height = W; var g = c.getContext("2d");
        g.drawImage(im, 0, 0, W, W); var d = g.getImageData(0, 0, W, W), p = d.data, br = p[0], bg = p[1], bb = p[2];
        for (var i = 0; i < p.length; i += 4) {
          var gd = p[i + 1] - Math.max(p[i], p[i + 2]), dist = Math.hypot(p[i] - br, p[i + 1] - bg, p[i + 2] - bb);
          var a = Math.max(0, Math.min(1, Math.min((60 - gd) / 40, dist / 70))); if (gd > 0) p[i + 1] = Math.max(p[i], p[i + 2]); p[i + 3] *= a;
        }
        g.putImageData(d, 0, 0); medal = new Image(); medal.className = "fold-medal"; medal.alt = ""; medal.src = c.toDataURL("image/png");
        if (H.classList.contains("fold-wide") || H.classList.contains("fold-tall")) nav.appendChild(medal);
      } catch (e) {}
    };
    im.src = MJ + MEDAL + "_384_N.webp";
  }

  var cur = null, t = 0;
  function apply() {
    var m = mode(); if (m === cur) return; cur = m;
    MODES.forEach(function (k) { H.classList.toggle(k, k === m); });
    H.classList.toggle("fold-on", !!m);
    if (m !== "fold-wide") unscan();
    var nav = document.querySelector(".nav");
    if (medal && nav) { if (m === "fold-wide" || m === "fold-tall") nav.appendChild(medal); else if (medal.parentNode) medal.parentNode.removeChild(medal); }
    setTimeout(scan, 300);
  }
  function later() { clearTimeout(t); t = setTimeout(function () { apply(); scan(); }, 250); }

  function start() {
    mount(); apply(); dressRail();
    addEventListener("resize", later); addEventListener("orientationchange", later);
    /* re-check when the screen changes or new content lands */
    var busy = 0;
    new MutationObserver(function (recs) { if (busy || !cur) return;
      if (recs.every(function (r) { return r.type === "attributes" && (r.target === H || /fold-/.test(r.target.className || "")); })) return; busy = 1; setTimeout(function () { busy = 0; scan(); }, 700); })
      .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
