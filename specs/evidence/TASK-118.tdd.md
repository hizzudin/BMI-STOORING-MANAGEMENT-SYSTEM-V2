# TASK-118 Document types master

Requirements: REQ-DOC-001, REQ-DOC-002. Rules: DEC-20, DEC-121 (with DEC-86 for the later preset). Journey: FLW-SA-02 step 4. Tables: document_types, document_type_classes (§9.4), audit_logs.

## Spec first (DEC-121, PRD v2.33)

Owner decisions: the four types of REQ-DOC-001 are seeded as data; the count of vehicles that become non-compliant when the required classes change comes with the vehicles in TASK-119; the SPK preset of a type (DEC-86) and its preset_id column come with the SPK presets in TASK-208. The artboard showed only Type and Warning days: it gained code, name, usual validity, receipt required and the required-class checklist before the code. vehicle_documents and document_corrections were planned here but reference vehicles; they moved to TASK-119 in the plan (no PRD or model change).

## What changed

- Migration 0007 (two tables and the four launch types) and their Drizzle definitions (drift test passes).
- Shared: `schemas/document-types.ts` (type, list with classes and page actions, new and edit requests with their checks).
- API: `DocumentTypeService` (list, create, update, deactivate; one audit record each), `DrizzleDocumentTypeGateway`, routes under `masterdata.manage`, 400/404/409 filter.
- Web: `/settings/document-types` with `DocumentTypes` (C-31 New marked New, C-16 Discard changes, C-17 Save then Saved, C-32 Deactivate naming what stops).
- E2E: `document-types.spec.ts` (FLW-SA-02 step 4); it makes the class it needs through the same session, so it does not depend on the order of the specs.

## How the spec was read

- Deactivated types leave the list and are no longer offered (C-32); a second deactivation is 404 because no active type has that id.
- Warning days stay on the type (DEC-20); DEC-86 lets Alert rules edit them later on the same column.

## Evidence

- RED: the shared tests failed before the schema existed; the integration and web tests were written before their code and first ran after it.
- GREEN: shared 293 tests, 100 %; API 168 tests, 96.3 % statements, including `document-types.test.ts` 5 (the launch types; only the System Admin; an edit with classes and one audit record; a new type with a unique code and known classes; deactivation) and the drift test; web 106 tests, 89.4 %, including `document-types.test.ts` 7; e2e 13 of 13. Layers, lint, format, secrets, types and `check-coverage --tests` clean.
- `qa` at 1440 x 900 against DocumentTypes on the local database: list columns, record panel, fixed code note, validity and warning days side by side, receipt, class checklist and the three buttons match. Kept on purpose: numbers right-aligned in the table and the search and column filters (NFR-08).

## CI fix after the merge

The main CI run failed: CI ran the e2e spec files in parallel, and FLW-AM-03 moved the System Admin role while this spec used the System Admin account (Not allowed), and the retry then hit 409 on the class the first attempt had made. Playwright now runs one worker (every spec shares one database and accounts whose roles change), and the specs that create records use names unique per attempt.
