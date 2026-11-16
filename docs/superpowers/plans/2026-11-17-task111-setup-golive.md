# TASK-111 plan: Setup mode and Go live, both ways

Branch `feat/phase1-task111-setup-golive`. Spec: REQ-IAM-010, AC-IAM-006, DEC-55, DEC-56, DEC-132 (PRD v2.44, commit e3fe5d7). No migration: `app_settings` already holds `system_mode`, and `went_live_at` is one more key.

## Goal
- **While the system is in Setup:**
  - only the System Admin and Access Managers sign in;
  - every other role is refused with "The system is being set up.";
  - the capabilities Setup blocks stay blocked, as today (no SPK).
- **Go live:** the System Admin (`setup.golive`) goes live with a reason and by typing GO LIVE.
- **Back to Setup:** in Live, the System Admin goes back to Setup with a reason and by typing BACK TO SETUP, which ends at once the sessions of the other roles.
- **Audit:** every switch is audited with its reason.

**Done when:**
- `int "AC-IAM-006"` passes;
- `e2e FLW-SA-08` passes;
- SetupGoLive, GoLiveConfirm and BackToSetupConfirm match their artboards.

## Architecture

### Shared (`schemas/system-mode.ts`)
- `SETUP_SIGN_IN_ROLES` = System_Admin, Access_Manager (DEC-56).
- `GO_LIVE_PHRASE` = "GO LIVE"; `BACK_TO_SETUP_PHRASE` = "BACK TO SETUP".
- `SystemModeSwitchRequestSchema`: `reason` (1 to 500, trimmed in the service) and `confirmation`.
- `SystemModeResponseSchema`:
  - `mode`;
  - `wentLiveAt`;
  - `checklist` (key, label, count);
  - `allowedActions` (`go_live` or `back_to_setup`).
- The messages, including "The system is being set up." and "Type GO LIVE to confirm."

### API (hexagonal)
- **Auth (`AuthService`):**
  - `signIn`, `authenticate` and `refresh` refuse a new kind, `setupMode` (403, "The system is being set up."), when the mode is Setup and the account's role is not in `SETUP_SIGN_IN_ROLES`;
  - the mode is read through the existing `systemMode()` of the IAM gateways.
- **`core/iam/system-mode-service.ts`:**
  - `status(actor)`: the mode, `wentLiveAt`, and the checklist with counts of active accounts, master data (vehicle classes and document types) and vehicles;
  - `goLive(actor, request, key)`: Setup only; the reason; the phrase must match exactly. It writes `system_mode` Live and `went_live_at`, and one audit record (entity `system_mode`, action `go_live`, before/after mode, the reason);
  - `backToSetup(actor, request, key)`: Live only; the reason and the phrase. It writes Setup, revokes every open session whose account's role is not in `SETUP_SIGN_IN_ROLES`, and writes one audit record (`back_to_setup`);
  - both need `setup.golive`, run under an Idempotency-Key (NFR-01) and run in one transaction.
- **Ports and adapters:**
  - `ports/system-mode.ts`: `SystemModeGateway` (read, write mode and went_live_at, checklist counts) and `revokeSessionsExceptRoles(roles, at)`;
  - the Drizzle adapter goes in `infra/db/system-mode-gateways.ts`.
- **Audit log:** `AREA_OF` gains `system_mode: 'Settings'`; the TASK-110 unit test enforces it.
- **Routes:**

  | Route | Needs |
  | --- | --- |
  | `GET /system-mode` | `setup.golive` |
  | `POST /system-mode/go-live` | `setup.golive`, Idempotency-Key |
  | `POST /system-mode/back-to-setup` | `setup.golive`, Idempotency-Key |

### Web
- **Menu:** "Setup and go live" shows in both modes (`setupModeOnly` removed). The shell test that expected it only in Setup is corrected for DEC-132.
- **`/setup`:**
  - **In Setup (SetupGoLive):** the crumb "Setup mode", the checklist (Accounts, Master data, Vehicles and documents) with counts and ticks, the lock note, and Go live. Go live opens GoLiveConfirm: the reason, "Type GO LIVE to confirm", and the Go live button, enabled only when both are filled and the phrase matches.
  - **In Live:** the crumb "Live since …", the note, and Back to Setup. Back to Setup opens BackToSetupConfirm: the reason, "Type BACK TO SETUP to confirm".
  - After a switch, the page reloads `/me` so the menu follows.
- **Sign-in:** the refusal sentence shows on WebLogin as other refusals do. A signed-out Planner sees "The system is being set up." on its next request.
- **Landing:** the System Admin in Setup lands on `/setup` (WebLogin row of the action map).

### Seeds
- The E2E and trial seeds stay Live.
- FLW-SA-08 goes Live → Setup → Live in the browser and ends Live, so the other specs are unaffected.

## Tests (written first, run red)
- **Shared:** the switch request and the phrases.
- **Integration (`apps/api/test/integration/iam/system-mode.test.ts`):**
  - AC-IAM-006: in Setup a Planner's sign-in is refused with the sentence and SPK creation is unavailable; after Go live the Planner signs in. Back to Setup: the Planner's next request and refresh are refused, while the Access Manager keeps working;
  - Go live refusals: without a reason, a wrong phrase, when already Live, without `setup.golive` (403);
  - each switch writes one audit record with its reason; `went_live_at` holds the latest Go live; a retried key does not switch twice;
  - the checklist counts.
- **Web:** SetupGoLive in both modes, the two dialogs (the button enabled only with a reason and the exact phrase), and the menu item in Live.
- **E2E (`setup-golive-flw-sa-08.spec.ts`):** the System Admin goes back to Setup, a Planner is refused at sign-in, the System Admin goes live, and the Planner signs in.

## Review focus
1. **A role that should not sign in during Setup slips in through refresh or an open token.** Owned by the AC-IAM-006 test (refresh and the next request).
2. **A switch without a reason, or with a mistyped phrase.** Owned by the refusal tests and the dialog test.
3. **A double click or retry switches twice and writes two audit records.** Owned by the Idempotency-Key test.
4. **The System Admin or an Access Manager locked out by Back to Setup.** Owned by the test that the Access Manager keeps working.
5. **The menu or a button decided from the role name.** Owned by `allowedActions` from `setup.golive` and the shell test.

## Out of scope
- Opening balance (TASK-311) and bulk import (TASK-616); they read the mode when built.
- The checklist items of later tasks (existing tyres, parts baseline, opening balance).

## Execution
- **Skills:** the always-on skills, the API and Web groups, hexagonal-architecture, and e2e-testing with browser-qa.
- **Order:** shared, API (RED, then GREEN), `gen:client`, the E2E spec, web (RED, then GREEN), QA, gates, bookkeeping.

## Addendum: DEC-133 (PRD v2.45), Setup mode and self-decisions

The owner's later instruction, decided before code: in Setup the System Admin holds every operational capability, and BR-03's ban on self-decisions holds while Live for everyone (the System Admin included) and is lifted only in Setup, where each self-decision is still marked Self-approved or Self-verified.

### Changes
- **Capabilities (`core/iam/capabilities.ts`):** Setup mode removes no code. `blockedInSetupMode` and its list leave `@bmi/shared`, and their tests follow DEC-133.
- **Actor (`core/iam/actions.ts`):** gains `systemMode`, taken from the signed-in snapshot by `actorOf`. `notOwnWork` refuses one's own work while Live, whatever the role, and allows it in Setup. `isSelfDecision` still marks it.
- **Approvals:** the inbox (REQ-APR-006) and `allowedActions` follow the same policy, so in Live one's own SPK is hidden and refused, and in Setup it is shown as Yours and may be approved (Self-approved).
- **E2E FLW-SA-06 (TASK-110):** the System Admin can no longer approve its own SPK while Live. The spec goes back to Setup, approves the seeded "Self approval check" SPK (Self-approved), and goes live again.

### Tests (RED first)
- **Unit `actions.spec.ts`:** BR-03 refuses one's own SPK while Live for the System Admin and a Planner, and allows it in Setup.
- **`capabilities.spec.ts`:** Setup keeps `spk.create` and `spk.approve`.
- **Integration `approvals.test.ts`:**
  - AC-SPK-006: refused while Live, then allowed in Setup with the Self-approved stamp and audit flag;
  - AC-APR-003: one's own SPK is hidden while Live and shown as Yours in Setup.
- **Integration `allowed-actions.test.ts`:** the System Admin case follows DEC-133.
- **Integration `system-mode.test.ts`:** AC-IAM-006 now expects the System Admin to hold `spk.create` in Setup.

### Review focus
1. A self-approval slips through while Live.
2. The inbox shows one's own items while Live.
3. Setup still blocks the System Admin somewhere.
4. An Actor built without the mode defaults to the permissive side.
