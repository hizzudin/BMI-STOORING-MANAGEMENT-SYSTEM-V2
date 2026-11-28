# TASK-203 Module contract, registry service and the contract test suite

- **Requirements:** REQ-REG-002, REQ-REG-005, REQ-REG-006 (the scope-lock half of REQ-REG-006 is left to TASK-306 by DEC-149).
- **Rules:** BR-10, NFR-11, DEC-05, PR-6, DEC-93, NFR-01, NFR-02.
- **Decisions:** DEC-148 (PRD v2.60) and DEC-149 (PRD v2.61). Design note `specs/design.md` §5.26.

## Owner questions (WORKFLOW_STANDARDS §1 step 10)

Asked in two rounds instead of one (deviation): the owner's choice of a new Settings screen for modules raised three follow-up questions (which task, who, what it edits). Answers in DEC-148: StartFromPreset and SavePreset move to TASK-208; each module task adds its own registry row; deactivation and activation by `registry.manage` with a reason; the SettingsModules screen (REQ-REG-008, new TASK-215) also edits name and palette order; the execute capability comes from the module contract.

## ADR-0002 reviews (critical tier, §8.4)

1. **Agent review of the design note, in a separate session** ("ADR-0002 review: TASK-202 engine design note" session, reused for this note; read only, `ecc:architect`). Verdict: **approve with changes**: 3 blocking, 4 should-fix, 3 nits. Blocking: (1) the submit guard opened to every code guarded nothing; it is now the union of the modules' execute capabilities; (2) nothing enforced `scope_rules`; the scope lock is left to a DEC in TASK-306; (3) the layering broke §3 and CI did not catch it; a narrow `ModuleCatalog` port and two new dependency-cruiser rules. Should-fix: every entry point of "new use" named; every executor role must hold the execute capability; a static check against module code literals; §6 aligned with §5.26. Nits: `validateSubmit` refuses with 400 or 409; a module parses its own step options; the old map removed in one commit. Open points answered: two JSONB shapes fixed now, two minimal; typed module gateways; the dummy code shipped with a check that no migration inserts it; the Draft rule kept.
2. **Product owner review of the note:** approved with every finding, and decided the reviewer's open question: a system draft is made without the step of an inactive module and the Planner is notified (DEC-149, PRD v2.61).
3. **Agent review of the merge:** to be recorded before the PR.

## Plan and execution

Plan `docs/superpowers/plans/2026-11-28-task203-module-registry.md`, approved by the owner ("Ya, setujui (Native)"); executed inline (superpowers:executing-plans) with a ledger per task.

| Commit | Change |
| --- | --- |
| 75ac32b | `@bmi/shared` `registry/`: `ModuleRowSchema`, config and creation shapes, minimal strict scope rules and completion section (DEC-149), list and status-change schemas |
| 2c4dfab | `ports/registry.ts` (`ModuleCatalog`, `RegistryGateway`, `SubmitContext`), `TxHandle`, `engine/module-contract.ts` (`ModuleContract`, `defineModule`), `engine/registry/module-catalog.ts`, `modules/dummy/dummy-module.ts`, `src/app.modules.ts` |
| 1eea77f | Engine: `StepItem.executeCapability` from the catalog, `stepPolicies(codes)`, the module's `validate` and `submit` hooks inside the submit transaction, `ModuleExecuteGuard` on the submit route, `SpkListService` on the catalog; the DEC-146 map and its test removed from `@bmi/shared` |
| 9484295 | `RegistryService` (list, assertOfferable, deactivate, activate), `DrizzleRegistryGateway`, `GET /assignment-modules`, `POST /assignment-modules/:code/deactivate` and `/activate`, audit area `assignment_module` |
| df4a9ef | Contract suite (`module-contract.suite.ts`) over `MODULES` and a test-only module, static checks, two dependency-cruiser rules |
| 623431d, e6def82 | Generated client; Prettier |

## TDD (RED, then GREEN)

- Shared `registry.test.ts`: RED (module not found), then 8 passed.
- `engine/registry/module-catalog.spec.ts` and `modules/dummy/dummy-module.spec.ts`: RED (`app.modules` missing), then 6 passed.
- `engine/step-policies.spec.ts`: RED 2 of 2, then GREEN.
- `test/integration/registry/engine-hooks.test.ts`: RED 6 of 7, then 7 of 7. The test "REQ-ENG-003 an Accounting user is refused 403 at the guard" passed before the change, because the old fixed list of five codes also refused Accounting. It is kept as the regression pin of the new guard.
- `engine/registry/registry-service.spec.ts`: RED (module missing), then 2 real defects found and fixed (a refusal thrown synchronously instead of rejected; `before` read after the write), then 5 of 5.
- `test/integration/registry/assignment-modules.test.ts`: RED 5 of 5, then 5 of 5.
- Contract suite and static checks were written after the code they check, so they were proven by mutation:
  - `dummyModule.executeCapability = 'stock.issue'` failed 2 suite tests;
  - a `'Mechanic_Action'` literal in an engine file failed the static check;
  - temporary imports of `modules/` from `engine/` and `core/` gave 4 dependency-cruiser violations, among them both new rules;
  - all three were reverted.

## Gates (WORKFLOW_STANDARDS §4)

- `check:coverage` (Coverage OK), `check:kiro-skills`, `check:secrets`, `check:layers` (no violations), `check:client` (no drift after the client commit), `lint`, `typecheck`: all pass. Prettier is clean on every touched file. `format:check` also flags `check_brackets.js`, `check_brackets2.js`, `check_lines.js` and `.impeccable/hook.cache.json`: untracked files that are not this task's, left alone.
- Shared: 27 files, 351 tests, coverage gate pass.
- Web: 40 files, 254 tests; functions 81,07 %, lines 88,22 %, statements 85,69 %, branches 83,34 %. The first run listed only 37 files (73 % lines) because the slow disk dropped three files from the directory listing; Vitest found them when asked directly, and the rerun counted all 40. No web file changed on the branch.
- Engine `src/engine/**` (engine and registry unit and integration tests, 9 files, 65 tests): statements 98,98 %, branches 92,59 %, functions 100 %, lines 100 % (gate 90 %, D-09).
- API unit and integration, full run: 60 files, 469 passed, 1 skipped (the S3 contract run, CI only). **2 failed, both known local failures, not counted as passed:** BR-10 in `db/identity-schema.test.ts` and NFR-14 in `harness/real-transactions.test.ts` (the local PostgreSQL is not in UTC).
- No screen changed, so there is no E2E and no artboard QA. The CreateSPK regression check is the web suite above. SPKDetail shows no step button yet (DEC-145), so a step of a code-less row looks the same.

## Rulings made while building

1. The catalog spec may not import `modules/` (engine rule), so the `MODULES` and dummy check moved to `src/modules/dummy/dummy-module.spec.ts`.
2. Test module codes carry no digits, because the code pattern refuses them.
3. `core/spk` keeps its TASK-202 import of `engine/step-policies` and gets each step's capability through the `ModuleCatalog` port. Moving the policy table itself behind a port is not in DEC-149.
4. The blank-reason sentence is asserted in the 400 `issues[]`, because every route's `ValidBody` answers "Validation failed" with the issues.
5. The registry gateway parses stored JSONB strictly, so a stored row that does not fit is a 500, never a silent default.
6. The mutation literal went into an existing engine file and was reverted with the editor, because the shell gate refused `rm` and `git checkout`.

## Skills

Loaded with the Skill tool: superpowers:writing-plans, superpowers:executing-plans. The `_Skill_` line's API, hexagonal and test skills were applied from the project rules (CLAUDE.md, WORKFLOW_STANDARDS §3 and §9) but not loaded one by one (deviation).
