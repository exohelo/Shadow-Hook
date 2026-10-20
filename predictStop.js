// The Wire: stop prediction from the sheet numbers.
//
// What the history (Oct 5-20) showed:
//  - Normal shifts move 7-15 letters; the ILWU total nudges it, it doesn't scale it.
//  - Nights: hall orders / ILWU total matter a little, comebacks don't.
//    Days: comebacks and PMA total are the strongest signals.
//  - Letters the previous shift already worked run thin. After a big run,
//    the next shift usually runs too (Fri 10/16 PM, Tue 10/20 AM).
//  - Letters past the published stop run thin (people stay home).

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const idx = (L) => ABC.indexOf(L);
const step = (from, n) => ABC[(idx(from) + n) % 26];

// letters from..to inclusive, walking forward and wrapping
function span(from, to) {
  const out = [];
  for (let i = 0; i < 26; i++) { const L = step(from, i); out.push(L); if (L === to) break; }
  return out;
}

/**
 * Normal-shift capacity in letters: median letters moved on past shifts of the
 * same type (AM/PM) with a similar size, skipping shifts that followed a big run.
 * history: [{ shift:'AM'|'PM', ilwu, comebacks, pmaTotal, act, prevAct }]
 */
export function baseLetters(history, shift, today) {
  const key = shift === 'PM' ? 'ilwu' : 'comebacks';
  const pool = history.filter(h => h.shift === shift && h.prevAct < 20 && h.act < 26 && h[key] != null);
  const near = pool
    .map(h => ({ h, d: Math.abs(h[key] - today[key]) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 5)
    .map(x => x.h.act)
    .sort((a, b) => a - b);
  if (!near.length) return 10;
  return near[Math.floor(near.length / 2)];
}

/**
 * @param {object} o
 * @param {string} o.start          starting letter, e.g. 'L'
 * @param {number} o.base           normal capacity in letters (from baseLetters)
 * @param {string} [o.prevStart]    where the previous shift started
 * @param {string} [o.prevEnd]      where the previous shift stopped
 * @param {string} [o.published]    stop already shown to members, if any
 * @param {number} [o.startLeft=0.5]  share of the start letter still to go
 * @param {number} [o.thinWorked=1/3]    worked-this-shift letter, as a fraction of full
 * @param {number} [o.thinPastStop=1/3]  letter past the published stop
 */
export function predictStop(o) {
  const { start, base, prevStart, prevEnd, published, startLeft = 0.5, thinWorked = 1 / 3, thinPastStop = 1 / 3 } = o;
  const worked = prevStart && prevEnd ? new Set(span(prevStart, prevEnd)) : new Set();
  const pubDist = published ? (idx(published) - idx(start) + 26) % 26 : Infinity;

  const run = (cap, tw) => {
    let left = cap - startLeft, n = 0;
    while (left > 0 && n < 52) {
      const L = step(start, n + 1);
      let f = 1;
      if (worked.has(L)) f = Math.min(f, tw);
      if (n + 1 > pubDist - 2) f = Math.min(f, thinPastStop);
      left -= f; n++;
    }
    return n;
  };

  const mid = run(base, thinWorked);
  const lo = run(base * 0.85, Math.min(1, thinWorked * 1.5));
  const hi = run(base * 1.15, thinWorked * 0.75);
  const fmt = (n) => (n >= 26 ? 'cycle' : step(start, n));
  return {
    stop: fmt(mid), lo: fmt(lo), hi: fmt(hi),
    letters: mid, loLetters: lo, hiLetters: hi,
    // what it would be if the worked letters were full (the "sheets only" read)
    sheetsOnly: fmt(run(base, 1)),
  };
}
