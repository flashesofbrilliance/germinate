'use strict';
// Unit tests + conformance. Zero-dep: a tiny assert harness.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const belieflog = require('../src/belieflog');
const handoff = require('../src/handoff');
const { compareDocset } = require('../src/docset');

let n = 0;
function t(name, fn) { n++; try { fn(); process.stdout.write(`  ✓ ${name}\n`); } catch (e) { process.stdout.write(`  ✗ ${name}\n    ${e.message}\n`); process.exitCode = 1; } }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hl-test-'));

t('docset ordering is total and correct', () => {
  assert.strictEqual(compareDocset('2026-08-13-build.1', '2026-08-13-build.2'), -1);
  assert.strictEqual(compareDocset('2026-08-13-build.10', '2026-08-13-build.2'), 1);
  assert.strictEqual(compareDocset('2026-08-13-build.1', '2026-08-13-build.1'), 0);
});

t('append rejects invalid line', () => {
  const f = path.join(tmp, 'a.jsonl');
  assert.throws(() => belieflog.append(f, { trace: 't', span: 's', kind: 'belief.open' }), /belief/);
});

t('append enforces append-only ts ordering', () => {
  const f = path.join(tmp, 'b.jsonl');
  belieflog.append(f, { trace: 't', span: 's', kind: 'note', note: 'x' }, { now: new Date('2026-08-13T10:00:00Z') });
  assert.throws(
    () => belieflog.append(f, { trace: 't', span: 's', kind: 'note', note: 'y', ts: '2026-08-13T09:00:00Z' }),
    /append-only/
  );
});

t('append allows clock skew with override', () => {
  const f = path.join(tmp, 'c.jsonl');
  belieflog.append(f, { trace: 't', span: 's', kind: 'note', note: 'x' }, { now: new Date('2026-08-13T10:00:00Z') });
  belieflog.append(f, { trace: 't', span: 's', kind: 'note', note: 'y', ts: '2026-08-13T09:00:00Z' }, { allowClockSkew: true });
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  assert.strictEqual(lines.length, 2);
});

t('handoff assemble surfaces open beliefs from the log', () => {
  const f = path.join(tmp, 'log.jsonl');
  belieflog.append(f, { trace: 't', span: '1.x', kind: 'belief.open', belief: 'A is best', status: 'OPEN' }, { now: new Date('2026-08-13T10:00:00Z') });
  belieflog.append(f, { trace: 't', span: '2.y', kind: 'belief.open', belief: 'B works', status: 'ALIGNED' }, { now: new Date('2026-08-13T11:00:00Z') });
  const a = handoff.assemble({ docset: '2026-08-13-build.1', belieflog: f, startsAt: 'test', cwd: tmp });
  const threads = a.frontMatter.head.openThreads.join(' ');
  assert.ok(threads.includes('1.x'), 'open belief present');
  assert.ok(!threads.includes('2.y'), 'aligned belief excluded');
});

t('pickup prompt is self-contained', () => {
  const a = handoff.assemble({ docset: '2026-08-13-build.1', startsAt: 'wire the sandbox', blocking: 'NONE', cwd: tmp });
  const p = handoff.pickupPrompt(a);
  assert.ok(p.includes('START HERE: wire the sandbox'));
  assert.ok(p.includes('drift-check'));
});

t('CLI end-to-end: validate + drift-check + docset-cmp exit codes', () => {
  const bin = path.resolve(__dirname, '../bin/handoff-ledger.js');
  const conf = path.resolve(__dirname, '../../../conformance');
  // valid log => exit 0
  execFileSync('node', [bin, 'belief', 'validate', path.join(conf, 'belief-log/valid/belief-open.jsonl')]);
  // invalid log => exit 1
  assert.throws(() => execFileSync('node', [bin, 'belief', 'validate', path.join(conf, 'belief-log/invalid/bad-kind.jsonl')], { stdio: 'ignore' }));
  // docset-cmp
  const c = execFileSync('node', [bin, 'docset-cmp', '2026-08-13-build.1', '2026-08-13-build.2'], { encoding: 'utf8' }).trim();
  assert.strictEqual(c, '-1');
});

console.log(`\n${n} unit tests run.`);

// Run the conformance suite as part of the default test.
require('./conformance.js');
