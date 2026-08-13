'use strict';
// Seed layer. SPEC.md §9. A seed = content + germination conditions.
// v0.1 sprout is DELIBERATELY deterministic: literal tag-set intersection on soil+tags,
// hard visible veto on antipatterns, git-path staleness. No NLP/LLM (that is the ARCS layer).
// Zero deps: a minimal, well-specified YAML-subset frontmatter parser (mirrored in Python).

const fs = require('fs');
const path = require('path');

// ---- minimal YAML-subset frontmatter parser (shared contract; see conformance) ----
// Supports: `key: scalar`, `key: [a, b]`, block lists (`  - item`), one-level nested map,
// booleans, integers, quoted strings. Unknown fields tolerated (accretion).
function parseFrontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { frontmatter: {}, body: text };
  const body = m[2] || '';
  const lines = m[1].split('\n');
  const fm = {};
  let i = 0;
  const scalar = (v) => {
    v = v.trim();
    if (v === '') return '';
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
    return v;
  };
  const inlineList = (v) => v.slice(1, -1).split(',').map((s) => scalar(s)).filter((s) => s !== '');
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) { i++; continue; }
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!kv) { i++; continue; }
    const key = kv[1];
    const rest = kv[2];
    if (rest === '') {
      // could be a block list or a nested map
      const block = [];
      const nested = {};
      let isList = false, isMap = false;
      let j = i + 1;
      while (j < lines.length && /^\s+\S/.test(lines[j])) {
        const item = /^\s+-\s+(.*)$/.exec(lines[j]);
        const sub = /^\s+([A-Za-z0-9_]+):\s*(.*)$/.exec(lines[j]);
        if (item) { isList = true; block.push(scalar(item[1])); }
        else if (sub) { isMap = true; nested[sub[1]] = sub[2].startsWith('[') ? inlineList(sub[2]) : scalar(sub[2]); }
        j++;
      }
      fm[key] = isList ? block : (isMap ? nested : '');
      i = j;
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      fm[key] = inlineList(rest);
      i++;
    } else {
      fm[key] = scalar(rest);
      i++;
    }
  }
  return { frontmatter: fm, body };
}

function tokenize(str) {
  return new Set(String(str || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}
// A phrase matches iff all its tokens are present in the context token set.
function phraseMatches(phrase, contextTokens) {
  const t = [...tokenize(phrase)];
  return t.length > 0 && t.every((tok) => contextTokens.has(tok));
}

function loadSeedsFromDir(dir, isGlobal) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const p = path.join(dir, f);
      const { frontmatter, body } = parseFrontmatter(fs.readFileSync(p, 'utf8'));
      if (frontmatter.kind !== 'seed') return null;
      const id = frontmatter.id || path.basename(f, '.md');
      return { id, path: p, isGlobal, fm: frontmatter, body,
        soil: frontmatter.soil || [], tags: frontmatter.tags || [],
        antipatterns: frontmatter.antipatterns || [], global: !!frontmatter.global };
    })
    .filter(Boolean);
}

// Deterministic surfacer. Returns { surfaced, suppressed, stale, dormant, shadowed }.
// ctx: { contextStr, cwd, trace, includeGlobal }
function sprout(banks, ctx) {
  const cwd = ctx.cwd || process.cwd();
  const contextTokens = new Set([
    ...tokenize(ctx.contextStr),
    ...tokenize(cwd),
    ...tokenize((cwd.split(path.sep).slice(-3).join(' '))),
    ...tokenize(ctx.trace),
  ]);

  // Load local (default) + global (opt-in). Local overrides global by id.
  let seeds = loadSeedsFromDir(banks.localDir, false);
  const shadowed = [];
  if (ctx.includeGlobal) {
    const localIds = new Set(seeds.map((s) => s.id));
    for (const g of loadSeedsFromDir(banks.globalDir, true)) {
      if (localIds.has(g.id)) { shadowed.push(g.id); continue; }
      // tenant boundary: a global seed crosses trace only if its soil whitelists the trace
      if (ctx.trace && g.global) {
        const whitelisted = (g.soil || []).some((s) => tokenize(s).has(String(ctx.trace).toLowerCase()));
        if (!whitelisted) continue; // withheld cross-tenant
      }
      seeds.push(g);
    }
  }

  const surfaced = [], suppressed = [], stale = [], dormant = [];
  for (const s of seeds) {
    const matchedSoil = (s.soil || []).filter((x) => phraseMatches(x, contextTokens));
    const matchedTags = (s.tags || []).filter((x) => phraseMatches(x, contextTokens));
    const score = matchedSoil.length + matchedTags.length;
    const matchedAnti = (s.antipatterns || []).filter((x) => phraseMatches(x, contextTokens));
    // staleness: a soil entry that names a git path which no longer exists
    const stalePaths = (s.soil || []).filter((x) => String(x).includes('/') && !fs.existsSync(path.resolve(cwd, x)));

    const rec = { id: s.id, path: s.path, isGlobal: s.isGlobal, score, matchedSoil, matchedTags };
    if (matchedAnti.length > 0) { suppressed.push({ ...rec, suppressedBy: matchedAnti }); }
    else if (score > 0 && stalePaths.length > 0) { stale.push({ ...rec, stalePaths }); }
    else if (score > 0) { surfaced.push(rec); }
    else { dormant.push({ id: s.id, path: s.path, isGlobal: s.isGlobal }); }
  }
  surfaced.sort((a, b) => (b.score - a.score) || a.id.localeCompare(b.id));
  return { surfaced, suppressed, stale, dormant, shadowed };
}

// Lint a seed for publish-safety (redaction). Returns { ok, warnings }.
const SECRET_RE = /(case[-_ ]?\d{3,}|gdoc:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\b[A-Z]{2,}-\d{2,}\b)/;
function lintSeed(seedFileText) {
  const { frontmatter } = parseFrontmatter(seedFileText);
  const warnings = [];
  const scan = (label, val) => {
    const str = Array.isArray(val) ? val.join(' ') : (typeof val === 'object' ? JSON.stringify(val) : String(val || ''));
    if (SECRET_RE.test(str)) warnings.push(`${label} contains a likely internal identifier (redact via a rosetta handle before publishing to the global bank)`);
  };
  scan('soil', frontmatter.soil);
  scan('provenance', frontmatter.provenance);
  scan('antipatterns', frontmatter.antipatterns);
  if (frontmatter.global && (!frontmatter.soil || frontmatter.soil.length === 0))
    warnings.push('global seed with empty soil will match nothing / everything ambiguously — scope its soil');
  return { ok: warnings.length === 0, warnings };
}

module.exports = { parseFrontmatter, tokenize, phraseMatches, loadSeedsFromDir, sprout, lintSeed };
