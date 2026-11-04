# TASK-009 Data seam

Status: **done** after the owner decision below. Until then the store behind the `Idempotency-Key` (NFR-01) had no table in §9, and nothing was invented in its place.

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

## Idempotency store (owner decision, DEC-108, PRD v2.19)

The product owner chose a new table in §9. Spec first: `idempotency_keys` in §9.12, TX-22, TX-16 and DEC-108.

RED (commit b866867): `Cannot find module '../../../src/core/idempotency/run-idempotent.js'`.

GREEN:

| What is guaranteed | Test | Result |
| --- | --- | --- |
| A retry returns the stored response; the action runs once (TX-22) | `db/idempotency.test.ts` | pass |
| A failed action leaves no key; the retry runs | same | pass |
| The same key with another request is refused | same | pass |
| Two requests at once run the action once and answer the same | same | pass |
| The same key from another user is another request | same | pass |
| Keys older than 30 days are removed, others stay (DEC-108) | same | pass |
| A missing or oversized key answers 400; a reused key answers 409 | same | pass |
| Migration and Drizzle definition match | `db/drift.test.ts` | pass |

`int "UnitOfWork|idempotency|optimistic|TX-18"`: 20 pass. Whole suite: 50 tests. `@bmi/api` coverage: lines 99,27 %, branches 90,24 %. **This line of `_Verify_` is now satisfied.** The status at the top of this file is history.

Open by design: the foreign key to `users` arrives with TASK-103; the daily job that calls `purgeIdempotencyKeys` arrives with TX-16; no real endpoint uses `runIdempotent` yet. 30 days is an assumption marked [A].

Also fixed: the integration test timeout went from 60 s to 180 s because `CREATE DATABASE` once took 66 s on this machine.
