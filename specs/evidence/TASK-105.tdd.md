# TASK-105 Permission catalogue, role_permissions seed, effective capabilities, guard, GET /me, matrix test

Requirements: REQ-IAM-005, REQ-IAM-006, REQ-IAM-012, REQ-IAM-013. Rules: NFR-04, RL-1 to RL-10, BR-03, NAV-9, DEC-08, DEC-09, DEC-10, DEC-19, DEC-29, DEC-37, DEC-93, DEC-115. Table: role_permissions (§9.2).

## Spec first (DEC-115, PRD v2.26)

The matrix legend left three things open; the owner decided: besides the L cells, the cells a business rule fixes are locked (the System Admin column, the S cells, the Access Manager's codes other than its own, the action codes of the Field Coordinator other than its X cells and of Accounting other than `invoice.manage`; view codes of those roles stay editable); a - cell is off by default like a blank one; `files.upload` belongs to the executor roles Planner, Mechanic, Warehouse Manager, System Admin, Driver and Field Coordinator.

## What changed

- Shared: `permissions/index.ts` with the 44 codes of 2.4, the 2.2 matrix cell for cell, `defaultRolePermissions()` (every role × every code, `allowed` and `is_locked`), `blockedInSetupMode()`, the menu table and `menuFor()`; `MeResponseSchema`.
- API: migration `0004_role_permissions_seed.sql` generated from `defaultRolePermissions()` (440 rows); `core/iam/capabilities.ts` (pure effective set: role rows, plus the Planner approval switch while on, minus Setup mode, never `accounts.manage` for the System Admin); `CapabilityService` and `DrizzleCapabilityGateway` (role_permissions, app_settings `planner_approval_kinds`, `planner_approval_until`, `system_mode`); `SessionGuard` computes the set on every request and enforces `@RequireCapability(...)` with 403; `GET /me` returns the user, the sorted capability set and the system mode; `AppModule` exports the guard and services.
- Client: regenerated for the new `GET /me` response.

## How the spec was read

- The urgent report pop-up stays with Planners only, although the System Admin otherwise holds every operational code: PRD 2.1 and REQ-BRK-004 name it as the exception.
- No `system_mode` row means Setup (REQ-IAM-010: the system starts in Setup mode); the local trial seed sets Live (TASK-131).
- The Planner approval switch is on while at least one kind is ticked and the optional end time has not passed; writing, auditing and notifying the switch belongs to REQ-IAM-008 (TASK-109).
- `/vehicles` does not exist yet, so AC-IAM-009 is checked on a generated route guarded by `vehicle.view`; the real route uses the same decorator.

## Evidence

- RED: the shared matrix tests and the capability unit tests failed before the catalogue and the function existed; the matrix integration test first failed because `AppModule` did not export the guard's providers, which every feature module needs.
- GREEN: shared 268 tests, 100 % coverage (15 matrix and menu tests); API unit 7 capability tests; `int "capability matrix"`: 8 passed, including the seed equal to the matrix, `GET /me` for all 10 roles, the generated guard check of 10 roles × 44 codes, AC-IAM-008, AC-IAM-005 (end time), AC-IAM-009 and Setup mode. Whole API suite 109 tests, 96.5 % statements. Web 51 tests (one run under load failed to start a worker in time and passed again alone).
- Layer rules, lint, typecheck, format and `check-coverage.mjs --tests` pass.
