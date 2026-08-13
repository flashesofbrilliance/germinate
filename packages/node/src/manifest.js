'use strict';
// Manifest + drift-check. SPEC.md §3.

const fs = require('fs');
const path = require('path');
const { compareDocset } = require('./docset');

function loadManifest(manifestPath) {
  const obj = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!obj.docsetVersion) throw new Error('manifest missing docsetVersion');
  if (!Array.isArray(obj.surfaces)) throw new Error('manifest missing surfaces[]');
  const ids = new Set();
  for (const s of obj.surfaces) {
    if (!s.id) throw new Error('surface missing id');
    if (ids.has(s.id)) throw new Error(`duplicate surface id: ${s.id}`);
    ids.add(s.id);
  }
  return obj;
}

// Compute the drift verdict per surface. baseDir = dir to resolve canonical paths against.
// Returns { verdicts: {id: VERDICT}, ok: bool }.
function driftCheck(manifest, baseDir) {
  const verdicts = {};
  for (const s of manifest.surfaces) {
    let verdict;
    if (compareDocset(s.docset, manifest.docsetVersion) < 0) {
      verdict = 'STALE';
    } else if (s.kind === 'projection' && s.status && s.status !== 'IN_SYNC') {
      verdict = 'OUT_OF_SYNC';
    } else if (s.kind === 'canonical' && !fs.existsSync(path.resolve(baseDir, s.path))) {
      verdict = 'MISSING';
    } else {
      verdict = 'IN_SYNC';
    }
    verdicts[s.id] = verdict;
  }
  const ok = Object.values(verdicts).every((v) => v === 'IN_SYNC');
  return { verdicts, ok };
}

module.exports = { loadManifest, driftCheck };
