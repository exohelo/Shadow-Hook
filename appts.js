/* The Shadow Hook · appts.js (nov27b) — your trainings and appointments (GST first).
   Kept on the server in public.my_appts (each member sees only their own). The phone gets a push the day before and
   90 minutes before (cron my-appts-tick → push-council). In the app: a COMING UP card on Dockets with directions, add to
   the phone's calendar, and LOG YOUR GST once it's done; and SEAL IT IN THE LOG asks first when the job you're sealing
   runs into one. */
(function () {
  "use strict";
  if (window.__shkAppts) return; window.__shkAppts = true;
  var TZ = "America/Los_Angeles", LS = "shk_appts_cache", rows = [], acked = {};
  try { rows = JSON.parse(localStorage.getItem(LS) || "[]") || []; } catch (e) { rows = []; }

  function sb() { return window.SB || null; }
  function uid() { return window.__shkUid || null; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function parts(iso) { // LA wall clock for a timestamp
    var d = new Date(iso), o = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    var h = +o.hour % 24;
    return { date: o.year + "-" + o.month + "-" + o.day, min: h * 60 + (+o.minute) };
  }
  function fmtDay(iso) { return new Date(iso).toLocaleDateString("en-US", { timeZone: TZ, weekday: "short", month: "short", day: "numeric" }); }
  function fmtTime(iso) { return new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }); }
  function dayNo(ds) { return Math.round(Date.parse(ds + "T12:00:00Z") / 864e5); }
  function todayLA() { return parts(new Date().toISOString()).date; }

  async function load() {
    var c = sb(); if (!c || !uid()) return;
    try {
      var since = new Date(Date.now() - 3 * 864e5).toISOString();
      var r = await c.from("my_appts").select("id,kind,title,starts_at,ends_at,place,note").gte("ends_at", since).order("starts_at", { ascending: true }).limit(20);
      if (r && !r.error && Array.isArray(r.data)) { rows = r.data; try { localStorage.setItem(LS, JSON.stringify(rows)); } catch (e) {} paint(); }
    } catch (e) {}
  }

  /* ── does a docket (date + Day/Night) run into an appointment? ── */
  function shiftSpan(date, shift) { // minutes on a day-number scale
    var d = dayNo(date) * 1440;
    return shift === "Night" ? [d + 18 * 60, d + 27 * 60] : [d + 7 * 60, d + 17 * 60];
  }
  function apptSpan(a) {
    var s = parts(a.starts_at), e = parts(a.ends_at);
    return [dayNo(s.date) * 1440 + s.min, dayNo(e.date) * 1440 + e.min];
  }
  function clash(date, shift) {
    if (!date) return null; var j = shiftSpan(date, shift);
    for (var i = 0; i < rows.length; i++) { var a = apptSpan(rows[i]); if (j[0] < a[1] && a[0] < j[1]) return rows[i]; }
    return null;
  }
  window.shkApptClash = clash;

  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("#njAdd") : null; if (!b) return;
    try {
      var date = (document.getElementById("njDate") || {}).value || todayLA(),
          shift = (document.getElementById("njShift") || {}).value || "Day",
          cat = String((document.getElementById("njCat") || {}).value || "").trim().toUpperCase();
      var a = clash(date, shift); if (!a) return;
      if (cat && cat === String(a.kind || "").toUpperCase()) return; // logging the training itself
      var key = a.id + "|" + date + "|" + shift; if (acked[key]) { delete acked[key]; return; }
      ev.preventDefault(); ev.stopImmediatePropagation();
      var msg = "You're down for " + a.kind + " on " + fmtDay(a.starts_at) + ", " + fmtTime(a.starts_at) + " to " + fmtTime(a.ends_at) +
        (a.place ? "\n" + a.place : "") + ".\n\nThis " + shift.toLowerCase() + " job runs into it. Missing a scheduled class counts against you (three misses and you're put on non-dispatch).\n\nSeal it anyway?";
      var go = function () { acked[key] = 1; try { b.click(); } catch (e) {} };
      if (typeof window.shConfirm === "function") window.shConfirm(msg, go, { title: a.kind + " that day", icon: "📅", okText: "Seal anyway", noText: "Go back" });
      else if (confirm(msg)) go();
    } catch (e) {}
  }, true);

  /* ── the COMING UP card on Dockets ── */
  function css() {
    if (document.getElementById("apptCss")) return;
    var s = document.createElement("style"); s.id = "apptCss";
    s.textContent = "#apptCard{margin:0 0 12px;padding:12px 14px;border-radius:14px;border:1px solid rgba(46,196,160,.45);background:linear-gradient(180deg,rgba(46,196,160,.14),rgba(46,196,160,.05))}" +
      "#apptCard .ap-h{display:flex;justify-content:space-between;align-items:center;font:700 11px/1 var(--mono,monospace);letter-spacing:.14em;color:#2ec4a0;margin-bottom:8px}" +
      "#apptCard .ap-add{background:none;border:1px solid rgba(46,196,160,.5);color:#2ec4a0;border-radius:999px;padding:4px 10px;font:700 11px/1 inherit;letter-spacing:.08em}" +
      "#apptCard .ap-row{padding:8px 0;border-top:1px solid var(--line,rgba(255,255,255,.12))}#apptCard .ap-row:first-of-type{border-top:0;padding-top:0}" +
      "#apptCard .ap-t{font-weight:800;font-size:15px;color:var(--bone,#fff)}#apptCard .ap-w{font-size:13px;color:var(--bone,#fff);margin-top:2px}" +
      "#apptCard .ap-p,#apptCard .ap-n{font-size:12px;color:var(--steel,#9aa);margin-top:2px;line-height:1.4}" +
      "#apptCard .ap-when{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;background:#2ec4a0;color:#06231c;font-size:11px;font-weight:800}" +
      "#apptCard .ap-when.hot{background:#e0464b;color:#fff}" +
      "#apptCard .ap-b{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}#apptCard .ap-b button,#apptCard .ap-b a{flex:1 1 auto;text-align:center;text-decoration:none;border:1px solid var(--line,rgba(255,255,255,.2));background:rgba(0,0,0,.12);color:var(--bone,#fff);border-radius:10px;padding:8px 6px;font-size:12px;font-weight:700}" +
      "#apptCard .ap-b .go{background:#1f8f5f;border-color:#1f8f5f;color:#fff}" +
      "html.daylight #apptCard{background:linear-gradient(180deg,rgba(20,140,110,.10),rgba(20,140,110,.03));border-color:rgba(20,120,95,.45)}html.daylight #apptCard .ap-h,html.daylight #apptCard .ap-add{color:#0f6e57;border-color:rgba(15,110,87,.5)}html.daylight #apptCard .ap-b button,html.daylight #apptCard .ap-b a{background:#fff}" +
      "#apptSheet{position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}" +
      "#apptSheet .as-c{width:min(520px,100%);background:var(--panel,#14161c);color:var(--bone,#fff);border-radius:18px 18px 0 0;padding:16px 16px calc(16px + env(safe-area-inset-bottom))}" +
      "html.daylight #apptSheet .as-c{background:#fff}#apptSheet h3{margin:0 0 10px;font-size:16px;letter-spacing:.06em}#apptSheet label{display:block;font-size:11px;letter-spacing:.1em;color:var(--steel,#9aa);margin:8px 0 3px}" +
      "#apptSheet input,#apptSheet select{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--line,#444);background:transparent;color:inherit;font-size:15px}" +
      "#apptSheet .as-2{display:flex;gap:8px}#apptSheet .as-2>div{flex:1}#apptSheet .as-b{display:flex;gap:8px;margin-top:14px}#apptSheet .as-b button{flex:1;padding:12px;border-radius:12px;border:1px solid var(--line,#444);background:none;color:inherit;font-weight:800}#apptSheet .as-b .ok{background:#1f8f5f;border-color:#1f8f5f;color:#fff}";
    document.head.appendChild(s);
  }
  function whenTag(a) {
    var today = todayLA(), d = parts(a.starts_at).date, n = dayNo(d) - dayNo(today), now = Date.now();
    if (now >= Date.parse(a.starts_at) && now < Date.parse(a.ends_at)) return ["NOW", true];
    if (now >= Date.parse(a.ends_at)) return ["DONE", false];
    if (n === 0) return ["TODAY", true]; if (n === 1) return ["TOMORROW", true];
    return ["IN " + n + " DAYS", false];
  }
  function paint() {
    var scr = document.getElementById("scr-dockets"); if (!scr) return;
    css();
    var card = document.getElementById("apptCard");
    var list = rows.filter(function (a) { return Date.parse(a.ends_at) > Date.now() - 2 * 864e5; });
    if (!card) {
      card = document.createElement("div"); card.id = "apptCard";
      var t = scr.querySelector(".screen-title"); t && t.nextSibling ? scr.insertBefore(card, t.nextSibling) : scr.insertBefore(card, scr.firstChild);
    }
    var h = '<div class="ap-h"><span>📅 COMING UP</span><button type="button" class="ap-add" data-ap="add">+ ADD</button></div>';
    if (!list.length) h += '<div class="ap-n">No trainings or appointments. Add your GST date here and the app reminds you the day before and warns you if a job runs into it.</div>';
    list.forEach(function (a) {
      var w = whenTag(a), done = w[0] === "DONE";
      h += '<div class="ap-row"><div class="ap-t">' + esc(a.kind) + '<span class="ap-when' + (w[1] ? " hot" : "") + '">' + w[0] + '</span></div>' +
        '<div class="ap-w">' + esc(fmtDay(a.starts_at)) + ' · ' + esc(fmtTime(a.starts_at)) + ' to ' + esc(fmtTime(a.ends_at)) + '</div>' +
        (a.place ? '<div class="ap-p">' + esc(a.place) + '</div>' : "") + (a.note ? '<div class="ap-n">' + esc(a.note) + '</div>' : "") +
        '<div class="ap-b">' +
        (done && String(a.kind).toUpperCase() === "GST" ? '<button type="button" class="go" data-ap="log" data-id="' + a.id + '">✎ Log your GST</button>' : "") +
        (a.place && !done ? '<a href="https://maps.google.com/?daddr=' + encodeURIComponent(a.place) + '" target="_blank" rel="noopener">➤ Directions</a>' : "") +
        (!done ? '<button type="button" data-ap="ics" data-id="' + a.id + '">📱 Phone calendar</button>' : "") +
        '<button type="button" data-ap="del" data-id="' + a.id + '">Remove</button></div></div>';
    });
    if (card.__h !== h) { card.innerHTML = h; card.__h = h; }
    try { markCal(); } catch (e) {}
  }

  function byId(id) { return rows.filter(function (a) { return String(a.id) === String(id); })[0]; }
  function icsStamp(iso) { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"); }
  function ics(a) {
    var body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Shadow Hook//EN", "BEGIN:VEVENT", "UID:shk-appt-" + a.id + "@theshadowhook.com",
      "DTSTAMP:" + icsStamp(new Date().toISOString()), "DTSTART:" + icsStamp(a.starts_at), "DTEND:" + icsStamp(a.ends_at),
      "SUMMARY:" + (a.kind + " · " + a.title).replace(/[,;]/g, " "), "LOCATION:" + String(a.place || "").replace(/[,;]/g, " "),
      "DESCRIPTION:" + String(a.note || "").replace(/[,;]/g, " "),
      "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:" + a.kind + " tomorrow", "END:VALARM",
      "BEGIN:VALARM", "TRIGGER:-PT90M", "ACTION:DISPLAY", "DESCRIPTION:" + a.kind + " soon", "END:VALARM",
      "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var url = URL.createObjectURL(new Blob([body], { type: "text/calendar" })), l = document.createElement("a");
    l.href = url; l.download = a.kind.toLowerCase() + "-" + parts(a.starts_at).date + ".ics"; document.body.appendChild(l); l.click();
    setTimeout(function () { try { l.remove(); URL.revokeObjectURL(url); } catch (e) {} }, 4000);
  }
  function logIt(a) {
    var set = function (id, v) { var el = document.getElementById(id); if (!el) return; el.value = v; try { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {} };
    set("njTerm", "PMA TRAINING"); set("njCat", "GST"); set("njShift", "Day"); set("njDate", parts(a.starts_at).date); set("njShip", "GST");
    var card = document.getElementById("njFormCard"); if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    try { window.toast && toast("GST filled in · check it and tap SEAL IT IN THE LOG"); } catch (e) {}
  }
  async function del(a) {
    var go = async function () {
      var c = sb(); if (!c) return;
      var r = await c.from("my_appts").delete().eq("id", a.id).select("id");
      if (r && !r.error) { rows = rows.filter(function (x) { return x.id !== a.id; }); try { localStorage.setItem(LS, JSON.stringify(rows)); } catch (e) {} paint(); }
      else try { toast("Couldn't remove it. Try again."); } catch (e) {}
    };
    if (typeof window.shConfirm === "function") window.shConfirm("Remove " + a.kind + " on " + fmtDay(a.starts_at) + "? The reminders stop too.", go, { title: "Remove it?", okText: "Remove" });
    else if (confirm("Remove it?")) go();
  }
  function addSheet() {
    var old = document.getElementById("apptSheet"); if (old) old.remove();
    var d = new Date(Date.now() + 864e5), ds = parts(d.toISOString()).date;
    var w = document.createElement("div"); w.id = "apptSheet";
    w.innerHTML = '<div class="as-c"><h3>📅 ADD A TRAINING OR APPOINTMENT</h3>' +
      '<label>WHAT</label><select id="asKind"><option>GST</option><option>Class</option><option>Medical</option><option>Drug test</option><option>Other</option></select>' +
      '<div class="as-2"><div><label>DATE</label><input id="asDate" type="date" value="' + ds + '"></div><div><label>TIME</label><input id="asTime" type="time" value="08:00"></div></div>' +
      '<div class="as-2"><div><label>HOW LONG (HOURS)</label><input id="asHrs" type="number" min="0.5" max="16" step="0.5" value="8.5"></div><div><label>NOTE</label><input id="asNote" placeholder="Bring ID"></div></div>' +
      '<label>WHERE</label><input id="asPlace" value="ILWU-PMA Training Center, 627 N Fries Ave, Wilmington">' +
      '<div class="as-b"><button type="button" data-as="no">Cancel</button><button type="button" class="ok" data-as="ok">Save</button></div></div>';
    document.body.appendChild(w);
    w.addEventListener("click", async function (e) {
      if (e.target === w || (e.target.dataset && e.target.dataset.as === "no")) { w.remove(); return; }
      if (!(e.target.dataset && e.target.dataset.as === "ok")) return;
      var kind = w.querySelector("#asKind").value, date = w.querySelector("#asDate").value, time = w.querySelector("#asTime").value || "08:00",
          hrs = parseFloat(w.querySelector("#asHrs").value) || 1, place = w.querySelector("#asPlace").value.trim(), note = w.querySelector("#asNote").value.trim();
      if (!date) return;
      var c = sb(); if (!c || !uid()) { try { toast("Sign in first."); } catch (x) {} return; }
      e.target.disabled = true;
      // the wall clock is LA time; let the server turn it into a timestamp
      var r = await c.rpc("my_appts_add", { p_kind: kind, p_title: kind === "GST" ? "General Safety Training" : kind, p_local: date + " " + time, p_hours: hrs, p_place: place || null, p_note: note || null });
      e.target.disabled = false;
      if (r && !r.error) { w.remove(); await load(); try { toast("✓ Saved · you'll get a reminder the day before"); } catch (x) {} }
      else try { toast("Couldn't save it. Try again."); } catch (x) {}
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target && e.target.closest ? e.target.closest("#apptCard [data-ap]") : null; if (!b) return;
    var k = b.getAttribute("data-ap"), a = byId(b.getAttribute("data-id"));
    if (k === "add") addSheet(); else if (k === "ics" && a) ics(a); else if (k === "log" && a) logIt(a); else if (k === "del" && a) del(a);
  });


  /* ── #nov27b: the training day on the Job Log calendar ── */
  function markCal() {
    var c = document.getElementById("jlCal"); if (!c) return;
    var by = {};
    rows.forEach(function (a) { by[parts(a.starts_at).date] = a; });
    c.querySelectorAll("button.jc-d[data-d]").forEach(function (b) {
      var a = by[b.getAttribute("data-d")], had = b.classList.contains("ap-day");
      if (a && !had) {
        b.classList.add("ap-day"); var tag = document.createElement("b"); tag.className = "ap-tag"; tag.textContent = String(a.kind).toUpperCase().slice(0, 4);
        b.appendChild(tag); b.setAttribute("aria-label", b.getAttribute("aria-label") + " · " + a.kind + " " + fmtTime(a.starts_at));
      } else if (!a && had) { b.classList.remove("ap-day"); var t = b.querySelector(".ap-tag"); t && t.remove(); }
    });
    var key = c.querySelector(".jc-key");
    if (key && rows.length && !key.querySelector(".ap-k")) { var k = document.createElement("span"); k.className = "ap-k"; k.innerHTML = '<b class="ap-kb"></b>training'; key.appendChild(k); }
  }
  (function () {
    var s = document.createElement("style");
    s.textContent = "#jlCal .jc-d.ap-day{position:relative;box-shadow:inset 0 0 0 2px #1f9d74;border-radius:10px}" +
      "#jlCal .jc-d .ap-tag{position:absolute;left:50%;bottom:1px;transform:translateX(-50%);font:800 8px/1 var(--mono,monospace);letter-spacing:.06em;padding:2px 4px;border-radius:4px;background:#1f9d74;color:#fff;pointer-events:none}" +
      "#jlCal .ap-kb{display:inline-block;width:10px;height:10px;border-radius:3px;box-shadow:inset 0 0 0 2px #1f9d74;margin-right:4px;vertical-align:-1px}";
    document.head.appendChild(s);
    var mo = new MutationObserver(function () { clearTimeout(mo.t); mo.t = setTimeout(markCal, 30); });
    var hook = setInterval(function () { var c = document.getElementById("jlCal"); if (c) { clearInterval(hook); mo.observe(c, { childList: true, subtree: true }); markCal(); } }, 1000);
  })();

  /* ── #nov27b: a logged GST is a class, not a board. It doesn't count for "one job a day" or the rest rule,
     so you can still take a night job the same day (or the night before). ── */
  (function () {
    function isTraining(j) { return !!j && /^GST$/i.test(String(j.category || "").trim()); }
    var tries = 0, t = setInterval(function () {
      if (typeof window.restViolation !== "function" || window.restViolation.__ap) { if (++tries > 60) clearInterval(t); return; }
      clearInterval(t);
      var orig = window.restViolation;
      var wrap = function (j, ignoreId) {
        if (isTraining(j)) return null;
        var list = window.DOCKETS || (typeof DOCKETS !== "undefined" ? DOCKETS : null);
        if (!Array.isArray(list)) return orig(j, ignoreId);
        var keep = list.slice(), pulled = list.filter(isTraining);
        if (!pulled.length) return orig(j, ignoreId);
        try { list.splice(0, list.length); keep.forEach(function (x) { if (!isTraining(x)) list.push(x); }); return orig(j, ignoreId); }
        finally { list.splice(0, list.length); keep.forEach(function (x) { list.push(x); }); }
      };
      wrap.__ap = true; window.restViolation = wrap;
    }, 1000);
  })();

  function boot() {
    paint();
    var tries = 0, t = setInterval(function () { if (uid() && sb()) { clearInterval(t); load(); } else if (++tries > 60) clearInterval(t); }, 1000);
    setInterval(paint, 60000);
    setInterval(load, 15 * 60000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) load(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
