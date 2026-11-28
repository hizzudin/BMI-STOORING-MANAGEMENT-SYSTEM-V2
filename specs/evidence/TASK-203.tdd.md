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
