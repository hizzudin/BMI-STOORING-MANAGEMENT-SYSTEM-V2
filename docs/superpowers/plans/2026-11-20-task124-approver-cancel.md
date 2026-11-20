# TASK-124 Approver Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Approver (Supervisor, GM, System Admin, capability `spk.cancel`) cancels an SPK in any open status with a required reason from SPKDetail through the CancelSPK dialog (T15, REQ-SPK-008).

**Architecture:** A new policy action `approverCancel` and a new route `POST /spks/:id/approver-cancel`, beside the creator cancel (T6) that stays unchanged. The service runs TX-14 in one transaction in the DEC-140 order. The steps before Cancelled go through one port, `SpkCancelSteps`, whose adapter does nothing until the owning tasks fill it. SPKDetail shows "Cancel SPK" when `allowedActions` holds `approverCancel` and opens the CancelSPK dialog.

**Tech Stack:** NestJS, Drizzle, Zod (`@bmi/shared`), Next.js, Vitest, React Testing Library, Playwright. No new package, no migration.

**Spec:** `PRD.md` §3.2 T15, BR-06, DEC-58, DEC-129, DEC-140 (PRD v2.52, commit beddda1); `docs/prd/areas/4.1-spk.md` REQ-SPK-008, REQ-SPK-011; `docs/prd/data-model.md` TX-14, §9.6; `docs/prd/ui-action-map.md` CancelSPK and SPKDetail rows; `docs/prd/flows.md` FLW-APR-05; `specs/design.md` §5.23 (written before code); artboard `Design Artifact/spk/CancelSPK.html`.

**Branch:** `feat/phase1-task124-approver-cancel-v2`, taken over from Kiro on the owner's word (2026-11-20). Kiro's empty branch `feat/phase1-task124-approver-cancel` is still checked out in `D:/project/bmi-kiro`; `next-numbers.mjs` lists TASK-124 twice until Kiro or the owner deletes it (escalated to the owner, WORKFLOW_STANDARDS §12 "Two agents same task"). §2B does not apply: the Kiro branch has no code.

## Success criteria (Done when)
- The task's _Verify_ line passes: `e2e FLW-APR-05`; `qa` CancelSPK against its artboard; regression check of SPKDetail.
- Every test of the three sources below passes; `node specs/tools/check-coverage.mjs --tests` prints "Coverage OK".
- Every gate of WORKFLOW_STANDARDS §4 passes; the evidence, CONTEXT row 50 and the AGENT_LOG row with the workflow audit are written.
- The owner confirmed the implementation (§6.4) before any PR.

## Workflow (WORKFLOW_STANDARDS §1, §2A, §4, §6, §11)

| Step | What | State |
| --- | --- | --- |
| §6.1 | `next-numbers.mjs` (DEC-140, v2.52, row 50, no migration); branch from `main` | Done |
| §1 1–8 | AGENT_GUIDE, CONTEXT, requirements, design, tasks, _Read_ files, PRD IDs, artboard CancelSPK | Done |
| §1 10 | Owner questions answered → DEC-140 in PRD.md, history.md, tasks.source.mjs and design.md §5.23; committed | Done (design.md in the revision commit) |
| §1 11, §2A | This plan; owner review; execution method (Native or Subagent) | Waiting for "Ya, setujui" |
| §1 9, §7 | Always-on skills, then the area skills of each part before writing it (listed per task) | Per task |
| §1 12 | E2E FLW-APR-05 first (Task 1) | After approval |
| §1 13–14 | Unit and integration tests RED, then GREEN (Tasks 2–6) | After approval |
| §1 15–18, §4 | Verify, evidence, tasks.source.mjs, CONTEXT, AGENT_LOG (Tasks 7–8) | After approval |
| §1 19 | QA UI comparison, the final step (Task 9) | After approval |
| §1 20, §6.3–6.5 | Workflow audit, push, owner confirmation, PR on "Ya, buat PR", merge on "Ya, merge setelah hijau", cleanup (Task 10) | After approval |

## Global Constraints
- One entity, one name: SPK (DEC-106). Never "Work Order" or "WO".
- Permissions: L1 `@RequireCapability('spk.cancel')`, L2 the `approverCancel` policy, L3 `allowedActions` on the SPK (DEC-93); never the role name.
- `core/` imports only `ports/` and `@bmi/shared`; `pnpm check:layers` passes.
- The mutating route takes an Idempotency-Key (NFR-01, `runIdempotent`) and the version on screen (NFR-03).
- Every state change writes `audit_logs` with before and after (NFR-02).
- What a later task builds is hidden, not disabled (DEC-122): the dialog's "SPK document" link stays hidden until TASK-212.
- Test titles start with the ID they prove.
- No migration: `spks.cancelled_by`, `cancel_reason`, the `Cancel` value of `approval_action_t` and the check `status <> 'Cancelled' OR cancel_reason IS NOT NULL` exist (0002, 0009).
- Commits stage named files only, Conventional Commits with `[TASK-124, REQ-…, …]`; never `apps/web/next-env.d.ts`, `HANDOFF_PROMPT.md`, `check_*.js` or `apps/web/AGENTS.md`.

## Decisions I made (the owner may change them before approval)
1. **A separate route and action** (`approverCancel`, `POST /spks/:id/approver-cancel`). T6 (`cancel`, `spk.create`, creator only) stays as DEC-129 built it. When the System Admin created a Draft or Rejected SPK both actions are allowed; SPKDetail offers the Approver one.
2. **A `spk_approvals` row** with action `Cancel` and the reason as its note, so the History tab shows "Cancelled the SPK: <reason>" (TASK-125 already renders it) and ApprovalsHistory can list it. Stage: Draft, Pending_Approval, Rejected → `Creation`; Pending_Amendment → `Amendment`; Active, In_Progress, Pending_Verification → `Completion`.
3. **The notice to the creator:** kind `Approval`, title `SPK-… was cancelled`, body the reason, link `/spk/:id`, dedupe key `spk:<id>:cancel`; not sent when the Approver is the creator. Executors follow in TASK-206 (DEC-140).
4. **Refusal messages:** a final SPK → "This SPK is already Completed or Cancelled."; no `spk.cancel` → the usual 403 sentence; an empty reason → "Give a reason to cancel." (the existing schema).
5. **After Cancel** the dialog closes and SPKDetail reloads with the Cancelled pill and the History row; no link to SPKList is added (the artboard has none).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `packages/shared/src/machines/index.ts` | modify | export `OPEN_SPK_STATES` (today the private `OPEN_SPK`) |
| `packages/shared/src/schemas/spks.ts` | modify | `approverCancel` in `SPK_ACTIONS`; `SpkApproverCancelRequestSchema` |
| `apps/api/src/ports/spk-cancel-steps.ts` | create | `SpkCancelSteps`, the TX-14 steps before Cancelled |
| `apps/api/src/ports/spks.ts` | modify | `SpkGateways.cancelSteps` |
| `apps/api/src/infra/db/spk-cancel-steps.ts` | create | `NoCancelStepsYet`, every step a no-op naming its owning task |
| `apps/api/src/infra/db/` (the `SpkGateways` factory) | modify | wire `cancelSteps` into the same transaction |
| `apps/api/src/core/spk/spk-service.ts` | modify | `SPK_MESSAGES.alreadyFinal`, `SPK_POLICIES.approverCancel`, `SpkService.approverCancel` |
| `apps/api/src/http/spks/spks.controller.ts` | modify | `POST /spks/:id/approver-cancel` |
| `packages/api-client/openapi.json`, `src/schema.gen.ts` | regenerate | `approverCancelSpk` |
| `apps/web/lib/spks-api.ts` | modify | `approverCancel(id, body, key)` |
| `apps/web/components/spk/ApproverCancelDialog.tsx` | create | the CancelSPK dialog |
| `apps/web/components/spk/SpkDetail.tsx` | modify | Cancel SPK in the header, reload after cancel |

## Tests (three sources, WORKFLOW_STANDARDS §3)
- **Acceptance (_Acceptance_):** the task line has none. AC-SPK-004 (the order with a real issue and tyre) is placed in TASK-507 by `specs/acceptance-tests.md`; this task proves the order with a recording fake (Task 4).
- **Journey (_Journey_):** FLW-APR-05, one E2E spec, written first (Task 1).
- **Rules (_Rules_):** T15 of SM-SPK, BR-06 (no stock change outside the listed documents: the cancel changes no stock in this task), TX-14 (the order and one transaction), DEC-140; with NFR-01, NFR-02, NFR-03, DEC-93 and DEC-133 refusals and replays (Tasks 2, 4, 5).
- **Regression:** every existing test of SPKDetail, SPKList, CancelSpkDialog (T6) and `spk-cancel.test.ts` stays green.

## Review Focus
1. **A stale screen:** the Approver opens SPKDetail, the creator cancels it (T6) in another tab, then the Approver confirms → 409 with the version sentence, nothing written twice (Task 5).
2. **A retried click:** the same Idempotency-Key and body replays the first answer; no second approval row, notice or audit row (Task 5).
3. **The System Admin in Setup mode:** the cancel works (DEC-133 restricts approvals only) and the audit row is not marked self-decision (Task 5).
4. **A Planner or Warehouse Manager** sees no Cancel SPK on SPKDetail and gets 403 from the route even with a valid body (Tasks 5, 6).
5. **The order of TX-14:** a failing step rolls back the whole cancel; the SPK stays in its status (Task 4).

---

### Task 1: E2E FLW-APR-05 first (§1 step 12)

**Skills:** always-on (`ecc:search-first`, `ecc:coding-standards`, `ecc:git-workflow`, `ecc:verification-loop`, `ecc:architecture-decision-records`), then `test-master`, `ecc:tdd-workflow`, `ecc:e2e-testing`.

**Files:**
- Create: `apps/web/e2e/approvals-flw-apr-05.spec.ts` (helpers from `spk-helpers.ts`, pattern of `approvals-flw-apr-01.spec.ts`)

- [ ] Step 1: write `FLW-APR-05 a Supervisor cancels a Pending approval SPK with a reason; SPKDetail shows Cancelled and the History row "Cancelled the SPK: <reason>"; the SPK is in the Cancelled tab of SPKList`, and `FLW-APR-05 a Planner sees no Cancel SPK on the same SPK`.
- [ ] Step 2: `pnpm --filter @bmi/web build`, then in `apps/web`: `TEST_DATABASE_URL=postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev npx playwright test e2e/approvals-flw-apr-05.spec.ts`; expected FAIL (no Cancel SPK button). Record the RED in the evidence. Dev servers stopped first; no run while Kiro runs E2E.
- [ ] Step 3: commit `test(spk): FLW-APR-05 E2E first, red [TASK-124, REQ-SPK-008]`.

### Task 2: Shared schema and the policy

**Skills:** API group (`nestjs-expert`, `api-designer`, `fullstack-guardian`, `ecc:nestjs-patterns`, `ecc:backend-patterns`, `ecc:api-design`, `ecc:error-handling`).

**Files:** `packages/shared/src/machines/index.ts`, `packages/shared/src/schemas/spks.ts`, `apps/api/src/core/spk/spk-service.ts`; test `apps/api/src/core/spk/spk-policies.spec.ts` (new).

**Interfaces:**
- Produces: `OPEN_SPK_STATES: readonly SpkState[]`; `SPK_ACTIONS = ['edit', 'submit', 'cancel', 'approverCancel']`; `SpkApproverCancelRequest = { version: number; reason: string }`; `SPK_POLICIES.approverCancel = { anyOf: ['spk.cancel'], rules: [inState(status, OPEN_SPK_STATES, SPK_MESSAGES.alreadyFinal)] }`.

- [ ] Step 1: write the failing tests: `T15 an actor with spk.cancel may approverCancel in each of the seven open states`; `T15 approverCancel is refused on Completed and Cancelled with "This SPK is already Completed or Cancelled."`; `DEC-93 without spk.cancel approverCancel is not in allowedActions`; `DEC-129 the creator cancel policy is unchanged (Draft, Rejected, owner only)`.
- [ ] Step 2: `cd apps/api && npx vitest run --project unit src/core/spk/spk-policies.spec.ts`; expected FAIL (no `approverCancel`).
- [ ] Step 3: implement the export, schema, message and policy.
- [ ] Step 4: run again; PASS. `pnpm --filter @bmi/shared test -t "SM-SPK"`; PASS.
- [ ] Step 5: commit `feat(spk): approverCancel policy for T15 [TASK-124, REQ-SPK-008, DEC-140]`.

### Task 3: The cancel-steps port and its do-nothing adapter

**Skills:** `ecc:hexagonal-architecture`.

**Files:** `apps/api/src/ports/spk-cancel-steps.ts` (new), `apps/api/src/ports/spks.ts`, `apps/api/src/infra/db/spk-cancel-steps.ts` (new), the `SpkGateways` factory in `apps/api/src/infra/db/`.

**Interfaces:**
- Produces:
```ts
/** TX-14, DEC-140: the steps before Cancelled, in this order; each filled by its owning task. */
export interface SpkCancelSteps {
  reversePostedIssues(spkId: number, by: number): Promise<void>; // TASK-308
  releaseIssuedTyres(spkId: number, by: number): Promise<void>;  // TASK-502
  listPurchasedItems(spkId: number): Promise<void>;              // TASK-313
  leaveOpenSchedule(spkId: number): Promise<void>;               // TASK-612
  reopenReportBreakdown(spkId: number): Promise<void>;           // TASK-610
}
```
  `NoCancelStepsYet implements SpkCancelSteps`: every method resolves; it runs on the same transaction as the other gateways.

- [ ] Step 1: no own test (it does nothing); proven by the order test of Task 4. `pnpm check:layers`; no violation.
- [ ] Step 2: committed with Task 4.

### Task 4: The service method (TX-14)

**Skills:** API group, `ecc:hexagonal-architecture`, `test-master`, `ecc:tdd-workflow`.

**Files:** `apps/api/src/core/spk/spk-service.ts`; test `apps/api/src/core/spk/approver-cancel.spec.ts` (new, a recording fake of `SpkGateways`).

**Interfaces:**
- Consumes: Task 2 policy, Task 3 port, `gateways.spks.cancel(id, version, { reason, by })`, `gateways.spks.insertApproval`, `gateways.notifications.send`, `gateways.audit.write`, `runIdempotent`.
- Produces: `SpkService.approverCancel(actor: Actor, id: number, request: SpkApproverCancelRequest, key: Omit<IdempotentRequest, 'userId'>): Promise<IdempotentResponse>` answering `200 { spk: Spk }`.

- [ ] Step 1: write the failing tests:
  - `TX-14 the steps run in the order reverse issues, release tyres, purchased items, schedule, report, then Cancelled, then audit`;
  - `T15 a Cancel approval row carries the reason and the stage of decision 2`, one case per stage;
  - `DEC-140 the creator is notified with kind Approval and dedupe key spk:<id>:cancel; not when the Approver is the creator`;
  - `TX-14 a step that throws leaves no Cancelled write, approval row, notice or audit row`.
- [ ] Step 2: `cd apps/api && npx vitest run --project unit src/core/spk/approver-cancel.spec.ts`; expected FAIL (no method).
- [ ] Step 3: implement: load for update, `assertAllowed(..., 'approverCancel')`, the five steps, `spks.cancel`, `insertApproval({ spkId, stage, action: 'Cancel', actedBy, approverRole, note: reason })`, audit `approver_cancel` with the reason, then the notice.
- [ ] Step 4: run again; PASS.
- [ ] Step 5: commit `feat(spk): approver cancel runs TX-14 in one transaction [TASK-124, REQ-SPK-008, TX-14, DEC-140]`.

### Task 5: The route, contract and integration tests

**Skills:** API group, `test-master`.

**Files:** `apps/api/src/http/spks/spks.controller.ts` (`@Post(':id/approver-cancel')`, `@RequireCapability('spk.cancel')`, `@ApiContract({ operationId: 'approverCancelSpk', body: SpkApproverCancelRequest, response: One })`, `@IdempotencyKey()`); regenerate `packages/api-client`; test `apps/api/test/integration/spk/spk-approver-cancel.test.ts` (new; harness of `spk-cancel.test.ts`, `system_mode` Live in `beforeAll`).

- [ ] Step 1: write the failing tests:
  - `REQ-SPK-008 Supervisor, GM and System Admin each cancel a Pending_Approval SPK with a reason → 200 Cancelled with cancelled_by and cancel_reason`;
  - `DEC-140 an Approver cancels a Draft, a Rejected and an Active SPK`;
  - `REQ-SPK-008 an empty reason → 400 "Give a reason to cancel."`;
  - `DEC-93 a Planner and a Warehouse Manager → 403`; `REQ-SPK-008 an unknown id → 404`;
  - `T15 a Completed or Cancelled SPK → 400 "This SPK is already Completed or Cancelled."`;
  - `NFR-03 a stale version → 409`; `NFR-01 the same Idempotency-Key replays the first answer and writes nothing twice`;
  - `NFR-02 one audit row with before, after and the reason`; `DEC-140 the creator has one Approval notice`;
  - `REQ-SPK-010 the SPK is counted in the Cancelled tab of GET /spks`;
  - `REQ-SPK-011 the SPK detail lists approverCancel for a Supervisor and not for a Planner`;
  - `DEC-133 the System Admin cancels in Setup mode; the audit row is not self-decision` (last in the file if it changes the mode).
- [ ] Step 2: `cd apps/api && npx vitest run --project int test/integration/spk/spk-approver-cancel.test.ts`; expected FAIL (404 route).
- [ ] Step 3: implement the route; `pnpm gen:client && pnpm --filter @bmi/api-client build`.
- [ ] Step 4: run again; PASS. `pnpm check:client` shows no diff; `spk-cancel.test.ts` still green.
- [ ] Step 5: commit `feat(spk): POST /spks/:id/approver-cancel [TASK-124, REQ-SPK-008, DEC-140]`.

### Task 6: Web: CancelSPK dialog and SPKDetail

**Skills:** Web group (`nextjs-developer`, `impeccable`, `frontend-design-direction`, `ecc:frontend-patterns`, `ecc:react-patterns`, `ecc:react-performance`, `ecc:design-system`, `ecc:make-interfaces-feel-better`, `ecc:motion-foundations`, `ecc:frontend-a11y`), `ecc:react-testing`.

**Files:** `apps/web/lib/spks-api.ts`, `apps/web/components/spk/ApproverCancelDialog.tsx` (new), `apps/web/components/spk/SpkDetail.tsx`; tests `apps/web/components/spk/approver-cancel-dialog.test.tsx` (new), `spk-detail.test.tsx` and `apps/web/lib/spks-api.test.ts` (extended).

**Interfaces:**
- Produces: `ApproverCancelDialog({ api: Pick<SpksApi, 'approverCancel'>; spk: Spk; onCancelled: (spk: Spk) => void; onClose: () => void })`, with the scrim, focus and key reuse of `CancelSpkDialog`. Texts from the artboard, word for word: title `Cancel SPK-…?`, body `Posted issues are reversed first; Issued tyres return to stock. The creator and the executors are notified.`, field `Reason`, buttons `Keep the SPK` and `Cancel SPK`.

- [ ] Step 1: write the failing tests:
  - `REQ-SPK-008 the dialog shows the artboard texts and refuses an empty reason without a request`;
  - `NFR-01 Cancel SPK sends the reason and the version once; a retry reuses the key`;
  - `C-14 Keep the SPK, Escape and the scrim close it unchanged`;
  - `REQ-SPK-008 a refusal shows its one sentence in the dialog`;
  - `REQ-SPK-011 SPKDetail shows Cancel SPK only with approverCancel; after Cancel it shows the Cancelled pill and the History row`;
  - `DEC-122 the SPK document link is not shown`.
- [ ] Step 2: `cd apps/web && npx vitest run components/spk lib/spks-api.test.ts --maxWorkers=1`; expected FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run again; PASS, with every existing SPKDetail and CancelSpkDialog test green. Rerun the Task 1 E2E spec; PASS (GREEN recorded).
- [ ] Step 5: commit `feat(spk): CancelSPK dialog on SPKDetail [TASK-124, REQ-SPK-008, REQ-SPK-011, DEC-140]`.

### Task 7: Verification gate (§4)

**Skills:** `ecc:verification-loop`.

- [ ] Step 1: in this order, each must pass: `pnpm check:coverage` ("Coverage OK"); `pnpm check:kiro-skills`; `pnpm check:secrets`; `pnpm format:check`; `pnpm lint`; `pnpm typecheck`; `pnpm check:client`; `pnpm check:layers`.
- [ ] Step 2: suites one at a time with coverage: `pnpm --filter @bmi/shared test`; `cd apps/web && npx vitest run --coverage` (functions ≥ 80%); `cd apps/api && npx vitest run --project unit`, then `--project int` (full runs).
- [ ] Step 3: E2E full run after `pnpm --filter @bmi/api build && pnpm --filter @bmi/web build`: `TEST_DATABASE_URL=postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev pnpm e2e`. If memory prevents it, run FLW-APR-05, spk-list, create-spk-flw-pln-03 and approvals-flw-apr-01 and say exactly what CI runs alone.
- [ ] Step 4: the known local failures (5 BullMQ with Redis down, BR-10 identity schema, NFR-14 local time zone) are listed apart with their cause; they never count as passed; every TASK-124 test passes.

### Task 8: Bookkeeping (§1 steps 16–18)

**Skills:** `code-documenter`, `ecc:living-docs-governance`.

**Files:** `specs/evidence/TASK-124.tdd.md`, `specs/design.md` §5.23 (updated if the build differs from the design written before code), `specs/tools/tasks.source.mjs` (`done: true`), `specs/tasks.md`, `specs/CONTEXT.md` (Active task line, row 50), `AGENT_LOG.md` (new row on top).

- [ ] Step 1: evidence with Spec first, What changed, Divergences from the plan, Skills loaded, RED and GREEN per suite, Gates, Suites with the known local failures, Notes for later tasks (the five ports and their owners).
- [ ] Step 2: `node specs/tools/build-tasks.mjs && node specs/tools/check-coverage.mjs --tests`; "Coverage OK".
- [ ] Step 3: commit `docs(spk): TASK-124 evidence and journal [TASK-124, REQ-SPK-008, DEC-140]`.

### Task 9: QA UI comparison, the final step (§1 step 19)

**Skills:** `ecc:browser-qa`, `impeccable`.

- [ ] Step 1: start `design-artifact` (port 4173), `api` (3001, after the build) and `web` (3000) from `.claude/launch.json`; wait for 200; set `system_mode` Live locally and remove it after.
- [ ] Step 2: sign in with a local Approver from `.data/local-accounts.md` (never copied anywhere); type the QA SPK through the UI.
- [ ] Step 3: compare `spk/CancelSPK.html` with the built dialog at 1440 × 900 and 760 px: layout, texts word for word, the reason field, the buttons, the scrim, Esc (C-14), the hidden SPK document link (DEC-122); screenshots of open, refused (empty reason), busy and done; console clean. Regression check of SPKDetail against `spk/SPKDetail.html`.
- [ ] Step 4: fix what differs (new commits, tests first); anything kept different goes to the owner before the PR (§5) and into CONTEXT Divergences, design.md and the evidence; add the QA results to the evidence and commit `fix(spk): CancelSPK matched to its artboard [TASK-124, REQ-SPK-008]` when there was a fix.

### Task 10: Workflow audit, confirmation, PR, merge (§1 step 20, §6.3–6.5)

- [ ] Step 1: workflow audit: go through §1 steps 1–20 and write in AGENT_LOG every step skipped or done differently (tests written after their code, a gate that failed first, what was not run locally).
- [ ] Step 2: `git push origin feat/phase1-task124-approver-cancel-v2`; report to the owner in Indonesian (built, decided, results per suite, what failed or was not run, differences from the plan) and wait for the confirmation (§6.4). Ask "Buat PR untuk TASK-124?".
- [ ] Step 3: on "Ya, buat PR": `gh pr create --base main --head feat/phase1-task124-approver-cancel-v2` with Why, What changed, Verification and For the reviewer; report the link and ask "Merge PR #nn setelah CI hijau?".
- [ ] Step 4: on "Ya, merge setelah hijau": wait for the CI run of the head commit, confirm in its log that the TASK-124 tests ran (a skipped test is not a pass), then `gh pr merge <nn> --squash --delete-branch`; `git checkout main && git pull origin main`; `git branch -d feat/phase1-task124-approver-cancel-v2`; `git rev-list --left-right --count main...origin/main` prints `0 0`. A red CI is fixed with a new commit, never an amend.
- [ ] Step 5: tell the owner the next open task (TASK-127 part A, or TASK-201).

## Not in this task (DEC-140)
- The reversal of posted issues (TASK-308), the release of Issued tyres (TASK-502), the purchased-items list for the Warehouse Manager (TASK-313), the schedule card (TASK-612) and the Report Breakdown back to New (TASK-610): each fills one method of `SpkCancelSteps`.
- AC-SPK-004 (TASK-507); AssignStep (TASK-206); CorrectStepTime (TASK-204); the notice to step executors (TASK-206).
