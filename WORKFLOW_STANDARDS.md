# Workflow Standards — BMI Stooring System v2

> **Enforced identically for every agent, every session.**
> This file codifies the "How an agent works a task" rules from specs/tasks.md §6.
> No exceptions. No variations. No "I'll just do it differently this time."

---

## 1. Session Start Protocol (Mandatory, Every Session)

```
☐ 1. Read AGENT_GUIDE.md completely
☐ 2. Read specs/CONTEXT.md — active task, blockers, last session, PRD version
☐ 3. Read specs/requirements.md — refresh requirement index for current phase
☐ 4. Read specs/design.md — refresh architecture, file structure, skill map
☐ 5. Read specs/tasks.md — find next [ ] task (never skip, never reorder)
☐ 6. Open the task's artboard(s) in Design Artifact/ (visual target)
☐ 7. Read EVERY file listed on the task's _Read_ line
☐ 8. Read FULL PRD text of EVERY ID on: checkbox line, _Acceptance_, _Rules_
☐ 9. Load the always-on skills + the area skills for each part of the code the task touches (§7)
☐ 10. ASK THE PRODUCT OWNER what the spec leaves open — one message, in Indonesian, two or three
      options each, recommendation first. Each answer becomes a DEC (number from next-numbers.mjs),
      written into PRD.md, docs/prd/history.md, design.md and tasks.source.mjs, then committed as
      `docs(spec): ... [TASK-nnn]` BEFORE any code
☐ 11. PLAN FIRST — see §2A below; wait for the owner's approval
☐ 12. WRITE E2E TESTS FIRST (Playwright) — specs/tdd-user-journeys.md for every FLW of the task
      (exception for a branch whose code already exists: §2B)
☐ 13. Write unit/integration tests FIRST (RED) from three sources:
      a) Every AC on _Acceptance_ → specs/acceptance-tests.md
      b) Every FLW on _Journey_ → specs/tdd-user-journeys.md
      c) Every rule/transition on _Rules_
☐ 14. Implement (GREEN) → Refactor
☐ 15. Verify: run _Verify_ commands + `node specs/tools/check-coverage.mjs --tests` + artboard compare
☐ 16. Write specs/evidence/TASK-nnn.tdd.md
☐ 17. Update specs/tools/tasks.source.mjs → regenerate tasks.md → check-coverage.mjs
☐ 18. Update CONTEXT.md session log + Append to AGENT_LOG.md
☐ 19. QA UI COMPARISON (Mandatory) — compare EVERY screen with Design Artifact side-by-side (ecc:browser-qa) as FINAL step before marking task done
☐ 20. WORKFLOW AUDIT before asking for the PR — go through this checklist, and tell the owner
      plainly every step that was skipped or done differently; record it in AGENT_LOG.md
```

**Do not write code until steps 1-13 are complete.**

---

## 2. Task Claim Protocol (Two-Agent Rule)

| Rule | Enforcement |
|------|-------------|
| **One task, one agent** | The agent that claims a task does ALL of it — from PO questions to merge |
| **Claim by branching** | Create task branch from `main` BEFORE any work: `git checkout -b feat/phaseN-taskNNN-slug main` |
| **Run next-numbers.mjs first** | `node specs/tools/next-numbers.mjs` — lists claimed tasks + next free DEC, PRD version, migration, CONTEXT row |
| **Take every number from it** | Use the numbers it gives you; renumber before merge if other agent's branch merged first |
| **Own folder (worktree)** | Each agent works in its own git worktree; never switch branches in other agent's folder |
| **No parallel e2e/dev servers** | One database, ports, ~1 GB free — coordinate with other agent |

**If Kiro gets a task:** Create thin spec in `.kiro/specs/task-nnn-slug/` pointing at PRD IDs + specs/, never copying them.

---

## 2A. Plan-Driven Implementation

**Every task MUST have an implementation plan before any code is written.**

```
☐ 1. Load the writing-plans skill (.claude/skills/writing-plans; Kiro: .kiro/skills/writing-plans)
     and write the plan in its format
☐ 2. Create plan with: Goal, Architecture, File Structure, Task Decomposition, Interfaces, Tests, Review Focus
☐ 3. Plan MUST define: clear goal, success criteria (goal-driven execution), exact interfaces, test assertions
☐ 4. Save to `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` and commit it with the task
☐ 5. Present plan for human review in Indonesian: confirm goal captured (execution method only if
     subagents are proposed)
☐ 6. ONLY after plan approval → proceed to implementation
```

**Plan Quality Checklist (self-review before presenting):**
- [ ] Spec coverage: Every requirement in spec has a task implementing it
- [ ] Step scan: Every step lets implementer write exactly one reasonable thing
- [ ] Type consistency: Types, signatures, property names match across tasks
- [ ] Review Focus: Five uncovered input classes/failure modes listed with test ownership
- [ ] Proportion: Plan is concise, not a transcript (replace bodies with signatures)

---

## 2B. Fixing a Branch Whose Code Already Exists

When a task branch was started by another session or agent and does not meet the spec:

```
☐ 1. Read the branch: build, typecheck, check:layers, tests; list what is wrong against the PRD,
     design.md and the artboards
☐ 2. Ask the owner: fix the branch in place, or start again from main
☐ 3. Ask the open spec questions (§1 step 10) and write the DEC before code
☐ 4. Plan the fix (§2A), named `YYYY-MM-DD-taskNNN-fix.md`, and wait for approval
☐ 5. Write the failing tests for each part before fixing it (RED → GREEN). The E2E specs may be
     written or rewritten together with the fix instead of before it; say so in the evidence
☐ 6. Evidence: a "What was wrong on the branch and is fixed" section; AGENT_LOG: say that the
     earlier entry described an unfinished branch
```

---

## 3. TDD Enforcement (Three Test Sources — All Required)

| Source | File | Naming | Coverage |
|--------|------|--------|----------|
| **Acceptance Criteria** | `specs/acceptance-tests.md` | One+ test per AC ID (e.g., `AC-SPK-003`) | Every AC of task |
| **User Flows** | `specs/tdd-user-journeys.md` | One E2E spec per FLW ID (e.g., `FLW-PLN-01.spec.ts`) | Every FLW of task |
| **Rules & Transitions** | PRD §3, §5 | Unit/integration per transition (SM-SPK T1-T15, SM-STEP, BR-01..16) | Every rule/transition of task |

**Test Commands:**
- Unit: `pnpm --filter @bmi/shared test -t "SM-SPK|AC-SPK-003"`
- Integration: `pnpm --filter @bmi/api test:int -t "REQ-SPK-010"`
- E2E, full run: `TEST_DATABASE_URL=postgres://bmi:bmi_local_dev@localhost:5432/bmi_dev pnpm e2e`
- E2E, one spec: `pnpm --filter @bmi/web build`, then in `apps/web`: `npx playwright test e2e/<name>.spec.ts`
  (same `TEST_DATABASE_URL`)
- After an API contract change: `pnpm gen:client && pnpm --filter @bmi/api-client build`

**Mocked web tests never replace the E2E run.** A web test with a mocked API cannot see a request
that the real API reads differently (TASK-125: the list query); run the E2E before marking `[x]`.

---

## 4. Verification Gate (Must Pass Before Marking Task `[x]`)

```
☐ Run EVERY _Verify_ command on the task line (exact commands listed)
☐ Run `node specs/tools/check-coverage.mjs --tests` → MUST print "Coverage OK"
☐ Compare EACH screen with its artboard side-by-side (ecc:browser-qa skill), at 1440 x 900, with
  data typed for the QA (local accounts from .data/local-accounts.md, or the e2e database);
  never paste credentials in chat, specs, commits or tests
☐ Write specs/evidence/TASK-nnn.tdd.md with: test results (counts per suite, and a checklist per
  test when the owner asks), artboard comparison, any deviations
☐ A test that fails for a reason outside the task (local environment) is listed separately with
  its cause; it never counts as passed, and the task's own tests must all pass
☐ Update specs/tools/tasks.source.mjs (mark task done, add any new tasks discovered)
☐ Run `node specs/tools/build-tasks.mjs` → regenerates tasks.md
☐ Run `node specs/tools/check-coverage.mjs` → MUST print "Coverage OK"
```

**If any check fails → task is NOT done. Fix and re-verify.**

---

## 5. Divergence Protocol (Zero Tolerance for Silent Drift)

| Situation | Required Action |
|-----------|-----------------|
| Implementation differs from design.md | **STOP** → Describe conflict in CONTEXT.md Divergences → Wait for PO approval → Update design.md FIRST → Then continue |
| PRD unclear or contradicts itself | **STOP** → Document in CONTEXT.md Open Questions → Ask PO → Wait for answer |
| Artboard has control/field not in PRD | **STOP** → Ask PO (don't build, don't ignore) — PRD §0.1 row 3 |
| Built screen kept different from its artboard on purpose | Ask PO before the PR → record the answer in CONTEXT.md Divergences, design.md and the evidence |
| Must add requirement not in PRD | **STOP** → Ask PO → If approved, update PRD first, then tasks.source.mjs, then implement |

**Never:**
- Reduce, merge, rename, simplify, or postpone any requirement/field/control/rule without PO approval
- Add anything not in PRD
- Update design.md AFTER implementation (must be BEFORE or concurrently)

---

## 6. Git Control Discipline (Every Task — Mandatory Sequence)

### 6.1 Task Start: Branch & Checkout
```
☐ Run `node specs/tools/next-numbers.mjs` — get task number, DEC, PRD version, migration, CONTEXT row
☐ Create branch from `main`: `git checkout -b feat/phaseN-taskNNN-slug main`
☐ Verify branch: `git branch` shows * on new branch
```

### 6.2 Plan-Driven Implementation (§2A)
```
☐ Create implementation plan per §2A
☐ Human review: confirm goal captured, select execution method (Native/Subagent)
☐ ONLY after plan approval → proceed to implementation
```

### 6.3 Implementation: Commit & Push
```
☐ Implement task (TDD: RED → GREEN → Refactor)
☐ Run ALL verification gates (Verification Gate §4)
☐ Stage specific files: `git add <exact-files>` — NEVER `git add -A`
☐ Commit with Conventional Commits: `git commit -m "type(scope): message [TASK-NNN, REQ-XXX, AC-YYY]"`
☐ Push to origin: `git push origin feat/phaseN-taskNNN-slug`
```

### 6.4 User Confirmation Gate (Mandatory)
```
☐ Report to user: "Implementation complete. Verification passed. Artboard matched. Ready for your review."
☐ WAIT for explicit user confirmation: "Implementation is correct, proceed to PR"
☐ DO NOT create PR without user confirmation
```

### 6.5 PR Creation & Merge (User-Initiated)
```
☐ User says "create PR" → `gh pr create --base main --head <branch> --title "..." --body "..."`
☐ User reviews PR (or assigns reviewer)
☐ User says "merge PR" → `gh pr merge --squash --delete-branch` (or user merges via GitHub UI)
☐ After merge: `git checkout main && git pull origin main`
☐ Clean up local branch: `git branch -d feat/phaseN-taskNNN-slug`
```

### 6.6 Git Rules Summary

| Rule | Example |
|------|---------|
| **Branch naming** | `feat/phase1-task125-spk-list-detail` |
| **Conventional Commits** | `feat(spk): list tabs + detail with step cards [TASK-125, REQ-SPK-010, REQ-SPK-011]` |
| **Reference TASK + REQ IDs** | Every commit message includes `[TASK-NNN, REQ-XXX, AC-YYY]` |
| **Stage specific files** | `git add apps/web/components/spk/SpkList.tsx apps/web/components/spk/SpkDetail.tsx` |
| **Never `git add -A`** | Explicit files only |
| **Never force-push** | `git push origin feat/phase1-task125-spk-list-detail` (no `--force`) |
| **Never `reset --hard`** | Use `git revert` or new commits |
| **Never skip hooks** | Pre-commit, commit-msg, pre-push all run |
| **Branch from main only** | `git checkout -b <branch> main` |
| **User confirms before PR** | Mandatory gate — no auto-PR |

---

## 7. Skill Loading Order (Deterministic)

```
1. ALWAYS-ON (every task):
   ecc:search-first
   ecc:coding-standards
   ecc:git-workflow
   ecc:verification-loop
   ecc:architecture-decision-records

2. AREA-SPECIFIC (from task's _Skill_ line):
   - API: nestjs-expert, api-designer, fullstack-guardian, ecc:nestjs-patterns, ecc:backend-patterns, ecc:api-design, ecc:error-handling
   - Data: postgres-pro, database-optimizer, ecc:postgres-patterns, ecc:database-migrations, ecc:benchmark
   - Jobs: ecc:redis-patterns
   - Web: nextjs-developer, impeccable, frontend-design-direction, ecc:frontend-patterns, ecc:react-patterns, ecc:react-performance, ecc:design-system, ecc:make-interfaces-feel-better, ecc:motion-foundations, ecc:frontend-a11y
   - Mobile: react-native-expert, ecc:react-native-patterns, ecc:accessibility
   - Tests: test-master, ecc:tdd-workflow, ecc:react-testing, ecc:e2e-testing, ecc:browser-qa
   - Security: security-reviewer, ecc:security-review, ecc:production-audit
   - Deploy: ecc:deployment-patterns, ecc:docker-patterns, ecc:delivery-gate, ecc:canary-watch
   - Docs: code-documenter, ecc:living-docs-governance

3. Hexagonal Architecture (data seam tasks): ecc:hexagonal-architecture
```

**Load the always-on skills, plus the area skills of each part of the code the task touches**
(an API change loads the API group, a gateway or port change the hexagonal skill, a screen the Web
group), before writing that part. A group the task does not touch is not loaded, even if it is on
the _Skill_ line. Write in the evidence which skills were loaded. If a skill or the ECC plugin is
not installed, skip it and say so in the report.

---

## 8. Permission Model Enforcement (Three Layers — DEC-93)

| Layer | Implementation | Never Do This |
|-------|----------------|---------------|
| **L1 Capability** | `@RequireCapability('spk.create')` decorator on endpoint | Check `user.role === 'Planner'` |
| **L2 Record Rule** | Policy function `canUserActOnRecord(user, record, action)` | Check role in service |
| **L3 Interface** | `GET /me` returns `capabilities[]`; record response includes `allowedActions[]` | Show/hide buttons based on role name |

**Menu items** → from capability catalogue (PRD §2.4 menu table)
**Buttons** → from record's `allowedActions` (computed by L1+L2)

---

## 9. Hexagonal Architecture (Non-Negotiable)

```
Domain (core/)          Ports (ports/)           Adapters (infra/)
─────────────────       ─────────────            ────────────────
SpkService           →  SpkGateway (interface)  →  SpkGatewayPg (Drizzle)
VehicleService       →  VehicleGateway          →  VehicleGatewayPg
NotificationService  →  NotificationGateway     →  NotificationGatewayPg
IamService           →  IamGateway              →  IamGatewayPg
```

**Rules:**
- Domain code (`core/**`) imports ONLY from `ports/` and `packages/shared`
- Domain code NEVER imports from `infra/`, `http/`, `@nestjs/*`, `drizzle-orm`, `pg`
- Adapters (`infra/db/*gateway.ts`) implement port interfaces
- DI tokens in `app.tokens.ts` wire ports to adapters
- CI enforces: `dependency-cruiser` forbids `core/**` → `infra/**` imports

---

## 10. Spec File Maintenance (Generated vs Source)

| File | Type | How to Modify |
|------|------|---------------|
| `specs/tasks.md` | **[GEN]** | Edit `specs/tools/tasks.source.mjs` → `node specs/tools/build-tasks.mjs` |
| `specs/requirements.md` | **[GEN]** | Update PRD → regenerated |
| `specs/design.md` | **[GEN]** | Update PRD + decisions → regenerated |
| `specs/decision-index.md` | **[GEN]** | Update PRD §11 → regenerated |
| `packages/api-client/*` | **[GEN]** | Change API → `pnpm gen:client` |
| `docs/prd/areas/*.md` | **[SRC]** | Edit directly (part of PRD) |
| `docs/prd/data-model.md` | **[SRC]** | Edit directly (part of PRD) |
| `Design Artifact/**/*.html` | **[SRC]** | Edit directly (visual target) |

**Never edit generated files directly.** They will be overwritten.

---

## 11. Session End Protocol (Every Session)

```
☐ Update CONTEXT.md:
   - Resume block: active task, phase, blockers, spec version
   - Session log: add row (date, summary, files changed)
   - Move resolved open questions to design.md
   - Record any divergences from design.md pending update
☐ Append to AGENT_LOG.md:
   - Date, Agent/Session, Task, Action, Files Changed, Outcome, Notes
☐ Commit all changes (if any) with proper message
☐ Push branch to origin
☐ If task complete: run the workflow audit (§1 step 20), then ask the owner whether to create the
  PR (§6.4); create it only on their yes
☐ Leave untracked files you did not create alone: do not commit or delete them
```

---

## 12. Escalation Matrix (When to Stop and Ask)

| Trigger | Escalate To | Via |
|---------|-------------|-----|
| PRD ambiguity | Product Owner | CONTEXT.md Open Questions + direct ask |
| Artboard vs PRD conflict | Product Owner | CONTEXT.md Divergences + direct ask |
| Design.md update needed | Product Owner | CONTEXT.md Divergences + direct ask |
| Q-03 blocks deploy task | Product Owner | Mark BLOCKED in CONTEXT.md + AGENT_LOG.md |
| Two agents same task | Other agent / PO | STOP immediately — one task, one agent |
| Security concern | Security reviewer | Run `ecc:security-review` skill |
| Performance concern | Benchmark skill | Run `ecc:benchmark` skill |

---

## 13. Quick Reference: Task Status Meanings

| Status | Meaning |
|--------|---------|
| `[ ]` | Not started — next up if dependencies met |
| `[~]` | In progress — claimed by an agent, branch exists |
| `[x]` | Done — verified, coverage OK, artboard matched, evidence written |
| `[BLOCKED]` | Waiting on external dependency (Q-03, PO decision, other agent) |
| `[SKIP]` | Explicitly deferred with PO approval (recorded in CONTEXT.md) |

---

*This workflow is the contract. Every agent, every session, every task — identical.*
*Last updated: 2026-11-16 (owner questions and DEC before code, §2B, skills per part touched, workflow audit, from TASK-125) | Based on specs/tasks.md §6 + CLAUDE.md + PRD §8.3*