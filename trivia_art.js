/* trivia_art.js — #trvshow(nov26). DOCK TRIVIA becomes a game show on the docks.
   trivia.js keeps every rule, timer and server call; this file only dresses the room it draws:
     · a Midjourney stage behind the room and a lit marquee hero on the lobby
     · illustrated duel tiles (lightning crate = ANYONE, megaphone = CALL OUT)
     · contestant podiums, a lit question board, a big countdown ring
     · glossy A/B/C/D answer buttons in four colours, with press / right / wrong animations
     · Victory (gold "?" trophy) and Defeat (a lone rubber duck in the rain) scenes, and a container podium for the top three
   Loaded by ports_ext.js. Art is green-screen Midjourney cut out in the browser; until it's in, the plain look stays. */
(function () {
  "use strict";
  if (window.__trvArt) return; window.__trvArt = 1;
  var MJ = "https://cdn.midjourney.com/";
  var STAGE = "d7b10e3e-f2a1-4186-8cb8-327a7399a05a/0_1", WIN = "cca60b41-b3e9-4100-a873-f5d7be59f1e0/0_0", LOSE = "e3f125af-4ee2-4efc-a7d9-5a76498fbe9d/0_1";
  var KEY = { any: "866b12bf-6b06-4271-a4fc-a6bff3ab6464/0_0", call: "d70c0131-d467-4c74-9f98-613f52b8618b/0_0", pod: "6470b308-d718-4185-aa2b-ca0010bb9db0/0_1" };
  var ART = {};
  var R = "html body #trvRoom ";
  var css =
    /* the room: the stage at the top, fading to night */
    R.slice(0, -1) + "{background:linear-gradient(180deg,rgba(9,6,24,.35) 0,rgba(9,6,24,.78) 200px,#08061a 380px,#05040f 100%),url('" + MJ + STAGE + "_640_N.webp') center top/100% auto no-repeat,#05040f!important}" +
    R + ".trv-top{background:linear-gradient(180deg,rgba(5,4,15,.7),rgba(5,4,15,0))}" +
    R + ".trv-ttl{font-family:Bungee,Anton,sans-serif!important;font-size:22px!important;letter-spacing:.04em;color:#ffe600!important;-webkit-text-fill-color:#ffe600!important;background:none!important;text-shadow:0 3px 0 #b3006b,0 0 14px #ff3d9a,0 0 28px #4dd8ffaa!important}" +
    /* lobby hero marquee */
    R + ".ta-hero{position:relative;margin:2px 0 4px;height:150px;border-radius:20px;overflow:hidden;background:url('" + MJ + STAGE + "_640_N.webp') center 38%/cover no-repeat;box-shadow:0 10px 28px #000a,inset 0 0 0 2px #ffe60066}" +
    R + ".ta-hero:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,6,20,0) 30%,rgba(8,6,20,.85))}" +
    R + ".ta-hero:after{content:'';position:absolute;inset:6px;border-radius:15px;pointer-events:none;background:radial-gradient(circle,#fff6c4 0 2px,#ffbf1f 2.6px,transparent 3.6px) 0 0/14px 14px;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;padding:4px;animation:taBulbs 1.4s linear infinite;opacity:.85}" +
    "@keyframes taBulbs{to{background-position:14px 14px}}" +
    R + ".ta-hero b{position:absolute;left:0;right:0;bottom:30px;z-index:1;text-align:center;font:400 34px/1 Bungee,Anton,sans-serif;color:#ffe600;text-shadow:0 4px 0 #b3006b,0 0 18px #ff3d9a,0 0 34px #4dd8ff;animation:taGlow 2s ease-in-out infinite alternate}" +
    R + ".ta-hero i{position:absolute;left:0;right:0;bottom:12px;z-index:1;text-align:center;font:700 12.5px/1 'Barlow Condensed',sans-serif;letter-spacing:.24em;color:#eaf2ff;font-style:normal;text-shadow:0 2px 6px #000}" +
    "@keyframes taGlow{to{text-shadow:0 4px 0 #b3006b,0 0 26px #ff3d9a,0 0 48px #4dd8ff}}" +
    R + ".trv-hl{font-family:Bungee,Anton,sans-serif!important;letter-spacing:.02em}" +
    /* the two duel tiles: art + gloss */
    R + ".trv-tile2.big{position:relative;overflow:hidden;min-height:118px;border-radius:20px!important;padding-right:92px!important;box-shadow:0 6px 0 rgba(0,0,0,.35),0 10px 26px rgba(0,0,0,.45)!important;transition:transform .12s}" +
    R + ".trv-tile2.big:active{transform:translateY(3px)}" +
    R + ".trv-tile2.big.cy{background:linear-gradient(160deg,#7ff0ff,#18b4e6 55%,#0b6fa8)!important}" +
    R + ".trv-tile2.big.mg{background:linear-gradient(160deg,#ff9fd0,#ff3d9a 55%,#a3105f)!important}" +
    R + ".trv-tile2.big:before{content:'';position:absolute;left:-30%;top:0;width:40%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:taShine 3.6s ease-in-out infinite}" +
    R + ".trv-tile2.big.mg:before{animation-delay:1.8s}" +
    "@keyframes taShine{0%,60%{left:-40%}100%{left:130%}}" +
    R + ".trv-tile2.big b{font-family:Bungee,Anton,sans-serif!important;font-size:22px!important;color:#fff!important;text-shadow:0 2px 0 rgba(0,0,0,.35)}" +
    R + ".trv-tile2.big small{color:#fff!important;opacity:.95}" +
    R + ".trv-tile2.big img.ta-ic{position:absolute;right:6px;top:50%;width:92px;height:92px;margin-top:-46px;object-fit:contain;filter:drop-shadow(0 6px 8px rgba(0,0,0,.45));animation:taBob 2.8s ease-in-out infinite}" +
    R + ".trv-tile2.big.mg img.ta-ic{animation-delay:-1.4s}" +
    R + ".trv-tile2.big.ta-has .ic{display:none}" +
    "@keyframes taBob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-6px) rotate(4deg)}}" +
    /* duel screen: contestant podiums */
    R + ".trv-face{margin:6px 12px 2px;padding:10px 12px;border-radius:18px;background:linear-gradient(90deg,rgba(77,216,255,.22),rgba(8,6,20,.7) 45%,rgba(8,6,20,.7) 55%,rgba(255,61,154,.22));border:1.5px solid rgba(255,230,0,.35);box-shadow:0 8px 22px #0008}" +
    R + ".trv-face .vs{font-family:Bungee,sans-serif!important;color:#ffe600!important;text-shadow:0 0 12px #ff3d9a;animation:taVs 1.2s ease-in-out infinite alternate}" +
    "@keyframes taVs{to{transform:scale(1.18)}}" +
    R + ".trv-face .sc{font-family:Bungee,sans-serif!important;font-size:28px!important;line-height:1}" +
    /* the countdown ring: bigger and lit */
    R + ".trv-ring{background:conic-gradient(#ffe600 0 var(--d,360deg),#ff3d9a var(--d,360deg) calc(var(--d,360deg) + 2deg),#1a1440 calc(var(--d,360deg) + 2deg) 360deg)!important;box-shadow:0 0 26px rgba(255,230,0,.45),0 0 0 4px rgba(255,61,154,.25)!important}" +
    R + ".trv-ring #trvT{font-family:Bungee,sans-serif!important;color:#ffe600!important;text-shadow:0 0 12px #ff3d9a}" +
    /* the question board */
    R + ".trv-q{position:relative;padding:20px 16px!important;border-radius:20px!important;background:linear-gradient(180deg,#1c1450,#0d0a2c)!important;border:2px solid #ffe600!important;box-shadow:0 0 0 5px rgba(255,230,0,.12),0 0 26px rgba(255,61,154,.35),inset 0 0 30px rgba(77,216,255,.15)!important;flex-direction:column;justify-content:center;color:#fff!important;text-align:center;animation:taQin .45s cubic-bezier(.2,1.4,.4,1)}" +
    R + ".trv-q i{display:block;margin-bottom:6px;font:400 13px/1 Bungee,sans-serif!important;color:#ff3d9a!important;letter-spacing:.1em;font-style:normal}" +
    "@keyframes taQin{from{transform:scale(.85) rotateX(30deg);opacity:0}}" +
    /* A/B/C/D: four glossy game-show buttons */
    R + ".trv-grid{gap:10px!important}" +
    R + ".trv-opt{--c1:#ffe600;--c2:#d39e00;--ink:#2a1a00;position:relative;border:0!important;border-radius:16px!important;background:linear-gradient(180deg,var(--c1),var(--c2))!important;color:var(--ink)!important;box-shadow:0 5px 0 rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.55)!important;font-weight:700!important;transition:transform .1s,filter .2s;animation:taPop .35s cubic-bezier(.2,1.6,.4,1) both}" +
    R + ".trv-opt:nth-child(2){--c1:#7ff0ff;--c2:#16a8dc;--ink:#002433;animation-delay:.05s}" +
    R + ".trv-opt:nth-child(3){--c1:#ff8fc8;--c2:#e0287f;--ink:#3a001c;animation-delay:.1s}" +
    R + ".trv-opt:nth-child(4){--c1:#d4ff7a;--c2:#7ccf16;--ink:#142600;animation-delay:.15s}" +
    "@keyframes taPop{from{transform:scale(.6);opacity:0}}" +
    R + ".trv-opt .t{color:var(--ink)!important;font-size:17px!important}" +
    R + ".trv-opt .l>span:first-child{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(0,0,0,.78);color:var(--c1)!important;font-family:Bungee,sans-serif;font-size:14px}" +
    R + ".trv-opt:not(:disabled):active{transform:translateY(4px);box-shadow:0 1px 0 rgba(0,0,0,.4),inset 0 2px 0 rgba(255,255,255,.55)!important}" +
    R + ".trv-opt:disabled{filter:saturate(.35) brightness(.7)}" +
    R + ".trv-opt.pick{filter:none!important;animation:taPick .5s ease-in-out infinite alternate!important}" +
    "@keyframes taPick{to{box-shadow:0 5px 0 rgba(0,0,0,.4),0 0 22px var(--c1)}}" +
    R + ".trv-opt.yes{--c1:#7dffa6;--c2:#14b85a;--ink:#00290f;filter:none!important;animation:taYes .55s cubic-bezier(.2,1.8,.4,1)!important;box-shadow:0 5px 0 rgba(0,0,0,.4),0 0 26px #39ff88!important}" +
    "@keyframes taYes{40%{transform:scale(1.08)}}" +
    R + ".trv-opt.no{--c1:#ff8a8a;--c2:#d01c2c;--ink:#2e0006;filter:none!important;animation:taNo .45s ease-in-out!important}" +
    "@keyframes taNo{20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}" +
    R + ".trv-dots span.now{box-shadow:0 0 10px #ffe600}" +
    /* the 3-2-1 */
    R + ".trv-count{font-family:Bungee,sans-serif!important;color:#ffe600!important;text-shadow:0 6px 0 #b3006b,0 0 30px #ff3d9a!important;animation:taCount 1s ease-out infinite}" +
    "@keyframes taCount{0%{transform:scale(1.6);opacity:0}25%{transform:scale(1);opacity:1}100%{transform:scale(.9);opacity:.6}}" +
    /* result: the scene above the banner */
    R + ".ta-scene{width:100%;height:190px;border-radius:20px;background-size:cover;background-position:center 45%;box-shadow:0 10px 28px #000a;animation:taScene .6s cubic-bezier(.2,1.4,.4,1);position:relative}" +
    R + ".ta-scene:after{content:'';position:absolute;inset:0;border-radius:20px;background:linear-gradient(180deg,rgba(8,6,20,0) 55%,rgba(8,6,20,.7))}" +
    "@keyframes taScene{from{transform:scale(.8);opacity:0}}" +
    R + ".trv-res .w{font-family:Bungee,sans-serif!important;animation:taWin .7s cubic-bezier(.2,1.7,.4,1)}" +
    "@keyframes taWin{from{transform:scale(2);opacity:0}}" +
    /* podium header art */
    R + ".ta-podk{display:flex;align-items:center;gap:10px}" +
    R + ".ta-podk img{width:54px;height:54px;object-fit:contain;filter:drop-shadow(0 4px 5px rgba(0,0,0,.45))}" +
    R + ".trv-pr.champ{box-shadow:0 0 0 1.5px #ffe600,0 0 22px rgba(255,230,0,.35)!important}" +
    "@media (prefers-reduced-motion:reduce){" + R + "*{animation:none!important}}";
  var st = document.createElement("style"); st.id = "trvArtCSS"; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  /* cut the green out of the sticker art */
  function key(job) {
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          var W = 256, H = Math.max(1, Math.round(W * im.naturalHeight / im.naturalWidth)), c = document.createElement("canvas"); c.width = W; c.height = H;
          var g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H);
          var d = g.getImageData(0, 0, W, H), p = d.data, br = 0, bg = 0, bb = 0, n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
          [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3], [W >> 1, 2]].forEach(function (q) { var i = (q[1] * W + q[0]) * 4; br += p[i]; bg += p[i + 1]; bb += p[i + 2]; n++; });
          br /= n; bg /= n; bb /= n; var bgd = Math.max(18, bg - Math.max(br, bb));
          for (var i = 0; i < p.length; i += 4) {
            var r = p[i], gg = p[i + 1], b = p[i + 2], gd = gg - Math.max(r, b), dist = Math.sqrt((r - br) * (r - br) + (gg - bg) * (gg - bg) + (b - bb) * (b - bb));
            var a = Math.min((bgd * 0.8 - gd) / (bgd * 0.45), dist / 60); a = a < 0 ? 0 : a > 1 ? 1 : a;
            if (gd > 0) p[i + 1] = Math.max(r, b) + gd * (1 - a) * 0.3;
            p[i + 3] = Math.round(p[i + 3] * a);
            if (p[i + 3] > 60) { var px = (i >> 2) % W, py = (i >> 2) / W | 0; if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; }
          }
          g.putImageData(d, 0, 0); if (x1 <= x0) return res(null);
          var bw = x1 - x0 + 1, bh = y1 - y0 + 1, s = Math.max(bw, bh), o = document.createElement("canvas"); o.width = s; o.height = s;
          o.getContext("2d").drawImage(c, x0, y0, bw, bh, (s - bw) / 2, (s - bh) / 2, bw, bh);
          res(o.toDataURL("image/png"));
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); };
      im.src = MJ + job + "_384_N.webp";
    });
  }
  Object.keys(KEY).forEach(function (k) { key(KEY[k]).then(function (u) { if (u) { ART[k] = u; dress(); } }); });

  /* dress whatever trivia.js just drew */
  function dress() {
    var room = document.getElementById("trvRoom"); if (!room) return;
    var w = room.querySelector(".trv-wrap"); if (!w) return;
    var hl = w.querySelector(".trv-hl"), body = w.querySelector(".trv-body");
    if (hl && body && !w.querySelector(".ta-hero")) {
      var h = document.createElement("div"); h.className = "ta-hero"; h.setAttribute("aria-hidden", "true");
      h.innerHTML = "<b>DOCK TRIVIA</b><i>7 QUESTIONS · 10 SECONDS · FASTEST TAKES IT</i>";
      body.insertBefore(h, body.firstChild);
    }
    [["cy", "any"], ["mg", "call"]].forEach(function (t) {
      var b = w.querySelector(".trv-tile2.big." + t[0]);
      if (b && ART[t[1]] && !b.querySelector("img.ta-ic")) { var im = new Image(); im.className = "ta-ic"; im.alt = ""; im.src = ART[t[1]]; b.appendChild(im); b.classList.add("ta-has"); }
    });
    var pod = w.querySelector("#trvPod"), pk = pod && pod.previousElementSibling;
    if (pk && ART.pod && !pk.querySelector("img")) { pk.classList.add("ta-podk"); var pi = new Image(); pi.alt = ""; pi.src = ART.pod; pk.insertBefore(pi, pk.firstChild); }
    var res = w.querySelector(".trv-res"), ban = res && res.querySelector(".w");
    if (res && ban && !w.querySelector(".ta-scene")) {
      var won = !/\b[tl]\b/.test(ban.className), lost = /\bl\b/.test(ban.className), tie = /\bt\b/.test(ban.className) && !/RUN/.test(ban.textContent);
      var art = won ? WIN : lost ? LOSE : tie ? STAGE : null;
      if (art) { var sc = document.createElement("div"); sc.className = "ta-scene"; sc.setAttribute("aria-hidden", "true"); sc.style.backgroundImage = "url('" + MJ + art + "_640_N.webp')"; res.parentNode.insertBefore(sc, res); }
    }
  }
  var mo = new MutationObserver(function () { dress(); });
  function watch() { var r = document.getElementById("trvRoom"); if (r && !r.__ta) { r.__ta = 1; mo.observe(r, { childList: true, subtree: true }); dress(); } }
  setInterval(watch, 800); watch();
})();
