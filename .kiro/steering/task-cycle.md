---
inclusion: auto
name: task-cycle
description: How to work one task of specs/tasks.md (TASK-nnn) from claim to merge - reading, questions to the product owner, DEC, spec commit, tests first, build, QA against the artboard, gates, bookkeeping, commit and report.
---

# The cycle of one task

Every finished task in `specs/evidence/TASK-*.tdd.md` followed these steps; read one or two of them
(for example TASK-119 and TASK-121) to see the level of detail expected.

## 1. Read

- `specs/CONTEXT.md`, then the task entry in `specs/tasks.md`. Open every file on its _Read_ line
  and read the full PRD text of every ID it names; the task line is a pointer, never the requirement.
- The artboards under _Screens built here_ and the rows of `docs/prd/ui-action-map.md` for them.
- The skills on its _Skill_ line (`.claude/skills/<name>/SKILL.md`).

## 2. Ask the product owner what the spec leaves open

List the gaps: a field the PRD names but the artboard lacks (or the reverse), a table a later task
builds, a screen whose list or detail comes later, an order, a default, a message. Ask them in one
message, in Indonesian, two or three options each, your recommendation first. Do not ask what the
PRD, a DEC or `specs/design.md` already answers.

## 3. Write the spec first, then commit it

- Each answer becomes one new row `| DEC-nnn | <Topic>, product owner decision: ... | <IDs> |` after
  the last DEC row of `PRD.md` (number from `next-numbers.mjs`).
- One new line at the top of "## Change history" in `docs/prd/history.md`:
  `v2.nn (YYYY-MM-DD) adds DEC-nnn, product owner decision on ...`; set `| Spec version | PRD v2.nn |`
  in `specs/CONTEXT.md`.
- A data model change goes into `docs/prd/data-model.md` first. An artboard that must change follows
  the PRD (add the missing field), never the reverse.
- Task notes: add the DEC to the `ids` and a short note to the `scope` of the task (and of any later
  task it moves work to) in `specs/tools/tasks.source.mjs`; run `node specs/tools/build-tasks.mjs` and
  `node specs/tools/check-coverage.mjs --tests`.
- Commit: `docs(spec): <topic>, PRD v2.nn [TASK-nnn]`.

## 4. Tests first, then code

- Write the failing tests first: API integration (one per AC, plus the rules and transitions the
  task touches), shared schema tests, web component tests, and one e2e spec per FLW of the task.
- Then build: migration and Drizzle schema, shared schemas, port, core service with its policy table,
  Drizzle gateway, controller and error filter, wiring in `app.module.ts`; `pnpm gen:client`; the web
  page, its `<X>Pages.tsx` wiring and route.
- Hide, do not disable, what a later task builds (DEC-122).

## 5. QA against the artboard

Start the `api`, `web` and `design-artifact` servers, sign in with a local account from
`.data/local-accounts.md`, and compare each built screen with its artboard at 1440 x 900. Fix what
differs; write down in the evidence what you kept different on purpose and why.

## 6. Gates (all must pass; see the tech steering for the commands)

Format, typecheck, lint, check:layers, check:secrets, the three test packages with coverage, e2e,
`check:client` after staging, `check-coverage.mjs --tests`.

## 7. Bookkeeping, then commit

- `specs/design.md`: a section for what the task built.
- `specs/evidence/TASK-nnn.tdd.md`: spec first, what changed, how the spec was read, evidence (RED,
  GREEN with test counts and coverage, QA).
- `done: true` on the task in `tasks.source.mjs`; rebuild; the Active task line and a new journal
  row in `specs/CONTEXT.md`.
- Commit with specific files: `feat(<area>): <what> [TASK-nnn]`, the REQ/DEC IDs in the body.

## 8. Report and stop

Tell the owner, in Indonesian, what was built, what was decided, the test results (say plainly what
did not pass or was not run), and ask whether to merge the branch into `main` and push. Do nothing
more until the owner answers.
