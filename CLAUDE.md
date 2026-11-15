═══════════════════════════════════════════════════════════
SPEC DRIVEN DEVELOPMENT — PROJECT CONSTITUTION
Project: BMI Stooring System (fresh start, v2)
═══════════════════════════════════════════════════════════

This project starts from zero: no code exists yet. The product is fully
specified; the build plan is not. All work is governed by these sources,
in this precedence:

  PRD.md (root)          — SDD Spec v2 core: scope, roles and permissions
                           (§2, capability catalogue §2.4), state machines
                           (§3), business rules (§5), NFRs and stack (§8),
                           release plan (§10), decisions (§11), and the
                           index of docs/prd/. When anything disagrees,
                           PRD.md wins.
  docs/prd/              — the rest of the same spec, same § numbers and IDs:
                           areas/<n>-<code>.md (§4 per area + §8.1 upload),
                           data-model.md (§9), ui.md + ui-action-map.md (§7),
                           flows.md (§6), traceability.md (§12),
                           history.md (retired items; nothing in it is built).
  Design Artifact/       — the VISUAL TARGET of the end product (DEC-96):
                           one page per screen, dialog and panel (DEC-107),
                           web + mobile/, named after the screen in the
                           folder of its area. Start at index.html.
  DESIGN.md (root)       — the same design written down as tokens and rules.
                           Where it and an artboard differ, the artboard wins
                           and DESIGN.md is corrected.
  PRODUCT.md (root)      — product summary for context.

AGENT ONBOARDING FILES (read order for EVERY session):
  AGENT_GUIDE.md         — Single entry point: quick start, source-of-truth, how to work a task, git control discipline, conventions, permissions, state machines, release plan, skills, quick index, pitfalls, session checklist, escalation
  AGENT_LOG.md           — Append-only log of agent actions across sessions (handoff continuity)
  FILE_MAP.md            — Annotated directory structure: what each folder/file contains, why it exists
  WORKFLOW_STANDARDS.md  — Enforced workflow: session start, task claim, TDD, verification gate, divergence, git control discipline (branch→commit→push→user confirm→PR), skills, permissions, hexagonal arch, spec maintenance, session end, escalation
  specs/CONTEXT.md       — Session journal: resume block, session log, key decisions, open questions, divergences

ONE ENTITY, ONE NAME (PRD §0.7, DEC-106):
  The entity is SPK (Surat Perintah Kerja) everywhere: screens, documents,
  IDs (REQ-SPK-*, AC-SPK-*, SM-SPK), tables (spks, spk_*), permissions (spk.*),
  artboards and files (CreateSPK, spk/) and code (SpkGateway). The former name
  (Work Order, WO) is retired; it survives only in docs/prd/history.md. Never
  reintroduce it in spec, code, IDs or file names. If you read or hear it, it
  means SPK: there is no second entity and nothing to map.

Load only what a task needs (PRD §0.6): PRD.md + the task's area file +
the matching part of data-model.md + its artboard.

FIRST SESSION (nothing below exists yet):
  1. Read PRD.md in full, then skim docs/prd/ and Design Artifact/index.html.
  2. Load the `spec-driven-development` skill and write the build specs in
     specs/: requirements.md (an index of PRD IDs, never a restatement),
     design.md (architecture, File Structure, skill map), tasks.md (ordered
     plan by PRD §10 release steps, each task with _Skill_ and _Verify_
     lines) and CONTEXT.md (session journal).
  3. Ask the product owner before deciding anything the PRD leaves open
     (PRD §11.3; Q-03 cloud account ownership blocks the first deploy).
  4. Start code only after the specs are reviewed.

EVERY LATER SESSION, BEFORE ANY ACTION:
  0. Read AGENT_GUIDE.md — it is the single entry point (quick start, workflow, conventions, escalation)
  1. Read specs/CONTEXT.md — it has session state (resume block, blockers, last session)
  2. Read specs/requirements.md and specs/design.md
  3. Read specs/tasks.md — pick the next incomplete [ ] task
  4. Follow WORKFLOW_STANDARDS.md §1 (Session Start Protocol) and §2A (Plan-Driven Implementation)
     for the complete task workflow: session start → read files → plan → human review → implement → verify → commit → PR

ALWAYS-ON SKILLS (every implementation task):
  ecc:search-first            reuse before writing new code
  ecc:coding-standards        one style across the monorepo (+ typescript-pro)
  ecc:git-workflow            the git discipline below
  ecc:verification-loop       build, types, lint, tests, _Verify_ before [x]
  ecc:architecture-decision-records   before any divergence

SKILLS BY AREA (name them on each task's _Skill_ line):
  API (NestJS)     nestjs-expert, api-designer, fullstack-guardian,
                   ecc:nestjs-patterns, ecc:backend-patterns, ecc:api-design,
                   ecc:error-handling
  Data seam        ecc:hexagonal-architecture (business logic depends on a
                   gateway interface, never on a DB driver)
  PostgreSQL       postgres-pro, database-optimizer, ecc:postgres-patterns,
                   ecc:database-migrations, ecc:benchmark (NFR-19)
  Jobs             ecc:redis-patterns (idempotent daily job, NFR-12/14)
  Web (Next.js)    nextjs-developer, impeccable, frontend-design-direction,
                   ecc:frontend-patterns, ecc:react-patterns,
                   ecc:react-performance, ecc:design-system,
                   ecc:make-interfaces-feel-better, ecc:motion-foundations,
                   ecc:frontend-a11y
  Mobile (Expo)    react-native-expert, ecc:react-native-patterns,
                   ecc:accessibility
  Tests            test-master, ecc:tdd-workflow, ecc:react-testing,
                   ecc:e2e-testing, ecc:browser-qa (compare each built screen
                   with its artboard side by side)
  Security         security-reviewer, ecc:security-review,
                   ecc:production-audit
  Deploy           ecc:deployment-patterns, ecc:docker-patterns,
                   ecc:delivery-gate, ecc:canary-watch
  Docs             code-documenter, ecc:living-docs-governance

BEHAVIORAL GUIDELINES (Karpathy Guidelines — integrated from andrej-karpathy-skills:karpathy-guidelines):
  These guidelines bias toward caution over speed. For trivial tasks, use judgment.

  1. Think Before Coding — Don't assume. Don't hide confusion. Surface tradeoffs.
     Before implementing:
     - State your assumptions explicitly. If uncertain, ask.
     - If multiple interpretations exist, present them — don't pick silently.
     - If a simpler approach exists, say so. Push back when warranted.
     - If something is unclear, stop. Name what's confusing. Ask.

  2. Simplicity First — Minimum code that solves the problem. Nothing speculative.
     - No features beyond what was asked.
     - No abstractions for single-use code.
     - No "flexibility" or "configurability" that wasn't requested.
     - No error handling for impossible scenarios.
     - If you write 200 lines and it could be 50, rewrite it.
     - Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

  3. Surgical Changes — Touch only what you must. Clean up only your own mess.
     When editing existing code:
     - Don't "improve" adjacent code, comments, or formatting.
     - Don't refactor things that aren't broken.
     - Match existing style, even if you'd do it differently.
     - If you notice unrelated dead code, mention it — don't delete it.
     When your changes create orphans:
     - Remove imports/variables/functions that YOUR changes made unused.
     - Don't remove pre-existing dead code unless asked.
     The test: Every changed line should trace directly to the user's request.

  4. Goal-Driven Execution — Define success criteria. Loop until verified.
     Transform tasks into verifiable goals:
     - "Add validation" → "Write tests for invalid inputs, then make them pass"
     - "Fix the bug" → "Write a test that reproduces it, then make it pass"
     - "Refactor X" → "Ensure tests pass before and after"
     For multi-step tasks, state a brief plan with verification checkpoints.
     Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

HARD CONSTRAINTS:
  ✗ Never implement requirements not traceable to PRD.md / docs/prd/
  ✗ Never alter the data model (§9) or a state machine (§3) without
    updating the PRD and specs/design.md first and noting it in CONTEXT.md
  ✗ Never let business logic import a concrete DB driver
  ✗ Never decide a permission, menu item or button from the role name:
    use the effective capability set and allowedActions (PRD §2.4, DEC-93)
  ✗ Never build a control, field or rule seen only in an artboard — ask;
    never import artboard HTML/CSS or its sample data (re-create the look;
    a staging-only seed may re-type the canvas values, docs/adr/0001)
  ✗ Never mark a task [x] without running its _Verify_ step
  ✗ Never guess when a requirement is ambiguous — consult the PRD; if
    still unresolved, ask
  ✗ Never commit secrets, .env, or cloud keys

GIT CONTROL DISCIPLINE (every task — Mandatory Sequence):

See **WORKFLOW_STANDARDS.md §6** for the complete mandatory sequence.

**Summary:**
1. **Branch from main** — `git checkout -b feat/phaseN-taskNNN-slug main`
2. **Run `next-numbers.mjs`** — get task number, DEC, PRD version, migration, CONTEXT row
3. **Plan-Driven Implementation** — see WORKFLOW_STANDARDS.md §2A (branch → plan → human review → implement)
4. **Implement** — TDD (RED → GREEN → Refactor), all verification gates
5. **Commit & Push** — specific files, Conventional Commits with TASK+REQ IDs
6. **User Confirmation Gate** — mandatory before PR
7. **PR Creation & Merge** — user-initiated, squash merge, cleanup

**Rules:**
  - Branch naming: `feat/phase1-task125-spk-list-detail`
  - Conventional Commits with TASK + REQ IDs: `feat(spk): list tabs + detail [TASK-125, REQ-SPK-010, REQ-SPK-011]`
  - Stage specific files only (never `git add -A`)
  - Never force-push, reset --hard, or skip hooks
  - Branch from main only
  - User confirms before PR (mandatory gate)
  - Full details: WORKFLOW_STANDARDS.md §6

TWO AGENTS (Claude Code and Kiro; .kiro/steering/ holds Kiro's copy of these rules):
  1. One task, one agent: the agent that claims a task does all of it, from
     the owner's questions to the merge request; the other never touches it.
  2. Claim by creating the task branch from main before anything else. Run
     `node specs/tools/next-numbers.mjs` first: it lists claimed tasks and the
     next free DEC, PRD version, migration number and CONTEXT row across all
     branches. Take every such number from it when you write it, and renumber
     yours before a merge if the other agent's branch was merged first.
  3. Each agent works in its own folder (git worktree); never switch branches
     in the other agent's folder. Do not run e2e, dev servers or the full
     coverage run while the other agent does (one database, ports, ~1 GB free).
  4. A task delegated to Kiro gets a thin spec in .kiro/specs/task-nnn-slug/
     that points at the PRD IDs and specs/, never copies them.

AFTER COMPLETING A TASK:
  1. Run its _Verify_ step; for a screen, compare it with its artboard
  2. If the implementation diverged from specs/design.md, update it FIRST
  3. Mark the task [x], add a session row + next task to CONTEXT.md
  4. Append entry to AGENT_LOG.md (date, agent/session, task, action, files, outcome, notes)
  5. Report what was done and which REQ/NFR/AC it satisfies
  6. Follow WORKFLOW_STANDARDS.md §6.3–§6.4: user confirmation → create PR → merge

DIVERGENCE PROTOCOL:
  If work must deviate from the PRD, the artboards or specs/design.md:
    → Stop · describe the conflict · wait for approval · update the spec
      (and the artboard) BEFORE writing code.
═══════════════════════════════════════════════════════════
