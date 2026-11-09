# ADR-0003: Local trial seed with dummy data

- Status: Accepted (2026-11-09, product owner)
- Applies to: PRD §8.3, §10 (DEC-113), ADR-0001

## Context

The product owner wants to try the system on a local computer with dummy data as soon as possible, and keep trying each feature as it is built. ADR-0001 allows a seed re-typed from the canvas values for staging only, and staging waits for Q-03.

## Decision

- A second seed, `apps/api/seeds/local/`, holds dummy data for a local trial: one user per role, vehicles with documents, and SPKs in each status. Later tasks add the data their feature needs.
- Its values are typed by hand. Artboard files are never imported, parsed or copied, as in ADR-0001.
- The seed refuses to run unless the database is local (`localhost` or `127.0.0.1`). It is never loaded into staging or production, and tests never use it.
- `pnpm trial` migrates, seeds and starts the API and web app; `pnpm trial:reset` empties the local database and seeds it again.
- The passwords of the dummy users are local development values, kept in the seed and `docs/dev-setup.md`, never real ones.

## Consequences

- Phase 1 is reordered so this trial comes as early as the task dependencies allow (TASK-131).
- The seed must follow the migrations; CI runs it against a scratch database, like the staging seed.
