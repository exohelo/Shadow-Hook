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
     --force              ignore the time-of-day gate
     --dry-run            do everything except write to Supabase
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
  botId:       env('BOT_ID') || 'hall-line-bot',
  botHandle:   env('BOT_HANDLE') || '☎ Hall Line',
  keywords:    (env('SLOT_KEYWORDS') || '').split(',').map(s => s.trim()).filter(Boolean),
  force:       flag('--force'),
  dryRun:      flag('--dry-run'),
  transcript:  argAfter('--transcript'),
  audioFile:   argAfter('--audio'),
};

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const log = (...a) => console.log('[leftoff]', ...a);

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
   Day board ends 9:30, night board 19:30 (hall timeline the app runs on). */
function targetBoard() {
  const now = laParts();
  if (now.mins >= 19 * 60 + 30) return { key: now.iso + '_' + now.dow + '_PM', slot: 'PM', iso: now.iso, dow: now.dow };
  if (now.mins >= 9 * 60 + 30)  return { key: now.iso + '_' + now.dow + '_AM', slot: 'AM', iso: now.iso, dow: now.dow };
  const y = laParts(Date.now() - 86400000);
  return { key: y.iso + '_' + y.dow + '_PM', slot: 'PM', iso: y.iso, dow: y.dow };
}

/* fresh-recording windows: shortly after each board ends */
function insideRunWindow() {
  const m = laParts().mins;
  return (m >= 9 * 60 + 35 && m <= 13 * 60) || (m >= 19 * 60 + 35 && m <= 23 * 60 + 30);
}

/* the board directly before: AM -> previous-day PM, PM -> same-day AM */
function prevBoardKey(t) {
  if (t.slot === 'PM') return t.iso + '_' + t.dow + '_AM';
  const d = new Date(t.iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  return iso + '_' + DOW[d.getDay()] + '_PM';
}

function nextCard(id) { const m = /^([A-Z])(\d+)$/.exec(id || ''); return m ? m[1] + (parseInt(m[2], 10) + 1) : id; }
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
  if (kind === 'day_final') return boardKeyFor(m >= 19 * 60 + 30 ? 1 : 0, 'AM');
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
(async () => {
  const t = targetBoard();
  log('target board:', t.key, '· LA time gate', insideRunWindow() ? 'OPEN' : 'closed');
  if (!insideRunWindow() && !CFG.force && !CFG.transcript && !CFG.audioFile) {
    log('outside the fresh-recording window — nothing to do (use --force to override).');
    return;
  }

  /* one read of the wire around the target: two boards back through two ahead —
     enough to chain starts, sanity-check ends, and honor human ownership. */
  const NEAR = [prevKeyOf(prevKeyOf(t.key)), prevKeyOf(t.key), t.key, nextKeyOf(t.key), nextKeyOf(nextKeyOf(t.key))].filter(Boolean);
  const WIRE = {};
  if (CFG.sbUrl && CFG.sbKey) {
    try {
      const rows = await sbSelect('board_wire', 'k=in.(' + NEAR.map(k => '%22' + k + '%22').join(',') + ')&select=*');
      rows.forEach(r => { WIRE[r.k] = r; });
    } catch (e) { log('warn: could not read board_wire:', e.message); }
  }
  const prevEnd = endOf(WIRE[prevKeyOf(t.key)]);

  /* get a transcript: flag > audio file > live call — and if a LIVE call hears
     nothing usable, wait and CALL AGAIN (#jul23: the recording is sometimes
     late, mid-cycle, or briefly silent; one dead call must not kill the run). */
  const keywords = CFG.keywords.length ? CFG.keywords
    : (t.slot === 'AM' ? ['day', 'morning', 'casual', 'casuals', 'unidentified']
                       : ['night', 'evening', 'casual', 'casuals', 'unidentified']);
  const liveMode = !CFG.transcript && !CFG.audioFile;
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
    log('a hand already logged ' + postKey + ' (' + (existing.by_handle || existing.by) + ') — standing down.');
    return;
  }
  if (!posting) {
    log(res.card ? 'below MIN_CONF (' + CFG.minConf + ') — logged only, not posted.' : 'no card found — logged only.');
    return;
  }
  const dupe = existing && existing.patch &&
    ((patch.end && existing.patch.end === patch.end) || (patch.start && existing.patch.start === patch.start && !patch.end));
  if (dupe) {
    log('already on the record (' + postKey + ' ' + JSON.stringify(existing.patch) + ') — nothing new.');
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
  if (CFG.dryRun) { log('DRY RUN — would upsert board_wire:', JSON.stringify(row)); return; }
  if (!CFG.sbUrl || !CFG.sbKey) { console.error('missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
  await sbUpsert('board_wire', row, 'k');
  log('⚓ posted to the wire: ' + postKey + ' ' + JSON.stringify(patch) +
      (mode === 'start' ? '  (the hall said ' + aboutKey + ' starts on ' + res.card + ')' : ''));
})().catch(e => { console.error('[leftoff] FAILED:', e.message); process.exit(1); });
