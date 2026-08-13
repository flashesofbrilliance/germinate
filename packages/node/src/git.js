'use strict';
// Serializability check. SPEC.md §6. Git is the serializer for tracked files;
// out-of-band surfaces are advisory. Surface that gap.

const { execFileSync } = require('child_process');
const path = require('path');

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
}

function isTracked(cwd, filePath) {
  const out = git(['ls-files', '--error-unmatch', filePath], cwd);
  return out !== null;
}

// Returns { forcePushRisk, behindBy, aheadBy, untrackedShared: [ids], danglingProjections: [ids], warnings: [] }.
function serializabilityCheck(manifest, cwd) {
  const warnings = [];
  const toplevel = git(['rev-parse', '--show-toplevel'], cwd);
  const inRepo = toplevel !== null;

  // 1. Force-push risk: are we behind upstream?
  let forcePushRisk = false, behindBy = 0, aheadBy = 0;
  if (inRepo) {
    const counts = git(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], cwd);
    if (counts) {
      const [ahead, behind] = counts.split(/\s+/).map((x) => parseInt(x, 10));
      aheadBy = ahead || 0; behindBy = behind || 0;
      if (behindBy > 0) {
        forcePushRisk = true;
        warnings.push(`branch is behind upstream by ${behindBy} commit(s): a push would need --force and could drop commits (lost-update hazard).`);
      }
    } else {
      warnings.push('no upstream configured for the current branch; cannot assess force-push risk.');
    }
  } else {
    warnings.push('not inside a git repository; the serialized surface has no lock at all here.');
  }

  // 2. Untracked shared state: manifest canonical paths not tracked by git.
  const untrackedShared = [];
  const danglingProjections = [];
  const base = toplevel || cwd;
  for (const s of (manifest.surfaces || [])) {
    if (s.kind === 'canonical' && s.path) {
      const abs = path.resolve(base, s.path);
      const rel = path.relative(base, abs);
      if (!inRepo || !isTracked(base, rel)) {
        untrackedShared.push(s.id);
        warnings.push(`surface ${s.id} (${s.path}) is a canonical SSOT but is NOT git-tracked: git will not protect it from lost updates.`);
      }
    }
    if (s.kind === 'projection' && (!s.source || s.source.length === 0)) {
      danglingProjections.push(s.id);
      warnings.push(`projection ${s.id} has no source[]: it is an advisory surface with no canonical origin to re-render from.`);
    }
  }

  return { inRepo, forcePushRisk, behindBy, aheadBy, untrackedShared, danglingProjections, warnings };
}

module.exports = { serializabilityCheck, git, isTracked };
