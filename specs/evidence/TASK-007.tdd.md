# TASK-007 Test harness

Foundation task (D-10): no AC or flow. Rules: NFR-01, NFR-14; design D-02, D-09.

## RED (commit afff1ea)

`pnpm --filter @bmi/shared test` and `pnpm --filter @bmi/api test:int` failed: `Cannot find module './fake-clock.js'` and the same for `wib.js`, the two units not yet written. The database isolation, real transaction and `/health` tests already passed (9 tests), because they exercise the harness itself.

## GREEN

| What is guaranteed | Test or command | Type | Result |
| --- | --- | --- | --- |
| A WIB day starts at 17:00 UTC, across a year boundary (NFR-14) | `packages/shared/src/time/wib.test.ts` | unit | 3 pass |
| A fake clock is set in WIB, holds UTC, moves across WIB midnight (NFR-14) | `harness/fake-clock.test.ts` | integration layer | 3 pass |
| A worker connects to its own `test_w<N>`, sees only its file's rows (D-02) | `harness/worker-database-{a,b}.test.ts` | integration | 4 pass |
| Commit is visible to another connection; rollback leaves nothing (NFR-01) | `harness/real-transactions.test.ts` | integration | 2 pass |
| The session runs in UTC (NFR-14) | same file | integration | 1 pass |
| `GET /health` boots the real Nest module | `test/integration/health.test.ts` | integration | 1 pass |
| A browser opens the production build | `apps/web/e2e/smoke.spec.ts` | E2E | 1 pass |
| The page renders in jsdom | `apps/web/app/page.test.tsx` | unit | 1 pass |

## _Verify_

- Sample unit, integration and E2E tests pass: `pnpm test` (4 tests), `pnpm --filter @bmi/api test:int` (12 tests), `pnpm e2e` (1 test).
- Two workers use two databases: after a run, PostgreSQL lists `bmi_template`, `test_w1`, `test_w2`, `test_w3`.
- The coverage gate fails below the threshold: with an untested file added, `pnpm --filter @bmi/api test:coverage` exited 1 with `Coverage for lines (45.45%) does not meet global threshold (80%)`. The file was then removed. Without it every package is at 100 %.

## Known gaps

- `apps/mobile` and the packages without tests have no test script yet. A mobile runner is chosen with the first mobile code (TASK-1xx spike): Expo's runner is not Vitest.
- The `src/engine/**` 90 % gate is configured, but nothing has reached it: the folder is empty until the engine task.
- `global-setup.ts` applies migration files in name order; TASK-009 replaces this with the real runner.
