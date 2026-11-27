# TASK-201 Engine tables

- **Rules:** DEC-95, DEC-124, DEC-144; §9.0 conventions (TX-18, BR-10); D-12 drift.
- **Decision:** DEC-144 (PRD v2.56, commit 5259732).
- **Tables:** `spk_presets`, `spk_preset_steps`, `step_time_events`, `step_time_corrections`, `spk_change_requests` (with `cr_number_seq`), `mobilisation_location_trail`, `spk_check_items` (§9.6); new foreign keys on `spks.preset_id`, `spk_attachments.check_item_id`, `spk_approvals.change_request_id`.

## Spec first (DEC-144)
The owner decided before any code: the dummy module of the engine is registered by the test harness and the e2e seed only, never by a migration; gateway methods come with the tasks that use them. Design §5.24 was written before code. The plan is `docs/superpowers/plans/2026-11-28-task201-engine-migrations.md`; the owner approved it ("Ya, setujui (Native)").

## What changed
- `apps/api/migrations/0014_engine_tables.sql`: the seven tables with the §9.0 standard columns, every foreign key `ON DELETE RESTRICT`; the soft-deleted `spk_presets` unique by `(name, version)` among non-deleted rows; three append-only triggers; indexes on the lookup columns; the three DEC-124 foreign keys.
- `apps/api/src/infra/db/schema/index.ts`: `crStatusEnum` and the seven Drizzle tables, added to `allTables`.
- `apps/api/test/integration/db/assignment-migrations.test.ts`: 12 tests.

## Divergences from the plan
None. The plan's decisions held: the partial unique index of `spk_presets`, plain `sku` and `part_item_type_id` in `spk_check_items`, append-only by trigger, no `version` on `spk_change_requests`.

## Skills loaded
None by the Skill tool for this task (the session loaded writing-plans, search-first and coding-standards earlier); this is in the workflow audit.

## Evidence

### RED
- `assignment migrations`: 11 of 12 failed (no tables, no sequence, no foreign keys); `DEC-95 tracks_work_time defaults to true` passed, as the column exists since migration 0009.
- After the migration, D-12 drift failed with the seven tables "only in the database" (its probe tests too, as their ignore list comes from `allTables`).

### GREEN
- `assignment-migrations`, `drift`, `conventions`, `migrate`: 4 files, 26 tests.

### Gates
`check:coverage` "Coverage OK", `check:kiro-skills`, `check:secrets`, `lint`, `typecheck`, `check:client`, `check:layers` pass; the task's files pass Prettier (Prettier has no SQL parser; `format:check` skips `.sql`).

### Suites
- API unit: 8 files, 86 tests.
- API integration: 305 passed, 1 skipped (the S3 contract run, CI only), 2 failed, both known local failures: BR-10 in `db/identity-schema.test.ts` and NFR-14 in `harness/real-transactions.test.ts` (the local PostgreSQL is not in UTC). The five BullMQ tests passed this time (Redis up).
- Shared, web and mobile code did not change; CI runs their suites. The trial seed over the new migration (`trial-cli --reset`) is checked by CI.

## Notes for later tasks
- **TASK-202:** register the dummy module in the engine harness (as `insertAssignment` of `assignment-migrations.test.ts` does) and add the gateway methods it needs.
- **TASK-301 and the part item type task:** constrain `spk_check_items.sku` and `part_item_type_id`.
- **TASK-708:** the access log for every read of `mobilisation_location_trail` (RSK-09, NFR-04).
