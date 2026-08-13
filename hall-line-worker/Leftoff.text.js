'use strict';
/* node --test leftoff.test.js — the cost rails and board arithmetic (#aug13) */
const { test } = require('node:test');
const assert = require('node:assert');
const { _internals: I } = require('./leftoff.js');

/* ---- window age (drives the call-budget query) ---- */
test('window age: mid-morning window', () => {
  assert.equal(I.windowAgeMins(10 * 60), 30);            // 10:00 → window opened 9:30
});
test('window age: night window', () => {
  assert.equal(I.windowAgeMins(20 * 60), 60);            // 20:00 → opened 19:00
});
test('window age: after midnight still yesterday night', () => {
  assert.equal(I.windowAgeMins(0), 5 * 60);              // 00:00 → 19:00 was 5h ago
  assert.equal(I.windowAgeMins(8 * 60), 13 * 60);        // 08:00 → still last night's window
});

/* ---- corroboration (posting from the log with zero calls) ---- */
test('two agreeing reads near threshold post from the log', () => {
  const rows = [
    { k: 'k1', card: 'B4704', conf: 0.72, extras: { kind: 'start', about: '2026-08-13_Thu_PM' } },
    { k: 'k1', card: 'B4704', conf: 0.70, extras: { kind: 'start', about: '2026-08-13_Thu_PM' } },
  ];
  const c = I.corroborateFromLog(rows, 0.75);
  assert.ok(c, 'should corroborate');
  assert.equal(c.card, 'B4704');
  assert.ok(c.conf >= 0.75, 'combined conf clears threshold: ' + c.conf);
  assert.equal(c.n, 2);
});
test('a single read never posts from the log', () => {
  assert.equal(I.corroborateFromLog([{ k: 'k1', card: 'B4704', conf: 0.9 }], 0.75), null);
});
test('two weak reads stay logged-only', () => {
  const rows = [
    { k: 'k1', card: 'B4704', conf: 0.55 },
    { k: 'k1', card: 'B4704', conf: 0.50 },
  ];
  assert.equal(I.corroborateFromLog(rows, 0.75), null);
});
test('disagreeing reads do not corroborate each other', () => {
  const rows = [
    { k: 'k1', card: 'B4704', conf: 0.72 },
    { k: 'k1', card: 'Y4879', conf: 0.72 },
  ];
  assert.equal(I.corroborateFromLog(rows, 0.75), null);
});

/* ---- log-row → record translation ---- */
test('start-kind log row becomes the previous board end', () => {
  const tr = I.buildPatchFromLogRow({ k: 'x', card: 'B4704', extras: { kind: 'start', about: '2026-08-13_Thu_PM' } });
  assert.equal(tr.postKey, '2026-08-13_Thu_AM');
  assert.deepEqual(tr.patch, { end: 'B4703' });
});
test('end-kind log row posts to its own board', () => {
  const tr = I.buildPatchFromLogRow({ k: '2026-08-13_Thu_AM', card: 'W4912', extras: { kind: 'end', about: '2026-08-13_Thu_AM' } });
  assert.equal(tr.postKey, '2026-08-13_Thu_AM');
  assert.deepEqual(tr.patch, { end: 'W4912' });
});
test('cardless log row translates to nothing', () => {
  assert.equal(I.buildPatchFromLogRow({ k: 'x', card: null }), null);
});

/* ---- early-run targeting (dispatch ended early) ---- */
test('board-key chain arithmetic holds', () => {
  assert.equal(I.prevKeyOf('2026-08-13_Thu_PM'), '2026-08-13_Thu_AM');
  assert.equal(I.prevKeyOf('2026-08-13_Thu_AM'), '2026-08-12_Wed_PM');
  assert.equal(I.nextKeyOf('2026-08-13_Thu_AM'), '2026-08-13_Thu_PM');
  assert.equal(I.nextKeyOf('2026-08-13_Thu_PM'), '2026-08-14_Fri_AM');
});
test('card arithmetic keeps digit width', () => {
  assert.equal(I.prevCardId('B0705'), 'B0704');
  assert.equal(I.nextCard('B0704'), 'B0705');
  assert.equal(I.prevCardId('W4913'), 'W4912');
});
