'use strict';
// Belief-log: validate + append. SPEC.md §2. Append-only, OTel-shaped JSONL.
// Zero runtime deps: a small purpose-built validator, not a general JSON Schema engine.

const fs = require('fs');

const KINDS = ['trace.open', 'belief.open', 'belief.update', 'belief.close', 'note'];
const STATUSES = ['OPEN', 'ALIGNED', 'SUPERSEDED', 'DEFERRED', 'CLOSED'];

// Validate a single parsed line object. Returns { valid, errors: [] }.
function validateLine(obj) {
  const errors = [];
  const req = (k) => { if (obj[k] === undefined || obj[k] === null) errors.push(`missing required field: ${k}`); };
  const str = (k) => { if (obj[k] !== undefined && typeof obj[k] !== 'string') errors.push(`${k} must be a string`); };

  req('ts'); req('trace'); req('span'); req('kind');
  str('ts'); str('trace'); str('span'); str('belief'); str('from'); str('to'); str('trigger'); str('note'); str('phase');

  if (obj.ts !== undefined && typeof obj.ts === 'string' && Number.isNaN(Date.parse(obj.ts))) {
    errors.push('ts must be an RFC 3339 / parseable date-time');
  }
  if (obj.kind !== undefined && !KINDS.includes(obj.kind)) {
    errors.push(`kind not in enum: ${obj.kind}`);
  }
  if (obj.confidence !== undefined) {
    if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
      errors.push('confidence must be a number in [0,1]');
    }
  }
  if (obj.risk !== undefined) {
    if (typeof obj.risk !== 'number' || obj.risk < 0 || obj.risk > 1) {
      errors.push('risk must be a number in [0,1]');
    }
  }
  if (obj.evidence !== undefined) {
    if (!Array.isArray(obj.evidence) || !obj.evidence.every((e) => typeof e === 'string')) {
      errors.push('evidence must be an array of strings');
    }
  }
  if (obj.status !== undefined && !STATUSES.includes(obj.status)) {
    errors.push(`status not in enum: ${obj.status}`);
  }
  // conditional requirements
  if (obj.kind === 'belief.open' && (obj.belief === undefined || obj.belief === null)) {
    errors.push('belief.open requires belief');
  }
  if (obj.kind === 'note' && (obj.note === undefined || obj.note === null)) {
    errors.push('note kind requires note');
  }
  if (obj.kind === 'trace.open' && (obj.note === undefined || obj.note === null)) {
    errors.push('trace.open requires note');
  }
  return { valid: errors.length === 0, errors };
}

// Validate a whole file (per-line). Returns { valid, lines: [{ n, valid, errors }], appendOnlyWarnings }.
function validateFile(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const results = [];
  const appendOnlyWarnings = [];
  let lastTs = null;
  lines.forEach((line, i) => {
    const n = i + 1;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch (e) {
      results.push({ n, valid: false, errors: [`not valid JSON: ${e.message}`] });
      return;
    }
    const r = validateLine(obj);
    results.push({ n, valid: r.valid, errors: r.errors });
    if (obj.ts && !Number.isNaN(Date.parse(obj.ts))) {
      const t = Date.parse(obj.ts);
      if (lastTs !== null && t < lastTs) {
        appendOnlyWarnings.push(`line ${n}: ts goes backwards (clock skew or out-of-order append)`);
      }
      lastTs = t;
    }
  });
  return { valid: results.every((r) => r.valid), lines: results, appendOnlyWarnings };
}

// Append a belief event. Enforces append-only ts ordering unless allowClockSkew.
// entry: object (ts filled from `now` if absent). Returns the written object.
function append(path, entry, { allowClockSkew = false, now = null } = {}) {
  const obj = Object.assign({}, entry);
  if (!obj.ts) obj.ts = (now || new Date()).toISOString();
  const r = validateLine(obj);
  if (!r.valid) throw new Error(`refusing to append invalid line: ${r.errors.join('; ')}`);

  if (fs.existsSync(path)) {
    const raw = fs.readFileSync(path, 'utf8');
    const existing = raw.split('\n').filter((l) => l.trim().length > 0);
    if (existing.length > 0) {
      const last = JSON.parse(existing[existing.length - 1]);
      if (last.ts && Date.parse(obj.ts) < Date.parse(last.ts) && !allowClockSkew) {
        throw new Error(
          `refusing to append: ts ${obj.ts} precedes last line ts ${last.ts} (append-only). ` +
          `Pass allowClockSkew to override.`
        );
      }
    }
  }
  const needsNL = fs.existsSync(path) && fs.readFileSync(path, 'utf8').length > 0
    && !fs.readFileSync(path, 'utf8').endsWith('\n');
  fs.appendFileSync(path, (needsNL ? '\n' : '') + JSON.stringify(obj) + '\n');
  return obj;
}

module.exports = { validateLine, validateFile, append, KINDS, STATUSES };
