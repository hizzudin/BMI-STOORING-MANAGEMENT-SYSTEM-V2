# TASK-106 allowedActions framework and its contract test; menu table from capabilities

Requirement: REQ-IAM-014. Rules: BR-02, BR-03, NAV-9, REQ-IAM-013, DEC-93.

## What changed

- API: `core/iam/actions.ts`. A record type declares one `Policies` table: per action the capability codes (L1) and the record rules (L2), each rule answering null or the one sentence that refuses. `allowedActions()` builds the list for a response and `assertAllowed()` checks an action when it is sent; both go through `refusalOf()`, so the list cannot differ from what the server accepts. Shared rules: `inState`, `onlyOwner`, `notOwnWork` (BR-03, with `isSelfDecision` for the System Admin mark), `withinScope` (BR-02). `ActionRefusedFilter` answers 403 with the sentence; `actorOf(session)` gives the policies their actor.
- Test harness: `findContractBreaks` is the contract every record type runs: each listed action is accepted, each other action answers 403.
- Web: `SignedInShell` in the `app/(app)` route group loads `GET /me` on every page load (one refresh on 401), builds the rail from `menuFor(capabilities, systemMode)`, marks the open item, shows a not-allowed page for the path of a hidden item, keeps the rail choice per user and signs out. The home page and Settings moved into the group; `/` without a session goes to sign in.
- E2E: the e2e database starts Live; the sign-in spec checks the Planner's menu.

## How the spec was read

- No record type exists yet, so the contract runs on a test-only record shaped like an SPK (Draft, Pending_Approval, Approved; creator; vehicle). Each real record type adds its own policy table and runs the same helper in its task.
- BR-02 needs the payload of the action, which is unknown while the list is built: the scope rule passes while listing and is checked when the action is sent. The contract therefore sends in-scope payloads, and a separate test sends an out-of-scope one.
- BR-03 names the System Admin as its one exception; `notOwnWork` therefore reads the role for that exception only. Menus and buttons never read the role.
- C-02 "saved per user": the rail choice is kept in the browser under the user's id; PRD §9 has no place for it other than `user_table_preferences`, whose API arrives with the column chooser.
- NAV-9 asks for a not-allowed page and no artboard draws one: it is a title and one sentence inside the shell.
- Menu items whose pages are not built yet answer 404 until their tasks; the Dashboard page holds its title until TASK-615.

## Evidence

- RED: the unit, contract and shell tests failed before the framework and the shell existed.
- GREEN: API unit 15 tests (AC-IAM-010 invoice and SPK cases, BR-02, BR-03); `int "allowedActions contract"`: 6 passed (8 users on 3 states, 4 actions each; the Planner approval switch; System Admin self-approval; scope lock; refusal sentence). Whole API suite 123 tests, 96.7 % statements. Shared 268 tests, 100 %. Web 65 tests, 96.6 % statements. E2E 5 passed with one worker, including the Planner's menu after sign-in.
- Layer rules, lint, typecheck, format, secret scan, generated client unchanged and `check-coverage.mjs --tests` pass.
