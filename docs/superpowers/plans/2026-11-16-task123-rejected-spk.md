# TASK-123 plan: Rejected SPK, edit and resubmit, creator cancel

Branch `feat/phase1-task123-rejected-spk`. Spec: REQ-SPK-007, AC-SPK-005, T5 and T6 of SM-SPK, DQ-06, DEC-101, DEC-129 (PRD v2.41, commit 308bdfe). No migration (`spks.cancel_reason`, `cancelled_by` and `cancelled_at` exist).

## Goal

The creator of a rejected SPK sees why it was rejected and either fixes it and submits it again, or cancels it with a reason.

**Done when:**
- AC-SPK-005, T5 and T6 pass as integration tests;
- `e2e FLW-PLN-03` passes;
- SPKRejected matches its artboard;
- SPKList shows no regression.

## What already exists (TASK-121, TASK-122)

- **T5 is built:** `SPK_POLICIES.edit` and `submit` allow a creator's Draft or Rejected SPK, and Submit sets Pending_Approval with a new Submit row and a new notice.
- **Rejection:** TASK-122 writes the Reject row with the reason and notifies the creator, linking to `/spk/:id`.
- **SPKList:** shows "Rejected: <reason>" in Waiting on (DEC-128). This is removed now, as DEC-129 says.

## Architecture

### Shared
- `SPK_ACTIONS` gains `cancel`.
- `SpkCancelRequestSchema {version, reason}`: the reason is trimmed, 1 to 500 characters ("Give a reason to cancel.").

### API
- **`SPK_POLICIES.cancel` (T6):**
  - `anyOf: ['spk.create']`;
  - `inState(Draft, Rejected)`;
  - `onlyOwner(createdBy)`, with "Only the creator of this SPK can cancel it."
  - A system-made Draft cancelled by a Planner or the System Admin (TX-24) comes with the Report Breakdown tasks.
- **`SpkService.cancel(actor, id, request, key)`:**
  - runs under `runIdempotent` (NFR-01); `SpkGateways` gains `idempotency`;
  - lock the SPK and assert `cancel`;
  - `spks.cancel(id, version, {reason, by, at})` sets Cancelled, `cancel_reason`, `cancelled_by` and `cancelled_at`;
  - write one audit record `cancel` with the reason;
  - no notice (DEC-129).
- **Route:** `POST /spks/:id/cancel` (spk.create, Idempotency-Key). It returns `SpkResponse`; a refusal is 403 and a stale version 409.
- **`SpkListService.waitingOn`:** a Rejected SPK waits on its creator again. `rejectionReasons` and its gateway method are removed.
- **SPKList rows:** a Rejected SPK opens `/spk/:id` (SPKRejected); a Draft still opens CreateSPK in edit mode (DEC-127).

### Web
- **`SpkDetail`:** while the SPK is Rejected it renders **`SpkRejected`**:
  - the crumb, the title and the Rejected pill;
  - the subline: plate, class and "created by";
  - the rejection note (`.note.bad`): "Rejected by <role> <name> · <time WIB>" and the reason, from the latest Reject row of `detail.approvals`;
  - an SPK card (category, urgency, description) and a Steps card (number, name, the real step status);
  - for the creator only (from `allowedActions`): the note "It stays Rejected with this note…", **Cancel SPK**, and **Edit and resubmit**, which goes to `/spk/:id/edit`;
  - SPK document stays hidden.
- **`CancelSpkDialog`:**
  - built on the overlay and dialog styles of `ConfirmDialog`;
  - a required reason textarea; Cancel SPK is disabled until the reason has text;
  - Keep SPK, Escape and the scrim close it (C-14);
  - on success the page goes to `/spk` on the Cancelled tab;
  - a refusal or a 409 shows its sentence.
- **SPKList:** accepts `?tab=cancelled` (and any tab) from the URL, so the cancel can land on that tab.
- **`CreateSpk` (edit mode):**
  - for a Rejected SPK, the latest rejection note shows above the form, read from `getDetail`;
  - **Cancel SPK** is shown when the SPK's `allowedActions` include `cancel`;
  - the existing Cancel button still leaves without saving (C-12).

### E2E seed
Two more SPKs, created by the e2e Planner, are seeded Rejected by the Supervisor with a reason and with their steps: "Resubmit me" and "Cancel me". Their numbers come from `spk_number_seq` (NFR-15).

## Tests (written first, run red before the code)

### Shared
- `cancel` is in `SPK_ACTIONS`.
- The cancel request trims the reason and refuses one that is empty or longer than 500 characters.

### API integration (`test/integration/spk/spk-cancel.test.ts`)
- **AC-SPK-005:** a Rejected SPK is in its creator's Rejected tab. Its detail carries the Reject row with the reason, and Waiting on is the creator.
- **T5:** the creator edits the Rejected SPK and submits it again. It becomes Pending_Approval with a second Submit row, and the Approvers are notified again.
- **T6:**
  - the creator cancels a Draft and a Rejected SPK with a reason: Cancelled, with `cancel_reason`, `cancelled_by`, `cancelled_at` and one audit record;
  - a cancel without a reason is refused with 400;
  - another Planner, a Supervisor (the rejector) and an Active SPK are refused with 403;
  - a stale version gives 409;
  - the same Idempotency-Key replays the answer.
- **`allowedActions`:** the creator of a Rejected SPK gets `edit`, `submit` and `cancel`; others get none.

### Web unit
- **`spk-rejected.test.tsx`:**
  - the note with the rejector, time and reason;
  - the SPK and steps cards with the real step status;
  - Edit and resubmit and Cancel SPK for the creator only;
  - no SPK document button.
- **`cancel-spk-dialog.test.tsx`:** the reason is required; it sends the version, reason and key; Keep SPK and Escape close it; a refusal shows its sentence.
- **`create-spk.test.tsx`:** the rejection note for a Rejected SPK; Cancel SPK appears when allowed.
- **`spk-list.test.tsx`:** a Rejected row opens `/spk/:id`; the tab comes from the URL.
- **`spks-api.test.ts`:** cancel sends the Idempotency-Key.

### E2E (`create-spk-flw-pln-03.spec.ts`)
- The Planner opens the Rejected tab, then "Resubmit me", and sees the reason on SPKRejected. Edit and resubmit shows the note on CreateSPK; Submit for approval moves it to the Pending approval tab.
- The Planner opens "Cancel me", presses Cancel SPK, enters a reason and confirms. The SPK is in the Cancelled tab, and SPKDetail shows it Cancelled.

## Review focus (failure modes and the test that owns each)
1. **The rejector tries to cancel:** 403. Owned by the T6 refusal test.
2. **Cancel after the creator resubmitted it in another tab:** the state rule gives 403, or the version gives 409. Owned by the T6 refusal and 409 tests.
3. **A reason of spaces only:** 400 at the API, and the button stays disabled in the web. Owned by the shared and dialog tests.
4. **A retry after a timeout:** the key replays, so there is one audit record. Owned by the NFR-01 case.
5. **SPKList still shows "Rejected: reason":** removed, and Waiting on is the creator. Owned by the AC-SPK-005 test.

## Out of scope
- SPK document (TASK-212 or its task).
- The approver's cancel of an open SPK, with CancelSPK (TASK-124).
- The Planner or System Admin cancelling a system-made Draft (with Report Breakdown, TX-24).

## Execution
Native, in this session.
- **Skills:** the always-on skills; the API group (nestjs-patterns, api-design, error-handling) and hexagonal-architecture for the port; the Web group (react-patterns, frontend-a11y) for the screens; browser-qa for the QA.
- **Order:** shared, API (RED, then GREEN), `gen:client`, E2E spec written next, web (RED, then GREEN), E2E run, QA, gates, bookkeeping.
