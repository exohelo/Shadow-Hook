/* The Shadow Hook · survey.js (nov27a) — the app survey.
   Arrives as a flyer in private messages (from THE_SHADOW_HOOK, kind "promo", url "...#promo=survey"); the flyer's button
   opens this sheet. Ten questions, one per screen, tap to answer; the last one is typed: the feature they wish the app had.
   Finishing it puts one free ticket in the open raffle (survey_submit). The Keymaster reads the answers in the Command
   Center → Analytics → Survey. */
(function () {
  "use strict";
  if (window.__shkSurvey) return; window.__shkSurvey = true;
  var SURVEY = "app-nov26";
  var Q = [
    { k: "ease", t: "How easy is the app to use?", o: ["Very easy", "Easy", "OK", "Hard", "Very hard"] },
    { k: "most", t: "What do you use the most?", sub: "Pick all that fit", multi: true, o: ["The Wire / the call", "Dockets / my pay", "Social / the Board", "Ports & yard maps", "Take: drops & marks", "Games & Messy", "Mayday"] },
    { k: "hardest", t: "What's the hardest part to figure out?", o: ["Nothing, it's all easy", "The Wire / the call", "Dockets / logging jobs", "Social / the Board", "Ports & maps", "Take: drops & marks", "The menus / finding things"] },
    { k: "themes", t: "The holiday themes (Christmas, Halloween…)", o: ["Love them", "They're fine", "Too much, tone it down", "Turn them off for me"] },
    { k: "look", t: "How does the app look to you?", o: ["Just right", "A little too cartoony", "Too childish, it needs a grown-up redesign", "Too plain"] },
    { k: "read", t: "Is everything easy to read?", o: ["Yes", "Text is too small", "Text is too big", "Hard to read in the sun"] },
    { k: "trust", t: "How much do you trust the call (the prediction)?", o: ["A lot", "Somewhat", "Not much", "I don't use it"] },
    { k: "often", t: "How often do you open the app?", o: ["Every shift", "A few times a week", "About once a week", "Rarely"] },
    { k: "recommend", t: "Would you tell another casual to get it?", o: ["Already have", "Yes", "Maybe", "No"] },
    { k: "wish", t: "What do you wish the app had?", sub: "A feature, a fix, something you hate. Type anything. (Optional)", text: true }
  ];
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function css() {
    if ($("svCss")) return;
    var s = document.createElement("style"); s.id = "svCss";
    s.textContent =
      "#svSheet{position:fixed;inset:0;z-index:99995;background:rgba(8,10,16,.72);display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}" +
      "#svSheet .sv{width:min(520px,100%);max-height:92vh;overflow:auto;background:#14121c;color:#f3eef8;border-radius:22px 22px 0 0;padding:18px 18px calc(18px + env(safe-area-inset-bottom));box-shadow:0 -10px 40px #0008;font-family:Inter,system-ui,sans-serif}" +
      "html.daylight #svSheet .sv{background:#fffaf5;color:#2b1638}" +
      "#svSheet .sv-top{display:flex;align-items:center;gap:10px;margin-bottom:14px}#svSheet .sv-x{margin-left:auto;background:none;border:0;color:inherit;opacity:.6;font-size:22px;line-height:1;padding:4px 6px}" +
      "#svSheet .sv-bar{flex:1;height:6px;border-radius:9px;background:rgba(127,127,127,.25);overflow:hidden}#svSheet .sv-bar i{display:block;height:100%;background:linear-gradient(90deg,#2fae6c,#7ce0a0);transition:width .25s}" +
      "#svSheet .sv-n{font:700 12px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;opacity:.7}" +
      "#svSheet h3{margin:4px 0 4px;font:800 22px/1.2 'Barlow Condensed',Inter,sans-serif;letter-spacing:.02em}#svSheet .sv-sub{font-size:13px;opacity:.7;margin-bottom:12px}" +
      "#svSheet .sv-o{display:block;width:100%;text-align:left;margin:8px 0;padding:14px 14px;border-radius:14px;border:1.5px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit;font:600 15px/1.3 Inter,sans-serif}" +
      "#svSheet .sv-o.on{border-color:#2fae6c;background:rgba(47,174,108,.16);box-shadow:inset 0 0 0 1px #2fae6c}" +
      "#svSheet textarea{width:100%;box-sizing:border-box;min-height:130px;padding:12px;border-radius:14px;border:1.5px solid rgba(127,127,127,.35);background:rgba(127,127,127,.08);color:inherit;font:15px/1.4 Inter,sans-serif;resize:vertical}" +
      "#svSheet .sv-nav{display:flex;gap:8px;margin-top:14px}#svSheet .sv-nav button{flex:1;padding:14px;border-radius:14px;border:0;font:800 15px/1 'Barlow Condensed',sans-serif;letter-spacing:.08em}" +
      "#svSheet .sv-back{background:rgba(127,127,127,.18);color:inherit}#svSheet .sv-next{background:#1f8f5f;color:#fff}#svSheet .sv-next:disabled{opacity:.4}" +
      "#svSheet .sv-done{text-align:center;padding:18px 6px 8px}#svSheet .sv-done .big{font-size:54px;line-height:1}#svSheet .sv-done h3{margin-top:10px}";
    document.head.appendChild(s);
  }
  var A = {}, i = 0, busy = false;
  function close() { var s = $("svSheet"); if (s) s.remove(); }
  function draw() {
    var s = $("svSheet"); if (!s) return;
    var q = Q[i], pct = Math.round((i / Q.length) * 100), v = A[q.k];
    var body = '<div class="sv-top"><span class="sv-n">' + (i + 1) + ' / ' + Q.length + '</span><span class="sv-bar"><i style="width:' + pct + '%"></i></span><button class="sv-x" data-sv="x" aria-label="Close">✕</button></div>' +
      '<h3>' + esc(q.t) + '</h3>' + (q.sub ? '<div class="sv-sub">' + esc(q.sub) + '</div>' : '<div class="sv-sub">&nbsp;</div>');
    if (q.text) body += '<textarea id="svWish" maxlength="1500" placeholder="I wish the app had…">' + esc(v || "") + '</textarea>';
    else body += q.o.map(function (o, j) { var on = q.multi ? (Array.isArray(v) && v.indexOf(o) > -1) : v === o; return '<button class="sv-o' + (on ? " on" : "") + '" data-sv="o" data-j="' + j + '">' + esc(o) + '</button>'; }).join("");
    var ok = q.text || (q.multi ? Array.isArray(v) && v.length : !!v);
    body += '<div class="sv-nav">' + (i ? '<button class="sv-back" data-sv="back">Back</button>' : "") +
      '<button class="sv-next" data-sv="next"' + (ok ? "" : " disabled") + '>' + (i === Q.length - 1 ? "SEND IT · 🎟 +1 TICKET" : "NEXT") + '</button></div>';
    s.querySelector(".sv").innerHTML = body;
  }
  function done(msg, sub) {
    var s = $("svSheet"); if (!s) return;
    s.querySelector(".sv").innerHTML = '<div class="sv-done"><div class="big">🎟</div><h3>' + esc(msg) + '</h3><div class="sv-sub">' + esc(sub) + '</div><div class="sv-nav"><button class="sv-next" data-sv="x">CLOSE</button></div></div>';
  }
  async function submit() {
    if (busy) return; busy = true;
    var w = $("svWish"); A.wish = w ? w.value : (A.wish || "");
    var ans = {}; Q.forEach(function (q) { if (!q.text) ans[q.k] = A[q.k]; });
    try {
      var r = await window.SB.rpc("survey_submit", { p_survey: SURVEY, p_answers: ans, p_wish: A.wish || "" });
      var d = r && r.data || {};
      if (r.error || !d.ok) { busy = false; try { toast("Couldn't send it: " + ((r.error && r.error.message) || d.why || "try again")); } catch (e) {} return; }
      if (d.already) done("You already answered", "Thank you. Your ticket is in.");
      else if (d.ticket) done("Thank you!", "One free ticket is in the " + (d.raffle || "raffle") + ". We read every answer.");
      else done("Thank you!", "We read every answer.");
      try { localStorage.setItem("shk_survey_" + SURVEY, "1"); } catch (e) {}
    } catch (e) { try { toast("Couldn't send it. Try again."); } catch (x) {} }
    busy = false;
  }
  async function open() {
    if (!window.SB || !window.__shkUid) { try { toast("Sign in to take the survey."); } catch (e) {} return; }
    css(); close();
    var s = document.createElement("div"); s.id = "svSheet"; s.innerHTML = '<div class="sv"></div>'; document.body.appendChild(s);
    try { var m = await window.SB.rpc("survey_mine", { p_survey: SURVEY }); if (m && m.data && m.data.done) { done("You already answered", "Thank you. Your ticket is in."); return; } } catch (e) {}
    A = {}; i = 0; draw();
  }
  window.shkSurvey = open;
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("#svSheet [data-sv]");
    if (!b) { if (e.target && e.target.id === "svSheet") close(); return; }
    var k = b.getAttribute("data-sv"), q = Q[i];
    if (k === "x") return close();
    if (k === "o") {
      var o = q.o[+b.getAttribute("data-j")];
      if (q.multi) { var a = Array.isArray(A[q.k]) ? A[q.k] : []; var at = a.indexOf(o); at > -1 ? a.splice(at, 1) : a.push(o); A[q.k] = a; draw(); }
      else { A[q.k] = o; draw(); setTimeout(function () { if (Q[i] === q && i < Q.length - 1) { i++; draw(); } }, 220); }
      return;
    }
    if (k === "back") { if (q.text) { var w = $("svWish"); if (w) A.wish = w.value; } if (i > 0) { i--; draw(); } return; }
    if (k === "next") { if (i < Q.length - 1) { i++; draw(); } else submit(); }
  });
  if (/[?&]survey\b/.test(location.search)) setTimeout(open, 2500);

  /* ── Command Center → Analytics → Survey (Keymaster) ── */
  function kmCard() {
    var sh = $("kmSheet"), card = sh && sh.querySelector(".sheet-card"); if (!card || $("kmSurveyCard")) return;
    var d = document.createElement("details"); d.id = "kmSurveyCard"; d.className = "card";
    d.innerHTML = '<summary style="cursor:pointer;font:800 13px/1 \'Barlow Condensed\',sans-serif;letter-spacing:.12em;padding:10px 4px">📝 THE SURVEY <span id="kmSvN" style="opacity:.7"></span></summary><div id="kmSvBody" style="font-size:12.5px;line-height:1.5;padding:4px 2px 8px">opening…</div>';
    card.appendChild(d);
    d.addEventListener("toggle", function () { if (d.open) kmLoad(); });
  }
  async function kmLoad() {
    var b = $("kmSvBody"); if (!b) return;
    try {
      var r = await window.SB.rpc("survey_results", { p_survey: SURVEY }); if (r.error) throw r.error;
      var x = r.data || {}, n = x.n || 0, h = '<div><b>' + n + '</b> answered of <b>' + (x.sent || 0) + '</b> sent' + (x.sent ? ' · ' + Math.round(100 * n / x.sent) + '%' : '') + '</div>';
      $("kmSvN").textContent = n ? "· " + n : "";
      Q.forEach(function (q) {
        if (q.text) return; var c = (x.counts || {})[q.k] || {}, tot = 0; Object.keys(c).forEach(function (k) { tot += c[k]; });
        h += '<div style="margin-top:10px;font-weight:700">' + esc(q.t) + '</div>';
        q.o.forEach(function (o) { var v = c[o] || 0, p = n ? Math.round(100 * v / n) : 0;
          h += '<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><span style="flex:0 0 46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(o) + '</span><span style="flex:1;height:8px;border-radius:6px;background:rgba(127,127,127,.2);overflow:hidden"><i style="display:block;height:100%;width:' + p + '%;background:#2fae6c"></i></span><span style="flex:0 0 52px;text-align:right">' + v + ' · ' + p + '%</span></div>'; });
      });
      var w = x.wishes || [];
      h += '<div style="margin-top:12px;font-weight:700">What they wish the app had (' + w.length + ')</div>' +
        (w.length ? w.map(function (it) { return '<div style="margin:6px 0;padding:8px 10px;border-radius:10px;background:rgba(127,127,127,.1)"><b>' + esc(it.h || "a casual") + '</b>: ' + esc(it.w) + '</div>'; }).join("") : '<div style="opacity:.7">none yet</div>');
      b.innerHTML = h;
    } catch (e) { b.textContent = "couldn't load: " + (e.message || e); }
  }
  var kt = 0, kw = setInterval(function () { kmCard(); if ($("kmSurveyCard") || ++kt > 120) clearInterval(kw); }, 1000);
})();
