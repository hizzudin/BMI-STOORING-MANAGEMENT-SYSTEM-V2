---
inclusion: auto
name: kiro-spec
description: How to create the thin Kiro spec folder .kiro/specs/task-nnn-slug for a task delegated to Kiro, pointing at the PRD and specs/ instead of copying them.
---

# A thin Kiro spec for each delegated task

The build plan lives in `specs/`; the requirements live in `PRD.md` and `docs/prd/`. A Kiro spec only
points at them, so nothing is written twice and nothing drifts. Create it right after claiming the
task (collaboration steering), in `.kiro/specs/task-nnn-slug/`, and commit it with the task.

## requirements.md

```markdown
# TASK-nnn <title from specs/tasks.md>

The requirements are the PRD text of these IDs; read each one in full. This file never restates them.

- Requirements: REQ-... (docs/prd/areas/<n>-<code>.md)
- Acceptance criteria: AC-... (specs/acceptance-tests.md)
- Rules and transitions: BR-..., SM-..., TX-..., NFR-...
- Decisions: DEC-... (PRD.md, section 11)
- Journeys: FLW-... (docs/prd/flows.md, specs/tdd-user-journeys.md)

#[[file:docs/prd/areas/<n>-<code>.md]]
```

## design.md

```markdown
# TASK-nnn design

- Data: the tables of the task in docs/prd/data-model.md (section numbers).
- Screens: the artboards under "Screens built here" (Design Artifact/<area>/<Screen>.html) and their
  rows in docs/prd/ui-action-map.md.
- Architecture and patterns: specs/design.md and the structure steering; this task adds section 5.nn.
- Open points answered by the owner: DEC-... (one line each).
```

## tasks.md

Use the eight steps of the task-cycle steering as the checkbox list, each with its concrete files:

```markdown
- [ ] 1. Read the task entry, its PRD IDs, artboards and skills
- [ ] 2. Ask the owner the open points (list them)
- [ ] 3. Record DEC-nnn, PRD v2.nn, tasks.source.mjs; commit the spec
- [ ] 4. Tests first: <integration files>, <web tests>, <e2e spec>; then <migration>, <service>, <controller>, <page>
- [ ] 5. QA <screens> against their artboards at 1440 x 900
- [ ] 6. Gates: format, types, lint, layers, secrets, coverage, e2e, check:client, check-coverage
- [ ] 7. design.md 5.nn, evidence TASK-nnn, done: true, CONTEXT row; commit
- [ ] 8. Report to the owner and ask to merge
```
