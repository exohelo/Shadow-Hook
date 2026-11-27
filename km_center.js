/* The Shadow Hook · km_center.js (nov27a) — the Command Center, rebuilt for the Keymaster.
   Nothing is re-coded: the existing sections are MOVED (so every button keeps its wiring) into a new order:
     1. UPDATE THE SYSTEM, always on top: tonight's / today's boards with PMA · ILWU · prediction status, and the
        four levers: add the PMA PDF, enter or fix an ILWU sheet, re-read the union PDF, run the prediction.
        The To-Do sits right under it.
     2. Inbox · Analytics (every number in one place, tabbed) · System · Broadcast — each folds.
     3. Tools: re-pull, check the wires, close.
   Gone: the jump strip (it repeated the sections), the floating "⚙ dev log" pill and the Dev Log button (the Sheet
   Editor it hid now opens from the top), the Bots' copy of the PDF button, the extra Wire card. */
(function () {
  "use strict";
  if (window.__kmCenter) return; window.__kmCenter = true;
  var $ = function (id) { return document.getElementById(id); };
  var DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var GROUPS = [
    { id: "kmGrpInbox", t: "📬 INBOX", sub: "Members and vendors waiting on you", secs: ["kmSecLine", "kmSecDesk", "kmSecMail", "kmSecApps", "kmSecTrades", "kmSecStock", "kmSecChamber"] },
    { id: "kmGrpStats", t: "📊 ANALYTICS", sub: "Every number in one place", tabs: [
        ["People", ["kmMembersCard", "kmSecTraffic", "kmSecRoster"]],
        ["Money", ["kmSecPulse", "kmSecCasino", "kmBooksWrap"]],
        ["The Call", ["kmSecNumbers", "kmSecTape"]],
        ["Games", ["kmGamesCard", "kmMessyCard"]]] },
    { id: "kmGrpSys", t: "⚙ SYSTEM", sub: "Alarms, sheet flags, bots, switches", secs: ["kmSecAlarms", "kmSecFlags", "kmSecBots", "kmSecSwitches"] },
    { id: "kmGrpCast", t: "📣 BROADCAST", sub: "Bulletin, raffle, welcome, mint", secs: ["kmSecBulletin", "kmSecRaffle", "kmSecWelcome", "kmSecMint"] }
  ];
  var KNOWN = {}; GROUPS.forEach(function (g) { (g.secs || []).forEach(function (s) { KNOWN[s] = 1; }); (g.tabs || []).forEach(function (t) { t[1].forEach(function (s) { KNOWN[s] = 1; }); }); });
  KNOWN.kmSecTodo = 1;

  function css() {
    if ($("kmcCss")) return;
    var s = document.createElement("style"); s.id = "kmcCss";
    s.textContent =
      "#devLogBtn,#kmDevLog,#kmJump{display:none!important}" +
      "#kmSheet .kmc-top{margin:0 0 12px;padding:12px;border-radius:14px;border:1px solid rgba(31,157,116,.55);background:linear-gradient(180deg,rgba(31,157,116,.16),rgba(31,157,116,.04))}" +
      "#kmSheet .kmc-h{display:flex;align-items:center;gap:8px;font:800 13px/1 'Barlow Condensed',sans-serif;letter-spacing:.14em;color:#1f9d74;margin-bottom:10px}" +
      "#kmSheet .kmc-boards{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}" +
      "#kmSheet .kmc-b{border:1px solid var(--line,rgba(122,130,138,.35));border-radius:10px;padding:7px 8px;font-size:11px;line-height:1.45;background:rgba(0,0,0,.06)}" +
      "#kmSheet .kmc-b.now{border-color:#1f9d74;box-shadow:inset 0 0 0 1px #1f9d74}" +
      "#kmSheet .kmc-b b{display:block;font-size:11.5px;letter-spacing:.04em;color:var(--bone,#fff);margin-bottom:3px}" +
      "#kmSheet .kmc-b span{display:flex;justify-content:space-between;gap:4px;color:var(--steel,#9aa)}" +
      "#kmSheet .kmc-ok{color:#1f9d74!important;font-weight:800}#kmSheet .kmc-no{color:#d24b4b!important;font-weight:800}#kmSheet .kmc-na{opacity:.45}" +
      "#kmSheet .kmc-acts{display:grid;grid-template-columns:1fr 1fr;gap:6px}" +
      "#kmSheet .kmc-acts>*{display:flex;align-items:center;justify-content:center;gap:6px;min-height:42px;border-radius:10px;border:1px solid var(--line,rgba(122,130,138,.4));background:rgba(0,0,0,.08);color:var(--bone,#fff);font:800 12px/1.2 inherit;letter-spacing:.04em;padding:8px;text-align:center;cursor:pointer}" +
      "#kmSheet .kmc-acts .go{background:#1f8f5f;border-color:#1f8f5f;color:#fff}" +
      "#kmSheet .kmc-acts input[type=file]{display:none}" +
      "#kmSheet .kmc-ed{display:none;grid-column:1/-1;gap:6px;align-items:center;flex-wrap:wrap}#kmSheet .kmc-ed.on{display:flex}" +
      "#kmSheet .kmc-ed select{flex:1 1 140px;padding:9px;border-radius:9px;border:1px solid var(--line,#555);background:transparent;color:inherit;font-size:13px}" +
      "#kmSheet .kmc-msg{font-size:11.5px;line-height:1.5;color:var(--steel,#9aa);margin-top:8px;min-height:1em}" +
      "#kmSheet #kmWireRun{margin:8px 0 0!important;border-color:var(--line,rgba(122,130,138,.35))!important}#kmSheet #kmWireRun>div:first-child{display:none}#kmSheet #kmWireRun{padding:8px 10px!important}" +
      "#kmSheet details.kmgrp{margin:0 0 10px;border-radius:14px;border:1px solid var(--line,rgba(122,130,138,.35));background:rgba(0,0,0,.04)}" +
      "#kmSheet details.kmgrp>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:12px 14px;font:800 14px/1 'Barlow Condensed',sans-serif;letter-spacing:.12em;color:var(--bone,#fff)}" +
      "#kmSheet details.kmgrp>summary::-webkit-details-marker{display:none}" +
      "#kmSheet details.kmgrp>summary small{font:500 11px/1.2 Inter,system-ui,sans-serif;letter-spacing:0;color:var(--steel,#9aa);margin-left:4px}" +
      "#kmSheet details.kmgrp>summary .n{margin-left:auto;min-width:20px;padding:3px 7px;border-radius:999px;background:#d24b4b;color:#fff;font:800 11px/1 Inter,sans-serif;text-align:center}" +
      "#kmSheet details.kmgrp>summary .n:empty{display:none}#kmSheet details.kmgrp>summary:after{content:'\\25B8';margin-left:6px;color:var(--steel,#9aa);transition:transform .15s}#kmSheet details.kmgrp[open]>summary:after{transform:rotate(90deg)}" +
      "#kmSheet details.kmgrp>summary .n:empty+*{margin-left:auto}#kmSheet details.kmgrp>summary .n:empty~i{margin-left:auto}" +
      "#kmSheet .kmgrp-b{padding:0 10px 10px}" +
      "#kmSheet .kmc-tabs{display:flex;gap:6px;margin:0 0 10px;overflow-x:auto}#kmSheet .kmc-tabs button{flex:1 0 auto;padding:8px 12px;border-radius:999px;border:1px solid var(--line,#555);background:none;color:var(--bone,#fff);font:800 11.5px/1 inherit;letter-spacing:.06em}" +
      "#kmSheet .kmc-tabs button.on{background:#1f8f5f;border-color:#1f8f5f;color:#fff}" +
      "#kmSheet .kmc-pane{display:none}#kmSheet .kmc-pane.on{display:block}" +
      "#kmSheet .kmc-pane details{margin-bottom:8px}" +
      "html.daylight #kmSheet .kmc-acts>*{background:#fff;color:#1c2127}html.daylight #kmSheet .kmc-acts .go{background:#1f8f5f;color:#fff}html.daylight #kmSheet .kmc-b{background:#fff}";
    document.head.appendChild(s);
  }

  /* ── boards on deck: today day, tonight, tomorrow day ── */
  function laNow() { try { return typeof window.nowLA === "function" ? window.nowLA() : new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })); } catch (e) { return new Date(); } }
  function keyFor(d, ap) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + "_" + DOW[d.getDay()] + "_" + ap; }
  function deck() {
    var n = laNow(), m = n.getHours() * 60 + n.getMinutes(), t = new Date(n); t.setDate(t.getDate() + 1);
    var y = new Date(n); y.setDate(y.getDate() - 1);
    var list = m < 4 * 60 ? [keyFor(y, "PM"), keyFor(n, "AM"), keyFor(n, "PM")] : [keyFor(n, "AM"), keyFor(n, "PM"), keyFor(t, "AM")];
    var cur = m < 4 * 60 ? 0 : m < 13 * 60 ? 0 : 1; // the board being dispatched/worked now
    if (m >= 4 * 60 && m < 10 * 60) cur = 0; else if (m >= 10 * 60) cur = 1;
    return { keys: list, cur: cur };
  }
  function label(k) { var m = /^\d{4}-(\d{2})-(\d{2})_(\w{3})_(AM|PM)$/.exec(k); return m ? m[3] + " " + (m[4] === "AM" ? "day" : "night") + " " + (+m[1]) + "/" + (+m[2]) : k; }
  var ILWU = {}, WIRE = {};
  async function pull(keys) {
    var c = window.SB; if (!c) return;
    try { var r = await c.from("dispatch_boards").select("key,data").in("key", keys).eq("port", "lalb"); (r.data || []).forEach(function (x) { ILWU[x.key] = x.data || {}; }); } catch (e) {}
    try { var w = await c.from("wire_call_v2_log").select("k,stop,lo,hi,locked_at,locked_stop,port").in("k", keys); (w.data || []).forEach(function (x) { if (!x.port || x.port === "lalb") WIRE[x.k] = x; }); } catch (e) {}
  }
  function mark(ok, na) { return na ? '<em class="kmc-na">—</em>' : ok ? '<em class="kmc-ok">✓</em>' : '<em class="kmc-no">✗</em>'; }
  function paintBoards() {
    var box = $("kmcBoards"); if (!box) return;
    var d = deck(), A = window.PMA_API;
    box.innerHTML = d.keys.map(function (k, i) {
      var ilwu = ILWU[k] || (function () { try { return (typeof DISPATCH_DATA !== "undefined" && DISPATCH_DATA[k]) || null; } catch (e) { return null; } })() || {};
      var pm = /_PM$/.test(k), fin = !!(ilwu.total || ilwu.boards), early = !!(ilwu.early && (ilwu.early.total || ilwu.early.boards));
      var pma = false; try { pma = !!(A && A.get && A.get(k)) && !(A.partial && A.partial(k)); } catch (e) {}
      var w = WIRE[k] || {}, called = !!(w.stop || w.locked_stop), stop = w.locked_stop || w.stop || "";
      return '<div class="kmc-b' + (i === d.cur ? " now" : "") + '"><b>' + label(k) + (i === d.cur ? " · NOW" : "") + '</b>' +
        '<span>PMA ' + mark(pma) + '</span>' +
        (pm ? '<span>ILWU early ' + mark(early) + '</span>' : "") +
        '<span>ILWU final ' + mark(fin) + '</span>' +
        '<span>Call ' + (called ? '<em class="kmc-ok">' + stop + (w.locked_at ? " \uD83D\uDD12" : "") + '</em>' : mark(false)) + '</span></div>';
    }).join("");
    var sel = $("kmcKey");
    if (sel) {
      var want = d.keys.concat([]); var cur = sel.value;
      sel.innerHTML = want.map(function (k) { return '<option value="' + k + '">' + label(k) + '</option>'; }).join("");
      if (cur && want.indexOf(cur) > -1) sel.value = cur; else sel.value = d.keys[d.cur];
      whichOpts();
    }
  }
  function whichOpts() {
    var k = ($("kmcKey") || {}).value || "", w = $("kmcWhich"); if (!w) return;
    var o = /_AM$/.test(k) ? [["D", "D · day final"]] : [["N", "N · night final"], ["E", "E · early count"]];
    var cur = w.value; w.innerHTML = o.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join("");
    if (o.some(function (x) { return x[0] === cur; })) w.value = cur;
  }
  function msg(t) { var m = $("kmcMsg"); if (m) m.textContent = t || ""; }

  function buildTop(card) {
    if ($("kmcTop")) return $("kmcTop");
    var top = document.createElement("div"); top.id = "kmcTop"; top.className = "kmc-top";
    top.innerHTML = '<div class="kmc-h">⚡ UPDATE THE SYSTEM</div>' +
      '<div class="kmc-boards" id="kmcBoards"></div>' +
      '<div class="kmc-acts">' +
      '<label class="go" id="kmcPma">📄 Add PMA sheet<input type="file" id="kmcPmaFile" accept="application/pdf,.pdf,image/*" multiple></label>' +
      '<button type="button" class="go" id="kmcIlwu">✎ ILWU sheet</button>' +
      '<div class="kmc-ed" id="kmcEd"><select id="kmcKey"></select><select id="kmcWhich"></select><button type="button" class="go" id="kmcOpenEd" style="flex:1 1 100%;min-height:40px;border-radius:10px;border:0;font-weight:800">Open the Sheet Editor</button></div>' +
      '<button type="button" id="kmcReread">⟳ Re-read union PDF</button>' +
      '<button type="button" class="go" id="kmcPredict">⚡ Run the prediction</button>' +
      '</div><div class="kmc-msg" id="kmcMsg"></div>';
    card.insertBefore(top, card.children[2] || null);

    $("kmcPmaFile").addEventListener("change", async function () {
      var fs = [].slice.call(this.files || []); this.value = ""; if (!fs.length) return;
      if (!window.PMA_API || !window.PMA_API.add) { msg("The PMA reader isn't loaded yet. Try again in a moment."); return; }
      msg("Reading " + fs.length + " PMA file" + (fs.length > 1 ? "s" : "") + "…");
      try { await window.PMA_API.add(fs); msg("✓ PMA sheet added."); } catch (e) { msg("✗ " + (e && e.message || e)); }
      try { window.kmTodoRefresh && window.kmTodoRefresh(); } catch (e) {}
      refresh();
    });
    $("kmcIlwu").addEventListener("click", function () { $("kmcEd").classList.toggle("on"); paintBoards(); });
    $("kmcKey").addEventListener("change", whichOpts);
    $("kmcOpenEd").addEventListener("click", function () {
      var k = $("kmcKey").value, w = $("kmcWhich").value;
      if (typeof window.kmOpenSheetEditor !== "function") { msg("The Sheet Editor isn't loaded yet. Try again in a moment."); return; }
      $("kmSheet").classList.remove("on");
      setTimeout(function () { try { window.kmOpenSheetEditor(k, w); } catch (e) {} }, 150);
    });
    $("kmcReread").addEventListener("click", function () { var b = $("kmBotPdf"); if (b) { b.click(); msg("Asked the bot to re-read today's union PDF. Its answer shows under System → The Bots."); } else msg("The bot isn't set up on this phone (System → The Bots → the key)."); });
    $("kmcPredict").addEventListener("click", function () {
      var b = $("kmWireRunBtn"); if (!b) { msg("The prediction engine isn't loaded yet. Try again in a moment."); return; }
      var w = $("kmWireRun"); if (w && w.parentNode !== top) top.appendChild(w);
      b.click(); setTimeout(function () { pull(deck().keys).then(paintBoards); }, 4000);
    });
    return top;
  }

  function sumCount(el) {
    var n = 0; el.querySelectorAll("details > summary .pill, details > summary .n").forEach(function (p) {
      if (p.closest("details.kmgrp") && p.closest("details") === p.closest("details.kmgrp")) return;
      if (p.style.display === "none" || p.offsetParent === null && getComputedStyle(p).display === "none") return;
      var v = parseInt((p.textContent || "").replace(/[^\d]/g, ""), 10); if (v > 0 && /red|hot/.test(p.className + " " + (p.parentNode.className || ""))) n += v;
    });
    return n;
  }
  function group(card, g, after) {
    var el = $(g.id);
    if (!el) {
      el = document.createElement("details"); el.className = "kmgrp"; el.id = g.id;
      el.innerHTML = '<summary>' + g.t + '<small>' + g.sub + '</small><span class="n"></span></summary><div class="kmgrp-b"></div>';
      if (g.tabs) {
        var b = el.querySelector(".kmgrp-b");
        b.innerHTML = '<div class="kmc-tabs">' + g.tabs.map(function (t, i) { return '<button type="button" data-p="' + i + '"' + (i ? "" : ' class="on"') + '>' + t[0] + '</button>'; }).join("") + '</div>' +
          g.tabs.map(function (t, i) { return '<div class="kmc-pane' + (i ? "" : " on") + '" data-p="' + i + '"></div>'; }).join("");
        b.querySelector(".kmc-tabs").addEventListener("click", function (e) {
          var x = e.target.closest("button[data-p]"); if (!x) return;
          b.querySelectorAll(".kmc-tabs button").forEach(function (y) { y.classList.toggle("on", y === x); });
          b.querySelectorAll(".kmc-pane").forEach(function (p) { p.classList.toggle("on", p.getAttribute("data-p") === x.getAttribute("data-p")); });
          openAll(b.querySelector('.kmc-pane[data-p="' + x.getAttribute("data-p") + '"]'));
        });
      }
      try { var f = JSON.parse(localStorage.getItem("shadowhook_kmgrp") || "{}"); el.open = !!f[g.id]; } catch (e) {}
      el.addEventListener("toggle", function () {
        try { var f = JSON.parse(localStorage.getItem("shadowhook_kmgrp") || "{}"); el.open ? f[g.id] = 1 : delete f[g.id]; localStorage.setItem("shadowhook_kmgrp", JSON.stringify(f)); } catch (e) {}
        if (el.open && g.tabs) openAll(el.querySelector(".kmc-pane.on"));
      });
    }
    if (el.previousElementSibling !== after) after.insertAdjacentElement("afterend", el);
    var body = el.querySelector(".kmgrp-b");
    if (g.secs) g.secs.forEach(function (id) { var s = $(id); if (s && s.parentNode !== body) body.appendChild(s); });
    if (g.tabs) g.tabs.forEach(function (t, i) { var p = body.querySelector('.kmc-pane[data-p="' + i + '"]'); t[1].forEach(function (id) { var s = $(id); if (s && s.parentNode !== p) p.appendChild(s); }); });
    var n = el.querySelector("summary .n"), c = sumCount(body); n.textContent = c > 0 ? String(c) : "";
    return el;
  }
  function openAll(p) { if (!p) return; p.querySelectorAll(":scope > details").forEach(function (d) { if (!d.open) d.open = true; }); }

  var busy = false;
  function arrange() {
    var sh = $("kmSheet"), card = sh && sh.querySelector(".sheet-card"); if (!card || busy) return;
    busy = true;
    try {
      css();
      var top = buildTop(card);
      var w = $("kmWireRun"); if (w && w.parentNode !== top) top.appendChild(w);
      var todo = $("kmSecTodo"); if (todo && todo.previousElementSibling !== top) top.insertAdjacentElement("afterend", todo);
      if (todo && !todo.open && todo.querySelector("summary .pill") && parseInt(todo.querySelector("summary .pill").textContent, 10) > 0) todo.open = true;
      var dep = $("kmDeputyNote"); if (dep && dep.nextElementSibling !== top) top.insertAdjacentElement("beforebegin", dep);
      var after = todo || top;
      GROUPS.forEach(function (g) { after = group(card, g, after); });
      // anything new that someone adds later lands in System instead of floating loose
      [].slice.call(card.children).forEach(function (el) {
        if (el.tagName === "DETAILS" && !el.classList.contains("kmgrp") && !KNOWN[el.id] && el.id) { var b = $("kmGrpSys").querySelector(".kmgrp-b"); b.appendChild(el); }
      });
      var th = card.querySelector(".km-tools-h"); if (th) { var tools = th.nextElementSibling; card.appendChild(th); tools && card.appendChild(tools); }
      // the Bots keep their own controls, minus the PDF button that now sits on top
      var bp = $("kmBotPdf"); if (bp) bp.style.display = "none";
      var dl = $("kmDevLog"); if (dl) dl.style.display = "none";
    } catch (e) { try { console.warn("km_center", e); } catch (x) {} }
    busy = false;
  }
  function refresh() { arrange(); paintBoards(); pull(deck().keys).then(paintBoards); }

  /* the open routine lives in index.html; run ours right after it */
  var hookTries = 0, hook = setInterval(function () {
    if (typeof window.kmOpen === "function" && !window.kmOpen.__kmc) {
      var o = window.kmOpen; window.kmOpen = function () { var r = o.apply(this, arguments); try { refresh(); } catch (e) {} setTimeout(arrange, 1200); setTimeout(arrange, 4000); return r; }; window.kmOpen.__kmc = true;
    }
    if (++hookTries > 120) clearInterval(hook);
  }, 500);
  var mo = new MutationObserver(function () { clearTimeout(mo.t); mo.t = setTimeout(function () { var sh = $("kmSheet"); if (sh && sh.classList.contains("on")) arrange(); }, 250); });
  var watch = setInterval(function () { var sh = $("kmSheet"); if (sh) { clearInterval(watch); mo.observe(sh, { attributes: true, attributeFilter: ["class"], childList: true }); var c = sh.querySelector(".sheet-card"); c && mo.observe(c, { childList: true }); arrange(); } }, 800);
  setInterval(function () { var sh = $("kmSheet"); if (sh && sh.classList.contains("on")) { arrange(); pull(deck().keys).then(paintBoards); } }, 60000);
})();
