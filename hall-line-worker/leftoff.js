/* ═════════════════════════════════════════════════════════════════════════════
   #jul30 — HOTLINE FALLBACK READER (patch for hall-line-worker/leftoff.js)

   WHY: the after-dispatch recording ("You('ve) reached the casual for Sunday on
   the dayside… We left off the letter Y, Y like in yellow, 4905") kept landing
   in hall_line_log as card:null · conf 0 even though the answer is right there
   in the transcript — the main parser misses some of the hall's phrasings.
   This adds one plain-regex pass that ONLY runs when parseLeftOff found no
   card, so it can never degrade a reading the main parser already made.

   INSTALL — two pastes into hall-line-worker/leftoff.js:

   ── PASTE 1 ── directly AFTER this existing line:
        const r = parseLeftOff(tx || '', { keywords });
   add:
        if (!r.card) { try {
          const fb = fallbackLeftOff(tx || '');
          if (fb) { r.card = fb.card; r.conf = Math.max(r.conf || 0, fb.conf);
                    r.mode = r.mode || fb.mode; r.heard = r.heard || fb.heard;
                    if (!r.all || !r.all.length) r.all = [{ card: fb.card, conf: fb.conf }];
                    log('fallback reader:', fb.card, '· mode', fb.mode, '· conf', fb.conf); }
        } catch (e) {} }

   ── PASTE 2 ── the function below, at the very END of leftoff.js.
   ═════════════════════════════════════════════════════════════════════════════ */
function fallbackLeftOff(text) {
  const tx = String(text || '').toLowerCase().replace(/[’']/g, '');
  if (!tx.trim()) return null;

  /* what kind of reading is this? the after-dispatch message says where it
     LEFT OFF; the forecast message says where it STARTS. end wins if both. */
  const isEnd   = /\bleft\s*off\b|\bleaving\s*off\b|\bstopp?ed\s+(?:at|on)\b|\bended\s+(?:at|on)\b|\bcut\s*off\b|\blast\s+(?:card|number|call)\b/.test(tx);
  const isStart = /\b(?:start|starting|starts|begin|beginning|open|opening)\b[^.]{0,20}\b(?:with|for|at|on|the)\b/.test(tx);
  let mode = isEnd ? 'end' : (isStart ? 'start' : null);
  /* the early-forecast message has no start verb at all — "the early forecast …
     on the letter Y like Yankee, 4976". A forecast IS a start reading. */
  if (!mode && /\bforecast\b/.test(tx)) mode = 'start';
  if (!mode) return null;

  /* strongest read: "Y, Y like in yellow, 4905" / "V like Victor, 5045" /
     "Y is in yellow, 4879" — a spelled letter, a confirming word that starts
     with that same letter, then the 3-5 digit card number. */
  let m = tx.match(/\b([a-z])\b[\s,]*(?:(?:is|as|like)\s+(?:in\s+)?)([a-z]{3,12})[^0-9]{0,20}?(\d{3,5})\b/);
  if (m && m[2][0] === m[1]) {
    return { card: (m[1] + m[3]).toUpperCase(), conf: 0.85, mode: mode,
             heard: m[0].slice(0, 60) };
  }

  /* fallback read: "letter y … 4905" with no phonetic confirmation — good
     enough to log loudly, and posts only if it clears MIN_CONF elsewhere. */
  m = tx.match(/\bletter\s+([a-z])\b[^0-9]{0,40}?(\d{3,5})\b/);
  if (m) {
    return { card: (m[1] + m[2]).toUpperCase(), conf: 0.7, mode: mode,
             heard: m[0].slice(0, 60) };
  }
  return null;
}
