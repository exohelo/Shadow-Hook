'use strict';
/* ============================================================================
   parse.js — turn a Whisper transcript of the hall's recorded dispatch line
   into the card the board left off on (e.g. "W4912").

   Built defensively, because speech-to-text mangles letter+number callouts:
     letters arrive as bare letters ("W"), NATO words ("whiskey"), spelled
     names ("double u", "kay"), "W as in William", or homophones ("are, "why");
     numbers arrive as digits ("4912"), split digits ("49 12", "4 9 1 2"),
     or words ("forty-nine twelve", "four thousand nine hundred twelve").

   parseLeftOff(transcript, opts) -> {
     card:  "W4912" | null      best candidate (letter + 3-5 digits)
     conf:  0..1                confidence in that candidate
     heard: "...context..."     the words around the match, for the log
     all:   [{card,conf,heard}] every candidate found, best first
   }
   opts.keywords: array of words ("day", "casual", ...) that mark the board
   we care about when the recording lists several boards.
   ========================================================================== */

const NATO = {
  alfa:'A', alpha:'A', bravo:'B', charlie:'C', delta:'D', echo:'E', foxtrot:'F',
  golf:'G', hotel:'H', india:'I', juliet:'J', juliett:'J', kilo:'K', lima:'L',
  mike:'M', november:'N', oscar:'O', papa:'P', quebec:'Q', romeo:'R', sierra:'S',
  tango:'T', uniform:'U', victor:'V', whiskey:'W', whisky:'W', xray:'X',
  yankee:'Y', zulu:'Z'
};
/* spoken letter names that are rarely anything else */
const SAFE_NAMES = {
  bee:'B', cee:'C', dee:'D', eff:'F', gee:'G', aitch:'H', haitch:'H', jay:'J',
  kay:'K', el:'L', ell:'L', em:'M', en:'N', pea:'P', pee:'P', cue:'Q', queue:'Q',
  ess:'S', tee:'T', vee:'V', ex:'X', zee:'Z', zed:'Z'
};
/* homophones of letters that are also everyday words — only trusted when they
   sit right against a number (and they still cost confidence) */
const RISKY = {
  a:'A', be:'B', sea:'C', see:'C', e:'E', i:'I', eye:'I', o:'O', oh:'O',
  are:'R', arr:'R', tea:'T', u:'U', you:'U', why:'Y'
};

const ONES  = {zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9};
const TEENS = {ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15,
               sixteen:16, seventeen:17, eighteen:18, nineteen:19};
const TENS  = {twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90};

/* phrases that anchor "this is where the board stopped" */
const ANCHORS = [
  ['left','off'], ['leaving','off'], ['leftoff'], ['stopped','at'], ['stopped','on'],
  ['ended','at'], ['ended','on'], ['ending','at'], ['ending','on'],
  ['last','card'], ['last','number'], ['last','call'], ['cut','off'], ['down','to']
];

function tokenize(text){
  const t = String(text||'')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1$2')         // 1,240 -> 1240 (before commas become spaces)
    .replace(/[.,;:!?()"']/g, ' ')
    .replace(/(\d)\s*-\s*(\d)/g, '$1$2')   // 49-12 -> 4912
    .replace(/-/g, ' ')                    // forty-nine -> forty nine
    .split(/\s+/).filter(Boolean);
  // join "double u" / "double you" into a W
  const out = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === 'double' && (t[i+1] === 'u' || t[i+1] === 'you' || t[i+1] === 'yu')) { out.push('w'); i++; continue; }
    out.push(t[i]);
  }
  return out;
}

/* read a number starting at tokens[i]; returns {num:"4912", next:j} or null.
   Handles digit chunks, word forms, and "oh" as zero inside a number. */
function readNumber(tokens, i){
  let j = i;
  const groups = [];             // each group -> string of digits it contributes
  let usedScale = false;         // saw hundred/thousand -> arithmetic mode
  let value = 0, current = 0, any = false;

  while (j < tokens.length) {
    const w = tokens[j];
    if (/^\d+$/.test(w)) { groups.push(w); current = current * Math.pow(10, w.length) + parseInt(w,10); any = true; j++; continue; }
    if (w in ONES)  { groups.push(String(ONES[w]));  current += ONES[w];  any = true; j++; continue; }
    if (w in TEENS) { groups.push(String(TEENS[w])); current += TEENS[w]; any = true; j++; continue; }
    if (w in TENS)  {
      let g = TENS[w], adv = 1;
      if (j+1 < tokens.length && tokens[j+1] in ONES && ONES[tokens[j+1]] > 0) { g += ONES[tokens[j+1]]; adv = 2; }
      groups.push(String(g)); current += g; any = true; j += adv; continue;
    }
    if ((w === 'oh' || w === 'o') && any) { groups.push('0'); current = current * 10; j++; continue; }
    if (w === 'hundred'  && any) { usedScale = true; current *= 100;  groups.length = 0; j++; continue; }
    if (w === 'thousand' && any) { usedScale = true; value += current * 1000; current = 0; groups.length = 0; j++; continue; }
    if (w === 'and' && usedScale) { j++; continue; }
    break;
  }
  if (!any) return null;
  let num;
  if (usedScale) num = String(value + current);
  else num = groups.join('');
  if (!/^\d{3,5}$/.test(num)) return null;
  return { num, next: j };
}

/* resolve tokens[i] as a letter; returns {L, risky, next} or null.
   Understands "w", "whiskey", "kay", "w as in william", risky homophones. */
function readLetter(tokens, i){
  const w = tokens[i];
  let L = null, risky = false;
  if (/^[a-z]$/.test(w)) L = w.toUpperCase();
  else if (w in NATO) L = NATO[w];
  else if (w in SAFE_NAMES) L = SAFE_NAMES[w];
  else if (w in RISKY) { L = RISKY[w]; risky = true; }
  if (!L) return null;
  let next = i + 1;
  // "... W as in William 4912" — skip the exemplar
  if (tokens[next] === 'as' && tokens[next+1] === 'in' && tokens[next+2]) next += 3;
  return { L, risky, next };
}

function hasAnchorBefore(tokens, i, span){
  const from = Math.max(0, i - span);
  for (let j = from; j < i; j++) {
    for (const a of ANCHORS) {
      if (a.length === 1 && tokens[j] === a[0]) return true;
      if (a.length === 2 && tokens[j] === a[0] && tokens[j+1] === a[1] && j+1 < i + 2) return true;
    }
  }
  return false;
}

function hasKeywordBefore(tokens, i, span, keywords){
  if (!keywords || !keywords.length) return false;
  const from = Math.max(0, i - span);
  for (let j = from; j < i; j++) if (keywords.includes(tokens[j])) return true;
  return false;
}

function contextAround(tokens, i, j){
  return tokens.slice(Math.max(0, i - 8), Math.min(tokens.length, j + 4)).join(' ');
}

function parseLeftOff(transcript, opts){
  const keywords = ((opts && opts.keywords) || []).map(k => String(k).toLowerCase());
  const tokens = tokenize(transcript);
  const cands = [];

  for (let i = 0; i < tokens.length; i++) {
    // fast path: an embedded card like "w4912" (Whisper often writes it this way)
    const m = /^([a-z])(\d{3,5})$/.exec(tokens[i]);
    if (m) {
      cands.push(score(tokens, i, i + 1, m[1].toUpperCase() + m[2], false, keywords, true));
      continue;
    }
    const lt = readLetter(tokens, i);
    if (!lt) continue;
    const nm = readNumber(tokens, lt.next);
    if (!nm) continue;
    cands.push(score(tokens, i, nm.next, lt.L + nm.num, lt.risky, keywords, nm.num.length === 4));
  }

  // a risky homophone with no anchor near it is almost certainly a plain word — drop it
  const kept = cands.filter(c => !(c.risky && !c.anchored));
  kept.sort((a, b) => b.conf - a.conf || a.pos - b.pos);
  const best = kept[0] || null;
  return {
    card:  best ? best.card : null,
    conf:  best ? best.conf : 0,
    heard: best ? best.heard : '',
    all:   kept.map(c => ({ card: c.card, conf: c.conf, heard: c.heard }))
  };
}

function score(tokens, i, j, card, risky, keywords, fourDigit){
  const anchored = hasAnchorBefore(tokens, i, 9);
  const keyed    = hasKeywordBefore(tokens, i, 14, keywords);
  let conf = 0.5;
  if (anchored)  conf += 0.25;
  if (!risky)    conf += 0.10; else conf -= 0.20;
  if (fourDigit) conf += 0.05;
  if (keyed)     conf += 0.15;
  conf = Math.max(0, Math.min(0.98, conf));
  return { card, conf, pos: i, risky, anchored, keyed, heard: contextAround(tokens, i, j) };
}

/* ============================================================================
   parseCounts — the recording also announces JOB COUNTS on a schedule:
     Early (E)  after morning dispatch   → tonight's early look
     Night (N)  final after ~2:30 PM     → tonight's final
     Day (D)    final after night ends   → tomorrow morning's final
   These are BACKUP data only — the PDF sheet is the record. The worker logs
   them and cross-checks the PDF; it never writes them over sheet data.
   Counts arrive as digits from Whisper ("991", "1,240"). A number is only a
   count if count-context words sit near it, and never if it's a card's digits.
   ========================================================================== */
const NIGHT_WORDS = ['night', 'tonight', 'evening'];
const DAY_WORDS   = ['day', 'tomorrow', 'morning', 'tomorrows'];

function parseCounts(transcript){
  const tokens = tokenize(transcript);
  const found = [];
  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (!/^\d{2,4}$/.test(w)) continue;
    const n = parseInt(w, 10);
    if (n < 20 || n > 4000) continue;
    // a card's digits, not a count: the token before it reads as a letter
    const prev = tokens[i - 1];
    if (prev && (/^[a-z]$/.test(prev) || NATO[prev] || SAFE_NAMES[prev] || RISKY[prev])) continue;
    // a TIME, not a count: "after 230", "at 930", "230 pm"
    if (prev && ['after', 'at', 'until', 'till', 'by', 'around', 'before'].includes(prev)) continue;
    const nxt = tokens[i + 1];
    if (nxt && ['am', 'pm', 'oclock', 'a', 'p'].includes(nxt)) continue;
    const from = Math.max(0, i - 8), to = Math.min(tokens.length, i + 6);
    const win = tokens.slice(from, to);
    const hasJobs  = win.some(t => t === 'jobs' || t === 'job' || t === 'count' || t === 'orders');
    const hasFinal = win.some(t => t === 'final' || t === 'finals');
    const hasEarly = win.some(t => t === 'early');
    if (!(hasJobs || hasFinal || hasEarly)) continue;      // bare number, no count context
    let kind = 'count';
    if (hasEarly) kind = 'early';
    else if (hasFinal) {
      const night = win.some(t => NIGHT_WORDS.includes(t));
      const day   = win.some(t => DAY_WORDS.includes(t));
      kind = (night && !day) ? 'night_final' : (day && !night) ? 'day_final' : 'final';
    }
    found.push({ kind, n, heard: win.join(' ') });
  }
  return found;
}

/* parseSpecial — flag special announcements so a human reads them.
   Advisory only: flags ride the log; nothing is ever auto-acted on. */
const SPECIALS = [
  { tag: 'stop_work',    re: /(stop work(?! meeting)|work stoppage|no work (tonight|today|tomorrow)|no work\b)/ },
  { tag: 'closed',       re: /(hall (is |will be )?closed|closed (today|tomorrow|tonight)|no dispatch)/ },
  { tag: 'holiday',      re: /(holiday|thanksgiving|christmas|new year|fourth of july|july 4|bloody thursday|memorial day|labor day|harry bridges|juneteenth|veterans day)/ },
  { tag: 'weather',      re: /(heavy rain|rain delay|storm|wind advisory|excessive heat|air quality)/ },
  { tag: 'meeting',      re: /(stop work meeting|membership meeting|union meeting|arbitration|caucus)/ },
  { tag: 'announcement', re: /(special announcement|attention all|please be advised|reminder to all|effective immediately)/ }
];
function parseSpecial(transcript){
  const t = String(transcript || '').toLowerCase().replace(/\s+/g, ' ');
  const out = [];
  SPECIALS.forEach(s => {
    const m = s.re.exec(t);
    if (m) out.push({ tag: s.tag, snippet: t.slice(Math.max(0, m.index - 45), m.index + 90).trim() });
  });
  return out;
}

module.exports = { parseLeftOff, parseCounts, parseSpecial, _internals: { tokenize, readNumber, readLetter } };
