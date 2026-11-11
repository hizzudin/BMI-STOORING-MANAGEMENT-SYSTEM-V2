# TASK-120 SPK migrations and gateway, SPK numbering

Rules: NFR-15, DEC-104, DEC-111, DEC-124; also REQ-VEH-003 and REQ-VEH-004 with open SPKs (DEC-17, DEC-122). Tables: spks, spk_assignments, spk_approvals, spk_attachments, spk_parts, assignment_modules (§9.6, §9.7), app_settings.numbering_formats (§9.12).

## Spec first (DEC-124, PRD v2.36)

The SPK tables refer to tables of later tasks: spk_presets, spk_check_items, spk_change_requests, parts_catalog, goods_issue_items, stooring_rates, spk_services, breakdown_reports, maintenance_alerts, tyres and vehicle_documents. The owner decided:

- Those columns are created now as plain columns. The task that builds each table adds its reference; the notes are on TASK-201, 301, 401, 402, 405, 501 and 601.
- assignment_modules starts empty: the engine registers its dummy module in TASK-201, and each module registers itself in its own task.
- An open SPK is the REQ-SCH-001 list.

## What changed

- **Migration 0009:** the six tables with every column of §9.6 and §9.7, the sequence, the DEC-80 source indexes, the append-only trigger on spk_approvals, and the numbering_formats seed.
  - TX-18: the number and source indexes skip soft-deleted rows. The sequence alone already keeps a number from being issued twice.
- **Drizzle:** definitions of the six tables and their enums; the drift test covers them. The drift check now ignores the space Drizzle writes in `numeric(14, 2)`.
- **Shared:** `OPEN_SPK_STATUSES`.
- **API:**
  - `ports/numbering.ts` and `ports/spks.ts`.
  - `infra/db/spk-gateways.ts`: `DrizzleDocumentNumbers`, which reads the stored format, checks it, takes `nextval` in the transaction and formats with the WIB date; and `DrizzleSpkGateway` (insert, findById, openNumbersByVehicle).
  - `DrizzleVehicleActivity` replaces the placeholder: the vehicle class lock and the deactivation refusal now read real open SPKs.

## Evidence

- **RED:** `spk/spk-gateway.test.ts` and `fleet/vehicle-open-spk.test.ts` were written before the ports and gateways. The first run after the migration failed only on the drift check's numeric spelling.
- **GREEN:**
  - `spk-gateway.test.ts` 7 tests:
    - the seed equals NUMBERING_CONFIG;
    - SPK-yymmddNNNN from the WIB date (01:30 WIB on 4 Nov gives 261104);
    - never reused after a cancel or a rolled-back transaction;
    - built from the stored format, and a broken or missing format refused;
    - insert and read;
    - open SPKs per vehicle across all nine statuses;
    - the database checks (cancel needs a reason, a report SPK needs its report, approvals append-only).
  - `vehicle-open-spk.test.ts`: an open SPK locks the class with its number in the sentence and refuses the deactivation; once Cancelled, both go through.
  - db, spk and fleet integration: 75 of 75.
  - Full local runs on an 8 GB machine with about 1 GB free:
    - shared 297 tests, 100 %;
    - web 121 tests, 88 %;
    - chassis-map 129 tests, 100 %, run in parts because its workers could not start under the memory pressure;
    - API 184 of 187.
  - The 3 API failures are the migration runner's 180 s hook timeouts while it creates and drops scratch databases. The file passes alone (4 of 4, after migration 0009), so CI is the check of record for the full run.
  - E2E was not rerun locally: nothing on the web side changed, and the class lock with open SPKs is covered by the API test above.
  - `check-coverage --tests`, layers, lint, types and secrets are clean. Format is clean except the local, untracked design-hook cache.
