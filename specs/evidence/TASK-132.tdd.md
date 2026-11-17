# TASK-132 Monthly audit archive

- **Rules:** NFR-17, DEC-57, DEC-131, BR-10, NFR-12, NFR-14.
- **Decision:** DEC-138 (PRD v2.50, commits 08b8bb7 and a1ea711).
- **Tables:** `audit_logs` (§9.2). Its trigger function changes in migration 0013; no column changes.

## Spec first (DEC-138)
The owner decided before any code:
- **The run:** the 1st of each month at 00:30 WIB, with one CSV per WIB month older than 12 months.
- **The checksum:** in a new audit record and in the worker log.
- **The deletion:** a narrow exception in the append-only trigger.

**A correction before the plan (a1ea711):** my first DEC-138 text named the Audit log export columns. Those hold only a summary of before and after, so the archive file now keeps every column in full.

The plan is `docs/superpowers/plans/2026-11-18-task132-audit-archive.md`; the owner approved it ("Ya, setujui").

## What changed
- **`migrations/0013_audit_archive.sql`:** `audit_log_append_only()` and the recreated trigger on `audit_logs`.
- **Shared:** `storageKey` takes `csv`.
- **API:**
  - the fs adapter serves `.csv` as `text/csv`;
  - `ports/audit-archive.ts`;
  - `core/audit/audit-archive.ts` (`archiveCutoff`, `wibMonthRange`, `AuditArchiveJob`);
  - `AREA_OF.audit_archive = 'Access'`;
  - `infra/db/audit-archive-gateways.ts`;
  - `AuditArchiveQueue` in `infra/queue/file-queues.ts` (cron `30 0 1 * *`, `Asia/Jakarta`);
  - the provider in `app.module.ts` and the start with log lines in `worker.ts`.
- **Tests:**
  - `core/audit/audit-archive.spec.ts`;
  - `test/integration/audit/audit-archive.test.ts`;
  - the Access entities in `audit-format.spec.ts` now include `audit_archive`, as planned.

## Divergences from the plan
None.

## Skills loaded
None by the Skill tool in this session. This is in the workflow audit.

## Evidence

### RED, each run before its code
- **Unit `audit-archive.spec.ts`:** failed (no module `./audit-archive.js`).
- **Integration `audit-archive.test.ts`:** failed (no module `src/core/audit/audit-archive.js`).
- **`audit-format.spec.ts` (area filter):** failed once the area was added, as expected; the expectation was updated to the planned area.

### GREEN
- **Unit (audit):** 14 of 14, including the cutoff (2027-12-01 → 2026-12 WIB; 2026-11-01 → 2025-11; January) and the WIB month range.
- **Integration `audit archive`:** 5 of 5:
  - **The first run:** the clock is 2026-11-01 00:30 WIB. 2025-09 and 2025-10 are archived and deleted, and 2025-11 stays. A row at 18:00 UTC on 30 September is in October. The CSV holds every row with its reason (with a comma), its full before and after, and its UTC time. Two `audit_archive` records (202509, 202510) hold the file, month, count and the SHA-256 of the stored file.
  - **A rerun:** returns nothing, adds no record and deletes nothing.
  - **A crash:** with the read-back failing, the month is reported and its rows stay while the file is written; the next run keeps the matching file and deletes the month.
  - **A different file already in storage:** the month is reported and its rows stay.
  - **The trigger:**
    - an UPDATE is refused;
    - a DELETE without the flag is refused;
    - a DELETE with the flag of a row of today is refused.

### Gates
- `tsc` and `pnpm --filter @bmi/api lint`.
- `pnpm check:layers`: 439 modules, no violation.
- `pnpm check:coverage` (named tests), `pnpm check:secrets` and `pnpm check:client`: clean.
- Prettier was run on every touched file.

### Suites
- **Shared:** 337.
- **API unit:** 35.
- **API integration, full run, with the migration drift test:** 269 passed and 1 skipped (s3). The 7 failures are the known local ones: 5 Redis queue tests (no local Redis), BR-10 and NFR-14.
- **The BullMQ scheduler** runs only in the worker, which needs Redis; it is not started in a test here.
- **Web and E2E:** no web change; CI runs them.
