# TASK-122 plan: Approvals inbox, ApprovalReview, canApprove, stamps, Self-approved

Branch `feat/phase1-task122-approvals`. Spec: REQ-SPK-005 to 007, REQ-APR-001, 002, 004 to 007, BR-03, BR-04,
C-24, C-25, DEC-02, DEC-03, DEC-83, DEC-128 (PRD v2.40), TX-02, T3, T4 of SM-SPK. No new table, no migration.

## Goal

An Approver opens Approvals, finds the SPKs waiting for creation approval, opens the review and approves
(stamp, SPK Active, step 1 Open) or rejects with a reason (SPK Rejected, creator notified). One
`canApprove` decides every approval kind. History shows every Approver's past decisions.

**Done when:**
- every AC on the task line passes as an integration test: AC-SPK-001, 002, 005, 006, AC-APR-001 to 004
  and AC-IAM-005;
- `e2e FLW-APR-01` and `e2e FLW-APR-06` pass;
- Approvals, ApprovalReview and ApprovalsHistory match their artboards, and SPKList shows no regression.

## Architecture

### Shared (`packages/shared/src/schemas/approvals.ts`)
- **Queries:**
  - `ApprovalInboxQuerySchema {kind?: 'Creation', search?}`;
  - `ApprovalHistoryQuerySchema {decision?: 'Approve' | 'Reject'}`.
- **`ApprovalInboxItem`:**
  - `spkId, spkNumber, priority, vehicle {id, licensePlate, className}, title, category`;
  - `kind: 'Creation'`, `requestedBy` (role and name), `submittedAt`, `waitingSeconds`;
  - `yours` (set for the System Admin's own SPK), `description`, `steps[] {sequenceNo, name, executorRoles}`.
- **`ApprovalInboxResponse`:** `{items, waiting}` (the Surat Perintah Kerja tab count).
- **`ApprovalReviewSchema`:**
  - the item plus `status` and `version`;
  - `decision?: {action, by, at, selfApproved, note}`;
  - `allowedActions: ('approve' | 'reject')[]`.
- **`ApprovalDecisionRequestSchema`:** `{version, reason?}`. The reason is trimmed; a reject without one is refused by the service (C-25, AC-APR-004).
- **`ApprovalHistoryItem`:**
  - `decidedAt, spkId, spkNumber, vehicle, kind, decision`;
  - `decidedBy, requestedBy, reason, selfApproved`.
- **`ApprovalCountResponse`:** `{count}` for the badge.

### Port (`apps/api/src/ports/approvals.ts`), plain data only
- `ApprovalGateway`:
  - `waitingCreation({search?})`: SPKs in Pending_Approval, each with its last Submit row (time and person) and its steps;
  - `history({decision?})`: the Approve and Reject rows, newest first.
- `SpkGateway` (existing), extended:
  - `insertApproval` gains `selfApproved`;
  - new `openFirstStep(spkId, at)`: step 1 becomes Open with `opened_at`, and the other steps become Locked;
  - new `lastDecisionNote(spkIds)`: the reason of the latest Reject.
- `AuditEntry` gains `selfDecision?: boolean`, written to `audit_logs.self_decision`.

### Core
- **`core/approvals/can-approve.ts`:** one policy table for every approval kind (§8.3):
  - L1: `spk.approve` for the SPK kinds; `count.approve` for the count kinds.
  - Planner kind rule: a Planner decides only the kinds ticked on a switch that is still on (BR-04, AC-IAM-005). The switch is read in the same transaction as the decision.
  - BR-03: `notOwnWork` refuses the decision on your own item; the System Admin is the exception and gets the Self-approved mark (`isSelfDecision`).
  - The state must still be the waiting one (Pending_Approval for creation).
  - The kinds of later tasks reuse this table; only creation is wired now.
- **`core/approvals/approval-service.ts`:**
  - `inbox`: hides the viewer's own SPKs, except for the System Admin, who sees them marked `yours` (AC-APR-003). A Planner without `spk_creation` ticked gets an empty list. Order: Urgent and High first, then the longest waiting (DEC-128).
  - `count`: the same filter, used by the badge.
  - `review`: refused (403) when `canApprove` refuses viewing. A decided item shows its decision, read only.
  - `approve` (T3, TX-02), under the `Idempotency-Key` (NFR-01, `runIdempotent`):
    - lock the SPK;
    - assert `approve`;
    - `openFirstStep`;
    - set Active at the version on screen;
    - write the approval row (Creation, Approve, `selfApproved`);
    - write the audit record (`selfDecision`);
    - notify the executor roles of step 1, or its assignee.
  - `reject` (T4), under the `Idempotency-Key`:
    - a reason is required ("Give a reason to reject.");
    - set Rejected;
    - write the approval row (Creation, Reject, note = reason) and the audit record;
    - notify the creator (REQ-SPK-007).
  - `history`: the decisions of every Approver (DEC-128).
- **`SpkListService.waitingOn`:** a Rejected SPK shows `Rejected: <reason>`.
- **SPKDetail:** the History row of a Reject carries the reason (DEC-128).

### HTTP (`http/approvals/approvals.controller.ts`)
| Route | Capability |
| --- | --- |
| `GET /approvals/spk` | spk.approve |
| `GET /approvals/spk/:id` | spk.approve |
| `POST /approvals/spk/:id/approve` | spk.approve, Idempotency-Key |
| `POST /approvals/spk/:id/reject` | spk.approve, Idempotency-Key |
| `GET /approvals/count` | spk.approve or count.approve |
| `GET /approvals/history` | spk.approve or count.approve |

Errors: 403 `ActionRefusedError`, 404 `SpkNotFoundError`, 409 version mismatch (existing filter). After that, run `gen:client`.

### Web
- **`/approvals` (Approvals inbox):**
  - tabs: Surat Perintah Kerja with its count, and History; Warehouse is hidden;
  - chips All and Creation; Amendment and Completion are hidden;
  - search by SPK or plate;
  - the DEC-128 columns, each row with Open review;
  - selecting a row shows the preview panel with Open review.
- **`/approvals/history`:** chips All, Approved and Rejected; the table; a preview with the reason and the stamp; Open SPK goes to `/spk/:id`.
- **`/approvals/spk/[id]` (ApprovalReview):**
  - crumb, "Creation review", the urgency pill, Back to inbox;
  - SPK card: number, plate, category and the step rows. The report reference and part age are hidden.
  - Decision card:
    - the stamp: dashed while pending; solid with a short scale-in once decided (DEC-83), and none under `prefers-reduced-motion`;
    - the reason textarea;
    - Reject is enabled only with text (C-25);
    - Approve commits at once and disables Reject (C-24); the page then shows "Decided" and Back to inbox;
    - Self-approved shows on the stamp;
    - a refusal shows its sentence (C-34).
- **Shell:** the Approvals menu item shows a count badge, read when a page loads and every 60 seconds (DEC-125 timer).
- Approve and reject send a fresh `Idempotency-Key` per click, which a retry keeps.

## Tests (each written before its part)

### Shared (`approvals.test.ts`)
- the query defaults;
- a reject without a reason is refused after trimming.

### API integration (`test/integration/approvals/approvals.test.ts`), one `it` per ID
- **AC-SPK-001:** the creating Planner is refused; a Supervisor is accepted.
- **AC-SPK-002 (T3, REQ-SPK-005):** after approval of three steps, step 1 is Open with `opened_at`, steps 2 and 3 are Locked, the SPK is Active, and there is one Approve row.
- **AC-SPK-005 and AC-APR-004:**
  - a reject without a reason is refused;
  - with a reason the SPK is Rejected;
  - the creator's Rejected tab shows `Rejected: <reason>`;
  - the creator is notified.
- **AC-SPK-006:** the System Admin's own SPK gets `self_approved` and `audit_logs.self_decision`.
- **AC-APR-001:** a Mechanic, and a Planner with the switch off, get 403 on `/approvals/count`; the System Admin gets 200. The menu test in shared already covers the menu.
- **AC-APR-002:** after a Supervisor approves, the item leaves the GM's inbox and count.
- **AC-APR-003:**
  - the creator's own SPK is not in its inbox;
  - the System Admin sees its own, marked `yours`.
- **AC-IAM-005:**
  - with the switch on and `spk_creation` ticked until a time, a Planner approves another user's SPK;
  - its own SPK is refused;
  - once the end time passes, `/approvals/count` returns 403.
- **NFR-01:** a second approve with the same key replays the response, writes one Approve row, and changes the state once.
- **409:** a stale version is refused.
- **History:** every Approver's decisions, newest first; the decision filter; the reason; the Self-approved mark.

### Web unit
- **`approvals-inbox.test.tsx`:**
  - the columns;
  - the order the server sends;
  - the preview on row select;
  - Open review;
  - chips and search ask again;
  - the hidden parts (Warehouse, Amendment, Completion) are absent.
- **`approval-review.test.tsx`:**
  - Reject is disabled until there is a reason;
  - Approve sends the version and a key, then shows the stamp and Decided;
  - Self-approved;
  - a refusal shows its sentence;
  - the stamp has no animation under reduced motion.
- **`approvals-history.test.tsx`:** chips, the preview with the reason and the stamp, Open SPK.
- **`SignedInShell`:** the Approvals badge.
- **`spks-api` / `approvals-api`:** the `Idempotency-Key` header and the query string.

### E2E
- **`approvals-flw-apr-01.spec.ts`:**
  - the Planner creates and submits an SPK; its steps are written by the test through the e2e database, as DEC-126 allows until TASK-207;
  - the Supervisor goes to Approvals, Creation, the row, Open review, Approve: the stamp shows and the SPK is Active with step 1 Open on SPKDetail;
  - a second SPK is rejected with a reason and shows in the Planner's Rejected tab with that reason.
- **`approvals-flw-apr-06.spec.ts`:** History lists both decisions with the reason, the preview shows the stamp, and Open SPK opens SPKDetail.

## Review focus (failure modes and the test that owns each)
1. **The Planner switch ends between loading the page and pressing Approve:** the decision reads the switch inside the transaction. Owned by AC-IAM-005 (the past-end-time case).
2. **Two Approvers decide at once:** the row lock and the version check give 409 to the second. Owned by the 409 test.
3. **Retry after a timeout:** the Idempotency-Key replays the response, so there is no second Approve row. Owned by the NFR-01 test.
4. **A reason of spaces only:** it is trimmed and refused. Owned by the shared test and AC-APR-004.
5. **A user without spk.approve calls the routes directly:** the guard returns 403, and so does the review. Owned by AC-APR-001.

## Out of scope (hidden per DEC-128)
- The Warehouse tab, and the Amendment and Completion kinds (TASK-310, 506, 611, 210).
- The report reference and part age (REQ-APR-011).
- Needs my action on the dashboard (TASK-615).
- The REQ-REG-004 step checks of TX-02 (TASK-207).
- SPKRejected (TASK-123).

## Execution
Native, in this session.
- **Skills:** the always-on skills; the API group plus hexagonal for the port and service; the Web group for the screens; security-review before the PR.
- **Order:** shared, API (RED, then GREEN), `gen:client`, web, e2e, QA against the artboards, gates, bookkeeping.
