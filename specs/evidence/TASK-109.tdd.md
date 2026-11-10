# TASK-109 Planner approval switch with kinds, end time, audit and notice

Requirements: REQ-IAM-008 (with REQ-IAM-012 for the next request). Rules: RL-7, BR-04, TX-20, DEC-35, DEC-48, DEC-118. Journey: FLW-AM-06. Tables: app_settings (planner_approval_kinds, planner_approval_until), audit_logs.

## Spec first (DEC-118, PRD v2.29)

The PRD asks for a reason, an optional end time, the ticked kinds, an audit record and a notice to Supervisors and GMs. Owner decisions: the notice is sent through the notification outbox of TASK-130, which comes later in the trial order (TASK-130's scope now names this event); the end of a switch at its end time is written to the audit log too; while on, the Access Manager may Change the kinds or the end time, with a reason. The artboard gained the side panel (kinds, end time in WIB, reason) and the card title became an h2 (h1 then h3 before; the kit styles `.card h2` like `.card h3`).

## What changed

- Shared: `schemas/planner-approval.ts` (kinds with labels, response, requests) and `time/wib.ts` `wibInputValue` / `fromWibInput`.
- API: `PlannerApprovalService` (state, set, switchOff, endIfDue), `DrizzlePlannerApprovalGateway` (advisory lock, app_settings upsert; an empty end time is the JSON null because setting_value is NOT NULL), `PlannerApprovalEndQueue` (delayed BullMQ job per end time, 3 s timeout), `worker.ts` processor, routes under `iam.planner_approval_switch`, 400 filter. `AuditEntry.userId` may be null for the system's own record. `capabilities.ts` takes the kinds from shared.
- Web: `PlannerApprovalCard` above the matrix; the side panel parts (`Panel`, `Field`, `Refusal`) moved from Users and roles to `kit/SidePanel` and are shared.
- E2E: `planner-approval.spec.ts` (FLW-AM-06).

## How the spec was read

- AC-IAM-005 (a Planner approves a Mechanic's SPK, never its own) needs SPK approval, which arrives in TASK-122; AC-IAM-008 belongs to TASK-310. Here the switch gives and takes `spk.approve` and `count.approve` on the next request, which the integration test and the e2e prove.
- "Notified to Supervisors and GMs" is TASK-130 (DEC-118); the card text keeps saying the switch is notified, which is true once TASK-130 ships, before go-live.

## Evidence

- RED: the shared schema tests failed before the schema existed (the module was missing). The integration, adapter and web tests were written before their code; their first runs came after it. The first integration run failed on an empty end time (SQL NULL into a NOT NULL column), fixed by writing the JSON null.
- GREEN: shared 283 tests, 100 %; API 158 tests, 96.5 % statements, including `planner-approval.test.ts` 6 (RL-7 only the Access Manager, TX-20 one audit record and an end job, Change and Switch off with reasons, an end time in the past refused, the end at its end time audited once, the switch page ending a due switch) and `planner-approval-end-queue.test.ts` 3 (one job per end time, the job runs the end, a down Redis gives up within the timeout); web 92 tests, 91.1 %; e2e 11 of 11 including FLW-AM-06. Layers, lint, format, secrets, types and `check-coverage --tests` clean.
- `qa` at 1280 x 800 against AMRolesPermissions: the card (title, icon, state text, Switch on) and the side panel (five kinds with rules between them, end time with its hint, reason, Cancel and Switch on) match. The dev database was left off.

## Fixed later (found in the TASK-118 CI fix)

RolesPermissions rendered the head alone while the matrix loaded and inside a larger fragment after, so React mounted the Planner approval card again when the matrix arrived: a Switch on pressed before that lost its panel (the FLW-AM-06 e2e failed once). Both branches now share one shape. Regression test: the card keeps its state when the matrix arrives after a click (failed before the fix).
