#!/usr/bin/env node
// Two agents (Claude Code and Kiro) may work on separate task branches at once. Before taking a
// DEC number, a PRD version, a migration number or a CONTEXT journal row, run:
//   node specs/tools/next-numbers.mjs
// It reads main and every local branch (git objects only, nothing is written) and prints the next
// free number of each kind, plus the branch that holds the highest one so far.
import { execFileSync } from 'node:child_process';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const show = (ref, path) => {
  try {
    return git('show', `${ref}:${path}`);
  } catch {
    return '';
  }
};

const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/heads')
  .split('\n')
  .filter(Boolean);

const best = { dec: [0, ''], version: [0, ''], migration: [0, ''], row: [0, ''] };
const keep = (key, value, ref) => {
  if (value > best[key][0]) best[key] = [value, ref];
};

for (const ref of branches) {
  for (const match of show(ref, 'PRD.md').matchAll(/^\| DEC-(\d+) \|/gm)) {
    keep('dec', Number(match[1]), ref);
  }
  for (const match of show(ref, 'docs/prd/history.md').matchAll(/^v2\.(\d+) \(/gm)) {
    keep('version', Number(match[1]), ref);
  }
  for (const match of show(ref, 'specs/CONTEXT.md').matchAll(
    /^\| (\d+) \| \d{4}-\d{2}-\d{2} \|/gm,
  )) {
    keep('row', Number(match[1]), ref);
  }
  let migrations = '';
  try {
    migrations = git('ls-tree', '--name-only', `${ref}:apps/api/migrations`);
  } catch {
    migrations = '';
  }
  for (const match of migrations.matchAll(/^(\d{4})_/gm)) keep('migration', Number(match[1]), ref);
}

const line = (label, [value, ref], next) =>
  `${label.padEnd(12)} next ${next}   (highest so far on ${ref || 'no branch'})`;

console.log(`Branches read: ${branches.length}`);
console.log(line('Decision', best.dec, `DEC-${best.dec[0] + 1}`));
console.log(line('PRD version', best.version, `v2.${best.version[0] + 1}`));
console.log(line('Migration', best.migration, String(best.migration[0] + 1).padStart(4, '0')));
console.log(line('CONTEXT row', best.row, String(best.row[0] + 1)));
// A task branch is a claim while its task is not yet done on main (squash merges leave old
// branches behind, so "not merged" alone would list finished work).
const doneOnMain = new Set(
  [...show('main', 'specs/tools/tasks.source.mjs').matchAll(/\{ id: 'TASK-(\d{3})',[^\n]*?\bdone: true/g)].map(
    (match) => match[1],
  ),
);
const open = branches.filter((b) => {
  const task = /task(\d{3})/.exec(b)?.[1];
  return task !== undefined && !doneOnMain.has(task);
});
console.log('Claimed tasks (task branches not done on main):', open.join(', ') || 'none');
