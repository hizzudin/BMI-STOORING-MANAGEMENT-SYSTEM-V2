# TASK-107 Access Manager area: accounts with one role, lock/unlock, deactivate, move System Admin

Requirements: REQ-IAM-002, REQ-IAM-003, REQ-IAM-004 (and REQ-IAM-009 for the temporary password). Acceptance: AC-IAM-001, AC-IAM-002, AC-IAM-003, AC-IAM-004. Rules: RL-1, RL-4, BR-14, DEC-28, DEC-116. Journeys: FLW-AM-01, FLW-AM-03, FLW-AM-04. Tables: users, user_roles, audit_logs (§9.2).

## Spec first (DEC-116, PRD v2.27)

The flows ask for Move System Admin role and Deactivate, which the artboards did not draw, and leave reactivation and the Access Manager's own account open. Owner decisions: Move System Admin role in the page header beside New account, opening a side panel (account, reason, confirmation); Deactivate (outlined danger, confirmed) and Activate in the account panel, both audited; an Access Manager cannot deactivate itself or change its own role, and the last active Access Manager stays. Both artboards were updated before the code.

## What changed

- Shared: `schemas/accounts.ts` (account, list, create and edit requests, move request, `ASSIGNABLE_ROLES` without System Admin).
- API: `core/iam/account-service.ts` with one `Policies` table for the account actions (edit, unlock, reset_password, deactivate, activate); every change writes one `audit_logs` row; the move is one transaction (old holder's role row deleted, new holder's row becomes System_Admin). `infra/db/account-gateways.ts` (accounts with last sign-in from `auth_sessions`, audit). Routes `/accounts` guarded by `accounts.manage` on the controller; the guard now also reads the class. 404 and 409 filter.
- Web: `app/(app)/users` with `UsersRoles`: table with search and column filters, status pills, tabs, account panel whose buttons follow `allowedActions`, temporary password shown once, move panel, confirmations. A user without the Dashboard item lands on its first menu item, so the Access Manager opens Users and roles after sign-in (ui-action-map WebLogin).
- E2E: `access-manager.spec.ts` (FLW-AM-01, FLW-AM-03, FLW-AM-04, AC-IAM-003); the e2e database gains an Access Manager, a System Admin and a Driver.

## How the spec was read

- The create form never offers System Admin (400). An edit sends the account's current role, which may be System Admin, so the holder's name and email stay editable; a change to or from System Admin is refused with a sentence (403).
- After the move the old holder keeps no role (§9.2 deletes its row); the table shows "No role" until an Access Manager gives one.
- NFR-01 asks idempotency for submit, approve, post and issue only; the account routes take no Idempotency-Key.
- The last-active-Access-Manager rule cannot be reached through the API: the actor is always an active Access Manager, so the target would be itself, which the own-account rule already refuses. The rule stays as a guard and is not tested over HTTP.
- The tabs Roles and permissions and Access history open pages built in TASK-108 and TASK-110.

## Found during qa and fixed (TASK-104/106 code)

Two refreshes at once (two tabs, or React's double effect in development) sent the same refresh token; the loser's answer cleared the cookies the winner had just set, and the browser was signed out. Now a refused refresh leaves the cookies alone, the web shares one in-flight refresh and asks `/me` once more after a refused one. Regression tests: `NFR-05 two refreshes at once (two tabs) keep the browser signed in` (failed before the fix) and the web test for one shared refresh.

## Evidence

- RED: the account integration tests failed before the routes existed; the web tests before the screen existed; the refresh race test before its fix.
- GREEN: `int "AC-IAM-001|AC-IAM-002|AC-IAM-003|AC-IAM-004"` and the rest of `accounts.test.ts`: 16 passed, including the allowedActions contract on Active, Locked and Inactive accounts. Auth tests 22. Shared 273 tests, 100 %. Web component tests 11 for Users and roles, 11 for the shell.
- `qa` at 1280 x 800 against UsersRoles and AMAccountForm: sheet, title, buttons, tabs (within 2 px), table cells and pills match; the account panel matches field for field and button for button after removing a heading the artboard does not have and matching the gap above the buttons. Differences kept on purpose: the bell in the header row (ui.md 7.2) moves the header buttons 54 px left, and the table carries search and column filters (NFR-08).
