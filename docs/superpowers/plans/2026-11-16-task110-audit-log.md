# TASK-110 plan: audit writer, Audit log page with export, Access history

Branch `feat/phase1-task110-audit-log`. Spec: REQ-IAM-007, NFR-02, DEC-74, DEC-131 (PRD v2.43, commit a0f279c). The monthly archive is TASK-132. No migration: `audit_logs` and `export_logs` exist (§9.2, §9.12).

## Goal

The Access Manager and the System Admin (whoever holds `audit.view`, PRD 2.4) can:
- read every recorded change with its user, role, area, record, before, after and the Self flag;
- filter and page the list;
- export it as CSV or xlsx, each export logged.

The Access Manager also sees an Access history tab with the access changes.

**Done when:**
- the integration tests pass;
- `e2e FLW-SA-06` and `e2e FLW-AM-05` pass;
- AuditLog and AMAccessHistory match their artboards.

## Architecture

### Audit writer
`AuditGateway.write` already exists and every service writes through it (spk, user, role_permissions, planner_approval, vehicle, vehicle_class, document_type).

`core/audit/audit-areas.ts` gains one table, `AREA_OF`, that maps an entity to its area:

| Entity | Area |
| --- | --- |
| spk | SPK |
| user, role_permissions, planner_approval | Access |
| vehicle, vehicle_class | Vehicles |
| document_type | Settings |

A later task adds its entity there. A test fails when a written entity has no area.

### Shared (`schemas/audit.ts`)
- **`AuditLogQuerySchema`:** `userId?`, `area?`, `from?`, `to?` (WIB dates; the default is the last 7 days), `page`, and `pageSize` of 10, 20, 50 or 100 (20 by default).
- **`AuditLogItem`:**
  - `id`, `at`;
  - `user` (name and role, or System);
  - `area`, `entity`, `entityId`;
  - `record` (a label);
  - `action`;
  - `summary` `{ before, after }`;
  - `selfDecision`, `reason`.
- **`AuditLogDetail`:** the full `before` and `after` JSON.
- **Response:** `{ items, pagination, users }`, where `users` are the filter options.

### API (hexagonal)
- **`ports/audit-log.ts`:** `AuditLogGateway`:
  - `page(filter)`;
  - `count(filter)`;
  - `one(id)`;
  - `rows(filter, limit)` for the export;
  - `logExport(entry)` into `export_logs`.
- **`core/audit/audit-log-service.ts`:**
  - **Summary:** the status before and after when both have one; otherwise the changed top-level field names, at most 3.
  - **Record label:** an SPK number, a plate, an email or a code from the JSON, else `#id`.
  - **Export:** limited to 10,000 rows. Above that it refuses with "Narrow the filters to export at most 10,000 rows." It writes `export_logs` with `export_type` `audit_log`.
- **`core/audit/audit-export.ts`:** CSV (RFC 4180, UTF-8 with BOM for Excel), and xlsx through `exceljs`. The xlsx part sits behind an `AuditFileWriter` port, so the core does not import the library.
- **Routes (`AuditLogController`):**

  | Route | Needs |
  | --- | --- |
  | `GET /audit-logs` | audit.view |
  | `GET /audit-logs/:id` | audit.view |
  | `GET /audit-logs/export?format=csv\|xlsx&…filters` | audit.view; a file download with a dated name |
  | `GET /access-history` | accounts.manage; the Access-area rows in page form |

### Web
- **`/audit-log` (AuditLog):**
  - head with Export (CSV or xlsx);
  - filters: User, Area, From and To (the last 7 days by default);
  - table: Time, User, Role, Area, Record, Before, After, Self;
  - the pager like SPKList;
  - a row opens a side panel with the full before and after and the reason.
- **Access history:** a third tab on Users and roles, the When/Who/What table. "What" is the access summary (for example "Planner approval on until 18:00 (creation)" or "Moved System Admin from Rina to Yusuf"), built from the action and the JSON. The page links to the full trail on Audit log.

### Trial seed
A few audit rows come for free, because the trial flows write them. The seed adds none.

## Tests (written first, run red)
- **Integration, `audit-log.test.ts`:**
  - REQ-IAM-007: the columns, the Self flag, newest first, and the default 7-day window;
  - filters by user, area and dates;
  - pages;
  - the detail;
  - access by `audit.view` only (403 for a Planner);
  - export CSV: the header, the rows and an `export_logs` row;
  - export xlsx: a file that opens with `exceljs`;
  - the 10,000 cap;
  - Access history: only Access-area rows, and only for `accounts.manage`.
- **Unit:** the area map covers every entity written in `src/`, plus the summary and the record label cases.
- **Web:** AuditLog (filters, pager, detail panel, export links) and the Access history tab.
- **E2E:**
  - `audit-log-flw-sa-06.spec.ts`: the System Admin approves its own SPK, then sees the row flagged Self-approved.
  - `access-history-flw-am-05.spec.ts`: the Access Manager switches Planner approval on, then sees it in Access history and on Audit log.

## Review focus
1. **A large export blocks the API:** the 10,000 cap. Owned by the cap test.
2. **CSV injection** (a cell that starts with `=`, `+`, `-` or `@`): the cell is prefixed with `'`. Owned by an export test.
3. **Time zone:** times are shown in WIB, and the date filters are WIB days. Owned by the filter test.
4. **A new entity without an area:** owned by the area unit test.
5. **Someone without `audit.view`:** 403, and no menu item. Owned by the access test.

## Execution
Native, in this session or a fresh one. Context is nearly full; a fresh session is advised.
- **Skills:** the always-on skills; the API and Web groups; hexagonal-architecture; e2e-testing and browser-qa.
- **Order:** shared, then API (RED, then GREEN), `gen:client`, the E2E specs, then web (RED, then GREEN), QA, gates, bookkeeping.
