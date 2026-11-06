# Requirements index — BMI Stooring System v2

> Spec version: PRD v2.22 (2026-11-06). The entity is SPK everywhere, in text, IDs and code (PRD §0.7, DEC-106).
> The text of every ID lives in [PRD.md](../PRD.md) and [docs/prd/](../docs/prd/); where they disagree with this file, the PRD wins.
> Build order: data model (§9) and rules (§5) first, then requirements by release step (§10), then screens (§7).

> The authoritative placement of every ID is the generated [tasks.md](tasks.md) (each task lists its REQ, AC, rules, screens and tables explicitly) and [decision-index.md](decision-index.md); `node specs/tools/check-coverage.mjs` proves nothing in the PRD is left out. The Tasks column below is a guide by area.

Legend: **P0** = Release 1, built here. **Deferred** = P1/P2 IDs in the same area, not built in Release 1. Retired IDs (history.md) are never built and are not listed. **Tasks** point at [tasks.md](tasks.md); **Journeys** at [tdd-user-journeys.md](tdd-user-journeys.md).

## 0. Cross-cutting (every release step)

| Kind | IDs | Where | Tasks |
| --- | --- | --- | --- |
| Product principles | PR-1 to PR-6 | PRD §1.2 | all |
| Business rules | BR-01 to BR-16 | PRD §5 | first task of each area that writes the guarded table |
| State machines | SM-SPK, SM-STEP, SM-VEH, SM-DOC, SM-TYRE, SM-GR, SM-SA, SM-TC, SM-TR, SM-RD, SM-CR, SM-SCH, SM-INV | PRD §3 | TASK-102 (tables), then each area |
| Roles, permissions, capabilities | R-*, RL-1 to RL-10, §2.2 matrix, §2.4 catalogue and menu, DEC-93 | PRD §2 | TASK-105, TASK-106, every task with a button |
| NFRs | NFR-01 to NFR-19 | PRD §8 | see §9 below |
| Engineering practices and risk tiers | §8.3, §8.4 (DEC-78, DEC-79) | PRD §8.3–8.4 | design.md §6, every task |
| Transactions | TX-01 to TX-21 (TX-04 retired) | data-model.md §9.13 | per area below |
| Screens | 7.3 inventory, 7.9 action map, artboards | ui.md, ui-action-map.md, Design Artifact/ | every screen task |

## 1. R1 step 1 — foundation, access, vehicles, SPK core

| Area | P0 requirements | Deferred | Acceptance criteria | Rules and machines | Data (§9) | Flows | Tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IAM accounts and access | REQ-IAM-001 to 010, 012 to 014 | — | AC-IAM-001 to 006, 008 to 010 | BR-14, RL-1 to RL-7, TX-20 | 9.2, 9.12 | FLW-AM-01 to 06, FLW-SA-06, FLW-SA-08 | TASK-103 to TASK-111 |
| Vendors | REQ-INV-014 | — | — | DEC-58 | 9.8 (vendors) | FLW-SA-09 | TASK-112 |
| File upload and storage | REQ-FUP-001 to 010, 012 to 014, 016 | REQ-FUP-011, 015 (P1) | AC-FUP-001 to 006, 008, 009 (AC-FUP-007 in step 7) | NFR-06, NFR-13, DEC-31, DEC-32 | 9.12 (stored_files) | every flow with a photo | TASK-113 to TASK-115 |
| Classes, layouts, map component | REQ-PLC-013, 017, 019, 020; map library for REQ-PLC-008, 010 | REQ-PLC-015, 016 (P1) | AC-PLC-007, AC-PLC-010 | DEC-68, DEC-69, DEC-73 | 9.3, 9.10 (part_positions) | FLW-SA-05 | TASK-116, TASK-117 |
| Document master | REQ-DOC-001, 002 | — | — | SM-DOC (table only) | 9.4 (document_types) | FLW-SA-02 step 4 | TASK-118 |
| Vehicles | REQ-VEH-001 to 004, REQ-PLC-018 | REQ-VEH-009 (P1) | AC-VEH-003 | SM-VEH (table only), DEC-17 | 9.3 | FLW-SA-01, FLW-SA-03 | TASK-119 |
| SPK core, approvals and stamps | REQ-SPK-001, 002, 005 to 008, 010, 011, 013, 015; REQ-APR-001 to 007 | REQ-APR-008 (P1) | AC-SPK-001, 005, 006; AC-APR-001 to 004 | BR-01 to BR-04, SM-SPK T1 to T6, T15 | 9.6 (spks, spk_approvals) | FLW-PLN-01, 03, FLW-APR-01, 05 | TASK-120 to TASK-125 |
| Shell and navigation | 7.2, 7.5, 7.6 (NAV-*), NFR-09, NFR-10 | Indonesian translation (Q-05) | — | DEC-82, DEC-94, DEC-96 | — | every flow's first step | TASK-126 |
| Mobile spike | §8.3 Mobile app practice | — | — | NFR-18 | — | — | TASK-127 |

## 2. R1 step 2 — assignment engine, registry, SPK document

| Area | P0 requirements | Deferred | Acceptance criteria | Rules and machines | Data (§9) | Flows | Tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ENG assignment engine (critical) | REQ-ENG-001 to 008, 010 to 017 | REQ-ENG-009 (P1) | AC-ENG-001 to 010 | BR-03, BR-05, SM-STEP, SM-SPK T7, T11 to T14, TX-02, TX-13 | 9.6 | FLW-PLN-05, 07, 09, FLW-MEC-04, 07, FLW-APR-03 | TASK-201 to TASK-206, TASK-210, TASK-211 |
| REG registry, composer, presets (critical) | REQ-REG-001 to 007, REQ-SPK-004, 017 | — | AC-REG-001 to 005; AC-SPK-002, 003 | PR-6, DEC-85 | 9.6 | FLW-PLN-01, 08 | TASK-203, TASK-207 to TASK-209 |
| SPKD SPK document | REQ-SPKD-001 to 005, 007, 008 | REQ-SPKD-006 (P1) | AC-SPKD-008, AC-MOB-001 (step 7) | BR-10, DEC-33 | 9.6, 9.10 (placement_map_snapshots) | FLW-PLN-07 | TASK-212 |

## 3. R1 step 3 — Stock step, Part Purchase, parts inventory

| Area | P0 requirements | Deferred | Acceptance criteria | Rules and machines | Data (§9) | Flows | Tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| INV parts inventory (high) | REQ-INV-001 to 011, 013 | REQ-INV-012 (P1) | AC-INV-001 to 006 | BR-06, BR-12, SM-GR, SM-SA, TX-06, TX-07 | 9.8 | FLW-WHM-03 to 05, FLW-APR-04, FLW-SA-08 | TASK-301 to TASK-305, TASK-310 to TASK-312 |
| STK Stock step (high) | REQ-STK-001 to 004, 008, 009, 011 (STK-006 in step 5) | — | AC-STK-001, 003, 005, 006 (AC-STK-004 in step 5) | BR-01, BR-02, BR-06, BR-07, TX-03, TX-05 | 9.7, 9.8 | FLW-WHM-01, 02 | TASK-306 to TASK-308 |
| PUR Part Purchase | REQ-PUR-001 to 004, 006 to 009 (PUR-005 in step 5) | — | AC-PUR-001 to 003, 005, 006 (AC-PUR-004 in step 5) | BR-06, TX-21, DEC-60 to 64 | 9.7 | FLW-FC-05 | TASK-307, TASK-309 |
| Cancelled-SPK receipt | REQ-SPK-008 (receipt part), AC-SPK-004 (stock part) | — | AC-SPK-004 | T15, TX-14 | 9.8 | FLW-WHM-10, FLW-APR-05 | TASK-308, TASK-313 |

## 4. R1 step 4 — Mechanic Action, Part Check, Mobilisasi (server and web)

Part Check and Mobilisasi are placed here by DEC-99 (server and web); their phone screens come in step 7.

| Area | P0 requirements | Deferred | Acceptance criteria | Rules and machines | Data (§9) | Flows | Tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| MEC Mechanic Action | REQ-MEC-001 to 005, 010 | REQ-MEC-006 (P1) | AC-MEC-001 to 005 | BR-07 | 9.7 (spk_services), 9.5 (service_catalog, stooring_rates) | FLW-MEC-01, 02 | TASK-401, TASK-402 |
| CHK Part Check | REQ-CHK-001 to 007 | — | AC-CHK-001 to 004 | BR-03, BR-07, DEC-88, DEC-89 | 9.6 (spk_check_items) | FLW-MEC-08, FLW-PLN-10 | TASK-403, TASK-404 |
| MBL Mobilisasi (high) | REQ-MBL-001 to 006 (phone parts in step 7) | — | AC-MBL-001 to 004 | SM-STEP module contract, RSK-09, DEC-90 | 9.6 (mobilisation_location_trail) | FLW-MEC-09 | TASK-405, TASK-406, TASK-708 |

## 5. R1 step 5 — tyres, Part Replacement and map, baseline, part age

| Area | P0 requirements | Deferred | Acceptance criteria | Rules and machines | Data (§9) | Flows | Tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TYR tyres and retread | REQ-TYR-001 to 013 | REQ-TYR-014, 015 (P1) | AC-TYR-001 to 007 | BR-11, BR-12, SM-TYRE, SM-TR, SM-RD, SM-TC, TX-08, TX-10 | 9.9 | FLW-WHM-06 to 09 | TASK-501 to TASK-506 |
| STK / PUR tyre lines | REQ-STK-006, REQ-PUR-005 | — | AC-STK-004 | BR-11 | 9.7, 9.9 | FLW-WHM-01, FLW-FC-05 | TASK-507 |
| PLC Part Replacement and map (high) | REQ-PLC-001 to 012, 014 | — | AC-PLC-001 to 006, 008, 009 | BR-01, BR-11, TX-09, TX-17, DEC-95 | 9.10 | FLW-MEC-03 | TASK-508, TASK-509 |
| BSL baseline and part age | REQ-BSL-001 to 007, 009; REQ-APR-009 to 011 | — | AC-BSL-001 to 005, AC-APR-005, AC-PUR-004 | BR-01, TX-11, TX-13 | 9.5 (part_item_types, vehicle_part_items, early_failure_events) | FLW-SA-01, 03, FLW-APR-08 | TASK-510 to TASK-513 |

## 6. R1 step 6 — documents, PM, odometer, change requests, schedule, dashboards, notifications, requests, import

| Area | P0 requirements | Deferred | Acceptance criteria | Rules and machines | Data (§9) | Flows | Tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DOC documents and renewal | REQ-DOC-003 to 012 | — | AC-DOC-001 to 006 | BR-08, SM-DOC, TX-15, TX-16 | 9.4 | FLW-SA-02, FLW-DRV-04 | TASK-601 to TASK-603 |
| VEH status, odometer, history, driver | REQ-VEH-005 to 008, 010; REQ-SPK-009 | — | AC-VEH-001, 002, 004 | BR-08, BR-09, SM-VEH (incl. OFF, DEC-92) | 9.3 | FLW-SA-03, FLW-SA-10 | TASK-604 to TASK-606 |
| PM alerts and inspections | REQ-PM-001 to 004, 006 to 010; REQ-SPK-003, 012 | — | AC-PM-001 to 005 | TX-16, DEC-70, DEC-86 | 9.5 | FLW-PLN-02, FLW-SA-04 | TASK-607 to TASK-609 |
| Report Breakdown | REQ-BRK-001 to 009; REQ-SPK-003 | — | AC-BRK-001 to 009 | RL-6, SM-BRK, TX-23, TX-24, DEC-91, DEC-109 | 9.5, 9.6 | FLW-PLN-11, FLW-FC-04, FLW-MEC-10, FLW-MEC-11, FLW-SA-04 | TASK-609, TASK-610, TASK-706, TASK-713 |
| CR change request and amendment | REQ-CR-001 to 008 | — | AC-CR-001 to 005 | SM-CR, SM-SPK T8 to T10, TX-12, DEC-72 | 9.6 (spk_change_requests) | FLW-MEC-05, FLW-PLN-06, FLW-APR-02 | TASK-611 |
| SCH schedule | REQ-SCH-001 to 007 | — | AC-SCH-001 to 005 | BR-13, SM-SCH, DEC-92 | 9.11 | FLW-PLN-04, FLW-FC-02, FLW-APR-09 | TASK-612, TASK-613 |
| NTF notifications (in-app) | REQ-NTF-001, 005 | REQ-NTF-002 for other roles, 003 (P1); 004 (P2) | AC-SCH-001 | §8.3 outbox | 9.12 | FLW-FC-02 | TASK-130 |
| DSH dashboards | REQ-DSH-001 to 006, 008 | REQ-DSH-007, 010 (P1) | — (4.16 has none) | DEC-93 | views (§8.3) | first step of every flow | TASK-615 |
| Bulk import | REQ-IAM-011, REQ-DOC-013, REQ-BSL-008 | — | AC-IAM-007 | DEC-75 | per target table | FLW-SA-08 | TASK-616 |

## 7. R1 step 7 — invoices, mobile app, push (after steps 1 to 6 pass, DEC-41)

| Area | P0 requirements | Deferred | Acceptance criteria | Rules and machines | Data (§9) | Flows | Tasks |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BIL customers and invoices | REQ-BIL-001 to 010, 012; REQ-DSH-009 | REQ-BIL-011 (P2) | AC-BIL-001 to 005 | BR-15, BR-16, SM-INV, TX-19, NFR-16, DEC-42 to 50, DEC-92 | 9.14 | FLW-ACC-01 to 03, FLW-APR-09 | TASK-701 to TASK-703 |
| MOB mobile app (high) | REQ-MOB-001 to 003, 006, 008 to 010; REQ-SPKD-005 | REQ-MOB-005, 007 (P1, Supervisor/GM) | AC-MOB-001, 003, 005 | BR-01, BR-02, RL-6, NFR-18, DEC-98 | as web | FLW-DRV-01 to 04, FLW-FC-03, FLW-SA-07, FLW-MEC-06 | TASK-704 to TASK-708, TASK-712, TASK-713 |
| FUP on the phone | REQ-FUP-013 (phone), REQ-FUP-012, 014 | REQ-FUP-011, 015 (P1) | AC-FUP-007 | NFR-06 | 9.12 | FLW-DRV-01 | TASK-705 |
| MBL and CHK on the phone | REQ-MBL-003 to 005 (phone), REQ-CHK-002 (phone) | — | AC-MBL-002, 003 (phone) | RSK-09, DEC-98, DEC-99 | 9.6 | FLW-MEC-09, FLW-MEC-06, FLW-SA-07 | TASK-708, TASK-712 |
| NTF push for Driver, FC, Mechanic, System Admin | REQ-NTF-002 (those roles) | other roles (P1) | — | DEC-27, DEC-41, DEC-98 | 9.12 (push_devices) | FLW-FC-03 | TASK-709 |
| Go-live readiness | §10 go-live steps, NFR-17 restore test | — | — | DEC-55 to 57 | — | FLW-SA-08 | TASK-710, TASK-711 |

## 8. Deferred (Release 2 and later) — not built in Release 1

| Release | IDs |
| --- | --- |
| Release 2 (P1) | REQ-MOB-005, 007 (Supervisor/GM menu); REQ-NTF-002 (Supervisor, GM and the web-only roles), 003; REQ-RPT-001 to 005; REQ-AI-001 to 004; REQ-VEH-009; REQ-ENG-009; REQ-SPKD-006; REQ-MEC-006; REQ-INV-012; REQ-TYR-014, 015; REQ-PLC-015, 016; REQ-APR-008; REQ-DSH-007, 010; REQ-FUP-011, 015; iOS build (DEC-66) |
| Later (P2) | REQ-NTF-004, REQ-BIL-011; parallel steps; mechanic shift schedule |

## 9. NFR coverage

| NFR | Proven by | Tasks |
| --- | --- | --- |
| NFR-01 atomic, idempotent writes | integration tests per TX, retry tests | TASK-009, every TX task |
| NFR-02 audit | audit writer + per-area assertions | TASK-110, every state-changing task |
| NFR-03 optimistic lock | `version` conflict tests | TASK-009, TASK-121, TASK-306, TASK-508 |
| NFR-04 security | guard decorator, Zod validation, parameterized queries, secrets | TASK-105, TASK-008 (scan), security review per step |
| NFR-05 sign-in | auth tests | TASK-104 |
| NFR-06, NFR-13 files | upload pipeline and storage contract tests | TASK-113 to TASK-115, TASK-705 |
| NFR-07 soft delete | migration conventions, TX-18 | TASK-009 |
| NFR-08 tables | shared table component | TASK-126 |
| NFR-09, NFR-14 format and time | shared format helpers, WIB tests | TASK-101 |
| NFR-10 usability | artboard comparison (`ecc:browser-qa`), a11y checks | every screen task |
| NFR-11 extensibility | adapters, registry contract tests | TASK-113, TASK-203 |
| NFR-12 jobs | idempotent job framework | TASK-312, TASK-602, TASK-613 |
| NFR-15 numbering | numbering config and sequences | TASK-101, TASK-121, TASK-703 |
| NFR-16 money | decimal helpers | TASK-101, TASK-702 |
| NFR-17 backup and retention | restore test, monthly audit archive job | TASK-110 (archive job), TASK-711 |
| NFR-18 platforms | mobile spike, APK build | TASK-127, TASK-710 |
| NFR-19 capacity | `ecc:benchmark` at 3× load before go-live | TASK-711 |
