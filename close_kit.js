/* The Shadow Hook · close_kit.js (nov27b) — one obvious way out of every screen.
   Members said the app "froze" when they couldn't find how to close a page. The gestures were already there (pull down
   or swipe sideways on any pop-up, the phone's back gesture), but nothing on screen said so. Now whatever is open on top
   (a pop-up sheet, a full page, a game, Messy, a photo, the survey…) gets the same round ✕ in its top-right corner,
   unless it already shows its own ✕ / CLOSE / Back up top. Tapping it closes just that one layer, through the layer's
   own close, so nothing underneath is touched. Esc does the same on a computer. */
(function () {
  "use strict";
  if (window.__shkCloseKit) return; window.__shkCloseKit = true;
  var $ = function (id) { return document.getElementById(id); };

  /* full pages and their own back buttons (same list the swipe rule uses) */
  var VIEWS = [["dmView", "dmBack"], ["roomView", "roomBack"], ["yardMapView", "ymBack"], ["hvw", "hvBack"], ["gearView", "gearBack"], ["gathPage", "gpBack"],
    ["lbStory", "lsBack"], ["armOrders", "armOrdersBack"], ["wbw", "wbBack"], ["itw", "itBack"], ["ttw", "ttBack"], ["paw", "paBack"], ["fxw", "fxBack"],
    ["evw", "evBack"], ["p4w", "p4Back"], ["pjw", "pjBack"], ["tpw", "tpBack"]];

  function vis(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
    var r = el.getBoundingClientRect(); return r.width > 40 && r.height > 40 && r.bottom > 0 && r.top < innerHeight;
  }
  function z(el) { var n = el, best = 0; while (n && n !== document.body) { var v = parseInt(getComputedStyle(n).zIndex, 10); if (!isNaN(v) && v > best) best = v; n = n.parentElement; } return best; }
  function closeIn(box) {
    var bs = box.querySelectorAll("button,[role=button],a.close,.close-i"), i, b;
    for (i = 0; i < bs.length; i++) {
      b = bs[i]; if (!b.offsetParent) continue;
      var t = (b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase(), id = b.id || "", al = (b.getAttribute("aria-label") || "").toLowerCase();
      if (/^(close|✕|×|x|done|‹ ?back|back|← ?back|‹)$/.test(t) || /(Close|X|Back)$/.test(id) || /^(close|back)\b/.test(al) || b.classList.contains("close-i")) return b;
    }
    return null;
  }
  /* is there already a clear way out up top? */
  function hasTopExit(box, r) {
    var bs = box.querySelectorAll("button,[role=button],.close-i"), i, b;
    for (i = 0; i < bs.length; i++) {
      b = bs[i]; if (!b.offsetParent) continue;
      var br = b.getBoundingClientRect(); if (br.top > r.top + 110 || br.bottom < 0) continue;
      var t = (b.textContent || "").replace(/\s+/g, " ").trim().toLowerCase(), al = (b.getAttribute("aria-label") || "").toLowerCase();
      if (/^(✕|×|x|close|‹|‹ ?back|back|← ?back|←)$/.test(t) || /^(close|back)\b/.test(al) || b.classList.contains("close-i")) return true;
    }
    return false;
  }

  /* every layer that can sit on top: { el (what's showing), box (where to look for its own close), close() } */
  function layers() {
    var L = [], add = function (el, box, close) { if (el && vis(el)) L.push({ el: el, box: box || el, close: close, z: z(el) }); };
    try {
      var g = $("shkGame"); if (g && g.classList.contains("on")) add(g, g, function () { window.shkCloseGame ? window.shkCloseGame() : g.classList.remove("on"); });
      ["svSheet", "apptSheet"].forEach(function (id) { var e = $(id); if (e) add(e.firstElementChild || e, e, function () { e.remove(); }); });
      if (typeof window.pmIsOpen === "function" && window.pmIsOpen()) { var pm = document.querySelector("#pmRoot,#pmoney,.pm-root,[data-pm-root]"); add(pm || document.body, pm || document.body, function () { window.pmClose(); }); }
      VIEWS.forEach(function (v) { var e = $(v[0]); if (e && (e.classList.contains("on") || (e.style.display && e.style.display !== "none"))) add(e, e, function () { var b = $(v[1]); if (b && b.offsetParent) b.click(); else if (window.shkCloseTop) window.shkCloseTop(); }); });
      var yv = document.querySelector(".yiw.on"); if (yv) add(yv, yv, function () { window.shkCloseTop && window.shkCloseTop(); });
      ["storyViewer", "photoLB"].forEach(function (id) { var e = $(id); if (e && e.classList.contains("on")) add(e, e, function () { var b = closeIn(e); b ? b.click() : (window.shkCloseTop ? window.shkCloseTop() : e.classList.remove("on")); }); });
      document.querySelectorAll(".sheet.on,.dlg.on,.gifsheet.on,#bpop.on").forEach(function (e) {
        var card = e.querySelector(":scope>.sheet-card") || e.querySelector(".sheet-card") || e.firstElementChild || e;
        add(card, e, function () { var b = closeIn(e); if (b) b.click(); else e.classList.remove("on"); setTimeout(function () { if (e.classList.contains("on")) e.classList.remove("on"); }, 120); });
      });
    } catch (x) {}
    return L;
  }
  function top() {
    if ((function () { var b = $("boot"); return b && vis(b); })()) return null;
    var L = layers(); if (!L.length) return null;
    L.sort(function (a, b) { return a.z - b.z; });
    return L[L.length - 1];
  }

  var btn, cur = null;
  function css() {
    var s = document.createElement("style"); s.id = "ckCss";
    s.textContent =
      "#ckX{position:fixed;z-index:2147483000;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(18,16,26,.82);color:#fff;" +
        "display:none;align-items:center;justify-content:center;font:700 20px/1 Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);" +
        "cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:transform .12s}" +
      "#ckX.on{display:flex;animation:ckIn .18s ease-out}#ckX:active{transform:scale(.9)}" +
      "#ckX:after{content:'';position:absolute;inset:-8px}" +   /* a bigger tap target than it looks */
      "html.daylight #ckX{background:rgba(255,255,255,.95);color:#1c2127;border-color:rgba(28,33,39,.18);box-shadow:0 4px 14px rgba(20,30,40,.25)}" +
      "@keyframes ckIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:none}}" +
      "#ckTip{position:fixed;z-index:2147483000;max-width:220px;padding:8px 11px;border-radius:12px;background:#1f8f5f;color:#fff;font:600 12.5px/1.3 Inter,system-ui,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none;animation:ckIn .2s ease-out}";
    document.head.appendChild(s);
  }
  function place() {
    var L = top();
    if (!L || hasTopExit(L.box, L.el.getBoundingClientRect())) { cur = null; if (btn) btn.classList.remove("on"); return; }
    cur = L;
    if (!btn) {
      css(); btn = document.createElement("button"); btn.id = "ckX"; btn.type = "button"; btn.setAttribute("aria-label", "Close"); btn.textContent = "✕";
      btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); shut(); }, true);
      document.body.appendChild(btn);
    }
    var r = L.el.getBoundingClientRect(), t = Math.max(r.top, safeTop()) + 10;
    /* games draw their own buttons inside the frame (out of reach to check): sit on the frame's top edge instead */
    if (L.el.id === "shkGame") t = Math.max(safeTop() + 4, r.top - 20);
    var right = Math.max(10, innerWidth - Math.min(r.right, innerWidth) + 10);
    btn.style.top = Math.round(t) + "px"; btn.style.right = Math.round(right) + "px";
    btn.classList.add("on");
    hint();
  }
  var stDiv;
  function safeTop() {
    if (!stDiv) { stDiv = document.createElement("div"); stDiv.style.cssText = "position:fixed;top:0;left:0;height:env(safe-area-inset-top,0px);width:0;visibility:hidden;pointer-events:none"; document.body.appendChild(stDiv); }
    return stDiv.getBoundingClientRect().height || 0;
  }
  function shut() {
    var L = cur || top(); if (!L) return;
    try { L.close(); } catch (e) { try { window.shkCloseTop && window.shkCloseTop(); } catch (x) {} }
    try { if (!document.querySelector(".sheet.on,#roomView.on,.yiw.on") && !(window.shkGameIsOpen && window.shkGameIsOpen())) document.body.style.overflow = ""; } catch (e) {}
    setTimeout(place, 60); setTimeout(place, 300);
  }
  /* the first time: say it once */
  function hint() {
    var K = "shk_ck_tip1"; try { if (localStorage.getItem(K)) return; localStorage.setItem(K, "1"); } catch (e) { return; }
    var r = btn.getBoundingClientRect(), t = document.createElement("div"); t.id = "ckTip";
    t.textContent = "Tap ✕ to close any screen. You can also swipe it down.";
    t.style.top = Math.round(r.bottom + 8) + "px"; t.style.right = Math.round(innerWidth - r.right) + "px";
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 4200);
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && cur && !e.defaultPrevented) shut(); });
  var q = 0; function soon() { clearTimeout(q); q = setTimeout(place, 80); }
  ["click", "touchend", "transitionend", "animationend"].forEach(function (ev) { document.addEventListener(ev, soon, true); });
  window.addEventListener("popstate", soon); window.addEventListener("resize", soon);
  setInterval(place, 600);
})();
