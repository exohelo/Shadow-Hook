#!/usr/bin/env node
'use strict';
/* ============================================================================
   leftoff.js — call the hall's recorded dispatch line, transcribe it, parse
   what it announced, and post it to the Order's record.
   #jul23 REWORK — built against the REAL recordings: the line announces the
   casual job FORECAST ("we're going to start with the letter B, B as in Baker,
   4704"), i.e. where the NEXT board STARTS — not only where the last one left
   off. The worker now reads both: a start callout for board X becomes the
   previous board's END (start minus one card — the same chain rule the app
   runs on), pinned to the exact board the transcript names ("…for Thursday
   night, July 23rd"). It also RETRIES the call when a recording comes back
   empty or unreadable (RETRY_CALLS, default 2), and logs WHICH board every
   reading is about (hall_line_log.k + extras.kind/about/posted_to), so the
   app's Hall Line card and dev log can show it even when it isn't posted.
   Pipeline:  Twilio call (recorded) -> recording mp3 -> Whisper transcript
              -> parse card (parse.js) -> sanity check vs previous board
              -> upsert bot row into Supabase `board_wire` (the app ingests it
                 exactly like a member's log: chain ripples, predictions
                 re-figure, any hand can correct it in-app)
              -> always append a row to `hall_line_log` for the audit trail.
   The bot NEVER overwrites a human's row. Last word stands for humans;
   the bot only posts when the key is unclaimed or was last written by itself.
   Zero dependencies — Node 20+ (global fetch / FormData / Blob).
   Env (GitHub secrets):
     TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM   Twilio account + your Twilio number
     DISPATCH_NUMBER                         the hall's recorded line (+1310...)
     DISPATCH_DTMF                           optional menu presses, e.g. "ww2"
                                             (w = half-second wait)
     CALL_SECONDS                            how long to stay on the line (default 120)
     OPENAI_API_KEY                          for Whisper transcription
     SUPABASE_URL, SUPABASE_SERVICE_KEY      your project + service-role key
     SLOT_KEYWORDS                           optional csv to steer multi-board
                                             recordings, e.g. "casual,unidentified"
     MIN_CONF                                post threshold (default 0.75)
     RETRY_CALLS                             live-call attempts per run (default 2)
     BOT_ID / BOT_HANDLE                     default hall-line-bot / ☎ Hall Line
   Flags (local testing):
     --transcript "..."   skip Twilio+Whisper, parse this text
     --audio file.mp3     skip Twilio, transcribe this file
     --early              dispatch ended early: open the TIME GATE only — every
                          cost protection (wire skip, human skip, call budget)
                          stays armed. This is the Keymaster's early-run switch.
     --force              override EVERYTHING (gate + all skips) — always dials
     --dry-run            do everything except write to Supabase
   #aug13(cost) — COST RAILS. Every run ends with one COST line + a GitHub step
   summary, so the Actions list answers "did that run spend money?" at a glance.
   New guarantees: a run that cannot READ the wire refuses to dial (a broken
   read otherwise burns a call per sweep, silently); a human-owned target row
   skips the call BEFORE dialing (not after); MAX_CALLS_PER_WINDOW hard-caps
   paid calls per board window; and sweeps corroborate each other through
   hall_line_log — two agreeing reads can post with zero new calls.
   ========================================================================== */
const fs = require('fs');
const { parseLeftOff, parseCounts, parseSpecial, parseForecastTarget } = require('./parse.js');
/* ---------- config ---------- */
const env = k => (process.env[k] || '').trim();
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const argAfter = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };
const CFG = {
  twilioSid:   env('TWILIO_SID'),
  twilioToken: env('TWILIO_TOKEN'),
  twilioFrom:  env('TWILIO_FROM'),
  dispatchNum: env('DISPATCH_NUMBER'),
  dtmf:        env('DISPATCH_DTMF'),
  callSeconds: parseInt(env('CALL_SECONDS') || '120', 10),
  openaiKey:   env('OPENAI_API_KEY'),
  sbUrl:       env('SUPABASE_URL').replace(/\/+$/, ''),
  sbKey:       env('SUPABASE_SERVICE_KEY'),
  minConf:     parseFloat(env('MIN_CONF') || '0.75'),
  retryCalls:  Math.max(1, parseInt(env('RETRY_CALLS') || '2', 10)),   // #jul23 — call again if the line gave nothing usable
  /* #aug13(cost) — HARD CEILING on paid calls per board window. The dense cron net is
     supposed to be free after the first good read; this bounds the worst case even
     when every read comes back garbage: once this many calls have burned in one
     window, later sweeps run log-only, no dial. */
  maxCallsWindow: Math.max(1, parseInt(env('MAX_CALLS_PER_WINDOW') || '4', 10)),
  botId:       env('BOT_ID') || 'hall-line-bot',
  botHandle:   env('BOT_HANDLE') || '☎ Hall Line',
  keywords:    (env('SLOT_KEYWORDS') || '').split(',').map(s => s.trim()).filter(Boolean),
  force:       flag('--force'),
  /* #aug13(cost) — "dispatch ended early": opens the TIME GATE only. Unlike --force,
     every cost protection stays armed (wire skip, human skip, budget) — so the
     Keymaster's early run never burns a call the wire already answered. */
  early:       flag('--early'),
  dryRun:      flag('--dry-run'),
  transcript:  argAfter('--transcript'),
  audioFile:   argAfter('--audio'),
};
const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const log = (...a) => console.log('[leftoff]', ...a);
/* #aug13(cost) — say the money out loud. Every run ends with one COST line and,
   on GitHub, a step summary — so the Actions list answers "did that run spend?"
   without opening a single log. */
let CALLS_PLACED = 0;
function summary(line) {
  log(line);
  try {
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n\n');
  } catch (e) {}
}
function costLine() {
  return CALLS_PLACED === 0
    ? '💰 COST: $0 — no call placed this run.'
    : '💸 COST: ' + CALLS_PLACED + ' paid call' + (CALLS_PLACED > 1 ? 's' : '') + ' (Twilio + Whisper) this run.';
}
/* ---------- Long Beach wall-clock ---------- */
function laParts(ts) {
  const d = new Date(ts || Date.now());
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short'
  }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  return {
    iso: p.year + '-' + p.month + '-' + p.day,
    dow: p.weekday,
    mins: (parseInt(p.hour, 10) % 24) * 60 + parseInt(p.minute, 10)
  };
}
/* which board the recording is talking about = the board that just ENDED.
   Day board ends 9:30, night board 19:00 (#205 — moved from 19:30, hall timeline the app runs on). */
function targetBoard(early) {
  const now = laParts();
  /* #aug13(cost) — an EARLY run means "the board wrapped ahead of the clock": before
     9:30 the just-ended board is TODAY'S AM (not yesterday's PM), and before 19:00
     it's TODAY'S PM. Only the --early flag reads the clock this way. */
  if (early) {
    if (now.mins >= 6 * 60 && now.mins < 9 * 60 + 30)  return { key: now.iso + '_' + now.dow + '_AM', slot: 'AM', iso: now.iso, dow: now.dow };
    if (now.mins >= 15 * 60 && now.mins < 19 * 60)     return { key: now.iso + '_' + now.dow + '_PM', slot: 'PM', iso: now.iso, dow: now.dow };
  }
  if (now.mins >= 19 * 60) return { key: now.iso + '_' + now.dow + '_PM', slot: 'PM', iso: now.iso, dow: now.dow };
  if (now.mins >= 9 * 60 + 30)  return { key: now.iso + '_' + now.dow + '_AM', slot: 'AM', iso: now.iso, dow: now.dow };
  const y = laParts(Date.now() - 86400000);
  return { key: y.iso + '_' + y.dow + '_PM', slot: 'PM', iso: y.iso, dow: y.dow };
}
/* fresh-recording windows: shortly after each board ends
   (#205 — night dispatch ends 19:00 now, so the night gate opens 19:05) */
function insideRunWindow() {
  const m = laParts().mins;
  return (m >= 9 * 60 + 35 && m <= 13 * 60) || (m >= 19 * 60 + 5 && m <= 23 * 60 + 30);
}
/* #aug13(cost) — when did the CURRENT board window open (for the call budget)?
   Returns minutes-ago; pure on nowMins so it's testable. */
function windowAgeMins(nowMins) {
  if (nowMins >= 19 * 60) return nowMins - 19 * 60;           // tonight's window
  if (nowMins >= 9 * 60 + 30) return nowMins - (9 * 60 + 30); // this morning's
  return nowMins + (24 * 60 - 19 * 60);                       // still yesterday's night window
}
function windowStartISO() {
  return new Date(Date.now() - windowAgeMins(laParts().mins) * 60000).toISOString();
}
/* the board directly before: AM -> previous-day PM, PM -> same-day AM */
function prevBoardKey(t) {
  if (t.slot === 'PM') return t.iso + '_' + t.dow + '_AM';
  const d = new Date(t.iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return iso + '_' + DOW[d.getDay()] + '_PM';
}
/* #aug12 — keep the digit width: prevCardId pads (B0705→B0704) but this one
   didn't (B0704→B705), so one low-numbered card could de-pad the whole chain. */
function nextCard(id) { const m = /^([A-Z])(\d+)$/.exec(id || ''); return m ? m[1] + String(parseInt(m[2], 10) + 1).padStart(m[2].length, '0') : id; }
function letterDist(a, b) { return ((AZ.indexOf(b[0]) - AZ.indexOf(a[0])) % 26 + 26) % 26; }
/* which board a heard COUNT belongs to:
   Early + Night final talk about TONIGHT's board; Day final about the next
   morning's board (announced the night before). The PDF is the record — these
   are only compared against it, never written over it. */
function boardKeyFor(daysAhead, slot) {
  const p = laParts(Date.now() + daysAhead * 86400000);
  return p.iso + '_' + p.dow + '_' + slot;
}
function countTargetKey(kind) {
  const m = laParts().mins;
  if (kind === 'early' || kind === 'night_final' || kind === 'final') return boardKeyFor(0, 'PM');
  if (kind === 'day_final') return boardKeyFor(m >= 19 * 60 ? 1 : 0, 'AM');   /* #205 — flips with the 19:00 end */
  return null;
}
function pdfTotals(data) {
  const t = data && data.total ? (data.total.total != null ? data.total.total : (typeof data.total === 'number' ? data.total : null)) : null;
  const e = data && data.early && data.early.total ? (data.early.total.total != null ? data.early.total.total : null) : null;
  return { final: t, early: e };
}
/* ---------- Supabase (REST, service key) ---------- */
function sbHeaders(extra) {
  return Object.assign({
    apikey: CFG.sbKey,
    Authorization: 'Bearer ' + CFG.sbKey,
    'Content-Type': 'application/json'
  }, extra || {});
}
async function sbSelect(table, query) {
  const r = await fetch(CFG.sbUrl + '/rest/v1/' + table + '?' + query, { headers: sbHeaders() });
  if (!r.ok) throw new Error('supabase select ' + table + ': ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function sbUpsert(table, row, onConflict) {
  const r = await fetch(CFG.sbUrl + '/rest/v1/' + table + (onConflict ? '?on_conflict=' + onConflict : ''), {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
    body: JSON.stringify([row])
  });
  if (!r.ok) throw new Error('supabase upsert ' + table + ': ' + r.status + ' ' + (await r.text()).slice(0, 200));
}
async function sbInsert(table, row) {
  const r = await fetch(CFG.sbUrl + '/rest/v1/' + table, {
    method: 'POST',
    headers: sbHeaders({ Prefer: 'return=minimal' }),
    body: JSON.stringify([row])
  });
  if (!r.ok) log('warn: could not write ' + table + ':', r.status, (await r.text()).slice(0, 200));
  return r.ok;
}
/* ---------- Twilio: place a recorded call to the hotline ---------- */
async function twilio(path, form) {
  const url = 'https://api.twilio.com/2010-04-01/Accounts/' + CFG.twilioSid + path;
  const opts = { headers: { Authorization: 'Basic ' + Buffer.from(CFG.twilioSid + ':' + CFG.twilioToken).toString('base64') } };
  if (form) {
    opts.method = 'POST';
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(form).toString();
  }
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error('twilio ' + path + ': ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return r.json();
}
const sleep = ms => new Promise(res => setTimeout(res, ms));
async function recordHotline() {
  const secs = Math.min(Math.max(CFG.callSeconds, 30), 240);
  const form = {
    To: CFG.dispatchNum,
    From: CFG.twilioFrom,
    Record: 'true',
    Twiml: '<Response><Pause length="' + secs + '"/><Hangup/></Response>'
  };
  if (CFG.dtmf) form.SendDigits = CFG.dtmf;
  const call = await twilio('/Calls.json', form);
  CALLS_PLACED++;                       /* #aug13(cost) — count the money at the moment it's spent */
  log('call placed:', call.sid);
  // wait for the call to finish (recording completes shortly after)
  const deadline = Date.now() + (secs + 90) * 1000;
  let status = call.status;
  while (Date.now() < deadline && !['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(status)) {
    await sleep(5000);
    status = (await twilio('/Calls/' + call.sid + '.json')).status;
  }
  log('call status:', status);
  if (status !== 'completed') throw new Error('call did not complete: ' + status);
  // fetch the recording
  let rec = null;
  for (let i = 0; i < 12 && !rec; i++) {
    const list = await twilio('/Recordings.json?CallSid=' + call.sid);
    rec = (list.recordings || []).find(x => x.status === 'completed') || null;
    if (!rec) await sleep(5000);
  }
  if (!rec) throw new Error('no recording appeared for call ' + call.sid);
  const audio = await fetch('https://api.twilio.com' + rec.uri.replace('.json', '.mp3'), {
    headers: { Authorization: 'Basic ' + Buffer.from(CFG.twilioSid + ':' + CFG.twilioToken).toString('base64') }
  });
  if (!audio.ok) throw new Error('recording download: ' + audio.status);
  const buf = Buffer.from(await audio.arrayBuffer());
  log('recording:', rec.sid, Math.round(buf.length / 1024) + 'kB,', rec.duration + 's');
  return { buf, callSid: call.sid };
}
/* ---------- Whisper ---------- */
async function transcribe(buf, prevEnd) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'audio/mpeg' }), 'hotline.mp3');
  fd.append('model', 'whisper-1');
  fd.append('language', 'en');
  fd.append('temperature', '0');
  fd.append('prompt',
    'ILWU Local 13 longshore dispatch recording, San Pedro / Long Beach. ' +
    'It announces the casual job forecast: where boards left off, or which letter and card ' +
    'number the next board will start with — like "we are going to start with the letter B, ' +
    'B as in Baker, 4704" or "left off at W4912".' +
    (prevEnd ? ' The previous board ended at ' + prevEnd + '.' : ''));
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + CFG.openaiKey },
    body: fd
  });
  if (!r.ok) throw new Error('whisper: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return (await r.json()).text || '';
}
/* ---------- board-key arithmetic (#jul23) ---------- */
function keyParts(k){ const m=/^(\d{4}-\d{2}-\d{2})_[A-Za-z]+_(AM|PM)$/.exec(String(k||'')); return m?{iso:m[1],slot:m[2]}:null; }
function isoShift(iso, n){
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function keyFor(iso, slot){ return iso + '_' + DOW[new Date(iso + 'T12:00:00').getDay()] + '_' + slot; }
function prevKeyOf(k){ const p = keyParts(k); if (!p) return null;
  return p.slot === 'PM' ? keyFor(p.iso, 'AM') : keyFor(isoShift(p.iso, -1), 'PM'); }
function nextKeyOf(k){ const p = keyParts(k); if (!p) return null;
  return p.slot === 'AM' ? keyFor(p.iso, 'PM') : keyFor(isoShift(p.iso, 1), 'AM'); }
function prevCardId(card){ const m = /^([A-Z])(\d{3,5})$/.exec(card || ''); if (!m) return null;
  const n = parseInt(m[2], 10) - 1; if (n <= 0) return null;
  return m[1] + String(n).padStart(m[2].length, '0'); }
function endOf(row){ return row && row.patch && row.patch.end ? String(row.patch.end).toUpperCase() : null; }
/* #jul23 — WHICH BOARD is the recording about? The transcript usually says it
   outright ("casual job forecast for Thursday night, July 23rd"); trust that
   first, and only fall back to wall-clock guessing when it doesn't. */
function resolveAboutKey(ft, t, mode){
  if (mode !== 'start') return t.key;                        // a left-off is about the board that just ended
  const fallback = nextKeyOf(t.key);                          // a start callout is about the NEXT board
  if (!ft || !ft.slot) return fallback;
  let best = null;
  for (let n = -1; n <= 2; n++) {
    const p = laParts(Date.now() + n * 86400000);
    let sc = 0;
    if (ft.dow && p.dow === ft.dow) sc += 2;
    if (ft.mon && ft.day) {
      const md = String(ft.mon).padStart(2, '0') + '-' + String(ft.day).padStart(2, '0');
      if (p.iso.slice(5) === md) sc += 3;
    }
    if (ft.rel === 'tomorrow' && n === 1) sc += 1;
    if (ft.rel === 'today' && n === 0) sc += 1;
    if ((ft.dow || (ft.mon && ft.day)) && sc === 0) continue; // named a day, this date isn't it
    const cand = { key: p.iso + '_' + p.dow + '_' + ft.slot, sc, dist: Math.abs(n) + (n < 0 ? 0.5 : 0) };
    if (!best || sc > best.sc || (sc === best.sc && cand.dist < best.dist)) best = cand;
  }
  return (best && best.key) || fallback;
}
/* ---------- main ---------- */
async function main() { try {
  const t = targetBoard(CFG.early);
  const liveMode = !CFG.transcript && !CFG.audioFile;
  log('target board:', t.key, '· LA time gate', insideRunWindow() ? 'OPEN' : 'closed' + (CFG.early ? ' (early run)' : ''));
  if (!insideRunWindow() && !CFG.force && !CFG.early && !CFG.transcript && !CFG.audioFile) {
    summary('⏸ SKIPPED — outside the fresh-recording window (dispatch ended early? use the early input; force overrides everything).');
    return;
  }
  /* one read of the wire around the target: two boards back through two ahead —
     enough to chain starts, sanity-check ends, and honor human ownership. */
  const NEAR = [prevKeyOf(prevKeyOf(t.key)), prevKeyOf(t.key), t.key, nextKeyOf(t.key), nextKeyOf(nextKeyOf(t.key))].filter(Boolean);
  const WIRE = {};
  let wireReadOk = false;
  if (CFG.sbUrl && CFG.sbKey) {
    try {
      const rows = await sbSelect('board_wire', 'k=in.(' + NEAR.map(k => '%22' + k + '%22').join(',') + ')&select=*');
      rows.forEach(r => { WIRE[r.k] = r; });
      wireReadOk = true;
    } catch (e) { log('warn: could not read board_wire:', e.message); }
  }
  /* #aug13(cost) — NO CHECK, NO CALL. If the wire can't be READ, the pre-call skip
     is blind: a broken key or RLS change would burn a paid call on EVERY sweep all
     day, silently, even with the answer already sitting on the wire. A run that
     cannot verify does not dial — it fails loudly so the broken read gets seen. */
  if (liveMode && !wireReadOk && !CFG.force) {
    summary('❌ ABORTED before dialing — board_wire could not be read, so the skip check is blind. Fix the read (key/RLS/network); forcing past this burns a call per sweep.');
    process.exitCode = 1;
    return;
  }
  const prevEnd = endOf(WIRE[prevKeyOf(t.key)]);
  /* #jul30b — PRE-CALL SKIP: if the wire already carries the end card of the
     board that just ended (a hand sealed it, or an earlier sweep read it),
     the number is in — exit BEFORE dialing. This is what makes the dense
     retry schedule free: only sweeps that still NEED a number spend a call. */
  if (!CFG.force && !CFG.transcript && !CFG.audioFile && endOf(WIRE[t.key])) {
    summary('✓ SKIPPED — the wire already carries ' + t.key + ' end=' + endOf(WIRE[t.key]) + '. No call needed.');
    return;
  }
  /* #aug13(cost) — A HUMAN ROW IS A FULL STOP, EVEN WITHOUT AN END. The old order
     checked humanOwns only AFTER the call: a hand's start-only row on the target
     board meant every sweep dialed (money), parsed, and then "stood down" — the
     one outcome the bot could post was on a key it would never touch. If a human
     owns the target row, the call can buy nothing: skip before dialing. */
  const rowT = WIRE[t.key];
  if (!CFG.force && liveMode && rowT && rowT.by && rowT.by !== CFG.botId) {
    summary('✓ SKIPPED — a hand already owns ' + t.key + ' (' + (rowT.by_handle || rowT.by) + '); the bot never writes over a human, so a call could post nothing.');
    return;
  }
  /* #aug13(cost) — THE WINDOW'S CALL BUDGET + PRIOR READS. hall_line_log already
     records every run; read this window's rows once, up front. Two uses:
       · budget — count the calls already PAID for this window; at the ceiling,
         later sweeps stop dialing (the worst case has a price, by design);
       · corroboration — two different recordings agreeing on the same card is
         stronger evidence than either alone. If earlier reads this window
         already agree at near-post confidence, post FROM THE LOG, zero calls. */
  let priorReads = [];
  if (liveMode && wireReadOk) {
    try {
      const lr = await sbSelect('hall_line_log',
        'ran_at=gte.' + encodeURIComponent(windowStartISO()) + '&select=k,card,conf,call_sid,posted,extras&order=ran_at.desc&limit=30');
      priorReads = Array.isArray(lr) ? lr : [];
    } catch (e) { log('warn: could not read hall_line_log (budget/corroboration unavailable):', e.message); }
    const callsSpent = priorReads.filter(r => r.call_sid).length;
    if (!CFG.force && callsSpent >= CFG.maxCallsWindow) {
      summary('🧯 SKIPPED — call budget spent: ' + callsSpent + '/' + CFG.maxCallsWindow + ' paid calls this window already. No dial. (Raise MAX_CALLS_PER_WINDOW to change.)');
      return;
    }
    const fromLog = corroborateFromLog(priorReads, CFG.minConf);
    if (!CFG.force && fromLog) {
      const tr = buildPatchFromLogRow(fromLog.row);
      if (tr && tr.patch) {
        const ex = WIRE[tr.postKey];
        const human = !!(ex && ex.patch && ex.by && ex.by !== CFG.botId);
        const dupe = !!(ex && ex.patch && ((tr.patch.end && ex.patch.end === tr.patch.end) || (tr.patch.start && ex.patch.start === tr.patch.start && !tr.patch.end)));
        if (!human && !dupe) {
          if (tr.patch.end) { const pe = endOf(WIRE[prevKeyOf(tr.postKey)]); if (pe) { tr.patch.start = nextCard(pe); tr.patch.act = letterDist(tr.patch.start, tr.patch.end); } }
          const row = { k: tr.postKey, patch: tr.patch, by: CFG.botId, by_handle: CFG.botHandle,
            yes: 2, no: 0, confirmers: 0, chal: null, chal_by: null, chal_handle: null, chal_yes: 0, chal_no: 0,
            status: 'live', heist_from: null, heist_handle: null };
          if (CFG.dryRun) { summary('DRY RUN — would post FROM THE LOG (no call): ' + tr.postKey + ' ' + JSON.stringify(tr.patch)); return; }
          await sbUpsert('board_wire', row, 'k');
          await sbInsert('hall_line_log', { k: fromLog.row.k, card: fromLog.card, conf: fromLog.conf,
            heard: 'corroborated from ' + fromLog.n + ' earlier reads this window', transcript: '', call_sid: null, posted: true,
            extras: { kind: 'corroborated', about: (fromLog.row.extras && fromLog.row.extras.about) || fromLog.row.k, posted_to: tr.postKey } });
          summary('⚓ POSTED FROM THE LOG — ' + fromLog.n + ' earlier reads this window agree on ' + fromLog.card +
            ' (conf ' + fromLog.conf.toFixed(2) + '); wrote ' + tr.postKey + ' ' + JSON.stringify(tr.patch) + ' with ZERO new calls.');
          return;
        }
      }
    }
  }
  /* get a transcript: flag > audio file > live call — and if a LIVE call hears
     nothing usable, wait and CALL AGAIN (#jul23: the recording is sometimes
     late, mid-cycle, or briefly silent; one dead call must not kill the run). */
  const keywords = CFG.keywords.length ? CFG.keywords
    : (t.slot === 'AM' ? ['day', 'morning', 'casual', 'casuals', 'unidentified']
                       : ['night', 'evening', 'casual', 'casuals', 'unidentified']);
  if (liveMode) {
    for (const k of ['twilioSid', 'twilioToken', 'twilioFrom', 'dispatchNum', 'openaiKey'])
      if (!CFG[k]) { console.error('missing config: ' + k); process.exit(1); }
  }
  const attempts = liveMode ? CFG.retryCalls : 1;
  let res = null, transcript = '', callSid = null;
  for (let a = 1; a <= attempts; a++) {
    let tx = '', sid = null;
    if (CFG.transcript) tx = CFG.transcript;
    else if (CFG.audioFile) tx = await transcribe(fs.readFileSync(CFG.audioFile), prevEnd);
    else {
      const rec = await recordHotline();
      sid = rec.callSid;
      tx = await transcribe(rec.buf, prevEnd);
    }
    log('transcript' + (attempts > 1 ? ' (call ' + a + '/' + attempts + ')' : '') + ':', JSON.stringify((tx || '').slice(0, 400)));
    const r = parseLeftOff(tx || '', { keywords });
    /* #jul30 — FALLBACK READER: some hall phrasings ("You reached the casual for
       Sunday… We left off the letter Y, Y like in yellow, 4905") kept landing as
       card:null. When the main parser finds nothing, take one plain-regex pass
       over the raw text before giving up — it can only add, never degrade. */
    if (!r.card) { try {
      const fb = fallbackLeftOff(tx || '');
      if (fb) { r.card = fb.card; r.conf = Math.max(r.conf || 0, fb.conf);
                r.mode = r.mode || fb.mode; r.heard = r.heard || fb.heard;
                if (!r.all || !r.all.length) r.all = [{ card: fb.card, conf: fb.conf }];
                log('fallback reader:', fb.card, '· mode', fb.mode, '· conf', fb.conf); }
    } catch (e) {} }
    if (!res || r.conf > res.conf || (r.card && !res.card)) { res = r; transcript = tx || ''; callSid = sid || callSid; }
    if (r.card) break;
    if (a < attempts) {
      log((tx && tx.trim() ? 'no card in that recording' : 'EMPTY recording') + ' — waiting 75s, then calling again.');
      await sleep(75000);
    }
  }
  /* what did it tell us, and which board is it about? */
  const ft = parseForecastTarget(transcript);
  let mode = res.mode;
  if (!mode && res.card && ft && ft.slot) mode = 'start';   // forecast phrasing ("…for Thursday night…") = a start callout
  const aboutKey = resolveAboutKey(ft, t, mode);
  log('parsed:', res.card, '· mode', mode || '?', '· about', aboutKey, '· confidence', res.conf.toFixed(2), '· heard:', JSON.stringify(res.heard));
  if (res.all.length > 1) log('other candidates:', res.all.slice(1).map(c => c.card + '@' + c.conf.toFixed(2)).join(' '));
  /* translate to a record entry. A start callout ("the night board starts on
     B4704") means the board BEFORE it ENDED one card earlier (the chain rule
     the app itself runs on: day ends W4912 → night opens W4913). */
  let postKey, patch = null;
  if (mode === 'start' && res.card) {
    const endCard = prevCardId(res.card);
    if (endCard) { postKey = prevKeyOf(aboutKey); patch = { end: endCard }; }
    else         { postKey = aboutKey;            patch = { start: res.card }; }
  } else {
    postKey = t.key;
    if (res.card) patch = { end: res.card };
  }
  /* sanity vs the chain — softened so a true read is not strangled (#jul23) */
  let conf = res.conf;
  const priorEnd = postKey ? endOf(WIRE[prevKeyOf(postKey)]) : null;
  if (patch && patch.end && priorEnd) {
    const d = letterDist(priorEnd, patch.end);
    if (d <= 16) conf = Math.min(0.98, conf + 0.05);
    else if (d > 20) conf -= 0.15;                    // moving backwards / wrapping hard — suspicious, not fatal
    log('sanity: prior end ' + priorEnd + ' -> ' + patch.end + ' is ' + d + ' letters forward');
  }
  /* #aug13(cost) — CROSS-RUN CORROBORATION: an earlier sweep this window that heard
     the SAME card is a second, independent recording agreeing. That's worth real
     confidence — and it's what stops a "readable but always just under threshold"
     day from burning a call on every sweep to reach the same stuck answer. */
  if (res.card && priorReads.some(r => r && r.card === res.card)) {
    conf = Math.min(0.98, conf + 0.12);
    log('corroborated: an earlier read this window also heard ' + res.card + ' — confidence now ' + conf.toFixed(2));
  }
  /* ── the recording's COUNTS (E/N/D) — backup ears only. The PDF is the record:
     compare and log MATCH/MISMATCH, never write over sheet data. ── */
  const counts = parseCounts(transcript);
  const specials = parseSpecial(transcript);
  const checks = [];
  if (counts.length) {
    let pdfRows = {};
    try {
      const keys = [...new Set(counts.map(c => countTargetKey(c.kind)).filter(Boolean))];
      if (keys.length && CFG.sbUrl && CFG.sbKey) {
        const rows = await sbSelect('dispatch_boards', 'key=in.(' + keys.map(k => '%22' + k + '%22').join(',') + ')&select=key,data');
        rows.forEach(r => { pdfRows[r.key] = r.data; });
      }
    } catch (e) { log('warn: could not read dispatch_boards for count check:', e.message); }
    counts.forEach(c => {
      const key = countTargetKey(c.kind);
      const pdf = key && pdfRows[key] ? pdfTotals(pdfRows[key]) : null;
      const pdfN = pdf ? (c.kind === 'early' ? pdf.early : pdf.final) : null;
      const verdict = pdfN == null ? 'no_pdf_yet' : (pdfN === c.n ? 'MATCH' : 'MISMATCH');
      checks.push({ kind: c.kind, heard_n: c.n, key, pdf_n: pdfN, verdict });
      log('count check:', c.kind, c.n, key ? '(' + key + ')' : '',
          pdfN == null ? '· PDF not in yet — phone count logged as backup'
                       : '· PDF says ' + pdfN + ' — ' + verdict + (verdict === 'MISMATCH' ? ' ⚠ (the paper wins)' : ''));
    });
  }
  specials.forEach(s => log('⚑ SPECIAL (' + s.tag + '): "' + s.snippet + '"'));
  /* never talk over a human — check the row we would actually write */
  const existing = postKey ? WIRE[postKey] : null;
  const humanOwns = !!(existing && existing.patch && existing.by && existing.by !== CFG.botId);
  const posting = !!(patch && conf >= CFG.minConf && !humanOwns);
  /* audit trail — every run, posted or not. k = the board the info is ABOUT. */
  if (CFG.sbUrl && CFG.sbKey && !CFG.dryRun) {
    const baseRow = {
      k: aboutKey || t.key, card: res.card, conf: Math.round(conf * 100) / 100,
      heard: res.heard, transcript: transcript.slice(0, 4000),
      call_sid: callSid, posted: posting
    };
    const extras = { kind: mode || 'unknown', about: aboutKey, posted_to: posting ? postKey : null };
    if (mode === 'start' && res.card) extras.announced_start = res.card;
    if (counts.length) extras.counts = counts;
    if (specials.length) extras.specials = specials;
    if (checks.length) extras.checks = checks;
    const wrote = await sbInsert('hall_line_log', Object.assign({ extras }, baseRow));
    if (!wrote) await sbInsert('hall_line_log', baseRow);   // older table without the extras column
  }
  if (humanOwns) {
    summary('🛑 STOOD DOWN after reading — a hand already logged ' + postKey + ' (' + (existing.by_handle || existing.by) + '). Logged for the audit only.');
    return;
  }
  if (!posting) {
    summary(res.card ? '📉 LOGGED ONLY — ' + res.card + ' at conf ' + conf.toFixed(2) + ' is below MIN_CONF ' + CFG.minConf + '. A later sweep that hears the same card will corroborate and post without guessing looser.'
                     : '🔇 LOGGED ONLY — no card heard in this recording.');
    return;
  }
  const dupe = existing && existing.patch &&
    ((patch.end && existing.patch.end === patch.end) || (patch.start && existing.patch.start === patch.start && !patch.end));
  if (dupe) {
    summary('✓ NOTHING NEW — ' + postKey + ' already carries ' + JSON.stringify(existing.patch) + '.');
    return;
  }
  /* the bot's post: exactly the row a member's log produces (status live, fact
     on arrival). Start/act ride along when the prior board is on the wire;
     otherwise the app fills them from its own chain (#206). */
  if (patch.end && priorEnd) {
    patch.start = nextCard(priorEnd);
    patch.act = letterDist(patch.start, patch.end);
  }
  const row = {
    k: postKey, patch,
    by: CFG.botId, by_handle: CFG.botHandle,
    yes: 2, no: 0, confirmers: 0,
    chal: null, chal_by: null, chal_handle: null, chal_yes: 0, chal_no: 0,
    status: 'live', heist_from: null, heist_handle: null
  };
  if (CFG.dryRun) { summary('DRY RUN — would upsert board_wire: ' + JSON.stringify(row)); return; }
  if (!CFG.sbUrl || !CFG.sbKey) { console.error('missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
  await sbUpsert('board_wire', row, 'k');
  summary('⚓ POSTED to the wire: ' + postKey + ' ' + JSON.stringify(patch) +
      (mode === 'start' ? '  (the hall said ' + aboutKey + ' starts on ' + res.card + ')' : ''));
} finally { summary(costLine()); } }
/* ---------- #aug13(cost) — helpers for the log-corroboration path ---------- */
/* translate one hall_line_log row back into the record entry it supports */
function buildPatchFromLogRow(row) {
  if (!row || !row.card) return null;
  const kind = row.extras && row.extras.kind, about = (row.extras && row.extras.about) || row.k;
  if (kind === 'start') {
    const end = prevCardId(row.card);
    if (end) return { postKey: prevKeyOf(about), patch: { end } };
    return { postKey: about, patch: { start: row.card } };
  }
  return { postKey: row.k, patch: { end: row.card } };
}
/* two or more independent reads this window agreeing on one card, close enough to
   the post threshold that agreement carries it over → post with zero new calls */
function corroborateFromLog(rows, minConf) {
  const byCard = {};
  (rows || []).forEach(r => { if (r && r.card) (byCard[r.card] = byCard[r.card] || []).push(r); });
  let best = null;
  Object.keys(byCard).forEach(card => {
    const g = byCard[card];
    if (g.length < 2) return;
    const max = Math.max.apply(null, g.map(r => +r.conf || 0));
    if (max < minConf - 0.05) return;
    const conf = Math.min(0.98, max + 0.08 * (g.length - 1));
    if (conf < minConf) return;
    if (!best || conf > best.conf) best = { card, conf: Math.round(conf * 100) / 100, n: g.length, row: g[0] };
  });
  return best;
}
if (require.main === module) {
  main().catch(e => { console.error('[leftoff] FAILED:', e.message); summary('❌ FAILED: ' + e.message); summary(costLine()); process.exit(1); });
}
module.exports = { _internals: {
  windowAgeMins, targetBoard, insideRunWindow, buildPatchFromLogRow, corroborateFromLog,
  prevKeyOf, nextKeyOf, keyFor, isoShift, prevCardId, nextCard, letterDist, endOf, resolveAboutKey
} };

/* #jul30 — plain-regex fallback for hall phrasings the main parser misses.
   Only called when parseLeftOff found no card at all. High confidence (0.85)
   only when the recording spells the letter AND confirms it with a phonetic
   word that starts with that letter ("Y like in yellow… 4905"). */
function fallbackLeftOff(text) {
  const tx = String(text || '').toLowerCase().replace(/[\u2019']/g, '');
  if (!tx.trim()) return null;
  const isEnd   = /\bleft\s*off\b|\bleaving\s*off\b|\bstopp?ed\s+(?:at|on)\b|\bended\s+(?:at|on)\b|\bcut\s*off\b|\blast\s+(?:card|number|call)\b/.test(tx);
  const isStart = /\b(?:start|starting|starts|begin|beginning|open|opening)\b[^.]{0,20}\b(?:with|for|at|on|the)\b/.test(tx);
  let mode = isEnd ? 'end' : (isStart ? 'start' : null);
  if (!mode && /\bforecast\b/.test(tx)) mode = 'start';   // the early-forecast message has no start verb
  if (!mode) return null;
  let m = tx.match(/\b([a-z])\b[\s,]*(?:(?:is|as|like)\s+(?:in\s+)?)([a-z]{3,12})[^0-9]{0,20}?(\d{3,5})\b/);
  if (m && m[2][0] === m[1]) {
    return { card: (m[1] + m[3]).toUpperCase(), conf: 0.85, mode: mode, heard: m[0].slice(0, 60) };
  }
  m = tx.match(/\bletter\s+([a-z])\b[^0-9]{0,40}?(\d{3,5})\b/);
  if (m) {
    return { card: (m[1] + m[2]).toUpperCase(), conf: 0.7, mode: mode, heard: m[0].slice(0, 60) };
  }
  return null;
}
