# BMI Stooring System

Work Order driven fleet maintenance for BMI: a web app for the office and an Android app for the field. No maintenance happens on a vehicle unless an approved Work Order authorises it.

This repository starts from zero. It holds the specification and the design target; the code is built from them with Claude Code.

| Path | What it is |
| --- | --- |
| `PRD.md` | The specification core. Start here; §0.6 says what else to load. |
| `docs/prd/` | The rest of the specification: one file per functional area, data model, UI, flows, traceability, history. |
| `Design Artifact/` | The visual target of the product: open `Design Artifact/index.html`. Add `?review` to a URL to see the role switch and allowedActions. |
| `DESIGN.md` | The design system as tokens and rules. |
| `PRODUCT.md` | Product summary. |
| `CLAUDE.md` | Rules for the coding agent. |
| `.claude/skills/` | Project skills the agent loads per task. |

## Getting started

1. Open this folder in Claude Code.
2. Ask it to start the first session in `CLAUDE.md`: read the PRD and write the build specs in `specs/`.
3. Review the specs, then build task by task.

Viewing the design artifact needs a local web server (the pages load a shared kit), for example `npx serve "Design Artifact"`.
