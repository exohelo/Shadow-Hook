/* corral_art.js — #crart(nov25). Midjourney art for Corral Run.
     · On the yard: overhead sprites for the UTRs (every driver's own colour), the outside truckers, the top handlers,
       the ❓ boxes and the beer cans. The yard, the rules and the physics don't change, only the pictures.
     · Off the yard: key art behind the lobby title, and a trophy
       scene on the finish screen.
   The sprites are green-screen Midjourney, cut out here in the browser. Until one is ready (or if it won't load) the
   drawn version stays, so the game never waits on the art. */
(function () {
  "use strict";
  if (window.CRART) return;
  var MJ = "https://cdn.midjourney.com/";
  /* key → [job/0_n, turn (radians, so the sprite faces +x like the game's vehicles)] */
  var PICK = {
    utr:     ["3b4638cb-8894-4d9e-a983-23ff1e0be77a/0_0", Math.PI],   /* a real Kalmar/Ottawa-style terminal tractor, overhead */
    truck:   ["5acf6fc2-08ab-448e-9a73-8f21c6172cd0/0_2", 0],
    handler: ["01a1d81c-4fad-4071-95c9-aef69928cea8/0_2", 0],
    box:     ["b3050fcc-7b4a-40d1-b32d-007a84f7c1c7/0_3", 0],
    can:     ["81119914-0c99-4c5c-83ae-9090c1c5bf46/0_0", 0]
  };
  var HERO = "eb777e63-6167-4f3b-9f6e-6c773ddb4ff7/0_0", WIN = "1703eacf-2ba1-4956-8b91-acf76d112798/0_2";
  var A = window.CRART = { ready: {} };

  function key(job, turn) {
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          var W = 512, H = Math.max(1, Math.round(W * im.naturalHeight / im.naturalWidth)), c = document.createElement("canvas"); c.width = W; c.height = H;
          var g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H);
          var d = g.getImageData(0, 0, W, H), p = d.data, br = 0, bg = 0, bb = 0, n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
          [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3], [W >> 1, 2], [W >> 1, H - 3]].forEach(function (q) { var i = (q[1] * W + q[0]) * 4; br += p[i]; bg += p[i + 1]; bb += p[i + 2]; n++; });
          br /= n; bg /= n; bb /= n;
          var bgd = Math.max(18, bg - Math.max(br, bb));
          for (var i = 0; i < p.length; i += 4) {
            var r = p[i], gg = p[i + 1], b = p[i + 2], gd = gg - Math.max(r, b), dist = Math.sqrt((r - br) * (r - br) + (gg - bg) * (gg - bg) + (b - bb) * (b - bb));
            var a = Math.min((bgd * 0.8 - gd) / (bgd * 0.45), dist / 60); a = a < 0 ? 0 : a > 1 ? 1 : a;
            if (gd > 0) p[i + 1] = Math.max(r, b) + gd * (1 - a) * 0.3;
            p[i + 3] = Math.round(p[i + 3] * a);
            if (p[i + 3] > 60) { var px = (i >> 2) % W, py = (i >> 2) / W | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
          }
          g.putImageData(d, 0, 0);
          if (x1 <= x0 || y1 <= y0) return res(null);
          var bw = x1 - x0 + 1, bh = y1 - y0 + 1, o = document.createElement("canvas"), flip = Math.abs(Math.cos(turn)) < 0.5;
          o.width = flip ? bh : bw; o.height = flip ? bw : bh;
          var og = o.getContext("2d"); og.translate(o.width / 2, o.height / 2); og.rotate(turn); og.drawImage(c, x0, y0, bw, bh, -bw / 2, -bh / 2, bw, bh);
          res(o);
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = MJ + job + "_640_N.webp";
    });
  }
  Object.keys(PICK).forEach(function (k) { key(PICK[k][0], PICK[k][1]).then(function (cv) { if (cv) { A[k] = cv; A.ready[k] = 1; } }); });

  /* the same sprite in another driver's colour: the hue of `col`, the shading of the art (greys and black tyres stay put) */
  var TINT = {};
  A.tint = function (k, col) {
    var s = A[k]; if (!s || !col) return s;
    var id = k + col; if (TINT[id]) return TINT[id];
    var c = document.createElement("canvas"); c.width = s.width; c.height = s.height; var g = c.getContext("2d");
    g.drawImage(s, 0, 0);
    try { g.globalCompositeOperation = "hue"; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); g.globalCompositeOperation = "destination-in"; g.drawImage(s, 0, 0); }
    catch (e) { return s; }
    return (TINT[id] = c);
  };
  /* draw sprite k centred on (0,0), `len` long along +x */
  A.draw = function (g, k, len, col, alpha) {
    var s = col ? A.tint(k, col) : A[k]; if (!s) return false;
    var w = len, h = len * s.height / s.width;
    if (alpha != null) { var ga = g.globalAlpha; g.globalAlpha = ga * alpha; }
    g.drawImage(s, -w / 2, -h / 2, w, h);
    if (alpha != null) g.globalAlpha = ga;
    return true;
  };

  /* ── off the yard: lobby, dock cards, finish ── */
  var st = document.createElement("style");
  st.textContent =
    "#menu .card.wide{position:relative}" +
    "#menu .crhero{position:relative;margin:0 -18px 14px;height:210px;border-radius:0 0 22px 22px;overflow:hidden;" +
      "background:url('" + MJ + HERO + "_640_N.webp') center 60%/cover no-repeat,#1a1430;box-shadow:0 10px 30px #000a}" +
    "#menu .crhero::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,10,20,0) 35%,rgba(11,10,20,.55) 70%,#0b0a14)}" +
    "#menu .crhero h1{position:absolute;left:0;right:0;bottom:30px;z-index:1;margin:0;font-size:52px;color:#fde047;" +
      "text-shadow:0 4px 0 #6d28d9,0 0 24px rgba(251,191,36,.6),0 6px 18px #000;animation:crGlow 2.4s ease-in-out infinite alternate}" +
    "#menu .crhero .sub{position:absolute;left:0;right:0;bottom:6px;z-index:1;margin:0;color:#e9d5ff;text-shadow:0 2px 6px #000}" +
    "@keyframes crGlow{to{text-shadow:0 4px 0 #6d28d9,0 0 40px rgba(251,191,36,.95),0 6px 18px #000}}" +
    ".mapc{position:relative;overflow:hidden}" +
    ".mapc::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.18) 50%,transparent 60%);transform:translateX(-100%);transition:transform .6s}" +
    ".mapc:hover::after,.mapc.on::after{transform:translateX(100%)}" +
    "#done .crwin{margin:-18px -18px 6px;height:190px;border-radius:0 0 22px 22px;background:linear-gradient(180deg,rgba(7,6,15,0) 45%,#07060f),url('" + MJ + WIN + "_640_N.webp') center 30%/cover no-repeat;box-shadow:0 10px 30px #000a;animation:crWinIn .6s cubic-bezier(.2,1.5,.4,1)}" +
    "@keyframes crWinIn{from{transform:scale(.85);opacity:0}}" +
    ".btn{background:linear-gradient(180deg,#a78bfa,#7c3aed)!important}.btn.gold{background:linear-gradient(180deg,#fde68a,#f59e0b)!important}.btn.alt{background:#2a2540!important}" +
    "#gas{background:radial-gradient(circle at 50% 30%,#4ade80aa,#16a34a55)!important}#gas.on{background:radial-gradient(circle at 50% 30%,#86efac,#16a34a)!important;box-shadow:0 0 24px #4ade80}" +
    "@media (prefers-reduced-motion:reduce){#menu .crhero h1,#done .crwin{animation:none}}";
  (document.head || document.documentElement).appendChild(st);

  function dress() {
    var card = document.querySelector("#menu .card.wide"), h1 = card && card.querySelector(":scope > h1"), sub = card && card.querySelector(":scope > .sub");
    if (card && h1 && !card.querySelector(".crhero")) {
      var hero = document.createElement("div"); hero.className = "crhero"; card.insertBefore(hero, h1); hero.appendChild(h1); if (sub) hero.appendChild(sub);
    }
    var done = document.querySelector("#done .card");
    if (done && !done.querySelector(".crwin")) { var w = document.createElement("div"); w.className = "crwin"; w.setAttribute("aria-hidden", "true"); done.insertBefore(w, done.firstChild); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", dress); else dress();
})();
