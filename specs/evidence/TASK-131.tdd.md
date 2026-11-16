# TASK-131 Local trial: one command, dummy data, every role signs in

- **Rules:** DEC-113, ADR-0003 (amended), DEC-130 (PRD v2.42).
- No requirement changes, no migration, no new runtime dependency.

## Spec first (DEC-130, commit 00a2a23)

The owner decided before any code:
- **Database:** a dedicated `bmi_trial` database, so `bmi_dev` is never touched.
- **Passwords:** made at random per machine and written to `.data/trial-accounts.md` (gitignored), never to the public repository. This amends ADR-0003.
- **Vehicles:** without documents until TASK-601.
- **SPKs:** one in each of the nine statuses.
- **Servers:** the API and `next dev` run in one terminal.
- **Verify:** until TASK-207 it submits a seeded draft that has steps.

The plan is in `docs/superpowers/plans/2026-11-16-task131-local-trial.md`; the owner approved it.

## What changed
- **`apps/api/src/infra/db/trial/`:** `trial-target.ts`, `trial-seed.ts` and `trial-cli.ts`.
- **`scripts/trial.mjs`:** with the root scripts `trial` and `trial:reset`.
- **CI:** a step runs the seed after every migration (`--reset` on the CI Postgres).
- **`.claude/launch.json`:** the `api-trial` configuration.
- **Docs:** `docs/dev-setup.md` gets a Local trial section with each role's email; ADR-0003's path line now names `src/infra/db/trial/`.

## Divergence from ADR-0003
ADR-0003 named `apps/api/seeds/local/`, but the API build compiles only `src/`. The seed lives in `apps/api/src/infra/db/trial/`, and the ADR line says so. This divergence was in the approved plan.

## Skills loaded
- **Always-on:** search-first, coding-standards, git-workflow and verification-loop.
- **Earlier in the session:** tdd-workflow.
- **Not loaded:** postgres-patterns, database-migrations and living-docs-governance.

## Evidence
- **RED:** `trial-seed.test.ts` failed because the module did not exist.
- **GREEN, 6/6:**
  - the target accepts `localhost` and `127.0.0.1` with `bmi_trial`, and refuses another host, `bmi_dev` and other names;
  - one account per role, each signing in through the real API with its seeded password;
  - nine SPKs, one per status, numbered `SPK-\d{10}`, with steps and approval rows that agree;
  - the seeded draft is submitted by the Planner and approved by a Supervisor through the API;
  - a second seed is refused.
- **Two findings while turning it green:**
  - the test harness empties `app_settings`, so the seed now falls back to the PRD numbering formats;
  - the harness also empties `role_permissions`, so the test seeds the default matrix, as other tests do.
- **Gates:** lint, typecheck and check:layers are clean. Prettier is clean on the touched files.
- **Verify on this machine (PostgreSQL 18 on localhost):**
  - `pnpm trial:reset` built everything and seeded ten accounts, printing emails only.
  - `pnpm trial` kept the data ("The local trial keeps its data") and started the API and web app.
  - All ten accounts signed in (200).
  - In the browser, the Planner saw the nine SPKs in SPKList and saved a new SPK (SPK-2611160010, Draft). It then submitted the seeded draft "Tyre rotation" (SPK-2611130001), which became Pending approval.
  - The Supervisor saw it in Approvals (badge 2) and approved it, and the stamp shows.
  - Menus were checked in the browser for the Planner and the Supervisor only. The other roles were checked by sign-in, and their menus come from the capability tests (NAV-9).
