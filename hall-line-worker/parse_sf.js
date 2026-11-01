/* The Shadow Hook · parse_sf.js (nov1b) — reads the ILWU Local 10 pre-tape (the San Francisco / Oakland hall).
   Local 10 does not run a letter board. The pre-tape gives, for each coming shift:
     "Tonight, we have a possible 129 jobs, 69 skill, and 60 non-skill."
     "Ships possibly working, berth 55 with 3 cranes to continue, berth 25 with 2 cranes to start, ..."
     "Nightside starts, hold board, line 27, 1018.05. Prep, line 2, 9605. ... And IDs, you are at 3905."
     "In the morning, we have a possible 147 jobs, ..."   (then the dayside starts)
   parseLocal10(transcript, ranAtISO) → { header:{night,morning dates}, shifts:[{key, shift, jobs, skill, nonskill,
   ships:[{berth,cranes,status}], starts:{board:{line,reg}}, ids}] } — keys in the app's form 2026-10-31_Sat_PM. */
'use strict';

const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WORDNUM = { one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12 };

function toInt(s) { if (s == null) return null; const w = WORDNUM[String(s).toLowerCase()]; if (w) return w; const n = parseInt(String(s).replace(/[^\d]/g, ''), 10); return isFinite(n) ? n : null; }
function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function keyOf(d, ap) { return iso(d) + '_' + DOW[d.getDay()] + '_' + ap; }

/* "for Saturday night, October 31st and Sunday morning, November 1st, 2026" */
function headerDates(tx, ranAt) {
  const out = {};
  const year = (/\b(20\d\d)\b/.exec(tx) || [])[1] || String(new Date(ranAt || Date.now()).getFullYear());
  const re = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+(night|morning|day|evening)[,\s]+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/gi;
  let m;
  while ((m = re.exec(tx))) {
    const d = new Date(+year, MONTHS.indexOf(m[3].toLowerCase()), +m[4]);
    const which = /morning|day/i.test(m[2]) ? 'AM' : 'PM';
    if (!out[which]) out[which] = d;
  }
  /* a year turning over between the two (Dec 31 night → Jan 1 morning) */
  if (out.PM && out.AM && out.AM < out.PM) out.AM = new Date(out.AM.getFullYear() + 1, out.AM.getMonth(), out.AM.getDate());
  return out;
}

function parseJobs(seg) {
  const m = /possible\s+([\d,]+)\s+jobs?(?:[,\s]+([\d,]+)\s+skill(?:ed)?)?(?:[,\s]+(?:and\s+)?([\d,]+)\s+non[\s-]?skill(?:ed)?)?/i.exec(seg);
  return m ? { jobs: toInt(m[1]), skill: toInt(m[2]), nonskill: toInt(m[3]) } : { jobs: null, skill: null, nonskill: null };
}
function parseShips(seg) {
  const ships = [], re = /berth\s+(\d{1,3})\s+with\s+(\w+)\s+cranes?(?:\s+to\s+(start|continue|finish|complete))?/gi;
  let m; while ((m = re.exec(seg))) ships.push({ berth: m[1], cranes: toInt(m[2]), status: m[3] ? m[3].toLowerCase() : null });
  return ships;
}
/* "hold board, line 27, 1018.05. Prep, line 2, 9605. ... Night bees, you're at line 68, 1025.14. And IDs, you are at 3905." */
function parseStarts(seg) {
  /* one board per sentence; registration numbers carry a decimal point, so split only where a capital follows */
  const starts = {};
  seg.split(/\.\s+(?=[A-Z])/).forEach(function (sen) {
    const m = /^(?:and\s+)?(?:(?:night|day)side\s+starts,?\s*)?([A-Za-z][A-Za-z ]{0,22}?)(?:\s+boards?)?,?\s+(?:you(?:'re| are)\s+at\s+)?line\s+(\d{1,3}),?\s+([\d.,]{3,9})/i.exec(sen.trim());
    if (!m) return;
    const name = m[1].trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s+boards?$/, '').replace(/^press$/, 'prep');
    if (/^(?:possible|berth|ships?)/.test(name)) return;
    starts[name] = { line: toInt(m[2]), reg: m[3].replace(/[.,]$/, '') };
  });
  return starts;
}
function parseIds(seg) {
  const m = /\bI\.?\s?D\.?s?,?\s+(?:you(?:'re| are)\s+(?:at|on)|(?:are|is)\s+(?:at|on)|at|start(?:s|ing)?\s+(?:at|on))\s+(?:number\s+)?([\d,]{2,6})/i.exec(seg);
  return m ? toInt(m[1]) : null;
}

function parseLocal10(tx, ranAt) {
  tx = String(tx || '');
  const dates = headerDates(tx, ranAt);
  /* job blocks open a sentence: "Tonight, we have a possible ...", "In the morning, we have ...", "Tomorrow morning, we have ..."
     (the tape repeats them as a recap: "Again, tonight, we have ..."). A passing "tonight at 7 p.m." is not a block. */
  const marks = [];
  const re = /(?:^|[.!?]\s+)(?:all right,?\s+)?(?:again,?\s+)?(tonight|this evening|in the morning|tomorrow morning|this morning|today),?\s+we\s+have\b/gi;
  let m; while ((m = re.exec(tx))) marks.push({ at: m.index, word: m[1].toLowerCase() });
  /* board starts are their own blocks: "Nightside starts, ..." belongs to the night, "Dayside starts, ..." to the day */
  const startBlocks = [];
  const rs = /(night|day)side\s+starts\b/gi;
  while ((m = rs.exec(tx))) startBlocks.push({ at: m.index, ap: m[1].toLowerCase() === 'night' ? 'PM' : 'AM' });
  const ends = marks.map(x => x.at).concat(startBlocks.map(x => x.at)).sort((a, b) => a - b);
  const until = at => { const n = ends.find(e => e > at); return n == null ? tx.length : n; };
  const byKey = {};
  function shift(ap) {
    const d = dates[ap], key = d ? keyOf(d, ap) : null, k = key || ap;
    return byKey[k] || (byKey[k] = { shift: ap, key, jobs: null, skill: null, nonskill: null, ships: [], starts: {}, ids: null });
  }
  marks.forEach(mk => {
    const seg = tx.slice(mk.at, until(mk.at)), ap = /morning|today/.test(mk.word) ? 'AM' : 'PM', s = shift(ap), J = parseJobs(seg), sh = parseShips(seg);
    if (s.jobs == null && J.jobs != null) Object.assign(s, J);          /* the first telling wins; the recap only fills gaps */
    if (!s.ships.length && sh.length) s.ships = sh;
    if (s.ids == null) s.ids = parseIds(seg);
  });
  startBlocks.forEach(b => {
    const seg = tx.slice(b.at, until(b.at)), s = shift(b.ap), st = parseStarts(seg);
    Object.keys(st).forEach(k => { if (!s.starts[k]) s.starts[k] = st[k]; });
    if (s.ids == null) s.ids = parseIds(seg);
  });
  const shifts = Object.keys(byKey).map(k => byKey[k]).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  return { dates: { night: dates.PM ? iso(dates.PM) : null, morning: dates.AM ? iso(dates.AM) : null }, shifts };
}

module.exports = { parseLocal10 };
