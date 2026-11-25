/* game_shell.js — #gameframe(nov24). Rides at the top of every game page (Messy, The Flip, Board Games, Corral Run).
   Inside the app's game sheet (game_frame.js) it turns the page's pulls into the same close the rest of the app uses:
     · pull down while the page is at the top → the sheet follows your finger; let go past the line and the game closes
       (if a pop-up or chat is open inside the game, the pull closes that first)
     · swipe in from the left edge → back one step (the page's own SHK_SHELL_BACK), and at the front door it closes the game
   A page sets window.SHK_SHELL_BACK = function(){ return true if it went back a step } and, if it has its own popups,
   window.SHK_SHELL_LAYER = function(){ return true while one is open }. <html data-shell="edge"> (Corral Run) keeps
   only the edge swipe, because the game itself uses drags.
   Opened on its own (a notification or a link), the page sends itself back to the app as /#game=… so it opens under the
   header like every other game. Add ?solo=1 to open a page on its own anyway. */
(function () {
  "use strict";
  var inapp = window.parent !== window;
  if (!inapp && !/[?&]solo=1/.test(location.search)) {
    var q = location.search.replace(/([?&])inapp=1&?/, "$1").replace(/[?&]$/, "");
    location.replace("/#game=" + encodeURIComponent(location.pathname + q + location.hash));
    return;
  }
  var root = document.documentElement;
  if (inapp) root.classList.add("shk-inapp");
  var st = document.createElement("style");
  st.textContent = "html.shk-inapp .top a[href='/'],html.shk-inapp #mainTop a[href='/']{visibility:hidden!important;pointer-events:none!important}html.shk-inapp body{overscroll-behavior-y:none}";
  (document.head || root).appendChild(st);

  function post(m) { try { if (inapp) window.parent.postMessage(m, location.origin); } catch (e) {} }
  function layer() { try { return !!(window.SHK_SHELL_LAYER && window.SHK_SHELL_LAYER()); } catch (e) { return false; } }
  function deep() { try { return !!(window.SHK_SHELL_DEEP && window.SHK_SHELL_DEEP()); } catch (e) { return false; } }
  function back() { try { if (window.SHK_SHELL_BACK && window.SHK_SHELL_BACK()) return true; } catch (e) {} return false; }
  function closeGame() { if (inapp) post({ shk: "close" }); else location.href = "/"; }
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} }

  function atTop(el) {
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 0) return false;
    for (var n = el; n && n !== document.body && n !== root; n = n.parentElement) {
      if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight + 2) return false;
    }
    return true;
  }
  var P = null;
  document.addEventListener("touchstart", function (e) {
    P = null; if (e.touches.length > 1) return;
    var t = e.touches[0], tg = e.target;
    if (tg.closest && tg.closest("input,textarea,select,[contenteditable],[data-nopull]")) return;
    var edgeOnly = root.getAttribute("data-shell") === "edge";
    P = { x: t.clientX, y: t.clientY, t: Date.now(), edge: t.clientX < 26, pull: !edgeOnly && atTop(tg), mode: null, d: 0 };
  }, { passive: true });
  document.addEventListener("touchmove", function (e) {
    if (!P || P.mode === "dead") return;
    var t = e.touches[0], dx = t.clientX - P.x, dy = t.clientY - P.y;
    if (!P.mode) {
      if (P.edge && dx > 10 && dx > Math.abs(dy)) P.mode = "edge";
      else if (P.pull && dy > 10 && dy > Math.abs(dx) * 1.2) P.mode = layer() ? "lpull" : "pull";
      else if (Math.abs(dx) > 10 || Math.abs(dy) > 10) { P.mode = "dead"; return; }
      else return;
    }
    if (e.cancelable) e.preventDefault();
    if (P.mode === "pull") { P.d = dy - 10; post({ shk: "drag", dy: P.d }); }
    else if (P.mode === "edge") { P.d = dx - 10; if (!layer() && !deep()) post({ shk: "edge", dx: P.d }); }
    else if (P.mode === "lpull") { P.d = dy - 10; }
  }, { passive: false });
  function end(e) {
    if (!P || !P.mode || P.mode === "dead") { P = null; return; }
    var p = P; P = null;
    var v = p.d / Math.max(1, Date.now() - p.t);
    if (p.mode === "pull") { post({ shk: "dragend", dy: p.d, v: v }); if (!inapp && (p.d > 110 || (p.d > 40 && v > 0.6))) closeGame(); return; }
    var go = p.d > 90 || (p.d > 30 && v > 0.6);
    if (p.mode === "lpull") { if (go) { buzz(10); back(); } return; }
    if (p.mode === "edge") {
      if (!go) { post({ shk: "edgeend", dx: 0, v: 0 }); return; }
      buzz(10);
      if (back()) { post({ shk: "edgeend", dx: 0, v: 0 }); return; }
      if (inapp) post({ shk: "edgeend", dx: p.d, v: v }); else closeGame();
    }
  }
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", end, { passive: true });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !back()) closeGame(); });
  window.SHK_SHELL = { close: closeGame, inapp: inapp };
})();
