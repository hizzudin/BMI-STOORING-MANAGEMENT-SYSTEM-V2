---
inclusion: always
---

# Product

BMI Stooring System: a web and mobile fleet preventive maintenance system. No maintenance happens on
a vehicle without an approved Surat Perintah Kerja (SPK). Ten roles (Planner, Mechanic, Warehouse
Manager, Supervisor, GM, System Admin, Access Manager, Driver, Field Coordinator, Accounting); what a
user may see and do comes from the effective capability set, never from the role name (PRD 2.4).

#[[file:PRODUCT.md]]

Where the truth lives (precedence, highest first):

1. `PRD.md` (SDD spec core: scope, roles, state machines, rules, NFRs, decisions DEC-nnn).
2. `docs/prd/` (areas/*.md with REQ and AC per area, data-model.md §9, ui.md and ui-action-map.md §7,
   flows.md §6, traceability.md §12, history.md for retired items only).
3. `Design Artifact/` (the visual target: one artboard per screen, dialog and panel; start at
   `Design Artifact/index.html`). `DESIGN.md` writes the same design down as tokens and rules.
4. `specs/` (the build plan: requirements.md index, design.md architecture, tasks.md plan, CONTEXT.md
   journal, acceptance-tests.md, tdd-user-journeys.md, decision-index.md, evidence/TASK-nnn.tdd.md).

Load only what a task needs (PRD §0.6): PRD.md core, the task's area file, the matching part of
data-model.md, and its artboard.
