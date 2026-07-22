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

module.exports = { parseLeftOff, _internals: { tokenize, readNumber, readLetter } };
