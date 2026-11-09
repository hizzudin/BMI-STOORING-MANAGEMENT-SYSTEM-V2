# TASK-103 Migrations: identity, access, audit, settings and platform tables

Rules: BR-10, BR-14, NFR-02. Tables: users, user_roles, role_permissions, audit_logs (§9.2), app_settings, stored_files, user_table_preferences (§9.12).

## What changed

- `apps/api/migrations/0002_enums_identity_platform.sql`: every enum of §9.1 first (TX-01), then the seven tables, the BR-14 indexes `uq_one_role_per_user` and `uq_one_system_admin`, the append-only trigger on `audit_logs`, and the foreign key `idempotency_keys.user_id` that TASK-009 could not add.
- `apps/api/src/infra/db/schema/index.ts`: Drizzle definitions of the seven tables and `role_t`, so the drift test covers them.
- Test harness: `insertUsers`; the idempotency tests now use real accounts, since the new foreign key refuses an unknown user.

## How the spec was read

- `user_roles`, `role_permissions` and `user_table_preferences` keep the composite primary key §9 states, so they have no `id` column; every other table has `id`, `created_at` and `updated_at` (§9.0).
- The email is unique among accounts that are not soft-deleted (TX-18).
- `audit_logs` refuses every UPDATE and DELETE. The monthly archive of NFR-17 needs a way past this and comes with TASK-110.
- Not refusing the deactivation of the System Admin account is a service rule (§9.2 comment); TASK-107 builds it.

## Evidence

- RED: 16 new tests failed because the tables and enums did not exist.
- GREEN: the database suite, 48 tests, passes, with the drift and convention checks.
- _Verify_ `int "BR-14|BR-10"`: 9 passed. Whole API coverage run: 73 tests pass, lines 99,48 percent.
- Repository: typecheck, lint, format, layer rules and secret scan pass.
