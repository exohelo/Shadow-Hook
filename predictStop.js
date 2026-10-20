// Two-rate stop prediction for The Wire.
// Letters before the published stop fill at the full rate.
// Letters near and past it run thin (people see the prediction and stay home),
// as do letters the previous shift already worked.

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const step = (from, n) => ABC[(ABC.indexOf(from) + n) % 26];
const dist = (from, to) => (ABC.indexOf(to) - ABC.indexOf(from) + 26) % 26 || 26;

/**
 * @param {object} o
 * @param {string} o.start        letter the board starts on, e.g. 'L'
 * @param {number} o.jobs         hall jobs expected to drop
 * @param {number} o.fullJpl      jobs a full letter absorbs (current model value, ~85)
 * @param {string} [o.published]  stop already shown to members; omit to solve for a stable one
 * @param {number} [o.edge=2]     thinning starts this many letters before the published stop
 * @param {number} [o.thin=0.35]  thin letter = this fraction of a full one (learned below)
 * @param {string[]} [o.worked=[]] letters the previous shift already dispatched
 * @param {number} [o.workedThin=0.4]
 */
export function predictStop(o) {
  const { start, jobs, fullJpl, edge = 2, thin = 0.35, worked = [], workedThin = 0.4 } = o;

  const run = (pub, j, th) => {
    const thinFrom = pub ? dist(start, pub) - edge : Infinity;
    let left = j, n = 0;
    while (left > 0 && n < 52) {
      const L = step(start, n);
      let f = n >= thinFrom ? th : 1;
      if (worked.includes(L)) f = Math.min(f, workedThin);
      left -= fullJpl * f;
      n++;
    }
    return n; // letters moved; the stop is the last letter reached
  };

  // The prediction changes turnout, so find a stop that stays put once published.
  let pub = o.published;
  if (!pub) {
    let n = run(null, jobs, thin);
    for (let i = 0; i < 10; i++) {
      const next = run(step(start, n - 1), jobs, thin);
      if (next === n) break;
      n = next;
    }
    pub = step(start, n - 1);
  }

  const mid = run(pub, jobs, thin);
  const lo = run(pub, jobs * 0.85, Math.min(1, thin * 1.4));
  const hi = run(pub, jobs * 1.15, thin * 0.7);
  return {
    stop: step(start, mid - 1), letters: mid,
    lo: step(start, lo - 1), hi: step(start, hi - 1),
    loLetters: lo, hiLetters: hi, // over 26 means a full cycle, so show the count, not just the letter
    runawayPastStop: hi - mid,
  };
}

/**
 * Learn the thin factor from one finished shift. Average this over recent shifts
 * (log the stop that was actually published, including keymaster locks).
 */
export function learnThin({ jobs, fullJpl, actual, publishedLetters, edge = 2 }) {
  const fullSteps = Math.min(actual, Math.max(0, publishedLetters - edge));
  const thinSteps = actual - fullSteps;
  if (thinSteps <= 0) return null; // stopped before the thin zone, nothing to learn
  const t = (jobs / fullJpl - fullSteps) / thinSteps;
  return Math.max(0.05, Math.min(1, t));
}

/**
 * Learn the full-letter rate from one finished shift, holding the thin factor fixed
 * (pace data from the live board puts thin letters at roughly a third of full).
 * Use the median over recent shifts of the same type (AM vs PM).
 */
export function learnFullJpl({ jobs, actual, publishedLetters, edge = 2, thin = 0.35 }) {
  const fullSteps = Math.min(actual, Math.max(0, publishedLetters - edge));
  const thinSteps = actual - fullSteps;
  return jobs / (fullSteps + thin * thinSteps);
}
