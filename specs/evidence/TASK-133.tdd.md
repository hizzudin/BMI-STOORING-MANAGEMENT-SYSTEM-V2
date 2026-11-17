# TASK-133 Daily storage usage and the budget alert

- **Rules:** NFR-13, NFR-12, NFR-14, DEC-125, DEC-135.
- **Decision:** DEC-137 (PRD v2.49, commit 97dd753).
- **Tables:** none changed (`app_settings` and `notifications` exist, §9.12).

## Spec first (DEC-137, PRD v2.49, commit 97dd753)
The owner decided before any code:
- **Notify once per 5% step**, from 80% of the budget.
- **The notice text:** the title and the GB figures, with no link.

I added two details, recorded in DEC-137 and named in the plan for the owner to object to:
- the steps go on by 5% above 100%;
- a changed budget starts the steps again.

The plan is `docs/superpowers/plans/2026-11-17-task133-storage-usage-alert.md`; the owner approved it ("Ya, setujui").

## What changed
- **API:**
  - `ports/storage-usage.ts`;
  - `core/files/storage-usage.ts` (`usageStep`, `usageNotice`, `StorageUsageCheck`);
  - `infra/db/storage-usage-gateways.ts`;
  - `StorageUsageQueue` in `infra/queue/file-queues.ts` (cron `30 0 * * *`, `Asia/Jakarta`);
  - the provider in `app.module.ts`, and the start with a log line in `worker.ts`.
- **Tests:** `core/files/storage-usage.spec.ts` and `test/integration/files/storage-usage.test.ts`.

## Divergences from the plan
None.

## Skills loaded
None by the Skill tool in this session. This is in the workflow audit.

## Evidence

### RED, each run before its code
- **Unit `storage-usage.spec.ts`:** failed (no module `./storage-usage.js`).
- **Integration `storage-usage.test.ts`:** failed (no module `src/core/files/storage-usage.js`).

### GREEN
- **Unit:** 3 of 3:
  - no step below 80%;
  - the steps 80, 80, 85, 90 and 105 for 80, 84.99, 85, 92 and 107%;
  - the notice text.
- **Integration `storage usage`:** 4 of 4:
  - **The _Verify_ line:**
    - 79% gives no notice;
    - 80% gives one Alert to the System Admin, "File storage is 80% full" and "0.8 GB of the 1 GB budget is used.", with no link, and none to the Planner;
    - 84% adds none;
    - 85% adds one;
    - a rerun adds none.
  - **A jump** to 92% notifies once ("92% full", step 90); falling back to 86% adds none.
  - **A budget changed** to 2 GB at 46% gives none; at 105% the step is notified.
  - **The defaults** (50 GB, 80%) apply when the settings rows are missing: 41 GB is 82%, step 80.

### Gates
- `tsc` and `eslint` (API).
- `pnpm check:layers`: 434 modules, no violation.
- `pnpm check:coverage` (named tests), `pnpm check:secrets` and `pnpm check:client`: clean.
- Prettier was run on every touched file.

### Suites
- **API unit:** 33.
- **API integration, full run:** 264 passed and 1 skipped (s3). The 7 failures are the known local ones: 5 Redis queue tests (no local Redis), BR-10 and NFR-14.
- **The BullMQ scheduler** runs only in the worker, which needs Redis; it is not started in a test here.
- **Web and E2E:** no web change; CI runs them.
