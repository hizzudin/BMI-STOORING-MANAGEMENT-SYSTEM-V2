# TASK-122 Approvals inbox, ApprovalReview, canApprove policy, stamps, Self-approved

- **Requirements:** REQ-SPK-005, REQ-SPK-006, REQ-SPK-007, REQ-APR-001, REQ-APR-002, REQ-APR-004, REQ-APR-005, REQ-APR-006 and REQ-APR-007.
- **Acceptance:** AC-SPK-001, AC-SPK-002, AC-SPK-005, AC-SPK-006, AC-APR-001 to AC-APR-004 and AC-IAM-005.
- **Rules:** BR-03, BR-04, C-24, C-25, DEC-02, DEC-03, DEC-83, TX-02, and T3 and T4 of SM-SPK.
- **Decision:** DEC-128 (PRD v2.40).
- **Journeys:** FLW-APR-01 and FLW-APR-06.
- **Tables read and written:** spks, spk_assignments, spk_approvals, audit_logs, notifications and idempotency_keys. No migration.

## Spec first (DEC-128, PRD v2.40)

The owner answered seven open points before any code (commit e20ec5c):
- **Inbox columns:** the PRD columns plus the urgency pill.
- **Order:** Urgent and High first, then the longest waiting.
- **Preview:** a preview panel, while every row keeps its own Open review.
- **History:** the decisions of every Approver. REQ-APR-007 was changed from "the user's own".
- **Badge:** read when a page loads and every 60 seconds.
- **Rejection reason:** shown in the Waiting on column of SPKList and on the SPKDetail History row, until TASK-123.
- **Later tasks' parts:** hidden.

The Approvals and ApprovalsHistory artboards gained the columns, the chips and the preview panel before the code. The plan is in `docs/superpowers/plans/2026-11-16-task122-approvals.md`; the owner approved it.

## What changed

### Shared
`schemas/approvals.ts`:
- inbox and History queries;
- inbox item, review, decision, decision request (the reason trimmed, at most 500 characters), History item and count;
- `PersonSchema` is now exported from `spks.ts`.

### API
- **`core/approvals/can-approve.ts`:** one policy table for every approval kind (§8.3):
  - the kind's capability;
  - the Planner switch kinds;
  - the item must still be waiting;
  - BR-03 `notOwnWork`, with the System Admin as the exception.
- **`core/approvals/approval-service.ts`:**
  - inbox, count, review and History;
  - Approve (T3, TX-02) and Reject (T4) under `runIdempotent`.
- **`ports/approvals.ts` and `infra/db/approval-gateways.ts`.**
- **`SpkGateway`:**
  - `insertApproval` gains `selfApproved` and `actedAt`;
  - new `openFirstStep` and `rejectionReasons`.
- **`AuditEntry.selfDecision`:** written to `audit_logs.self_decision`.
- **`ApprovalsController`:** `GET /approvals/count`, `/history`, `/spk` and `/spk/:id`; `POST /approvals/spk/:id/approve` and `/reject`.
- **SPKList:** a Rejected SPK waits on "Rejected: <reason>".
- **E2E database command:** seeds three SPKs waiting for approval, with their steps (DEC-126, until TASK-207). The web still never touches the database (DEC-66).
  - Their numbers come from `spk_number_seq` and `formatDocumentNumber`, as the API numbers SPKs (SPK-yymmddNNNN, NFR-15, DEC-104), after the owner noted that the first seed used made-up numbers.
  - The journeys find each SPK by its title, read its number from the page, and check the format.
  - The approvals integration test writes SPK-261116NNNN numbers.

### Web
- **`/approvals`:**
  - tabs Surat Perintah Kerja and History;
  - chips All and Creation, and the search;
  - the DEC-128 columns;
  - the urgency pill and Yours under the SPK number;
  - the Submitted date over its time;
  - the preview panel with Open review.
- **`/approvals/history`:** chips, the PRD columns, and a preview with the stamp, the reason and Open SPK.
- **`/approvals/spk/:id` (ApprovalReview):**
  - the SPK and its steps;
  - the decision card: Reject is enabled only with a reason; Approve commits at once;
  - the stamp plays a scale-in, none under reduced motion;
  - a retry keeps its Idempotency-Key.
- **Shell:** the Approvals menu item shows the waiting count, every 60 seconds.

## Skills loaded
- **Always-on:** search-first, coding-standards, git-workflow and verification-loop.
- **For this task:** hexagonal-architecture, nestjs-patterns, motion-foundations and security-review.
- **Loaded earlier in this session:** test-master, tdd-workflow, react-testing, e2e-testing and browser-qa.
- **Not loaded:** api-designer, fullstack-guardian, the other API and Web group skills, and architecture-decision-records (no divergence from design.md).

## Evidence

### RED
- **Shared:** `approvals.test.ts` failed (no module) before the schemas existed.
- **API:** `approvals.test.ts` failed 14 of 14 (404) before the routes existed.
- **Shell:** the badge test failed before the shell change.
- **Not run RED:** the web client test and the three screen tests were written before their components but first run after them.
- **E2E:** the two specs were written after the screens. This differs from WORKFLOW_STANDARDS §1 step 12.

### GREEN

**API integration `approvals.test.ts`: 14 of 14**

| Test | Covers |
| --- | --- |
| The creating Planner is refused; a Supervisor approves | AC-SPK-001 |
| Approval sets Active, step 1 Open with `opened_at`, the rest Locked; one stamp; step 1 executors notified | AC-SPK-002, T3, TX-02 |
| A reason of spaces is refused (400); with a reason the SPK is Rejected, shows "Rejected: Wrong vehicle" in the creator's tab, and the creator is notified | AC-SPK-005, AC-APR-004 |
| The System Admin's own SPK gets `self_approved` and `audit_logs.self_decision` | AC-SPK-006 |
| The same key replays the same answer with one stamp | NFR-01 |
| A stale version gives 409; an item already decided gives 403 | NFR-03 |
| An unknown SPK gives 404; a Mechanic gets 403 | |
| A Mechanic and a Planner with the switch off have no Approvals; the System Admin has | AC-APR-001 |
| The columns, the order, the search and the chip | REQ-APR-002, DEC-128 |
| After a Supervisor approves, the item leaves the GM's list and count | AC-APR-002 |
| One's own SPK is hidden, except for the System Admin, who sees it marked Yours | AC-APR-003 |
| With the switch on, a Planner decides others' SPKs but not its own; after the end time Approvals is gone | AC-IAM-005 |
| A Planner without the creation kind sees no creation items | BR-04 |
| History: every Approver's decisions, newest first, with the reason; the chip filters | REQ-APR-007 |

AC-IAM-005 differs from the AC in one detail: the test sets an end time a few minutes ahead and then sets one already passed, instead of moving the clock ten hours, because a session token would expire first.

**Other suites**
- OpenAPI: 12 of 12 (the decision schema has no transform, so the document builds).
- SPK, HTTP and IAM integration: 101 of 102 before the OpenAPI fix, then all pass.
- Shared: 307. Web: 166.
- Web screens and helpers: Approvals inbox 6, ApprovalReview 6, History 3, client 2, shell badge 2.
- E2E: 21 of 21 in the full run, including FLW-APR-01 (approve; reject with a reason, then the Planner's Rejected tab) and FLW-APR-06 (History, preview, Open SPK). After the seed time fix the approvals, SPK list and Create SPK specs were rerun and pass.

### Gates
Lint, typecheck, check:layers, check:secrets and `check-coverage --tests` pass. Prettier is clean on tracked files; only the untracked scratch files and `.impeccable/hook.cache.json` are flagged.

### Security review (security-review skill)
- Every input is validated by Zod schemas and `ParseIntPipe`.
- Queries are parameterized through Drizzle; the search escapes `\`, `%` and `_`.
- Decisions are checked by the L1 guard, then the L2 policy, at the time of sending.
- The idempotency key is scoped to the user and to a hash of the method, path and body.
- Errors are one sentence and carry no internals.
- No findings.

### QA at 1440 x 900 on the e2e database
Approvals, ApprovalReview (before and after Approve), History, and SPKList's Rejected tab were compared with their artboards.
- **Matches:**
  - tabs and chips;
  - the DEC-128 columns;
  - the preview panel with Open review;
  - the crumb, title, urgency pill and Back to inbox;
  - the step rows with their roles;
  - the dashed stamp while waiting, and the solid stamp "Approved by Supervisor: …" with its time;
  - the History preview with the stamp and the reason;
  - SPKList showing "Rejected: Wrong vehicle".
- **Fixed during QA:**
  - **Seed times:** the e2e seed wrote local times on a non-UTC session, so the times were off and the waiting time read 00:00:00. The seed now writes UTC.
  - **Table width:** the inbox table overflowed at 1440 px with the preview. The urgency pill now sits under the SPK number, the Submitted date sits over its time, and the title and requester wrap.
- **Kept:**
  - the Approvals badge refreshes on the next page load or within 60 seconds (DEC-128), so it still shows the old count right after a decision;
  - the decision card repeats Back to inbox below "Decided" (C-24).

### Local environment
The full API run with coverage needs Redis and PostgreSQL 16, as noted in TASK-125. On this machine a Windows PostgreSQL 18 holds port 5432 and WSL Redis is unreachable, so the queue tests and the time-zone test fail here. None of them touches this task.
