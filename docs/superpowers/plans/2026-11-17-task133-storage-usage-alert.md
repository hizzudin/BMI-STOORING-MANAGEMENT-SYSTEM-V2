# TASK-133 plan: Daily storage usage and the budget alert

Branch `feat/phase1-task133-storage-usage-alert`. Spec: NFR-13, NFR-12, NFR-14, DEC-125, DEC-135, DEC-137 (PRD v2.49, commit 97dd753). No migration: `app_settings` and `notifications` exist (§9.12).

## Goal
- **Daily run:** at 00:30 WIB a job reads the total bytes in storage.
- **Alert:** when use reaches 80% of the budget (Settings, default 50 GB), the System Admin is notified once per 5% step: 80, 85, 90, 95, 100, 105 and so on.
- **Each step once:** a rerun, a later day at the same step, or a step already passed adds nothing. A changed budget starts the steps again.

**Done when** `int "storage usage"` shows:
- below 80%, no alert;
- at 80%, one alert to each System Admin, and none to other roles;
- at 84%, none more;
- at 85%, one more;
- a rerun of the same day adds none.

## Architecture
- **Port `ports/storage-usage.ts`:**
  - `StorageUsageGateway.settings()` returns `{ budgetGb, alertPct }` from `app_settings`, or null when a key is missing; the core applies the defaults 50 and 80;
  - `StorageUsageGateway.highestStepSent(budgetGb)` returns the highest step already notified for that budget, from the `notifications` dedupe keys.
- **Core `core/files/storage-usage.ts`, `StorageUsageCheck.run()`:**
  - `used = storage.totalBytes()`, `pct = used / (budgetGb × 1024³) × 100`;
  - below `alertPct`: nothing;
  - otherwise `step = alertPct + 5 × floor((pct − alertPct) / 5)`. If `step` is above the highest step sent, it notifies the active System Admin accounts through `NotificationGateway.send`, with:
    - kind `Alert`;
    - title `File storage is {floor(pct)}% full`;
    - body `{used} GB of the {budget} GB budget is used.`, with one decimal;
    - no link;
    - dedupe key `storage-usage:{budgetGb}:{step}`.
  - It returns `{ usedBytes, pct, step, notified }` for the log. One transaction covers the check and the send.
- **Infra:**
  - the Drizzle gateway;
  - `StorageUsageQueue`, a BullMQ job scheduler with the cron `30 0 * * *` in `Asia/Jakarta`;
  - `worker.ts` registers it and logs every run (NFR-12).
- **No route:** there is no screen yet, so the job only notifies.

## Tests, RED first this time
- **Integration `test/integration/files/storage-usage.test.ts`:**
  - the storage is replaced by a stub whose `totalBytes` the test sets;
  - one System Admin and one Planner;
  - the budget is set to 1 GB in `app_settings`, so the numbers stay small.
- **Cases:**
  - 79% → no notice;
  - 80% → one Alert to the System Admin with the title and body above, and none to the Planner;
  - 84% → none more;
  - 85% → one more;
  - a rerun at 85% → none more;
  - 92% after 85% → the 90 step;
  - a budget changed to 2 GB at 46% → none;
  - the defaults apply when the settings rows are missing.
- **Unit:** the step and the text formatting, a pure function.

## Gates
- lint, typecheck, check:layers, check:coverage, check:secrets and Prettier;
- the API suites;
- CI.
