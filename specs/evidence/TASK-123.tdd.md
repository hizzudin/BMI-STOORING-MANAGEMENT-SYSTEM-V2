# TASK-123 Rejected SPK, Edit and resubmit, creator cancel

- **Requirement:** REQ-SPK-007.
- **Acceptance:** AC-SPK-005.
- **Rules:** T5 and T6 of SM-SPK, DQ-06, DEC-101.
- **Decision:** DEC-129 (PRD v2.41).
- **Journey:** FLW-PLN-03.
- **Tables:** spks, spk_approvals, audit_logs, idempotency_keys. No migration.

## Spec first (DEC-129, PRD v2.41, commit 308bdfe)

The owner decided before any code:
- **Conflict resolved for DEC-101:** a Rejected SPK stays Rejected, and its creator edits and resubmits it or cancels it with a reason. The SPKRejected row of the action map ("(no Cancel)", "returns as a Draft") and the artboard text were corrected, and the artboard gained Cancel SPK and the real step status.
- **Where SPKRejected shows:** SPKDetail shows it while the SPK is Rejected; the Rejected tab and the rejection notice open it; Waiting on is the creator again.
- **Create SPK:** shows the rejection note above the form, and gains Cancel SPK.
- **Cancel SPK:** asks for a reason, and the page then goes to the Cancelled tab. Nobody is notified.
- **SPK document:** hidden until its task.

The plan is in `docs/superpowers/plans/2026-11-16-task123-rejected-spk.md`; the owner approved it.

## What changed
- **Shared:** `SPK_ACTIONS` gains `cancel`; new `SpkCancelRequestSchema` (the reason is required, trimmed, 1 to 500 characters).
- **API:**
  - `SPK_POLICIES.cancel` (Draft or Rejected, creator only);
  - `SpkService.cancel` under `runIdempotent`;
  - `SpkGateway.cancel` sets Cancelled, `cancel_reason` and `cancelled_by`;
  - `POST /spks/:id/cancel`;
  - `SpkGateways` gains `idempotency`, and approvals reuse it;
  - SPKList's `rejectionReasons` is removed (DEC-129).
- **Web:**
  - `SpkRejected` with `RejectionNote`;
  - `CancelSpkDialog`;
  - `SpkDetail` renders SPKRejected while Rejected;
  - `CreateSpk` shows the note and Cancel SPK;
  - SPKList reads `?tab=` and opens Rejected rows on `/spk/:id`.
- **E2E seed:** "Resubmit me" and "Cancel me", already rejected by the e2e Supervisor.
- **FLW-APR-01 e2e:** the rejected SPK is now checked in the Planner's Rejected tab and on SPKRejected, instead of in the removed "Rejected: <reason>" text.

## Divergence from the plan
The plan named a `cancelled_at` column. §9.6 has none, so nothing was added to the data model. The time of a cancel is the time of its audit record.

## Skills loaded
- **Always-on:** search-first, coding-standards, git-workflow and verification-loop.
- **For this area:** hexagonal-architecture and nestjs-patterns (TASK-122), security-review (TASK-122), and motion-foundations (not needed here).
- **Not loaded:** the rest of the API and Web groups.

## Evidence

### RED, each run before its code
- **Shared:** 2 failed (`cancel` was not an action, and there was no cancel schema).
- **API `spk-cancel.test.ts`:** 8 of 9 failed. T5 already passed, since it was built in TASK-121.
- **Web:** 9 failed (the dialog module did not exist; SPKRejected, the Create SPK note and Cancel SPK, SPKList's Rejected row and tab, and the client cancel).
- **E2E:** `create-spk-flw-pln-03.spec.ts` was written before the web screens.

### GREEN
- **API `spk-cancel.test.ts`, 9 of 9:**
  - AC-SPK-005: in the creator's Rejected tab, waiting on the creator, with the reason in the detail;
  - T5: edit and resubmit gives Pending approval, a second Submit row, and the Approvers notified;
  - `allowedActions`: the creator gets edit, submit and cancel; others get none;
  - T6: cancel of a Rejected SPK and of a Draft (Cancelled, reason, who, one audit record, no notice, in the Cancelled tab);
  - a missing or blank reason gives 400;
  - another Planner, the rejector and an Active SPK give 403;
  - a stale version gives 409;
  - the same key replays the answer with one audit record.
- **Updated for DEC-129:** `create-spk.test.ts` and `spk-list.test.ts` expect `cancel` in `allowedActions`; the approvals AC-SPK-005 test expects Waiting on to be the creator.
- **Totals:**
  - SPK, approvals and HTTP integration: 59 of 59;
  - shared: 309;
  - web: 179, including SPKRejected 4, Cancel SPK 3, Create SPK 3 new, SPKList 2 new and the client 1 new.
- **E2E:** the full run passed 21 of 23. The 2 failures were fixed and rerun with the related specs (approvals, FLW-PLN-03, Create SPK, SPK list): 8 of 8.
  - FLW-APR-01 still expected the removed "Rejected: <reason>" text in SPKList.
  - FLW-PLN-03 counted rows before the search answered. It now opens `/spk?tab=rejected` and waits for "Page 1 of 1 (1 total)".

### QA at 1440 x 900 on the e2e database
SPKList (Rejected tab), SPKRejected, the Cancel SPK dialog, and CreateSPK of a Rejected SPK were compared with the SPKRejected and CreateSPK artboards.
- **Matches:**
  - the crumb, the title and the Rejected pill, and the subline;
  - the red rejection note with the rejector, time and reason;
  - the SPK card (category, urgency, description) and the Steps card, each step Locked;
  - the note "It stays Rejected…";
  - Cancel SPK and Edit and resubmit;
  - the dialog with its required reason, Keep SPK and Cancel SPK;
  - CreateSPK with the same note above the form, and Cancel, Cancel SPK, Save draft and Submit for approval.
- **Kept (DEC-129):** SPK document is hidden. The artboard's step lines ("Clutch kit 1") wait for the step composer (TASK-207), so a step shows its executor roles.

### Gates
Lint, typecheck, check:layers and `check-coverage --tests` pass. Prettier is clean on tracked files.
