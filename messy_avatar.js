/* messy_avatar.js — #messyav(nov24) · #mjlook(nov24). Your Messy look.
   v2 — the looks are Midjourney art: 48 finished characters (man/woman × 4 skin tones × 6 hair-or-hat styles), all
   one style. The builder feels like customizing — pick I'M A, SKIN, HAIR & HATS, GLOW — and each pick swaps in the
   matching character, so it always looks right (no pasted-on pieces). A look is a short code: "p2.<g><s><h>.<glow>"
   (e.g. p2.mb1.0). Looks saved with the old drawn builder (codes like "1.2.5.0…") still draw the old way.
     · door page: a YOUR LOOK card under YOUR CARD, with EDIT → the builder
     · on a date: your look and theirs replace the two letter hexes (it rides inside the sealed "hi" — MESSY_AV.code())
     · messy.html uses MESSY_AV.svg(code, px), MESSY_AV.open() and MESSY_AV_ONSAVE(code)
   Kept on the phone and in user_kv (shadowhook_messy_av). Loaded by ports_ext.js and messy.html. */
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


  /* ───────── v2: the Midjourney set ───────── */
  var ART = {"mf0": "2c156951-dc76-4dfc-88e3-e43d1a5517b6/0_1", "mf1": "f7859611-afb8-46da-b43f-e0a907db4e47/0_0", "mf2": "84c81b69-0d01-4d8b-add9-b33fc731f705/0_1", "mf3": "a274368a-162d-4634-a43c-20c9944821b3/0_1", "mf4": "fd1f7017-2a0d-4579-b997-5e846427f074/0_0", "mf5": "01854baf-b5e2-45eb-b11a-1048f7704d93/0_1", "mt0": "171cd64d-25c7-4098-8949-1e175ba343b0/0_1", "mt1": "9b3a236f-dc78-4dd0-ada2-374c901726d3/0_1", "mt2": "0a9f0ceb-1775-454d-991a-8e8489d3ebf7/0_0", "mt3": "75b6a743-db2f-4a62-ab89-d5784de8b58f/0_1", "mt4": "a1321688-358e-4298-a8db-35f1d69d5637/0_3", "mt5": "7481c336-cb5f-4082-8710-2cd088a764a2/0_2", "mb0": "8ebaea34-11b2-45f5-a751-0d0746157308/0_1", "mb1": "4259ce19-6da4-4408-808c-e30b68bff029/0_1", "mb2": "bf532de1-bdc7-45ad-8319-b9039741e394/0_1", "mb3": "a06943d0-7fe4-431e-a57e-b83cfeaf5a71/0_2", "mb4": "c70ffdbf-70fe-42f4-aadc-376c077d5323/0_1", "mb5": "1429cc17-1809-4ce5-a620-a75d56e529e8/0_2", "md0": "ded84256-4874-412f-8e05-ff07d5f71a06/0_1", "md1": "079ec70f-77a2-411d-bea9-a435f43ee44e/0_1", "md2": "17cbcdf4-5325-4c37-a666-587881a4241c/0_1", "md3": "fc2c2c11-1eae-4d48-9eb9-6cb5a0e1f01c/0_1", "md4": "7fc11c83-7d57-4708-894d-a15397e64128/0_1", "md5": "b4f7c15c-24de-4902-9faf-10e6bd7e9540/0_2", "wf0": "8de4dabf-3a7a-42f8-8d65-1fecaa26668f/0_1", "wf1": "cab6daf8-969e-412a-8295-9daabe58d259/0_1", "wf2": "728d0e19-1604-4280-a49d-dfe2cb088b88/0_1", "wf3": "2d957175-3a66-4c01-8cdf-b720a2991f74/0_1", "wf4": "28f2207f-5fc3-4db9-8917-2d39dd000aa8/0_1", "wf5": "beed6271-841a-46e3-9662-2ee0086ece77/0_1", "wt0": "060b13ec-8815-4090-87b8-aa2f71189b50/0_1", "wt1": "12fe06b8-1e70-45a0-810c-75dd61b15303/0_1", "wt2": "2459015c-8abf-464b-8bc0-9c88adc41de8/0_2", "wt3": "0618adba-12e8-41ec-80c9-4d75e73c6037/0_2", "wt4": "b5671846-795e-4e7d-9979-23c61cc446b9/0_2", "wt5": "6cd23a4d-bb4d-4827-a9f4-1ce6be9a8ff0/0_2", "wb0": "d34483fe-7965-4ab1-b808-b8ebd2c86656/0_1", "wb1": "a4943707-c738-4bb8-85bb-7d101d4ee840/0_1", "wb2": "1e85ae69-cc49-4ff0-b702-6d7b39313754/0_1", "wb3": "3e8e03b8-4429-468d-a5ce-c3b111e7fb2d/0_2", "wb4": "ad21115b-7639-48c5-9afb-2c3429852eb2/0_1", "wb5": "61ad1209-a2a9-4477-8286-c5ff19ee9fe6/0_1", "wd0": "dbb512e6-3b18-4083-93a8-5d8859361605/0_1", "wd1": "8e0a461c-3a24-405e-b884-0e37e60363fc/0_1", "wd2": "79ddee35-35b6-44d6-b34b-d05da7b21ffd/0_1", "wd3": "38d551c4-9d18-4c6d-b7f5-7e72cfee08f1/0_2", "wd4": "b900f0ba-686e-462a-b593-2a0983d028a7/0_1", "wd5": "00218583-873a-472b-bc3b-49d10f749c90/0_1"};
  var GLOW = ["#ff3d9a", "#b56cff", "#ffe600", "#2ee6d6", "#ff7a1a", "#4f8cff", "#39ff88", "#ffffff"];
  var SKINS = [["f", "#f3d2b6", "Fair"], ["t", "#d8a878", "Tan"], ["b", "#a8693f", "Brown"], ["d", "#6b3f22", "Deep"]];
  var HEADS = { m: ["Buzz cut", "Curls + beard", "Slick + 'stache", "Man bun", "Hard hat", "Beanie"], w: ["Long & straight", "Big curls", "Ponytail", "Braids", "Hard hat", "Beanie"] };
  var SK7 = ["t", "e", "m", "a", "c", "n", "k"], B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
  function p2(code) {
    var m = /^p2\.([mw])([ftbd])([0-5])\.([0-7])(?:\.(\d{4}|x[0-9a-z]{7}))?$/.exec(String(code || "")); if (!m) return null;
    var o = { g: m[1], s: m[2], h: +m[3], r: +m[4] }, x = m[5] || "";
    if (/^\d{4}$/.test(x)) x = "x" + x[0] + x[1] + "000" + x[2] + x[3];
    SK7.forEach(function (k, i) { o[k] = x ? B36.indexOf(x[i + 1]) : 0; if (o[k] < 0) o[k] = 0; });
    return o;
  }
  function p2enc(o) { var x = SK7.map(function (k) { return B36[o[k] | 0]; }).join(""); return "p2." + o.g + o.s + o.h + "." + o.r + (/^0+$/.test(x) ? "" : ".x" + x); }

  /* ───────── extras: Midjourney art on a green screen, the green cut out right here in the browser ───────── */
  var XART = { crown: "4483c561-e458-4f69-8a91-632ea8894389/0_1", halo: "824ab1b5-09f9-45f7-8340-9944ca493c82/0_2", horns: "6247e7ff-ee72-441f-9de6-004c52297345/0_2",
    shades: "cbaf37f9-a9f6-413d-b249-da46694394d5/0_1", chain: "6564c8b3-33b0-4d3f-be36-c0324d9b78d2/0_2", lei: "a8581195-8d73-4305-aa14-0cc0d0cf2fdd/0_0",
    heart: "b9bc37a6-c747-40b8-b4a3-9a3c40a8595f/0_2", flame: "ba66ab01-8eae-46cc-8c83-4c079776ba4b/0_1", anchor: "4565b539-d3d4-47c1-92f4-a7a79ef0bbe2/0_0", rose: "7ba3c9a3-014f-4daf-ba35-5c214d66679e/0_0",
    cap: "2617ca64-d6a1-4f3b-a963-b77ba0eecc17/0_1", cowboy: "34463e76-8f0f-4624-bc18-37a3806b6488/0_2", cigar: "994648bd-5e8a-40b8-bae0-67936ac6b6b6/0_2", toothpick: "c0fafb3e-790e-413d-99ea-bc65a5e9d092/0_2",
    earrings: "5965ba88-ad08-451c-976d-ce184e35afcf/0_1", bandana: "d50d4817-36be-45a5-9275-ca1f8691b2fa/0_0", tattoo: "62dc95e0-d9ed-40df-a4ea-30d22aa1c078/0_1",
    santa: "8a01ad54-06d4-4688-8653-bbf9a6e5a65b/0_1", antlers: "a648157f-7751-4756-8c51-99ce0d22a105/0_3", elf: "881dd106-7305-4d17-9c7b-49287e9aaf80/0_1", scarf: "90e1c78a-6675-4e25-9548-d17f8a63b28a/0_2",
    lights: "3a1db1ac-a006-4334-b24b-f78a1a9ea6ce/0_1", candycane: "41849fb3-b1e8-4c25-940b-08736d0f0363/0_2", gift: "b7ac196c-1d31-46ae-9b47-a7dd4ad6abe3/0_1", snowflake: "ed588f35-bdde-44df-9a35-b93b4c718620/0_2",
    ornament: "4e86d050-cc4a-4d90-881a-a54aaa19d61d/0_1" };
  /* slot: its choices (index 0 = none; the order is the look code — append only, same order as msy_av_items on the server)
     and where each sits on the round look (percent of its size: left, top, width) */
  var SLOTS = [
    { k: "t", n: "TOP", c: [null, "crown", "halo", "horns", "cap", "cowboy", "santa", "antlers", "elf"],
      at: { crown: [27, -14, 46], halo: [25, -10, 50], horns: [22, -6, 56], cap: [18, -17, 64], cowboy: [6, -22, 88], santa: [16, -24, 68], antlers: [10, -24, 80], elf: [16, -27, 68] } },
    { k: "e", n: "EYES", c: [null, "shades"], at: { shades: [21, 24, 58] } },
    { k: "m", n: "MOUTH", c: [null, "cigar", "toothpick"], at: { cigar: [47, 47, 40], toothpick: [46, 51, 34] } },
    { k: "a", n: "EARS", c: [null, "earrings"], at: { earrings: [8, 36, 84] } },
    { k: "c", n: "CHEEK", c: [null, "tattoo"], at: { tattoo: [59, 41, 9] } },
    { k: "n", n: "NECK", c: [null, "chain", "lei", "bandana", "scarf", "lights"], at: { chain: [18, 52, 64], lei: [10, 48, 80], bandana: [22, 56, 56], scarf: [4, 63, 92], lights: [8, 50, 84] } },
    { k: "k", n: "STICKER", c: [null, "heart", "flame", "anchor", "rose", "candycane", "gift", "snowflake", "ornament"],
      at: { heart: [66, 62, 40], flame: [66, 58, 40], anchor: [66, 60, 40], rose: [64, 58, 42], candycane: [66, 56, 40], gift: [64, 60, 40], snowflake: [64, 60, 40], ornament: [66, 58, 38] } }
  ];
  /* #nov24c: every face sits a little differently in its picture: [eyes center x, eye line y, eye-to-eye distance, mouth y] in % of the round look */
  var LM = {"mf0":[50.5,32,21,50],"mf1":[52,36,21,48],"mf2":[51,37,22,55],"mf3":[53,38,20,54],"mf4":[58,36,17,53],"mf5":[50,37,18,53],"mt0":[51,27.5,19.5,41],"mt1":[50,36,20,53],"mt2":[52.5,29.7,15,47],"mt3":[55,36.4,15.5,50.5],"mt4":[55.5,35.5,15,47.8],"mt5":[50,34.4,19.5,52.5],"mb0":[52,29,20,43],"mb1":[50,37,16.5,48.5],"mb2":[50,37,20,52],"mb3":[48,33,16,49],"mb4":[53,38.6,20.5,54],"mb5":[47.5,29.7,15,42.8],"md0":[54.5,35,19,49.7],"md1":[52,43.6,17.5,57.5],"md2":[51.5,42,20,56.7],"md3":[54.5,33,17,48],"md4":[51,40,22,53],"md5":[49,26.7,19.5,42],"wf0":[50,29,20,42],"wf1":[50,41.4,19.5,54.5],"wf2":[51.5,40,21,53],"wf3":[48,37,24.5,51],"wf4":[52,46,26.4,62.8],"wf5":[51.7,35,19.4,49],"wt0":[50,35,20.3,52],"wt1":[49.7,39.7,19,53],"wt2":[49.7,41.4,20.6,56.7],"wt3":[50.7,32.2,21.4,47],"wt4":[50,42.2,20.8,57.5],"wt5":[50,35.3,22,49.7],"wb0":[50.4,33.6,18,47.5],"wb1":[49.6,47.5,18,61.4],"wb2":[51.2,38.3,23,57.2],"wb3":[50.8,28,19.5,43.3],"wb4":[51.5,40.5,20.3,54],"wb5":[51,36.4,23.6,53.3],"wd0":[50,29.7,20.8,42.8],"wd1":[48.6,47,19.4,61.7],"wd2":[51.8,36.4,20.8,48.9],"wd3":[51.7,36.4,22.3,48.9],"wd4":[54.3,46,20.8,60],"wd5":[50.6,45.3,22.3,60.5]};
  /* where the art actually is inside each extra's picture (fractions: left, top, right, bottom) — the pictures have big empty margins */
  var BB = { shades: [.147, .363, .85, .631], cigar: [.191, .309, .809, .625], toothpick: [.178, .303, .819, .703], tattoo: [.40, .334, .597, .663] };
  /* hand tweaks for the cigar on faces whose mouth sits off the measure: [right, down] in % */
  var CIG = { wf4: [-1.5, -4.5], wd4: [0, -2] };
  function lm(o) { return LM[o.g + o.s + o.h] || [50, 35, 20, 50]; }
  /* put the art (not its picture) centered on cx,cy at width w */
  function fit(name, cx, cy, w) { var b = BB[name], W = w / (b[2] - b[0]); return [cx - W * (b[0] + b[2]) / 2, cy - W * (b[1] + b[3]) / 2, W]; }
  function place(name, sl, o) {
    var L = lm(o), cx = L[0], ey = L[1], d = L[2], my = L[3], s = d / 20;
    if (name === "shades") return fit(name, cx, ey + 0.6, d * 2.15);
    if (name === "cigar") { var cb = BB.cigar, cw = d * 1.35, CW = cw / (cb[2] - cb[0]), cy0 = (cb[1] + cb[3]) / 2;   /* its butt end in the corner of the lips, hanging down a little */
      var ct = CIG[o.g + o.s + o.h] || [0, 0], wy = o.g === "w" ? d * 0.05 : 0, wx = o.g === "w" ? d * 0.02 : 0;
      return [cx + d * 0.28 - wx + ct[0] - CW * cb[0], my - d * 0.08 - wy + ct[1] - CW * cy0, CW, "transform:rotate(16deg);transform-origin:" + (cb[0] * 100) + "% " + (cy0 * 100) + "%;"]; }
    if (name === "toothpick") return fit(name, cx + d * 0.72, my - d * 0.2, d * 1.3);   /* its low left end sits in the mouth */
    if (name === "tattoo") return fit(name, cx + d * 0.74, ey + d * 0.5, d * 0.17);
    var a = sl.at[name];
    if (sl.k === "t") return [cx + (a[0] - 50) * s, ey + (a[1] - 35) * s, a[2] * s];   /* hats ride the head: move and size with the face */
    return a;
  }
  var CUT = { scarf: [[27, 12], [73, 12], [73, 23], [66, 27.5], [58, 31.5], [50, 33], [42, 31.5], [35, 28.5], [27, 23]] };
  var KEYED = {}, KEYING = {}, BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  function keyOut(name) {
    if (KEYED[name] || KEYING[name] || !XART[name]) return;
    KEYING[name] = 1;
    var im = new Image(); im.crossOrigin = "anonymous";
    im.onload = function () {
      try {
        var W = 320, H = Math.max(1, Math.round(W * (im.naturalHeight || 1) / (im.naturalWidth || 1))), c = document.createElement("canvas"); c.width = W; c.height = H;
        var g = c.getContext("2d"); g.drawImage(im, 0, 0, W, H);
        var d = g.getImageData(0, 0, W, H), p = d.data;
        /* the screen's own green, from the four corners */
        var br = 0, bg = 0, bb = 0, n = 0;
        [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].forEach(function (q) { var i = (q[1] * W + q[0]) * 4; br += p[i]; bg += p[i + 1]; bb += p[i + 2]; n++; });
        br /= n; bg /= n; bb /= n;
        var bgd = Math.max(30, bg - Math.max(br, bb));
        for (var i = 0; i < p.length; i += 4) {
          var r = p[i], gg = p[i + 1], b = p[i + 2], gd = gg - Math.max(r, b);
          var a = (bgd * 0.8 - gd) / (bgd * 0.45); a = a < 0 ? 0 : a > 1 ? 1 : a;
          if (gd > 0) p[i + 1] = Math.max(r, b) + gd * (1 - a) * 0.3;   /* take the green glow off the edges */
          p[i + 3] = Math.round(p[i + 3] * a);
        }
        g.putImageData(d, 0, 0);
        /* the scarf: cut away the back of the band (behind the neck) so the front looks wrapped around the neck */
        if (CUT[name]) { g.globalCompositeOperation = "destination-out"; g.beginPath(); CUT[name].forEach(function (q, i) { var x = q[0] / 100 * W, y = q[1] / 100 * H; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.fill(); g.globalCompositeOperation = "source-over"; }
        KEYED[name] = c.toDataURL("image/png");
      } catch (e) { KEYED[name] = BLANK; }
      KEYING[name] = 0;
      var els = document.querySelectorAll('img[data-xk="' + name + '"]'); for (var j = 0; j < els.length; j++) els[j].src = KEYED[name];
      var bgs = document.querySelectorAll('[data-xkbg="' + name + '"]'); for (var q = 0; q < bgs.length; q++) bgs[q].style.backgroundImage = "url(" + KEYED[name] + ")";
    };
    im.onerror = function () { KEYING[name] = 0; };
    im.src = "https://cdn.midjourney.com/" + XART[name] + "_384_N.webp?k=1";
  }
  function xImg(name, at, extra) {
    keyOut(name);
    return '<img alt="" data-xk="' + name + '" src="' + (KEYED[name] || BLANK) + '" style="position:absolute;left:' + at[0] + "%;top:" + at[1] + "%;width:" + at[2] + "%;height:auto;pointer-events:none;" + (extra || "") + '">';
  }
  function extras(o) {
    var h = "";
    SLOTS.forEach(function (sl) { var name = sl.c[o[sl.k] | 0]; if (!name) return;
      if (name === "earrings") { keyOut(name); var E = lm(o), es = E[2] / 20, ew = 17 * es, eh = 34 * es, et = E[1] - 0.15 * E[2], el = E[0] - 1.475 * E[2] - ew / 2, er = E[0] + 1.475 * E[2] - ew / 2; var bgi = KEYED[name] ? "background-image:url(" + KEYED[name] + ");" : "";   /* one hoop per ear: each half of the pair, at its own ear */
        h += '<div data-xkbg="earrings" style="position:absolute;left:' + el + '%;top:' + et + '%;width:' + ew + '%;height:' + eh + '%;background:no-repeat 0 50%/200% auto;' + bgi + 'pointer-events:none;filter:drop-shadow(0 1px 1px #0006)"></div>' +
             '<div data-xkbg="earrings" style="position:absolute;left:' + er + '%;top:' + et + '%;width:' + ew + '%;height:' + eh + '%;background:no-repeat 100% 50%/200% auto;' + bgi + 'pointer-events:none;filter:drop-shadow(0 1px 1px #0006)"></div>'; return; }
      var at = place(name, sl, o); h += xImg(name, at, (at[3] || "") + (sl.k === "k" || sl.k === "n" ? "filter:drop-shadow(0 2px 3px #0005)" : "filter:drop-shadow(0 1px 1px #0006)")); });
    return h;
  }
  function img(o, size) { var a = ART[o.g + o.s + o.h]; return a ? "https://cdn.midjourney.com/" + a + "_" + (size > 200 ? 640 : 384) + "_N.webp" : ""; }
  function face(o, px) {
    return '<div style="position:relative;width:' + px + "px;height:" + px + 'px;flex:none"><div style="position:absolute;inset:0;border-radius:50%;box-sizing:border-box;border:' + Math.max(2, Math.round(px / 28)) + "px solid " + GLOW[o.r] +
      ";background:#f3b7c4 url(" + img(o, px * 2) + ") 50% 22%/150% no-repeat;box-shadow:0 0 " + Math.round(px / 8) + "px " + GLOW[o.r] + '66"></div>' + extras(o) + "</div>";
  }
  function html(code, px) { var o = p2(code); if (o) return face(o, px); var old = parse(code); return old ? svg(old, px) : face({ g: "m", s: "b", h: 1, r: 0 }, px); }
  function rnd2() { var g = Math.random() < 0.5 ? "m" : "w", R = function (n, p) { return Math.random() < p ? 1 + Math.floor(Math.random() * (n - 1)) : 0; };
    var o = { g: g, s: SKINS[Math.floor(Math.random() * 4)][0], h: Math.floor(Math.random() * 6), r: Math.floor(Math.random() * GLOW.length) };
    var P = { t: 0.3, e: 0.3, m: 0.15, a: 0.2, c: 0.1, n: 0.35, k: 0.35 };
    SLOTS.forEach(function (sl) { var ok = sl.c.map(function (n, i) { return i && avail(n) ? i : 0; }).filter(Boolean); o[sl.k] = ok.length && Math.random() < P[sl.k] ? ok[Math.floor(Math.random() * ok.length)] : 0; });
    return o; }
  var DEF2 = parse("0.2.2.0.0.0.0.0.0.0.0");
  function preload() { try { Object.keys(ART).forEach(function (k, i) { setTimeout(function () { var im = new Image(); im.src = "https://cdn.midjourney.com/" + ART[k] + "_384_N.webp"; }, i * 40); }); } catch (e) {} }

  /* ───────── storage ───────── */
  var MINE = null;   /* the saved code string (v2 or an old drawn one) */
  function valid(c) { return !!(p2(c) || parse(c)); }
  try { var ls = localStorage.getItem(LS); if (valid(ls)) MINE = ls; } catch (e) {}
  function sb() { return window.SB; }
  function pull() {
    try { var u = window.__shkUid; if (!sb() || !u) return;
      sb().from("user_kv").select("v").eq("owner", u).eq("k", KV).maybeSingle().then(function (r) {
        var v = r && r.data && r.data.v; if (valid(v) && v !== MINE) { MINE = v; try { localStorage.setItem(LS, v); } catch (e) {} paintDoor(); }
      }, function () {});
    } catch (e) {}
  }
  function save(code) {
    MINE = code; try { localStorage.setItem(LS, code); } catch (e) {}
    try { var u = window.__shkUid; if (sb() && u) return sb().from("user_kv").upsert({ owner: u, k: KV, v: code, updated_at: new Date().toISOString() }, { onConflict: "owner,k" }); } catch (e) {}
    return Promise.resolve();
  }

  /* ───────── styles ───────── */
  function css() {
    if (document.getElementById("mavCss")) return;
    var st = document.createElement("style"); st.id = "mavCss";
    st.textContent =
      ".hex.mav-on{background:none!important;width:46px!important;height:46px!important;clip-path:none!important;border-radius:50%;overflow:visible;padding:0!important;font-size:0!important}" +
      "#mavDoor .mav-pv{width:56px;height:56px;flex:none}" +
      "#mavSheet{position:fixed;inset:0;z-index:2147483000;background:#000b;display:flex;align-items:flex-end;justify-content:center}" +
      "#mavSheet .mav-p{width:100%;max-width:520px;max-height:92vh;overflow:auto;background:#140b18;border:2px solid " + NEON + ";border-bottom:0;border-radius:24px 24px 0 0;box-shadow:0 0 30px #ff3d9a55;padding:12px 16px calc(env(safe-area-inset-bottom) + 16px);color:#f3e9ee;font-family:Inter,system-ui,sans-serif}" +
      "#mavSheet .mav-grab{width:44px;height:5px;border-radius:3px;background:#ffffff40;margin:0 auto 10px}" +
      "#mavSheet .mav-hd{display:flex;align-items:center;gap:8px;font:700 19px/1 Fredoka,Inter,sans-serif;letter-spacing:.02em;color:#fff}" +
      "#mavSheet .mav-hd button{margin-left:auto;background:none;border:0;color:#8f979e;font-size:22px;cursor:pointer}" +
      "#mavSheet .mav-big{display:flex;justify-content:center;margin:22px 0 10px;position:relative;height:172px}" +
      "#mavSheet .mav-big>div{position:absolute;transition:opacity .25s,transform .25s}" +
      "#mavSheet .mav-big>div.out{opacity:0;transform:scale(.94)}" +
      "#mavSheet .mav-lbl{font:700 11px/1 Inter,sans-serif;letter-spacing:.12em;color:#b9a9c4;margin:14px 0 8px}" +
      "#mavSheet .mav-seg{display:flex;gap:8px}#mavSheet .mav-seg button{flex:1;padding:11px;border-radius:14px;border:2px solid #ffffff1f;background:#1f1424;color:#e9dcef;font:600 15px/1 Fredoka,Inter,sans-serif;cursor:pointer}" +
      "#mavSheet .mav-seg button.on{border-color:" + NEON + ";color:#fff;background:#ff3d9a1f}" +
      "#mavSheet .mav-sk{display:flex;gap:10px}#mavSheet .mav-sk button{width:46px;height:46px;border-radius:50%;border:3px solid transparent;cursor:pointer;box-shadow:0 0 0 2px #ffffff22}" +
      "#mavSheet .mav-sk button.on{border-color:#fff;box-shadow:0 0 0 2px " + NEON + "}" +
      "#mavSheet .mav-hs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}" +
      "#mavSheet .mav-hs button{display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 4px;border-radius:16px;border:2px solid transparent;background:#1f1424;color:#cbb8c3;font:600 12px/1.1 Inter,sans-serif;cursor:pointer}" +
      "#mavSheet .mav-hs button.on{border-color:" + NEON + ";color:#fff;background:#ff3d9a14}" +
      "#mavSheet .mav-gl{display:flex;gap:9px;flex-wrap:wrap}#mavSheet .mav-gl button{width:30px;height:30px;border-radius:50%;border:3px solid #140b18;cursor:pointer;box-shadow:0 0 0 2px #ffffff22}" +
      "#mavSheet .mav-gl button.on{box-shadow:0 0 0 3px #fff}" +
      "#mavSheet .mav-xr{display:flex;align-items:center;gap:10px;margin-bottom:8px}#mavSheet .mav-xr>span{width:62px;flex:none;font:700 10px/1 Inter,sans-serif;letter-spacing:.1em;color:#8f7d9a}" +
      "#mavSheet .mav-xr>div{display:flex;gap:7px;flex-wrap:wrap}#mavSheet .mav-xr button{width:48px;height:48px;border-radius:14px;border:2px solid transparent;background:#1f1424;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:3px}" +
      "#mavSheet .mav-xr button.on{border-color:" + NEON + ";background:#ff3d9a1f}#mavSheet .mav-xr img{width:100%;height:100%;object-fit:contain}#mavSheet .mav-xr i{font-style:normal;color:#8f7d9a;font-size:15px}" +
      "#mavSheet .mav-xr button{position:relative}#mavSheet .mav-xr button.lockd img{opacity:.55}" +
      "#mavSheet .mav-b{position:absolute;right:-4px;top:-6px;padding:2px 5px;border-radius:999px;background:#ffc24b;color:#2b1638;font:800 10px/1.2 Inter,sans-serif}" +
      "#mavSheet .mav-b.lk{background:#2b1638;color:#fff;border:1px solid #ffffff33}#mavSheet .mav-b.xm{right:auto;left:-4px;background:none;padding:0;font-size:12px}" +
      "#mavBuy{display:none;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;border-radius:14px;background:#2a1838;border:1px solid #ffc24b66}" +
      "#mavBuy b{display:block;font:700 14px/1.2 Fredoka,Inter,sans-serif;color:#fff}#mavBuy span{display:block;font:500 12px/1.3 Inter,sans-serif;color:#cbb8c3;margin-top:2px}" +
      "#mavBuy button{border:0;border-radius:12px;padding:10px 14px;background:linear-gradient(135deg,#ffc24b,#ff8a5c);color:#2b1638;font:700 14px/1 Fredoka,Inter,sans-serif;cursor:pointer}" +
      "@keyframes mavShake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}" +
      "#mavSheet .mav-act{display:flex;gap:8px;margin-top:16px}" +
      "#mavSheet .mav-act button{flex:1;padding:14px;border-radius:16px;font:700 17px/1 Fredoka,Inter,sans-serif;letter-spacing:.04em;cursor:pointer}" +
      "#mavSheet .mav-rand{background:#1f1424;border:2px solid " + VIOLET + ";color:#d8b8ff}" +
      "#mavSheet .mav-save{background:linear-gradient(135deg,#ff6f9a,#ff3d9a);border:0;color:#fff;box-shadow:0 0 16px #ff3d9a88}";
    (document.head || document.documentElement).appendChild(st);
  }

  /* ───────── the builder (v2) ───────── */
  var ED = null;
  function openEditor() {
    css(); preload();
    ED = p2(MINE) || p2("p2.mb1.0");
    Object.keys(XART).forEach(keyOut); loadShop();
    var el = document.getElementById("mavSheet"); if (el) el.remove();
    el = document.createElement("div"); el.id = "mavSheet"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Build your Messy look");
    el.innerHTML = '<div class="mav-p"><div class="mav-grab"></div><div class="mav-hd">Your Messy look<button type="button" data-mav="x" aria-label="Close">✕</button></div>' +
      '<div class="mav-big" id="mavBig"></div><div id="mavOpts"></div><div id="mavBuy"></div>' +
      '<div class="mav-act"><button type="button" class="mav-rand" data-mav="rand">🎲 Surprise me</button><button type="button" class="mav-save" data-mav="save">Save</button></div>' +
      '<div style="margin-top:10px;font:500 12px/1.35 Inter,system-ui,sans-serif;color:#8f979e;text-align:center">Your look is all anyone sees on Messy. No photos, no names.</div></div>';
    document.body.appendChild(el);
    el.addEventListener("click", function (e) {
      var bb = e.target.closest("[data-buy]"); if (bb) { buy(bb.getAttribute("data-buy"), bb); return; }
      var t = e.target.closest("[data-mav],[data-k]");
      if (e.target === el || (t && t.getAttribute("data-mav") === "x")) { el.remove(); return; }
      if (!t) return;
      if (t.hasAttribute("data-k")) { var kk = t.getAttribute("data-k"); ED[kk] = kk === "g" || kk === "s" ? t.getAttribute("data-v") : +t.getAttribute("data-v"); paintEd(true); try { navigator.vibrate && navigator.vibrate(6); } catch (x) {} return; }
      var a = t.getAttribute("data-mav");
      if (a === "rand") { ED = rnd2(); paintEd(true); }
      if (a === "save" && locked().length) { var lk = SHOP && SHOP.map[locked()[0]]; try { toast(lk ? (lk.unlock ? "🔒 " + lk.label + ": " + lk.hint : "Unlock the " + lk.label + " first — or pick another") : "One moment…"); } catch (x) {} var b2 = document.getElementById("mavBuy"); if (b2) { b2.style.animation = "none"; b2.offsetWidth; b2.style.animation = "mavShake .4s"; } return; }
      if (a === "save") { t.disabled = true; var c = p2enc(ED); save(c).then(function () { el.remove(); paintDoor(); paintRoom(); try { window.MESSY_AV_ONSAVE && window.MESSY_AV_ONSAVE(c); } catch (x) {} try { typeof toast === "function" && toast("✓ Look saved"); } catch (x) {} }, function () { t.disabled = false; }); }
    });
    paintEd(false);
  }
  function paintEd(anim) {
    var big = document.getElementById("mavBig"); if (!big) return;
    var nw = document.createElement("div"); nw.innerHTML = face(ED, 168);
    if (anim) { nw.classList.add("out"); [].forEach.call(big.children, function (c) { c.classList.add("out"); setTimeout(function () { c.remove(); }, 260); }); big.appendChild(nw); requestAnimationFrame(function () { requestAnimationFrame(function () { nw.classList.remove("out"); }); }); }
    else { big.innerHTML = ""; big.appendChild(nw); }
    var h = '<div class="mav-lbl">I’M A</div><div class="mav-seg"><button data-k="g" data-v="m"' + (ED.g === "m" ? ' class="on"' : "") + '>Man</button><button data-k="g" data-v="w"' + (ED.g === "w" ? ' class="on"' : "") + ">Woman</button></div>";
    h += '<div class="mav-lbl">SKIN</div><div class="mav-sk">' + SKINS.map(function (s) { return '<button data-k="s" data-v="' + s[0] + '" aria-label="' + s[2] + '" style="background:' + s[1] + '"' + (ED.s === s[0] ? ' class="on"' : "") + "></button>"; }).join("") + "</div>";
    h += '<div class="mav-lbl">HAIR & HATS</div><div class="mav-hs">' + HEADS[ED.g].map(function (n, i) { var o = { g: ED.g, s: ED.s, h: i, r: ED.r }; return '<button data-k="h" data-v="' + i + '"' + (ED.h === i ? ' class="on"' : "") + ">" + face(o, 64) + "<span>" + n + "</span></button>"; }).join("") + "</div>";
    h += '<div class="mav-lbl">GLOW</div><div class="mav-gl">' + GLOW.map(function (c, i) { return '<button data-k="r" data-v="' + i + '" aria-label="Glow ' + (i + 1) + '" style="background:' + c + '"' + (ED.r === i ? ' class="on"' : "") + "></button>"; }).join("") + "</div>";
    h += '<div class="mav-lbl">EXTRAS <span style="letter-spacing:0;font-weight:600;color:#8f7d9a">· ' + (SHOP ? SHOP.bucks + " ⬡" : "") + '</span></div>' + SLOTS.map(function (sl) {
      return '<div class="mav-xr"><span>' + sl.n + '</span><div>' + sl.c.map(function (name, i) {
        var it = name && SHOP && SHOP.map[name], lock = name && !avail(name), badge = "";
        if (it && lock) badge = it.unlock ? '<b class="mav-b lk">🔒</b>' : '<b class="mav-b">⬡' + it.price + "</b>";
        if (it && it.set === "xmas") badge += '<b class="mav-b xm">🎄</b>';
        return '<button data-k="' + sl.k + '" data-v="' + i + '" title="' + (it ? it.label : name || "None") + '" class="' + ((ED[sl.k] | 0) === i ? "on" : "") + (lock ? " lockd" : "") + '">' + (name ? '<img alt="" data-xk="' + name + '" src="' + (KEYED[name] || BLANK) + '">' : "<i>✕</i>") + badge + "</button>";
      }).join("") + "</div></div>";
    }).join("");
    document.getElementById("mavOpts").innerHTML = h;
    buyBar();
  }

  /* ───────── the extras shop: free, 1 ⬡, or earned in the app (msy_shop / msy_buy) ───────── */
  var SHOP = null;
  function avail(name) { if (!name) return true; if (!SHOP) return false; var it = SHOP.map[name]; return !!(it && it.owned); }
  function loadShop() {
    try { if (!sb()) return; sb().rpc("msy_shop").then(function (r) { if (r.error || !r.data) return; var m = {}; (r.data.items || []).forEach(function (it) { m[it.id] = it; }); SHOP = { bucks: r.data.bucks, map: m }; if (document.getElementById("mavOpts")) paintEd(false); }, function () {}); } catch (e) {}
  }
  function locked() { var out = []; SLOTS.forEach(function (sl) { var n = sl.c[ED[sl.k] | 0]; if (n && !avail(n)) out.push(n); }); return out; }
  function buyBar() {
    var bar = document.getElementById("mavBuy"); if (!bar) return;
    var L = locked(); if (!L.length || !SHOP) { bar.innerHTML = ""; bar.style.display = "none"; return; }
    var it = SHOP.map[L[0]]; bar.style.display = "flex";
    bar.innerHTML = it.unlock ? '<div style="flex:1"><b>🔒 ' + it.label + "</b><span>Earn it: " + it.hint + "</span></div>"
      : '<div style="flex:1"><b>' + it.label + " · " + it.price + ' ⬡</b><span>You have ' + SHOP.bucks + ' ⬡. Yours to keep.</span></div><button type="button" data-buy="' + it.id + '">Unlock</button>';
  }
  function buy(id, btn) {
    btn.disabled = true; btn.textContent = "…";
    sb().rpc("msy_buy", { p_item: id }).then(function (r) {
      if (r.error) { try { toast(r.error.message); } catch (e) {} btn.disabled = false; btn.textContent = "Unlock"; return; }
      var m = {}; (r.data.items || []).forEach(function (it) { m[it.id] = it; }); SHOP = { bucks: r.data.bucks, map: m }; paintEd(false);
      try { toast("✓ Unlocked — it's yours"); } catch (e) {}
    }, function () { btn.disabled = false; btn.textContent = "Unlock"; });
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
    var h = '<div class="mav-pv">' + html(MINE, 56) + '</div><div style="flex:1;min-width:0"><div class="msy-h" style="color:' + VIOLET + '">YOUR LOOK · YOUR DATE SEES IT</div>' +
      '<div style="font-size:13px;font-weight:600;color:#d7c6cf">' + (MINE ? "Looking good. Change it any time." : "Pick your look: hair, hat, the works.") + "</div></div>" +
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
    if (mine && MINE) { mine.classList.add("mav-on"); mine.innerHTML = html(MINE, 46); }
    if (valid(THEM)) { them.classList.add("mav-on"); them.innerHTML = html(THEM, 46); }
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

  window.MESSY_AV = { code: function () { return MINE || ""; }, room: paintRoom, svg: function (c, px) { return html(c, px || 64); }, open: openEditor };
})();
