# TASK-124 Approver cancel with reason

- **Rules:** REQ-SPK-008, T15 of SM-SPK, TX-14, BR-06, DEC-58, DEC-129, DEC-93, NFR-01, NFR-02, NFR-03.
- **Decision:** DEC-140 (PRD v2.52, commit beddda1).
- **Tables:** `spks` (§9.6, existing `cancelled_by`, `cancel_reason`), `spk_approvals` (action `Cancel`), `audit_logs`, `notifications`. No migration.

## Spec first (DEC-140)
Claude Code took the task over from the Kiro handoff on the owner's word (2026-11-20), on the new branch `feat/phase1-task124-approver-cancel-v2` because Kiro's empty branch was checked out in its own folder. The owner decided before any code:
- **Scope:** TASK-124 builds T15 and the CancelSPK dialog only; AssignStep moved to TASK-206, CorrectStepTime to TASK-204.
- **States:** an Approver cancels in any open status, Draft and Rejected included; the creator keeps T6.
- **TX-14:** the steps before Cancelled are one port that does nothing until TASK-308, TASK-502, TASK-313, TASK-612 and TASK-610 fill it.
- **Agent defaults in the DEC:** the creator is notified now, the executors from TASK-206; a System Admin cancelling its own SPK is not a BR-03 self-decision.

The plan is `docs/superpowers/plans/2026-11-20-task124-approver-cancel.md`, revised the same day to follow WORKFLOW_STANDARDS; the owner approved it ("Ya, setujui (Native)").

## What changed
- **Shared:** `APPROVER_CANCEL_STATUSES` (enums); `approverCancel` in `SPK_ACTIONS`; `SpkApproverCancelRequestSchema` (the cancel schema).
- **API:**
  - `ports/spk-cancel-steps.ts` (`SpkCancelSteps`) and `SpkGateways.cancelSteps`;
  - `infra/db/spk-cancel-steps.ts` (`NoCancelStepsYet`), wired in `spkGateways`;
  - `core/spk/spk-service.ts`: `SPK_MESSAGES.alreadyFinal`, `SPK_POLICIES.approverCancel`, `cancelStageOf`, `SpkService.approverCancel`;
  - `http/spks/spks.controller.ts`: `POST /spks/:id/approver-cancel` (`approverCancelSpk`), with the client regenerated;
  - the e2e database seed adds the waiting SPK "Approver cancel me".
- **Web:**
  - `lib/spks-api.ts`: `approverCancel`;
  - `components/spk/CancelSpkDialog.tsx`: one dialog for T6 and T15, `ApproverCancelDialog` with the CancelSPK texts;
  - `SpkDetail.tsx`: Cancel SPK in the header from `allowedActions`, a reload after the cancel;
  - `SpkRejected.tsx`: the same button for an Approver who is not the creator.
- **E2E config:** `playwright.config.ts` reads `E2E_SERVER_START_MS` (default 120 s) so the slow local machine can start the servers; CI is unchanged.
- **QA config:** `.claude/launch.json` gains `api-trial-build` and `web-build` (the built web app on port 3100 with the API on `bmi_trial`).

## Divergences from the plan
- **A final SPK is refused with 403, not 400.** Every policy refusal in this API is 403 (T6 too); the sentence is the planned one.
- **`APPROVER_CANCEL_STATUSES`, not `OPEN_SPK_STATES`.** The shared enums already hold `OPEN_SPK_STATUSES` for REQ-SCH-001, which leaves Rejected out; a second name avoids the clash. A test keeps it equal to T15 of SM-SPK.
- **The dialog lives in `CancelSpkDialog.tsx`,** sharing the T6 dialog, instead of a new file; `ApproverCancelDialog` is the planned interface.
- **SPKRejected gets the button too.** A Rejected SPK shows SPKRejected (DEC-129), so an Approver would otherwise have no way to cancel it, which DEC-140 allows.
- **The route body is named `SpkCancelRequest`** (the same schema) so the OpenAPI document holds one schema.
- **`playwright.config.ts` changed** (owner's choice) because the local API and web app did not start within 120 s.
- **QA ran on `bmi_trial`, not `bmi_dev`:** `bmi_dev` has no Supervisor and no SPK with steps, and the e2e passwords are random per run. `bmi_trial` was set to Live for the QA and back to Setup after; SPK-2611140005 there is now Cancelled (`pnpm trial:reset` restores it).

## Skills loaded
`superpowers:writing-plans` (plan), `ecc:search-first`, `ecc:coding-standards`. The other always-on skills and the API, Web and Test groups of the _Skill_ line were not loaded by the Skill tool; this is in the workflow audit.

## Evidence

### RED
- **E2E FLW-APR-05:** the Supervisor test failed waiting for `getByRole('button', { name: 'Cancel SPK' })`; the Planner test (no button) passed, as it guards an absence. A first run failed on the spec itself (SPKList shows no title column, its link is View), fixed before the RED run.
- **Shared:** `T15 the policy states are the From states of T15` failed: `APPROVER_CANCEL_STATUSES is not iterable`.
- **Policy unit:** the 21 `approverCancel` cases failed (no such policy).
- **Service unit:** 13 failed: `service.approverCancel is not a function`.
- **Integration:** 16 of 18 failed with 404 (no route); the `allowedActions` case already passed (Task 2), and the 404 case passed for the wrong reason until the route existed, then for the right one.
- **Web:** the dialog test failed (no export); 3 SPKDetail and SPKRejected cases failed (no button).

### GREEN
- Shared: 167 machine and enum tests, then the full suite (below).
- API unit `src/core/spk`: 51; integration `spk-approver-cancel.test.ts`: 18; `test/integration/spk` and `approvals`: 65.
- Web `components/spk` and `lib/spks-api.test.ts`: 41, then 3 in the api test.
- E2E FLW-APR-05: 2 passed (a first GREEN run timed out on the Planner sign-in on this machine; the rerun passed).

### QA against the artboards
- **CancelSPK** (`spk/CancelSPK.html`) against `/spk/5` on `bmi_trial`, 1440 × 900 and 760 px: the header Cancel SPK in the danger outline at the top right; the title "Cancel SPK-2611140005?", the note word for word, Reason, Keep the SPK, Cancel SPK; Escape closes it; after Cancel the pill reads Cancelled, the button is gone, and History reads "Cancelled the SPK: Vehicle sold before the repair" by Supervisor Budi S.
- **Kept different on purpose:** the SPK document link is hidden until TASK-212 (DEC-122); Cancel SPK is disabled while the reason is empty, as in the T6 dialog.
- **SPKDetail regression:** the header, tracker, step cards, context and approvals unchanged; the cancelled SPK keeps its step tracker as it was (TX-14 does not change the steps).
- **Console:** no error from the cancel flow (the only errors were the 401 and 403 of the sign-in tried while `bmi_trial` was in Setup).
- **Not compared:** AssignStep and CorrectStepTime (moved by DEC-140).

### Gates
- `check:coverage` "Coverage OK", `check:kiro-skills`, `check:secrets`, `lint`, `typecheck`, `check:client`, `check:layers`: pass.
- `format:check`: fails only on files outside git: `check_brackets.js`, `check_brackets2.js`, `check_lines.js` (untracked, not this task's) and `.impeccable/hook.cache.json` (ignored). Every TASK-124 file passes Prettier.

### Suites
- **Shared:** 26 files, 338 tests, coverage gates met. One existing assertion (`SPK_ACTIONS` equal to three actions) was updated for `approverCancel`.
- **Web:** 40 files, 252 tests; functions 81,09 %.
- **API unit:** 8 files, 86 tests.
- **API integration:** 288 passed, 1 skipped (the S3 contract run, CI only), 7 failed, all known local failures: 5 BullMQ (Redis in WSL), BR-10 in `db/identity-schema.test.ts`, NFR-14 in `harness/real-transactions.test.ts` (local PostgreSQL not in UTC). None touches TASK-124.
- **E2E, full:** 17 passed and 10 failed in one run: 9 sign-ins did not leave `/login` within 20 s on this machine and the shared accounts state then broke the specs after them. `--last-failed` on a fresh database: 13 passed. FLW-APR-05 passed in the full run.

## Notes for later tasks
- **TASK-308, TASK-502, TASK-313, TASK-612, TASK-610:** replace one method of `NoCancelStepsYet` each; the order is fixed in `SpkService.approverCancel`.
- **TASK-206:** add the step executors to the cancel notice.
- **TASK-212:** show the SPK document link of CancelSPK.
- **TASK-507:** AC-SPK-004 with a real posted issue and an Issued tyre.
