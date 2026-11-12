---
inclusion: always
---

# Tech stack, commands and the local machine

## Stack

- pnpm monorepo with Turbo; Node 22; TypeScript everywhere.
- `apps/api`: NestJS (ESM), hexagonal layers, Drizzle ORM over PostgreSQL 16, Redis (BullMQ delayed jobs).
- `apps/web`: Next.js 16 App Router, React 19; Vitest + React Testing Library; Playwright e2e.
- `apps/mobile`: Expo (phase 7).
- `packages/shared`: Zod schemas, enums, permissions, numbering, WIB time helpers (`@bmi/shared`).
- `packages/api-client`: client generated from the OpenAPI contract of the API (`@bmi/api-client`). Never edit it by hand.
- `packages/chassis-map`: the chassis map renderer and geometry (`@bmi/chassis-map`).

## Commands (run from the repository root unless noted)

| What | Command |
| --- | --- |
| Install | `pnpm install` |
| Build all | `pnpm build` |
| Types | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Format check | `pnpm format:check` (write: `pnpm exec prettier --write <paths>`) |
| Hexagonal layers | `pnpm check:layers` |
| Secrets | `pnpm check:secrets` |
| Unit + integration with coverage | `pnpm --filter @bmi/shared test:coverage`, then `@bmi/web`, then `@bmi/api` (one at a time on this machine) |
| One API integration file | `cd apps/api && pnpm exec vitest run --project int test/integration/<area>/<file>.test.ts` |
| One web test file | `cd apps/web && pnpm exec vitest run <path> --maxWorkers=1` |
| API client after a contract change | `pnpm gen:client`, then `pnpm --filter @bmi/api-client build`; after staging, `pnpm check:client` must show no diff |
| Build the task list | `node specs/tools/build-tasks.mjs` (after editing `specs/tools/tasks.source.mjs`) |
| PRD coverage | `node specs/tools/check-coverage.mjs --tests` (must print `Coverage OK`) |
| E2E | `pnpm --filter @bmi/api build && pnpm --filter @bmi/web build`, then in `apps/web`: `TEST_DATABASE_URL=postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev npx playwright test` |
| Migrate the local database | `pnpm --filter @bmi/api build`, then `DATABASE_URL=postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev node apps/api/dist/infra/db/migrate-cli.js` |

`tasks.md` and `decision-index.md` are generated: never edit them; edit `specs/tools/tasks.source.mjs`
and rebuild. Strings in `tasks.source.mjs` are single-quoted: write "the step of the Stock module",
never a possessive with an apostrophe, or the file stops parsing.

## The local machine (Windows 10, 8 GB, about 1 GB free)

- PostgreSQL 16 and Redis run inside WSL (`Ubuntu-24.04`). WSL stops when nothing keeps it alive,
  and the database goes with it. Keep a terminal running
  `wsl -d Ubuntu-24.04 -u root -- sleep infinity`. If the database is down:
  `wsl -d Ubuntu-24.04 -u root -- pg_ctlcluster 16 main start`; Redis: `redis-cli ping`, else
  `service redis-server start`. Right after a start PostgreSQL may answer `57P03` (recovering):
  wait and retry.
- Memory is tight. Run test packages one at a time, use `--maxWorkers=1` when a vitest worker
  "failed to start", and stop dev servers before e2e. `test/integration/db/migrate.test.ts` can hit
  its 180 s hook timeout in a full run under load; rerun it alone before calling it a failure,
  and say so in the report. CI is the check of record.
- The local database `bmi_dev` is in Setup mode by default, which removes every `spk.*`
  capability (REQ-IAM-010). To try SPK screens, set `system_mode` to `"Live"` in `app_settings` and
  remove the row again afterwards.
- Local trial accounts live in `.data/local-accounts.md` (gitignored). Never paste their passwords
  into chat, commits, specs or tests.
- Known noise: `prettier --check` flags the untracked `.impeccable/hook.cache.json` (ignore it);
  `next dev` rewrites `apps/web/next-env.d.ts` (restore that file from git before committing).

## Never

- Commit secrets, `.env` files or cloud keys; the repository is public.
- Push, merge into `main`, force-push, discard commits or skip hooks without the explicit go-ahead of the owner.
- `git add -A`; stage the files of the task by name.
