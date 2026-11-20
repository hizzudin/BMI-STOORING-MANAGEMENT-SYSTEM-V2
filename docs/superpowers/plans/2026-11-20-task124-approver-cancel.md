# TASK-124 Approver Cancel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Approver (Supervisor, GM, System Admin, capability `spk.cancel`) cancels an SPK in any open status with a required reason from SPKDetail through the CancelSPK dialog (T15, REQ-SPK-008).

**Architecture:** A new policy action `approverCancel` and a new route `POST /spks/:id/approver-cancel`, beside the creator cancel (T6) that stays unchanged. The service runs TX-14 in one transaction in the DEC-140 order. The steps before Cancelled go through one port, `SpkCancelSteps`, whose Drizzle adapter does nothing until the owning tasks fill it. SPKDetail shows "Cancel SPK" when `allowedActions` holds `approverCancel` and opens the CancelSPK dialog.

**Tech Stack:** NestJS, Drizzle, Zod (`@bmi/shared`), Next.js, Vitest, React Testing Library, Playwright. No new package.

**Spec:** `PRD.md` §3.2 T15, BR-06, DEC-58, DEC-129, DEC-140 (PRD v2.52, commit beddda1); `docs/prd/areas/4.1-spk.md` REQ-SPK-008, REQ-SPK-011; `docs/prd/data-model.md` TX-14, §9.6; `docs/prd/ui-action-map.md` CancelSPK and SPKDetail rows; `docs/prd/flows.md` FLW-APR-05; artboard `Design Artifact/spk/CancelSPK.html`.

Branch `feat/phase1-task124-approver-cancel-v2` (taken over from Kiro on the owner's word; Kiro's empty branch `feat/phase1-task124-approver-cancel` is to be deleted by Kiro or the owner).

## Global Constraints
- One entity, one name: SPK. Never "Work Order" or "WO".
- Permissions from the capability set and `allowedActions` (DEC-93), never the role name.
- `core/` imports only `ports/` and `@bmi/shared`; `pnpm check:layers` passes.
- Mutating route takes an Idempotency-Key (NFR-01, `runIdempotent`); optimistic lock by `version` (NFR-03).
- Every state change writes `audit_logs` with before and after (NFR-02).
- What a later task builds is hidden, not disabled (DEC-122): the "SPK document" link of the dialog is hidden until TASK-212.
- Test titles start with the ID they prove.
- No migration: `spks.cancelled_by`, `cancel_reason`, the `Cancel` value of `approval_action_t` and the check `status <> 'Cancelled' OR cancel_reason IS NOT NULL` already exist (0002, 0009).

## Decisions I made (the owner may change them before approval)
1. **A separate route and action** (`approverCancel`, `POST /spks/:id/approver-cancel`). T6 (`cancel`, `spk.create`, creator only) stays exactly as DEC-129 built it. When an Approver is also the creator of a Draft or Rejected SPK (only the System Admin), both actions are allowed; SPKDetail offers the Approver one.
2. **A `spk_approvals` row** with action `Cancel` and the reason as its note, so the History tab shows "Cancelled the SPK: <reason>" (the text TASK-125 already renders) and ApprovalsHistory can list it. Its stage follows where the SPK stands: Draft, Pending_Approval, Rejected → `Creation`; Pending_Amendment → `Amendment`; Active, In_Progress, Pending_Verification → `Completion`.
3. **The notice to the creator:** kind `Approval`, title `SPK-… was cancelled`, body `<reason>`, link `/spk/:id`, dedupe key `spk:<id>:cancel`; not sent when the Approver is the creator. Executors follow in TASK-206 (DEC-140).
4. **Refusal messages:** a final SPK → "This SPK is already Completed or Cancelled."; no `spk.cancel` → the usual 403 sentence; an empty reason → "Give a reason to cancel." (the existing schema).
5. **After Cancel** the dialog closes and SPKDetail reloads showing the Cancelled pill and the History row; no extra link to SPKList is added (the artboard shows none). FLW-APR-05 step 2 is proven by opening the Cancelled tab of SPKList.

## Review Focus
1. **A stale screen:** the Approver opens SPKDetail, the creator cancels it (T6) in another tab, then the Approver confirms → 409 with the version sentence, nothing written twice.
2. **A retried click:** the same Idempotency-Key and body replays the first answer; no second approval row, notice or audit row.
3. **The System Admin in Setup mode:** the cancel still works (DEC-133 restricts approvals only) and the audit row is not marked self-decision.
4. **A Planner or Warehouse Manager** sees no Cancel SPK on SPKDetail and gets 403 from the route even with a valid body.
5. **The order of TX-14:** a failing port step rolls back the whole cancel; the SPK stays in its status.

---

### Task 1: Shared schema and the policy

**Files:**
- Modify: `packages/shared/src/schemas/spks.ts` (`SPK_ACTIONS`, a new `SpkApproverCancelRequestSchema` equal to the cancel schema)
- Modify: `packages/shared/src/machines/index.ts` (export `OPEN_SPK_STATES`, today the private `OPEN_SPK`)
- Modify: `apps/api/src/core/spk/spk-service.ts` (`SPK_MESSAGES.alreadyFinal`, `SPK_POLICIES.approverCancel`)
- Test: `apps/api/src/core/spk/spk-policies.spec.ts` (new)

**Interfaces:**
- Produces: `SPK_ACTIONS = ['edit', 'submit', 'cancel', 'approverCancel']`; `SpkApproverCancelRequest = { version: number; reason: string }`; `SPK_POLICIES.approverCancel = { anyOf: ['spk.cancel'], rules: [inState(status, OPEN_SPK_STATES, SPK_MESSAGES.alreadyFinal)] }`.

- [ ] Step 1: write the failing tests: `REQ-SPK-008 an actor with spk.cancel may approverCancel in each of the seven open states`; `REQ-SPK-008 approverCancel is refused on Completed and Cancelled with "This SPK is already Completed or Cancelled."`; `DEC-93 without spk.cancel approverCancel is not in allowedActions`; `DEC-129 the creator cancel policy is unchanged (Draft, Rejected, owner only)`.
- [ ] Step 2: run `cd apps/api && npx vitest run --project unit src/core/spk/spk-policies.spec.ts`; expected FAIL (no `approverCancel`).
- [ ] Step 3: implement the schema, export, message and policy.
- [ ] Step 4: run again; expected PASS. Run `cd packages/shared && npx vitest run src/machines src/schemas`; PASS.
- [ ] Step 5: commit `feat(spk): approverCancel policy for T15 [TASK-124, REQ-SPK-008, DEC-140]`.

### Task 2: The cancel-steps port and its do-nothing adapter

**Files:**
- Create: `apps/api/src/ports/spk-cancel-steps.ts`
- Create: `apps/api/src/infra/db/spk-cancel-steps.ts`
- Modify: `apps/api/src/ports/spks.ts` (`SpkGateways.cancelSteps`) and the unit-of-work wiring that builds `SpkGateways`

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
  `NoCancelStepsYet implements SpkCancelSteps`: every method resolves, each with a comment naming its task. It runs on the same transaction as the other gateways.

- [ ] Step 1: no own test (it does nothing); it is proven by the order test of Task 3. Run `pnpm check:layers`; no violation.
- [ ] Step 2: committed together with Task 3.

### Task 3: The service method (TX-14)

**Files:**
- Modify: `apps/api/src/core/spk/spk-service.ts` (`approverCancel`)
- Test: `apps/api/src/core/spk/approver-cancel.spec.ts` (new, a recording fake of `SpkGateways`)

**Interfaces:**
- Consumes: Task 1 policy, Task 2 port, `gateways.spks.cancel(id, version, { reason, by })`, `gateways.spks.insertApproval`, `gateways.notifications.send`, `gateways.audit.write`, `runIdempotent`.
- Produces: `SpkService.approverCancel(actor: Actor, id: number, request: SpkApproverCancelRequest, key: Omit<IdempotentRequest, 'userId'>): Promise<IdempotentResponse>` answering `200 { spk: Spk }`.

- [ ] Step 1: write the failing tests:
  - `TX-14 the steps run in the order reverse issues, release tyres, purchased items, schedule, report, then Cancelled, then audit` (the fake records each call);
  - `REQ-SPK-008 a Cancel approval row carries the reason and the stage of decision 2`, one case per stage;
  - `DEC-140 the creator is notified with kind Approval and dedupe key spk:<id>:cancel; not when the Approver is the creator`;
  - `TX-14 a step that throws leaves no Cancelled write, approval row, notice or audit row`.
- [ ] Step 2: run `cd apps/api && npx vitest run --project unit src/core/spk/approver-cancel.spec.ts`; expected FAIL (no method).
- [ ] Step 3: implement: load for update, `assertAllowed(..., 'approverCancel')`, the five port calls, `spks.cancel`, `insertApproval({ spkId, stage, action: 'Cancel', actedBy, approverRole, note: reason })`, audit `action: 'approver_cancel'` with the reason, then the notice.
- [ ] Step 4: run again; PASS.
- [ ] Step 5: commit `feat(spk): approver cancel runs TX-14 in one transaction [TASK-124, REQ-SPK-008, TX-14, DEC-140]`.

### Task 4: The route, contract and integration tests

**Files:**
- Modify: `apps/api/src/http/spks/spks.controller.ts` (`@Post(':id/approver-cancel')`, `@RequireCapability('spk.cancel')`, `@ApiContract({ operationId: 'approverCancelSpk', body: SpkApproverCancelRequest, response: One })`, `@IdempotencyKey()`)
- Regenerate: `packages/api-client/openapi.json`, `packages/api-client/src/schema.gen.ts`
- Test: `apps/api/test/integration/spk/spk-approver-cancel.test.ts` (new; harness as `spk-cancel.test.ts`, `system_mode` Live)

- [ ] Step 1: write the failing tests:
  - `REQ-SPK-008 Supervisor, GM and System Admin each cancel a Pending_Approval SPK with a reason → 200 Cancelled with cancelled_by and cancel_reason`;
  - `DEC-140 an Approver cancels a Draft, a Rejected and an Active SPK`;
  - `REQ-SPK-008 an empty reason → 400 "Give a reason to cancel."`;
  - `DEC-93 a Planner and a Warehouse Manager → 403`; `an unknown id → 404`;
  - `REQ-SPK-008 a Completed or Cancelled SPK → 400 "This SPK is already Completed or Cancelled."`;
  - `NFR-03 a stale version → 409`; `NFR-01 the same Idempotency-Key replays the first answer and writes nothing twice`;
  - `NFR-02 one audit row with before, after and the reason`; `DEC-140 the creator has one Approval notice`;
  - `REQ-SPK-010 the SPK is counted in the Cancelled tab of GET /spks`;
  - `REQ-SPK-011 the SPK detail lists approverCancel for a Supervisor and not for a Planner`;
  - `DEC-133 the System Admin cancels in Setup mode; the audit row is not self-decision`.
- [ ] Step 2: run `cd apps/api && npx vitest run --project int test/integration/spk/spk-approver-cancel.test.ts`; expected FAIL (404 route).
- [ ] Step 3: implement the route; `pnpm gen:client && pnpm --filter @bmi/api-client build`.
- [ ] Step 4: run again; PASS. `pnpm check:client` shows no diff.
- [ ] Step 5: commit `feat(spk): POST /spks/:id/approver-cancel [TASK-124, REQ-SPK-008, DEC-140]`.

### Task 5: Web: CancelSPK dialog and SPKDetail

**Files:**
- Modify: `apps/web/lib/spks-api.ts` (`approverCancel(id, body, key)`)
- Create: `apps/web/components/spk/ApproverCancelDialog.tsx`
- Modify: `apps/web/components/spk/SpkDetail.tsx` (header button, reload after cancel)
- Test: `apps/web/components/spk/approver-cancel-dialog.test.tsx` (new), `apps/web/components/spk/spk-detail.test.tsx` (extended), `apps/web/lib/spks-api.test.ts` (extended)

**Interfaces:**
- Produces: `ApproverCancelDialog({ api: Pick<SpksApi, 'approverCancel'>; spk: Spk; onCancelled: (spk: Spk) => void; onClose: () => void })`, with the same scrim, focus and key reuse as `CancelSpkDialog`. Texts from the artboard, word for word: title `Cancel SPK-…?`, body `Posted issues are reversed first; Issued tyres return to stock. The creator and the executors are notified.`, field `Reason`, buttons `Keep the SPK` and `Cancel SPK`.

- [ ] Step 1: write the failing tests:
  - `REQ-SPK-008 the dialog shows the artboard texts and refuses an empty reason without a request`;
  - `NFR-01 Cancel SPK sends the reason and the version once; a retry reuses the key`;
  - `C-14 Keep the SPK, Escape and the scrim close it unchanged`;
  - `REQ-SPK-008 a refusal shows its one sentence in the dialog`;
  - `REQ-SPK-011 SPKDetail shows Cancel SPK only with approverCancel; after Cancel it shows the Cancelled pill and the History row`;
  - `DEC-122 the SPK document link is not shown`.
- [ ] Step 2: run `cd apps/web && npx vitest run components/spk lib/spks-api.test.ts --maxWorkers=1`; expected FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run again; PASS. Every existing SPKDetail test stays green.
- [ ] Step 5: commit `feat(spk): CancelSPK dialog on SPKDetail [TASK-124, REQ-SPK-008, REQ-SPK-011, DEC-140]`.

### Task 6: E2E FLW-APR-05, QA and bookkeeping

**Files:**
- Create: `apps/web/e2e/approvals-flw-apr-05.spec.ts` (helpers from `spk-helpers.ts`)
- Modify: `specs/design.md` (new §5.23 Approver cancel, before §5.1), `specs/evidence/TASK-124.tdd.md`, `specs/tools/tasks.source.mjs` (`done: true`), `specs/tasks.md`, `specs/CONTEXT.md` (row 50), `AGENT_LOG.md`

- [ ] Step 1: write `FLW-APR-05 a Supervisor cancels a Pending approval SPK with a reason; it shows Cancelled on SPKDetail and in the Cancelled tab of SPKList`; run it before the web code exists to see it fail (RED recorded in the evidence).
- [ ] Step 2: after Tasks 1 to 5, run every gate of WORKFLOW_STANDARDS: coverage, Kiro skills, secrets, format, lint, typecheck, check:client, check:layers, the shared, web (functions ≥ 80%) and API unit and int suites one at a time, then the E2E run after the API and web builds.
- [ ] Step 3: QA CancelSPK against `Design Artifact/spk/CancelSPK.html` at 1440 × 900 and 760 px: open, refused (empty reason), busy, done; console clean. Regression check of SPKDetail against its artboard.
- [ ] Step 4: write design.md §5.23, the evidence (RED, GREEN per suite, QA fixes, known local failures listed apart), CONTEXT row 50 and the AGENT_LOG row with the workflow audit; `node specs/tools/build-tasks.mjs && pnpm check:coverage` prints "Coverage OK".
- [ ] Step 5: commit `test(spk): FLW-APR-05 and TASK-124 bookkeeping [TASK-124, REQ-SPK-008]`, push, report to the owner and ask "Buat PR untuk TASK-124?".

## Not in this task (DEC-140)
- The reversal of posted issues (TASK-308), the release of Issued tyres (TASK-502), the purchased-items list for the Warehouse Manager (TASK-313), the schedule card (TASK-612), the Report Breakdown back to New (TASK-610): each fills one method of `SpkCancelSteps`.
- AC-SPK-004 (the order with a real issue and tyre) is proven in TASK-507.
- AssignStep (TASK-206) and CorrectStepTime (TASK-204).
- The notice to step executors (TASK-206).
