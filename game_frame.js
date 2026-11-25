/* game_frame.js — #gameframe(nov24). Every game opens the same way now, the way the Casino already did: a sheet that
   slides up UNDER the header (the header and its dispatch clock stay in sight), with the grab bar on top.
     · Messy, The Flip, Board Games and Corral Run are their own pages; they open inside this sheet (iframe ?inapp=1)
       instead of leaving the app. A link straight to one of those pages (a notification, the flyer) comes back here
       through /#game=… so it still opens under the header.
     · Close it like every other full screen: pull the bar down, pull down anywhere while you're at the top, or swipe in
       from the left edge. The phone's Back button closes it too. Inside a game, the left-edge swipe goes back one step
       first (a chat → the matches, a table → the lobby); at the game's front door it closes the game.
     · The pages report their pulls with postMessage {shk:'drag'|'dragend'|'edge'|'edgeend'|'close'} (game_shell.js).
     · Trivia and the Casino keep their own pull-down; this adds the left-edge swipe to them so all games close alike.
     · The first time a member opens a game here, a small hint shows how to close it (once per phone).
   Loaded by ports_ext.js. */
(function () {
  "use strict";
  if (window.shkOpenGame) return;
  var el = null, frame = null, cur = "", pushed = false, TH = 110;
  var GAMES = { corral: "/corral-run.html", boards: "/board-games.html", flip: "/flip.html", dates: "/messy.html", messy: "/messy.html" };

  function css() {
    if (document.getElementById("shkGameCss")) return;
    var st = document.createElement("style"); st.id = "shkGameCss";
    st.textContent =
      "#shkGame{position:fixed;left:0;right:0;bottom:0;top:var(--gfTop,0px);z-index:200;display:none;flex-direction:column;background:#0b0a14;" +
        "border-radius:16px 16px 0 0;overflow:hidden;box-shadow:0 -10px 30px rgba(0,0,0,.45);will-change:transform;contain:layout paint}" +
      "#shkGame.on{display:flex;animation:gfIn .28s cubic-bezier(.2,.9,.3,1)}" +
      "@keyframes gfIn{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}" +
      "#shkGame.drag{transition:none!important}#shkGame.snap{transition:transform .25s cubic-bezier(.2,.9,.3,1),opacity .25s}" +
      "#shkGame .gf-bar{position:relative;flex:none;height:18px;background:#1d1230;touch-action:none;cursor:grab;user-select:none}" +
      "#shkGame:not(.below) .gf-bar{height:calc(18px + env(safe-area-inset-top,0px))}" +
      "#shkGame .gf-grip{position:absolute;left:50%;bottom:6px;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:rgba(255,241,196,.55)}" +
      "#shkGame iframe{flex:1;width:100%;border:0;display:block;background:#0b0a14}" +
      "#shkGame .gf-cue{position:absolute;left:50%;top:26px;transform:translateX(-50%);z-index:3;padding:6px 12px;border-radius:999px;background:#000c;color:#fff;" +
        "font:700 11px/1 Inter,system-ui,sans-serif;letter-spacing:.12em;opacity:0;transition:opacity .15s;pointer-events:none;white-space:nowrap}" +
      "#shkGame .gf-cue.on{opacity:1}#shkGame .gf-cue.go{background:#ff4f8b}" +
      "#shkGame .gf-tip{position:absolute;left:12px;right:12px;top:30px;z-index:4;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;" +
        "background:#fffaf5;color:#2b1638;box-shadow:0 12px 30px #0008;font:500 13px/1.35 Inter,system-ui,sans-serif;animation:gfTip .35s ease-out}" +
      "#shkGame .gf-tip b{display:block;font:700 15px/1.2 Inter,system-ui,sans-serif;margin-bottom:2px}" +
      "#shkGame .gf-tip .gf-hand{flex:none;font-size:30px;animation:gfHand 1.4s ease-in-out infinite}" +
      "#shkGame .gf-tip button{flex:none;border:0;border-radius:12px;padding:9px 12px;background:#2b1638;color:#fff;font:700 13px/1 Inter,system-ui,sans-serif}" +
      "@keyframes gfTip{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}" +
      "@keyframes gfHand{0%,100%{transform:translateY(-4px)}50%{transform:translateY(8px)}}" +
      "html.gf-lock,html.gf-lock body{overflow:hidden}" +
      "html.gf-lock .topbar{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}" +
      "@media (prefers-reduced-motion:reduce){#shkGame.on{animation:none}#shkGame .gf-tip .gf-hand{animation:none}}";
    document.head.appendChild(st);
  }
  function hum(p) { try { typeof buzz === "function" ? buzz(p) : navigator.vibrate && navigator.vibrate(p); } catch (e) {} }
  function build() {
    css();
    el = document.createElement("div"); el.id = "shkGame";
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Game");
    el.innerHTML = '<div class="gf-bar" aria-label="Pull down to close"><i class="gf-grip" aria-hidden="true"></i></div><div class="gf-cue"></div><iframe title="Game" allow="autoplay; clipboard-write"></iframe>';
    document.body.appendChild(el);
    frame = el.querySelector("iframe");
    var bar = el.querySelector(".gf-bar"), y0 = null, t0 = 0;
    bar.addEventListener("pointerdown", function (e) { y0 = e.clientY; t0 = Date.now(); try { bar.setPointerCapture(e.pointerId); } catch (_) {} });
    bar.addEventListener("pointermove", function (e) { if (y0 != null) drag(e.clientY - y0); });
    function up(e) { if (y0 == null) return; var d = e.clientY - y0; y0 = null; dragEnd(d, d / Math.max(1, Date.now() - t0)); }
    bar.addEventListener("pointerup", up); bar.addEventListener("pointercancel", up);
    window.addEventListener("message", function (e) {
      if (!frame || e.source !== frame.contentWindow || !e.data) return;
      var m = e.data; if (m.cr === 'close') { close(); return; } if (!m.shk) return;
      if (m.shk === "drag") drag(+m.dy || 0);
      else if (m.shk === "dragend") dragEnd(+m.dy || 0, +m.v || 0);
      else if (m.shk === "edge") edge(+m.dx || 0);
      else if (m.shk === "edgeend") edgeEnd(+m.dx || 0, +m.v || 0);
      else if (m.shk === "close") close();
      else if (m.shk === "home") { close(); }
    });
  }
  function cue(d, label) {
    var c = el && el.querySelector(".gf-cue"); if (!c) return;
    if (d <= 8) { c.classList.remove("on"); return; }
    var go = d >= TH; c.classList.add("on"); c.classList.toggle("go", go); c.textContent = go ? "LET GO · " + label : label === "CLOSE" ? "PULL TO CLOSE" : "SWIPE TO CLOSE";
    if (go && !el.__buzzed) { el.__buzzed = 1; hum([10]); } if (!go) el.__buzzed = 0;
  }
  function drag(d) { if (!el) return; d = Math.max(0, d); el.classList.remove("snap"); el.classList.add("drag"); el.style.transform = "translateY(" + (d < TH ? d : TH + (d - TH) * 0.4) + "px)"; cue(d, "CLOSE"); }
  function dragEnd(d, v) {
    if (!el) return; el.classList.remove("drag"); el.classList.add("snap"); cue(0);
    if (d > TH || (d > 40 && v > 0.6)) { el.style.transform = "translateY(100%)"; setTimeout(function () { close(); }, 240); }
    else { el.style.transform = ""; setTimeout(function () { el.classList.remove("snap"); }, 260); }
  }
  function edge(d) { if (!el) return; d = Math.max(0, d); el.classList.remove("snap"); el.classList.add("drag"); el.style.transform = "translateX(" + d + "px)"; cue(d * 1.2, "CLOSE"); }
  function edgeEnd(d, v) {
    if (!el) return; el.classList.remove("drag"); el.classList.add("snap"); cue(0);
    if (d > 90 || (d > 30 && v > 0.6)) { el.style.transform = "translateX(100%)"; setTimeout(function () { close(); }, 240); }
    else { el.style.transform = ""; setTimeout(function () { el.classList.remove("snap"); }, 260); }
  }
  function place() {
    if (!el) return;
    var tb = document.querySelector(".topbar"), top = 0;
    try { if (tb && (tb.offsetParent !== null || getComputedStyle(tb).position === "fixed")) top = Math.max(0, Math.round(tb.getBoundingClientRect().bottom)); } catch (_) {}
    el.style.setProperty("--gfTop", top + "px"); el.classList.toggle("below", top > 0);
  }
  window.addEventListener("resize", place);

  function tip() {
    var K = "shk_gf_tip1"; try { if (localStorage.getItem(K)) return; localStorage.setItem(K, "1"); } catch (e) { return; }
    var t = document.createElement("div"); t.className = "gf-tip";
    t.innerHTML = '<div class="gf-hand" aria-hidden="true">👇</div><div style="flex:1"><b>Pull down to close</b>Grab the bar up top, or pull down from the top of the game. Swiping in from the left edge works too.</div><button type="button">Got it</button>';
    el.appendChild(t);
    var done = function () { t.remove(); }; t.querySelector("button").onclick = done; setTimeout(done, 9000);
  }
  function open(url) {
    if (!el) build();
    var u = String(url || ""); if (!/^\//.test(u)) return;
    /* a game opened from a message (the Messy flyer) or a card: close what sits over the header first */
    try { var dv = document.getElementById("dmView"); if (dv && dv.style.display !== "none") { if (typeof window.closeDmThread === "function") window.closeDmThread(); else dv.style.display = "none"; } } catch (e) {}
    try { ["dmCardSheet", "floorSheet"].forEach(function (id) { var s = document.getElementById(id); if (s) s.classList.remove("on"); }); } catch (e) {}
    var src = u + (u.indexOf("?") >= 0 ? "&" : "?") + "inapp=1";
    if (cur !== src) { frame.src = src; cur = src; }
    place(); el.style.transform = ""; el.classList.remove("snap", "drag");
    el.classList.add("on"); document.documentElement.classList.add("gf-lock");
    try { if (!(history.state && history.state.shkGame)) { history.pushState({ shkGame: 1 }, ""); pushed = true; } } catch (e) {}
    tip();
    /* the header can still be settling (splash, gate) when a game opens from a link: keep the sheet under it */
    clearInterval(el.__pt); el.__pt = setInterval(function () { if (!isOpen()) { clearInterval(el.__pt); return; } place(); }, 800);
    setTimeout(function () { try { frame.focus(); } catch (e) {} }, 300);
  }
  function close(fromPop) {
    if (!el || !el.classList.contains("on")) return;
    el.classList.remove("on", "drag", "snap"); el.style.transform = "";
    document.documentElement.classList.remove("gf-lock");
    var tp = el.querySelector(".gf-tip"); if (tp) tp.remove();
    /* leave the page so its timers, polls and the Party's live room stop */
    setTimeout(function () { if (!el.classList.contains("on")) { try { frame.src = "about:blank"; } catch (e) {} cur = ""; } }, 300);
    if (!fromPop && pushed) { pushed = false; try { if (history.state && history.state.shkGame) history.back(); } catch (e) {} }
    pushed = false;
    try { typeof loadInfo === "function"; } catch (e) {}
  }
  function isOpen() { return !!(el && el.classList.contains("on")); }
  window.addEventListener("popstate", function () { if (isOpen()) close(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && isOpen()) close(); });

  window.shkOpenGame = open; window.shkCloseGame = close; window.shkGameIsOpen = isOpen;

  /* the arcade's game cards: route the page games here */
  var n = 0, w = setInterval(function () {
    if (typeof window.gameOpen === "function" && !window.gameOpen.__gf) {
      var o = window.gameOpen;
      window.gameOpen = function (k) { if (GAMES[k]) { open(GAMES[k]); return; } return o.apply(this, arguments); };
      window.gameOpen.__gf = 1;
    }
    if (++n > 60) clearInterval(w);
  }, 500);

  /* a link straight to a game page comes back as /#game=/messy.html?t=matches */
  function fromHash() {
    var m = /[#&]game=([^&]+)/.exec(location.hash || ""); if (!m) return;
    var u = decodeURIComponent(m[1]); if (!/^\/(messy|flip|board-games|corral-run)(\.html)?([?#]|$)/.test(u)) return;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    var tries = 0, t = setInterval(function () {
      if (document.querySelector(".topbar") && document.body && (window.__shkUid || ++tries > 20)) { clearInterval(t); open(u); }
    }, 500);
  }
  fromHash(); window.addEventListener("hashchange", fromHash);

  /* the left-edge swipe for the games that live in the app itself: Trivia (a room) and the Casino (its own frame) */
  function edgeOn(doc, isOpenFn, closeFn) {
    var x0 = null, y0 = 0, t0 = 0, live = false, dead = false;
    doc.addEventListener("touchstart", function (e) { if (!isOpenFn() || e.touches.length > 1) { x0 = null; return; } var t = e.touches[0]; x0 = t.clientX < 26 ? t.clientX : null; y0 = t.clientY; t0 = Date.now(); live = dead = false; }, { passive: true });
    doc.addEventListener("touchmove", function (e) { if (x0 == null || dead) return; var t = e.touches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (!live) { if (Math.abs(dy) > 12 && Math.abs(dy) > dx) { dead = true; return; } if (dx > 12) live = true; } }, { passive: true });
    doc.addEventListener("touchend", function (e) { if (x0 == null || !live) { x0 = null; return; } var t = e.changedTouches[0], dx = t.clientX - x0, v = dx / Math.max(1, Date.now() - t0); x0 = null;
      if (dx > 90 || (dx > 30 && v > 0.6)) { hum([10]); closeFn(); } }, { passive: true });
  }
  edgeOn(document, function () { return !!document.querySelector(".roomscreen.on .trv-wrap"); }, function () { try { window.TRIVIA && TRIVIA.close(); } catch (e) {} });
  var pmT = setInterval(function () {
    var f = document.querySelector("#pmCasino iframe"); if (!f) return;
    try { var d = f.contentDocument; if (!d || !d.body || d.__shkEdge) return; d.__shkEdge = 1; clearInterval(pmT);
      edgeOn(d, function () { return !!(window.pmIsOpen && pmIsOpen()); }, function () { try { window.pmClose && pmClose(); } catch (e) {} });
    } catch (e) { clearInterval(pmT); }
  }, 2000);
})();
