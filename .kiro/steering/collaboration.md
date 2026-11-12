---
inclusion: always
---

# Working beside Claude Code: one task, one agent

The product owner delegates whole tasks of `specs/tasks.md` to either agent. A task belongs to one
agent from its first question to the owner until it is merged; the other agent never touches it.

## Before you start a task

1. Work in your own folder: a git worktree of this repository (for example
   `git worktree add ../bmi-kiro main`, then `pnpm install` there). Never switch branches in the folder
   Claude Code is working in; both agents share the branches but not the working files.
2. Run `node specs/tools/next-numbers.mjs`. It reads `main` and every local branch and prints:
   - the next free `DEC-nnn`, PRD version `v2.nn`, migration number `NNNN` and CONTEXT row;
   - the claimed tasks (task branches whose task is not yet done on `main`).
3. Take the task the owner named, or the next `[ ]` task of `specs/tasks.md` in the trial-first order
   of `specs/CONTEXT.md`. Never take a task that is claimed, and never one whose _Depends_ are not done.
4. Claim it by creating its branch from `main` before anything else:
   `type/phaseN-taskNNN-slug` (CLAUDE.md git discipline). The branch is the claim.
5. Tell the owner, in Indonesian, which task you took and the branch name.

## Numbers both agents share

DEC numbers, PRD versions (`docs/prd/history.md`), migration numbers and CONTEXT journal rows are global.
Take each one from `next-numbers.mjs` at the moment you write it, never from memory. When your branch
is merged after another task that took the same number, renumber yours before the merge (DEC row,
history line, migration file name, journal row, every place that cites it) and say so in the report.

## Files only one agent edits at a time

Merge conflicts are expected only in these shared files; keep your edits to them small and rebuild
the generated ones after a merge instead of resolving them by hand:

- `PRD.md` (one new DEC row), `docs/prd/history.md` (one new line), `specs/CONTEXT.md` (one row and
  the Active task line), `specs/design.md` (one section).
- `specs/tools/tasks.source.mjs` (your task only), then regenerate `specs/tasks.md` and
  `specs/decision-index.md` with `node specs/tools/build-tasks.mjs`.
- `packages/api-client/*` (regenerate with `pnpm gen:client`), `apps/api/src/app.module.ts`,
  `apps/api/src/infra/db/schema/index.ts`, `packages/shared/src/index.ts`, `apps/web/app/globals.css`.

## Shared machine resources

Both agents use the same local PostgreSQL (`bmi_dev`, plus the e2e and test databases), Redis, and
ports 3000, 3001 and 4173. Do not run e2e, dev servers or the full coverage run while the other agent
does; ask the owner when unsure. The machine has about 1 GB of free memory.

## Ending a task

Follow the task-cycle steering. Never merge into `main` or push without the explicit go-ahead of the
owner; the owner decides the order in which finished task branches are merged.
