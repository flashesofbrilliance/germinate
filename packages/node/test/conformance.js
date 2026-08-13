'use strict';
// Runs the language-neutral conformance suite (../../../conformance/cases.json) against the Node impl.
// Every implementation ships one of these; identical fixtures => no drift between languages.

const fs = require('fs');
const path = require('path');
const belieflog = require('../src/belieflog');
const seedlib = require('../src/seed');
const { loadManifest, driftCheck } = require('../src/manifest');
const { compareDocset } = require('../src/docset');

const CONF = path.resolve(__dirname, '../../../conformance');
const cases = JSON.parse(fs.readFileSync(path.join(CONF, 'cases.json'), 'utf8'));

let pass = 0, fail = 0;
const log = (ok, msg) => { if (ok) { pass++; } else { fail++; console.error(`  FAIL: ${msg}`); } };

// 1. belief-log line validation
for (const c of cases.beliefLogLineValidation) {
  const r = belieflog.validateFile(path.join(CONF, c.file));
  log(r.valid === c.valid, `belief ${c.file} expected valid=${c.valid} got ${r.valid}`);
}

// 2. docset ordering
for (const c of cases.docsetOrdering) {
  const got = compareDocset(c.a, c.b);
  log(got === c.cmp, `docset cmp(${c.a},${c.b}) expected ${c.cmp} got ${got}`);
}

// 3. drift-check
for (const c of cases.driftCheck) {
  const m = loadManifest(path.join(CONF, c.manifest));
  const { verdicts, ok } = driftCheck(m, CONF);
  log(ok === c.expectExitZero, `drift ${c.manifest} expected ok=${c.expectExitZero} got ${ok}`);
  for (const [id, v] of Object.entries(c.verdicts)) {
    log(verdicts[id] === v, `drift ${c.manifest} surface ${id} expected ${v} got ${verdicts[id]}`);
  }
}

// 4. seed sprout (deterministic surfacer)
if (cases.seedSprout) {
  const bankDir = path.join(CONF, cases.seedSprout.bank);
  for (const c of cases.seedSprout.cases) {
    const res = seedlib.sprout({ localDir: bankDir, globalDir: null }, { contextStr: c.context, cwd: CONF, includeGlobal: false });
    const ids = (arr) => arr.map((x) => x.id);
    log(JSON.stringify(ids(res.surfaced)) === JSON.stringify(c.surfaced), `sprout "${c.context}" surfaced ${JSON.stringify(ids(res.surfaced))} != ${JSON.stringify(c.surfaced)}`);
    log(JSON.stringify(ids(res.suppressed).sort()) === JSON.stringify([...c.suppressed].sort()), `sprout "${c.context}" suppressed ${JSON.stringify(ids(res.suppressed))} != ${JSON.stringify(c.suppressed)}`);
    log(JSON.stringify(ids(res.stale).sort()) === JSON.stringify([...c.stale].sort()), `sprout "${c.context}" stale ${JSON.stringify(ids(res.stale))} != ${JSON.stringify(c.stale)}`);
  }
}

console.log(`\nconformance: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
