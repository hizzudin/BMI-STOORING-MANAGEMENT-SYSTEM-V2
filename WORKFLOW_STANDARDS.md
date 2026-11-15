# Workflow Standards — BMI Stooring System v2

> **Enforced identically for every agent, every session.**
> This file codifies the "How an agent works a task" rules from specs/tasks.md §6.
> No exceptions. No variations. No "I'll just do it differently this time."

---

## 1. Session Start Protocol (Mandatory, Every Session)

```
☐ 1. Read AGENT_GUIDE.md completely
☐ 2. Read specs/CONTEXT.md — note: active task, blockers, last session summary, PRD version
☐ 3. Read specs/requirements.md — refresh requirement index for current phase
☐ 4. Read specs/design.md — refresh architecture, file structure, skill map
☐ 5. Read specs/tasks.md — find next [ ] task (never skip, never reorder)
☐ 6. Open the task's artboard(s) in Design Artifact/ (visual target)
☐ 7. Read EVERY file listed on the task's _Read_ line
☐ 8. Read FULL PRD text of EVERY ID on: checkbox line, _Acceptance_, _Rules_
☐ 9. Load ALL skills on the task's _Skill_ line + always-on skills
☐ 10. Write tests FIRST (RED) from three sources:
      a) Every AC on _Acceptance_ → specs/acceptance-tests.md
      b) Every FLW on _Journey_ → specs/tdd-user-journeys.md
      c) Every rule/transition on _Rules_
☐ 11. Implement (GREEN) → Refactor
☐ 12. Verify: run _Verify_ commands + `node specs/tools/check-coverage.mjs --tests` + artboard compare
☐ 13. Write specs/evidence/TASK-nnn.tdd.md
☐ 14. Update specs/tools/tasks.source.mjs → regenerate tasks.md → check-coverage.mjs
☐ 15. Update CONTEXT.md session log + Append to AGENT_LOG.md
```

**Do not write code until steps 1-9 are complete.**

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

## 3. TDD Enforcement (Three Test Sources — All Required)

| Source | File | Naming | Coverage |
|--------|------|--------|----------|
| **Acceptance Criteria** | `specs/acceptance-tests.md` | One+ test per AC ID (e.g., `AC-SPK-003`) | Every AC of task |
| **User Flows** | `specs/tdd-user-journeys.md` | One E2E spec per FLW ID (e.g., `FLW-PLN-01.spec.ts`) | Every FLW of task |
| **Rules & Transitions** | PRD §3, §5 | Unit/integration per transition (SM-SPK T1-T15, SM-STEP, BR-01..16) | Every rule/transition of task |

**Test Commands:**
- Unit: `pnpm --filter @bmi/shared test -t "SM-SPK|AC-SPK-003"`
- Integration: `pnpm --filter @bmi/api test:int -t "REQ-SPK-010"`
- E2E: `pnpm --filter @bmi/web e2e flows/FLW-PLN-01.spec.ts`

---

## 4. Verification Gate (Must Pass Before Marking Task `[x]`)

```
☐ Run EVERY _Verify_ command on the task line (exact commands listed)
☐ Run `node specs/tools/check-coverage.mjs --tests` → MUST print "Coverage OK"
☐ Compare EACH screen with its artboard side-by-side (ecc:browser-qa skill)
☐ Write specs/evidence/TASK-nnn.tdd.md with: test results, artboard comparison, any deviations
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
| Must add requirement not in PRD | **STOP** → Ask PO → If approved, update PRD first, then tasks.source.mjs, then implement |

**Never:**
- Reduce, merge, rename, simplify, or postpone any requirement/field/control/rule without PO approval
- Add anything not in PRD
- Update design.md AFTER implementation (must be BEFORE or concurrently)

---

## 6. Git Control Discipline (Every Task — Mandatory Sequence)

### 6.1 Task Start: Branch & Checkout
```
☐ Run `node specs/tools/next-numbers.mjs` — get next task number, DEC, PRD version, migration, CONTEXT row
☐ Create branch from `main`: `git checkout -b feat/phaseN-taskNNN-slug main`
☐ Verify branch: `git branch` shows * on new branch
☐ ONLY THEN begin implementation (Session Start Protocol steps 1-9)
```

### 6.2 Implementation: Commit & Push
```
☐ Implement task (TDD: RED → GREEN → Refactor)
☐ Run ALL verification gates (Verification Gate §4)
☐ Stage specific files: `git add <exact-files>` — NEVER `git add -A`
☐ Commit with Conventional Commits: `git commit -m "type(scope): message [TASK-NNN, REQ-XXX, AC-YYY]"`
☐ Push to origin: `git push origin feat/phaseN-taskNNN-slug`
```

### 6.3 User Confirmation Gate (Mandatory)
```
☐ Report to user: "Implementation complete. Verification passed. Artboard matched. Ready for your review."
☐ WAIT for explicit user confirmation: "Implementation is correct, proceed to PR"
☐ DO NOT create PR without user confirmation
```

### 6.4 PR Creation & Merge (User-Initiated)
```
☐ User says "create PR" → `gh pr create --base main --head <branch> --title "..." --body "..."`
☐ User reviews PR (or assigns reviewer)
☐ User says "merge PR" → `gh pr merge --squash --delete-branch` (or user merges via GitHub UI)
☐ After merge: `git checkout main && git pull origin main`
☐ Clean up local branch: `git branch -d feat/phaseN-taskNNN-slug`
```

### 6.5 Git Rules Summary

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

**Load ALL skills listed before writing code.** If ECC plugin not installed, skip `ecc:*` skills and note in report.

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
☐ If task complete: create PR, request review
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
*Last updated: 2026-11-14 | Based on specs/tasks.md §6 + CLAUDE.md + PRD §8.3*