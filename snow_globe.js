/* The Shadow Hook · snow_globe.js (nov27a) — the whole app is a snow globe.
   Hold the phone still: no snow. Shake it hard: a flurry fills the screen inside a glass globe, swirls the way you
   shook it, drifts the way you tilt the phone, and settles. Shake again and it stirs back up.
   Only in the Christmas skin, only on phones (anything with a motion sensor and a touch screen); computers keep the
   gentle falling snow. iPhones ask once for motion access (a small card, the first time). Off with reduced motion,
   the calm look, or the season theme switched off. */
(function () {
  "use strict";
  if (window.__snowGlobe) return; window.__snowGlobe = true;
  var H = document.documentElement;
  var phone = false;
  try { phone = !!window.DeviceMotionEvent && window.matchMedia("(pointer:coarse)").matches; } catch (e) {}
  var test = /[?&]sgtest\b/.test(location.search);
  if (!phone && !test) return;
  var reduce = false; try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  if (reduce) return;
  function on() { return H.classList.contains("season-xmas") && H.classList.contains("xm-on") && !H.classList.contains("calm") && !H.classList.contains("xm-nodecor") && !document.hidden; }

  /* no snow while the globe sits still */
  var st = document.createElement("style");
  st.textContent =
    "html.xm-globe #xmSnow{display:none!important}" +
    "#sgCanvas{position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:41}" +
    "#sgGlass{position:fixed;inset:0;pointer-events:none;z-index:41;opacity:0;transition:opacity .9s ease;" +
      "background:radial-gradient(circle at 50% 46%,rgba(255,255,255,0) 0,rgba(255,255,255,0) 58%,rgba(190,215,245,.10) 66%,rgba(120,160,210,.28) 74%,rgba(30,50,80,.55) 84%,rgba(10,18,30,.78) 100%)}" +
    "#sgGlass:before{content:'';position:absolute;left:12%;top:9%;width:34%;height:20%;border-radius:50%;transform:rotate(-24deg);background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,.42),rgba(255,255,255,0) 70%);filter:blur(2px)}" +
    "#sgGlass:after{content:'';position:absolute;right:10%;bottom:16%;width:12%;height:30%;border-radius:50%;transform:rotate(18deg);background:radial-gradient(ellipse at 50% 50%,rgba(255,255,255,.22),rgba(255,255,255,0) 70%)}" +
    "html.daylight #sgGlass{background:radial-gradient(circle at 50% 46%,rgba(255,255,255,0) 0,rgba(255,255,255,0) 60%,rgba(170,200,235,.16) 68%,rgba(110,150,200,.32) 78%,rgba(60,90,130,.5) 100%)}" +
    "#sgAsk{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 92px);transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:10px;padding:10px 12px 10px 14px;border-radius:16px;background:rgba(10,20,32,.92);color:#fff;font:600 13px/1.3 Inter,system-ui,sans-serif;box-shadow:0 8px 26px rgba(0,0,0,.35);max-width:92vw}" +
    "#sgAsk button{border:0;border-radius:10px;padding:8px 12px;font:800 12px/1 inherit;letter-spacing:.04em}#sgAsk .y{background:#2fae6c;color:#fff}#sgAsk .n{background:transparent;color:#9fb3c8}";
  document.head.appendChild(st);

  var cv, cx, glass, W = 0, Hh = 0, DPR = 1, flakes = [], running = false, energy = 0, last = 0;
  var tilt = { x: 0, y: 1 };               // which way is "down" on the screen
  function ensure() {
    if (cv) return;
    cv = document.createElement("canvas"); cv.id = "sgCanvas"; cv.setAttribute("aria-hidden", "true");
    glass = document.createElement("div"); glass.id = "sgGlass"; glass.setAttribute("aria-hidden", "true");
    document.body.appendChild(glass); document.body.appendChild(cv);
    cx = cv.getContext("2d"); size();
    window.addEventListener("resize", size);
  }
  function size() { if (!cv) return; DPR = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; Hh = window.innerHeight; cv.width = W * DPR; cv.height = Hh * DPR; cx.setTransform(DPR, 0, 0, DPR, 0, 0); }

  /* stir: throw flakes into the water the way the phone was shaken */
  function stir(power, dx, dy) {
    ensure();
    var n = Math.min(520 - flakes.length, Math.round(60 + power * 18));
    for (var i = 0; i < n; i++) {
      var big = Math.random() < 0.12;
      flakes.push({
        x: Math.random() * W, y: Math.random() * Hh * (0.35 + Math.random() * 0.65),
        vx: (Math.random() - 0.5) * 9 + dx * 2.2, vy: (Math.random() - 0.8) * 9 + dy * 2.2,
        r: big ? 2.4 + Math.random() * 2.2 : 0.8 + Math.random() * 1.7,
        sp: Math.random() * Math.PI * 2, sw: 0.4 + Math.random() * 0.9, a: 0.55 + Math.random() * 0.45, rest: 0
      });
    }
    // flakes already settled get kicked back up too
    flakes.forEach(function (f) { if (f.rest) { f.rest = 0; f.vy = -4 - Math.random() * 7 + dy; f.vx += (Math.random() - 0.5) * 6 + dx; } });
    energy = Math.min(1, energy + 0.35 + power * 0.04);
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }

  function tick(t) {
    var dt = Math.min(0.05, (t - last) / 1000) || 0.016; last = t;
    if (!on()) { flakes = []; }
    energy *= Math.pow(0.82, dt);            // the globe calms down over a few seconds
    var day = H.classList.contains("daylight");
    cx.clearRect(0, 0, W, Hh);
    var gx = tilt.x * 26, gy = Math.max(-26, Math.min(26, tilt.y * 26)), drag = Math.pow(0.12, dt), floorY = Hh - 4;
    var alive = 0;
    for (var i = flakes.length - 1; i >= 0; i--) {
      var f = flakes[i];
      if (!f.rest) {
        f.sp += dt * 1.6;
        f.vx = f.vx * drag + (gx * 0.06 + Math.sin(f.sp) * f.sw * 0.9) * dt * 60 * 0.05;
        f.vy = f.vy * drag + (gy * 0.06) * dt * 60 * 0.05 / (f.r * 0.35 + 0.6);
        f.x += f.vx * dt * 60 * 0.5; f.y += f.vy * dt * 60 * 0.5;
        if (f.x < -6) f.x = W + 6; else if (f.x > W + 6) f.x = -6;
        if (f.y > floorY) { f.y = floorY - Math.random() * 6; f.rest = 1; }
        if (f.y < -20) { f.y = -20; f.vy = Math.abs(f.vy) * 0.3; }
      } else {
        f.a -= dt * 0.18;                    // settled snow melts away
      }
      if (f.a <= 0) { flakes.splice(i, 1); continue; }
      alive++;
      cx.globalAlpha = Math.max(0, Math.min(1, f.a));
      cx.beginPath(); cx.arc(f.x, f.y, f.r, 0, 6.283);
      cx.fillStyle = day ? "#c3d6ec" : "#ffffff"; cx.fill();
      if (day) { cx.lineWidth = 0.6; cx.strokeStyle = "rgba(50,80,120,.35)"; cx.stroke(); }
    }
    cx.globalAlpha = 1;
    if (glass) glass.style.opacity = flakes.length ? String(Math.min(1, 0.25 + energy)) : "0";
    if (alive) requestAnimationFrame(tick);
    else { running = false; cx.clearRect(0, 0, W, Hh); if (glass) glass.style.opacity = "0"; }
  }

  /* shake detection: three hard jolts inside a second; a still or gently moved phone does nothing */
  var prev = null, hits = [], cool = 0, conv = 0, live = false;
  function onMotion(e) {
    if (!on()) return;
    var g = e.accelerationIncludingGravity, a = e.acceleration;
    if (g && g.x != null) {
      // Android reports an upright phone as y = +9.8, iPhone as -9.8: learn which from the first clear reading
      if (!conv && Math.abs(g.y || 0) > 6) conv = (g.y > 0) ? 1 : -1;
      var c = conv || 1, sx = -c * (g.x || 0) / 9.8, sy = c * (g.y || 0) / 9.8;
      var th = (((screen.orientation && screen.orientation.angle) || window.orientation || 0) * Math.PI) / 180;
      var X = sx * Math.cos(th) - sy * Math.sin(th), Y = sx * Math.sin(th) + sy * Math.cos(th);
      tilt.x = tilt.x * 0.85 + X * 0.15; tilt.y = tilt.y * 0.85 + Y * 0.15;
      if (!a || a.x == null) a = prev ? { x: g.x - prev.x, y: g.y - prev.y, z: g.z - prev.z } : null;
      prev = { x: g.x, y: g.y, z: g.z };
    }
    if (!a || a.x == null) return;
    var m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z), now = Date.now();
    if (m > 14) { hits.push(now); }
    hits = hits.filter(function (h) { return now - h < 1000; });
    if (hits.length >= 3 && now > cool) {
      cool = now + 450;
      stir(Math.min(40, m), -(a.x || 0) * 0.25, (a.y || 0) * 0.25);
    }
  }

  function start() { if (live) return; live = true; window.addEventListener("devicemotion", onMotion, { passive: true }); globeClass(); }
  function globeClass() { H.classList.toggle("xm-globe", live && H.classList.contains("season-xmas") && H.classList.contains("xm-on") && !H.classList.contains("calm")); }
  globeClass(); new MutationObserver(globeClass).observe(H, { attributes: true, attributeFilter: ["class"] });

  /* iPhone: motion needs a yes, given from a tap */
  var LS = "shk_sg_motion";
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    var asked = null; try { asked = localStorage.getItem(LS); } catch (e) {}
    var ask = function () {
      return DeviceMotionEvent.requestPermission().then(function (r) { try { localStorage.setItem(LS, r); } catch (e) {} if (r === "granted") start(); }).catch(function () {});
    };
    if (asked === "granted") {
      // already allowed: iOS still wants the call made from a tap each visit
      var once = function () { document.removeEventListener("touchend", once, true); ask(); };
      document.addEventListener("touchend", once, true);
    } else if (asked !== "denied" && asked !== "no") {
      var card = function () {
        if (!on() || document.getElementById("sgAsk") || document.getElementById("boot")) return;
        var c = document.createElement("div"); c.id = "sgAsk";
        c.innerHTML = '<span>❄ The app is a snow globe this season. Shake your phone to make it snow.</span><button class="y" type="button">Turn on</button><button class="n" type="button">✕</button>';
        document.body.appendChild(c);
        c.querySelector(".y").addEventListener("click", function () { c.remove(); ask(); });
        c.querySelector(".n").addEventListener("click", function () { c.remove(); try { localStorage.setItem(LS, "no"); } catch (e) {} });
      };
      setTimeout(card, 9000);
    }
  } else {
    start();
  }
  window.shkSnowGlobe = function (p) { stir(p || 30, 0, 0); };
  if (test) { start(); document.addEventListener("keydown", function (e) { if (e.key === "s") stir(30, (Math.random() - 0.5) * 8, -6); }); }
})();
