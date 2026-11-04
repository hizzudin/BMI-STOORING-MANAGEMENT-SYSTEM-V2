# BMI Stooring System

Surat Perintah Kerja driven fleet maintenance for BMI: a web app for the office and an Android app for the field. No maintenance happens on a vehicle unless an approved Surat Perintah Kerja authorises it.

The product is fully specified; the code is built from the specification with Claude Code, task by task, test first.

| Path | What it is |
| --- | --- |
| `PRD.md` | The specification core. Start here; §0.6 says what else to load. It wins over every other file. |
| `docs/prd/` | The rest of the specification: one file per functional area, data model, UI, action map, flows, traceability, history. |
| `Design Artifact/` | The visual target of every screen (DEC-96): open `Design Artifact/index.html`; add `?review` to a URL to see the role switch and allowedActions. |
| `DESIGN.md` | The design system as tokens and rules; where it differs from an artboard, the artboard wins. |
| `PRODUCT.md` | Product summary. |
| `CLAUDE.md` | Rules for the coding agent. |
| `specs/` | The build specs: `CONTEXT.md` (session journal, read first), `requirements.md` (index of PRD IDs), `design.md` (architecture and decisions), `tasks.md` (generated plan), `acceptance-tests.md` (every AC as a test), `tdd-user-journeys.md` (every flow as tests), `decision-index.md`. |
| `specs/tools/` | `tasks.source.mjs` (the hand-written plan), `build-tasks.mjs` (generates tasks.md, acceptance-tests.md and decision-index.md from it and the PRD), `check-coverage.mjs` (fails if any PRD item is left out or the task graph is broken). |
| `docs/adr/` | Decisions that diverge from the PRD or CLAUDE.md. |
| `.claude/skills/` | Project skills the agent loads per task. |

## Working on it

1. Read `specs/CONTEXT.md`, then pick the next open task in `specs/tasks.md` and follow its rules.
2. After any change to the plan or the PRD:

   ```bash
   node specs/tools/build-tasks.mjs
   node specs/tools/check-coverage.mjs
   ```

   The second command must print `Coverage OK`. Once code exists, `--tests` also checks that every acceptance criterion of a finished task has a test named with its ID.
3. View the design artifact through a local web server (the pages load a shared kit): `node specs/tools/serve-artifact.mjs` (port 4173), or the `design-artifact` entry of `.claude/launch.json`.

## Repository rules

The repository is public: never commit secrets, keys, keystores, `.env` files or real customer data. Local setup (PostgreSQL 16 and Redis in WSL, no Docker) is described in `docs/dev-setup.md` once TASK-005 is done.
