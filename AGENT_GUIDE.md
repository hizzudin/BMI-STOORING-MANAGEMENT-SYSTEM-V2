# Agent Guide — BMI Stooring System v2

> **READ THIS FIRST** — This is the single entry point for every agent, every session.
> It tells you what to read, in what order, and how to work on this project.

---

## 1. Quick Start (30 seconds)

| Step | Action | File |
|------|--------|------|
| 1 | Read this file completely | `AGENT_GUIDE.md` |
| 2 | Read the session journal | `specs/CONTEXT.md` |
| 3 | Read requirements index | `specs/requirements.md` |
| 4 | Read architecture + file structure | `specs/design.md` |
| 5 | Pick next task from plan | `specs/tasks.md` |
| 6 | Read the task's `_Read_` files + PRD IDs | (varies per task) |
| 7 | **PLAN FIRST** — create plan, human review, approval | `docs/superpowers/plans/...` |
| 8 | **WRITE E2E TESTS FIRST** — Playwright specs for every FLW | `specs/tdd-user-journeys.md` |
| 9 | **QA UI COMPARISON (Mandatory)** — compare with Design Artifact | `ecc:browser-qa` skill |

**Do not write code until you have done all 9 steps.** See WORKFLOW_STANDARDS.md §1 for complete protocol.

---

## 2. The Three Source-of-Truth Files

| File | Purpose | When to Read |
|------|---------|--------------|
| `PRD.md` | Core spec (SDD Spec v2) — **always wins** on behaviour, rules, data, IDs | Always; every task |
| `Design Artifact/index.html` | Visual target — 179 artboards, one per screen/dialog/panel | Building/changing any screen |
| `specs/design.md` | Architecture, file structure, skill map, ADR index | Every session start |

**Supporting specs (load only what your task needs):**
- `docs/prd/areas/<n>-<code>.md` — Requirements + ACs for one functional area
- `docs/prd/data-model.md` — Complete PostgreSQL schema (§9)
- `docs/prd/ui.md` + `docs/prd/ui-action-map.md` — Screen inventory + every control
- `docs/prd/flows.md` — User flows (FLW-*) for E2E tests
- `docs/prd/traceability.md` — Per area: where specified, tested, shown, stored, guarded

---

## 3. How to Work a Task (Non-Negotiable)

### Before Writing ANY Code
Follow **WORKFLOW_STANDARDS.md §1 (Session Start Protocol)** and **§2A (Plan-Driven Implementation)**:

```
☐ 1. Open specs/tasks.md, find the next [ ] task
☐ 2. Read EVERY file listed on the task's _Read_ line
☐ 3. Read the FULL PRD text of EVERY ID on the checkbox line, _Acceptance_, _Rules_
☐ 4. Open the artboard(s) on _Screens built here_ in Design Artifact/
☐ 5. Load ALL skills on the task's _Skill_ line + always-on skills
☐ 6. PLAN FIRST (superpowers:writing-plans):
     a) Load skill: `Skill("writing-plans")` or read `references/superpowers/writing-plans.md`
     b) Create plan: Goal, Architecture, File Structure, Task Decomposition, Interfaces, Review Focus
     c) Plan MUST define: clear goal, success criteria (goal-driven execution), exact interfaces, test assertions
     d) Save to `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
     e) **Human review**: Present plan, confirm goal captured, select execution method (Native/Subagent)
     f) ONLY after plan approval → proceed
☐ 7. Write tests FIRST from three sources:
     a) Every AC on _Acceptance_ (specs/acceptance-tests.md)
     b) Every FLW on _Journey_ (specs/tdd-user-journeys.md)
     c) Every rule/transition on _Rules_
```

### While Implementing
- **Build all of it** — no feature/field/control/rule reduced without PO approval
- **Match the artboard exactly** — layout, colours, type, spacing, shapes, icons, states, motion (DEC-96)
- **Permissions from capabilities** — menus/buttons from `GET /me` + `allowedActions`, never role name
- **Hexagonal architecture** — business logic imports gateway interfaces, never concrete DB drivers
- **One entity, one name** — SPK everywhere, never "Work Order" or "WO" (DEC-106)

### Before Marking Task Done
```
☐ Run every _Verify_ command on the task line
☐ Run `node specs/tools/check-coverage.mjs --tests` (must print "Coverage OK")
☐ Compare screen with artboard side-by-side (ecc:browser-qa)
☐ **QA UI COMPARISON (Mandatory)** — compare EVERY screen with Design Artifact side-by-side (ecc:browser-qa) as FINAL step
☐ Write specs/evidence/TASK-nnn.tdd.md
☐ Update specs/tools/tasks.source.mjs → regenerate tasks.md → check-coverage.mjs
```

---

## 4. Git Discipline (Every Task)

| Rule | Example |
|------|---------|
| Branch: `type/phaseN-taskNNN-slug` | `feat/phase1-task125-spk-list-detail` |
| Conventional Commits with TASK + REQ IDs | `feat(spk): list tabs + detail with step cards [TASK-125, REQ-SPK-010, REQ-SPK-011]` |
| Stage specific files (never `git add -A`) | `git add apps/web/components/spk/SpkList.tsx apps/web/components/spk/SpkDetail.tsx` |
| Never force-push, reset --hard, or skip hooks | — |

---

## 5. Key Project Conventions

| Convention | Rule |
|------------|------|
| **Entity name** | Surat Perintah Kerja (SPK) everywhere — screens, docs, IDs, tables, permissions, artboards, code |
| **Number format** | Indonesian: 48.210 km, Rp 1.240.000, 2,4 mm (NFR-09) |
| **Dates/times** | Stored UTC, shown Asia/Jakarta (WIB), format `YYYY-MM-DD` / `HH:MM:SS` (NFR-14) |
| **Document numbers** | `CODE-yymmddNNNN` (SPK, RB, CR, GR, GI, SA, OB, TR, RD, TC, TY) — never reset, never reused (NFR-15) |
| **Money** | 2 decimals; average cost 4 decimals; markup rounded half-up per unit before multiply (NFR-16) |
| **Soft delete** | Core records never physically deleted (BR-10) |
| **Audit** | Every state change writes append-only audit_logs with before/after (NFR-02) |
| **Optimistic lock** | `version` column on mutable tables; second save refused with clear message (NFR-03) |

---

## 6. Permission Model (Three Layers — DEC-93)

| Layer | Question | Decided By |
|-------|----------|------------|
| **L1 Capability** | May this role take this kind of action? | Effective capability set (role_permissions + Planner switch - Setup mode) |
| **L2 Record Rule** | May this user take this action on this record now? | One policy function per action (scope lock, BR-03, state machine) |
| **L3 Interface** | Which menu items, tabs, buttons does this user see? | Effective capability set (menu) + record's `allowedActions` (buttons) |

**Never decide from role name.** The `permission_code` catalogue is in PRD §2.4 (44 codes).

---

## 7. State Machines (PRD §3 — Memorise These)

| Machine | Key States | Critical Rules |
|---------|------------|----------------|
| **SM-SPK** | Draft → Pending_Approval → Active → In_Progress → Pending_Verification → Completed/Cancelled | T3: approver ≠ creator (unless SA); T13: all steps Verified/Skipped |
| **SM-STEP** | Locked → Open → In_Progress → Submitted → Verified/Returned | Next step opens on Submit; verification parallel, never blocks |
| **SM-VEH** | Inactive > OFF > Blocked > Repair > Active (precedence) | OFF = Repair SPK overruns scheduled day (DEC-92) |
| **SM-DOC** | Missing → Valid → Warning → Expired → Valid (on renewal) | Daily job at 00:30 WIB |
| **SM-TYRE** | In_Stock → Issued → Mounted → (Needs_Retread/Worn_Out/Scrapped) → On_Retread → In_Stock | Every transition writes tyre_events |
| **SM-SCH** | Not_planned → Planned → Missed → Planned (rolled over, no limit) | Daily job moves card forward each day until Completed/Cancelled |

---

## 8. Release Plan (PRD §10)

| Stage | Scope | Key Tasks |
|-------|-------|-----------|
| **R1 Step 1** | Setup/Go live, auth, roles, vendors, audit, files, vehicles, chassis, documents, SPK core | TASK-101 to TASK-131 |
| **R1 Step 2** | Assignment engine, registry, SPK presets, SPK document | TASK-201 to TASK-212 |
| **R1 Step 3** | Stock step, Part Purchase, parts inventory | TASK-301 to TASK-313 |
| **R1 Step 4** | Mechanic Action, Part Check, Mobilisasi (web) | TASK-401 to TASK-406, TASK-708 |
| **R1 Step 5** | Tyres, Part Replacement + map, baseline, part age | TASK-501 to TASK-516 |
| **R1 Step 6** | Documents, PM, odometer, CR, schedule, dashboards, notifications, import | TASK-601 to TASK-616 |
| **R1 Step 7** | Invoices, mobile app (Driver, FC, Mechanic, SA), push | TASK-701 to TASK-713 |
| **Release 2** | iOS, Supervisor/GM mobile, reports, AI, Protrack | P1 items |

---

## 9. Always-On Skills (Every Implementation Task)

```
ecc:search-first            # Reuse before writing new code
ecc:coding-standards        # One style across monorepo
ecc:git-workflow            # Git discipline above
ecc:verification-loop       # Build, types, lint, tests, _Verify_ before [x]
ecc:architecture-decision-records  # Before any divergence
```

**Area-specific skills** are listed on each task's `_Skill_` line in tasks.md.

---

## 10. Where to Find Things (Quick Index)

| Need | Location |
|------|----------|
| Current task + blockers | `specs/CONTEXT.md` → Resume block |
| All requirements by area | `specs/requirements.md` |
| Architecture, file structure, skill map | `specs/design.md` |
| Task plan with REQ/AC/Verify | `specs/tasks.md` |
| PRD text for REQ-SPK-003 | `docs/prd/areas/4.1-spk.md` |
| PostgreSQL schema for `spks` | `docs/prd/data-model.md` §9.6 |
| Artboard for SPKDetail | `Design Artifact/spk/SPKDetail.html#SPKDetail` |
| Acceptance criteria for SPK | `specs/acceptance-tests.md` (search AC-SPK-*) |
| E2E spec for FLW-PLN-01 | `specs/tdd-user-journeys.md` |
| UI controls for SPKList | `docs/prd/ui-action-map.md` (search SPKList) |
| Decision DEC-96 | `PRD.md` §11.1 or `specs/decision-index.md` |
| Agent action log | `AGENT_LOG.md` |

---

## 11. Common Pitfalls to Avoid

| Pitfall | Correct Approach |
|---------|------------------|
| "Let me just start coding" | Read all `_Read_` files + PRD IDs first |
| "I'll simplify this requirement" | Build exactly as written; ask PO if ambiguous |
| "The artboard shows X but PRD doesn't" | Don't build it — ask (PRD §0.1 row 3) |
| "PRD says X but artboard shows Y" | Artboard wins for visual; PRD wins for behaviour (PRD §0.1) |
| "I'll decide permission from role name" | Use effective capability set + allowedActions |
| "I'll import the DB driver in my service" | Define a gateway interface in `ports/`, implement in `infra/db/` |
| "Mark task done without verify" | Run `_Verify_` + `check-coverage.mjs --tests` + artboard comparison |
| "Use 'Work Order' or 'WO' in code" | Use SPK everywhere (DEC-106) |

---

## 12. Session Start Checklist

```
☐ Read AGENT_GUIDE.md (this file)
☐ Read specs/CONTEXT.md — note active task, blockers, last session
☐ Read specs/requirements.md — refresh requirement index
☐ Read specs/design.md — refresh architecture
☐ Read specs/tasks.md — find next [ ] task
☐ Open the task's artboard(s) in Design Artifact/
☐ Read every _Read_ file + PRD IDs for that task
☐ Load all skills on _Skill_ line
☐ PLAN FIRST (superpowers:writing-plans) — create plan, human review, approval
☐ WRITE E2E TESTS FIRST (Playwright) — specs/tdd-user-journeys.md for every FLW
☐ Write unit/integration tests FIRST (RED) from 3 sources
☐ Implement (GREEN)
☐ Verify + artboard compare + evidence
☐ QA UI COMPARISON (Mandatory) — compare with Design Artifact side-by-side
☐ Update CONTEXT.md session log at end
☐ Append to AGENT_LOG.md
```

---

## 13. Escalation Protocol

| Situation | Action |
|-----------|--------|
| PRD unclear or contradicts itself | **Stop** → Document in CONTEXT.md Open Questions → Ask product owner |
| Artboard has control/field not in PRD | **Stop** → Ask product owner (don't build, don't ignore) |
| Implementation must diverge from design.md | **Stop** → Describe conflict → Wait for approval → Update spec FIRST |
| Q-03 (cloud accounts) blocks task | Mark task BLOCKED in CONTEXT.md, work on unblocked tasks |
| Two agents on same task | **Never** — one task, one agent (CLAUDE.md §TWO AGENTS) |

---

*Last updated: 2026-11-14 | Spec version: PRD v2.38 | This file is the single entry point — keep it current.*