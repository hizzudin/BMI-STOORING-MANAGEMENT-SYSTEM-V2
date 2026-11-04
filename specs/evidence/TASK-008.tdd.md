# TASK-008 CI

Status: **done**. GitHub Actions run 41806304702 on `d8eaa51` is green and every step ran (50 integration tests, 1 E2E). Branch protection on `main` (D-06) is still the owner's to switch on.

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

- The three deliberate failures ran on this machine with the same commands the workflow runs, not on GitHub.
- GitHub warns that `actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v4` target Node 20, which is deprecated; they run forced on Node 24.

## Review fix: the rest of the layer table (design.md §3)

The first rule set covered only part of the table. Planted violations, removed afterwards:

| Planted fault | Rule that failed it |
| --- | --- |
| A module imports another module | `module-never-imports-another-module` |
| `http/` imports `infra/` | `http-never-imports-infra` |
| `core/` imports `http/` | `business-logic-never-imports-http-or-storage-sdk` |
| `core/` imports a type from `express` | `business-logic-never-imports-http-or-storage-sdk` |
| `core/` imports a type from `pg` | `business-logic-never-imports-a-driver` |

Type-only imports count: the rules match `@types/` too. These ran on this machine with the command the workflow runs. `@nestjs/common` as a whole stays allowed in `core/` for `@Injectable`, so an HTTP exception from it is not caught by this rule. The S3 SDK has no package installed yet, so its path was not exercised.
