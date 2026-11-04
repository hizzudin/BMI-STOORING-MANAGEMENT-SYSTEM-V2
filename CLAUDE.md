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
                           61 module artboards, web + mobile/, one screen per
                           module for every role. Start at index.html.
  DESIGN.md (root)       — the same design written down as tokens and rules.
                           Where it and an artboard differ, the artboard wins
                           and DESIGN.md is corrected.
  PRODUCT.md (root)      — product summary for context.

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
  0. Read specs/CONTEXT.md — it has session state
  1. Read specs/requirements.md and specs/design.md
  2. Read specs/tasks.md — pick the next incomplete [ ] task, and follow its
     "How an agent works a task" rules. Open EVERY file on the task's _Read_
     line and read the full PRD text of every ID it names; the task line is
     a pointer, never the requirement. Build all of it: no feature, field,
     control or rule may be reduced, merged or postponed without the
     product owner's approval and a PRD update first.
     tasks.md and decision-index.md are generated: edit
     specs/tools/tasks.source.mjs, run `node specs/tools/build-tasks.mjs`,
     then `node specs/tools/check-coverage.mjs` (must print Coverage OK).
     Tests come from three sources, all required: every acceptance
     criterion of the task (specs/acceptance-tests.md, one test per AC
     named by its ID), every user flow (specs/tdd-user-journeys.md, one
     E2E spec per FLW) and every rule or transition (BR, SM, TX, NFR).
     Before closing a task run check-coverage.mjs --tests.
  3. Load every skill on that task's _Skill_ line: bare names from
     .claude/skills/, `ecc:` names with the Skill tool (ECC plugin; if it
     is not installed, skip them and say so in the report)
  4. For a screen task, open its artboard in Design Artifact/

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

GIT DISCIPLINE (every task):
  1. Branch: type/phaseN-taskNNN-slug  (feat/fix/chore/test/perf/ci/docs/build)
  2. Conventional Commits referencing the TASK + REQ IDs,
     e.g.  feat(spk): lifecycle + assignment engine [TASK-108]
  3. Stage specific files (never `git add -A`); keep PRs small
  4. Never force-push, reset --hard, or skip hooks unless explicitly asked

AFTER COMPLETING A TASK:
  1. Run its _Verify_ step; for a screen, compare it with its artboard
  2. If the implementation diverged from specs/design.md, update it FIRST
  3. Mark the task [x], add a session row + next task to CONTEXT.md
  4. Report what was done and which REQ/NFR/AC it satisfies

DIVERGENCE PROTOCOL:
  If work must deviate from the PRD, the artboards or specs/design.md:
    → Stop · describe the conflict · wait for approval · update the spec
      (and the artboard) BEFORE writing code.
═══════════════════════════════════════════════════════════
