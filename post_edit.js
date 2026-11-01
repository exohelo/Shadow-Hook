/* The Shadow Hook · post_edit.js (nov1a) — edit the words on your own Board post. A ✎ sits next to the ✕ on your posts;
   tap it, change the text in place, save. Nothing marks the post as edited. The server (story_edit) only lets the
   owner, or the Keymaster, change a post, and keeps the post's dock tag and photo caption setup intact. */
(function () {
  "use strict";
  if (window.SHK_POST_EDIT) return;
  var CSS = ".feed-edit{margin-left:6px}.bpost .bp-head .feed-edit+.feed-del{margin-left:6px}" +
    ".pe-box{margin:6px 0 10px}.pe-box textarea{width:100%;box-sizing:border-box;min-height:70px;resize:vertical;background:var(--plate-2,#15171b);color:var(--bone,#eee);border:1px solid var(--copper-hi,#e8a33d);border-radius:10px;padding:10px;font:14px/1.4 Inter,system-ui,sans-serif}" +
    ".pe-row{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}.pe-row button{border-radius:8px;padding:7px 14px;font:700 12px/1 Barlow Condensed,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;border:1px solid var(--line,#444);background:none;color:var(--steel,#aaa)}" +
    ".pe-row .pe-save{border-color:var(--copper-hi,#e8a33d);color:var(--copper-hi,#e8a33d)}";
  function css() { if (document.getElementById("peCss")) return; var st = document.createElement("style"); st.id = "peCss"; st.textContent = CSS; document.head.appendChild(st); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function isUuid(id) { return /^[0-9a-f-]{36}$/i.test(String(id || "")); }

  function decorate() {
    document.querySelectorAll(".bpost.mine[data-sid]").forEach(function (p) {
      var del = p.querySelector(".bp-head .feed-del"), sid = p.getAttribute("data-sid");
      if (!del || !isUuid(sid) || p.querySelector(".bp-head .feed-edit")) return;
      var b = document.createElement("button"); b.type = "button"; b.className = "feed-inv feed-edit"; b.setAttribute("aria-label", "Edit this post"); b.textContent = "✎";
      del.parentNode.insertBefore(b, del);
    });
  }
  function currentText(p) { var t = p.querySelector(".bp-txt, .bp-say"); if (!t) return ""; var c = t.cloneNode(true); c.querySelectorAll("br").forEach(function (br) { br.replaceWith("\n"); }); return c.textContent; }
  function open(p) {
    if (p.querySelector(".pe-box")) return;
    css();
    var t = p.querySelector(".bp-txt, .bp-say"), box = document.createElement("div");
    box.className = "pe-box";
    box.innerHTML = '<textarea maxlength="2000" aria-label="Your post"></textarea><div class="pe-row"><button type="button" class="pe-cancel">Cancel</button><button type="button" class="pe-save">Save</button></div>';
    box.querySelector("textarea").value = currentText(p);
    if (t) { t.style.display = "none"; t.insertAdjacentElement("afterend", box); }
    else { var head = p.querySelector(".bp-head"); (p.querySelector(".bp-dock") || head).insertAdjacentElement("afterend", box); }
    var ta = box.querySelector("textarea"); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    box.querySelector(".pe-cancel").addEventListener("click", function (e) { e.stopPropagation(); box.remove(); t && (t.style.display = ""); });
    box.querySelector(".pe-save").addEventListener("click", async function (e) {
      e.stopPropagation();
      var text = ta.value.trim(), sid = p.getAttribute("data-sid"), btn = this;
      btn.disabled = true; btn.textContent = "Saving…";
      try {
        var r = await window.SB.rpc("story_edit", { p_id: sid, p_text: text });
        if (r && r.error) throw r.error;
        var html = esc(text).replace(/\n/g, "<br>");
        if (t) { t.innerHTML = html; t.style.display = text ? "" : "none"; }
        else if (text) { var say = document.createElement("div"); say.className = "bp-say"; say.innerHTML = html; box.insertAdjacentElement("beforebegin", say); }
        box.remove();
        try { (window.ALL_STORIES || []).forEach(function (s) { if (String(s.id) === sid) s.note = r.data; }); } catch (x) {}
        try { typeof toast === "function" && toast("Post updated"); } catch (x) {}
      } catch (err) {
        btn.disabled = false; btn.textContent = "Save";
        try { typeof toast === "function" && toast("Couldn’t save: " + ((err && err.message) || err)); } catch (x) {}
      }
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".feed-edit"); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    var p = b.closest(".bpost"); p && open(p);
  }, true);
  var T = 0;
  new MutationObserver(function () { if (T) return; T = setTimeout(function () { T = 0; decorate(); }, 150); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decorate); else decorate();
  window.SHK_POST_EDIT = { decorate: decorate };
})();
