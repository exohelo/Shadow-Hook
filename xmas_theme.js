/* The Shadow Hook — xmas_theme.js (#xmas26, nov21 draft)
   The Christmas skin, Halloween-size: string lights under the header and over the menu, a night harbor of STS cranes
   wrapped in lights (one wears the star), snow caps on the cards, falling snow, a Santa hat on the crest.
   Runs only while the page is in the xmas season (html.season-xmas): the Keymaster's season preview, or the dates.
   "Decorations off" (shadowhook_decor = off) keeps the colors and drops the rest. Calm mode freezes the motion.
   Loaded by ports_ext.js so index.html doesn't change. */
(function () {
  "use strict";
  if (window.__xmasTheme) return; window.__xmasTheme = 1;
  var H = document.documentElement, ON = false, built = false, lastW = 0;
  var BULBS = ["#ff4d4f", "#3ddc84", "#ffd23f", "#4dc3ff", "#ff7ad9"];

  /* ───────── styles ───────── */
  var SNOWCAP = "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='18' viewBox='0 0 120 18'>" +
    "<path d='M0 0H120V5C112 5 110 8 104 8S97 4 90 5 84 11 80 11 76 6 70 6 62 9 56 8 50 4 44 5 38 9 33 9 28 5 22 5 16 8 11 8 5 5 0 5Z' fill='#fff'/>" +
    "<path d='M80 10.5C80.8 13.5 81.6 15 80 15.6 78.6 15 79.2 13 80 10.5ZM33 8.6C33.6 11 34 12.4 33 12.8 32 12.4 32.4 11 33 8.6ZM104 7.6C104.5 9.6 104.9 10.8 104 11.2 103.1 10.8 103.5 9.6 104 7.6Z' fill='#fff'/>" +
    "<path d='M0 5C5 5 11 8 16 8' stroke='#cfe3ff' stroke-opacity='.55' fill='none'/></svg>";
  var CSS = "" +
    /* palette: evergreen + candy red + warm gold, a little colder night */
    "html.season-xmas.xm-on{--copper:#2fae6c;--copper-hi:#a6f3c6;--ember:#e5484d;--neon:#ff5a5f;--neon2:#7ce0a0;--neon3:#ffe7a3;--neon-v:#2fae6c;--glow:0 0 12px rgba(47,174,108,.45);--glow2:0 0 14px rgba(229,72,77,.45)}" +
    "html.season-xmas.xm-on body:before{background:radial-gradient(ellipse 120% 55% at 50% -6%,rgba(120,170,255,.13),transparent 60%),radial-gradient(ellipse 90% 40% at 50% 108%,rgba(47,174,108,.10),transparent 70%)!important}" +
    "html.season-xmas.xm-on.daylight{--copper:#147a45;--copper-hi:#0f6a3b;--ember:#b3262b;--neon:#b3262b;--neon2:#147a45;--neon-v:#147a45}" +
    /* string lights */
    ".xm-lights{position:absolute;left:0;right:0;height:26px;pointer-events:none;z-index:2;overflow:visible}" +
    ".xm-lights svg{display:block;width:100%;height:26px;overflow:visible}" +
    ".xm-top{top:100%;margin-top:-3px}" +
    ".xm-nav{bottom:100%;margin-bottom:-6px}" +
    ".xm-b{animation:xmTw 2.8s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 0}" +
    ".xm-b.t1{animation-delay:-.7s}.xm-b.t2{animation-delay:-1.4s;animation-duration:3.4s}.xm-b.t3{animation-delay:-2.1s;animation-duration:2.2s}" +
    "@keyframes xmTw{0%,100%{opacity:1}45%{opacity:.35}55%{opacity:.35}}" +
    "html.daylight .xm-wire{stroke:#2d3a33}" +
    /* snow bank on the menu's top edge */
    ".xm-bank{position:absolute;left:0;right:0;bottom:100%;height:10px;margin-bottom:-2px;pointer-events:none;z-index:1;background:url(\"data:image/svg+xml," + encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='10' viewBox='0 0 160 10'><path d='M0 10V6C14 2 26 3 38 6S62 9 78 5 104 1 120 5 146 9 160 6V10Z' fill='#f4f8ff'/></svg>") + "\") repeat-x bottom/160px 10px;filter:drop-shadow(0 -1px 2px rgba(180,210,255,.35))}" +
    "html.daylight .xm-bank{filter:drop-shadow(0 -1px 1px rgba(20,40,60,.18))}" +
    /* the harbor: cranes in lights, behind everything */
    "#xmHarbor{position:absolute;left:0;right:0;top:0;bottom:0;z-index:-1;pointer-events:none;opacity:.9;overflow:hidden}" +
    "#xmHarbor svg{position:absolute;left:50%;bottom:0;transform:translateX(-50%);height:100%;width:auto;min-width:100%}" +
    "html.daylight #xmHarbor{opacity:.55}" +
    "html.season-xmas.xm-on .bpost.dp-post:before{content:\"\";position:absolute;left:-1px;right:-1px;top:-5px;height:18px;z-index:3;pointer-events:none;background:url(\"data:image/svg+xml," + encodeURIComponent(SNOWCAP) + "\") repeat-x 0 0/120px 18px!important;box-shadow:none!important;opacity:1}" +
    ".xm-cl{animation:xmChase 3.2s linear infinite}" +
    ".xm-cl.c1{animation-delay:-1.07s}.xm-cl.c2{animation-delay:-2.13s}" +
    "@keyframes xmChase{0%,100%{opacity:1}33%{opacity:.25}66%{opacity:.7}}" +
    ".xm-star{animation:xmStar 2.4s ease-in-out infinite;transform-box:fill-box;transform-origin:center}" +
    "@keyframes xmStar{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.75;transform:scale(.86)}}" +
    /* falling snow */
    "#xmSnow{position:fixed;inset:0;pointer-events:none;z-index:39;overflow:hidden}" +
    "#xmSnow i{position:absolute;top:-4vh;left:var(--x);width:var(--s);height:var(--s);border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff,rgba(255,255,255,.75) 55%,rgba(255,255,255,0));opacity:var(--o);animation:xmFall var(--d) linear var(--dl) infinite}" +
    "#xmSnow i.f{background:none;width:auto;height:auto;color:#fff;font-size:var(--s);line-height:1;text-shadow:0 0 6px rgba(200,225,255,.8)}" +
    "@keyframes xmFall{0%{transform:translate3d(0,0,0) rotate(0)}50%{transform:translate3d(var(--dx),55vh,0) rotate(180deg)}100%{transform:translate3d(0,112vh,0) rotate(360deg)}}" +
    "html.daylight #xmSnow i{background:radial-gradient(circle at 35% 35%,#fff,#dbe7f5 60%,rgba(219,231,245,0));box-shadow:0 0 2px rgba(60,90,130,.35)}" +
    "html.daylight #xmSnow i.f{color:#c9dbf0;background:none;box-shadow:none;text-shadow:0 0 2px rgba(40,70,110,.5)}" +
    /* snow caps on the cards (replaces the thin top line) */
    "html.season-xmas.xm-on .card:before,html.season-xmas.xm-on .bpost:before,html.season-xmas.xm-on .hcard:before{content:\"\";position:absolute;left:-1px;right:-1px;top:-5px;height:18px;width:auto;bottom:auto;opacity:1;z-index:3;pointer-events:none;border-radius:14px 14px 0 0;" +
    "background:url(\"data:image/svg+xml," + encodeURIComponent(SNOWCAP) + "\") repeat-x 0 0/120px 18px!important;box-shadow:none!important;filter:drop-shadow(0 1px 1px rgba(150,190,255,.25))}" +
    "html.season-xmas.xm-on .bpost,html.season-xmas.xm-on .hcard{overflow:visible}" +
    "html.season-xmas.xm-on.daylight .card:before,html.season-xmas.xm-on.daylight .bpost:before,html.season-xmas.xm-on.daylight .hcard:before{filter:drop-shadow(0 1px 1.5px rgba(30,60,100,.28))}" +
    /* santa hat on the crest */
    ".xm-hatwrap{position:relative}" +
    ".xm-hat{position:absolute;left:50%;top:-15px;width:30px;height:24px;transform:translateX(-38%) rotate(-14deg);pointer-events:none;z-index:3;filter:drop-shadow(0 2px 2px rgba(0,0,0,.45))}" +
    /* the active tab gets a little glow ring */
    "html.season-xmas.xm-on .nav button.on .ico{filter:drop-shadow(0 0 6px rgba(255,90,95,.6)) drop-shadow(0 0 10px rgba(124,224,160,.35))}" +
    /* the background picture (like November's table), tinted dark so the cards read */
    "#xmBg{position:fixed;inset:0;z-index:0;pointer-events:none;background:#06100b center/cover no-repeat}" +
    "#xmBg:after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,10,8,.58),rgba(4,10,8,.30) 38%,rgba(4,10,8,.74))}" +
    "html.season-xmas.xm-on body{background:#06100b}" +
    "html.season-xmas.xm-on .topbar{background:rgba(8,12,14,.62)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}" +
    "html.season-xmas.xm-on .nav{background:rgba(8,12,14,.66)!important;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}" +
    "html.season-xmas.xm-on.daylight body{background:#eef3ee}html.season-xmas.xm-on.daylight #xmBg{background-color:#eef3ee}" +
    "html.season-xmas.xm-on.daylight #xmBg:after{background:linear-gradient(180deg,rgba(244,248,244,.86),rgba(244,248,244,.72) 40%,rgba(244,248,244,.9))}" +
    "html.season-xmas.xm-on.daylight .topbar{background:rgba(252,252,250,.9)!important}html.season-xmas.xm-on.daylight .nav{background:rgba(252,252,250,.92)!important}" +
    "html.season-xmas.xm-on #boot{background:linear-gradient(180deg,rgba(4,10,8,.6),rgba(4,10,8,.35) 45%,rgba(4,10,8,.85)),#06100b var(--xmBoot,none) center/cover no-repeat!important}" +
    /* Midjourney art (when SHK_XMAS_ART is set): photo string lights, the harbor panorama, the Santa-hat hook icon */
    ".xm-lights.xm-img{height:46px}.xm-limg{display:block;height:46px;background-repeat:repeat-x;background-size:auto 46px;background-position:0 -2px;mix-blend-mode:screen;animation:xmGlow 3.2s ease-in-out infinite}" +
    "@keyframes xmGlow{0%,100%{filter:brightness(1.05) saturate(1.1)}50%{filter:brightness(.78) saturate(1)}}" +
    ".xm-nav.xm-img{margin-bottom:-14px}" +
    ".xm-limg.xm-off{animation:none;filter:brightness(.42) saturate(.75)}" +
    ".xm-limg.xm-on{position:absolute;left:0;right:0;top:0;-webkit-mask-repeat:repeat-x;mask-repeat:repeat-x;-webkit-mask-size:auto 46px;mask-size:auto 46px;-webkit-mask-position:0 -2px;mask-position:0 -2px;animation:xmBlink 1.7s steps(1,end) infinite}" +
    ".xm-limg.g1{animation-duration:2.3s;animation-delay:-.6s}.xm-limg.g2{animation-duration:1.9s;animation-delay:-1.3s}.xm-limg.g3{animation-duration:2.9s;animation-delay:-.2s}" +
    "@keyframes xmBlink{0%{opacity:1;filter:brightness(1.15) saturate(1.15)}55%{opacity:.08}100%{opacity:1}}" +
    "html.daylight .xm-limg.xm-off{filter:brightness(.7) saturate(.8)}" +
    "@media (prefers-reduced-motion:reduce){.xm-limg.xm-on{animation:none!important;opacity:1}}" +
    "#xmHarbor.xm-img{background-position:center 70%;background-size:cover;opacity:.62}#xmHarbor.xm-img:after{content:\"\";position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,10,14,.45),rgba(6,10,14,.15) 60%,rgba(6,10,14,.55))}" +
    "html.daylight #xmHarbor.xm-img{opacity:.35}" +
    ".xm-mjicon{position:absolute;inset:-2px;width:calc(100% + 4px);height:calc(100% + 4px);object-fit:cover;border-radius:24%;pointer-events:none;z-index:2;box-shadow:0 0 10px rgba(255,90,180,.35)}" +
    ".xm-hatwrap.xm-hasicon .xm-hat{display:none}" +
    "html.daylight .xm-limg{mix-blend-mode:normal;filter:none}" +
    /* the snowy city skyline riding on top of the menu, and Santa's occasional fly-over (Midjourney art) */
    "#xmCity{position:absolute;left:0;right:0;bottom:100%;height:118px;margin-bottom:-6px;pointer-events:none;z-index:0;background:center bottom/cover no-repeat;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 42%);mask-image:linear-gradient(180deg,transparent 0,#000 42%)}" +
    "html.daylight #xmCity{opacity:.85}" +
    "#xmSanta{position:fixed;left:0;top:20vh;width:min(25vw,124px);aspect-ratio:3/1;pointer-events:none;z-index:38;background:center/contain no-repeat;mix-blend-mode:screen;filter:brightness(1.35) saturate(1.15);opacity:0;will-change:transform}" +
    "html.daylight #xmSanta,html.calm #xmSanta,html.xm-nodecor #xmCity,html.xm-nodecor #xmSanta{display:none!important}" +
    /* no lights over the menu (Nov 21): just the skyline and the snow bank down there */
    "#xmLightsNav{display:none!important}" +
    /* white snow menu: Midjourney snow hills on its top edge and a little sled that slides with the phone's tilt */
    "html.season-xmas.xm-on.xm-snownav .nav{background:linear-gradient(180deg,#f6faff,#e4edf7)!important;border-top:0!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:0 -1px 0 rgba(255,255,255,.6)}" +
    "html.season-xmas.xm-on.xm-snownav .nav button{color:#3b4c60!important}html.season-xmas.xm-on.xm-snownav .nav button .ico{filter:none!important}" +
    "html.season-xmas.xm-on.xm-snownav .nav button.on{color:#c3262e!important}html.season-xmas.xm-on.xm-snownav .nav button.on .ico{filter:drop-shadow(0 1px 2px rgba(195,38,46,.35))!important}" +
    "html.season-xmas.xm-on.xm-snownav .nav button[data-scr=mayday]{color:#d0342b!important}" +
    "html.season-xmas.xm-on.xm-snownav .xm-bank{display:none!important}" +
    "#xmHills{position:absolute;left:0;right:0;bottom:100%;height:30px;margin-bottom:-2px;pointer-events:none;z-index:1;background-repeat:no-repeat;background-size:100% 100%,cover;background-position:0 0,center bottom}" +
    "#xmSled{position:absolute;left:0;bottom:calc(100% - 4px);width:62px;height:31px;pointer-events:none;z-index:3;background:center/contain no-repeat;mix-blend-mode:multiply;will-change:transform}" +
    "html.xm-nodecor #xmHills,html.xm-nodecor #xmSled{display:none!important}" +
    /* off switches */
    "html.xm-nodecor .xm-lights,html.xm-nodecor .xm-bank,html.xm-nodecor #xmHarbor,html.xm-nodecor #xmSnow,html.xm-nodecor .xm-hat,html.xm-nodecor .xm-mjicon{display:none!important}" +
    "html.xm-nodecor #xmBg{background-image:none!important}" +
    "html.xm-nodecor.season-xmas.xm-on .card:before,html.xm-nodecor.season-xmas.xm-on .bpost:before,html.xm-nodecor.season-xmas.xm-on .hcard:before{display:none}" +
    "html.calm #xmSnow{display:none}" +
    "@media (prefers-reduced-motion:reduce){#xmSnow{display:none}.xm-b,.xm-cl,.xm-star{animation:none!important}}" +
    "html.at-gate .xm-lights,html.at-gate #xmHarbor,html.at-gate .xm-bank{display:none}";

  /* ───────── art ───────── */
  function lightsSVG(w, flip) {
    // a wire hanging in scallops, a bulb at every dip and every crest
    var span = 46, n = Math.max(4, Math.round(w / span)), sp = w / n, d = "M0 3", bulbs = "", k = 0;
    for (var i = 0; i < n; i++) {
      var x0 = i * sp, x1 = x0 + sp, xm = x0 + sp / 2;
      d += " Q" + xm.toFixed(1) + " 15 " + x1.toFixed(1) + " 3";
      [[x0 + sp * 0.5, 9.2], [x1, 3]].forEach(function (p) {
        var c = BULBS[k % BULBS.length], cls = "xm-b t" + (k % 4);
        bulbs += "<g class='" + cls + "'><rect x='" + (p[0] - 1.6).toFixed(1) + "' y='" + (p[1] - 0.5).toFixed(1) + "' width='3.2' height='3' rx='.6' fill='#3b4a3f'/>" +
          "<ellipse cx='" + p[0].toFixed(1) + "' cy='" + (p[1] + 5.4).toFixed(1) + "' rx='2.9' ry='4.2' fill='" + c + "' style='filter:drop-shadow(0 0 3px " + c + ") drop-shadow(0 0 7px " + c + ")'/>" +
          "<ellipse cx='" + (p[0] - 0.9).toFixed(1) + "' cy='" + (p[1] + 4.2).toFixed(1) + "' rx='.8' ry='1.4' fill='#fff' fill-opacity='.7'/></g>";
        k++;
      });
    }
    var g = "<path class='xm-wire' d='" + d + "' fill='none' stroke='#1d2a22' stroke-width='1.4'/>" + bulbs;
    return "<svg viewBox='0 0 " + w.toFixed(0) + " 26' preserveAspectRatio='none' aria-hidden='true'>" + (flip ? "<g transform='translate(0 26) scale(1 -1)'>" + g + "</g>" : g) + "</svg>";
  }

  function crane(x, base, s, star, phase, br, stp) {
    // a ship-to-shore gantry crane, boom out over the water (to the right), outlined in bulbs
    var legH = 92 * s, legW = 34 * s, boomY = base - legH - 18 * s, out = 96 * s, back = 34 * s, apexH = 40 * s;
    var L = x, R = x + legW, top = base - legH, ax = x + legW * 0.55, ay = boomY - apexH;
    var stroke = "#0f1820", fill = "#16222b";
    var p = "";
    // legs + portal beams
    p += "<path d='M" + L + " " + base + "V" + top + "M" + R + " " + base + "V" + top + "' stroke='" + stroke + "' stroke-width='" + (4 * s) + "'/>";
    p += "<path d='M" + (L - 2 * s) + " " + top + "H" + (R + 2 * s) + "M" + L + " " + (top + legH * .45) + "H" + R + "' stroke='" + stroke + "' stroke-width='" + (3 * s) + "'/>";
    p += "<path d='M" + L + " " + base + "L" + R + " " + (top + legH * .45) + "M" + R + " " + base + "L" + L + " " + (top + legH * .45) + "' stroke='" + stroke + "' stroke-width='" + (1.6 * s) + "'/>";
    // boom + back reach + apex stays + house
    p += "<path d='M" + (L - back) + " " + boomY + "H" + (R + out) + "' stroke='" + stroke + "' stroke-width='" + (5 * s) + "'/>";
    p += "<path d='M" + L + " " + top + "L" + L + " " + boomY + "M" + R + " " + top + "L" + R + " " + boomY + "' stroke='" + stroke + "' stroke-width='" + (3 * s) + "'/>";
    p += "<path d='M" + ax + " " + ay + "L" + (R + out * .62) + " " + boomY + "M" + ax + " " + ay + "L" + (R + out * .98) + " " + boomY + "M" + ax + " " + ay + "L" + (L - back) + " " + boomY + "M" + ax + " " + ay + "V" + boomY + "' stroke='" + stroke + "' stroke-width='" + (1.5 * s) + "'/>";
    p += "<rect x='" + (L - back + 2 * s) + "' y='" + (boomY - 13 * s) + "' width='" + (26 * s) + "' height='" + (11 * s) + "' fill='" + fill + "'/>";
    p += "<rect x='" + (R + out * .3) + "' y='" + (boomY + 3 * s) + "' width='" + (9 * s) + "' height='" + (7 * s) + "' fill='" + fill + "'/>"; // trolley cab
    p += "<path d='M" + (R + out * .3 + 4.5 * s) + " " + (boomY + 10 * s) + "V" + (boomY + 38 * s) + "' stroke='" + stroke + "' stroke-width='" + (0.8 * s) + "'/>";
    p += "<rect x='" + (R + out * .3 - 4 * s) + "' y='" + (boomY + 38 * s) + "' width='" + (17 * s) + "' height='" + (4 * s) + "' fill='" + fill + "'/>"; // spreader
    // the bulbs: along the boom, up the stays, down the legs
    var dots = [], step = stp || 7 * s;
    function run(x1, y1, x2, y2) { var len = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.round(len / step)); for (var i = 0; i <= n; i++) dots.push([x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]); }
    run(L - back, boomY - 3 * s, R + out, boomY - 3 * s);
    run(ax, ay, R + out * .98, boomY - 3 * s);
    run(ax, ay, L - back, boomY - 3 * s);
    run(L, top, L, base - 4 * s); run(R, top, R, base - 4 * s);
    run(L, top, R, top);
    var b = "";
    dots.forEach(function (d, i) {
      var c = BULBS[(i + phase) % BULBS.length];
      b += "<circle class='xm-cl c" + ((i + phase) % 3) + "' cx='" + d[0].toFixed(1) + "' cy='" + d[1].toFixed(1) + "' r='" + (br || 1.25 * s).toFixed(2) + "' fill='" + c + "' style='filter:drop-shadow(0 0 " + ((br || s) * 2).toFixed(1) + "px " + c + ")'/>";
    });
    // red warning light on the apex, or the star
    if (star) {
      var R5 = 9 * s, r5 = 3.8 * s, sp5 = "";
      for (var j = 0; j < 10; j++) { var a = -Math.PI / 2 + j * Math.PI / 5, rr = j % 2 ? r5 : R5; sp5 += (j ? "L" : "M") + (ax + rr * Math.cos(a)).toFixed(1) + " " + (ay - 6 * s + rr * Math.sin(a)).toFixed(1); }
      b += "<path class='xm-star' d='" + sp5 + "Z' fill='#ffe27a' style='filter:drop-shadow(0 0 4px #ffd23f) drop-shadow(0 0 12px #ffb000)'/>";
    } else {
      b += "<circle cx='" + ax + "' cy='" + (ay - 1) + "' r='" + (1.8 * s) + "' fill='#ff3b30' style='filter:drop-shadow(0 0 4px #ff3b30)'/>";
    }
    return "<g fill='none' stroke-linecap='round'>" + p + "</g>" + b;
  }

  function harborSVG() {
    // a skyline of lit cranes behind the header: two on each side, the middle left open for the countdown
    var W = 520, Hh = 66, base = 66, g = "";
    g += "<path d='M0 " + (base - 6) + " C80 " + (base - 12) + " 160 " + (base - 8) + " 260 " + (base - 11) + " S440 " + (base - 7) + " 520 " + (base - 10) + "V" + base + "H0Z' fill='#0e1922'/>";
    g += crane(36, base, 0.4, false, 0, 1.15, 4.6);
    g += crane(118, base, 0.47, true, 2, 1.2, 4.6);
    g += crane(352, base, 0.44, false, 1, 1.15, 4.6);
    g += crane(436, base, 0.38, false, 3, 1.1, 4.6);
    return "<svg viewBox='0 0 " + W + " " + Hh + "' preserveAspectRatio='xMidYMax slice' aria-hidden='true'>" + g + "</svg>";
  }

  // the photo lights: a dim copy underneath (bulbs "off"), then four bright copies, each showing every 4th bulb through
  // a mask and blinking on its own beat, so the bulbs flash one by one instead of the whole string pulsing
  function lightsImg(A) {
    var bg = "background-image:url(\"" + A.lights + "\")", spots = A.spots || [], iw = A.w || 2688, ih = A.h || 448, h = "<i class='xm-limg xm-off' style='" + bg + "'></i>";
    if (!spots.length) return h.replace(" xm-off", "");
    for (var g = 0; g < 4; g++) {
      var r = "";
      spots.forEach(function (c, i) { if (i % 4 === g) r += "<rect x='" + Math.round(c * iw - iw * 0.045) + "' y='0' width='" + Math.round(iw * 0.09) + "' height='" + ih + "' fill='#fff'/>"; });
      var m = "url(\"data:image/svg+xml," + encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='" + iw + "' height='" + ih + "'>" + r + "</svg>").replace(/'/g, "%27") + "\")";
      h += "<i class='xm-limg xm-on g" + g + "' style='" + bg + ";-webkit-mask-image:" + m + ";mask-image:" + m + "'></i>";
    }
    return h;
  }

  var HAT = "<svg class='xm-hat' viewBox='0 0 30 24' aria-hidden='true'><path d='M4 19C6 10 12 3 20 3c4 0 7 3 6 8-2-2-4-3-6-2-3 2-4 6-5 10Z' fill='#d7263d'/><path d='M4 19C6 10 12 3 20 3' stroke='#9e1b2c' stroke-width='1' fill='none'/>" +
    "<rect x='1.5' y='17' width='17' height='6' rx='3' fill='#f4f6fb'/><circle cx='26.5' cy='12' r='3.3' fill='#f4f6fb'/></svg>";

  /* ───────── build / tear down ───────── */
  function flakes() {
    var w = window.innerWidth || 390, n = w < 380 ? 22 : 32, h = "";
    try { if (/iPhone|iPad|iPod/.test(navigator.userAgent || "")) n = Math.round(n * 0.75); } catch (e) {}
    for (var i = 0; i < n; i++) {
      var big = Math.random() < 0.22, s = big ? (10 + Math.random() * 8) : (2.5 + Math.random() * 4.5);
      h += "<i class='" + (big ? "f" : "") + "' style='--x:" + (Math.random() * 100).toFixed(1) + "%;--s:" + s.toFixed(1) + "px;--d:" + (big ? 13 + Math.random() * 9 : 8 + Math.random() * 9).toFixed(1) + "s;--dl:-" + (Math.random() * 20).toFixed(1) + "s;--dx:" + (Math.random() * 14 - 7).toFixed(1) + "vw;--o:" + (big ? 0.55 + Math.random() * 0.3 : 0.5 + Math.random() * 0.45).toFixed(2) + "'>" + (big ? "❄" : "") + "</i>";
    }
    return h;
  }
  function el(id, cls, html) { var e = document.getElementById(id); if (!e) { e = document.createElement("div"); e.id = id; } if (cls) e.className = cls; if (html != null) e.innerHTML = html; e.setAttribute("aria-hidden", "true"); return e; }
  function build() {
    var tb = document.querySelector(".topbar"), nav = document.querySelector("nav.nav"), w = window.innerWidth || 390;
    var ART = window.SHK_XMAS_ART || {};
    var LH = ART.lights ? lightsImg(ART) : null;
    if (tb) { var t = el("xmLightsTop", "xm-lights xm-top" + (LH ? " xm-img" : ""), LH || lightsSVG(w, false)); if (t.parentNode !== tb) tb.appendChild(t); }
    if (nav) {
      var nb = el("xmBank", "xm-bank", ""); if (nb.parentNode !== nav) nav.appendChild(nb);
      var nl = el("xmLightsNav", "xm-lights xm-nav" + (LH ? " xm-img" : ""), LH || lightsSVG(w, false)); if (nl.parentNode !== nav) nav.appendChild(nl);
    }
    if (tb) {
      var hb = el("xmHarbor", ART.header ? "xm-img" : "", ART.header ? "" : (document.getElementById("xmHarbor") ? null : harborSVG()));
      if (ART.header) hb.style.backgroundImage = "url(\"" + ART.header + "\")";
      if (hb.parentNode !== tb) tb.insertBefore(hb, tb.firstChild);
    }
    if (!document.getElementById("xmSnow")) document.body.appendChild(el("xmSnow", "", flakes()));
    var bg = document.getElementById("xmBg"); if (!bg) { bg = el("xmBg", "", ""); document.body.insertBefore(bg, document.body.firstChild); }
    setBg(window.SHK_XMAS_BG || "xmas-bg.jpg");
    var crest = document.querySelector(".hc-left .sc-ribbon") || document.querySelector(".hcrest");
    if (crest && !crest.querySelector(".xm-hat")) { crest.classList.add("xm-hatwrap"); crest.insertAdjacentHTML("beforeend", HAT); }
    if (crest && ART.crest && !crest.querySelector(".xm-mjicon")) { crest.classList.add("xm-hasicon"); crest.insertAdjacentHTML("beforeend", "<img class='xm-mjicon' alt='' src='" + ART.crest + "'>"); }
    if (nav && ART.city) { var cy = el("xmCity", "", ""); cy.style.backgroundImage = "url(\"" + ART.city + "\")"; if (cy.parentNode !== nav) nav.insertBefore(cy, nav.firstChild); }
    if (ART.santa && !document.getElementById("xmSanta")) { var sa = el("xmSanta", "", ""); sa.style.backgroundImage = "url(\"" + ART.santa + "\")"; document.body.appendChild(sa); santaLoop(); }
    H.classList.toggle("xm-snownav", !!ART.hills);
    if (nav && ART.hills) { var hl = el("xmHills", "", ""); if (hl.parentNode !== nav) nav.insertBefore(hl, document.getElementById("xmCity") ? document.getElementById("xmCity").nextSibling : nav.firstChild); hillsArt(ART.hills, hl); }
    if (nav && ART.sled) { var sd = el("xmSled", "", ""); sd.style.backgroundImage = "url(\"" + ART.sled + "\")"; if (sd.parentNode !== nav) nav.appendChild(sd); sledStart(); }
    // the app's still mode (theme_switch.js) stops every endless animation unless it sits under [data-keep-motion]: the lights may blink
    ["xmLightsTop", "xmLightsNav"].forEach(function (id) { var e = document.getElementById(id); if (e) e.setAttribute("data-keep-motion", ""); });
    built = true; lastW = w;
  }
  function wipe() {
    ["xmLightsTop", "xmLightsNav", "xmBank", "xmHarbor", "xmSnow", "xmBg", "xmCity", "xmSanta", "xmHills", "xmSled"].forEach(function (id) { var e = document.getElementById(id); if (e && e.parentNode) e.parentNode.removeChild(e); });
    document.querySelectorAll(".xm-hat,.xm-mjicon").forEach(function (e) { e.remove(); });
    document.querySelectorAll(".xm-hasicon").forEach(function (e) { e.classList.remove("xm-hasicon"); });
    built = false;
  }
  // Santa crosses the sky now and then: a one-shot animation (the app's still mode only stops endless loops)
  var santaT = 0;
  function santa(force) {
    var s = document.getElementById("xmSanta"); if (!s || !s.animate) return;
    if (!force && (document.hidden || H.classList.contains("daylight") || H.classList.contains("calm") || document.querySelector(".sheet.on"))) return;
    try { if (!force && window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) {}
    // just above the rooftops of the skyline that rides on the menu
    var nav = document.querySelector("nav.nav"), city = document.getElementById("xmCity"), sh = s.offsetHeight || 57;
    var roof = nav ? nav.getBoundingClientRect().top - (city ? city.offsetHeight - 6 : 0) : window.innerHeight * 0.75;
    s.style.top = Math.max(60, Math.round(roof - sh * 0.55 + Math.random() * 14)) + "px";
    s.animate([
      { transform: "translate(105vw,6px) rotate(2deg)", opacity: 0 },
      { opacity: 1, offset: 0.08 },
      { transform: "translate(35vw,-6px) rotate(3deg)", offset: 0.5 },
      { opacity: 1, offset: 0.9 },
      { transform: "translate(-45vw,-18px) rotate(5deg)", opacity: 0 }
    ], { duration: 9500, easing: "linear" });
  }
  function santaLoop() { clearTimeout(santaT); santaT = setTimeout(function () { if (ON) { santa(); santaLoop(); } }, (window.SHK_XMAS_TEST ? 25 : 80) * 1000 + Math.random() * 40000); setTimeout(function () { if (ON) santa(); }, 6000); santaLoop = function () { clearTimeout(santaT); santaT = setTimeout(function () { if (ON) { santa(); santaLoop(); } }, (window.SHK_XMAS_TEST ? 25 : 80) * 1000 + Math.random() * 40000); }; }
  // the hills art comes on a black sky: turn the black clear (by brightness) so the snow sits solid over the town,
  // then fade its foot into the menu's white
  var hillsURL = {};
  function hillsArt(src, hl) {
    function put(u) { hl.style.backgroundImage = "linear-gradient(180deg,rgba(246,250,255,0) 62%,#f6faff 100%),url(\"" + u + "\")"; }
    if (hillsURL[src]) return put(hillsURL[src]);
    try {
      fetch(src).then(function (r) { return r.blob(); }).then(createImageBitmap).then(function (bm) {
        var W = 1600, Hh = Math.round(bm.height * W / bm.width), c = document.createElement("canvas"); c.width = W; c.height = Hh;
        var g = c.getContext("2d"); g.drawImage(bm, 0, 0, W, Hh); var id = g.getImageData(0, 0, W, Hh), d = id.data;
        for (var i = 0; i < d.length; i += 4) { var l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255; d[i + 3] = Math.round(Math.max(0, Math.min(1, (l - 0.10) / 0.18)) * 255); }
        g.putImageData(id, 0, 0);
        c.toBlob(function (b) { if (!b) return; hillsURL[src] = URL.createObjectURL(b); var h2 = document.getElementById("xmHills"); if (h2) put(hillsURL[src]); }, "image/png");
      }).catch(function () {});
    } catch (e) {}
  }
  // the sled: tilt the phone and it slides along the snow; with no tilt (computers, or motion not allowed) it drifts on its own
  var sl = { on: false, x: -1, v: 0, g: null, last: 0, raf: 0, asked: false };
  function sledTilt(e) { if (e && e.gamma != null) sl.g = e.gamma; }
  function sledAsk() {
    if (sl.asked) return; sl.asked = true;
    var D = window.DeviceOrientationEvent;
    try {
      if (D && typeof D.requestPermission === "function") D.requestPermission().then(function (r) { if (r === "granted") window.addEventListener("deviceorientation", sledTilt, { passive: true }); }).catch(function () {});
      else if (D) window.addEventListener("deviceorientation", sledTilt, { passive: true });
    } catch (e) {}
  }
  function sledStep(ts) {
    sl.raf = 0;
    var s = document.getElementById("xmSled"), nav = s && s.parentNode;
    if (!s || !ON || document.hidden) { sl.on = false; return; }
    if (sl.last && ts - sl.last < 30) { sl.raf = requestAnimationFrame(sledStep); return; }
    var dt = sl.last ? Math.min(0.05, (ts - sl.last) / 1000) : 0; sl.last = ts;
    var W = nav.clientWidth || window.innerWidth, sw = s.offsetWidth || 62, max = Math.max(0, W - sw);
    if (sl.x < 0) sl.x = max * 0.62;
    var calm = H.classList.contains("calm"), acc;
    if (sl.g != null) acc = Math.max(-35, Math.min(35, sl.g)) * 34;              // tilt right, it slides right
    else acc = calm ? 0 : Math.sin(ts / 2600) * 60;                             // idle drift
    sl.v = (sl.v + acc * dt) * Math.pow(0.35, dt);                              // snow friction
    sl.x += sl.v * dt;
    if (sl.x < 0) { sl.x = 0; sl.v = -sl.v * 0.3; } else if (sl.x > max) { sl.x = max; sl.v = -sl.v * 0.3; }
    var face = sl.v > 4 ? -1 : (sl.v < -4 ? 1 : (s._face || 1)); s._face = face;    // the art faces left; flip when it goes right
    var tilt = Math.max(-7, Math.min(7, sl.v * 0.03));
    s.style.transform = "translateX(" + sl.x.toFixed(1) + "px) rotate(" + (tilt * -face).toFixed(1) + "deg) scaleX(" + face + ")";
    sl.raf = requestAnimationFrame(sledStep);
  }
  function sledStart() {
    if (!sl.bound) {
      sl.bound = true;
      ["pointerdown", "touchstart"].forEach(function (ev) { document.addEventListener(ev, sledAsk, { passive: true, once: true }); });
      document.addEventListener("visibilitychange", function () { if (!document.hidden && ON && !sl.raf) { sl.last = 0; sl.raf = requestAnimationFrame(sledStep); } });
    }
    if (!sl.raf) { sl.last = 0; sl.raf = requestAnimationFrame(sledStep); }
  }
  function setBg(url) {
    window.SHK_XMAS_BG = url;
    var bg = document.getElementById("xmBg"); if (bg) bg.style.backgroundImage = url ? "url(\"" + url + "\")" : "none";
    H.style.setProperty("--xmBoot", url ? "url(\"" + url + "\")" : "none");
  }
  function decorOff() { try { return localStorage.getItem("shadowhook_decor") === "off"; } catch (e) { return false; } }
  function sync() {
    var want = H.classList.contains("season-xmas");
    H.classList.toggle("xm-nodecor", want && decorOff());
    if (want && !ON) { ON = true; H.classList.add("xm-on"); build(); }
    else if (!want && ON) { ON = false; H.classList.remove("xm-on"); wipe(); }
    else if (want && built) {
      // the header / menu may have been redrawn
      if (!document.getElementById("xmLightsTop") || !document.getElementById("xmLightsNav") || !document.querySelector(".xm-hat")) build();
    }
  }
  var st = document.createElement("style"); st.id = "xmasThemeCSS"; st.textContent = CSS; (document.head || H).appendChild(st);
  new MutationObserver(sync).observe(H, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("resize", function () { if (ON && Math.abs((window.innerWidth || 0) - lastW) > 40) { wipe(); build(); } });
  window.addEventListener("storage", function (e) { if (e.key === "shadowhook_decor") sync(); });
  function start() { sync(); setTimeout(sync, 1500); setTimeout(sync, 5000); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
  window.xmasTheme = { santa: function () { santa(true); }, setBg: setBg, sync: sync, rebuild: function () { wipe(); if (ON) build(); } };
})();
