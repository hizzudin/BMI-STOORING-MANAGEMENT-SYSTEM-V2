# TASK-202 Engine core on the dummy module

- **Requirements:** REQ-ENG-001, REQ-ENG-002, REQ-ENG-003; AC-ENG-001, AC-SPK-002.
- **Rules:** BR-05, TX-02, SM-STEP (Open → Submitted), SM-SPK T7 and T11, T8 (frozen while Pending_Amendment), DEC-139 (failed file), REQ-FUP-006, REQ-FUP-009, REQ-NTF-005 (matrix rows "Step opened", "Step submitted"), NFR-01, NFR-02, NFR-03, DEC-93.
- **Decisions:** DEC-145 (PRD v2.57) and DEC-146 (PRD v2.58). Design note `specs/design.md` §5.25; plan `docs/superpowers/plans/2026-11-28-task202-engine-core.md`, approved by the owner ("Ya, setujui (Native)").

## ADR-0002 reviews (critical tier, §8.4)

TASK-202 is critical tier, and no internal developer exists yet (OQ-5), so ADR-0002 applies: two reviews of the design note before code.

1. **Agent review, in a separate session** ("ADR-0002 review: TASK-202 engine design note", read only, `ecc:architect`). Verdict: **approve with changes**: 2 blocking findings and 9 other findings. Every finding was folded into the note (§5.25) and into DEC-146 before the plan was written. The accepted findings, as DEC-146 lists them: the failed-file notice in its own unit of work so the rollback keeps it; only the step at `sequence_no + 1` opens and only while Locked; the submit claims its files (`attached_at`, locked) and refuses Rejected or Expired before Pending (409, retried with the same key); one map of module execute capabilities in `@bmi/shared`, an unknown module refuses; the System Admin passes the executor check through one shared predicate; the freeze trigger also refuses an INSERT and a change of `spk_id`; one lock order SPK, steps, files; every submit notifies the verifiers and the opened step its assignee or executor roles; the vehicle Repair status of T7 stays with TASK-604. The review's open points (a) the System Admin exception, (b) trigger or service freeze, (c) the Pending file were answered by the owner (§5.25 "Review answers").
2. **Product owner review:** approved the note with these changes (DEC-146, PRD v2.58), then approved the plan.

## What changed

| Commit | Change |
| --- | --- |
| 255ebea | `@bmi/shared`: SM-STEP `Open → Submit → Submitted`; `moduleExecuteCapability` (Dummy → `mechanic.execute`, unknown → none); `passesExecutorCheck` |
| 4f0d534 | Migration `0015_step_freeze.sql`: trigger `spk_assignments_frozen` (refuses INSERT, DELETE and a change of the frozen columns while the SPK is not Draft or Rejected; `SET LOCAL bmi.step_revision = 'on'` lets a revision through); `db/step-freeze.test.ts`; fixtures and seeds write steps while Draft |
| 68d6448 | `engine/step-lifecycle.ts`: `nextToOpen`, `spkMovesAfterSubmit`, 8 unit tests |
| 340e620 | `ports/engine.ts`; `infra/db/engine-gateways.ts` (locks SPK, steps, files); `engine/step-policies.ts` (`STEP_POLICIES`, `submitConflict`); `engine/step-service.ts` (`StepService.submit` under `runIdempotent`, steps 1–7 of §5.25); `http/spks/steps.controller.ts` (`POST /spks/:id/steps/:stepId/submit`, `@RequireCapability` of any execute code, `@ApiContract`, Idempotency-Key, body `{ fileIds }`); `AREA_OF.spk_assignment = 'SPK'`; wiring; `@bmi/shared` exports the SM tables and adds `STEP_ACTIONS`, `StepSubmitRequestSchema`, `StepSubmitResponseSchema` and the step `allowedActions` of SPKDetail (Task 4, no button); regenerated `@bmi/api-client` |

HTTP answers: 404 for an unknown SPK or a step it does not hold; 409 when the SPK is not Active or In_Progress (T8), the step is not open, the step is already submitted (another key), or a file is Pending; 403 without the module capability (L1) or when not an executor (L2); 400 for a file that is not the actor's, already attached, or failed for good (with the notice).

## Divergences from the plan

- `@bmi/shared` had never exported `machines/`; the index now exports it so the engine calls `transition` on SM-SPK and SM-STEP as §5.25 says.
- The route's L1 guard asks for any of the five execute codes; the capability of the step's own module is a rule of `STEP_POLICIES`, so `allowedActions` and the route share it (DEC-93).
- The SPK audit actions of T7 and T11 are named `start` and `request_verification`.
- The step `allowedActions` tests of Task 4 live in `step-submit.test.ts`, with the allowedActions contract helper, next to the route they mirror.

## Evidence

### RED
- Tasks 1, 2 and the lifecycle rules: RED then GREEN in the earlier session (commits 255ebea, 4f0d534, 68d6448); not re-run as RED here.
- `engine/step-submit.test.ts` before any engine code: 19 tests, **17 failed** (404, no route; the step `allowedActions` undefined) and **2 passed at once**: `AC-SPK-002` (T3 opens step 1 since TASK-122, as the plan expected) and `DEC-145 a step the SPK does not hold is 404` (trivially, as the route did not exist). A first run failed 18 with 401: the test database was in Setup mode, where only the System Admin signs in (DEC-56); the harness now sets Live, like the SPK suites.
- Web: the SPKDetail "after a step submit" test passed when first run, as StepCard has shown Submitted since TASK-125; it guards the regression and that no submit button shows (DEC-145).

### GREEN
- `engine/step-submit.test.ts`: 20 of 20 (including the REQ-IAM-014 allowedActions contract for the step record type).
- Engine, SPK, approvals, step freeze and audit suites together: 9 files, 102 tests.
- API unit 94, shared 350, web `components/spk` 6 files, 40 tests.

### Gates
- `_Verify_` `int "AC-ENG-001|AC-SPK-002"`: green (in `step-submit.test.ts`).
- `check:coverage --tests` "Coverage OK"; `typecheck` and `lint` (9 of 9 packages each); `check:layers` (no violations, the engine imports no module and no infra); `check:client` (no drift after the commit); `check:secrets`; `check:kiro-skills`; Prettier on every touched file.
- Coverage of `src/engine/**` (engine unit and integration suites): statements 99,18 %, branches 92,42 %, functions 100 %, lines 100 % (gate 90 %, D-09).
- API unit and integration, full run: 52 files, 431 passed, 1 skipped (the S3 contract run, CI only), **2 failed, both known local failures, not counted as passed:** BR-10 in `db/identity-schema.test.ts` and NFR-14 in `harness/real-transactions.test.ts` (the local PostgreSQL is not in UTC). Redis was slow once during the run (a logged scheduling timeout); the BullMQ tests passed.
- Shared 26 files, 350 tests; web 40 files, 253 tests.
- E2E (SPKDetail regression), built web on a pre-started `next start -p 3100`, `E2E_SERVER_START_MS=300000`: `spk-list`, `create-spk`, `create-spk-flw-pln-03`, `approvals-flw-apr-01`, `approvals-flw-apr-05`: 9 of 9 passed. The servers were stopped after the run.
- Artboard comparison: at first skipped as "no screen changed". The owner pointed this out, so it was run afterwards (below).

### QA against the artboard (run after the owner asked, 2026-11-28)
Run on `bmi_trial` (`trial-cli --reset`), with the built API (`api-trial-build`) and web (`web-build`), at 1440 x 900, next to `Design Artifact/spk/SPKDetail.html`. The Planner was signed in by the owner in the browser pane. Steps were submitted through the new route by a QA script, signed in as the trial Warehouse Manager and then the Mechanic, because there is no button yet (DEC-145). Every server was stopped afterwards.

- **The `allowedActions` of every trial SPK, read from the API:** `submit` only on the open step of the Active and In_Progress SPKs, and nothing on the Pending_Amendment, Pending_Verification, Draft, Rejected, Completed and Cancelled ones.
- **State A, SPK-2611260004 Active, step 1 Open:** matches the artboard's crumb, title, pills, subline, tabs, tracker, step cards, context card and approval block. What DEC-127 hides is absent.
- **State B, In_Progress, step 1 Submitted, step 2 Open:** "Submitted 09:11:36" with an amber Submitted pill, and step 2 "Waiting to start since 09:11:36" with an Open pill. The Planner's bell shows the "Step submitted" notice (REQ-NTF-005).
- **State C, Pending_Verification, both steps Submitted:** a Pending verification pill in petrol, both steps amber Submitted, and a second notice.
- **Differences found, reported to the owner, nothing changed:**
  1. After a submit, the tracker marks the Submitted step as the current one, and SPKList's Waiting on names its executor. design.md §5.11 defines the current step as "the first not Verified or Skipped", while the artboard marks the step being worked. This state was first reachable with TASK-202.
  2. The SPK's In_Progress pill is green (`STATUS_TONES`, TASK-125). DESIGN.md and the artboard use petrol (info) for In Progress.
  3. From TASK-125, for later step tasks: step cards have no module icon, and the user's own step has no red outline. On the artboard that outline comes with the Open step button, which DEC-127 hides.

## Notes for later tasks
- **TASK-203:** the module contract replaces the Dummy row of the harness.
- **TASK-204:** Start, Pause and the "not paused" check of submit; T7 then moves on Start.
- **TASK-205:** verify adds `verify` to `STEP_ACTIONS`; a Return raises `attempt_no`, which the open notice key already carries.
- **TASK-611:** applies a revision under `SET LOCAL bmi.step_revision = 'on'`, locking the SPK first.
