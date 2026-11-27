# TASK-201 Engine Tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the seven §9.6 engine tables and the three references DEC-124 left open, with their Drizzle definitions, so TASK-202 onward can build the assignment engine (DEC-95, DEC-124, DEC-144).

**Architecture:** One SQL migration `0014_engine_tables.sql` (D-12: SQL is the schema source), the matching Drizzle tables in `infra/db/schema/index.ts`, and one integration test file that proves the constraints. No gateway method, no service, no route, no module row (DEC-144).

**Tech Stack:** PostgreSQL 16, the SQL migration runner of TX-01, Drizzle ORM definitions, Vitest integration project.

**Spec:** `docs/prd/data-model.md` §9.0 and §9.6; `PRD.md` DEC-95, DEC-124, DEC-144 (PRD v2.56, commit 5259732); `specs/design.md` §5.24.

**Branch:** `feat/phase2-task201-engine-migrations`.

## Success criteria (Done when)
- `_Verify_`: `int "assignment migrations"` passes and the D-12 drift test is green.
- The §9.0 convention test (TX-18, BR-10) stays green; `check:coverage` "Coverage OK"; every gate passes.

## Workflow (WORKFLOW_STANDARDS)

| Step | What | State |
| --- | --- | --- |
| §6.1 | `next-numbers.mjs` (DEC-144, v2.56, migration 0014, row 52); branch from `main` | Done |
| §1 1–8 | Task entry, §9.0, §9.6, DEC-95, DEC-124, migration 0009, drift and convention tests | Done |
| §1 10 | Owner answers → DEC-144 in PRD, history, tasks.source (commit 5259732), design §5.24 | Done |
| §1 11, §2A | This plan; owner review | Waiting for "Ya, setujui" |
| §1 12 | No FLW and no screen on the task line: no E2E spec | — |
| §1 13–14 | Integration tests RED, then the migration and Drizzle GREEN | After approval |
| §4, §1 15–20 | Gates, evidence, CONTEXT, AGENT_LOG, audit; no QA (no screen); PR on the owner's word | After approval |

## Decisions I made (the owner may change them)
1. **`spk_presets` unique by `(name, version)` among non-deleted rows** (§9.0 SD rule), not the plain `UNIQUE` printed in §9.6; the TX-18 convention test requires it.
2. **`spk_check_items.sku` and `part_item_type_id` are plain columns** with a comment naming the task that constrains them (TASK-301 for `parts_catalog`, the part item type task for `part_item_types`), as DEC-124 did in 0009.
3. **Append-only by trigger** for `step_time_events`, `step_time_corrections` and `mobilisation_location_trail`, with the function `refuse_change_of_append_only()` of migration 0002.
4. **`spk_change_requests` has no `version` column** (§9.6 marks it neither SD nor OL); its state changes are guarded by the services of TASK-611.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/api/migrations/0014_engine_tables.sql` | create | the seven tables, `cr_number_seq`, triggers, indexes, the three foreign keys |
| `apps/api/src/infra/db/schema/index.ts` | modify | the seven Drizzle tables, added to `allTables` |
| `apps/api/test/integration/db/assignment-migrations.test.ts` | create | the constraint tests |

## Tests (RED first)
`test/integration/db/assignment-migrations.test.ts`, describe `assignment migrations`:
- `DEC-144 the seven engine tables exist with the standard columns of §9.0`.
- `DEC-124 spks.preset_id, spk_attachments.check_item_id and spk_approvals.change_request_id now reference their tables (ON DELETE RESTRICT)`.
- `DEC-87 step_time_events refuses an UPDATE and a DELETE (append-only)`; the same for `step_time_corrections` and `mobilisation_location_trail`.
- `DEC-87 a Pause needs a pause reason; Other needs a note`.
- `REQ-REG-003 a preset name and version are unique among non-deleted presets, and a deleted one frees the pair`.
- `REQ-CHK-002 a check item cannot be unsafe to drive without a decision, nor when it is Good`.
- `NFR-15 cr_number_seq exists and counts up`.
- `DEC-95 assignment_modules.tracks_work_time defaults to true`.
- The D-12 drift test fails as soon as the migration exists (tables only in the database), then passes with the Drizzle definitions.

## Review Focus
1. **The migration on a database that already holds SPKs** (staging later, the trial now): adding foreign keys to existing columns fails if a row holds an id with no target; `preset_id`, `check_item_id` and `change_request_id` are NULL everywhere today, checked by a test that runs the migration over seeded SPKs (the e2e seed).
2. **The trial seed** still migrates and seeds (`trial-cli --reset` in CI).
3. **A rerun of the migration runner** applies 0014 once (TX-01, existing tests).
4. **The convention test** sees the new soft-deleted table and its unique index.
5. **Drift on enum and array columns** (`role_t[]`, `cr_status_t`): the Drizzle types must match exactly.

---

### Task 1: Tests first (RED)
**Skills:** postgres-pro, ecc:postgres-patterns, ecc:database-migrations, test-master, ecc:tdd-workflow.
- [ ] Write `assignment-migrations.test.ts`; run `cd apps/api && npx vitest run --project int test/integration/db/assignment-migrations.test.ts` → FAIL (no tables).

### Task 2: The migration (GREEN for the constraint tests)
- [ ] Write `0014_engine_tables.sql`; run the new test → PASS; run `drift.test.ts` → FAIL (tables only in the database), as expected.

### Task 3: Drizzle definitions (GREEN for drift)
**Skills:** ecc:hexagonal-architecture (schema stays in `infra/db`).
- [ ] Add the seven tables to `schema/index.ts` and `allTables`; run `drift.test.ts`, `conventions.test.ts`, `migrate.test.ts` → PASS.
- [ ] Commit `feat(db): engine tables and the DEC-124 references [TASK-201, DEC-95, DEC-124, DEC-144]`.

### Task 4: Gates, bookkeeping, PR
- [ ] Gates of §4: coverage, kiro-skills, secrets, format, lint, typecheck, check:client, check:layers; API unit and the full integration run (known local failures listed apart); the trial seed `trial-cli --reset` is checked by CI.
- [ ] Evidence, tasks.source `done: true`, CONTEXT row 52, AGENT_LOG with the workflow audit; push; ask "Buat PR untuk TASK-201?".

## Not in this task
Gateway methods, the dummy module and the engine (TASK-202); presets (TASK-203); step time (TASK-204); change requests (TASK-611); Part Check (TASK-404); the location trail and its access log (TASK-708).
