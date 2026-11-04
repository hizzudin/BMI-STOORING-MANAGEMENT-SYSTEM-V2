# TASK-008 CI

Status: **open**. Everything that can run on this machine passes; "workflow green" needs a push, which the product owner has not asked for yet. Branch protection on `main` (D-06) is also the owner's to switch on.

## Checked here

| Step of `.github/workflows/ci.yml` | Command | Result |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| PRD coverage and named tests | `pnpm check:coverage` | exit 0 |
| Secret scan | `pnpm check:secrets` | exit 0 |
| Format, lint, typecheck | `pnpm format:check`, `pnpm lint`, `pnpm typecheck` | exit 0 |
| Layer rules | `pnpm check:layers` | exit 0, 56 modules |
| Tests with coverage gates | `pnpm test:coverage` | exit 0 |
| E2E | `pnpm e2e` | exit 0 |

## Deliberate failures

| Planted fault | Result |
| --- | --- |
| `engine/probe.ts` imports `modules/stock/probe.ts` and `pg` | `check:layers` exit 2: `engine-never-imports-a-module`, `business-logic-never-imports-a-driver` |
| `REQ-SPK-001` removed from `specs/tasks.md` | `check-coverage.mjs --tests` exit 1, lists the REQ |
| An AWS-format fake secret key in a source folder | `check:secrets` exit 1: `AWSSecretAccessKey` |

All planted files were removed and `specs/tasks.md` restored.

## Not verified

- The workflow has never run on GitHub: the YAML, the service containers and `pnpm/action-setup` are unproven until the first push.
- CI checks for generated client drift and migration drift arrive with TASK-010 and TASK-009.
