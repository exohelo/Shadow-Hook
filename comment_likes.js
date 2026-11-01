/* The Shadow Hook · comment_likes.js (nov1a) — a ♥ with a count on every comment in The Talk. Tap to like, tap again to
   take it back. Counts come from public.comment_likes; the comment's author gets a "liked your comment" notification. */
(function () {
  "use strict";
  if (window.SHK_CLIKES) return;
  var N = {}, MINE = new Set(), LOADED = new Set(), busy = false;
  var CSS = ".svc-foot .svc-lk{background:none;border:0;padding:0 0 0 14px;cursor:pointer;font:600 12px Inter,system-ui,sans-serif;color:var(--steel,#999);display:inline-flex;align-items:center;gap:4px}" +
    ".svc-foot .svc-lk.on{color:#e0245e}.svc-foot .svc-lk .h{font-size:13px;line-height:1}.svc-foot .svc-lk.pop .h{animation:clkPop .35s ease}" +
    "@keyframes clkPop{0%{transform:scale(1)}50%{transform:scale(1.45)}100%{transform:scale(1)}}";
  function css() { if (document.getElementById("clkCss")) return; var st = document.createElement("style"); st.id = "clkCss"; st.textContent = CSS; document.head.appendChild(st); }
  function uuid(id) { return /^[0-9a-f-]{36}$/i.test(String(id || "")); }
  function paintBtn(b, id) {
    var on = MINE.has(id), n = N[id] || 0;
    b.classList.toggle("on", on);
    b.innerHTML = '<span class="h">' + (on ? "♥" : "♡") + "</span>" + (n ? "<span>" + n + "</span>" : "");
    b.setAttribute("aria-label", (on ? "Unlike" : "Like") + " this comment" + (n ? " (" + n + ")" : ""));
  }
  function decorate() {
    var need = [];
    document.querySelectorAll(".svc-row[data-crid]").forEach(function (row) {
      var id = row.getAttribute("data-crid"); if (!uuid(id)) return;
      var foot = row.querySelector(".svc-foot"); if (!foot) return;
      var b = foot.querySelector(".svc-lk");
      if (!b) { css(); b = document.createElement("button"); b.type = "button"; b.className = "svc-lk"; b.setAttribute("data-clk", id); foot.appendChild(b); }
      paintBtn(b, id);
      if (!LOADED.has(id)) need.push(id);
    });
    if (need.length) load(need);
  }
  async function load(ids) {
    if (busy || !window.SB) return; busy = true;
    try {
      ids.forEach(function (id) { LOADED.add(id); N[id] = N[id] || 0; });
      var r = await window.SB.from("comment_likes").select("comment_id,user_id").in("comment_id", ids).limit(2000);
      if (r && !r.error) {
        ids.forEach(function (id) { N[id] = 0; MINE.delete(id); });
        (r.data || []).forEach(function (x) { N[x.comment_id] = (N[x.comment_id] || 0) + 1; if (x.user_id === window.__shkUid) MINE.add(x.comment_id); });
      }
    } catch (e) {}
    busy = false;
    document.querySelectorAll(".svc-lk[data-clk]").forEach(function (b) { paintBtn(b, b.getAttribute("data-clk")); });
  }
  async function toggle(b) {
    var id = b.getAttribute("data-clk"), uid = window.__shkUid;
    if (!uid || !window.SB) { try { typeof toast === "function" && toast("Sign in to like comments"); } catch (e) {} return; }
    var on = !MINE.has(id);
    on ? MINE.add(id) : MINE.delete(id); N[id] = Math.max(0, (N[id] || 0) + (on ? 1 : -1));
    paintBtn(b, id); if (on) { b.classList.remove("pop"); void b.offsetWidth; b.classList.add("pop"); }
    try {
      var r = on ? await window.SB.from("comment_likes").insert({ comment_id: id, user_id: uid })
                 : await window.SB.from("comment_likes").delete().eq("comment_id", id).eq("user_id", uid);
      if (r && r.error && !/duplicate/i.test(r.error.message || "")) throw r.error;
    } catch (e) {
      on ? MINE.delete(id) : MINE.add(id); N[id] = Math.max(0, (N[id] || 0) + (on ? -1 : 1)); paintBtn(b, id);
      try { typeof toast === "function" && toast("Couldn’t save that like"); } catch (x) {}
    }
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest(".svc-lk[data-clk]"); if (!b) return;
    e.stopPropagation(); e.preventDefault(); toggle(b);
  }, true);
  var T = 0;
  new MutationObserver(function () { if (T) return; T = setTimeout(function () { T = 0; decorate(); }, 120); }).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", decorate); else decorate();
  window.SHK_CLIKES = { decorate: decorate };
})();
