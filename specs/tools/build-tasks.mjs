#!/usr/bin/env node
// Generates specs/tasks.md and specs/decision-index.md from specs/tools/tasks.source.mjs
// and the PRD files. Screens, tables, rules, acceptance criteria and sources of each task
// are taken from the PRD columns of its requirements, so a task cannot drift from the PRD.
// Run: node specs/tools/build-tasks.mjs   (then node specs/tools/check-coverage.mjs)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TASKS, PHASES, SKILLS, SECTION_TASKS, ACCEPTANCE_HOME, SCREEN_HOME } from './tasks.source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8').replace(/\r\n/g, '\n');
const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const uniq = (xs) => [...new Set(xs.filter(Boolean))];
const artifactPath = (href) => href.replace(/^(\.\.\/)+/, '');
const link = (name, path) => `[\`${name}\`](<../${path}>)`;

// ── PRD inventories ──────────────────────────────────────────────────────────
const dataModel = read('docs/prd/data-model.md');
const tableSection = new Map();
let section = '';
for (const line of dataModel.split('\n')) {
  const h = line.match(/^## (9\.\d+)/);
  if (h) section = h[1];
  const t = line.match(/CREATE TABLE ([a-z_]+)/);
  if (t) tableSection.set(t[1], section);
}

const reqs = new Map();
const acs = new Map();
const areaDir = 'docs/prd/areas';
for (const file of readdirSync(join(root, areaDir)).filter((f) => f.endsWith('.md'))) {
  const text = read(`${areaDir}/${file}`);
  for (const line of text.split('\n')) {
    if (/^\| REQ-[A-Z]+-\d+ \| P\d \|/.test(line)) {
      const [id, p, , scr = '', dat = '', rules = ''] = cells(line);
      reqs.set(id, {
        id, p, file: `${areaDir}/${file}`,
        screens: [...scr.matchAll(/\[`?([A-Za-z]+)`?\]\(<([^>]+)>\)/g)].map((m) => ({ name: m[1], path: artifactPath(m[2]) })),
        tables: uniq([...dat.matchAll(/`([a-z_]+)(\.[a-z_]+)?`/g)].map((m) => m[1]).filter((t) => tableSection.has(t))),
        rules: uniq([...rules.matchAll(/\b((BR|SM|TX|DEC|NFR|RL)-[A-Z0-9]+(-\d+)?)\b/g)].map((m) => m[1])),
      });
    }
    if (/^\| AC-[A-Z]+-\d+ \|/.test(line)) {
      const [id, verifies] = cells(line);
      acs.set(id, { id, verifies: verifies.match(/(REQ|BR)-[A-Z]*-?\d+/g) ?? [], file: `${areaDir}/${file}` });
    }
  }
}

const ui = read('docs/prd/ui.md');
const inventory = new Map();
for (const m of ui.split('## 7.3')[1].split('\n## ')[0].matchAll(/^\| \[`?([A-Za-z]+)`?\]\(<([^>]+)>\) \| [^|]* \| ([^|]+) \|/gm)) {
  inventory.set(m[1], { path: artifactPath(m[2]), p0: m[3].trim().startsWith('P0') });
}
const keyLayouts = new Set([...ui.split('## 7.4')[1].split('\n## ')[0].matchAll(/^\| \[?`?([A-Za-z]+)`?\]?/gm)].map((m) => m[1]));
const actionScreens = new Set([...read('docs/prd/ui-action-map.md').matchAll(/^\| \[`?([A-Za-z]+)`?\]\(/gm)].map((m) => m[1]));
const flowTitles = new Map([...read('docs/prd/flows.md').matchAll(/\*\*(FLW-[A-Z]+-\d+) ([^*]+)\*\*/g)].map((m) => [m[1], m[2].trim()]));
const decisions = [...read('PRD.md').matchAll(/^\| (DEC-\d+) \| (.+) \| ([^|]+) \|$/gm)].map((m) => ({ id: m[1], text: m[2], applies: m[3].trim() }));

// ── Derive each task ─────────────────────────────────────────────────────────
const unknown = [];
const derived = TASKS.map((t) => {
  const own = (t.req ?? []).map((id) => reqs.get(id) ?? (unknown.push(`${t.id}: ${id}`), null)).filter(Boolean);
  const extraIds = t.ids ?? [];
  const screenNames = uniq([...own.flatMap((r) => r.screens.map((s) => s.name)), ...(t.screens ?? [])])
    .filter((n) => inventory.get(n)?.p0);
  for (const n of t.screens ?? []) if (!inventory.has(n)) unknown.push(`${t.id}: screen ${n}`);
  const tables = uniq([...own.flatMap((r) => r.tables), ...(t.tables ?? [])]);
  for (const tb of t.tables ?? []) if (!tableSection.has(tb)) unknown.push(`${t.id}: table ${tb}`);
  const rules = uniq([...own.flatMap((r) => r.rules), ...extraIds.filter((i) => !i.startsWith('AC-'))]);
  const reqIds = own.map((r) => r.id);
  const acIds = uniq([
    ...[...acs.values()].filter((a) => a.verifies.some((v) => reqIds.includes(v))).map((a) => a.id),
    ...extraIds.filter((i) => i.startsWith('AC-')),
  ]);
  const skills = uniq((t.skills ?? []).flatMap((s) => SKILLS[s] ?? [s]));
  const read_ = uniq([
    ...own.map((r) => r.file),
    ...acIds.map((a) => acs.get(a)?.file),
  ]).map((f) => `\`${f}\` (${own.filter((r) => r.file === f).map((r) => r.id).join(', ') || 'acceptance criteria'})`);
  const sections = uniq(tables.map((tb) => tableSection.get(tb))).sort();
  if (sections.length) read_.push(`\`docs/prd/data-model.md\` §${sections.join(', §')} (${tables.join(', ')}) and §9.13 for the TX named in _Rules_`);
  if (rules.length) read_.push(`\`PRD.md\` for ${rules.filter((r) => /^(BR|SM|RL|DEC|NFR)-/.test(r)).join(', ') || 'the rules named'} (§2 roles, §3 machines, §5 rules, §8 NFRs, §11 decisions)`);
  if (screenNames.length) {
    read_.push(`\`docs/prd/ui.md\` §7.3 rows${screenNames.some((s) => keyLayouts.has(s)) ? ' and §7.4 key layouts' : ''} and §7.5–7.6 for ${screenNames.join(', ')}`);
    const mapped = screenNames.filter((s) => actionScreens.has(s));
    if (mapped.length) read_.push(`\`docs/prd/ui-action-map.md\`: every row of ${mapped.join(', ')} and the shared controls they cite`);
    read_.push('`DESIGN.md` and the artboards below (the visual target, DEC-96)');
  }
  if (t.flows?.length) read_.push(`\`docs/prd/flows.md\` ${t.flows.join(', ')} and \`specs/tdd-user-journeys.md\` for the same IDs`);
  if (!read_.length) read_.push('`PRD.md` sections named in _Scope_; `specs/design.md`');

  const verify = [];
  // The int and qa lines are added below, once acceptance criteria and screens have their final task.
  for (const f of t.flows ?? []) verify.push(`\`e2e ${f}\``);
  verify.push(...(t.verify ?? []));
  return { ...t, reqIds, screenNames, tables, rules, acIds, skills, read: read_, verifyLines: verify, sections };
});

// Move acceptance criteria to the task where they can pass (ACCEPTANCE_HOME).
const byId = new Map(derived.map((t) => [t.id, t]));
for (const [ac, [home]] of Object.entries(ACCEPTANCE_HOME)) {
  if (!acs.has(ac)) unknown.push(`ACCEPTANCE_HOME: ${ac}`);
  if (!byId.has(home)) unknown.push(`ACCEPTANCE_HOME: ${home}`);
  for (const t of derived) if (t.id !== home) t.acIds = t.acIds.filter((a) => a !== ac);
  const target = byId.get(home);
  if (target && !target.acIds.includes(ac)) target.acIds.push(ac);
}
// One owning task per screen (SCREEN_HOME, else the first task that names it).
const screenOwner = new Map();
for (const [s, home] of Object.entries(SCREEN_HOME)) {
  if (!inventory.has(s)) unknown.push(`SCREEN_HOME: ${s}`);
  const target = byId.get(home);
  if (!target) unknown.push(`SCREEN_HOME: ${home}`);
  else if (!target.screenNames.includes(s)) target.screenNames.push(s);
  screenOwner.set(s, home);
}
for (const t of derived) for (const s of t.screenNames) if (!screenOwner.has(s)) screenOwner.set(s, t.id);
const closure = new Map();
const before = (id) => {
  if (closure.has(id)) return closure.get(id);
  const set = new Set();
  closure.set(id, set);
  for (const d of byId.get(id)?.depends ?? []) { set.add(d); for (const x of before(d)) set.add(x); }
  return set;
};
// A touched screen is built earlier (extend and regression-check it), later (its builder shows
// what this task provides) or with no order between them (a plan error the checker reports).
const touchedLabel = (t, s) => {
  const owner = screenOwner.get(s);
  if (before(t.id).has(owner)) return `built in ${owner}; extend and regression-check it`;
  if (before(owner).has(t.id)) return `built later in ${owner}, which shows what this task provides`;
  return `${owner}; NO ORDER`;
};
for (const t of derived) {
  t.owned = t.screenNames.filter((s) => screenOwner.get(s) === t.id);
  t.touched = t.screenNames.filter((s) => screenOwner.get(s) !== t.id);
  const head = [];
  if (t.acIds.length) head.push(`\`int "${t.acIds.join('|')}"\``);
  t.verifyLines = [...head, ...t.verifyLines];
  if (t.owned.length) t.verifyLines.push(`\`qa\` ${t.owned.join(', ')} against their artboards`);
  const earlier = t.touched.filter((s) => before(t.id).has(screenOwner.get(s)));
  if (earlier.length) t.verifyLines.push(`regression check of ${earlier.join(', ')}`);
}

if (unknown.length) {
  console.error(`Unknown IDs in tasks.source.mjs:\n  ${unknown.join('\n  ')}`);
  process.exit(1);
}

// ── tasks.md ─────────────────────────────────────────────────────────────────
const out = [];
out.push(`# Tasks — BMI Stooring System v2

> **Generated** by \`node specs/tools/build-tasks.mjs\` from \`specs/tools/tasks.source.mjs\` and the PRD. Do not edit by hand: edit the source, regenerate, then run \`node specs/tools/check-coverage.mjs\`, which must print \`Coverage OK\`.
> Phase N = R1 step N (PRD §10); phase 0 = specs and scaffold. Code tasks (TASK-005 onward) start only when the product owner says the source files are ready (CONTEXT.md).

## How an agent works a task (PRD fidelity rules)

1. **The PRD is the specification; this file only points at it.** Before writing a test or a line of code, open every file on the task's \`_Read_\` line and read the full text of every ID on its checkbox line, \`_Acceptance_\` and \`_Rules_\`. A task title or scope sentence is never a substitute for the requirement text.
2. **Build all of it.** Every requirement, acceptance criterion, rule, field, control and state named for the task is built exactly as written. Nothing is reduced, merged, renamed, simplified or postponed without the product owner's written approval recorded in CONTEXT.md and the PRD updated first (CLAUDE.md divergence protocol). Nothing that is not in the PRD is added.
3. **The artboard is the visual target (DEC-96).** Every screen on \`_Screens_\` is built to look like its artboard in \`Design Artifact/\` (layout, regions, colours, type, spacing, shapes, icons, states, motion), re-created with the app's own components from DESIGN.md, never imported. Sample data and the \`?review\` strip are not built. Every control of that screen in \`ui-action-map.md\` is wired, including the shared C-* controls it cites. A control seen only in an artboard is not built: ask.
4. **Data exactly as §9.** Tables on \`_Data_\` are created or used exactly as \`data-model.md\` defines them (columns, types, CHECKs, triggers, indexes). The schema changes only through the PRD.
5. **Permissions from capabilities.** Menus, tabs and buttons come from \`GET /me\` and \`allowedActions\` (PRD §2.4, DEC-93), never from the role name.
6. **TDD from three sources.** Before any code, write tests from (a) every acceptance criterion on \`_Acceptance_\` (full text in its area file; catalogue \`specs/acceptance-tests.md\`), one or more tests each named by the AC ID; (b) every journey on \`_Journey_\` (\`specs/tdd-user-journeys.md\`), one E2E spec each named by the FLW ID; (c) every rule and transition on \`_Rules_\`. RED, then GREEN, then refactor (\`ecc:tdd-workflow\`). Load every skill on \`_Skill_\` and the always-on skills of design.md §12.
7. **Done means verified.** Run every \`_Verify_\` line and \`node specs/tools/check-coverage.mjs --tests\` (every AC of a finished task must have a test with its ID); compare each screen with its artboard side by side (\`ecc:browser-qa\`); write \`specs/evidence/TASK-nnn.tdd.md\`. Only then mark the task done in the source and regenerate.
8. **When the PRD is unclear or contradicts itself, stop and ask.** Never guess; open questions live in CONTEXT.md.
9. **One entity, one name (PRD §0.7, DEC-106).** The entity is SPK everywhere: text, IDs, tables, permissions, artboards, files and code. The former name is retired; never reintroduce it, and if you meet it in \`docs/prd/history.md\` it means SPK.

Verify shorthands: \`unit <pkg> "<ids>"\` = \`pnpm --filter <pkg> test -t "<ids>"\`; \`int "<ids>"\` = \`pnpm --filter @bmi/api test:int -t "<ids>"\`; \`e2e <FLW>\` = \`pnpm --filter @bmi/web e2e flows/<FLW>.spec.ts\` (mobile flows: the same name under \`apps/mobile/e2e\`); \`qa <Screen>\` = side-by-side comparison with the artboard (\`ecc:browser-qa\`); \`gate\` = lint, typecheck, unit and integration green with coverage gates met.
`);

for (const ph of PHASES) {
  out.push(`---\n\n## ${ph.title}\n\n**Goal:** ${ph.goal}\n`);
  for (const t of derived.filter((x) => x.phase === ph.n)) {
    const ids = [...t.reqIds];
    out.push(`- [${t.done ? 'x' : ' '}] **${t.id}** ${t.title}${ids.length ? ` [${ids.join(', ')}]` : ''}`);
    out.push(`  - _Scope_: ${t.scope}`);
    if (t.acIds.length) {
      out.push(`  - _Acceptance_: ${t.acIds.map((a) => (ACCEPTANCE_HOME[a]?.[0] === t.id ? `${a} (here because it ${ACCEPTANCE_HOME[a][1]})` : a)).join(', ')}`);
    }
    if (t.rules.length) out.push(`  - _Rules_: ${t.rules.join(', ')}`);
    if (t.owned.length) out.push(`  - _Screens built here (visual target)_: ${t.owned.map((s) => link(s, inventory.get(s).path)).join(', ')}`);
    if (t.touched.length) out.push(`  - _Screens touched_: ${t.touched.map((s) => `${link(s, inventory.get(s).path)} (${touchedLabel(t, s)})`).join(', ')}`);
    if (t.tables.length) {
      const note = (tb) => (t.extendedBy?.[tb] ? `; this task's part is extended in ${t.extendedBy[tb]}` : '');
      out.push(`  - _Data_: ${t.tables.map((tb) => `\`${tb}\` (§${tableSection.get(tb)}${note(tb)})`).join(', ')}`);
    }
    if (t.flows?.length) out.push(`  - _Journey_: ${t.flows.map((f) => `${f} ${flowTitles.get(f) ?? ''}`.trim()).join('; ')}`);
    out.push(`  - _Read_: ${t.read.join('; ')}`);
    if (t.depends?.length) out.push(`  - _Depends_: ${t.depends.join(', ')}`);
    out.push(`  - _Skill_: ${t.skills.join(', ')}`);
    out.push(`  - _Verify_: ${t.verifyLines.join('; ')}`);
  }
  out.push('');
}
writeFileSync(join(root, 'specs/tasks.md'), out.join('\n'));

// ── decision-index.md ────────────────────────────────────────────────────────
const tasksFor = (dec) => {
  const ids = new Set();
  for (const t of derived) {
    if ((t.ids ?? []).includes(dec.id) || t.rules.includes(dec.id)) ids.add(t.id);
    for (const ref of dec.applies.match(/(REQ|AC)-[A-Z]+-\d+/g) ?? []) {
      if (t.reqIds.includes(ref) || t.acIds.includes(ref)) ids.add(t.id);
    }
  }
  for (const tok of dec.applies.split(/,\s*/)) {
    const key = tok.trim().replace(/^§/, '');
    for (const id of SECTION_TASKS[key] ?? []) ids.add(id);
    const sec = key.match(/^(\d+(\.\d+)?a?)/);
    if (sec && SECTION_TASKS[sec[1]]) for (const id of SECTION_TASKS[sec[1]]) ids.add(id);
  }
  return [...ids].sort();
};
const di = [`# Decision index — every active decision and where it is built

> **Generated** by \`node specs/tools/build-tasks.mjs\` from PRD.md §11.1. The decision text is in PRD.md; this index only places each decision. "Applies to" is copied from the PRD. A decision without a task is a constraint every task obeys (it is listed so nothing is silently dropped).

| Decision | Applies to (PRD) | Built or enforced in |
| --- | --- | --- |`];
for (const d of decisions) {
  const t = tasksFor(d);
  di.push(`| ${d.id} | ${d.applies} | ${t.length ? t.join(', ') : 'Constraint for every task (no own task)'} |`);
}
writeFileSync(join(root, 'specs/decision-index.md'), di.join('\n') + '\n');

// ── acceptance-tests.md: every AC is a test source of its own ────────────────
const journeysDoc = read('specs/tdd-user-journeys.md');
const acJourneys = new Map();
for (const part of journeysDoc.split(/\n(?=### )/)) {
  const head = part.match(/^### ((FLW|J)-[A-Z]+-\d+)/);
  if (!head) continue;
  for (const m of part.matchAll(/\bAC-[A-Z]+-\d+\b/g)) {
    if (!acJourneys.has(m[0])) acJourneys.set(m[0], new Set());
    acJourneys.get(m[0]).add(head[1]);
  }
}
const acTask = new Map();
for (const t of derived) for (const a of t.acIds) if (!acTask.has(a)) acTask.set(a, t.id);
const deferredReq = (r) => reqs.get(r) && reqs.get(r).p !== 'P0' && r !== 'REQ-NTF-002';
const at = [`# Acceptance tests — one or more tests for every acceptance criterion

> **Generated** by \`node specs/tools/build-tasks.mjs\` from the AC tables of \`docs/prd/areas/*.md\`. Read the AC text in its area file before writing the test.
> Every AC below gets at least one **integration test** (real PostgreSQL) whose name starts with the AC ID, for example \`it('AC-SPK-001 refuses approval by the creator; accepts a Supervisor')\`, written RED before the code of its task. Where the AC is about a screen or a whole journey it is also asserted in the E2E spec of the journeys listed. \`node specs/tools/check-coverage.mjs --tests\` fails when an AC of a finished task has no test with its ID.

| AC | Verifies | Area file | Task (written RED here) | Also asserted in journey | Test name prefix |
| --- | --- | --- | --- | --- | --- |`];
for (const a of [...acs.values()].sort((x, y) => x.id.localeCompare(y.id, 'en', { numeric: true }))) {
  if (a.verifies.length && a.verifies.every(deferredReq)) continue;
  const j = [...(acJourneys.get(a.id) ?? [])].join(', ') || '— (AC-only: integration or unit test)';
  at.push(`| ${a.id} | ${a.verifies.join(', ')} | \`${a.file}\` | ${acTask.get(a.id) ?? 'UNPLACED'} | ${j} | \`${a.id} \` |`);
}
writeFileSync(join(root, 'specs/acceptance-tests.md'), at.join('\n') + '\n');

console.log(`tasks.md: ${derived.length} tasks; decision-index.md: ${decisions.length} decisions; acceptance-tests.md: ${at.length - 1} ACs`);
