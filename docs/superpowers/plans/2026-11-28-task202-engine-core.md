# TASK-202 Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assignment engine submits a step of a frozen SPK, opens the next step at once, checks the executor, moves the SPK T7 and T11, and applies the failed-file rule, proven on the tests' dummy module (REQ-ENG-001 to 003, BR-05, TX-02, DEC-139, DEC-145, DEC-146).

**Architecture:** As approved in `specs/design.md` §5.25 (read it first; this plan does not repeat it). New `apps/api/src/engine/` with pure `step-lifecycle.ts` and `step-service.ts`; port `ports/engine.ts`; Drizzle gateway `infra/db/engine-gateways.ts`; route in `http/spks/steps.controller.ts`; migration `0015_step_freeze.sql` (the freeze trigger); shared additions in `@bmi/shared`.

**Tech Stack:** NestJS, Drizzle, PostgreSQL trigger, Zod, Vitest (unit, integration with real transactions), the generated client.

**Spec:** `PRD.md` §3.2 (T7, T11), §3.3 SM-STEP (Open → Submitted, DEC-146), DEC-139, DEC-144, DEC-145, DEC-146, ADR-0002; `docs/prd/areas/4.2-eng.md`; `docs/prd/areas/4.19-ntf.md` (REQ-NTF-005 matrix); `docs/prd/areas/8.1-fup.md` (REQ-FUP-006, 009); `docs/prd/data-model.md` §9.6, TX-02; `specs/design.md` §3, §5.25, §6.

**Branch:** `feat/phase2-task202-engine-core`.

## Success criteria (Done when)
- `_Verify_`: `int "AC-ENG-001|AC-SPK-002"` passes; SPKDetail regression (its tests and E2E stay green).
- Every test below passes; gates of §4 pass; the PR body records the ADR-0002 reviews (the agent review already done, and the owner's).

## Workflow (WORKFLOW_STANDARDS)

| Step | What | State |
| --- | --- | --- |
| §6.1 | `next-numbers.mjs` (DEC-145, v2.57, migration 0015, row 53); branch | Done |
| §1 1–10 | Task, PRD, ADR-0002, design §6; owner answers → DEC-145; design note §5.25 | Done |
| ADR-0002 | Agent review in a separate session ("approve with changes"); owner approval → DEC-146 (v2.58), note updated | Done |
| §1 11, §2A | This plan; owner review | Waiting for "Ya, setujui" |
| §1 12 | No FLW on the task line; no E2E spec (no screen action yet, DEC-145) | — |
| §1 13–14 | RED, then GREEN per task below | After approval |
| §4, §1 15–20 | Gates, regression of SPKDetail, evidence with the reviews, CONTEXT, AGENT_LOG, audit, PR | After approval |

## Decisions I made (the owner may change them)
1. **Route body `{ fileIds: number[] }` only**, no version: the row locks and the state check serialise submits; a retry is the Idempotency-Key.
2. **The trigger compares the SPK status at write time** (`SELECT status FROM spks WHERE id = NEW.spk_id`); the approval (T3) itself only changes lifecycle columns, so it passes.
3. **The step's `allowedActions`** (`submit` or nothing) are added to the SPKDetail step payload (`SpkDetailStep.allowedActions`), shown nowhere yet (no button, DEC-145).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `packages/shared/src/machines/index.ts` | modify | SM-STEP `Open → Submit → Submitted` |
| `packages/shared/src/permissions/index.ts` | modify | `MODULE_EXECUTE_CAPABILITY`, `passesExecutorCheck` |
| `packages/shared/src/schemas/spks.ts` | modify | `StepSubmitRequestSchema`, step `allowedActions` |
| `apps/api/migrations/0015_step_freeze.sql` | create | the freeze trigger with the `bmi.step_revision` exception |
| `apps/api/src/engine/step-lifecycle.ts` | create | `nextToOpen`, `spkMoveAfterSubmit` |
| `apps/api/src/engine/step-service.ts` | create | `StepService.submit` (§5.25 steps 1–7), `STEP_POLICIES` |
| `apps/api/src/ports/engine.ts` | create | `EngineGateways` |
| `apps/api/src/infra/db/engine-gateways.ts` | create | Drizzle adapter, locks in the order SPK, steps, files |
| `apps/api/src/core/audit/audit-format.ts` | modify | `AREA_OF.spk_assignment = 'SPK'` |
| `apps/api/src/http/spks/steps.controller.ts` | create | `POST /spks/:id/steps/:stepId/submit` |
| `apps/api/src/app.module.ts` | modify | wiring |
| `apps/api/src/core/spk/spk-list-service.ts` | modify | step `allowedActions` in the detail |
| `packages/api-client/*` | regenerate | the new route |

## Tests (RED first)
- **Shared unit:** `DEC-146 SM-STEP Open → Submit → Submitted`; `REQ-ENG-003 passesExecutorCheck: a role of the step, the System Admin, any other role refused`; `DEC-146 every registered module code maps to one execute capability; an unknown one maps to none`.
- **Engine unit (`step-lifecycle.spec.ts`):** `REQ-ENG-002 the step at sequence_no + 1 opens`; `BR-05 after a Return of step 2 while step 3 is Open, resubmitting step 2 opens nothing`; `T7 an Active SPK moves to In_Progress on the first submit`; `T11 the last submit moves it to Pending_Verification`; `T7 T11 a one-step SPK moves both in order`.
- **Integration (`test/integration/engine/step-submit.test.ts`, dummy module registered by the harness, DEC-144):**
  - `AC-SPK-002 an approved SPK with three steps shows step 1 Open, steps 2 and 3 Locked` (T3 exists since TASK-122: expected to pass at once, recorded as such);
  - `AC-ENG-001 when step 1 is submitted, step 2 is Open and step 3 stays Locked`;
  - `REQ-ENG-003 a user of another role is refused 403; the System Admin may submit; a role without the module capability is refused`;
  - `T7 T11` through the route; `REQ-NTF-005 the verifiers and the next step's executors are notified once`;
  - `DEC-139 a Rejected file refuses the submit and its uploader gets one notice that survives the rollback`; `REQ-FUP-006 a Pending file refuses with 409 and a retry with the same key succeeds once Ready`; `REQ-FUP-009 a file is attached on success and cannot be submitted on a second step`;
  - `NFR-01 the same key replays; another key gets 409 already submitted`; `NFR-01 two submits in parallel: one succeeds, one gets 409`;
  - `T8 a step of a Pending_Amendment SPK is refused`; `DEC-145 a step the SPK does not hold is 404`;
  - `NFR-02 one step_submit audit record with before, after and fileIds`.
- **Freeze (`test/integration/db/step-freeze.test.ts`):** `DEC-145 after approval an UPDATE of module, sequence_no, step_config, roles or spk_id is refused`; `DEC-146 an INSERT and a DELETE of a step of an Active SPK are refused`; `DEC-145 lifecycle columns stay writable`; `DEC-146 every spk_assignments column is listed as frozen or lifecycle`; `DEC-146 bmi.step_revision lets a revision through`.
- **Web:** `REQ-SPK-011 SPKDetail shows Submitted and the opened step after a submit` (status texts only; existing tests stay green).

## Review Focus
1. Two submits on the same SPK at once (different steps or the same step).
2. A submit while an approval or cancel holds the SPK lock (lock order).
3. The notice of a failed file when the whole submit rolls back.
4. A frozen step written by a future composer or by hand in SQL.
5. A role without the module capability but listed in `executor_roles` (data out of line): refused by L1.

---

### Task 1: Shared (RED → GREEN)
**Skills:** typescript-pro, test-master, ecc:tdd-workflow.
- [ ] Shared unit tests above → FAIL; implement the SM-STEP row, the map and the predicate, the schemas → PASS. Commit `feat(shared): SM-STEP Open to Submitted, module execute capabilities, executor check [TASK-202, REQ-ENG-003, DEC-146]`.

### Task 2: Freeze trigger (RED → GREEN)
**Skills:** postgres-pro, ecc:database-migrations.
- [ ] `step-freeze.test.ts` → FAIL; `0015_step_freeze.sql` → PASS; drift and conventions stay green. Commit `feat(db): steps frozen at approval by trigger [TASK-202, DEC-145, DEC-146]`.

### Task 3: Engine (RED → GREEN)
**Skills:** nestjs-expert, ecc:hexagonal-architecture, ecc:backend-patterns, ecc:error-handling.
- [ ] `step-lifecycle.spec.ts` → FAIL; implement → PASS.
- [ ] `step-submit.test.ts` → FAIL (404 route); port, gateway, `StepService`, controller, wiring, audit area, client → PASS; `check:layers` and `check:client` clean. Commit `feat(engine): step submit opens the next step, executor check, T7 and T11, failed-file rule [TASK-202, REQ-ENG-001, REQ-ENG-002, REQ-ENG-003, DEC-139, DEC-145, DEC-146]`.

### Task 4: SPKDetail regression and step allowedActions
**Skills:** nextjs-developer, ecc:react-testing.
- [ ] The detail test above → FAIL; step `allowedActions` in the detail payload; existing SPKDetail web tests and the SPK E2E specs green.

### Task 5: Gates, bookkeeping, PR
- [ ] Gates of §4 (full integration with known local failures apart; E2E with `E2E_SERVER_START_MS`); evidence with the ADR-0002 review record; tasks.source `done: true`; CONTEXT row 53; AGENT_LOG with the audit; push; ask "Buat PR untuk TASK-202?" (the PR body records both ADR-0002 reviews).

## Not in this task
Start, Pause and the time log (TASK-204); verify and return (TASK-205); assign and claim (TASK-206); the module contract (TASK-203); step screens and buttons (the modules); the vehicle Repair status (TASK-604).
