/* The Shadow Hook · hall_gate.js (nov1b) — getting a casual from another hall through the gate.
   The gate checks new members against the LA/LB casual list built into the app, so a Local 10 casual was always
   "Access Denied". This adds a hall switch to the gate. In SF mode:
     · the number field takes their casual ID number (Local 10 calls casuals by number: "IDs, you are at 3905")
     · the gate asks the server (gate_check) whether the Keymaster has let that card in for Local 10
     · if yes, the normal "THE GATE OPENS" step runs (handle, password); the account id is S + the number (S03905)
     · if not, one tap asks to be let in (join_request); every Keymaster gets a bell + phone alert
   After sign-up the new member is put in their hall (claim_hall). Keymasters see pending requests on the Ports tab
   while looking at that hall, with Let in / Decline. */
(function () {
  "use strict";
  if (window.SHK_HALL_GATE) return;
  var HALLS = { lalb: { label: "LA / Long Beach", sub: "Local 13" }, sf: { label: "SF Bay / Oakland", sub: "Local 10" } };
  var mode = "lalb";
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function normName(s) { return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim(); }
  function pretty(s) { try { return typeof window.prettyName === "function" ? window.prettyName(s) : s; } catch (e) { return s; } }
  /* A Local 10 card number may print like LA's (a letter and digits, B3905) or as plain digits (3905). The account id
     keeps the letter and puts a 9 in front of a four-digit number (B93905, S93905 when there's no letter): LA cards are
     always a letter and four digits, so the two halls can never share an account id. */
  function cardFor(port, raw) {
    var m = /^\s*N?([A-Za-z])?\s*-?\s*(\d{2,5})\s*$/.exec(String(raw || ""));
    if (!m) return null;
    var L = (m[1] || "S").toUpperCase(), d = m[2], card = d.length <= 4 ? L + "9" + d.padStart(4, "0") : L + d;
    return { card: card, num: (m[1] ? m[1].toUpperCase() : "") + d, digits: d, raw: String(raw).trim().toUpperCase() };
  }
  var CSS = ".hg-switch{display:flex;gap:8px;margin:0 0 14px}.hg-switch button{flex:1;padding:9px 6px;border-radius:10px;border:1px solid var(--line,#333);background:transparent;color:var(--steel,#aaa);font:700 12px/1.2 Barlow Condensed,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}" +
    ".hg-switch button small{display:block;font:500 10px Inter,system-ui,sans-serif;letter-spacing:0;text-transform:none;opacity:.8}.hg-switch button.on{border-color:var(--copper-hi,#e8a33d);color:var(--copper-hi,#e8a33d)}" +
    ".hg-box{margin-top:14px;padding:12px;border:1px dashed var(--copper-hi,#e8a33d);border-radius:10px;font:13px/1.45 Inter,system-ui,sans-serif;color:var(--bone,#eee)}.hg-box .btn{margin-top:10px}" +
    ".jr-card{margin:12px 0}.jr-card .jr-h{padding:12px 14px 4px;font:700 15px/1 Barlow Condensed,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--bone)}.jr-card .jr-b{padding:4px 14px 12px}" +
    ".jr-it{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--line);font:13px Inter,system-ui,sans-serif;color:var(--bone)}.jr-it small{display:block;color:var(--steel);font-size:11px}" +
    ".jr-it button{border-radius:8px;padding:6px 10px;font:700 11px/1 Barlow Condensed,sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;background:none;border:1px solid var(--line);color:var(--steel)}.jr-it .jr-ok{border-color:#58d68d;color:#58d68d;margin-left:auto}";
  function css() { if ($("hgCss")) return; var st = document.createElement("style"); st.id = "hgCss"; st.textContent = CSS; document.head.appendChild(st); }

  /* ---------------- the gate ---------------- */
  var LA_LABEL = null, LA_PH = null;
  function paintMode() {
    var lbl = document.querySelector('label[for="workId"]'), inp = $("workId"), so = $("scanOffer"), sw = $("hgSwitch");
    if (!inp) return;
    if (LA_LABEL == null && lbl) { LA_LABEL = lbl.textContent; LA_PH = inp.getAttribute("placeholder"); }
    if (sw) sw.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-hall") === mode); });
    if (mode === "sf") {
      if (lbl) lbl.textContent = "Dispatch # — as it reads on your casual card";
      inp.setAttribute("placeholder", "e.g. B3905"); inp.setAttribute("maxlength", "7"); inp.removeAttribute("inputmode");
      if (so) so.style.display = "none";
    } else {
      if (lbl && LA_LABEL != null) lbl.textContent = LA_LABEL;
      if (LA_PH != null) inp.setAttribute("placeholder", LA_PH); inp.setAttribute("maxlength", "6"); inp.removeAttribute("inputmode");
    }
    var box = $("hgBox"); box && box.remove();
    var im = $("idMsg"); im && (im.textContent = "");
  }
  function mountSwitch() {
    var body = $("formBody"), btn = $("joinBtn"); if (!body || !btn || $("hgSwitch")) return;
    css();
    var sw = document.createElement("div"); sw.id = "hgSwitch"; sw.className = "hg-switch"; sw.setAttribute("role", "group"); sw.setAttribute("aria-label", "Your hall");
    sw.innerHTML = Object.keys(HALLS).map(function (k) { return '<button type="button" data-hall="' + k + '">' + esc(HALLS[k].label) + "<small>" + esc(HALLS[k].sub) + "</small></button>"; }).join("");
    var first = body.querySelector("label") || body.firstChild; body.insertBefore(sw, first);
    sw.addEventListener("click", function (e) { var b = e.target.closest("button[data-hall]"); if (!b) return; mode = b.getAttribute("data-hall"); paintMode(); });
    paintMode();
  }
  function showBox(html) {
    var box = $("hgBox"); if (!box) { box = document.createElement("div"); box.id = "hgBox"; box.className = "hg-box"; $("joinBtn").insertAdjacentElement("afterend", box); }
    box.innerHTML = html; return box;
  }
  function openGate(c, name) {
    window._pendingAcct = { id: c.card, name: pretty(name.trim()), nameKey: normName(name), port: mode };
    try { localStorage.setItem("shk_join_port", mode); } catch (e) {}
    var g = $("grantedId"); g && (g.textContent = "#" + c.num + " · Local 10");
    try { $("handleRoll") && $("handleRoll").click(); } catch (e) {}
    $("granted").style.display = "block"; $("formBody").style.display = "none";
    try { $("granted").scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
  }
  async function sfJoin() {
    var nameEl = $("fullName"), idEl = $("workId"), nm = $("nameMsg"), im = $("idMsg");
    nm.textContent = ""; im.textContent = "";
    var name = String(nameEl.value || "").trim(), key = normName(name), c = cardFor("sf", idEl.value), ok = true;
    if (key.split(" ").length < 2) { nm.textContent = "> first and last name, as printed on the card"; ok = false; }
    if (!c) { im.textContent = "> your dispatch number as it reads on the card, like B3905"; ok = false; }
    if (!ok) return;
    if (!window.SB) { im.textContent = "> can't reach the Order right now — try again in a minute"; return; }
    var btn = $("joinBtn"), label = btn.textContent; btn.disabled = true; btn.textContent = "CHECKING…";
    var let_in = false;
    try { var r = await window.SB.rpc("gate_check", { p_port: "sf", p_card: c.card, p_name_key: key }); let_in = !!(r && !r.error && r.data === true); } catch (e) {}
    btn.disabled = false; btn.textContent = label;
    if (let_in) { openGate(c, name); return; }
    var box = showBox("<b>Your card is your proof.</b> The Order doesn’t have the Local 10 list yet, so show it your casual card: take a photo of it and you’re in.<button type=\"button\" class=\"btn\" id=\"hgScan\">📷 Scan your casual card</button><input type=\"file\" id=\"hgFile\" accept=\"image/*\" capture=\"environment\" hidden><div id=\"hgScanMsg\" style=\"margin-top:8px;color:var(--steel)\"></div><div style=\"margin-top:12px;font-size:12px;color:var(--steel)\">No card on you? <a href=\"#\" id=\"hgAsk\">Ask the Keymaster to let you in</a> instead.</div>");
    $("hgScan").addEventListener("click", function () { $("hgFile").click(); });
    $("hgFile").addEventListener("change", async function (ev) {
      var f = ev.target.files && ev.target.files[0]; ev.target.value = ""; if (!f) return;
      var sm = $("hgScanMsg"), btn2 = $("hgScan"); btn2.disabled = true;
      try {
        var verdict = await readCard(f, c, name, sm);
        if (!verdict.ok) { sm.textContent = verdict.why; btn2.disabled = false; btn2.textContent = "📷 Try the scan again"; return; }
        sm.textContent = "> card checks out — opening the gate…";
        var q = await window.SB.rpc("join_scanned", { p_port: "sf", p_card: c.card, p_raw: c.raw, p_name: pretty(name) });
        if (q && q.error) throw q.error;
        if (q && q.data && q.data.ok === false) { sm.textContent = "> " + (q.data.why || "couldn’t open the gate"); btn2.disabled = false; return; }
        openGate(c, name);
      } catch (e) { sm.textContent = "> couldn’t read that — check your signal and try again"; btn2.disabled = false; }
    });
    $("hgAsk").addEventListener("click", async function (ev) {
      ev.preventDefault(); if (this._sent) return; this._sent = true; this.textContent = "sending…";
      try {
        var q = await window.SB.rpc("join_request", { p_port: "sf", p_card: c.card, p_raw: c.raw, p_name: pretty(name), p_how: "request", p_note: null });
        if (q && q.error) throw q.error;
        box.innerHTML = "✅ <b>Asked.</b> The Keymaster has your name and #" + esc(c.num) + ". Come back and tap <b>Join the Brotherhood</b> with the same name and number once you’re let in.";
      } catch (e) { this._sent = false; this.textContent = "Ask the Keymaster to let you in"; box.insertAdjacentHTML("beforeend", "<div style=\"margin-top:6px;color:#ff6a6a\">Couldn’t send that — try again.</div>"); }
    });
  }
  /* ---------------- reading the card ---------------- */
  var _ocr = null;
  async function ocr() {
    if (_ocr) return _ocr;
    if (!window.Tesseract) await new Promise(function (res, rej) { var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"; s.onload = res; s.onerror = function () { rej(new Error("no signal")); }; document.head.appendChild(s); });
    _ocr = await window.Tesseract.createWorker("eng"); return _ocr;
  }
  function turned(img, deg) {
    var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, k = Math.min(1, 1800 / Math.max(w, h)), sw = Math.round(w * k), sh = Math.round(h * k), cv = document.createElement("canvas");
    if (deg === 90 || deg === 270) { cv.width = sh; cv.height = sw; } else { cv.width = sw; cv.height = sh; }
    var x = cv.getContext("2d"); x.translate(cv.width / 2, cv.height / 2); x.rotate(deg * Math.PI / 180); x.drawImage(img, -sw / 2, -sh / 2, sw, sh); return cv;
  }
  var MARKS = ["ILWU", "PMA", "CASUAL", "IDENTIFIED", "DISPATCH", "PAYROLL", "LOCAL", "PORT", "SAN FRANCISCO", "OAKLAND", "MARITIME"];
  function judge(text, c, name) {
    var up = String(text || "").toUpperCase(), marks = MARKS.filter(function (k) { return up.indexOf(k) >= 0; }).length;
    var flat = up.replace(/[^A-Z0-9]/g, ""), hasNum = flat.indexOf(c.digits) >= 0;
    var toks = normName(name).toUpperCase().split(" ").filter(function (t) { return t.length > 1; });
    var last = toks[toks.length - 1] || "", hasName = last && flat.indexOf(last.replace(/[^A-Z]/g, "")) >= 0;
    return { marks: marks, hasNum: hasNum, hasName: hasName, score: marks + (hasNum ? 3 : 0) + (hasName ? 3 : 0) };
  }
  async function readCard(file, c, name, sm) {
    sm.textContent = "> loading the reader…";
    var w = await ocr(), img = new Image(), url = URL.createObjectURL(file), best = null;
    await new Promise(function (res, rej) { img.onload = res; img.onerror = rej; img.src = url; });
    try {
      for (var deg of [0, 90, 270, 180]) {
        sm.textContent = "> reading your card…" + (deg ? " (turning it " + deg + "°)" : "");
        var r = await w.recognize(turned(img, deg)), j = judge(r && r.data && r.data.text, c, name);
        if (!best || j.score > best.score) best = j;
        if (j.marks >= 2 && j.hasNum && j.hasName) break;
      }
    } finally { URL.revokeObjectURL(url); }
    if (!best || best.marks < 2) return { ok: false, why: "> that doesn’t read like a casual card — fill the frame, kill the glare, hold it flat" };
    if (!best.hasNum) return { ok: false, why: "> couldn’t find #" + c.num + " on the card — check the number you typed, or shoot again" };
    if (!best.hasName) return { ok: false, why: "> couldn’t find your last name on the card — type it exactly as printed, or shoot again" };
    return { ok: true };
  }

  document.addEventListener("click", function (e) {
    if (mode !== "sf") return;
    var b = e.target.closest && e.target.closest("#joinBtn"); if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault(); sfJoin();
  }, true);

  /* ---------------- after sign-up: into the hall ---------------- */
  var claimTries = 0;
  async function claim() {
    var want = null; try { want = localStorage.getItem("shk_join_port"); } catch (e) {}
    if (!want || want === "lalb" || !window.SB || !window.__shkUid) return;
    if (++claimTries > 6) return;
    try {
      var r = await window.SB.rpc("claim_hall", { p_port: want });
      if (r && r.data && r.data.ok) {
        try { localStorage.removeItem("shk_join_port"); localStorage.setItem("shk_home_port", want); } catch (e) {}
        try { window.SHK_PORTS && SHK_PORTS.setHome(want, true); } catch (e) {}
        try { typeof toast === "function" && toast("⚓ Welcome to the Order — you’re on the " + (want === "sf" ? "SF/OAK" : want.toUpperCase()) + " hall"); } catch (e) {}
      }
    } catch (e) {}
  }

  /* ---------------- the Keymaster's join requests (Ports tab, while looking at that hall) ---------------- */
  function isKM() { try { return !!window.__isKM || (typeof prvKm === "function" && prvKm()); } catch (e) { return false; } }
  async function paintRequests() {
    var sky = $("harborSky"); if (!sky || !window.SB || !isKM()) return;
    var view = (window.SHK_PORTS && SHK_PORTS.view) || "lalb", card = $("jrCard");
    if (view === "lalb") { card && card.remove(); return; }
    var rows = [];
    try { var r = await window.SB.from("join_requests").select("id,card,raw_number,full_name,how,created_at").eq("port", view).eq("status", "pending").order("created_at", { ascending: true }).limit(50); rows = r && !r.error ? r.data || [] : []; } catch (e) {}
    css();
    var html = '<div class="card jr-card" id="jrCard"><div class="jr-h">🚪 Asking to join · ' + esc(view === "sf" ? "Local 10" : view.toUpperCase()) + " (" + rows.length + ')</div><div class="jr-b">' +
      (rows.length ? rows.map(function (x) {
        return '<div class="jr-it" data-id="' + x.id + '"><div>' + esc(x.full_name) + "<small>#" + esc(x.raw_number || x.card) + " · " + new Date(x.created_at).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" }) + '</small></div><button type="button" class="jr-ok">Let in</button><button type="button" class="jr-no">Decline</button></div>';
      }).join("") : '<div style="color:var(--steel);font:13px Inter,system-ui,sans-serif;padding:6px 0">Nobody waiting.</div>') + "</div></div>";
    if (card) card.outerHTML = html; else sky.insertAdjacentHTML("afterend", html);
  }
  document.addEventListener("click", async function (e) {
    var b = e.target.closest && e.target.closest("#jrCard .jr-it button"); if (!b) return;
    var it = b.closest(".jr-it"), id = +it.getAttribute("data-id"), ok = b.classList.contains("jr-ok");
    b.disabled = true;
    try { var r = await window.SB.rpc(ok ? "join_approve" : "join_decline", { p_id: id }); if (r && r.error) throw r.error; it.remove(); try { typeof toast === "function" && toast(ok ? "Let in — they can join now" : "Declined"); } catch (x) {} }
    catch (err) { b.disabled = false; try { typeof toast === "function" && toast("Couldn’t: " + ((err && err.message) || err)); } catch (x) {} }
  });

  function boot() {
    mountSwitch();
    var n = 0, t = setInterval(function () { mountSwitch(); claim(); if (++n > 40) clearInterval(t); }, 1500);
    document.addEventListener("shk:port-view", paintRequests);
    setInterval(paintRequests, 60000); setTimeout(paintRequests, 4000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  window.SHK_HALL_GATE = { claim: claim, requests: paintRequests };
})();
