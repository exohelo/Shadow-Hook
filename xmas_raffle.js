/* The Shadow Hook — xmas_raffle.js (nov3u)
   The "Christmas Day on Ice" raffle look (raffles.design = 'xmas-ice'), in place of the app's standard raffle pieces:
   · THE BANNER (Social tab, where the raffle banner sits): the trailer plays first (muted, 0:00–0:21, once a day, Skip
     any time), then the card: the show art, "Christmas Day on Ice", WIN A FAMILY 4-PACK, the draw, ENTER.
   · THE FLYER (tap the banner): the trailer at the top over Mickey on the ice; when it ends everything lifts to show
     him; the ticket stub, the free-ticket claim (comps), buying (singles and 4-packs mixed at the best price), the rules.
   The app's own raffle banner, strip and tag stay hidden while this raffle is up. The raffle switch still rules it:
   switch OFF and none of this shows. A Keymaster previewing the draft sees it on their phone only. */
(function () {
  "use strict";
  if (window.__xmasRaffle) return; window.__xmasRaffle = true;
  var DESIGN = "xmas-ice", ART = "./xmas-ice-art.jpg", BG = "./xmas-ice-mickey.jpg", YT = "39ZoU-WflbA", CLIP = 23;
  var EVENT = { when: "FRI · DEC 25 · 11:00 AM", where: "TOYOTA ARENA · ONTARIO, CA", sec: "116", row: "I", seats: "16–19" };
  var R = null, ST = null, BANK = null, COMPS = [], qty = 1, busy = false, armed = false, armT = 0;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var fmt = function (n) { return Number(n || 0).toLocaleString("en-US"); };
  var uid = function () { return window.__shkUid || null; };
  var isKM = function () { return !!window.__isKM; };
  function laDraw(ts) {
    try { var d = new Date(ts); return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).replace(",", "") + " · " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).replace(":00", ""); } catch (e) { return ""; }
  }
  function phase() {
    if (!R) return "none";
    if (R.status === "draft") return "preview";
    var now = Date.now();
    if (R.opens_at && now < new Date(R.opens_at)) return "soon";
    if (R.closes_at && now >= new Date(R.closes_at)) return "closed";
    return "open";
  }
  function cap() { return R && R.max_per_member ? R.max_per_member : 100; }
  function mine() { return ST && typeof ST.mine === "number" ? ST.mine : 0; }
  function costOf(n) {
    var bq = R && R.bundle_qty, bp = R && R.bundle_price, p = (R && R.ticket_price) || 500;
    if (bq > 1 && bp) { var packs = Math.floor(n / bq); return packs * bp + (n - packs * bq) * p; }
    return n * p;
  }

  /* ---------------- styles ---------------- */
  function css() {
    if ($("xmasCss")) return;
    var l = document.createElement("link"); l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Mountains+of+Christmas:wght@700&display=swap";
    document.head.appendChild(l);
    var s = document.createElement("style"); s.id = "xmasCss";
    s.textContent = [
      "html.xmas-on #rflHost,html.xmas-on #rflHost2,html.xmas-on #rflTag{display:none!important}",
      /* the Keymaster's note (#kmBulletin, every phone): a solid dark backing so it reads over any backdrop */
      "#kmBulletin{background:rgba(16,9,8,.9)!important;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border:1.5px solid rgba(240,90,60,.85)!important;box-shadow:0 6px 18px rgba(0,0,0,.45);font:500 15px/1.5 Inter,system-ui,sans-serif!important;color:#FFF6EE!important}",
      "#kmBulletin>b{color:#FF7A59!important;font-size:11.5px!important;font-weight:800!important;letter-spacing:.16em!important}",
      "#kmBulletin #kmBulletinTxt{margin-top:5px!important;color:#FFF6EE!important}",
      "#kmBulletin button,#kmBulletin #kmBulletinX{color:rgba(255,246,238,.75)!important}",
      "#xmasBanner{margin:0 0 14px;font-family:Inter,system-ui,sans-serif;color:#F4F1EA}",
      "#xmasBanner .xb-box{position:relative;border-radius:18px;overflow:hidden;border:1.5px solid #F2C14E;box-shadow:0 10px 30px rgba(0,0,0,.45);background:#0B1530}",
      "#xmasBanner .xb-card{display:block;width:100%;padding:0;margin:0;border:0;background:none;color:inherit;text-align:left;cursor:pointer;font:inherit}",
      "#xmasBanner .xb-art{position:relative;height:120px;overflow:hidden}",
      "#xmasBanner .xb-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 8%}",
      ".xm-cred{position:absolute;right:6px;bottom:4px;font:500 9px Inter,sans-serif;color:rgba(255,255,255,.85);text-shadow:0 1px 2px rgba(0,0,0,.8)}",
      "#xmasBanner .xb-body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:8px}",
      "#xmasBanner .xb-row{display:flex;align-items:baseline;justify-content:space-between;gap:8px}",
      ".xm-script{font:700 23px/1 'Mountains of Christmas',serif;color:#F2C14E}",
      "#xmasBanner .xb-tag{font:600 10px Inter,sans-serif;letter-spacing:.18em;color:#9FC4F0}",
      ".xm-bebas{font-family:'Bebas Neue','Barlow Condensed',sans-serif;font-weight:400}",
      "#xmasBanner .xb-head{font-size:26px;line-height:.95;letter-spacing:.02em;color:#fff}",
      "#xmasBanner .xb-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:2px}",
      "#xmasBanner .xb-draw{padding:7px 11px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.16)}",
      ".xm-k{font:600 9px Inter,sans-serif;letter-spacing:.18em;color:#9FC4F0}",
      "#xmasBanner .xb-draw b{display:block;font:700 13px Inter,sans-serif;color:#fff}",
      "#xmasBanner .xb-enter{padding:11px 16px;border-radius:12px;background:#F2C14E;color:#1A1206;font-size:20px;letter-spacing:.06em}",
      "#xmasBanner .xb-again{display:block;margin:8px 0 0 auto;min-height:34px;padding:0 12px;border-radius:17px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#CFE6FF;font:600 12px Inter,sans-serif;cursor:pointer}",
      ".xm-vid{position:relative;width:100%;background:#000}",
      /* YouTube shows its title, logo and pause button only on hover or tap (and briefly at the start): a clear shield
         takes every touch so they stay hidden, and a slight zoom pushes the player's edges out of frame */
      ".xm-vid{overflow:hidden}",
      ".xm-vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0;transform:scale(1.3);transform-origin:50% 50%;pointer-events:none}",
      ".xm-shield{position:absolute;inset:0;z-index:1;background:transparent}",
      ".xm-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}",
      ".xm-vtag{position:absolute;left:10px;top:10px;z-index:2;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.6);font:700 10px Inter,sans-serif;letter-spacing:.16em;color:#fff;pointer-events:none}",
      ".xm-vid iframe{opacity:0;transition:opacity .6s ease}.xm-vid.ready iframe{opacity:1}",
      ".xm-snd{position:absolute;left:8px;top:8px;z-index:2;height:36px;padding:0 12px;border-radius:18px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.55);color:#fff;font:600 12px Inter,sans-serif;cursor:pointer}",
      ".xm-skip{position:absolute;right:8px;top:8px;z-index:2;min-width:64px;height:36px;border-radius:18px;border:1px solid rgba(255,255,255,.35);background:rgba(0,0,0,.55);color:#fff;font:600 12px Inter,sans-serif;cursor:pointer}",
      /* no progress bar; the video's bottom edge fades into the page (and hides any line the player draws there) */
      ".xm-bar{display:none}",
      ".xm-vid::after{content:'';position:absolute;left:0;right:0;bottom:0;height:7%;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(8,4,20,0) 0%,#080414 100%)}",
      ".xm-bar i{display:block;height:4px;width:0;background:#F2C14E;transition:width 1s linear}",
      /* the flyer */
      "#xmasFlyer{position:fixed;inset:0;z-index:2147483000;display:none;background:#080414;color:#F4F1EA;font-family:Inter,system-ui,sans-serif;overflow:hidden}",
      "#xmasFlyer.on{display:block}",
      "#xmasFlyer .xf-stage{position:relative;width:100%;max-width:480px;height:100%;margin:0 auto;overflow:hidden}",
      "#xmasFlyer .xf-bg{position:absolute;left:0;top:96px;width:100%;height:100%;object-fit:cover;object-position:50% 20%;transition:top .9s cubic-bezier(.2,.8,.2,1)}",
      "#xmasFlyer .xf-fade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,4,20,.95) 0%,rgba(8,4,20,.55) 26%,rgba(8,4,20,.08) 38%,rgba(8,4,20,.05) 50%,rgba(8,4,20,.55) 60%,rgba(8,4,20,.9) 72%,rgba(8,4,20,.96) 100%);transition:opacity .9s ease}",
      "#xmasFlyer .xf-fade2{position:absolute;inset:0;opacity:0;background:linear-gradient(180deg,rgba(8,4,20,.85) 0%,rgba(8,4,20,.35) 14%,rgba(8,4,20,.04) 24%,rgba(8,4,20,.04) 50%,rgba(8,4,20,.55) 60%,rgba(8,4,20,.9) 72%,rgba(8,4,20,.96) 100%);transition:opacity .9s ease}",
      "#xmasFlyer .xf-top{position:absolute;left:0;right:0;top:0;width:100%;aspect-ratio:16/9;overflow:hidden;transition:transform .9s cubic-bezier(.2,.8,.2,1),opacity .6s ease}",
      "#xmasFlyer .xf-top .xm-vid{height:100%}",
      "#xmasFlyer .xf-top img{width:100%;height:100%;object-fit:cover;display:block}",
      "#xmasFlyer .xf-grab{position:absolute;z-index:5;top:calc(8px + env(safe-area-inset-top,0px));left:50%;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:rgba(255,255,255,.55);box-shadow:0 1px 4px rgba(0,0,0,.5);pointer-events:none;animation:xfGrabOut .8s ease 3s forwards}",
      "@keyframes xfGrabOut{to{opacity:0}}",
      "#xmasFlyer .xf-stage{will-change:transform}",
      "#xmasFlyer .xf-x{position:absolute;z-index:5;top:calc(10px + env(safe-area-inset-top,0px));right:10px;width:44px;height:44px;border-radius:22px;background:rgba(5,12,34,.7);border:1px solid rgba(255,255,255,.25);color:#fff;font:700 18px Inter,sans-serif;cursor:pointer}",
      "#xmasFlyer .xf-again{position:absolute;z-index:5;top:calc(14px + env(safe-area-inset-top,0px));left:12px;min-height:36px;padding:0 12px;border-radius:18px;border:1px solid rgba(255,255,255,.3);background:rgba(8,4,20,.6);color:#fff;font:600 12px Inter,sans-serif;cursor:pointer;display:none}",
      "#xmasFlyer .xf-col{position:absolute;left:0;right:0;top:min(56.25vw,270px);bottom:0;padding:4px 16px calc(12px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:8px;overflow-y:auto;transition:top .9s cubic-bezier(.2,.8,.2,1)}",
      "#xmasFlyer.lifted .xf-top{transform:translateY(-110%);opacity:0}",
      "#xmasFlyer.lifted .xf-col{top:calc(60px + env(safe-area-inset-top,0px))}",
      "#xmasFlyer.lifted .xf-bg{top:20px}",
      "#xmasFlyer.lifted .xf-fade{opacity:0}#xmasFlyer.lifted .xf-fade2{opacity:1}",
      "#xmasFlyer.lifted .xf-again{display:block}",
      "#xmasFlyer .xf-cred{flex:0 0 auto;margin:-2px 0 -6px;text-align:right;font:500 9px Inter,sans-serif;color:rgba(255,255,255,.55)}",
      "#xmasFlyer.lifted .xf-cred{display:none}",
      "#xmasFlyer .xf-title{text-align:center;text-shadow:0 2px 10px rgba(0,0,0,.7)}",
      "#xmasFlyer .xf-pre{font:600 9.5px Inter,sans-serif;letter-spacing:.28em;color:#CFE6FF}",
      "#xmasFlyer .xf-title .xm-script{font-size:37px;line-height:1.05}",
      "#xmasFlyer .xf-h{font-size:34px;line-height:1;letter-spacing:.04em;color:#fff}",
      "#xmasFlyer .xf-stub{margin-top:auto;display:flex;border-radius:14px;overflow:hidden;background:#F7FBFF;color:#0A1A3D;box-shadow:0 8px 22px rgba(0,0,0,.4);flex:0 0 auto}",
      "#xmasFlyer .xf-stub .a{flex:1 1 auto;padding:10px 12px;display:flex;flex-direction:column;gap:3px}",
      "#xmasFlyer .xf-stub .when{font:700 10px Inter,sans-serif;letter-spacing:.18em;color:#4A5B7C}",
      "#xmasFlyer .xf-stub .where{font-size:21px;line-height:1;letter-spacing:.03em}",
      "#xmasFlyer .xf-stub .seats{display:flex;gap:14px;margin-top:2px}",
      "#xmasFlyer .xf-stub .seats i{display:block;font:600 9px Inter,sans-serif;font-style:normal;letter-spacing:.14em;color:#4A5B7C}",
      "#xmasFlyer .xf-stub .seats b{font:700 16px Inter,sans-serif}",
      "#xmasFlyer .xf-stub .b{flex:0 0 104px;border-left:2px dashed #B9CBE6;background:#0A1A3D;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center}",
      "#xmasFlyer .xf-stub .b b{font-family:'Bebas Neue',sans-serif;font-weight:400;font-size:19px;line-height:1}",
      "#xmasFlyer .xf-stats{flex:0 0 auto;max-height:0;opacity:0;overflow:hidden;transition:max-height .7s ease .3s,opacity .7s ease .3s,padding .7s ease .3s;padding:0 12px;border-radius:14px;background:rgba(242,193,78,.12);border:1px solid rgba(242,193,78,.45);display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;text-align:center;font:600 13px/1.3 Inter,sans-serif;color:#FFE9B0}",
      "#xmasFlyer.lifted .xf-stats{max-height:80px;opacity:1;padding:9px 12px}",
      "#xmasFlyer .xf-stats b{color:#fff;font-weight:800}#xmasFlyer .xf-stats i{font-style:normal;opacity:.5}",
      "#xmasFlyer .xf-box{padding:10px 12px;border-radius:14px;background:rgba(5,12,34,.86);border:1px solid rgba(255,255,255,.14);display:flex;flex-direction:column;gap:9px;flex:0 0 auto}",
      "#xmasFlyer .xf-line{display:flex;align-items:center;justify-content:space-between;gap:8px}",
      "#xmasFlyer .xf-sm{font:500 12px Inter,sans-serif;color:#C9D6EA}",
      "#xmasFlyer .xf-step{display:flex;align-items:center;gap:6px}",
      "#xmasFlyer .xf-step button{width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font:700 22px Inter,sans-serif;cursor:pointer}",
      "#xmasFlyer .xf-step b{min-width:30px;text-align:center;font:400 30px 'Bebas Neue',sans-serif;color:#fff}",
      "#xmasFlyer .xf-packs{display:flex;gap:8px}",
      "#xmasFlyer .xf-packs button{flex:1 1 0;min-height:44px;border-radius:12px;border:1px dashed rgba(255,255,255,.3);background:transparent;color:#fff;font:600 13px Inter,sans-serif;cursor:pointer}",
      "#xmasFlyer .xf-packs button.gold{border-color:#F2C14E}",
      "#xmasFlyer .xf-packs button.on{background:#F2C14E;border:1px solid #F2C14E;color:#1A1206;font-weight:800}",
      "#xmasFlyer button{transition:transform .08s ease,background .15s ease,color .15s ease;-webkit-tap-highlight-color:transparent}",
      "#xmasFlyer button:active{transform:scale(.96)}",
      "#xmasFlyer .xf-step button:active,#xmasFlyer .xf-packs button:active{background:rgba(242,193,78,.25)}",
      "#xmasFlyer .xf-buy{min-height:50px;border-radius:14px;border:0;background:#F2C14E;color:#1A1206;font:400 24px 'Bebas Neue',sans-serif;letter-spacing:.06em;cursor:pointer;flex:0 0 auto}",
      "#xmasFlyer .xf-buy.xf-short{background:#fff;color:#1A1206;font-size:19px;box-shadow:0 0 0 2px #F2C14E inset}",
      "#xmasFlyer .xf-buy.xf-confirm{background:#2FBF71;color:#06210f;animation:xfPulse 1s ease-in-out infinite}",
      "@keyframes xfPulse{50%{box-shadow:0 0 0 4px rgba(47,191,113,.35)}}",
      "#xmasFlyer .xf-cancel{flex:0 0 auto;align-self:center;margin-top:-4px;min-height:36px;padding:0 16px;border:0;background:none;color:#C9D6EA;font:600 13px Inter,sans-serif;text-decoration:underline;cursor:pointer}",
      "#xmasFlyer .xf-buy[disabled]{opacity:.55;cursor:default}",
      "#xmasFlyer .xf-comp{min-height:46px;border-radius:14px;border:1.5px solid #F2C14E;background:rgba(242,193,78,.12);color:#FFE9B0;font:700 14px Inter,sans-serif;cursor:pointer;flex:0 0 auto}",
      "#xmasFlyer .xf-msg{min-height:16px;text-align:center;font:600 12.5px Inter,sans-serif;color:#C9D6EA}",
      "#xmasFlyer .xf-msg.ok{color:#7EE2A8}#xmasFlyer .xf-msg.bad{color:#FF8A8A}",
      "#xmasFlyer .xf-rules{padding:10px 12px;border-radius:14px;background:rgba(5,12,34,.82);border:1px solid rgba(255,255,255,.12);display:flex;flex-direction:column;gap:5px;font:500 12px/1.4 Inter,sans-serif;color:#E6EEFA;flex:0 0 auto}",
      "#xmasFlyer .xf-rules b{color:#fff}#xmasFlyer .xf-rules .g{color:#F2C14E}",
      "#xmasFlyer .xf-foot{line-height:1.6;text-align:center;font:600 9.5px Inter,sans-serif;letter-spacing:.24em;color:#D9CCF2;flex:0 0 auto}"
    ].join("\n");
    document.head.appendChild(s);
  }

  /* ---------------- the trailer (YouTube's own player, muted so it can start on its own) ---------------- */
  function vidHTML() {
    return '<div class="xm-vid" style="height:100%"><img class="xm-poster" src="' + ART + '" alt="">' +
      '<iframe src="https://www.youtube-nocookie.com/embed/' + YT + '?autoplay=1&mute=0&enablejsapi=1&playsinline=1&controls=0&rel=0&modestbranding=1&cc_load_policy=0&iv_load_policy=3&start=0' +
      '&origin=' + encodeURIComponent(location.origin) + '" title="Disney On Ice presents Jump In! trailer" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
      '<div class="xm-shield" data-xm="sound" aria-hidden="true"></div>' +
      '<div class="xm-bar"><i></i></div></div>';
  }
  function ytCmd(host, func) {
    var f = host && host.querySelector("iframe"); if (!f || !f.contentWindow) return;
    try { f.contentWindow.postMessage(JSON.stringify({ event: "command", func: func, args: [] }), "*"); } catch (e) {}
  }
  function soundOn(host) { ytCmd(host, "unMute"); ytCmd(host, "setVolume"); }
  function noCaptions(host) {
    var f = host && host.querySelector("iframe"); if (!f || !f.contentWindow) return;
    [["unloadModule", ["captions"]], ["unloadModule", ["cc"]], ["setOption", ["captions", "track", {}]]].forEach(function (c) {
      try { f.contentWindow.postMessage(JSON.stringify({ event: "command", func: c[0], args: c[1] }), "*"); } catch (e) {}
    });
  }
  /* the player reports its time: show the video once it has really played 3.5 s, when YouTube's opening title is gone
     (a slow start keeps the art up longer instead of uncovering the title) */
  window.addEventListener("message", function (e) {
    if (!/youtube(-nocookie)?\.com$/.test(String(e.origin).replace(/^https?:\/\/(www\.)?/, ""))) return;
    var d; try { d = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch (x) { return; }
    var t = d && d.info && typeof d.info.currentTime === "number" ? d.info.currentTime : null;
    if (t == null || t < 3.5) return;
    document.querySelectorAll(".xm-vid:not(.ready) iframe").forEach(function (f) { if (f.contentWindow === e.source) f.closest(".xm-vid").classList.add("ready"); });
  });
  function runClip(host, done) {
    var fr = host.querySelector("iframe");
    if (fr) setTimeout(function () { var v = fr.closest(".xm-vid"); v && v.classList.add("ready"); }, 9000);   /* fallback; normally shown once it has really played 3.5 s */
    if (fr) fr.addEventListener("load", function () { try { fr.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*"); } catch (e) {} [300, 1400, 2500].forEach(function (ms) { setTimeout(function () { soundOn(host); noCaptions(host); }, ms); });   /* all inside the first 3 s, under the art */ });
    var bar = host.querySelector(".xm-bar i"), t = 0;
    clearInterval(host._clip);
    host._clip = setInterval(function () {
      t++; if (bar) bar.style.width = Math.min(100, Math.round(t / CLIP * 100)) + "%";
      if (t >= CLIP) { clearInterval(host._clip); done(); }
    }, 1000);
    host._clipDone = function () { clearInterval(host._clip); done(); };
  }

  /* ---------------- the banner ---------------- */
  var today = function () { var d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  function introDue() { return false; }   /* the Keymaster: no trailer on the banner, only on the flyer */
  function introSeen() { try { localStorage.setItem("xmas_intro_day", today()); } catch (e) {} }
  function bannerHost() {
    var h = $("rflHost"); if (h && h.parentNode) return { parent: h.parentNode, after: h };
    var f = $("socialFeed"); if (f && f.parentNode) return { parent: f.parentNode, before: f };
    return null;
  }
  function enterLabel() {
    var ph = phase();
    if (ph === "soon") return "OPENS " + laDraw(R.opens_at).toUpperCase();
    if (ph === "closed") return "SALES CLOSED";
    if (ph === "preview") return "PREVIEW";
    return "ENTER · " + fmt(R.ticket_price) + " ⬡";
  }
  function cardHTML() {
    return '<button type="button" class="xb-card" data-xm="open" aria-label="Open the Christmas Day on Ice raffle">' +
      '<div class="xb-art"><img src="' + ART + '" alt="Disney On Ice presents Jump In!"><span class="xm-cred">© Disney</span></div>' +
      '<div class="xb-body"><div class="xb-row"><span class="xm-script">Christmas Day on Ice</span><span class="xb-tag">RAFFLE</span></div>' +
      '<div class="xm-bebas xb-head">WIN A FAMILY 4-PACK</div>' +
      '<div class="xb-foot"><div class="xb-draw"><span class="xm-k">THE DRAW</span><b>' + esc(laDraw(R.closes_at)) + '</b></div>' +
      '<span class="xm-bebas xb-enter">' + esc(enterLabel()) + '</span></div></div></button>';
  }
  function paintBanner(intro) {
    var b = $("xmasBanner");
    if (b && !b.isConnected) b = null;
    if (!R) { b && b.remove(); document.documentElement.classList.remove("xmas-on"); return; }
    document.documentElement.classList.add("xmas-on");
    var at = bannerHost(); if (!at) return;
    if (!b) {
      b = document.createElement("div"); b.id = "xmasBanner";
      if (at.after) at.after.insertAdjacentElement("afterend", b); else at.parent.insertBefore(b, at.before);
      b.addEventListener("click", onBannerClick);
      intro = intro == null ? introDue() : intro;
    } else if (b.previousElementSibling !== at.after && at.after) { at.after.insertAdjacentElement("afterend", b); }
    if (intro) {
      b.innerHTML = '<div class="xb-box" style="aspect-ratio:16/9">' + vidHTML() + "</div>";
      b._intro = true; introSeen();
      runClip(b, function () { b._intro = false; paintBanner(false); });
      return;
    }
    if (b._intro) return;
    var html = '<div class="xb-box">' + cardHTML() + '</div>';
    if (b._html !== html) { b.innerHTML = html; b._html = html; }
  }
  function onBannerClick(e) {
    var a = e.target.closest("[data-xm]"); if (!a) return;
    var k = a.getAttribute("data-xm"), b = $("xmasBanner");
    if (k === "skip") { b._clipDone && b._clipDone(); }
    else if (k === "again") { b._html = null; paintBanner(true); }
    else if (k === "open") openFlyer();
  }

  /* ---------------- the flyer ---------------- */
  function flyer() {
    var f = $("xmasFlyer"); if (f) return f;
    f = document.createElement("div"); f.id = "xmasFlyer"; f.setAttribute("role", "dialog"); f.setAttribute("aria-modal", "true"); f.setAttribute("aria-label", "Christmas Day on Ice raffle");
    f.innerHTML = '<div class="xf-stage">' +
      '<img class="xf-bg" src="' + BG + '" alt="">' +
      '<div class="xf-fade"></div><div class="xf-fade2"></div>' +
      '<div class="xf-top" id="xfTop"></div>' +
      '<div class="xf-grab" aria-hidden="true"></div>' +
      '<button type="button" class="xf-again" data-xf="again">▶ Trailer</button>' +
      '<div class="xf-col" id="xfCol"></div></div>';
    document.body.appendChild(f);
    f.addEventListener("click", onFlyerClick);
    swipeArm(f);
    return f;
  }
  function startTop() {
    var f = flyer(), top = $("xfTop");
    f.classList.remove("lifted");
    top.innerHTML = vidHTML();
    runClip(top, function () { f.classList.add("lifted"); });   /* the panel slides away at 0:21; the trailer keeps playing, so the sound carries on */
  }
  function openFlyer() {
    if (!R) return;
    var f = flyer(); qty = 1;
    var gb = f.querySelector(".xf-grab"); if (gb) { gb.style.animation = "none"; void gb.offsetWidth; gb.style.animation = ""; }
    f.classList.add("on"); document.documentElement.style.overflow = "hidden";
    startTop(); paintFlyer(); refresh();
    try { history.pushState({ xmas: 1 }, ""); } catch (e) {}
  }
  function closeFlyer() {
    var f = $("xmasFlyer"); if (!f || !f.classList.contains("on")) return;
    var top = $("xfTop"); clearInterval(top && top._clip); if (top) top.innerHTML = "";
    f.classList.remove("on", "lifted"); document.documentElement.style.overflow = ""; armed = false; clearTimeout(armT);
  }
  window.addEventListener("popstate", function () { closeFlyer(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && $("xmasFlyer") && $("xmasFlyer").classList.contains("on")) dismiss(); });
  function dismiss() { try { if (history.state && history.state.xmas) history.back(); else closeFlyer(); } catch (x) { closeFlyer(); } }
  /* pull down (from the top of the scroll) or swipe sideways to close: the flyer follows the finger, closes past
     ~110px or on a quick flick, and springs back otherwise */
  function swipeArm(f) {
    if (f._swipe) return; f._swipe = true;
    var stage = f.querySelector(".xf-stage"), col = null, sx = 0, sy = 0, st = 0, mode = null, dx = 0, dy = 0;
    function start(x, y) { col = $("xfCol"); sx = x; sy = y; st = Date.now(); mode = null; dx = dy = 0; stage.style.transition = "none"; }
    function move(x, y, ev) {
      dx = x - sx; dy = y - sy;
      if (!mode) {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.2) mode = "x";
        else if (dy > 12 && dy > Math.abs(dx) * 1.2 && (!col || col.scrollTop <= 0)) mode = "y";
        else if (Math.abs(dy) > 12) mode = "scroll";
      }
      if (mode === "x") { stage.style.transform = "translateX(" + dx + "px) rotate(" + (dx / 40) + "deg)"; stage.style.opacity = String(Math.max(.4, 1 - Math.abs(dx) / 600)); ev && ev.cancelable && ev.preventDefault(); }
      else if (mode === "y") { stage.style.transform = "translateY(" + Math.max(0, dy) + "px)"; stage.style.opacity = String(Math.max(.4, 1 - dy / 900)); ev && ev.cancelable && ev.preventDefault(); }
    }
    function end() {
      var fast = Date.now() - st < 260, far = mode === "x" ? Math.abs(dx) : mode === "y" ? dy : 0;
      stage.style.transition = "transform .28s ease, opacity .28s ease";
      if ((mode === "x" || mode === "y") && (far > 110 || (fast && far > 40))) {
        stage.style.transform = mode === "x" ? "translateX(" + (dx > 0 ? 120 : -120) + "%)" : "translateY(100%)";
        stage.style.opacity = "0";
        setTimeout(function () { dismiss(); stage.style.transition = "none"; stage.style.transform = ""; stage.style.opacity = ""; }, 260);
      } else { stage.style.transform = ""; stage.style.opacity = ""; }
      mode = null;
    }
    f.addEventListener("touchstart", function (e) { if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    f.addEventListener("touchmove", function (e) { if (e.touches.length === 1) move(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false });
    f.addEventListener("touchend", end, { passive: true });
    var down = false;   /* a mouse drag does the same on a computer */
    f.addEventListener("mousedown", function (e) { if (e.button === 0 && !e.target.closest("button,input")) { down = true; start(e.clientX, e.clientY); } });
    window.addEventListener("mousemove", function (e) { if (down) move(e.clientX, e.clientY, e); });
    window.addEventListener("mouseup", function () { if (down) { down = false; end(); } });
  }
  function maxQty() { return Math.max(0, cap() - mine()); }
  function paintFlyer(msg, cls) {
    var col = $("xfCol"); if (!col || !R) return;
    var ph = phase(), room = maxQty();
    if (qty > room) qty = Math.max(1, room); if (qty < 1) qty = 1;
    var cost = costOf(qty), saved = qty * R.ticket_price - cost, bq = R.bundle_qty, bp = R.bundle_price;
    var short = ph === "open" && room > 0 && BANK != null && BANK < cost;
    var canBuy = ph === "open" && room > 0 && !busy && !short;
    var guest = !uid();
    if (guest) { short = false; canBuy = false; }
    var buyLbl = guest ? "SIGN IN TO ENTER" : ph === "soon" ? "TICKETS GO ON SALE " + laDraw(R.opens_at).toUpperCase()
      : ph === "closed" ? "TICKET SALES HAVE CLOSED"
      : ph === "preview" ? "PREVIEW · NOT LIVE YET"
      : room <= 0 ? "YOU HOLD THE MAX · " + cap() + " TICKETS"
      : busy ? "WRITING YOUR TICKET…"
      : short ? "GET MORE PORT BUCKS · YOU NEED " + fmt(cost - BANK) + " MORE ⬡"
      : "BUY " + qty + " TICKET" + (qty === 1 ? "" : "S") + " · " + fmt(cost) + " ⬡";
    var comp = COMPS.length && ph === "open" ? '<button type="button" class="xf-comp" data-xf="comp">🎁 You have ' + COMPS.length + ' free ticket' + (COMPS.length === 1 ? "" : "s") + ' from the Keymaster · TAP TO CLAIM</button>' : "";
    var packs = bq > 1 && bp ? '<div class="xf-packs"><button type="button" class="gold' + (qty === bq ? " on" : "") + '" data-xf="q" data-q="' + bq + '" aria-pressed="' + (qty === bq) + '">' + bq + '-pack · ' + fmt(bp) + ' ⬡</button>' +
      (cap() >= bq * 2 ? '<button type="button" class="' + (qty === bq * 2 ? "on" : "") + '" data-xf="q" data-q="' + bq * 2 + '" aria-pressed="' + (qty === bq * 2) + '">Two ' + bq + '-packs · ' + fmt(bp * 2) + ' ⬡</button>' : "") + "</div>" : "";
    var note = saved > 0 ? "You save " + fmt(saved) + " ⬡" : (bq > 1 && bp ? "Buy " + bq + " and save " + fmt(bq * R.ticket_price - bp) + " ⬡" : "");
    col.innerHTML =
      '<div class="xf-cred">© Disney</div>' +
      '<div class="xf-title"><div class="xf-pre">THE ORDER OF THE SHADOW HOOK PRESENTS</div>' +
      '<div class="xm-script">Christmas Day on Ice</div><div class="xm-bebas xf-h">RAFFLE · WIN A FAMILY 4-PACK</div></div>' +
      '<div class="xf-stub"><div class="a"><div class="when">' + EVENT.when + '</div><div class="xm-bebas where">' + EVENT.where + '</div>' +
      '<div class="seats"><div><i>SECTION</i><b>' + EVENT.sec + '</b></div><div><i>ROW</i><b>' + EVENT.row + '</b></div><div><i>SEATS</i><b>' + EVENT.seats + '</b></div></div></div>' +
      '<div class="b"><span class="xm-k">THE DRAW</span><b>' + esc(laDraw(R.closes_at)).replace(" · ", "<br>") + '</b></div></div>' +
      statsHTML() + comp +
      '<div class="xf-box"><div class="xf-line"><div><div class="xm-k" style="font-size:10px">YOUR TICKETS' + (mine() ? " · YOU HOLD " + mine() : "") + '</div>' +
      '<div class="xf-sm">' + fmt(R.ticket_price) + ' ⬡ each' + (bq > 1 && bp ? " · " + bq + " for " + fmt(bp) + " ⬡" : "") + ' · max ' + cap() + '</div></div>' +
      '<div class="xf-step"><button type="button" data-xf="minus" aria-label="One fewer ticket">−</button><b>' + qty + '</b><button type="button" data-xf="plus" aria-label="One more ticket">+</button></div></div>' +
      packs + '<div class="xf-line xf-sm"><span>' + note + '</span><span>Your bank: ' + (BANK == null ? "…" : fmt(BANK)) + ' ⬡</span></div></div>' +
      (guest ? '<button type="button" class="xf-buy" data-xf="signin">SIGN IN TO ENTER</button>'
        : short && !busy ? '<button type="button" class="xf-buy xf-short" data-xf="bank">' + esc(buyLbl) + '</button>'
        : armed && canBuy ? '<button type="button" class="xf-buy xf-confirm" data-xf="confirm">CONFIRM · ' + qty + ' TICKET' + (qty === 1 ? "" : "S") + ' FOR ' + fmt(cost) + ' ⬡</button>' +
            '<button type="button" class="xf-cancel" data-xf="cancel">cancel</button>'
        : '<button type="button" class="xf-buy" data-xf="buy"' + (canBuy ? "" : " disabled") + '>' + esc(buyLbl) + '</button>') +
      '<div class="xf-msg' + (cls ? " " + cls : "") + '">' + esc(msg || "") + '</div>' +
      '<div class="xf-rules"><div>Bought with <span class="g">Port Bucks</span>. Cap of <b>' + cap() + ' tickets a member</b>, so everyone keeps a real shot.</div>' +
      '<div>One ticket is drawn at random. The winner gets all four seats <b>transferred through Ticketmaster</b> (a free account is all you need).</div>' +
      '<div><span class="g"><b style="color:#F2C14E">Children under 2 are free</b></span>, so bring the little ones along.</div></div>' +
      '<div class="xf-foot">THE ORDER OF THE SHADOW HOOK<br>SAN PEDRO BAY</div>';
  }
  function statsHTML() {
    var total = ST && typeof ST.total === "number" ? ST.total : null, who = ST && typeof ST.entrants === "number" ? ST.entrants : null, m = mine();
    var body;
    if (total == null) body = "🎟 Counting the tickets…";
    else if (total < 10) body = "🎟 <b>Be one of the first in</b> · the drum is just filling up";
    else body = "🎟 <b>" + fmt(total) + "</b> tickets in" + (who != null ? " <i>·</i> <b>" + fmt(who) + "</b> member" + (who === 1 ? "" : "s") : "");
    if (m > 0 && total) { var odds = Math.max(1, Math.round(total / m)); body += " <i>·</i> your odds <b>1 in " + fmt(odds) + "</b>"; }
    return '<div class="xf-stats" aria-live="polite">' + body + "</div>";
  }
  async function onFlyerClick(e) {
    var a = e.target.closest("[data-xf],[data-xm]"); if (!a) return;
    var k = a.getAttribute("data-xf") || a.getAttribute("data-xm");
    if (k === "close") { dismiss(); return; }
    if (k === "again") { startTop(); return; }
    if (k === "skip") { var top = $("xfTop"); top && top._clipDone && top._clipDone(); return; }
    if (k === "sound") { soundOn($("xfTop")); return; }
    if (k === "minus") { qty = Math.max(1, qty - 1); armed = false; clearTimeout(armT); paintFlyer(); return; }
    if (k === "plus") { qty = Math.min(Math.max(1, maxQty()), qty + 1); armed = false; clearTimeout(armT); paintFlyer(); return; }
    if (k === "q") { qty = Math.min(Math.max(1, maxQty()), +a.getAttribute("data-q")); armed = false; clearTimeout(armT); paintFlyer(); return; }
    if (k === "buy") { armed = true; clearTimeout(armT); armT = setTimeout(function () { armed = false; paintFlyer(); }, 6000); paintFlyer(); return; }
    if (k === "confirm") { armed = false; clearTimeout(armT); return buy(); }
    if (k === "cancel") { armed = false; clearTimeout(armT); paintFlyer(); return; }
    if (k === "bank") return toBank();
    if (k === "signin") { dismiss(); return; }   /* the gate is right behind the flyer */
    if (k === "comp") return claim();
  }
  /* short on Port Bucks: close the flyer and open the app's Bank (or, if the Bank is closed, how to earn them) */
  function toBank() {
    dismiss();
    setTimeout(function () {
      try {
        if (typeof window.mintOpen === "function" && window.mintOpen() && typeof window.bankOpen === "function") { window.bankOpen(); return; }
        var rs = document.getElementById("rulesSheet");
        if (rs) { try { typeof window.paintRateCard === "function" && window.paintRateCard(); } catch (e) {} rs.classList.add("on"); return; }
        if (typeof window.bankOpen === "function") window.bankOpen();
      } catch (e) {}
    }, 320);
  }
  function errText(err) { return String((err && (err.message || err.details)) || err || "something went wrong").replace(/^(raffle|claim):\s*/i, ""); }
  async function buy() {
    if (busy || !R) return; busy = true; paintFlyer("writing your ticket…");
    try {
      var r = await window.SB.rpc("raffle_buy_mix", { p_raffle: R.id, p_qty: qty }); if (r.error) throw r.error;
      var d = r.data || {}, n = d.bought || qty;
      if (typeof d.balance === "number") { BANK = d.balance; try { window.CREDITS = d.balance; typeof window.renderCredits === "function" && window.renderCredits(); } catch (x) {} }
      ST = { total: d.total, entrants: d.entrants, mine: d.mine }; busy = false; qty = 1;
      paintFlyer("✓ " + n + " ticket" + (n === 1 ? "" : "s") + " in the drum. Good luck!", "ok"); paintBanner();
    } catch (err) {
      busy = false;
      if (/that takes [\d,]+ ⬡/.test(errText(err))) { await refresh(true); }
      paintFlyer(errText(err), "bad");
    }
  }
  async function claim() {
    if (busy || !COMPS.length) return; busy = true; paintFlyer("claiming your free ticket…");
    try {
      var r = await window.SB.rpc("raffle_claim_comp", { p_comp: COMPS[0].id }); if (r.error) throw r.error;
      COMPS.shift(); busy = false; await refresh(true);
      paintFlyer("✓ Your free ticket is in the drum. Good luck!", "ok");
    } catch (err) { busy = false; paintFlyer(errText(err), "bad"); }
  }

  /* ---------------- data ---------------- */
  async function refresh(quiet) {
    if (!R || !window.SB) return;
    try { var s = await window.SB.rpc("raffle_state", { p_raffle: R.id }); if (!s.error && s.data) ST = s.data; } catch (e) {}
    var me = uid();
    if (me) {
      try { var p = await window.SB.from("profiles").select("port_bucks").eq("id", me).maybeSingle(); if (p && p.data) BANK = p.data.port_bucks || 0; } catch (e) {}
      try { var c = await window.SB.from("raffle_comps").select("id,qty").eq("raffle_id", R.id).eq("to_id", me).is("claimed_at", null); COMPS = (c && c.data) || []; } catch (e) {}
    }
    if (!quiet && $("xmasFlyer") && $("xmasFlyer").classList.contains("on")) paintFlyer();
  }
  async function load() {
    if (!window.SB) return;
    if (typeof window.rflIsOn === "function" && !window.rflIsOn()) { R = null; paintBanner(); closeFlyer(); return; }
    try {
      var r = await window.SB.from("raffles").select("*").eq("design", DESIGN).in("status", ["live", "draft"]).order("created_at", { ascending: false }).limit(4);
      var rows = (r && r.data) || [], pv = "";
      try { pv = localStorage.getItem("shadowhook_rfl_preview") || ""; } catch (e) {}
      R = rows.find(function (x) { return x.status === "live"; }) || (isKM() && rows.find(function (x) { return x.status === "draft" && x.id === pv; })) || null;
    } catch (e) { R = null; }
    paintBanner();
    if (R && !load._deep && (/(^|[#&])raffle\b/.test(location.hash.slice(1)) || /[?&]raffle\b/.test(location.search) || /\/raffle\/?$/.test(location.pathname))) {
      load._deep = true;
      try { history.replaceState(null, "", location.pathname.replace(/\/raffle\/?$/, "/") + location.search.replace(/[?&]raffle(=[^&]*)?/, "").replace(/^&/, "?")); } catch (e) {}
      setTimeout(openFlyer, 400);
    }
  }

  /* the app's own "open the raffle" doors lead here while this raffle is up */
  function hook() {
    ["rflOpen", "rflFlyer"].forEach(function (n) {
      var orig = window[n]; if (typeof orig !== "function" || orig._xmas) return;
      var w = function () { if (R) return openFlyer(); return orig.apply(this, arguments); }; w._xmas = true; window[n] = w;
    });
  }

  css();
  var tries = 0, wait = setInterval(function () {
    if (window.SB) { clearInterval(wait); hook(); load(); }
    else if (++tries > 120) clearInterval(wait);
  }, 500);
  setInterval(function () { hook(); load(); }, 60000);
  setInterval(function () { if (R) { paintBanner(); } }, 4000);   /* the app redraws the feed: keep the banner seated */
  document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
})();
