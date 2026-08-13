'use strict';
// germinate CLI. Thin arg-parsing over the core modules. Every verb supports --json.

const fs = require('fs');
const path = require('path');
const os = require('os');
const belieflog = require('./belieflog');
const seedlib = require('./seed');
const { loadManifest, driftCheck } = require('./manifest');
const { serializabilityCheck } = require('./git');
const handoff = require('./handoff');
const { compareDocset } = require('./docset');

const VERSION = require('../package.json').version;

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) { args.flags[key] = argv[++i]; }
      else { args.flags[key] = true; }
    } else { args._.push(a); }
  }
  return args;
}

function out(json, human, asJson) {
  if (asJson) process.stdout.write(JSON.stringify(json, null, 2) + '\n');
  else process.stdout.write(human + '\n');
}

const HELP = `germinate v${VERSION} — a serializable, provenance-carrying handoff protocol.

USAGE
  germinate <command> [options]

COMMANDS
  belief validate <log.jsonl>              Validate a belief-log (per line + append-only order).
  belief append <log.jsonl> --kind <k> ... Append a belief event (see flags below).
  drift-check [--manifest <m.json>]        Are all projections in sync with the docset? (CI gate)
  serializability [--manifest <m.json>]    Warn on force-push risk / untracked shared state.
  compact [options]                        Assemble a coal->diamond handoff seed (markdown).
  pickup <handoff.md>                      Emit a cold-start pickup prompt from a handoff.
  docset-cmp <a> <b>                        Compare two docset versions (-1/0/1).

SEED LAYER (context-triggered re-expression):
  seed --soil <a,b> [--type t --antipatterns x,y --content .. --out f --global --parent id1,id2]
                                           Mint a seed (content + germination conditions + lineage marker).
  seed lint <seed.md>                      Publish-safety: warn on un-redacted internal identifiers.
  plant <seed.md> [--global]               Deposit into the local (default) or global bank.
  sprout [--context <s>] [--trace <t>] [--global] [--all]
                                           Surface seeds ripe for the current context.
                                           Deterministic: literal soil/tags match; visible antipattern veto;
                                           STALE if a soil path vanished. (Semantic ripeness = the ARCS layer, v0.2.)

  init                                     Prime a tabula-rasa project (manifest + belief-log + config + prompt).
  install-hooks                            Install the git pre-push serializability hook.
  version | help

GLOBAL
  --json        Machine-readable output.
  --strict      (drift-check/serializability) exit non-zero on any warning.

belief append flags:
  --kind trace.open|belief.open|belief.update|belief.close|note   (required)
  --trace <s> --span <s> --belief <s> --from <s> --to <s>
  --trigger <s> --confidence <0..1> --status OPEN|ALIGNED|SUPERSEDED|DEFERRED|CLOSED
  --evidence <a,b,c> --note <s> --phase <s> --allow-clock-skew

compact flags:
  --title <s> --docset <v> --starts-at <s> --blocking <s>
  --belieflog <path> --manifest <path> --open-threads <a;b> --out <path> --prompt
`;

function cmdBeliefValidate(args) {
  const file = args._[2];
  if (!file) throw new Error('usage: belief validate <log.jsonl>');
  const r = belieflog.validateFile(file);
  const failures = r.lines.filter((l) => !l.valid);
  const json = { file, valid: r.valid, failures, appendOnlyWarnings: r.appendOnlyWarnings };
  let human = r.valid ? `OK: ${r.lines.length} line(s) valid.` : `INVALID: ${failures.length} bad line(s).`;
  for (const f of failures) human += `\n  line ${f.n}: ${f.errors.join('; ')}`;
  for (const w of r.appendOnlyWarnings) human += `\n  warn: ${w}`;
  out(json, human, args.flags.json);
  return r.valid ? 0 : 1;
}

function cmdBeliefAppend(args) {
  const file = args._[2];
  if (!file) throw new Error('usage: belief append <log.jsonl> --kind <k> ...');
  const f = args.flags;
  const entry = { trace: f.trace, span: f.span, kind: f.kind };
  for (const k of ['belief', 'from', 'to', 'trigger', 'status', 'note', 'phase']) if (f[k] !== undefined) entry[k] = f[k];
  if (f.confidence !== undefined) entry.confidence = parseFloat(f.confidence);
  if (f.risk !== undefined) entry.risk = parseFloat(f.risk);
  if (f.evidence !== undefined) entry.evidence = String(f.evidence).split(',').map((s) => s.trim()).filter(Boolean);
  const written = belieflog.append(file, entry, { allowClockSkew: !!f['allow-clock-skew'] });
  out({ appended: written, file }, `appended to ${file}: ${written.kind} / ${written.span}`, f.json);
  return 0;
}

function resolveManifest(args) {
  const m = args.flags.manifest || 'manifest.json';
  if (!fs.existsSync(m)) throw new Error(`manifest not found: ${m} (pass --manifest <path>)`);
  return m;
}

function cmdDriftCheck(args) {
  const m = resolveManifest(args);
  const manifest = loadManifest(m);
  const { verdicts, ok } = driftCheck(manifest, path.dirname(path.resolve(m)));
  const json = { manifest: m, docsetVersion: manifest.docsetVersion, ok, verdicts };
  let human = `drift-check @ ${manifest.docsetVersion} — ${ok ? 'ALL IN SYNC' : 'DRIFT DETECTED'}`;
  for (const [id, v] of Object.entries(verdicts)) human += `\n  ${v === 'IN_SYNC' ? '✓' : '✗'} ${id}: ${v}`;
  out(json, human, args.flags.json);
  return ok ? 0 : 1;
}

function cmdSerializability(args) {
  let manifest = { surfaces: [] };
  const m = args.flags.manifest || 'manifest.json';
  if (fs.existsSync(m)) manifest = loadManifest(m);
  const r = serializabilityCheck(manifest, process.cwd());
  const clean = !r.forcePushRisk && r.untrackedShared.length === 0 && r.danglingProjections.length === 0;
  let human = `serializability — ${clean ? 'CLEAN' : 'WARNINGS'}`;
  for (const w of r.warnings) human += `\n  ! ${w}`;
  out(Object.assign({ clean }, r), human, args.flags.json);
  return (args.flags.strict && !clean) ? 1 : 0;
}

function cmdCompact(args) {
  const f = args.flags;
  const assembled = handoff.assemble({
    title: f.title, docset: f.docset, startsAt: f['starts-at'], blocking: f.blocking,
    belieflog: f.belieflog, manifest: f.manifest,
    openThreads: f['open-threads'] ? String(f['open-threads']).split(';').map((s) => s.trim()).filter(Boolean) : undefined,
    cwd: process.cwd(),
  });
  const md = handoff.render(assembled);
  if (f.out) { fs.writeFileSync(f.out, md); }
  if (f.prompt) { process.stdout.write(handoff.pickupPrompt(assembled) + '\n'); return 0; }
  if (f.json) { out({ frontMatter: assembled.frontMatter, markdown: md }, '', true); return 0; }
  process.stdout.write((f.out ? `wrote ${f.out}\n\n` : '') + md);
  return 0;
}

function cmdPickup(args) {
  const file = args._[1];
  if (!file || !fs.existsSync(file)) throw new Error('usage: pickup <handoff.md>');
  const raw = fs.readFileSync(file, 'utf8');
  const fmMatch = /^---\n([\s\S]*?)\n---/.exec(raw);
  // We render the pickup from front-matter fields we can cheaply extract (no YAML dep).
  const get = (k) => { const m = new RegExp(`${k}:\\s*(.+)`).exec(fmMatch ? fmMatch[1] : ''); return m ? m[1].replace(/^["']|["']$/g, '').trim() : undefined; };
  const assembled = { frontMatter: {
    docset: get('docset'),
    head: { startsAt: get('startsAt') || 'see handoff', blocking: get('blocking') || 'NONE', openThreads: [] },
    tail: { lastCommit: get('lastCommit'), belieflog: get('belieflog') },
  }};
  process.stdout.write(handoff.pickupPrompt(assembled) + '\n');
  return 0;
}

function cmdDocsetCmp(args) {
  const [, a, b] = args._;
  if (!a || !b) throw new Error('usage: docset-cmp <a> <b>');
  const c = compareDocset(a, b);
  out({ a, b, cmp: c }, String(c), args.flags.json);
  return 0;
}

function localBank() { return process.env.GERMINATE_LOCAL || '_SEEDS'; }
function globalBank() { return process.env.GERMINATE_GLOBAL || path.join(os.homedir(), '.germinate', 'seeds'); }

function cmdSeed(args) {
  // germinate seed [sub] ...  — mint / lint
  const sub = args._[1];
  const f = args.flags;
  if (sub === 'lint') {
    const file = args._[2];
    if (!file || !fs.existsSync(file)) throw new Error('usage: seed lint <seed.md>');
    const r = seedlib.lintSeed(fs.readFileSync(file, 'utf8'));
    let human = r.ok ? 'lint OK — safe to publish.' : 'lint WARNINGS:';
    for (const w of r.warnings) human += `\n  ! ${w}`;
    out(Object.assign({ file }, r), human, f.json);
    return r.ok ? 0 : 1;
  }
  // mint a seed file (minimal: content + soil + antipatterns + provenance)
  const list = (v) => v === undefined ? [] : String(v).split(',').map((s) => s.trim()).filter(Boolean);
  const soil = list(f.soil);
  if (soil.length === 0) throw new Error('seed requires --soil <a,b,...> (the context where it thrives; also routes the bank)');
  const id = f.id || (f.title ? String(f.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : `seed-${soil[0].replace(/[^a-z0-9]+/gi, '-')}`);
  const fmLines = ['---', 'kind: seed', 'schema_version: 1', `id: ${id}`];
  if (f.type) fmLines.push(`seed_type: ${f.type}`);
  fmLines.push('soil:'); soil.forEach((s) => fmLines.push(`  - ${s}`));
  const anti = list(f.antipatterns);
  fmLines.push('antipatterns:'); anti.forEach((s) => fmLines.push(`  - ${s}`));
  if (f.tags) { fmLines.push('tags:'); list(f.tags).forEach((s) => fmLines.push(`  - ${s}`)); }
  if (f.global) fmLines.push('global: true');
  fmLines.push('provenance:');
  fmLines.push(`  minted_from: ${f.provenance || 'germinate seed CLI'}`);
  const { git } = require('./git');
  const commit = git(['rev-parse', '--short', 'HEAD'], process.cwd());
  if (commit) fmLines.push(`  commit: ${commit}`);
  const body = f.content || (f.title ? `# ${f.title}\n\n(seed body — replace with the durable insight)\n` : '(seed body)\n');
  const parents = list(f.parent);
  const marker = seedlib.computeMarker(id, soil, body);
  fmLines.push('lineage:');
  fmLines.push(`  marker: ${marker}`);
  fmLines.push(`  parents: [${parents.join(', ')}]`);
  fmLines.push('---', '');
  const outFile = f.out || path.join(localBank(), `${id}.md`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, fmLines.join('\n') + '\n' + body);
  out({ wrote: outFile, id, marker, parents }, `minted seed: ${outFile} (id=${id}, marker=${marker}${parents.length ? ', parents=' + parents.join(',') : ''})`, f.json);
  return 0;
}

function cmdPlant(args) {
  const file = args._[1];
  const f = args.flags;
  if (!file || !fs.existsSync(file)) throw new Error('usage: plant <seed.md> [--global]');
  const { frontmatter } = seedlib.parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const goGlobal = f.global || frontmatter.global;
  if (goGlobal) {
    const lint = seedlib.lintSeed(fs.readFileSync(file, 'utf8'));
    if (!lint.ok && !f.force) {
      let human = 'refusing to plant to the GLOBAL bank — lint warnings (use --force to override, or redact):';
      for (const w of lint.warnings) human += `\n  ! ${w}`;
      out({ ok: false, warnings: lint.warnings }, human, f.json);
      return 1;
    }
  }
  const dest = goGlobal ? globalBank() : localBank();
  fs.mkdirSync(dest, { recursive: true });
  const to = path.join(dest, path.basename(file));
  fs.copyFileSync(file, to);
  out({ planted: to, bank: goGlobal ? 'global' : 'local' }, `planted → ${goGlobal ? 'global' : 'local'} bank: ${to}`, f.json);
  return 0;
}

function cmdSprout(args) {
  const f = args.flags;
  const res = seedlib.sprout(
    { localDir: f.local || localBank(), globalDir: f.global && typeof f.global === 'string' ? f.global : globalBank() },
    { contextStr: f.context || '', cwd: process.cwd(), trace: f.trace, includeGlobal: !!f.global }
  );
  if (f.json) { out(res, '', true); return 0; }
  let human = '';
  if (res.surfaced.length === 0 && res.suppressed.length === 0 && res.stale.length === 0) {
    human = 'winter — no ripe seeds for this context. (Plant your first seed: `germinate seed --soil <ctx> --out _SEEDS/x.md`)';
  } else {
    human += `SURFACED (${res.surfaced.length}):`;
    for (const s of res.surfaced) human += `\n  ✔ ${s.id} [score ${s.score}] ← ${[...s.matchedSoil, ...s.matchedTags].join(', ')}${s.isGlobal ? ' (global)' : ''}`;
    if (res.stale.length) { human += `\n\nSTALE (${res.stale.length}) — matched but soil path vanished:`; for (const s of res.stale) human += `\n  ⚠ ${s.id} — dead path: ${s.stalePaths.join(', ')}`; }
    if (res.suppressed.length) { human += `\n\nSUPPRESSED (${res.suppressed.length}) — antipattern vetoed:`; for (const s of res.suppressed) human += `\n  ✖ ${s.id} — vetoed by: ${s.suppressedBy.join(', ')}`; }
  }
  if (res.shadowed.length) human += `\n\n(shadowed global seeds overridden by local: ${res.shadowed.join(', ')})`;
  if (f.all && res.dormant.length) { human += `\n\nDORMANT (${res.dormant.length}):`; for (const s of res.dormant) human += `\n  · ${s.id}`; }
  out(res, human, false);
  return 0;
}

function cmdInit(args) {
  const f = args.flags;
  const docset = f.docset || (new Date().toISOString().slice(0, 10) + '-init.1');
  const trace = f.trace || path.basename(process.cwd());
  const manifestPath = f.manifest || 'manifest.json';
  const belieflogPath = f.belieflog || 'belieflog.jsonl';
  const wrote = [];

  if (!fs.existsSync(manifestPath) || f.force) {
    const starter = {
      docsetVersion: docset,
      canonicalBranch: 'main',
      surfaces: [
        { id: 'S1', kind: 'canonical', path: belieflogPath, role: 'belief-log SSOT', docset },
      ],
    };
    fs.writeFileSync(manifestPath, JSON.stringify(starter, null, 2) + '\n');
    wrote.push(manifestPath);
  }
  if (!fs.existsSync(belieflogPath) || f.force) {
    belieflog.append(belieflogPath, {
      trace, span: '_meta', kind: 'trace.open',
      note: 'Belief log initialized by `germinate init`. Append-only, OTel-shaped. One belief lifetime per span; correct with belief.update/close, never by editing prior lines.',
    });
    wrote.push(belieflogPath);
  }
  const cfgPath = '.germinate.json';
  if (!fs.existsSync(cfgPath) || f.force) {
    fs.writeFileSync(cfgPath, JSON.stringify({ manifest: manifestPath, belieflog: belieflogPath, docsetVersion: docset }, null, 2) + '\n');
    wrote.push(cfgPath);
  }

  const prompt = `You are starting a fresh project primed by germinate.\n\n` +
    `Substrate in place:\n` +
    `  - manifest: ${manifestPath} (register every surface here; canonical=git-tracked SSOT, projection=advisory)\n` +
    `  - belief-log: ${belieflogPath} (append understanding as it forms — belief.open/update with confidence+risk+evidence)\n` +
    `  - config: ${cfgPath}\n\n` +
    `Discipline from turn one:\n` +
    `  1. Record beliefs as they form (not just conclusions): germinate belief append ${belieflogPath} --kind belief.open --trace ${trace} --span <thread> --belief "…" --confidence <0..1> --risk <0..1>\n` +
    `  2. Register new surfaces in ${manifestPath}; run \`germinate drift-check\` before trusting any projection.\n` +
    `  3. At session end: \`germinate compact --out SESSION-HANDOFF.md\`.\n` +
    `Set docset '${docset}' to a real YYYY-MM-DD-<phase>.<n> on first real change.\n`;

  if (f.json) { out({ wrote, prompt }, '', true); return 0; }
  process.stdout.write((wrote.length ? `initialized: ${wrote.join(', ')}\n\n` : 'already initialized (use --force to overwrite)\n\n') + prompt);
  process.stdout.write(`\nSet a real docset (YYYY-MM-DD-<phase>.<n>) in ${manifestPath} on first real change; the placeholder '${docset}' is valid but generic.\n`);
  return 0;
}

function cmdInstallHooks(args) {
  const { git } = require('./git');
  const top = git(['rev-parse', '--show-toplevel'], process.cwd());
  if (!top) throw new Error('not inside a git repository');
  const hookPath = path.join(top, '.git', 'hooks', 'pre-push');
  const hook = `#!/bin/sh\n# installed by germinate — serializability guard\nexec germinate serializability --strict\n`;
  fs.writeFileSync(hookPath, hook, { mode: 0o755 });
  out({ installed: hookPath }, `installed pre-push hook: ${hookPath}`, args.flags.json);
  return 0;
}

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  const sub = args._[1];
  try {
    switch (cmd) {
      case 'belief':
        if (sub === 'validate') return cmdBeliefValidate(args);
        if (sub === 'append') return cmdBeliefAppend(args);
        throw new Error('usage: belief validate|append ...');
      case 'drift-check': return cmdDriftCheck(args);
      case 'serializability': return cmdSerializability(args);
      case 'compact': return cmdCompact(args);
      case 'pickup': return cmdPickup(args);
      case 'docset-cmp': return cmdDocsetCmp(args);
      case 'seed': return cmdSeed(args);
      case 'plant': return cmdPlant(args);
      case 'sprout': return cmdSprout(args);
      case 'init': return cmdInit(args);
      case 'install-hooks': return cmdInstallHooks(args);
      case 'version': case '--version': process.stdout.write(VERSION + '\n'); return 0;
      case 'help': case '--help': case undefined: process.stdout.write(HELP); return 0;
      default: process.stderr.write(`unknown command: ${cmd}\n\n` + HELP); return 2;
    }
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    return 1;
  }
}

module.exports = { main, parseArgs };
