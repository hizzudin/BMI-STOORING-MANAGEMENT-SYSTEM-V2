# TASK-009 Data seam

Status: **open**. Everything is built and green except the store behind the `Idempotency-Key` (NFR-01): §9 has no table for it, and adding one changes the data model, which needs the product owner (CLAUDE.md). Nothing was invented in its place.

## RED (commit ac4a407)

`pnpm --filter @bmi/api test:int`: 6 test files failed with `Cannot find module` for `unit-of-work.js`, `optimistic-lock.js`, `conventions.js`, `drift.js`, `migrate.js` and `bullmq-queue.js`. The 12 tests of TASK-007 stayed green.

## GREEN

| What is guaranteed | Test file | Result |
| --- | --- | --- |
| Gateways in one `run` commit or roll back together; uncommitted writes stay hidden (NFR-01) | `db/unit-of-work.test.ts` | 4 pass |
| The second of two saves on one version is refused and changes nothing; HTTP answers 409 with a clear message (NFR-03) | `db/optimistic-lock.test.ts` | 3 pass |
| A unique index that counts deleted rows and a foreign key that is not RESTRICT are reported; the migrated schema has neither (TX-18, BR-10) | `db/conventions.test.ts` | 4 pass |
| A hand-edited Drizzle type, nullability, column or table is reported (D-12) | `db/drift.test.ts` | 6 pass |
| Files apply in order, once, whole or not at all; an edited applied file is refused (TX-01) | `db/migrate.test.ts` | 4 pass |
| Jobs reach the processor; the same job id enqueues once (NFR-01) | `queue/bullmq-queue.test.ts` | 2 pass |

Whole suite: 35 tests. `test:coverage` for `@bmi/api`: lines 98.92 %, branches 95.65 %. `check:layers`: no violations.

## _Verify_

- `int "UnitOfWork|idempotency|optimistic|TX-18"`: 10 pass, but none of them is an idempotency test, because the store is not built. This line is **not** satisfied yet.
- The drift test fails on a hand-edited Drizzle column: satisfied, `D-12 drift: a hand-edited column type is reported`.

## Notes

- `meta.schema_migrations` is the runner's ledger, in its own schema outside `public`. It is tooling, not §9 data; recorded in design.md.
- §9 tables arrive with TASK-103 on, so the real-schema drift and convention tests pass on an empty schema today. Their detection is proven by the probe tables.
- BR-10 append-only triggers and the other §9 guards are per table, so they arrive with their migrations.
