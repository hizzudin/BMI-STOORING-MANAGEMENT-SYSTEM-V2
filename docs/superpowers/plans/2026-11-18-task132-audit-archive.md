# TASK-132 plan: Monthly audit archive

Branch `feat/phase1-task132-audit-archive`. Spec: NFR-17, DEC-57, DEC-131, DEC-138 (PRD v2.50, commits 08b8bb7 and a1ea711), BR-10, NFR-12, NFR-14.

## Goal
On the 1st of each month at 00:30 WIB:
- every WIB month that ended more than 12 months before the run month began is written to one read-only CSV in storage;
- the CSV is read back and checked against its SHA-256;
- the checksum is recorded in a new audit record and in the worker log;
- only then are the month's rows deleted.

Newer rows stay. A rerun changes nothing.

**Done when** `int "audit archive"` shows:
- rows older than a year are archived with a checksum and deleted;
- newer rows stay;
- a rerun of the same month changes nothing;
- the trigger still refuses an UPDATE, a DELETE outside the job, and a DELETE by the job of a row younger than a year.

## Architecture
- **Migration `0013_audit_archive.sql`:**
  - a new trigger function for `audit_logs`, `audit_log_append_only()`. It returns OLD only for a DELETE when `current_setting('bmi.audit_archive', true) = 'on'` and `OLD.at < (now() AT TIME ZONE 'UTC') - interval '1 year'`; otherwise it raises the same BR-10 error;
  - the trigger `audit_logs_append_only` is recreated on it;
  - the other append-only tables keep `refuse_change_of_append_only()`.
- **Shared:** `storageKey` also takes `csv` (§9.12 names the archive file). The fs adapter serves `.csv` as `text/csv`.
- **Port `ports/audit-archive.ts`, `AuditArchiveGateway`:**
  - `monthsBefore(cutoff)`: the WIB months (`YYYY-MM`) that still have rows before the cutoff, oldest first;
  - `rowsOf(from, to)`: every column, by id;
  - `deleteRange(from, to)`: `SET LOCAL bmi.audit_archive = 'on'`, then DELETE, returning the count;
  - plus the existing `AuditGateway`.
- **Core `core/audit/audit-archive.ts`:**
  - `archiveCutoff(wibToday)`: the WIB start of the run month minus 12 months, a pure function;
  - `AuditArchiveJob.run()`, for each month:
    - build the CSV with every column (id, at UTC ISO, entity, entity_id, action, user_id, user_role, self_decision, reason, before JSON, after JSON) using the existing `toCsv`;
    - SHA-256 it;
    - write it at `{env}/{yyyy}/{mm}/audit-archive/audit-{yyyy}-{mm}.csv`;
    - if the file already exists from a crashed run, keep it only when its SHA-256 matches, otherwise stop that month and report it;
    - read it back and compare;
    - then, in one transaction: delete the month (the count must equal the rows written, or it rolls back) and write the audit record (entity `audit_archive`, entity id `yyyymm`, action `archive`, after `{ file, month, records, sha256 }`, by the system).
    It returns one line per month for the log.
  - `AREA_OF.audit_archive = 'Access'`, because the Audit log lives in the Access Manager area.
- **Infra:**
  - `DrizzleAuditArchiveGateway`;
  - `AuditArchiveQueue`, a BullMQ job scheduler with the cron `30 0 1 * *` in `Asia/Jakarta`;
  - `worker.ts` logs each month's file, record count and SHA-256 (NFR-12, NFR-17).

## Tests, RED first
- **Unit `audit-archive.spec.ts`:**
  - `archiveCutoff('2027-12-01')` is the start of 2026-12 WIB;
  - `archiveCutoff('2026-11-01')` is the start of 2025-11.
- **Integration `test/integration/audit/audit-archive.test.ts`:**
  - fs storage, and the clock at 2026-11-01 00:30 WIB;
  - audit rows inserted in 2025-09, 2025-10 and 2025-11. The database trigger checks the real age, so the test months are kept more than a year in the past.
- **Cases:**
  - one run → 2025-09 and 2025-10 are archived and deleted, and 2025-11 stays;
  - each CSV holds every row with its full before and after, and its SHA-256 equals the one in the new `audit_archive` record;
  - a rerun → no new file, no new record, nothing deleted;
  - a file already written by a crashed run is kept when it matches and the month is then deleted; a different file stops that month and the rows stay;
  - the trigger: an UPDATE is refused; a DELETE without the flag is refused; a DELETE with the flag of a row from this month is refused.

## Gates
- lint, typecheck, check:layers, check:coverage, check:secrets and Prettier;
- the migration drift test;
- the full API suites;
- CI.
