#!/usr/bin/env node
'use strict';
/* ============================================================================
   leftoff.js — call the hall's recorded dispatch line, transcribe it, parse
   "where the board left off", and post it to the Order's record.

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
     BOT_ID / BOT_HANDLE                     default hall-line-bot / ☎ Hall Line

   Flags (local testing):
     --transcript "..."   skip Twilio+Whisper, parse this text
     --audio file.mp3     skip Twilio, transcribe this file
     --force              ignore the time-of-day gate
     --dry-run            do everything except write to Supabase
   ========================================================================== */

const fs = require('fs');
const { parseLeftOff } = require('./parse.js');

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
    'It announces where casual boards left off, as a letter and card number like W4912 or C4100.' +
    (prevEnd ? ' The previous board ended at ' + prevEnd + '.' : ''));
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + CFG.openaiKey },
    body: fd
  });
  if (!r.ok) throw new Error('whisper: ' + r.status + ' ' + (await r.text()).slice(0, 300));
  return (await r.json()).text || '';
}

/* ---------- main ---------- */
(async () => {
  const t = targetBoard();
  log('target board:', t.key, '· LA time gate', insideRunWindow() ? 'OPEN' : 'closed');
  if (!insideRunWindow() && !CFG.force && !CFG.transcript && !CFG.audioFile) {
    log('outside the fresh-recording window — nothing to do (use --force to override).');
    return;
  }

  /* who owns this key already? never talk over a human. */
  let existing = null, prevEnd = null;
  if (CFG.sbUrl && CFG.sbKey) {
    try {
      const rows = await sbSelect('board_wire', 'k=in.(%22' + t.key + '%22,%22' + prevBoardKey(t) + '%22)&select=*');
      existing = rows.find(r => r.k === t.key) || null;
      const prev = rows.find(r => r.k === prevBoardKey(t)) || null;
      prevEnd = prev && prev.patch && prev.patch.end ? String(prev.patch.end).toUpperCase() : null;
    } catch (e) { log('warn: could not read board_wire:', e.message); }
  }
  if (existing && existing.patch && existing.by && existing.by !== CFG.botId) {
    log('a hand already logged ' + t.key + ' (' + (existing.by_handle || existing.by) + ') — standing down.');
    return;
  }

  /* get a transcript: flag > audio file > live call */
  let transcript = CFG.transcript, callSid = null;
  if (!transcript && CFG.audioFile) {
    transcript = await transcribe(fs.readFileSync(CFG.audioFile), prevEnd);
  }
  if (!transcript) {
    for (const k of ['twilioSid', 'twilioToken', 'twilioFrom', 'dispatchNum', 'openaiKey'])
      if (!CFG[k]) { console.error('missing config: ' + k); process.exit(1); }
    const rec = await recordHotline();
    callSid = rec.callSid;
    transcript = await transcribe(rec.buf, prevEnd);
  }
  log('transcript:', JSON.stringify(transcript.slice(0, 400)));

  /* parse + sanity */
  const keywords = CFG.keywords.length ? CFG.keywords
    : (t.slot === 'AM' ? ['day', 'morning', 'casual', 'casuals', 'unidentified']
                       : ['night', 'evening', 'casual', 'casuals', 'unidentified']);
  const res = parseLeftOff(transcript, { keywords });
  let conf = res.conf;
  if (res.card && prevEnd) {
    const d = letterDist(prevEnd, res.card);
    if (d <= 16) conf = Math.min(0.98, conf + 0.05);
    else if (d > 20) conf -= 0.25;                    // moving backwards / wrapping hard — suspicious
    log('sanity: previous end ' + prevEnd + ' -> ' + res.card + ' is ' + d + ' letters forward');
  }
  log('parsed:', res.card, '· confidence', conf.toFixed(2), '· heard:', JSON.stringify(res.heard));
  if (res.all.length > 1) log('other candidates:', res.all.slice(1).map(c => c.card + '@' + c.conf.toFixed(2)).join(' '));

  const posting = !!(res.card && conf >= CFG.minConf);

  /* audit trail — every run, posted or not */
  if (CFG.sbUrl && CFG.sbKey && !CFG.dryRun) {
    await sbInsert('hall_line_log', {
      k: t.key, card: res.card, conf: Math.round(conf * 100) / 100,
      heard: res.heard, transcript: transcript.slice(0, 4000),
      call_sid: callSid, posted: posting
    });
  }

  if (!posting) {
    log(res.card ? 'below MIN_CONF (' + CFG.minConf + ') — logged only, not posted.' : 'no card found — logged only.');
    return;
  }
  if (existing && existing.patch && existing.patch.end === res.card) {
    log('already on the record as ' + res.card + ' — nothing new.');
    return;
  }

  /* the bot's post: exactly the row a member's log produces (status live, fact
     on arrival). Patch carries ONLY what the hall line actually said — the end.
     Start/act ride along when the previous board is on the wire; otherwise the
     app fills them from its own chain (#206). */
  const patch = { end: res.card };
  if (prevEnd) {
    patch.start = nextCard(prevEnd);
    patch.act = letterDist(patch.start, res.card);
  }
  const row = {
    k: t.key, patch,
    by: CFG.botId, by_handle: CFG.botHandle,
    yes: 2, no: 0, confirmers: 0,
    chal: null, chal_by: null, chal_handle: null, chal_yes: 0, chal_no: 0,
    status: 'live', heist_from: null, heist_handle: null
  };
  if (CFG.dryRun) { log('DRY RUN — would upsert board_wire:', JSON.stringify(row)); return; }
  if (!CFG.sbUrl || !CFG.sbKey) { console.error('missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
  await sbUpsert('board_wire', row, 'k');
  log('⚓ posted to the wire: ' + t.key + ' left off on ' + res.card +
      (patch.start ? ' (start ' + patch.start + ', ' + patch.act + ' letters)' : ''));
})().catch(e => { console.error('[leftoff] FAILED:', e.message); process.exit(1); });
