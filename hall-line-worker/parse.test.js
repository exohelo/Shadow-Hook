'use strict';
/* node --test parse.test.js */
const { test } = require('node:test');
const assert = require('node:assert');
const { parseLeftOff } = require('./parse.js');

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
