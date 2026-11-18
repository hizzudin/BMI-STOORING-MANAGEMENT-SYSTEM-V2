#!/usr/bin/env node
// Keeps Kiro's skills (.kiro/skills) an exact copy of the project skills (.claude/skills), and checks
// that every skill the project names exists. The owner chose a copy for Kiro plus this script.
//
//   node specs/tools/sync-kiro-skills.mjs          copy .claude/skills to .kiro/skills
//   node specs/tools/sync-kiro-skills.mjs --check  exit 1 when a named skill is missing, or the copy differs
//
// The one exclusion: the prebuilt binaries of a skill's scripts (impeccable/scripts/bin/). They are
// large, and Kiro runs them from .claude/skills; the steering file .kiro/steering/skills.md says so.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = join(root, '.claude', 'skills');
const TARGET = join(root, '.kiro', 'skills');
const EXCLUDED = [/^impeccable\/scripts\/bin\//];

/** Where the project names its skills (CLAUDE.md, the workflow, the task list). */
const NAMING_FILES = ['CLAUDE.md', 'WORKFLOW_STANDARDS.md', 'AGENT_GUIDE.md', 'specs/tasks.md'];
const PREFIXED = /\b(?:ecc|superpowers|andrej-karpathy-skills):([a-z0-9]+(?:-[a-z0-9]+)*)/g;
const SKILL_LINE = /_Skill_:\s*(.+)$/;
/** Plain names inside the skill lists of CLAUDE.md and WORKFLOW_STANDARDS.md §7. */
const LIST_LINE = /^\s*(?:-\s*)?[A-Za-z][A-Za-z ()/-]*:?\s{1,}((?:[a-z][a-z0-9:-]*,\s*)+[a-z][a-z0-9:-]*)\s*$/;

const toPosix = (path) => path.split(sep).join('/');
const excluded = (path) => EXCLUDED.some((pattern) => pattern.test(path));
const plain = (name) => name.replace(/^(?:ecc|superpowers|andrej-karpathy-skills):/, '');

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function relativeFiles(dir) {
  return filesUnder(dir)
    .map((path) => toPosix(relative(dir, path)))
    .filter((path) => !excluded(path))
    .sort();
}

/** Text compares without line-ending noise (git stores LF; a Windows checkout may hold CRLF). */
function sameContent(a, b) {
  const left = readFileSync(a);
  const right = readFileSync(b);
  if (left.equals(right)) return true;
  const text = (buffer) => buffer.toString('utf8').replace(/\r\n/g, '\n');
  return !left.includes(0) && !right.includes(0) && text(left) === text(right);
}

function namedSkills() {
  const names = new Set();
  for (const file of NAMING_FILES) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const match of text.matchAll(PREFIXED)) names.add(match[1]);
    for (const line of text.split('\n')) {
      const skills = SKILL_LINE.exec(line)?.[1] ?? LIST_LINE.exec(line)?.[1];
      if (!skills) continue;
      for (const part of skills.split(',')) {
        const name = plain(part.trim());
        // Skill names are hyphenated, except impeccable; this keeps ordinary prose out.
        if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(name) || name === 'impeccable') names.add(name);
      }
    }
  }
  // CLAUDE.md names typescript-pro inside a parenthesis: "(+ typescript-pro)".
  if (/\+ typescript-pro/.test(readFileSync(join(root, 'CLAUDE.md'), 'utf8'))) names.add('typescript-pro');
  return [...names].sort();
}

const check = process.argv.includes('--check');
const problems = [];

const skillFolders = readdirSync(SOURCE).filter((name) => statSync(join(SOURCE, name)).isDirectory());
for (const name of namedSkills()) {
  if (!skillFolders.includes(name)) problems.push(`named but missing in .claude/skills: ${name}`);
}
for (const name of skillFolders) {
  if (!existsSync(join(SOURCE, name, 'SKILL.md'))) problems.push(`no SKILL.md: .claude/skills/${name}`);
}

const source = relativeFiles(SOURCE);
const target = relativeFiles(TARGET);

if (check) {
  for (const path of source) {
    const copy = join(TARGET, path);
    if (!existsSync(copy)) problems.push(`missing in .kiro/skills: ${path}`);
    else if (!sameContent(join(SOURCE, path), copy)) problems.push(`differs in .kiro/skills: ${path}`);
  }
  for (const path of target) {
    if (!source.includes(path)) problems.push(`not in .claude/skills (remove it): .kiro/skills/${path}`);
  }
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    console.error(`\n${problems.length} problem(s). Run: node specs/tools/sync-kiro-skills.mjs`);
    process.exit(1);
  }
  console.log(`Kiro skills OK: ${skillFolders.length} skills, ${source.length} files match .claude/skills`);
} else {
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    process.exit(1);
  }
  for (const path of target) {
    if (!source.includes(path)) rmSync(join(TARGET, path));
  }
  for (const path of source) {
    const to = join(TARGET, path);
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(join(SOURCE, path), to);
  }
  console.log(`Copied ${source.length} files of ${skillFolders.length} skills to .kiro/skills`);
}
