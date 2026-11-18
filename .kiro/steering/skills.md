---
inclusion: always
---

# The project skills, for Kiro

The skills the project names (in `CLAUDE.md`, `WORKFLOW_STANDARDS.md` §7, `AGENT_GUIDE.md` and the
_Skill_ lines of `specs/tasks.md`) all live in `.claude/skills/<name>/`. Kiro has an exact copy in
`.kiro/skills/<name>/`.

## Rules for the copy

- **Keep the two folders the same.** `node specs/tools/sync-kiro-skills.mjs` copies `.claude/skills` to `.kiro/skills`, and `pnpm check:kiro-skills` fails when they differ. CI runs that check on every pull request.
- **Edit only the source.** Change a skill in `.claude/skills`, then run `pnpm sync:kiro-skills`, and commit both folders together. Never edit `.kiro/skills` by hand.
- **Adding a skill:**
  1. add its folder with a `SKILL.md` to `.claude/skills`, together with its license when it comes from a plugin (see `ECC-LICENSE.txt`, `SUPERPOWERS-LICENSE.txt` and `KARPATHY-SKILLS-LICENSE.txt`);
  2. name it where the project names skills;
  3. sync. The check fails when a named skill has no folder.
- **The one exclusion** is the prebuilt binaries of a skill's scripts (`impeccable/scripts/bin/`). They are large, so they are not copied. When a skill's script needs them, run it from `.claude/skills/impeccable/scripts/`.

## How to use a skill (Kiro has no Skill tool)

- **Read** `.kiro/skills/<name>/SKILL.md` before writing the part of the code it covers. Read its `references/` files when the SKILL.md points at them.
- **The prefix is only the plugin it came from.** A name on a _Skill_ line may carry a prefix (`ecc:`, `superpowers:`, `andrej-karpathy-skills:`); the folder name is the part after the colon.
- **Which skills to load:**
  - the always-on skills, for every implementation task;
  - the group of each part of the code the task touches (WORKFLOW_STANDARDS §7);
  - not a group the task does not touch, even when it is on the _Skill_ line.
- **Write in the evidence which skills you read.**

## Always on (every implementation task)

| Skill | Path | Use |
| --- | --- | --- |
| search-first | `.kiro/skills/search-first/` | Reuse before writing new code |
| coding-standards | `.kiro/skills/coding-standards/` | One style across the monorepo |
| typescript-pro | `.kiro/skills/typescript-pro/` | Types (named with coding-standards in CLAUDE.md) |
| git-workflow | `.kiro/skills/git-workflow/` | The git discipline of WORKFLOW_STANDARDS §6 |
| verification-loop | `.kiro/skills/verification-loop/` | Build, types, lint, tests and _Verify_ before a task is done |
| architecture-decision-records | `.kiro/skills/architecture-decision-records/` | Before any divergence |
| karpathy-guidelines | `.kiro/skills/karpathy-guidelines/` | The behavioural guidelines of CLAUDE.md: think first, simplicity, surgical changes, goal-driven |
| writing-plans | `.kiro/skills/writing-plans/` | The implementation plan of WORKFLOW_STANDARDS §2A |

## By area (load the groups the task touches)

| Area | Skills (folders in `.kiro/skills/`) |
| --- | --- |
| API (NestJS) | nestjs-expert, api-designer, fullstack-guardian, nestjs-patterns, backend-patterns, api-design, error-handling |
| Data seam | hexagonal-architecture (business logic depends on a port, never on a DB driver) |
| PostgreSQL | postgres-pro, database-optimizer, postgres-patterns, database-migrations, benchmark (NFR-19) |
| Jobs | redis-patterns (idempotent daily and monthly jobs, NFR-12, NFR-14) |
| Web (Next.js) | nextjs-developer, impeccable, frontend-design-direction, frontend-patterns, react-patterns, react-performance, design-system, make-interfaces-feel-better, motion-foundations, frontend-a11y |
| Mobile (Expo) | react-native-expert, react-native-patterns, accessibility |
| Tests | test-master, tdd-workflow, react-testing, e2e-testing, browser-qa (compare each built screen with its artboard side by side) |
| Security | security-reviewer, security-review, production-audit |
| Deploy | deployment-patterns, docker-patterns, delivery-gate, canary-watch |
| Docs | code-documenter, living-docs-governance |
| Spec work | spec-driven-development (the specs/ files: requirements, design, tasks, CONTEXT) |
| Debugging | debugging-wizard (an error or a failing test whose cause is not obvious; read it before changing code) |

## Notes on some skills

- **delivery-gate** describes a Claude Code stop hook. For Kiro, apply its checklist by hand before you report a task done.
- **architecture-decision-records** writes ADRs. This project records decisions as DEC rows in `PRD.md` and, for architecture, in `docs/adr/`; follow the project's places.
- **browser-qa:** the project's QA method is in the task-cycle steering, section 5, and WORKFLOW_STANDARDS §4: artboard and built screen side by side at 1440 × 900.
- **writing-plans** saves plans in `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. It names other superpowers skills for running a plan; they are not part of this project, so carry out the plan yourself, task by task, with tests first.
