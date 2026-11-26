/* mayday_art.js — #maydayart(nov26). The MAYDAY tab, redesigned to read in a hurry.
     · a Midjourney hero (a red beacon over a lifebuoy on a rainy dock) with the title in big stencil red
     · the emergency card framed in hazard stripes, with a big pulsing CALL SECURITY button and a radio icon
     · an illustrated icon on every section (alerts, BA backup, port emergency lines, The Book)
     · every number as a clean row with a round green call button
   Nothing about the numbers, the terminal picker or the alerts changes — only the look. Loaded by ports_ext.js. */
(function () {
  "use strict";
  if (window.__mdArt) return; window.__mdArt = 1;
  var MJ = "https://cdn.midjourney.com/", HERO = "bf2e1d72-a47a-417f-8c9c-e07da293faee/0_3";
  var KEY = { radio: "27b79c5f-9066-444b-a002-17a2c5bb9240/0_1", storm: "c374d79f-5fc8-45cb-9c83-6df93152ac9e/0_1",
              arm: "b471cb83-35be-4693-90ff-9781af20c3ac/0_1", buoy: "a1a076d9-cbd9-4b95-a851-71048e517a25/0_2", book: "0a79f74d-b561-40e7-928c-6f40b278e270/0_2" };
  var ART = {};
  var S = "html #scr-mayday ";
  var css =
    "html #scr-mayday>.screen-title{display:none}" +
    S + ".md-hero{column-span:all;-webkit-column-span:all;position:relative;height:170px;margin:4px 0 14px;border-radius:20px;overflow:hidden;background:url('" + MJ + HERO + "_640_N.webp') center 40%/cover no-repeat,#1a0b0b;box-shadow:0 12px 30px #000b,inset 0 0 0 2px rgba(224,73,46,.55)}" +
    S + ".md-hero:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,6,6,0) 30%,rgba(10,6,6,.9))}" +
    S + ".md-hero:after{content:'';position:absolute;inset:0;background:radial-gradient(circle at 70% 18%,rgba(255,40,30,.45),transparent 45%);animation:mdBeacon 1.6s ease-in-out infinite}" +
    "@keyframes mdBeacon{0%,100%{opacity:.25}50%{opacity:1}}" +
    S + ".md-hero b{position:absolute;left:16px;bottom:34px;z-index:1;font:400 50px/1 Anton,Impact,sans-serif;letter-spacing:.06em;color:#ff4b3a;text-shadow:0 3px 0 #5a0d06,0 0 22px rgba(255,60,40,.75)}" +
    S + ".md-hero i{position:absolute;left:16px;right:16px;bottom:12px;z-index:1;font:700 14px/1.2 'Barlow Condensed',Inter,sans-serif;letter-spacing:.08em;font-style:normal;color:#ffe3dc;text-shadow:0 2px 6px #000}" +
    /* the emergency card */
    S + "#emgCard{position:relative;overflow:hidden;border:2px solid rgba(255,75,58,.75)!important;box-shadow:0 0 26px rgba(255,60,40,.25),0 12px 30px #0008!important}" +
    S + "#emgCard:before{content:'';display:block;height:12px;background:repeating-linear-gradient(-45deg,#ffcc00 0 14px,#111 14px 28px)}" +
    S + "#emgCard .md-top{display:flex;align-items:center;gap:12px;margin:0 0 10px}" +
    S + "#emgCard .md-top img{width:70px;height:70px;object-fit:contain;flex:none;filter:drop-shadow(0 4px 6px #0009);animation:mdWig 2.4s ease-in-out infinite}" +
    "@keyframes mdWig{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}" +
    S + "#emgCard .emg-hit{font-family:Anton,Impact,sans-serif!important;font-weight:400!important;font-size:27px!important;letter-spacing:.03em!important;color:#ff4b3a!important;text-shadow:0 0 16px rgba(255,60,40,.5)}" +
    S + "#emgCall{position:relative;padding:18px 14px!important;border-radius:16px!important;border:0!important;background:linear-gradient(180deg,#ff5a45,#c81e12)!important;color:#fff!important;font:400 24px/1 Anton,Impact,sans-serif!important;letter-spacing:.08em;box-shadow:0 6px 0 #6b0d06,0 0 0 0 rgba(255,75,58,.7)!important;animation:mdPulse 1.8s ease-out infinite}" +
    S + "#emgCall:active{transform:translateY(4px);box-shadow:0 2px 0 #6b0d06!important}" +
    "@keyframes mdPulse{0%{box-shadow:0 6px 0 #6b0d06,0 0 0 0 rgba(255,75,58,.65)}70%{box-shadow:0 6px 0 #6b0d06,0 0 0 18px rgba(255,75,58,0)}100%{box-shadow:0 6px 0 #6b0d06,0 0 0 0 rgba(255,75,58,0)}}" +
    S + "#emgTerm{font-size:17px!important;padding:12px!important;border-radius:12px!important}" +
    /* section headers carry an icon */
    S + ".card-h.md-h{display:flex;align-items:center;gap:10px;font-size:15px!important}" +
    S + ".card-h.md-h img{width:46px;height:46px;object-fit:contain;flex:none;margin:-8px 0;filter:drop-shadow(0 3px 4px #0008)}" +
    /* BA card: bigger, warmer buttons */
    S + ".md-ba .btn-line.gold{border-radius:14px!important;font-size:17px!important;font-weight:700;box-shadow:0 4px 0 rgba(0,0,0,.35)}" +
    S + ".md-ba .md-arm{float:right;width:84px;height:84px;object-fit:contain;margin:-6px -4px 4px 8px;filter:drop-shadow(0 4px 6px #0009)}" +
    /* every number: a clean row, a round green call button */
    S + ".contact{gap:12px!important;padding:12px 4px!important}" +
    S + ".contact .t b{font-size:16.5px}" +
    S + ".contact .t span{display:block;font-size:13.5px;opacity:.8;margin-top:2px}" +
    S + ".contact a[href^='tel:']{display:inline-flex;align-items:center;justify-content:center;min-width:86px;padding:10px 14px!important;border-radius:999px!important;border:0!important;background:linear-gradient(180deg,#3ddc84,#169a52)!important;color:#fff!important;font-size:13px!important;font-weight:800!important;letter-spacing:.06em;box-shadow:0 3px 0 #0b5c30,0 0 12px rgba(61,220,132,.25)}" +
    S + ".contact a[href^='tel:']:active{transform:translateY(2px);box-shadow:0 1px 0 #0b5c30}" +
    S + ".contact a[href^='http']{border-radius:999px!important;padding:10px 14px!important}" +
    S + "#emergencyList .contact a[href^='tel:']{background:linear-gradient(180deg,#ff6a55,#d0261a)!important;box-shadow:0 3px 0 #6b0d06,0 0 12px rgba(255,75,58,.3)}" +
    "@media (prefers-reduced-motion:reduce){" + S + "*{animation:none!important}}";
  var st = document.createElement("style"); st.id = "mdArtCSS"; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

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

  function img(k, cls) { if (!ART[k]) return null; var i = new Image(); i.alt = ""; i.src = ART[k]; if (cls) i.className = cls; return i; }
  function head(card, k) { var h = card && card.querySelector(".card-h"); if (!h || h.querySelector("img")) return; var i = img(k); if (!i) return; h.classList.add("md-h"); h.insertBefore(i, h.firstChild); }
  function dress() {
    var scr = document.getElementById("scr-mayday"); if (!scr) return;
    if (!scr.querySelector(".md-hero")) {
      var h = document.createElement("div"); h.className = "md-hero"; h.setAttribute("aria-hidden", "true");
      h.innerHTML = "<b>MAYDAY</b><i>EMERGENCY? GET ON THE RADIO FIRST · THEN CALL SECURITY</i>";
      scr.insertBefore(h, scr.firstChild);
    }
    var emg = document.getElementById("emgCard"), lead = emg && emg.querySelector(".emg-lead");
    if (lead && ART.radio && !emg.querySelector(".md-top")) {
      var t = document.createElement("div"); t.className = "md-top"; lead.parentNode.insertBefore(t, lead); t.appendChild(img("radio")); t.appendChild(lead);
    }
    var al = document.getElementById("alertsList"); head(al && al.closest(".card"), "storm");
    var ba = scr.querySelector('a[href="tel:3103451448"]'), bac = ba && ba.closest(".card");
    if (bac) { bac.classList.add("md-ba"); var bb = bac.querySelector(".card-b"); if (bb && ART.arm && !bb.querySelector(".md-arm")) bb.insertBefore(img("arm", "md-arm"), bb.firstChild); }
    var el = document.getElementById("emergencyList"); head(el && el.closest(".card"), "buoy");
    var cl = document.getElementById("contactList"); head(cl && cl.closest(".card"), "book");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", dress); else dress();
  setTimeout(dress, 1500);
})();
