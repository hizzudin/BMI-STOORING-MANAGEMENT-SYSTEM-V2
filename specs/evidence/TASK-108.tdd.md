# TASK-108 Roles and permissions matrix with locked cells

Requirements: REQ-IAM-005 (with REQ-IAM-012, REQ-IAM-013 for the next request). Acceptance: AC-IAM-003, AC-IAM-009. Rules: RL-4, RL-5, RL-7, NAV-9, DEC-115, DEC-117. Journey: FLW-AM-02. Tables: role_permissions, audit_logs (§9.2).

## Spec first (DEC-117, PRD v2.28)

The artboard drew 8 of the 10 roles, a flat list of codes and no way to save. Owner decisions: all ten roles in the 2.2 column order; rows grouped by area with each code's 2.4 meaning; clicks stage cells and a bar with Cancel and Save changes saves them together with one audit record. The artboard was updated before the code (Access Mgr. and Driver columns, group rows, meanings, a staged cell and the bar).

Reading REQ-IAM-005 ("approvals stay with Supervisor, GM and System Admin ... managing accounts stays with Access Managers") showed that the TASK-105 seed left `spk.approve` and `count.approve` editable for Mechanic, Warehouse Manager and Driver, and `accounts.manage` and `iam.planner_approval_switch` editable for Planner, Mechanic, Warehouse Manager, Supervisor, GM and Driver. DEC-117 records the lock; `defaultRolePermissions()` and the new migration `0005_role_permissions_locks.sql` apply it (0004 was already applied, so it is not edited).

## What changed

- Shared: lock rule in `lockedByRoleRule`; `permissions/groups.ts` (`PERMISSION_GROUPS`, `PERMISSION_MEANINGS`, `isSwitchableCell`); `schemas/role-permissions.ts` (cell, matrix response, change request: at least one change, one per cell).
- API: `RolePermissionService` (matrix with `allowedActions` edit; change in one transaction with the rows locked, the whole save refused with 403 on a locked or S cell, unchanged cells skipped, one `audit_logs` row entity `role_permissions`, entity_id 0, before and after of the changed cells); `DrizzleRolePermissionGateway`; routes `GET`, `PATCH /role-permissions` under `accounts.manage`. Test harness `seedRolePermissions()` runs 0004 and 0005 for every test that needs the matrix.
- Web: `/users/roles` with `RolesPermissions` (ten columns, group rows, toggles with `aria-pressed`, fixed cells ✓ L, L, S, "changed" marks, sticky bar, leave guard); `AccessTabs` shared by both tabs.
- E2E: `roles-permissions.spec.ts` (FLW-AM-02); the e2e database gains an Accounting account.

## How the spec was read

- An S cell (Planner approvals) shows S and is refused with its own sentence: only the Planner approval switch of TASK-109 turns it on. The Planner approval card of the artboard belongs to TASK-109 and is not built here.
- The audit page reads `audit_logs` in TASK-110; the matrix record is entity `role_permissions`, entity_id 0 (the matrix is one record).
- The Access Manager column shows too; only its `audit.view` cell can change (DEC-115).

## Evidence

- RED: the shared tests for the lock rule, the groups and the S cells failed before the change (3 failed); the web component tests failed before the screen existed. The integration test was written before the service; its first run came after the service and failed on cleanup (audit_logs is append only, BR-10), fixed by reading the rows written after each test starts.
- GREEN: shared 278 tests, 100 %; API 149 tests, 96.3 % statements, including `role-permissions.test.ts` 9 (AC-IAM-003, REQ-IAM-005, REQ-IAM-008 S cell, DEC-117 one audit record, AC-IAM-009) and the seed test against 0004 + 0005; web 85 tests, 92.2 %; e2e 10 of 10 including `roles-permissions.spec.ts` (FLW-AM-02). Layers (the first run found a cycle between `groups.ts` and `permissions/index.ts`; groups is now exported from the package root), lint, format, secrets and `check-coverage --tests` clean.
- `qa` at 1280 x 800 against AMRolesPermissions: title, tabs, column heads, group rows, code with meaning, ✓ L, L and S cells match. The first build drew an outline round every editable cell; the artboard shows a plain ✓ or nothing, so the outline was removed (hover and focus still mark the cell). Kept on purpose: the Planner approval card is TASK-109; the bell in the header (ui.md 7.2).
