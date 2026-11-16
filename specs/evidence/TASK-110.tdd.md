# TASK-110 Audit writer, Audit log page with export, Access history

- **Requirement:** REQ-IAM-007 (and the Access history tab of REQ-IAM-003).
- **Rules:** NFR-02, BR-03 (the Self flag), DEC-74, DEC-127 (paging like SPKList).
- **Decision:** DEC-131 (PRD v2.43, commit a0f279c).
- **Journeys:** FLW-SA-06, FLW-AM-05.
- **Tables:** audit_logs (read), export_logs (new, migration 0011).

## Spec first (DEC-131, PRD v2.43, commit a0f279c)

The owner decided before any code:
- **Archive:** the monthly audit archive (NFR-17, DEC-57) moves to TASK-132, after the storage port.
- **Paging:** server-side like SPKList: 20 per page by default; 10, 20, 50 or 100; newest first.
- **Filters:** User, Area and a date range, the last 7 days by default.
- **Before and After:** a short summary; a row opens a panel with the full JSON and the reason.
- **Export:** follows the filters, as CSV and xlsx, through one new library (`exceljs`); every export is written to `export_logs`.

The plan is in `docs/superpowers/plans/2026-11-16-task110-audit-log.md`; the owner approved it ("Ya, setujui").

## What changed
- **Shared:** `schemas/audit.ts`:
  - the three query schemas (From ≤ To checked in the schema);
  - the item, detail and response schemas;
  - `AUDIT_AREAS`, `AUDIT_PAGE_SIZES`, `AUDIT_EXPORT_MAX_ROWS`, `AUDIT_MESSAGES` and `selfLabel`.
- **API:**
  - `ports/audit-log.ts`;
  - `core/audit/audit-format.ts`: the area map, the summary, the record label, the access wording and CSV;
  - `core/audit/audit-log-service.ts`;
  - `infra/db/audit-log-gateways.ts`;
  - `infra/files/exceljs-spreadsheet-writer.ts`;
  - `http/audit-log/audit-log.controller.ts`, with 4 routes and an error filter;
  - `ApiFileContract` for file routes (`contract.ts`, the interceptor and the OpenAPI builder);
  - migration `0011_export_logs.sql` with the Drizzle `exportLogs`;
  - `exceljs@4.4.0`.
- **Web:**
  - `AuditLog` (filters, table, pager, the Audit record panel, the C-26 Export dialog) at `/audit-log`, which reads `?area=`;
  - `AccessHistory` at `/users/history`;
  - `kit/Pager`;
  - the `download` icon;
  - CSS for `date-filter`, `link-button` and `json`.
- **E2E seed:** "Self approval check", an SPK submitted by the System Admin that waits for creation approval.

## Divergences from the plan
- **`export_logs`:** the plan said the table existed; it did not. Migration 0011 creates it exactly as §9.12 defines it (append-only), so §9 is unchanged.
- **The Self column:** carries the label (`self: 'Self-approved' | 'Self-verified' | null`) instead of a boolean, so the web and the export say the same.
- **The record name:** comes from left joins in the gateway (an SPK approve record holds only the status), not from the JSON.
- **A file route:** needed a contract kind of its own (`ApiFileContract`), because every route must carry a contract (§8.2).

## Kept different from the artboard (on purpose, to show the owner)
- **AuditLog:** the artboard's filter chips ("User: All", "Area: All", "Date: last 7 days") are selects and date fields, as on SPKList (DEC-127). The pager sits under the table as on SPKList.
- **AuditLog:** the artboard's area "Step" does not exist yet (steps come with the engine); the areas are SPK, Access, Vehicles and Settings.
- **AMAccessHistory:** "Full trail in Audit log" is a link above the table (FLW-AM-05 names the step; the artboard has no control for it). The kinds are written in full ("SPK creation" where the artboard has "creation").

## Skills loaded
- **None by the Skill tool in this session.** I followed the project conventions in the code (hexagonal ports, contract-first routes, the SPKList patterns) and the rules in CLAUDE.md, WORKFLOW_STANDARDS.md and the handoff. This is in the workflow audit.

## Evidence

### RED, each run before its code
- **Shared `audit.test.ts`:** failed (the module did not exist).
- **API `audit-log.test.ts`:** 16 of 16 failed (404: no routes).
- **API unit `audit-format.spec.ts`:** failed (the module did not exist).
- **Web `audit-log.test.tsx`:** failed (the components did not exist).
- **E2E:** `audit-log-flw-sa-06.spec.ts` and `access-history-flw-am-05.spec.ts` were written before the web screens.

### GREEN
- **Shared `audit.test.ts`:** 9 of 9.
- **API unit `audit-format.spec.ts`:** 12 of 12. Every entity written in `src/` has an area; the summary, the record label, the access wording and the CSV escaping are covered.
- **API `audit-log.test.ts`:** 16 of 16:
  - REQ-IAM-007: the default 7 WIB days, newest first; the columns and the Self flag; a system change has no user;
  - DEC-131:
    - the summary;
    - the filters (user, area, WIB dates with the 00:30 and 23:30 edges);
    - the pages;
    - the User options;
    - From after To is refused;
    - the detail, and 404 for an unknown id;
  - REQ-IAM-007: the GM and the Access Manager may open it; a Planner gets 403;
  - DEC-74: a CSV with BOM, header, rows and an `export_logs` row; CSV injection; an xlsx that opens with exceljs;
  - DEC-131: the 10,000-row cap, with nothing logged;
  - FLW-AM-05: the Access history wording; the System Admin and the GM are refused.
- **Web `audit-log.test.tsx`:** 10 of 10.

### Gates
- `pnpm lint`, `pnpm typecheck`, `pnpm check:layers` (377 modules, no violation) and `pnpm check:secrets`: all pass.
- `node specs/tools/check-coverage.mjs --tests`: Coverage OK.
- Prettier was run on every touched file.

### Suites
- **Shared:** 318 of 318.
- **Web:** 189 of 189.
- **API unit:** 29 of 29.
- **API integration:** 231 of 238. The 7 failures are the known local ones, outside this task (CI is green on them):
  - the 5 queue tests (WSL Redis is not reachable from Windows);
  - BR-10 (error code 23001 vs 23503 on PostgreSQL 18);
  - NFR-14 (the UTC session).

### E2E
- **TASK-110 specs, run alone:** 3 of 3 (FLW-AM-05, FLW-SA-06 self-approval and detail, DEC-74 csv and xlsx downloads).
- **First full run (`pnpm e2e`, after the build):** 25 of 26. One test failed at sign-in (`expect(page).not.toHaveURL(/login/)`); my output filter hid its name.
- **Second full run (`npx playwright test`):** 26 of 26 in 2.0 min.

So one sign-in was flaky once; it is not counted as passed.

### QA at 1440 x 900
A throwaway `zz-qa.spec.ts` took screenshots, then was deleted and never committed:
- **AuditLog:** matches the artboard. The heading has Export with the download icon; the columns are Time, User, Role, Area, Record, Before, After, Self; the row shows the short before and after; the pager is under the table.
- **The Audit record panel:** the time, user, area, action and reason, and the full Before and After JSON.
- **AMAccessHistory:** matches the artboard: the three tabs with Access history on, and When, Who, What, written as "2026-11-17 07:30 · Access Manager E2E · Planner approval on until it is switched off (SPK creation)".
- **Not captured:** the Export dialog. The spec timed out pressing Escape on the panel, because the shared `Panel` keeps focus outside the form. That is the kit's behaviour, not changed here; the dialog is covered by the web test and the E2E download.
- **Kept different on purpose:** see "Kept different from the artboard" above.

### Local environment
- Windows PostgreSQL 18 on port 5432; `TEST_DATABASE_URL` on `bmi_dev` (the harness makes its own databases).
- WSL Redis is not reachable from Windows. The queue, BR-10 (error code) and NFR-14 (UTC session) tests fail here and pass in CI.
