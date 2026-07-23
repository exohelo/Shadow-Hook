'use strict';
/* node --test parse.test.js */
const { test } = require('node:test');
const assert = require('node:assert');
const { parseLeftOff, parseCounts, parseSpecial, parseForecastTarget } = require('./parse.js');

const HIGH = 0.7;   // what the worker treats as postable by default (MIN_CONF=0.75 needs anchor too)

function best(t, opts) { return parseLeftOff(t, opts); }

test('plain digits after bare letter', () => {
  const r = best('The day board left off on W 4912. Thank you for calling.');
  assert.equal(r.card, 'W4912');
  assert.ok(r.conf >= HIGH, 'conf ' + r.conf);
});

test('embedded card token (Whisper often writes W4912)', () => {
  const r = best('the casual board left off at W4912');
  assert.equal(r.card, 'W4912');
  assert.ok(r.conf >= HIGH);
});

test('NATO letter + hyphenated spoken pair', () => {
  const r = best('the board left off on whiskey forty-nine twelve');
  assert.equal(r.card, 'W4912');
  assert.ok(r.conf >= HIGH);
});

test('spoken pair without hyphen', () => {
  const r = best('left off at charlie forty one hundred');   // "forty one hundred" = 4100
  assert.equal(r.card, 'C4100');
});

test('full thousands arithmetic', () => {
  const r = best('we left off on delta four thousand nine hundred and twelve tonight');
  assert.equal(r.card, 'D4912');
});

test('single digits called out one by one', () => {
  const r = best('board left off tango 4 9 1 2 have a good night');
  assert.equal(r.card, 'T4912');
});

test('oh as zero inside the number', () => {
  const r = best('left off on kilo four oh one two');
  assert.equal(r.card, 'K4012');
});

test('split digit chunks', () => {
  const r = best('night board left off at yankee 49 12');
  assert.equal(r.card, 'Y4912');
});

test('W as in William', () => {
  const r = best('the board left off on W as in William 4958');
  assert.equal(r.card, 'W4958');
});

test('double u spelled out', () => {
  const r = best('board left off at double u four nine five eight');
  assert.equal(r.card, 'W4958');
});

test('safe letter name (kay)', () => {
  const r = best('we ended on kay 4871 for the day board');
  assert.equal(r.card, 'K4871');
});

test('risky homophone WITH anchor is accepted but costs confidence', () => {
  const r = best('the board left off on are 4912');
  assert.equal(r.card, 'R4912');
  const plain = best('the board left off on romeo 4912');
  assert.ok(plain.conf > r.conf, 'risky should score below NATO');
});

test('risky homophone WITHOUT anchor is dropped', () => {
  const r = best('thank you are 4912 is not a card in this sentence structure');
  assert.notEqual(r.card, 'R4912');
});

test('multiple boards: keywords pick the right one (day)', () => {
  const t = 'the flex board left off on charlie 4100 the day board left off on whiskey 4912 the night board left off on bravo 4433';
  const r = best(t, { keywords: ['day'] });
  assert.equal(r.card, 'W4912');
});

test('multiple boards: keywords pick the right one (night)', () => {
  const t = 'the flex board left off on charlie 4100 the day board left off on whiskey 4912 the night board left off on bravo 4433';
  const r = best(t, { keywords: ['night'] });
  assert.equal(r.card, 'B4433');
});

test('multiple boards: casual keyword', () => {
  const t = 'class b left off on golf 2210 the unidentified casual board left off on sierra 4501';
  const r = best(t, { keywords: ['casual', 'casuals', 'unidentified'] });
  assert.equal(r.card, 'S4501');
});

test('all candidates are reported, best first', () => {
  const t = 'the day board left off on whiskey 4912 the night board left off on bravo 4433';
  const r = best(t, { keywords: ['night'] });
  assert.equal(r.all.length, 2);
  assert.equal(r.all[0].card, 'B4433');
});

test('3-digit and 5-digit cards accepted', () => {
  assert.equal(best('left off on mike 412').card, 'M412');
  assert.equal(best('left off on mike 41266').card, 'M41266');
});

test('too-short or too-long numbers rejected', () => {
  assert.equal(best('left off on mike 41').card, null);
  assert.equal(best('left off on mike 412667').card, null);
});

test('no card at all', () => {
  const r = best('all boards are current there is no work tonight thank you');
  assert.equal(r.card, null);
  assert.equal(r.conf, 0);
});

test('anchor phrase variants', () => {
  assert.equal(best('dispatch stopped at hotel 4300').card, 'H4300');
  assert.equal(best('the last card called was papa 4600').card, 'P4600');
  assert.equal(best('boards ending on victor 4750').card, 'V4750');
});

test('unanchored NATO+number still found, just lower confidence', () => {
  const r = best('whiskey 4912 whiskey 4912 whiskey 4912');
  assert.equal(r.card, 'W4912');
  const anchored = best('left off on whiskey 4912');
  assert.ok(anchored.conf > r.conf);
});

test('punctuation and case noise', () => {
  const r = best('THE DAY BOARD... LEFT OFF, ON: "W-4912."');
  assert.equal(r.card, 'W4912');
});

test('heard context is included for the log', () => {
  const r = best('good evening the day board left off on whiskey 4912 thank you');
  assert.ok(r.heard.includes('left off'));
  assert.ok(r.heard.includes('4912') || r.heard.includes('whiskey'));
});

/* ── #jul23: the REAL recordings off the live line (July 23 2026) ──
   These are the transcripts Whisper actually produced. They are START callouts
   ("we're going to start with…"), not left-offs — the parser must read the card,
   flag mode:'start', clear the 0.75 post threshold, and name the target board. */

const REAL_AM = "All right, here's a casual job forecast for Thursday morning, July 23rd. " +
  "We're going to start for letter Y, Y is in yellow, 4879. Y, 4879. " +
  "We'll see you in the morning. Thank you for calling.";
const REAL_PM = "We're here with your casual job forecast for Thursday night, July 23rd. " +
  "We're going to start with the letter B, B is in Baker 4704, B 4704. Good luck tonight.";

test('REAL Jul-23 morning forecast: card, start mode, postable confidence', () => {
  const r = parseLeftOff(REAL_AM, { keywords: ['day', 'morning', 'casual', 'casuals', 'unidentified'] });
  assert.equal(r.card, 'Y4879');
  assert.equal(r.mode, 'start');
  assert.ok(r.conf >= 0.75, 'conf ' + r.conf + ' must clear MIN_CONF 0.75');
});

test('REAL Jul-23 night forecast: card, start mode, postable confidence', () => {
  const r = parseLeftOff(REAL_PM, { keywords: ['day', 'morning', 'casual', 'casuals', 'unidentified'] });
  assert.equal(r.card, 'B4704');
  assert.equal(r.mode, 'start');
  assert.ok(r.conf >= 0.75, 'conf ' + r.conf + ' must clear MIN_CONF 0.75');
});

test('forecast target: Thursday morning July 23rd → Thu AM 7/23', () => {
  const f = parseForecastTarget(REAL_AM);
  assert.equal(f.dow, 'Thu'); assert.equal(f.slot, 'AM');
  assert.equal(f.mon, 7); assert.equal(f.day, 23);
});

test('forecast target: Thursday night July 23rd → Thu PM 7/23', () => {
  const f = parseForecastTarget(REAL_PM);
  assert.equal(f.dow, 'Thu'); assert.equal(f.slot, 'PM');
  assert.equal(f.mon, 7); assert.equal(f.day, 23);
});

test('"is in" exemplar confirms the letter (Whisper mishears "as in")', () => {
  const a = parseLeftOff('we start with the letter B, B is in Baker 4704');
  const b = parseLeftOff('we start with the letter B, 4704');
  assert.equal(a.card, 'B4704');
  assert.ok(a.conf > b.conf, 'exemplar-backed read should score higher');
});

test('repeated card raises confidence', () => {
  const once  = parseLeftOff('we will start with letter B 4704 tonight');
  const twice = parseLeftOff('we will start with letter B 4704 tonight. B, 4704.');
  assert.equal(twice.card, 'B4704');
  assert.ok(twice.conf > once.conf, 'a repeated callout should score higher');
});

test('left-off phrasing still reads as mode end', () => {
  const r = parseLeftOff('the day board left off on whiskey 4912');
  assert.equal(r.card, 'W4912');
  assert.equal(r.mode, 'end');
});

test('mixed sentence: left off beats start when both are present', () => {
  const r = parseLeftOff('we left off at letter W 4912 for the day board');
  assert.equal(r.card, 'W4912');
  assert.equal(r.mode, 'end');
});

/* ── counts (E / N / D) ── */

test('early count after morning dispatch', () => {
  const c = parseCounts('the early count for tonight is 176 jobs');
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'early');
  assert.equal(c[0].n, 176);
});

test('night final after 2:30', () => {
  const c = parseCounts('the night board final count is 991 jobs thank you');
  assert.equal(c[0].kind, 'night_final');
  assert.equal(c[0].n, 991);
});

test('day final the night before, with comma', () => {
  const c = parseCounts("tomorrow's day board final is 1,240 jobs");
  assert.equal(c[0].kind, 'day_final');
  assert.equal(c[0].n, 1240);
});

test('card digits are never a count', () => {
  const c = parseCounts('the day board left off on whiskey 4912 the early count is 176 jobs');
  assert.equal(c.length, 1);
  assert.equal(c[0].n, 176);
});

test('bare numbers with no count context are ignored', () => {
  assert.equal(parseCounts('call back after 230 for the final').length, 0);
  assert.equal(parseCounts('today is july 22 2026').length, 0);
});

test('counts and left-off coexist in one transcript', () => {
  const t = 'the night board left off on bravo 4433 the day board final for tomorrow is 1240 jobs';
  assert.equal(parseLeftOff(t).card, 'B4433');
  const c = parseCounts(t);
  assert.equal(c[0].kind, 'day_final');
  assert.equal(c[0].n, 1240);
});

/* ── special announcements ── */

test('stop work flagged', () => {
  const s = parseSpecial('attention there will be no work tonight due to the contract action');
  assert.ok(s.some(x => x.tag === 'stop_work'));
});

test('stop work MEETING is a meeting, not a stoppage', () => {
  const s = parseSpecial('reminder the stop work meeting is thursday at 6 pm');
  assert.ok(s.some(x => x.tag === 'meeting'));
  assert.ok(!s.some(x => x.tag === 'stop_work'));
});

test('holiday and closure flagged with snippets', () => {
  const s = parseSpecial('the hall is closed friday for the bloody thursday holiday');
  const tags = s.map(x => x.tag);
  assert.ok(tags.includes('closed'));
  assert.ok(tags.includes('holiday'));
  assert.ok(s[0].snippet.length > 0);
});

test('quiet recording flags nothing', () => {
  assert.equal(parseSpecial('the day board left off on whiskey 4912 thank you for calling').length, 0);
});
