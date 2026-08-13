'use strict';
// Docset version ordering — SPEC.md §4.
// Format: YYYY-MM-DD-<phase>.<n>. Order: date desc-as-numeric, then phase lexical, then n numeric.

const DOCSET_RE = /^(\d{4})-(\d{2})-(\d{2})-([A-Za-z0-9]+)\.(\d+)$/;

function parseDocset(v) {
  const m = DOCSET_RE.exec(v);
  if (!m) throw new Error(`invalid docset version: ${JSON.stringify(v)}`);
  return { date: `${m[1]}-${m[2]}-${m[3]}`, phase: m[4], n: parseInt(m[5], 10) };
}

// Returns -1 if a<b, 0 if equal, 1 if a>b.
function compareDocset(a, b) {
  const pa = parseDocset(a);
  const pb = parseDocset(b);
  if (pa.date !== pb.date) return pa.date < pb.date ? -1 : 1;
  if (pa.phase !== pb.phase) return pa.phase < pb.phase ? -1 : 1;
  if (pa.n !== pb.n) return pa.n < pb.n ? -1 : 1;
  return 0;
}

module.exports = { parseDocset, compareDocset, DOCSET_RE };
