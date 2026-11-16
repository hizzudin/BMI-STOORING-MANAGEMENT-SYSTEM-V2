# TASK-111 Setup mode and Go live, both ways

- **Requirement:** REQ-IAM-010.
- **Acceptance:** AC-IAM-006.
- **Rules:** DEC-55, DEC-56, BR-04, BR-12.
- **Decision:** DEC-132 (PRD v2.44, commit e3fe5d7).
- **Journey:** FLW-SA-08.
- **Tables:** app_settings (`system_mode`, `went_live_at`), auth_sessions (revoked), audit_logs. No migration.

## Spec first (DEC-132, PRD v2.44, commit e3fe5d7)

The owner decided before any code:
- **Go live:** needs a reason and GO LIVE typed (the flows text wins over the artboard, which gained the fields).
- **The checklist:** shows counts for what is built (accounts, master data, vehicles and documents) and is information only. The items of later tasks are hidden.
- **Backup restore test:** removed from the artboard (no requirement asks for it).
- **The switch is reversible:** the System Admin goes back to Setup with a reason and BACK TO SETUP typed. This changed the PRD's one-way rule. Its consequences, decided one by one:
  - the other roles' sessions end at once;
  - opening balance and bulk import open again in Setup;
  - the menu item shows in both modes;
  - the same typed confirmation and audit are used both ways.

**Corrected:**
- REQ-IAM-010, AC-IAM-006 and REQ-INV-013;
- FLW-SA-08 and the OpeningBalance action row;
- the glossary and the menu table of PRD.md, and the `went_live_at` note in §9;
- the artboards SetupGoLive, GoLiveConfirm and OpeningBalance;
- the new artboard BackToSetupConfirm.

The plan is `docs/superpowers/plans/2026-11-17-task111-setup-golive.md`; the owner approved it ("Ya, setujui").

## What changed
- **Shared:**
  - `schemas/system-mode.ts`;
  - the menu item Setup and go live in both modes (the permissions test was updated for DEC-132).
- **API:**
  - **Auth gate:** in `AuthService` (sign-in, every request, refresh), with the new refusal `setupMode` (403).
  - **`SystemModeService`:** status, go live, back to setup; Idempotency-Key, one transaction, audit with the reason, `went_live_at`, and the session revoke.
  - **Port and gateway:** `ports/system-mode.ts` and `infra/db/system-mode-gateways.ts`.
  - **Routes:** `SystemModeController` with 3 routes and an error filter.
  - **Audit log:** `AREA_OF` gains `system_mode` (Settings).
- **Web:**
  - `/setup` (`SetupGoLive`) with GoLiveConfirm and BackToSetupConfirm;
  - `lib/system-mode-api.ts`;
  - the shell sends the holder of `setup.golive` to `/setup` while in Setup.
- **Tests:** `auth.test.ts` now sets Live before its journeys. The harness starts in Setup, so DEC-56 refused its Planner accounts once the gate existed.

## Divergences from the plan
None in behaviour.

## Seen in QA, not changed
In Live the System Admin's rail holds 15 items. At 1440 x 900 the last ones scroll inside the rail (the rail already scrolls with a hidden scrollbar, as designed). The Setup and go live item is reached by scrolling the rail.

## Skills loaded
None by the Skill tool in this session; the project conventions and the earlier tasks' patterns were followed. This is in the workflow audit.

## Evidence

### RED, each run before its code
- **Shared `system-mode.test.ts`:** failed (no module).
- **Permissions test:** 1 failed (the menu item in Live).
- **API `system-mode.test.ts`:** 7 of 7 failed.
- **Web:** `setup-golive.test.tsx` failed (no module); the shell landing test failed (1).
- **E2E:** `setup-golive-flw-sa-08.spec.ts` was written before the web screen.

### GREEN
- **Shared `system-mode.test.ts`:** 3 of 3.
- **API `system-mode.test.ts`:** 7 of 7:
  - AC-IAM-006: a Planner is refused in Setup, and SPK create is not in the capabilities; after Go live the Planner signs in;
  - DEC-132:
    - the checklist and the allowed action;
    - the reason and the exact phrase;
    - one audit record, and a retried key that does not switch twice;
    - Go live again is refused;
    - a Planner may not switch;
  - Back to Setup: the Planner's next request and refresh answer "The system is being set up.", and the Access Manager keeps working;
  - Go live again: the latest `went_live_at`; the ended session stays ended, and a new sign-in works.
- **Web:** `setup-golive.test.tsx` 4 of 4; shell 14 of 14.

### Gates
- `pnpm lint` and `pnpm typecheck`: 9 of 9.
- `pnpm check:layers`: 390 modules, no violation.
- `pnpm check:secrets`: clean.
- `check-coverage --tests`: Coverage OK.
- Prettier was run on every touched file.

### Suites
- **Shared:** 321 of 321.
- **Web:** 194 of 194.
- **API unit:** 29 of 29.
- **API integration:**
  - the full run before the `auth.test.ts` fix: 222 of 245. The 16 auth failures are explained above; the 7 others are the known local ones (5 queue tests on WSL Redis, BR-10 on PostgreSQL 18, NFR-14);
  - after the fix, `test/integration/iam`: 90 of 90.
- **E2E (`pnpm e2e`):** 27 of 27 in 3.4 min, including FLW-SA-08.

### QA at 1440 x 900
A throwaway `zz-qa.spec.ts` took screenshots, then was deleted and never committed:
- **SetupGoLive in Setup:** the crumb "Setup mode", three ticked steps with counts, the lock note, and Go live. It matches the artboard, without the later items.
- **GoLiveConfirm:** the text, Reason, "Type GO LIVE to confirm", Cancel and Go live.
- **BackToSetupConfirm:** the Live page with its note and the dialog. It matches the artboard; the crumb is "Live" because the e2e seed has no `went_live_at`.

### Local environment
- Windows PostgreSQL 18 on port 5432. WSL Redis is not reachable from Windows, so the queue tests fail here and pass in CI.

## Addendum: DEC-133 (PRD v2.45), Setup mode and self-decisions

The owner's later instruction, asked and decided before code:
- In Setup mode the System Admin may do all its functions without restriction.
- The ban on self-approval is lifted only in Setup: there, the one who asked for an approval may approve it, still marked Self-approved.
- While Live, nobody, the System Admin included, may decide its own work.

The spec came first (commit cda7db7):
- BR-03, RL-3, the 2.4 capability set and the glossary;
- REQ-IAM-010, REQ-IAM-012 and AC-IAM-006;
- REQ-SPK-006 and AC-SPK-006, REQ-ENG-007, REQ-APR-006 and AC-APR-003, and AC-INV-004;
- the test journeys.

The plan addendum was approved ("Ya, setujui").

### What changed
- **Capabilities:** Setup mode removes no capability (`blockedInSetupMode` was removed from `@bmi/shared`, with its test).
- **`Actor`:** carries `systemMode` (from `actorOf`).
- **`notOwnWork`:** refuses one's own work while Live for every role, and allows it in Setup. `isSelfDecision` still marks it.
- **Approvals:** the inbox and `allowedActions` follow the same policy.
- **E2E FLW-SA-06:** the System Admin's own SPK is absent from its inbox while Live. It goes back to Setup, approves it (Self-approved), checks the Audit log and goes live again.

### Evidence
- **RED:**
  - `actions.spec.ts`: 2 failed;
  - `capabilities.spec.ts`: 1 failed;
  - `approvals.test.ts`: AC-SPK-006 and AC-APR-003 failed;
  - `allowed-actions.test.ts`: the System Admin case failed;
  - `system-mode.test.ts`: AC-IAM-006 failed.
- **GREEN:**
  - API unit 30 of 30;
  - API integration `approvals`, `iam` and `spk`: 137 of 137, after `capability-matrix.test.ts`, which still asserted the old Setup block, was updated to DEC-133;
  - shared 320 of 320;
  - web 194 of 194.
- **Gates:** lint and typecheck 9 of 9; check:layers (390 modules) clean; check:secrets clean; Coverage OK.
- **E2E:**
  - full run 26 of 27. The failure was FLW-AM-05, the first spec, timing out at the login page before any step of this change;
  - rerun alone with FLW-SA-06 and FLW-SA-08: 4 of 4;
  - the second full run (`npx playwright test`): 27 of 27 in 2.0 min.
