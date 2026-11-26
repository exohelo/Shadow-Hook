/* casino_art.js — #casinoart(nov25). Midjourney art for the P Money casino, loaded inside the casino's frame (pmoney.js
   writes the page; one <script> line there pulls this in, and one line hands over the slot symbol table, window.__SYMART).
     · Crane Slots: glossy Midjourney symbols on the reels and in the pay table (jackpot coin, chrome hook, yellow crane,
       container ship, stacked containers, blue anchor). The symbols, odds and payouts don't change — only the pictures.
     · The lobby: Midjourney icons on the game tiles, and a neon "casino on the dock" night scene behind the P MONEY marquee.
   The art is green-screen Midjourney, cut out here in the browser. Until it's ready (or if it won't load) the drawn art stays. */
(function () {
  "use strict";
  if (window.__casinoArt) return; window.__casinoArt = 1;
  var MJ = "https://cdn.midjourney.com/";
  var PICK = { "sym_X": "90ea50c8-d5d7-4f30-a1a9-58dd5cb8ae7e/0_1", "sym_H": "fd102efb-e937-4dc2-8a8c-82c76e945fc7/0_1", "sym_C": "36b95199-f03e-4afc-9976-f2a8c7c7e6bc/0_1", "sym_S": "242dcaff-70e7-4cdd-ada5-92d6e3e351a9/0_3", "sym_B": "e8eccd0b-ce62-4686-a03b-32d7baa7b5a0/0_1", "sym_A": "11ae144d-1e0d-412b-9507-d49efb227e5a/0_1", "t_call": "6c7a41de-7a56-4f8c-bee9-06c3f65c7251/0_2", "t_sq": "17e2da67-a97a-4820-a036-42282e776723/0_1", "t_duel": "7f15b852-bb45-45f3-ac6f-74e437d74b08/0_1", "t_hire": "e981f64c-f3a3-476b-8351-bb75eef99d0f/0_3", "t_ou": "157b33ce-c78a-4b9b-840b-82cd664f74cf/0_1", "t_lift": "0646d16b-ab09-47ce-8f2a-793ed1b9ac3e/0_1", "t_slot": "58030b9f-2a4f-4998-967a-d5e2df1364d8/0_1", "t_hilo": "12a28106-5be0-4ee3-93fe-ea5d1535a21e/0_1" };          /* key → "job/0_n" (green screen, keyed) */
  var HERO = "75584308-0cb8-4c52-987b-a055e3608e2e/0_1";        /* the marquee backdrop (no keying) */
  var SYMKEY = { "⬡": "sym_X", "🪝": "sym_H", "🏗️": "sym_C", "🚢": "sym_S", "📦": "sym_B", "⚓": "sym_A" };
  var TILEKEY = { call: "t_call", sq: "t_sq", duel: "t_duel", hire: "t_hire", ou: "t_ou", lift: "t_lift", slot: "t_slot", hilo: "t_hilo" };
  var ART = {};

  var st = document.createElement("style");
  st.textContent =
    ".cell span img.sym{width:58px;height:58px;object-fit:contain;display:block;filter:drop-shadow(0 3px 3px rgba(0,0,0,.45))}" +
    ".reel.win .cell span img.sym,.reel .cell.hit span img.sym{filter:drop-shadow(0 0 8px #fff6c4) drop-shadow(0 3px 3px rgba(0,0,0,.4))}" +
    ".pays .tri img.sym{width:24px;height:24px;object-fit:contain;vertical-align:middle}" +
    "img.sym.mj{pointer-events:none;user-select:none;-webkit-user-drag:none}" +
    ".tile .ti img.mjt{display:block;object-fit:contain;filter:drop-shadow(0 4px 5px rgba(0,0,0,.5));animation:mjBob 3.2s ease-in-out infinite}" +
    ".tile:nth-child(2n) .ti img.mjt{animation-delay:-1.6s}" +
    "@keyframes mjBob{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-4px) rotate(2deg)}}" +
    "@media (prefers-reduced-motion:reduce){.tile .ti img.mjt{animation:none}}" +
    (HERO ? ".marquee.mj-hero{background:linear-gradient(180deg,rgba(20,6,30,.35),rgba(20,6,30,.55) 55%,rgba(12,4,20,.92)),url('" + MJ + HERO + "_640_N.webp') center 55%/cover no-repeat,#2a1240!important}" +
      ".marquee.mj-hero::before,.marquee.mj-hero::after{opacity:.55}" : "");
  (document.head || document.documentElement).appendChild(st);

  function key(url) {
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          var W = 320, H = Math.max(1, Math.round(W * im.naturalHeight / im.naturalWidth)), c = document.createElement("canvas"); c.width = W; c.height = H;
          var g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H);
          var d = g.getImageData(0, 0, W, H), p = d.data, br = 0, bg = 0, bb = 0, n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
          [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3], [W >> 1, 2]].forEach(function (q) { var i = (q[1] * W + q[0]) * 4; br += p[i]; bg += p[i + 1]; bb += p[i + 2]; n++; });
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
          var bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = Math.max(bw, bh), o = document.createElement("canvas"); o.width = s; o.height = s;
          o.getContext("2d").drawImage(c, x0, y0, bw, bh, (s - bw) / 2, (s - bh) / 2, bw, bh);   /* square, centered: lines up in the reel cells */
          res(o.toDataURL("image/png"));
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = MJ + url + "_384_N.webp";
    });
  }

  /* ── the slot symbols ── */
  var ORIG = {};   /* browser-normalized markup of each drawn symbol → its key */
  function norm(html) { var t = document.createElement("div"); t.innerHTML = html; return t.firstElementChild ? t.firstElementChild.outerHTML : html; }
  function symImg(k) { return '<img class="sym mj" alt="" src="' + ART[SYMKEY[k]] + '">'; }
  function swapSyms(root) {
    var T = window.__SYMART; if (!T) return;
    root = root || document;
    var list = root.querySelectorAll ? [].slice.call(root.querySelectorAll("svg.sym")) : [];
    if (root.matches && root.matches("svg.sym")) list.push(root);
    for (var i = 0; i < list.length; i++) {
      var k = ORIG[list[i].outerHTML];
      if (k && ART[SYMKEY[k]]) { var t = document.createElement("div"); t.innerHTML = symImg(k); list[i].replaceWith(t.firstChild); }
    }
  }
  function symsReady() {
    var T = window.__SYMART; if (!T) return;
    Object.keys(SYMKEY).forEach(function (k) {
      if (!ART[SYMKEY[k]] || typeof T[k] !== "string" || T[k].indexOf("img class=\"sym mj\"") >= 0) return;
      ORIG[norm(T[k])] = k; T[k] = symImg(k);
    });
    swapSyms(document);
  }

  /* ── the lobby tiles ── */
  function swapTiles() {
    Object.keys(TILEKEY).forEach(function (go) {
      var u = ART[TILEKEY[go]]; if (!u) return;
      var tiles = document.querySelectorAll('.tile[data-go="' + go + '"] .ti');
      for (var i = 0; i < tiles.length; i++) {
        var ti = tiles[i]; if (ti.querySelector("img.mjt")) continue;
        var old = ti.querySelector("svg"), w = 64, h = 64;
        if (old) { var r = old.getBoundingClientRect(); if (r.width > 10) { w = Math.round(r.width * 1.12); h = Math.round(r.height * 1.12); } }
        ti.innerHTML = '<img class="mjt" alt="" src="' + u + '" style="width:' + w + 'px;height:' + h + 'px">';
      }
    });
  }
  function hero() { if (!HERO) return; var m = document.querySelectorAll(".marquee"); for (var i = 0; i < m.length; i++) m[i].classList.add("mj-hero"); }

  var queued = false;
  var mo = new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) for (var j = 0; j < ms[i].addedNodes.length; j++) { var nd = ms[i].addedNodes[j]; if (nd.nodeType === 1) { swapSyms(nd); } }
    if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; swapTiles(); hero(); }); }
  });
  function start() {
    hero();
    Object.keys(PICK).forEach(function (k) {
      key(PICK[k]).then(function (u) { if (!u) return; ART[k] = u; if (k.indexOf("sym_") === 0) symsReady(); else swapTiles(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
