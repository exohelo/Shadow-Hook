/* messy_avatar.js — #messyav(nov24). Build your own Messy look: skin, hair, face hair, eyes, mouth, hard hat or beanie,
   hi-vis vest or hoodie, a chain or a teardrop tat, the neon ring. A member asked for it ("people like fixing them up").
     · door page: a YOUR LOOK card under YOUR CARD, with EDIT → the builder (live preview, 🎲 random, SAVE)
     · on a date: your look and theirs replace the two letter hexes at the top. It rides inside the sealed "hi"
       (dates.js sends MESSY_AV.code()), so the relay never sees it either — same as the chat.
   The look is a short code ("1.3.5.0.2…"), kept on the phone and in user_kv (shadowhook_messy_av) so it follows you to
   a new phone. It's drawn here as SVG; nothing is uploaded and no photo is ever involved. Loaded by ports_ext.js. */
(function () {
  "use strict";
  if (window.MESSY_AV) return;
  var KV = "shadowhook_messy_av", LS = "shk_messy_av", NEON = "#ff3d9a", VIOLET = "#b56cff";

  /* ───────── parts ───────── */
  var RING = ["#ff3d9a", "#b56cff", "#ffe600", "#2ee6d6", "#ff7a1a", "#4f8cff", "#39ff88", "#ffffff"];
  var SKIN = ["#f6d2b8", "#eab894", "#d39a6a", "#b97b4b", "#8d5a34", "#6a3f22", "#4a2a16"];
  var HAIRC = ["#1b1414", "#3b2416", "#6b4423", "#d8b25a", "#a8401f", "#a3a3a3", "#ff4fa3", "#3d7bff"];
  var TOPC = ["#ff7a1a", "#d7ff2e", "#ff3d9a", "#ffe600", "#2ee6d6", "#4f8cff", "#b56cff", "#2b2b2b", "#f2f2f2", "#2f6b3a", "#8b1d2c"];
  var F = [ /* field: [key, label, count, kind] — order is the code order; never reorder, only append */
    ["ring", "GLOW", RING.length, "c"], ["skin", "SKIN", SKIN.length, "c"],
    ["hair", "HAIR", 10, "s"], ["hairc", "HAIR COLOR", HAIRC.length, "c"],
    ["fhair", "FACE HAIR", 5, "s"], ["eyes", "EYES", 5, "s"], ["mouth", "MOUTH", 5, "s"],
    ["hat", "HAT", 7, "s"], ["top", "TOP", 5, "s"], ["topc", "TOP COLOR", TOPC.length, "c"], ["extra", "EXTRA", 7, "s"]
  ];
  var NAMES = {
    hair: ["Bald", "Buzz", "Short", "Flat top", "Afro", "Long", "Bun", "Braids", "Mohawk", "Ponytail"],
    fhair: ["None", "Stubble", "Mustache", "Goatee", "Beard"],
    eyes: ["Open", "Happy", "Wink", "Sleepy", "Shades"],
    mouth: ["Smile", "Grin", "Smirk", "Straight", "Tongue"],
    hat: ["None", "Hard hat", "White hat", "Orange hat", "Beanie", "Cap", "Cap back"],
    top: ["Hi-vis vest", "Hoodie", "Flannel", "Tee", "Tank"],
    extra: ["None", "Earring", "Chain", "Glasses", "Teardrop", "Freckles", "Bandana"]
  };

  function clampCode(a) { var o = {}; F.forEach(function (f, i) { var n = parseInt(a[i], 10); o[f[0]] = isNaN(n) || n < 0 || n >= f[2] ? 0 : n; }); return o; }
  function parse(code) { if (!code || !/^[0-9.]+$/.test(String(code))) return null; return clampCode(String(code).split(".")); }
  function enc(o) { return F.map(function (f) { return o[f[0]] | 0; }).join("."); }
  function rnd() { var o = {}; F.forEach(function (f) { o[f[0]] = Math.floor(Math.random() * f[2]); });
    if (Math.random() < .5) o.hat = 0; if (Math.random() < .45) o.extra = 0; if (Math.random() < .35) o.fhair = 0; return o; }
  function shade(hex, k) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
    function c(v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); }
    return "#" + ((1 << 24) + (c(r) << 16) + (c(g) << 8) + c(b)).toString(16).slice(1); }

  var uid = 0;
  /* ───────── the drawing (viewBox 0 0 100 100) ───────── */
  function svg(o, px) {
    o = o || DEF; var id = "mav" + (++uid);
    var sk = SKIN[o.skin], skD = shade(sk, -.18), hc = HAIRC[o.hairc], hcD = shade(hc, -.25), tc = TOPC[o.topc], ring = RING[o.ring];
    var s = [];
    s.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="' + px + '" height="' + px + '" aria-hidden="true" style="display:block">');
    s.push('<defs><clipPath id="' + id + '"><circle cx="50" cy="50" r="46"/></clipPath></defs>');
    s.push('<circle cx="50" cy="50" r="48" fill="#140a12" stroke="' + ring + '" stroke-width="3.5"/>');
    s.push('<g clip-path="url(#' + id + ')">');
    s.push('<circle cx="50" cy="38" r="34" fill="' + ring + '" opacity=".13"/>');
    /* hair that hangs behind the head */
    if (o.hair === 5) s.push('<path d="M27 44 C25 18 75 18 73 44 L77 80 Q50 88 23 80Z" fill="' + hc + '"/>');
    if (o.hair === 7) s.push('<g fill="' + hc + '"><rect x="24" y="40" width="8" height="46" rx="4"/><rect x="68" y="40" width="8" height="46" rx="4"/></g><g stroke="' + hcD + '" stroke-width="1.2">' +
      [48, 56, 64, 72, 80].map(function (y) { return '<path d="M24 ' + y + 'h8M68 ' + y + 'h8"/>'; }).join("") + "</g>");
    if (o.hair === 9) s.push('<path d="M66 34 Q86 40 80 66 Q76 76 72 66 Q76 50 64 42Z" fill="' + hc + '"/>');
    /* body + top */
    var torso = "M12 102 C14 80 30 72 50 72 C70 72 86 80 88 102Z";
    s.push('<rect x="42" y="58" width="16" height="18" rx="5" fill="' + skD + '"/>');
    if (o.top === 0) { /* hi-vis vest over a dark shirt */
      s.push('<path d="' + torso + '" fill="#2b2b2b"/>');
      s.push('<path d="M16 102 C17 84 28 76 40 74 L50 92 L60 74 C72 76 83 84 84 102Z" fill="' + tc + '"/>');
      s.push('<g fill="#e9eef2" opacity=".95"><path d="M18 88 L44 88 L47 94 L17 94Z"/><path d="M82 88 L56 88 L53 94 L83 94Z"/></g>');
    } else if (o.top === 1) { /* hoodie */
      s.push('<path d="' + torso + '" fill="' + tc + '"/>');
      s.push('<path d="M30 76 Q50 64 70 76 Q62 86 50 86 Q38 86 30 76Z" fill="' + shade(tc, -.22) + '"/>');
      s.push('<g stroke="#f2f2f2" stroke-width="1.4" stroke-linecap="round"><path d="M45 84 V96"/><path d="M55 84 V96"/></g>');
    } else if (o.top === 2) { /* flannel */
      s.push('<path d="' + torso + '" fill="' + tc + '"/>');
      s.push('<g stroke="' + shade(tc, -.38) + '" stroke-width="2.4" opacity=".7">' + [20, 32, 44, 56, 68, 80].map(function (x) { return '<path d="M' + x + ' 72 V102"/>'; }).join("") + [82, 92].map(function (y) { return '<path d="M10 ' + y + ' H90"/>'; }).join("") + "</g>");
      s.push('<path d="M40 73 L50 86 L60 73" fill="none" stroke="' + shade(tc, -.45) + '" stroke-width="2"/>');
    } else if (o.top === 3) { /* tee */
      s.push('<path d="' + torso + '" fill="' + tc + '"/>');
      s.push('<path d="M41 73 Q50 82 59 73" fill="' + skD + '"/>');
    } else { /* tank */
      s.push('<path d="' + torso + '" fill="' + sk + '"/>');
      s.push('<path d="M30 102 L33 78 Q38 76 40 80 Q50 90 60 80 Q62 76 67 78 L70 102Z" fill="' + tc + '"/>');
    }
    if (o.extra === 6) s.push('<path d="M36 72 Q50 86 64 72 L58 84 Q50 90 42 84Z" fill="' + RING[(o.ring + 2) % RING.length] + '"/>');
    if (o.extra === 2) s.push('<path d="M38 74 Q50 92 62 74" fill="none" stroke="#f5c542" stroke-width="2.2" stroke-dasharray="2.4 1.2"/><circle cx="50" cy="86" r="2.6" fill="#f5c542"/>');
    /* head */
    s.push('<circle cx="30" cy="47" r="4.5" fill="' + skD + '"/><circle cx="70" cy="47" r="4.5" fill="' + skD + '"/>');
    s.push('<ellipse cx="50" cy="45" rx="20" ry="23" fill="' + sk + '"/>');
    if (o.extra === 1) s.push('<circle cx="29" cy="52" r="1.8" fill="#f5c542"/><circle cx="71" cy="52" r="1.8" fill="#f5c542"/>');
    /* face hair under the mouth */
    if (o.fhair === 1) s.push('<path d="M31 48 Q32 68 50 68 Q68 68 69 48 Q66 62 50 63 Q34 62 31 48Z" fill="' + hc + '" opacity=".28"/>');
    if (o.fhair === 4) s.push('<path d="M30 44 Q29 74 50 75 Q71 74 70 44 Q68 60 60 62 Q50 57 40 62 Q32 60 30 44Z" fill="' + hc + '"/>');
    if (o.fhair === 3) s.push('<path d="M44 62 Q50 72 56 62 Q50 65 44 62Z" fill="' + hc + '"/>');
    /* mouth */
    var m = o.mouth;
    if (m === 0) s.push('<path d="M44 58 Q50 63 56 58" fill="none" stroke="#5a2a22" stroke-width="1.8" stroke-linecap="round"/>');
    if (m === 1 || m === 4) s.push('<path d="M43 57 Q50 66 57 57Z" fill="#fff" stroke="#5a2a22" stroke-width="1.4" stroke-linejoin="round"/>');
    if (m === 4) s.push('<ellipse cx="52" cy="62" rx="3" ry="2.4" fill="#ff6b8a"/>');
    if (m === 2) s.push('<path d="M45 59 Q52 61 57 56" fill="none" stroke="#5a2a22" stroke-width="1.8" stroke-linecap="round"/>');
    if (m === 3) s.push('<path d="M45 59 H55" stroke="#5a2a22" stroke-width="1.8" stroke-linecap="round"/>');
    if (o.fhair === 2 || o.fhair === 3) s.push('<path d="M42 56 Q46 52 50 54 Q54 52 58 56 Q54 55.5 50 56.5 Q46 55.5 42 56Z" fill="' + hc + '"/>');
    /* nose */
    s.push('<path d="M50 48 Q47.5 53 50.5 54" fill="none" stroke="' + skD + '" stroke-width="1.5" stroke-linecap="round"/>');
    /* eyes */
    var e = o.eyes, ey = 46;
    function open(x) { return '<ellipse cx="' + x + '" cy="' + ey + '" rx="3.4" ry="2.7" fill="#fff"/><circle cx="' + (x + .4) + '" cy="' + ey + '" r="1.7" fill="#1b1414"/>'; }
    function arc(x) { return '<path d="M' + (x - 3.4) + ' ' + (ey + 1) + ' Q' + x + ' ' + (ey - 3) + ' ' + (x + 3.4) + ' ' + (ey + 1) + '" fill="none" stroke="#1b1414" stroke-width="1.7" stroke-linecap="round"/>'; }
    if (e === 0) s.push(open(42) + open(58));
    if (e === 1) s.push(arc(42) + arc(58));
    if (e === 2) s.push(open(42) + arc(58));
    if (e === 3) s.push(open(42) + open(58) + '<g fill="' + sk + '"><rect x="38" y="42.6" width="8" height="3.4"/><rect x="54" y="42.6" width="8" height="3.4"/></g><g stroke="' + skD + '" stroke-width="1.3"><path d="M38.4 46 H45.6"/><path d="M54.4 46 H61.6"/></g>');
    if (e === 4) s.push('<g fill="#0d0d12"><rect x="34" y="42" width="14" height="8" rx="3"/><rect x="52" y="42" width="14" height="8" rx="3"/></g><path d="M48 44.5 H52" stroke="#0d0d12" stroke-width="1.6"/><path d="M36 44 L40 44" stroke="' + ring + '" stroke-width="1.3" opacity=".9"/><path d="M54 44 L58 44" stroke="' + ring + '" stroke-width="1.3" opacity=".9"/>');
    /* brows */
    if (e !== 4) s.push('<g stroke="' + (o.hair === 0 ? skD : hcD) + '" stroke-width="1.9" stroke-linecap="round"><path d="M38.5 40.5 Q42 38.8 45.5 40"/><path d="M54.5 40 Q58 38.8 61.5 40.5"/></g>');
    if (o.extra === 4) s.push('<path d="M61 51 Q59.6 53.4 61 54.4 Q62.4 53.4 61 51Z" fill="#1b2a4a"/>');
    if (o.extra === 5) s.push('<g fill="' + shade(sk, -.32) + '">' + [[40, 52], [43, 53.5], [37.5, 54], [60, 52], [57, 53.5], [62.5, 54]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r=".9"/>'; }).join("") + "</g>");
    if (o.extra === 3 && e !== 4) s.push('<g fill="none" stroke="#e8e0d0" stroke-width="1.5"><circle cx="42" cy="46" r="5.4"/><circle cx="58" cy="46" r="5.4"/><path d="M47.4 45.6 Q50 44.4 52.6 45.6"/></g>');
    /* hair on top */
    var h = o.hair, top = "";
    if (h === 1) top = '<path d="M30 42 C29 21 71 21 70 42 C66 31 34 31 30 42Z" fill="' + hc + '" opacity=".75"/>';
    if (h === 2 || h === 6 || h === 7 || h === 9) top = '<path d="M29 44 C26 18 74 18 71 44 C69 33 60 27 50 30 C40 27 31 33 29 44Z" fill="' + hc + '"/>';
    if (h === 3) top = '<path d="M30 38 L30 24 Q50 16 70 24 L70 38 Q50 30 30 38Z" fill="' + hc + '"/>';
    if (h === 4) top = '<g fill="' + hc + '"><circle cx="30" cy="38" r="8"/><circle cx="70" cy="38" r="8"/><ellipse cx="50" cy="26" rx="28" ry="17"/><circle cx="34" cy="24" r="9"/><circle cx="66" cy="24" r="9"/><circle cx="50" cy="15" r="10"/></g>';
    if (h === 5) top = '<path d="M29 43 C28 19 72 19 71 43 C66 30 56 27 46 30 C40 33 34 36 29 43Z" fill="' + hc + '"/>';
    if (h === 8) top = '<path d="M30 42 C29 23 71 23 70 42 C66 32 34 32 30 42Z" fill="' + hc + '" opacity=".35"/><path d="M44 36 Q46 10 50 6 Q54 10 56 36 Q50 32 44 36Z" fill="' + hc + '"/>';
    if (h === 6) top += '<circle cx="50" cy="16" r="9" fill="' + hc + '"/>';
    s.push(top);
    /* hats */
    var hat = o.hat;
    if (hat >= 1 && hat <= 3) { var hh = ["", "#ffd31a", "#f4f4f4", "#ff7a1a"][hat];
      s.push('<path d="M27 38 Q27 13 50 13 Q73 13 73 38Z" fill="' + hh + '"/><path d="M47 14 Q50 12 53 14 L53 37 L47 37Z" fill="' + shade(hh, -.12) + '"/>' +
        '<path d="M20 36 H80 Q84 36 84 39.5 Q84 43 80 43 H20 Q16 43 16 39.5 Q16 36 20 36Z" fill="' + shade(hh, -.06) + '"/>'); }
    if (hat === 4) s.push('<path d="M28 40 Q28 15 50 15 Q72 15 72 40Z" fill="' + RING[(o.ring + 5) % RING.length] + '"/><rect x="27" y="34" width="46" height="9" rx="3" fill="' + shade(RING[(o.ring + 5) % RING.length], -.25) + '"/><circle cx="50" cy="13" r="5" fill="#f2f2f2"/>');
    if (hat === 5 || hat === 6) { var cc = shade(tc, -.1);
      s.push('<path d="M28 38 Q28 17 50 17 Q72 17 72 38Z" fill="' + cc + '"/><circle cx="50" cy="18" r="1.8" fill="' + shade(cc, -.3) + '"/>');
      if (hat === 5) s.push('<path d="M26 37 Q50 47 74 37 Q50 42 26 37Z" fill="' + shade(cc, -.3) + '"/>');
      else s.push('<path d="M44 33 H56 V38 H44Z" fill="' + shade(cc, -.35) + '"/>'); }
    s.push("</g></svg>");
    return s.join("");
  }

  /* ───────── storage ───────── */
  var DEF = parse("0.2.2.0.0.0.0.0.0.0.0");
  var MINE = null;
  try { MINE = parse(localStorage.getItem(LS)); } catch (e) {}
  function sb() { return window.SB; }
  function pull() {
    try { var u = window.__shkUid; if (!sb() || !u) return;
      sb().from("user_kv").select("v").eq("owner", u).eq("k", KV).maybeSingle().then(function (r) {
        var v = r && r.data && parse(r.data.v); if (v && enc(v) !== (MINE && enc(MINE))) { MINE = v; try { localStorage.setItem(LS, enc(v)); } catch (e) {} paintDoor(); }
      }, function () {});
    } catch (e) {}
  }
  function save(o) {
    MINE = o; var c = enc(o); try { localStorage.setItem(LS, c); } catch (e) {}
    try { var u = window.__shkUid; if (sb() && u) return sb().from("user_kv").upsert({ owner: u, k: KV, v: c, updated_at: new Date().toISOString() }, { onConflict: "owner,k" }); } catch (e) {}
    return Promise.resolve();
  }

  /* ───────── styles ───────── */
  function css() {
    if (document.getElementById("mavCss")) return;
    var st = document.createElement("style"); st.id = "mavCss";
    st.textContent =
      ".hex.mav-on{background:none!important;width:46px!important;height:46px!important;clip-path:none!important;border-radius:50%;overflow:hidden;padding:0!important;font-size:0!important}" +
      "#mavDoor .mav-pv{width:56px;height:56px;flex:none}" +
      "#mavSheet{position:fixed;inset:0;z-index:2147483000;background:#000b;display:flex;align-items:flex-end;justify-content:center}" +
      "#mavSheet .mav-p{width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#0e0710;border:2px solid " + NEON + ";border-bottom:0;border-radius:22px 22px 0 0;box-shadow:0 0 30px #ff3d9a55;padding:14px 14px calc(env(safe-area-inset-bottom) + 16px);color:#f3e9ee;font-family:'Barlow Condensed',Inter,system-ui,sans-serif}" +
      "#mavSheet .mav-hd{display:flex;align-items:center;gap:8px;font:400 20px/1 Anton,sans-serif;letter-spacing:.08em;color:" + NEON + ";text-shadow:0 0 8px #ff3d9a88}" +
      "#mavSheet .mav-hd button{margin-left:auto;background:none;border:0;color:#8f979e;font-size:22px;cursor:pointer}" +
      "#mavSheet .mav-big{display:flex;justify-content:center;margin:10px 0 8px}" +
      "#mavSheet .mav-cats{display:flex;gap:6px;overflow-x:auto;padding:4px 0 10px;scrollbar-width:none}#mavSheet .mav-cats::-webkit-scrollbar{display:none}" +
      "#mavSheet .mav-cats button{flex:none;padding:7px 11px;border-radius:999px;border:2px solid #ffffff22;background:#1a0f17;color:#d7c6cf;font:600 13px/1 Inter,system-ui,sans-serif;letter-spacing:.06em;cursor:pointer}" +
      "#mavSheet .mav-cats button.on{border-color:" + NEON + ";color:#fff;box-shadow:0 0 10px #ff3d9a66}" +
      "#mavSheet .mav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px}" +
      "#mavSheet .mav-op{display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;border-radius:14px;border:2px solid transparent;background:#1a0f17;color:#cbb8c3;font:600 11px/1.1 Inter,system-ui,sans-serif;cursor:pointer}" +
      "#mavSheet .mav-op.on{border-color:" + NEON + ";color:#fff}" +
      "#mavSheet .mav-sw{width:44px;height:44px;border-radius:50%;border:2px solid #ffffff33}" +
      "#mavSheet .mav-act{display:flex;gap:8px;margin-top:14px}" +
      "#mavSheet .mav-act button{flex:1;padding:13px;border-radius:14px;font:400 17px/1 Anton,sans-serif;letter-spacing:.1em;cursor:pointer}" +
      "#mavSheet .mav-rand{background:#1a0f17;border:2px solid " + VIOLET + ";color:" + VIOLET + "}" +
      "#mavSheet .mav-save{background:" + NEON + ";border:0;color:#fff;box-shadow:0 0 16px #ff3d9a88}";
    (document.head || document.documentElement).appendChild(st);
  }

  /* ───────── the builder ───────── */
  var ED = null, CAT = "hair";
  function openEditor() {
    css(); ED = JSON.parse(JSON.stringify(MINE || DEF));
    var el = document.getElementById("mavSheet"); if (el) el.remove();
    el = document.createElement("div"); el.id = "mavSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Build your Messy look");
    el.innerHTML = '<div class="mav-p"><div class="mav-hd">YOUR MESSY LOOK<button type="button" data-mav="x" aria-label="Close">✕</button></div>' +
      '<div class="mav-big" id="mavBig"></div><div class="mav-cats" id="mavCats"></div><div class="mav-grid" id="mavGrid"></div>' +
      '<div class="mav-act"><button type="button" class="mav-rand" data-mav="rand">🎲 RANDOM</button><button type="button" class="mav-save" data-mav="save">SAVE</button></div>' +
      '<div style="margin-top:10px;font:500 12px/1.35 Inter,system-ui,sans-serif;color:#8f979e;text-align:center">Your date sees this look instead of a letter. It travels sealed with the chat — no photos, no names.</div></div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      var t = e.target.closest("[data-mav],[data-cat],[data-op]");
      if (e.target === el || (t && t.getAttribute("data-mav") === "x")) { el.remove(); return; }
      if (!t) return;
      if (t.hasAttribute("data-cat")) { CAT = t.getAttribute("data-cat"); paintEd(); return; }
      if (t.hasAttribute("data-op")) { ED[CAT] = +t.getAttribute("data-op"); paintEd(); try { navigator.vibrate && navigator.vibrate(6); } catch (x) {} return; }
      var a = t.getAttribute("data-mav");
      if (a === "rand") { ED = rnd(); paintEd(); }
      if (a === "save") { t.disabled = true; save(ED).then(function () { el.remove(); paintDoor(); paintRoom(); try { window.MESSY_AV_ONSAVE && window.MESSY_AV_ONSAVE(enc(ED)); } catch (x) {} try { typeof toast === "function" && toast("✓ Look saved — your date sees it next time"); } catch (x) {} }, function () { t.disabled = false; }); }
    });
    paintEd();
  }
  function paintEd() {
    var big = document.getElementById("mavBig"); if (!big) return;
    big.innerHTML = svg(ED, 150);
    document.getElementById("mavCats").innerHTML = F.map(function (f) { return '<button type="button" data-cat="' + f[0] + '"' + (f[0] === CAT ? ' class="on"' : "") + ">" + f[1] + "</button>"; }).join("");
    var f = F.filter(function (x) { return x[0] === CAT; })[0], pal = { ring: RING, skin: SKIN, hairc: HAIRC, topc: TOPC }[CAT], h = "";
    for (var i = 0; i < f[2]; i++) {
      var on = ED[CAT] === i ? " on" : "";
      if (f[3] === "c") h += '<button type="button" class="mav-op' + on + '" data-op="' + i + '" aria-label="Color ' + (i + 1) + '"><span class="mav-sw" style="background:' + pal[i] + '"></span></button>';
      else { var o = JSON.parse(JSON.stringify(ED)); o[CAT] = i; if (CAT === "hair") o.hat = 0; h += '<button type="button" class="mav-op' + on + '" data-op="' + i + '">' + svg(o, 56) + "<span>" + NAMES[CAT][i] + "</span></button>"; }
    }
    document.getElementById("mavGrid").innerHTML = h;
  }

  /* ───────── where it shows ───────── */
  function paintDoor() {
    var cardBtn = document.querySelector('[data-msy="card"]'); if (!cardBtn) return;
    css();
    var anchor = cardBtn.closest(".msy-card") || cardBtn;
    var box = document.getElementById("mavDoor");
    if (!box || box.previousElementSibling !== anchor) {
      if (box) box.remove();
      box = document.createElement("div"); box.id = "mavDoor"; box.className = "msy-card v";
      box.style.cssText = "flex-direction:row;align-items:center;gap:12px;margin-top:10px";
      anchor.parentNode.insertBefore(box, anchor.nextSibling);
      box.addEventListener("click", function (e) { if (e.target.closest("[data-mav-edit]")) { e.stopPropagation(); openEditor(); } });
    }
    var h = '<div class="mav-pv">' + svg(MINE || DEF, 56) + '</div><div style="flex:1;min-width:0"><div class="msy-h" style="color:' + VIOLET + '">YOUR LOOK · YOUR DATE SEES IT</div>' +
      '<div style="font-size:13px;font-weight:600;color:#d7c6cf">' + (MINE ? "Looking good. Fix it up any time." : "Build your look — hair, hat, vest, the works.") + "</div></div>" +
      '<button type="button" class="msy-ghost v" data-mav-edit>' + (MINE ? "EDIT" : "BUILD") + "</button>";
    if (box.__h !== h) { box.innerHTML = h; box.__h = h; }
  }
  var THEM = "";
  function paintRoom(themCode) {
    if (themCode != null) THEM = String(themCode || "");
    var them = document.getElementById("msyThemHex"); if (!them) return;
    if (themCode != null) them.__mav = 1;
    css();
    var row = them.parentNode && them.parentNode.parentNode, mine = row && row.querySelector(".hex:not(#msyThemHex)");
    if (mine && MINE) { mine.classList.add("mav-on"); mine.innerHTML = svg(MINE, 46); }
    var t = parse(THEM);
    if (t) { them.classList.add("mav-on"); them.innerHTML = svg(t, 46); }
  }

  var pending = 0;
  var mo = new MutationObserver(function () {
    if (pending) return; pending = setTimeout(function () { pending = 0;
      if (document.querySelector('[data-msy="card"]')) paintDoor();
      var th = document.getElementById("msyThemHex"); if (th && !th.__mav) { th.__mav = 1; THEM = ""; paintRoom(); }
    }, 120);
  });
  function start() { mo.observe(document.body, { childList: true, subtree: true }); setTimeout(pull, 4000); }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);

  window.MESSY_AV = { code: function () { return MINE ? enc(MINE) : ""; }, room: paintRoom, svg: function (c, px) { return svg(parse(c) || DEF, px || 64); }, open: openEditor };
})();
