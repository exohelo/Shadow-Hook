/* alarm_quiet.js — keeps phone signal drops out of the Keymaster's alarms.
   1) A realtime message cut off mid-way (weak signal) made supabase-js throw
      "JSON Parse error: Unterminated string". It is dropped quietly now; the
      live feed carries on with the next message.
   2) "Load failed" / "Failed to fetch" is a phone losing signal for a moment.
      Each query error now carries the table it came from; a single drop is not
      an alarm. The same table failing 3+ times in one visit is filed once, as
      "net", with the table named. */
(function () {
  if (window.__alarmQuiet) return; window.__alarmQuiet = 1;
  var NET = /Load failed|Failed to fetch|NetworkError|network connection was lost|Network request failed|The Internet connection appears to be offline|cancelled|aborted/i;
  var dropped = 0;

  function armSocket() {
    try {
      var R = window.SB && window.SB.realtime, S = R && R.socketAdapter && R.socketAdapter.socket;
      if (!S || typeof S.decode !== "function" || S.decode.__aq) return;
      var orig = S.decode;
      var w = function (raw, cb) {
        try { return orig.call(this, raw, cb); }
        catch (e) {
          if (e instanceof SyntaxError && /JSON/i.test(String(e.message || ""))) {
            dropped++;
            try { window.DEVLOG && DEVLOG.err("[rt] cut-off message dropped (" + (raw && raw.length || 0) + " chars)", ""); } catch (x) {}
            return;
          }
          throw e;
        }
      };
      w.__aq = 1; S.decode = w;
    } catch (x) {}
  }

  function armQueries() {
    try {
      if (!window.SB || typeof window.SB.from !== "function") return false;
      var P = Object.getPrototypeOf(window.SB.from("profiles").select("id"));
      while (P && !Object.prototype.hasOwnProperty.call(P, "then")) P = Object.getPrototypeOf(P);
      if (!P) return false; if (P.__aqTag) return true; P.__aqTag = 1;
      var orig = P.then;
      P.then = function (ok, bad) {
        var self = this, label = "?";
        try { var u = String(self.url && self.url.pathname || self.url || ""), m = /\/rest\/v1\/rpc\/(\w+)/.exec(u) || /\/rest\/v1\/(\w+)/.exec(u); label = m ? (/\/rpc\//.test(u) ? "rpc " : "") + m[1] : "?"; } catch (x) {}
        function tag(e) { try { if (e && typeof e === "object" && !e.__at) Object.defineProperty(e, "__at", { value: label, enumerable: false }); } catch (x) {} return e; }
        return orig.call(self, function (v) { try { v && v.error && tag(v.error); } catch (x) {} return ok ? ok(v) : v; },
          function (e) { tag(e); if (bad) return bad(e); throw e; });
      };
      return true;
    } catch (x) { return false; }
  }

  var seen = {}, filed = {};
  function armAlert() {
    var A = window.shkAlert;
    if (typeof A !== "function" || A.__aq) return typeof A === "function";
    var w = function (where, err, src) {
      try {
        var msg = String(err && err.message || err || "");
        if ((where === "promise" || where === "boot·promise" || where === "uncaught") && NET.test(msg)) {
          var t = (err && err.__at) || "?";
          seen[t] = (seen[t] || 0) + 1;
          try { window.DEVLOG && DEVLOG.err("[signal] " + msg + " · " + t, ""); } catch (x) {}
          if (seen[t] >= 3 && !filed[t] && navigator.onLine !== false) {
            filed[t] = 1;
            return A.call(this, "net", msg + " · " + t + " failed " + seen[t] + "× this visit", "");
          }
          return;
        }
        if (where === "uncaught" && /JSON Parse error|Unexpected end of JSON|Unterminated string/i.test(msg) && /supabase-js/.test(String(src || ""))) {
          dropped++; return;
        }
      } catch (x) {}
      return A.apply(this, arguments);
    };
    w.__aq = 1; window.shkAlert = w;
    return true;
  }

  var n = 0;
  (function loop() {
    var a = armAlert(), q = armQueries(); armSocket();
    if (++n < 60 && !(a && q)) setTimeout(loop, 500);
  })();
  setInterval(armSocket, 5000);
  window.shkAlarmQuiet = function () { return { dropped: dropped, signal: seen }; };
})();
