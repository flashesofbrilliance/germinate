'use strict';
// Handoff compaction. SPEC.md §5. Assemble the coal->diamond seed + emit a pickup prompt.

const fs = require('fs');
const { git } = require('./git');

// Minimal YAML front-matter emitter (strings, arrays, nested one level) — avoids a YAML dep.
function emitYaml(obj, indent = 0) {
  const pad = '  '.repeat(indent);
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      out += `${pad}${k}:\n`;
      for (const item of v) out += `${pad}  - ${yamlScalar(item)}\n`;
    } else if (typeof v === 'object') {
      out += `${pad}${k}:\n${emitYaml(v, indent + 1)}`;
    } else {
      out += `${pad}${k}: ${yamlScalar(v)}\n`;
    }
  }
  return out;
}
function yamlScalar(v) {
  if (typeof v === 'string' && (/[:#\-{}\[\]]/.test(v) || v === '')) return JSON.stringify(v);
  return String(v);
}

// Read the tail of a belief-log: open beliefs and the last N updates.
function belieflogTail(logPath, { openOnly = true } = {}) {
  if (!logPath || !fs.existsSync(logPath)) return { openBeliefs: [], lastLines: [] };
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);
  // latest status per span
  const bySpan = {};
  for (const l of lines) {
    if (l.span === '_meta') continue;
    bySpan[l.span] = l;
  }
  const openBeliefs = Object.values(bySpan).filter((l) => !l.status || l.status === 'OPEN' || l.status === 'DEFERRED');
  return { openBeliefs, lastLines: lines.slice(-5) };
}

// Assemble a handoff object. opts: { title, docset, startsAt, openThreads, blocking, belieflog, manifest, cwd }.
function assemble(opts) {
  const cwd = opts.cwd || process.cwd();
  const lastCommit = git(['rev-parse', '--short', 'HEAD'], cwd) || null;
  const tail = belieflogTail(opts.belieflog);
  const openThreads = opts.openThreads && opts.openThreads.length
    ? opts.openThreads
    : tail.openBeliefs.map((b) => `${b.span}: ${b.belief || b.to || '(open)'}`);

  const frontMatter = {
    handoffVersion: '0.1.0',
    title: opts.title || 'SESSION HANDOFF',
    docset: opts.docset,
    head: {
      startsAt: opts.startsAt || 'TODO: where the next session starts',
      openThreads: openThreads,
      blocking: opts.blocking || 'NONE',
    },
    tail: {
      lastCommit: lastCommit || undefined,
      belieflog: opts.belieflog || undefined,
      manifest: opts.manifest || undefined,
      supersedes: opts.supersedes || undefined,
    },
  };
  return { frontMatter, tail };
}

// Render the handoff markdown.
function render(assembled, bodyExtra = '') {
  const { frontMatter, tail } = assembled;
  let md = `---\n${emitYaml(frontMatter)}---\n\n`;
  md += `# ${frontMatter.title}\n\n`;
  md += `## Head — where the next session starts\n\n`;
  md += `**Starts at:** ${frontMatter.head.startsAt}\n\n`;
  md += `**Blocking:** ${frontMatter.head.blocking}\n\n`;
  if (frontMatter.head.openThreads.length) {
    md += `**Open threads:**\n\n`;
    for (const t of frontMatter.head.openThreads) md += `- ${t}\n`;
    md += `\n`;
  }
  md += `## Tail — provenance / lineage\n\n`;
  if (frontMatter.tail.lastCommit) md += `- last commit: \`${frontMatter.tail.lastCommit}\`\n`;
  if (frontMatter.tail.belieflog) md += `- belief-log: \`${frontMatter.tail.belieflog}\` (${tail.lastLines.length ? 'last ' + tail.lastLines.length + ' events recorded' : 'empty'})\n`;
  if (frontMatter.tail.manifest) md += `- manifest: \`${frontMatter.tail.manifest}\`\n`;
  md += bodyExtra ? `\n${bodyExtra}\n` : '';
  return md;
}

// Emit a short, self-contained cold-start pickup prompt for the next agent.
function pickupPrompt(assembled) {
  const { frontMatter } = assembled;
  let p = `You are picking up a handoff (docset ${frontMatter.docset || 'unversioned'}).\n\n`;
  p += `START HERE: ${frontMatter.head.startsAt}\n`;
  p += `BLOCKING: ${frontMatter.head.blocking}\n`;
  if (frontMatter.head.openThreads.length) {
    p += `\nOpen threads (from the belief-log):\n`;
    for (const t of frontMatter.head.openThreads) p += `  - ${t}\n`;
  }
  const lineage = [];
  if (frontMatter.tail.lastCommit) lineage.push(`last commit ${frontMatter.tail.lastCommit}`);
  if (frontMatter.tail.belieflog) lineage.push(`belief-log at ${frontMatter.tail.belieflog}`);
  if (lineage.length) p += `\nLineage: ${lineage.join('; ')}`;
  p += `\nRead the manifest and run \`handoff-ledger drift-check\` before making changes.\n`;
  return p;
}

module.exports = { assemble, render, pickupPrompt, belieflogTail, emitYaml };
