/* #boardgames(nov21) — adds the "Board Games" card next to Corral Run wherever the game cards show,
   and sends taps to /board-games.html. Loaded by ports_ext.js so index.html didn't change.
   The card shows how many games are waiting on you (bg_lobby), refreshed every 2 minutes. */
(function () {
  if (window.__bgHook) return; window.__bgHook = 1;
  var waiting = 0;
  var css = document.createElement("style");
  css.textContent =
    ".hcard.gm-boards{background:linear-gradient(135deg,#2b1d52 0,#1b1438 50%,#3a1020 100%);border:2px solid #a78bfa;box-shadow:0 0 8px #a78bfa,0 0 18px #a78bfa55,inset 0 0 14px #a78bfa33;position:relative}" +
    ".hcard.gm-boards .hc-ico{font-family:Anton,Impact,sans-serif;color:#fde68a;letter-spacing:1px}" +
    ".hcard.gm-boards .hc-name{font-family:Anton,Impact,sans-serif;color:#fff;letter-spacing:1px}" +
    ".hcard.gm-boards .hc-stat{color:#c4b5fd}" +
    ".hcard.gm-boards .bg-badge{position:absolute;top:-7px;right:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#ef4444;color:#fff;font:700 12px/20px system-ui,sans-serif;text-align:center;box-shadow:0 0 0 2px #0b0a14}" +
    "html.ios-store .gm-boards{display:none!important}";
  (document.head || document.documentElement).appendChild(css);

  function cardHTML() {
    return '<div class="hc-kind gm-c0"><span>2P</span><span>TURNS</span></div><div class="hc-ico gm-c1">BOARD</div><div class="hc-name gm-c2">GAMES</div>' +
      '<div class="hc-stat gm-c3">' + (waiting ? waiting + " YOUR MOVE" : "4 GAMES · VS") + '</div>' + (waiting ? '<span class="bg-badge">' + waiting + "</span>" : "");
  }
  function paint() {
    var corrals = document.querySelectorAll('[data-hgame="corral"]');
    for (var i = 0; i < corrals.length; i++) {
      var c = corrals[i], nx = c.nextElementSibling;
      if (nx && nx.getAttribute && nx.getAttribute("data-hgame") === "boards") { refresh(nx); continue; }
      var el = document.createElement("div");
      el.className = "hcard hk-game gm-boards" + (waiting ? " is-hot" : "");
      el.setAttribute("data-hgame", "boards"); el.setAttribute("data-nofloor", ""); el.setAttribute("role", "button"); el.setAttribute("tabindex", "0");
      el.innerHTML = el.__h = cardHTML();
      c.parentNode.insertBefore(el, c.nextSibling);
    }
  }
  function refresh(el) {
    var h = cardHTML();
    if (el.__h !== h) { el.innerHTML = h; el.__h = h; el.classList.toggle("is-hot", !!waiting); }
  }
  // taps: our own listener (the app wires clicks only on cards it drew) plus a gameOpen wrapper for any other caller
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-hgame="boards"]');
    if (!t) return; e.preventDefault(); e.stopPropagation(); location.href = "/board-games.html";
  }, true);
  var wrapN = 0, wrapT = setInterval(function () {
    if (typeof window.gameOpen === "function" && !window.gameOpen.__bg) {
      var orig = window.gameOpen;
      window.gameOpen = function (k) { if (k === "boards") { location.href = "/board-games.html"; return; } return orig.apply(this, arguments); };
      window.gameOpen.__bg = 1;
    }
    if (++wrapN > 40) clearInterval(wrapT);
  }, 500);

  function count() {
    try {
      var sb = window.SB; if (!sb || !sb.rpc) return;
      sb.auth.getSession().then(function (r) {
        if (!r || !r.data || !r.data.session) return;
        return sb.rpc("bg_lobby").then(function (x) {
          if (!x || x.error || !x.data) return;
          var n = 0; (x.data.games || []).forEach(function (g) { if (g.my_turn || g.invite_for_me) n++; });
          if (n !== waiting) { waiting = n; paint(); }
        });
      }).catch(function () {});
    } catch (e) {}
  }
  var mo = new MutationObserver(function () { if (document.querySelector('[data-hgame="corral"]')) paint(); });
  function start() {
    paint(); mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(count, 2500); setInterval(function () { if (!document.hidden) count(); }, 120000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) count(); });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
