# ADR-0001: Staging seed re-typed from the canvas example values

- Status: Accepted (2026-11-03, product owner, grilling Q6)
- Applies to: PRD §8.3 ("The example data of the design canvas seeds staging"), CLAUDE.md hard constraint on artboard sample data

## Context

PRD §8.3 says the example data of the design canvas seeds staging. CLAUDE.md says never to import artboard HTML/CSS or its sample data. Read literally, the two disagree.

## Decision

- The example values shown in the artboards may be **re-typed** into a staging-only seed script (`apps/api/seeds/staging/`) so that UAT on staging uses realistic names and figures.
- Artboard files are never imported, parsed or copied by code or scripts; the seed is plain data written by hand.
- The seed runs only against staging (guarded by an environment check). Production never receives it; production starts empty in Setup mode (REQ-IAM-010).
- Tests do not use the seed: they build their own data from the values of the acceptance criteria.

## Consequences

- CLAUDE.md gets a short note pointing to this ADR, so both rules read the same way.
- The seed must stay consistent with the migrations; it runs in CI against a scratch database to catch drift.
