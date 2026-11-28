/* pay_exact.js — nov28 (Keymaster request)
   1) Money shows to the cent everywhere the app prints pay ($1,601.07, not $1,601).
   2) LOG IT BY HAND: the +½ / +1 / −½ chips are gone — members type the hours paid.
   3) Every sealed docket gets a "⏱ LOG OVERTIME" button under its est. gross:
      type the overtime hours, SAVE, and the pay re-figures (OT at ×1.5). */
(function () {
  if (window.__payExact) return; window.__payExact = 1;

  /* ---------- 1) cents ---------- */
  var CENTS = null;
  try { CENTS = new Intl.NumberFormat(void 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); } catch (e) {}
  function armCents() {
    try {
      if (!CENTS || typeof _fmt$0 === "undefined" || !_fmt$0 || _fmt$0.__cents) return;
      Object.defineProperty(_fmt$0, "format", { value: function (n) { return CENTS.format(Math.round((+n || 0) * 100 + 1e-6) / 100); }, configurable: true });
      _fmt$0.__cents = 1;
      repaintMoney();
      try { typeof renderWeek === "function" && renderWeek(); } catch (e) {}
      try { typeof renderYear === "function" && renderYear(); } catch (e) {}
    } catch (e) {}
  }
  function jobById(id) { try { for (var i = 0; i < DOCKETS.length; i++) if (DOCKETS[i] && DOCKETS[i]._id == id) return DOCKETS[i]; } catch (e) {} return null; }
  /* cheap in-place fix for dockets already on screen (no full re-render) */
  function repaintMoney() {
    try {
      document.querySelectorAll("#docketList .jobrow[data-id]").forEach(function (r) {
        var j = jobById(r.dataset.id); if (!j) return;
        var p; try { p = estPay(j); } catch (e) { return; }
        var s = fmt$(p.gross), m = r.querySelector(".jx-money"); if (m && m.textContent !== s) m.textContent = s;
        var d = r.nextElementSibling, b = d && d.classList.contains("detail") && d.querySelector(".jx-amt b"); if (b && b.textContent !== s) b.textContent = s;
      });
    } catch (e) {}
  }

  /* ---------- 2) manual entry: type the hours ---------- */
  function armForm() {
    var ot = document.getElementById("njOT"); if (ot) ot.remove();
    var h = document.getElementById("njHours");
    if (h && !h.__px) { h.__px = 1; h.setAttribute("step", "any"); h.setAttribute("placeholder", "8"); }
  }

  /* ---------- 3) LOG OVERTIME on a docket ---------- */
  var css = document.createElement("style");
  css.textContent =
    ".otl{margin:12px 0 2px}" +
    ".otl-btn{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:11px 12px;border-radius:12px;border:1px solid rgba(242,193,78,.45);background:rgba(242,193,78,.08);color:var(--copper-hi,#f2c14e);font:700 14px 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer}" +
    ".otl-btn small{font:600 12.5px Inter,system-ui,sans-serif;letter-spacing:0;text-transform:none;color:var(--bone,#e9e2d4);opacity:.85}" +
    ".otl-btn:active{transform:scale(.98)}" +
    ".otl-pan{margin-top:8px;padding:12px;border-radius:12px;border:1px solid var(--line,rgba(255,255,255,.14));background:var(--well,rgba(0,0,0,.25))}" +
    ".otl-pan[hidden]{display:none}" +
    ".otl-k{display:block;font:700 12px 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--steel,#9aa3ad);margin-bottom:6px}" +
    ".otl-row{display:flex;gap:8px;align-items:stretch}" +
    ".otl-row input{flex:1;min-width:0;height:44px;padding:0 12px;border-radius:10px;border:1px solid var(--line,rgba(255,255,255,.2));background:rgba(0,0,0,.3);color:var(--bone,#fff);font:600 18px Inter,system-ui,sans-serif}" +
    ".otl-row button{flex:none;height:44px;padding:0 16px;border-radius:10px;border:0;background:var(--copper-hi,#f2c14e);color:#1a1208;font:800 14px 'Barlow Condensed',system-ui,sans-serif;letter-spacing:.12em;cursor:pointer}" +
    ".otl-sub{margin-top:8px;font:500 12.5px Inter,system-ui,sans-serif;color:var(--steel,#9aa3ad);line-height:1.45}" +
    ".otl-sub b{color:var(--copper-hi,#f2c14e)}" +
    ".otl-clr{margin-top:8px;background:none;border:0;padding:0;color:var(--ember,#e0492e);font:600 12.5px Inter,system-ui,sans-serif;text-decoration:underline;cursor:pointer}" +
    "html.daylight .otl-btn{background:#fff6e6;border-color:#d9b98f;color:#8a5a12}html.daylight .otl-btn small{color:#5b4a33}" +
    "html.daylight .otl-pan{background:#fffaf2;border-color:#e3d3bb}html.daylight .otl-row input{background:#fff;color:#2a2116;border-color:#d9c6aa}";
  document.head.appendChild(css);

  function q(h) { return (Math.round(h * 100) / 100).toString(); }
  function baseHrs(j) { try { return defaultHours(j.shift, j.category) || 8; } catch (e) { return 8; } }
  function curHrs(j) { try { return jobHours(j); } catch (e) { return +j.hours || 8; } }
  function curOT(j) { var b = baseHrs(j), h = curHrs(j); return Math.max(0, Math.round((h - b) * 100) / 100); }
  function training(j) { try { return window.isTraining && window.isTraining(j); } catch (e) { return false; } }

  function btnLabel(j) {
    var o = curOT(j);
    return "⏱ Log overtime" + (o > 0 ? " <small>· " + q(o) + " hr logged</small>" : "");
  }
  function addButtons() {
    document.querySelectorAll("#docketList .detail .jx-pay").forEach(function (pay) {
      var row = pay.closest(".detail"), r = row && row.previousElementSibling;
      if (!r || !r.dataset || !r.dataset.id) return;
      var j = jobById(r.dataset.id); if (!j || training(j)) return;
      var nx = pay.nextElementSibling;
      if (nx && nx.classList.contains("otl")) { if (nx.dataset.id !== j._id) nx.remove(); else return; }
      var box = document.createElement("div");
      box.className = "otl"; box.dataset.id = j._id;
      box.innerHTML = '<button type="button" class="otl-btn">' + btnLabel(j) + '</button>' +
        '<div class="otl-pan" hidden><span class="otl-k">Overtime hours</span>' +
        '<div class="otl-row"><input type="number" inputmode="decimal" step="any" min="0" max="8" placeholder="1"><button type="button" class="otl-save">SAVE</button></div>' +
        '<div class="otl-sub"></div><button type="button" class="otl-clr" hidden>Remove overtime</button></div>';
      pay.parentNode.insertBefore(box, pay.nextSibling);
    });
  }
  function subLine(j, ot) {
    var b = baseHrs(j), st = Math.min(curHrs(j), b), tot = Math.min(16, st + (ot || 0));
    return "Straight time <b>" + q(st) + " hr</b> + overtime <b>" + q(ot || 0) + " hr</b> = <b>" + q(tot) + " hr</b> paid. Overtime pays ×1.5.";
  }
  function save(box, ot) {
    var j = jobById(box.dataset.id); if (!j) return;
    ot = Math.round(Math.max(0, ot) * 100) / 100;
    var b = baseHrs(j), st = Math.min(curHrs(j), b), tot = Math.min(16, st + ot);
    if (st + ot > 16) { try { toast("Capped at 16 hours paid"); } catch (e) {} }
    j.hours = tot;
    try { saveDK(); } catch (e) {}
    try { renderDockets(); } catch (e) {}
    try { typeof renderWeek === "function" && renderWeek(); } catch (e) {}
    try { typeof renderYear === "function" && renderYear(); } catch (e) {}
    try { typeof drawWG === "function" && drawWG(); } catch (e) {}
    var p = null; try { p = estPay(j); } catch (e) {}
    try { toast(ot > 0 ? "⏱ " + q(ot) + " hr overtime logged" + (p ? " · now " + fmt$(p.gross) : "") : "Overtime removed" + (p ? " · " + fmt$(p.gross) : "")); } catch (e) {}
  }
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var box = t.closest(".otl"); if (!box) return;
    e.stopPropagation();
    var j = jobById(box.dataset.id); if (!j) return;
    var pan = box.querySelector(".otl-pan"), inp = box.querySelector("input"), sub = box.querySelector(".otl-sub"), clr = box.querySelector(".otl-clr");
    if (t.closest(".otl-btn")) {
      pan.hidden = !pan.hidden;
      if (!pan.hidden) {
        var o = curOT(j); inp.value = o > 0 ? q(o) : ""; clr.hidden = !(o > 0);
        sub.innerHTML = subLine(j, o);
        setTimeout(function () { try { inp.focus(); } catch (x) {} }, 30);
      }
      return;
    }
    if (t.closest(".otl-save")) {
      var v = parseFloat(String(inp.value).replace(",", "."));
      if (!(v >= 0) || v > 8) { try { toast("Type the overtime hours — like 1, 1.5 or 2"); } catch (x) {} inp.focus(); return; }
      save(box, v); return;
    }
    if (t.closest(".otl-clr")) { save(box, 0); return; }
  }, true);
  document.addEventListener("input", function (e) {
    var inp = e.target; if (!inp || !inp.closest) return;
    var box = inp.closest(".otl"); if (!box) return;
    var j = jobById(box.dataset.id); if (!j) return;
    var v = parseFloat(String(inp.value).replace(",", "."));
    box.querySelector(".otl-sub").innerHTML = subLine(j, v >= 0 ? v : 0);
  }, true);
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var inp = e.target, box = inp && inp.closest && inp.closest(".otl"); if (!box) return;
    e.preventDefault(); var s = box.querySelector(".otl-save"); s && s.click();
  }, true);

  /* ---------- wire it up ---------- */
  var pend = 0;
  function tick() { pend = 0; armForm(); addButtons(); }
  function soon() { if (!pend) pend = setTimeout(tick, 60); }
  function start() {
    armCents(); tick();
    var L = document.getElementById("docketList");
    if (L && window.MutationObserver) new MutationObserver(soon).observe(L, { childList: true });
    var F = document.getElementById("njHours");
    if (F && F.parentNode && window.MutationObserver) new MutationObserver(soon).observe(F.parentNode, { childList: true });
  }
  var n = 0;
  (function wait() {
    if (typeof DOCKETS !== "undefined" && typeof estPay === "function" && document.getElementById("docketList")) return start();
    if (++n < 80) setTimeout(wait, 250);
  })();
})();
