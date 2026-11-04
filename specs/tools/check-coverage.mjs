#!/usr/bin/env node
// PRD → spec coverage check. Reads the PRD files directly and fails when anything
// Release 1 must build is missing from specs/tasks.md (or, for decisions, from
// specs/requirements.md). Run: node specs/tools/check-coverage.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const areaDir = 'docs/prd/areas';
const areas = readdirSync(join(root, areaDir)).filter((f) => f.endsWith('.md')).map((f) => read(join(areaDir, f)));
const prd = read('PRD.md');
const ui = read('docs/prd/ui.md');
const actions = read('docs/prd/ui-action-map.md');
const flows = read('docs/prd/flows.md');
const data = read('docs/prd/data-model.md');
const tasks = read('specs/tasks.md');
const reqIndex = read('specs/requirements.md') + read('specs/decision-index.md');
const artifactHtml = readdirSync(join(root, 'Design Artifact'), { recursive: true })
  .filter((f) => String(f).endsWith('.html'))
  .map((f) => read(join('Design Artifact', String(f))))
  .join('\n');

// Partly-P0 requirements: their priority column says P1 but a Release 1 part exists.
const PARTLY_P0 = new Set(['REQ-NTF-002']); // push for Driver, FC, Mechanic, System Admin (DEC-98)
// Deferred with the PRD's own reason; never silently extended.
const DEFERRED_FLOWS = new Set(['FLW-APR-07']); // Supervisor/GM mobile, P1 (REQ-MOB-005)
const DEFERRED_TABLES = new Map([
  ['ai_configurations', 'REQ-AI-002 (P1)'],
  ['ai_query_logs', 'REQ-AI-003 (P1)'],
  ['tyre_min_levels', 'REQ-TYR-015 (P1)'],
  ['notification_mutes', 'REQ-NTF-003 (P1), DEC-100'],
]);

const has = (text, id) => new RegExp(`(^|[^A-Za-z0-9_-])${id.replace(/[-]/g, '\\-')}($|[^A-Za-z0-9_])`).test(text);
const gaps = {};
const gap = (kind, id, note = '') => (gaps[kind] ??= []).push(note ? `${id} (${note})` : id);

// Requirements and acceptance criteria
const reqPriority = new Map();
const acVerifies = new Map();
for (const a of areas) {
  for (const m of a.matchAll(/^\| (REQ-[A-Z]+-\d+) \| (P\d) \|/gm)) reqPriority.set(m[1], m[2]);
  for (const m of a.matchAll(/^\| (AC-[A-Z]+-\d+) \| ([^|]+) \|/gm)) acVerifies.set(m[1], m[2]);
}
const requiredReq = [...reqPriority].filter(([id, p]) => p === 'P0' || PARTLY_P0.has(id)).map(([id]) => id);
for (const id of requiredReq) if (!has(tasks, id)) gap('REQ', id);
for (const [ac, verifies] of acVerifies) {
  const ids = verifies.match(/(REQ|BR)-[A-Z]*-?\d+/g) ?? [];
  const needed = ids.some((r) => r.startsWith('BR') || reqPriority.get(r) === 'P0' || PARTLY_P0.has(r) || !reqPriority.has(r));
  if (needed && !has(tasks, ac)) gap('AC', ac, verifies.trim());
}

// Rules, NFRs, state machines, transactions
for (const m of prd.matchAll(/^\| (BR-\d+) \|/gm)) if (!has(tasks, m[1])) gap('BR', m[1]);
for (const m of prd.matchAll(/^\| (NFR-\d+) \|/gm)) if (!has(tasks, m[1])) gap('NFR', m[1]);
for (const id of new Set([...prd.matchAll(/\b(SM-[A-Z]+)\b/g)].map((m) => m[1]))) if (!has(tasks, id)) gap('SM', id);
for (const m of data.matchAll(/^\| (TX-\d+) \|/gm)) if (!has(tasks, m[1])) gap('TX', m[1]);

// Flows
for (const m of flows.matchAll(/\*\*(FLW-[A-Z]+-\d+)/g)) {
  if (!DEFERRED_FLOWS.has(m[1]) && !has(tasks, m[1])) gap('FLW', m[1]);
}

// Screens of the 7.3 inventory that are P0, and their artboard anchors
const inventory = ui.split('## 7.3')[1].split('\n## ')[0];
for (const m of inventory.matchAll(/^\| \[`?([A-Za-z]+)`?\]\(<([^>]+)>\) \| [^|]* \| ([^|]+) \|/gm)) {
  const [, name, href, priority] = m;
  if (!priority.trim().startsWith('P0')) continue;
  if (!has(tasks, name)) gap('Screen', name, href.replace('../../', ''));
  if (!artifactHtml.includes(`id="${name}"`)) gap('Artboard missing in Design Artifact', name);
}

// Tables of §9
for (const m of data.matchAll(/CREATE TABLE ([a-z_]+)/g)) {
  if (!DEFERRED_TABLES.has(m[1]) && !has(tasks, m[1])) gap('Table', m[1]);
}

// UI controls, navigation rules, design-question decisions
for (const m of actions.matchAll(/^\| (C-\d+) \|/gm)) if (!has(tasks, m[1])) gap('Control', m[1]);
for (const id of new Set([...(ui + actions + prd).matchAll(/\b((NAV|DQ)-\d+)\b/g)].map((m) => m[1]))) {
  if (!has(tasks, id)) gap('NAV/DQ', id);
}

// Decisions: each active DEC must be placed in the decision index or a task
for (const m of prd.matchAll(/^\| (DEC-\d+) \|/gm)) if (!has(reqIndex, m[1]) && !has(tasks, m[1])) gap('DEC', m[1]);

// Task format: every code task names its sources, at least one ecc skill and a verify step
for (const block of tasks.split(/\n(?=- \[[ x]\] \*\*TASK-)/).slice(1)) {
  const id = block.match(/\*\*(TASK-\d+)\*\*/)[1];
  if (!/_Read_:/.test(block)) gap('Task without _Read_', id);
  if (!/_Skill_:.*ecc:/.test(block)) gap('Task without an ecc: skill', id);
  if (!/_Verify_:/.test(block)) gap('Task without _Verify_', id);
  if (/\b(REQ|AC)-[A-Z]+-\d+ to \d+/.test(block.split('\n')[0])) gap('Task with an ID range on its line', id);
}

// Task graph: every dependency exists and there is no cycle (a cycle means tasks wait forever).
const graph = new Map(tasks.split(/\n(?=- \[[ x]\] \*\*TASK-)/).slice(1).map((b) => [
  b.match(/\*\*(TASK-\d+)\*\*/)[1],
  b.match(/_Depends_: ([^\n]+)/)?.[1].match(/TASK-\d+/g) ?? [],
]));
const state = new Map();
const visit = (id, path) => {
  if (state.get(id) === 'done') return;
  if (state.get(id) === 'open') { gap('Dependency cycle', [...path, id].join(' → ')); return; }
  state.set(id, 'open');
  for (const d of graph.get(id) ?? []) {
    if (!graph.has(d)) gap('Unknown dependency', `${id} → ${d}`);
    else {
      const phase = (x) => Math.floor(Number(x.slice(5)) / 100);
      if (phase(d) > phase(id)) gap('Dependency on a later phase', `${id} → ${d}`);
      visit(d, [...path, id]);
    }
  }
  state.set(id, 'done');
};
for (const id of graph.keys()) visit(id, []);

// Dependency safety: a table exists before it is used, an AC waits for the tasks that build
// its requirements, an extension waits for the task it extends, every touched screen is ordered.
const source = await import(new URL('./tasks.source.mjs', import.meta.url).href);
const closure = new Map();
const before = (id) => {
  if (closure.has(id)) return closure.get(id);
  const set = new Set();
  closure.set(id, set);
  for (const d of graph.get(id) ?? []) { set.add(d); for (const x of before(d)) set.add(x); }
  return set;
};
const creator = new Map();
for (const t of source.TASKS) for (const tb of t.tables ?? []) if (!creator.has(tb)) creator.set(tb, t.id);
const reqBuilders = new Map();
for (const t of source.TASKS) for (const r of t.req ?? []) reqBuilders.set(r, [...(reqBuilders.get(r) ?? []), t.id]);
const sourceById = new Map(source.TASKS.map((t) => [t.id, t]));
for (const block of tasks.split(/\n(?=- \[[ x]\] \*\*TASK-)/).slice(1)) {
  const id = block.match(/\*\*(TASK-\d+)\*\*/)[1];
  const field = (name) => block.split('\n').find((l) => l.startsWith(`  - _${name}`))?.split('_: ').slice(1).join('_: ') ?? '';
  const extended = sourceById.get(id)?.extendedBy ?? {};
  for (const m of field('Data').matchAll(/`([a-z_]+)`/g)) {
    const tb = m[1];
    const c = creator.get(tb);
    if (!c) gap('Table that no task creates', `${tb} (used by ${id})`);
    else if (c !== id && !before(id).has(c) && !extended[tb]) gap('Table used before it is created', `${id} uses ${tb} from ${c}`);
    if (extended[tb] && !before(extended[tb]).has(id)) gap('Extension without order', `${extended[tb]} extends ${tb} of ${id}`);
  }
  for (const ac of field('Acceptance').match(/AC-[A-Z]+-\d+/g) ?? []) {
    for (const r of acVerifies.get(ac)?.match(/REQ-[A-Z]+-\d+/g) ?? []) {
      const b = reqBuilders.get(r) ?? [];
      if (b.length && !b.some((x) => x === id || before(id).has(x))) gap('AC tested before its requirement is built', `${id}: ${ac} needs ${b.join('/')} (${r})`);
    }
  }
  for (const m of field('Screens touched').matchAll(/\[`([A-Za-z]+)`\]\([^)]*\) \(([^)]*NO ORDER)\)/g)) {
    gap('Touched screen with no order to its builder', `${id}: ${m[1]} (${m[2].replace('; NO ORDER', '')})`);
  }
}

// One name (DEC-106): the former name survives only in docs/prd/history.md, in the spec, the artboards,
// the plan and the code alike. A retired-name sentence is allowed only in PRD 0.7 and the CLAUDE.md block.
const RETIRED = /\bWOs?\b|\bWOD\b|\bWork Orders?\b|\bwork orders?\b|\bwork[_-]orders?|\bWorkOrder|\bwo_\w|_wo_|_wo\b|\bwo\.[a-z*]|\bwo\b|\bwocard|[a-z_]WO\b|\bWO[A-Z][a-z]|\b(REQ|AC)-WOD?-|\bSM-WO\b/;
const namedFiles = (dir, pattern) => {
  try {
    return readdirSync(join(root, dir), { recursive: true })
      .map(String)
      .filter((f) => !f.includes('node_modules') && pattern.test(f))
      .map((f) => join(dir, f));
  } catch {
    return []; // the folder does not exist yet
  }
};
const nameSources = [
  'DESIGN.md', 'PRODUCT.md', 'README.md', 'specs/requirements.md', 'specs/design.md', 'specs/tdd-user-journeys.md',
  'specs/CONTEXT.md', 'specs/tasks.md', 'specs/acceptance-tests.md', 'specs/decision-index.md', 'specs/tools/tasks.source.mjs',
  ...namedFiles('docs/prd', /\.md$/).filter((f) => !/history\.md$/.test(f)),
  ...namedFiles('docs/adr', /\.md$/),
  ...namedFiles('Design Artifact', /\.(html|js|css)$/),
  ...namedFiles('apps', /\.(ts|tsx|js|css|sql|json)$/),
  ...namedFiles('packages', /\.(ts|tsx|js|css|sql|json)$/),
];
const checkName = (name, text) => {
  text.split('\n').forEach((line, i) => {
    const hit = line.match(RETIRED);
    if (hit) gap('Retired name outside docs/prd/history.md (DEC-106)', name + ':' + (i + 1) + ' "' + hit[0] + '"');
  });
};
for (const f of nameSources) checkName(f, read(f));
checkName('PRD.md', prd.replace(/### 0\.7[\s\S]*?\n## 1\./, '## 1.'));
checkName('CLAUDE.md', read('CLAUDE.md').replace(/ONE ENTITY, ONE NAME[\s\S]*?nothing to map\.\n/, ''));
for (const f of namedFiles('.', /(^|[\\/])[^\\/]*(WO[A-Z.]|WorkOrder|work-order|-wod?\.)[^\\/]*$/).filter((x) => !x.startsWith('.git') && !x.startsWith('.claude'))) {
  gap('Retired name outside docs/prd/history.md (DEC-106)', 'file name: ' + f);
}
if (!prd.includes('### 0.7 Naming: one entity, one name')) gap('Retired name outside docs/prd/history.md (DEC-106)', 'PRD.md lost section 0.7');
if (!read('CLAUDE.md').includes('ONE ENTITY, ONE NAME')) gap('Retired name outside docs/prd/history.md (DEC-106)', 'CLAUDE.md lost the ONE ENTITY block');

// Every AC is its own test source: it must be in the acceptance test catalogue.
const catalogue = read('specs/acceptance-tests.md');
for (const ac of acVerifies.keys()) if (!catalogue.includes(`| ${ac} |`)) gap('AC missing from specs/acceptance-tests.md', ac);

// --tests: once code exists, every AC of a finished task needs a test named with its ID.
if (process.argv.includes('--tests')) {
  const testFiles = [];
  const walk = (dir) => {
    let entries = [];
    try { entries = readdirSync(join(root, dir), { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(test|spec)\.(ts|tsx)$/.test(e.name)) testFiles.push(read(p));
    }
  };
  walk('apps');
  walk('packages');
  const testText = testFiles.join('\n');
  const doneTasks = new Set([...tasks.matchAll(/^- \[x\] \*\*(TASK-\d+)\*\*/gm)].map((m) => m[1]));
  for (const line of catalogue.split('\n')) {
    const m = line.match(/^\| (AC-[A-Z]+-\d+) \|.*\| (TASK-\d+) \|/);
    if (!m || !doneTasks.has(m[2])) continue;
    if (!new RegExp(`(it|test|describe)(\\.each\\([^)]*\\))?\\(\\s*['\`"]${m[1]}\\b`).test(testText)) gap('AC without a named test', m[1], m[2]);
  }
  console.log(`--tests: ${testFiles.length} test files scanned, ${doneTasks.size} finished tasks`);
}

const kinds = Object.keys(gaps);
console.log(`Required: ${requiredReq.length} REQ, ${acVerifies.size} AC, ${[...data.matchAll(/CREATE TABLE/g)].length - DEFERRED_TABLES.size} tables`);
if (!kinds.length) {
  console.log('Coverage OK: every Release 1 PRD item is placed in specs/tasks.md.');
  process.exit(0);
}
for (const k of kinds) console.log(`\n${k} (${gaps[k].length}):\n  ${gaps[k].join('\n  ')}`);
process.exit(1);
