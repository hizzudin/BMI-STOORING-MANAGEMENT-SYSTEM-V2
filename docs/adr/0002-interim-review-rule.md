# ADR-0002: Interim review rule until an internal developer joins

- Status: Accepted (2026-11-03, product owner, grilling Q20); revisit when an internal developer joins
- Applies to: PRD §8.4 risk tiers (design note reviewed by an internal developer; two reviewers per merge for the critical tier; an internal developer reviews every merge in the high tier) and the working rules of §8.2

## Context

The PRD expects internal developers to review the engine and registry design note and the merges of critical- and high-tier areas. No internal developer is named for the project yet (CONTEXT.md OQ-5).

## Decision

Until an internal developer joins:

- **Design notes (ENG, REG):** reviewed by the product owner and by one independent agent review (`ecc:code-reviewer` or `ecc:architect`, run in a session separate from the author's).
- **Critical-tier merges (ENG, REG):** the two reviews are the product owner and one independent agent review; the PR body records both.
- **High-tier merges (SPK, STK, INV, PLC, MOB):** one independent agent review plus the product owner's approval of the PR.
- Every such review is recorded in the PR body and in the task's evidence file.

## Consequences

- The four-eyes intent of §8.4 is kept, but the second pair of eyes is an agent, which is weaker than a human developer. CONTEXT.md keeps OQ-5 open.
- When an internal developer joins, they review the merged critical-tier code once, and this ADR is superseded.
