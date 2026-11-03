/* The Shadow Hook — dockets_export.js (nov4b)
   "Download all my dockets", offered only when a member is closing their account (the burn sheet in "account"
   mode, just above the confirm word): one zip with every docket photo this phone holds (named by date,
   shift, terminal, ship and job) plus dockets.csv with every docket's details. Docket photos live only on the phone
   that scanned them (the slip store), so the zip is built right here; dockets whose photo is on another phone are
   still in the spreadsheet, and the count says how many photos weren't here. Nothing is sent anywhere. */
(function () {
  "use strict";
  if (window.__dkExport) return; window.__dkExport = true;
  var JSZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
  var $ = function (id) { return document.getElementById(id); };

  function list() { try { return typeof DOCKETS !== "undefined" && Array.isArray(DOCKETS) ? DOCKETS.slice() : []; } catch (e) { return []; } }
  function zipLib() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = JSZIP; s.async = true;
      s.onload = function () { window.JSZip ? res(window.JSZip) : rej(new Error("zip tool missing")); };
      s.onerror = function () { rej(new Error("couldn’t load the zip tool — check your signal")); };
      document.head.appendChild(s);
    });
  }
  function clean(v) { return String(v == null ? "" : v).replace(/[^\w\-]+/g, " ").trim().replace(/\s+/g, "-").slice(0, 40); }
  function extOf(type) { return /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : /heic/.test(type) ? "heic" : "jpg"; }
  function fileName(j, type, used) {
    var parts = [j.date, j.shift, j.terminal, j.ship, j.category || j.job].map(clean).filter(Boolean);
    var base = parts.join("_") || "docket", name = base + "." + extOf(type), n = 2;
    while (used[name]) name = base + "-" + (n++) + "." + extOf(type);
    used[name] = 1; return name;
  }
  function csvCell(v) {
    if (v == null) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function toCsv(rows) {
    var keys = [], seen = {}, first = ["date", "shift", "terminal", "berth", "ship", "category", "hours", "start"];
    first.concat(rows.reduce(function (a, r) { return a.concat(Object.keys(r)); }, [])).forEach(function (k) {
      if (!seen[k] && k !== "photo" && k.charAt(0) !== "_" && rows.some(function (r) { return r[k] != null && r[k] !== ""; })) { seen[k] = 1; keys.push(k); }
    });
    return [keys.join(",")].concat(rows.map(function (r) { return keys.map(function (k) { return csvCell(r[k]); }).join(","); })).join("\n");
  }
  function save(blob, name) {
    var file = null; try { file = new File([blob], name, { type: "application/zip" }); } catch (e) {}
    var standalone = (window.navigator.standalone === true) || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    if (standalone && file && navigator.canShare && navigator.canShare({ files: [file] })) {   /* an installed app on a phone: hand it to the share sheet (Save to Files) */
      return navigator.share({ files: [file], title: name }).catch(function () { anchor(blob, name); });
    }
    anchor(blob, name); return Promise.resolve();
  }
  function anchor(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; a.rel = "noopener"; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 60000);
  }

  async function run(btn, note) {
    var all = list();
    if (!all.length) { note.textContent = "No dockets on this phone yet."; return; }
    var lbl = btn.querySelector(".sl1"), was = lbl.textContent; btn.disabled = true;
    try {
      lbl.textContent = "GETTING READY…";
      var Z = await zipLib(), zip = new Z(), photos = zip.folder("photos"), used = {}, got = 0, missing = 0;
      for (var i = 0; i < all.length; i++) {
        lbl.textContent = "PACKING " + (i + 1) + " OF " + all.length + "…";
        var j = all[i], b = null;
        if (j && j.photo) { try { b = typeof window.docketPhotoBlob === "function" ? await window.docketPhotoBlob(j) : null; } catch (e) { b = null; } }
        if (b && b.size) { photos.file(fileName(j, b.type || "image/jpeg", used), new Uint8Array(await b.arrayBuffer())); got++; } else if (j && j.photo) missing++;
      }
      zip.file("dockets.csv", toCsv(all));
      zip.file("README.txt", "Your dockets from The Order of the Shadow Hook\n\n" +
        "dockets.csv  every docket on this phone (" + all.length + "), one per row; opens in Excel, Numbers or Google Sheets\n" +
        "photos/      the slip photos this phone holds (" + got + "), named date_shift_terminal_ship_job\n" +
        (missing ? "\n" + missing + " docket photo" + (missing === 1 ? " was" : "s were") + " taken on another phone; download from that phone to get " + (missing === 1 ? "it" : "them") + ".\n" : "") +
        "\nMade " + new Date().toLocaleString() + "\n");
      lbl.textContent = "ZIPPING…";
      var blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      var d = new Date(), name = "shadow-hook-dockets-" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0") + ".zip";
      await save(blob, name);
      note.innerHTML = "✓ <b>" + all.length + "</b> docket" + (all.length === 1 ? "" : "s") + " and <b>" + got + "</b> photo" + (got === 1 ? "" : "s") + " saved as " + name +
        (missing ? " · " + missing + " photo" + (missing === 1 ? " is" : "s are") + " on another phone" : "");
    } catch (e) {
      note.textContent = "Couldn’t make the download: " + ((e && e.message) || e);
    }
    btn.disabled = false; lbl.textContent = was;
  }

  /* in the close-my-account sheet only, above "Type … to confirm" */
  function mountBurn() {
    var sh = $("burnSheet"), card = sh && sh.querySelector(".sheet-card"); if (!card || $("dkExportBox")) return;
    var word = card.querySelector("#burnWord"), lbl = word && word.previousElementSibling; if (!lbl) return;
    var box = document.createElement("div"); box.id = "dkExportBox";
    box.style.cssText = "margin:0 0 14px;padding:12px;border:1px solid rgba(242,193,78,.55);border-radius:12px;background:rgba(242,193,78,.08)";
    box.innerHTML = '<div style="font:700 13px/1.4 Inter,system-ui,sans-serif;color:var(--bone,#f4f1ea);margin-bottom:4px">Before you go: take your dockets with you.</div>' +
      '<div class="sub" style="margin-bottom:10px;line-height:1.45">Every docket photo on this phone plus a spreadsheet of all your dockets, in one zip. Once the account is closed they can’t be brought back.</div>' +
      '<button type="button" id="dkExportBtn" class="btn-line" style="width:100%"><span class="sl1">⬇ DOWNLOAD ALL MY DOCKETS</span></button>' +
      '<div id="dkExportNote" class="sub" style="margin-top:8px;line-height:1.45"></div>';
    lbl.insertAdjacentElement("beforebegin", box);
    $("dkExportBtn").addEventListener("click", function () { run($("dkExportBtn"), $("dkExportNote")); });
  }
  function hookBurn() {
    var orig = window.burnSheet; if (typeof orig !== "function" || orig._dk) return typeof orig === "function";
    var w = function (mode) { var r = orig.apply(this, arguments); if (mode === "account") { try { mountBurn(); } catch (e) {} } return r; };
    w._dk = true; window.burnSheet = w; return true;
  }
  var n = 0, t = setInterval(function () { if (hookBurn() || ++n > 120) clearInterval(t); }, 500);
})();
