# Spec history

Decisions, requirements and transactions that no longer apply, and the assumption log. Nothing here is built; every current rule lives in PRD.md and docs/prd/. Kept so old IDs can still be looked up.

## Superseded decisions

| ID | Decision | Applies to |
| --- | --- | --- |
| DEC-25 | Superseded by DEC-41: the driver mobile app is built in R1 step 7; until then the System Admin enters driver data in Vehicles > Inspections | 4.11 |
| DEC-38 | One Stock step can be worked by the Warehouse Manager, the Field Coordinator and the System Admin, and can cut stock and buy parts in the same step | REQ-STK-010 |
| DEC-40 | Superseded by DEC-90: one-time position capture at Mechanic Action submit is removed. The work location is captured once from the Driver's breakdown report and verified through the Mobilisasi step's location trail (REQ-MOB-003, REQ-MBL-005). | REQ-MEC-008 (retired), REQ-MBL-005 |
| DEC-49 | The Field Coordinator never cuts warehouse stock; any of the three Stock roles may submit the step. The WO creator sets each part line to Cut stock or Purchase mode, and Purchase mode raises a purchase alert (superseded by DEC-60) | REQ-STK-010 to 012 |
| DEC-52 | Superseded by DEC-90: the stooring area and location no longer sit on the Mechanic Action step. The Mobilisasi module carries the stooring area (from the breakdown destination) and records the mechanic's location trail for the Planner and System Admin to check | REQ-MEC-007 (retired), REQ-MEC-008 (retired), REQ-MBL-005 |
| DEC-71 | Superseded by DEC-90: the 15-second one-time position capture at Mechanic Action submit is removed with the capture itself; location now comes from the breakdown report and the Mobilisasi location trail | REQ-MEC-008 (retired), REQ-MBL-005 |
| DEC-105 | Superseded by DEC-106 (one entity, one name). SPK and WO are one entity, not two: the rename of DEC-104 changes only the name people read. An agent never adds a second table, ID family, state machine, module, permission code, screen or number series for SPK, and never maps or migrates between the two names. An SPK is one row of work_orders (0.7) | 0.7 |
| DEC-24 | Superseded by DEC-109: a breakdown report drafts an SPK only when it is Urgent. | REQ-BRK-003 |
| DEC-34 | Superseded by DEC-64, then DEC-109: the Field Coordinator (Korlap) created and submitted draft SPKs; there is no separate field admin role, the System Admin covers that work | RL-6 |
| DEC-97 | Superseded by DEC-109: the draft SPK request screen was shared by the Mechanic and the Field Coordinator. Both now share the Report Breakdown form | REQ-BRK-001, FLW-MEC-10 |

## Retired requirements

| ID | P | Requirement | Screens | Data | Rules |
| --- | --- | --- | --- | --- | --- |
| REQ-STK-005 | P0 | Retired (DEC-60): parts bought outside are recorded in the Part Purchase step (REQ-PUR-002 to 006). | [`Stock`](<../../Design Artifact/steps/Stock.html#Stock>), [`PartPurchase`](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | `work_order_parts`, `wo_attachments` | BR-06 |
| REQ-STK-007 | P0 | Retired (DEC-60): a tyre bought outside is recorded in the Part Purchase step (REQ-PUR-005). | [`Stock`](<../../Design Artifact/steps/Stock.html#Stock>), [`PartPurchase`](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | `tyres`, `tyre_attachments` |  |
| REQ-STK-010 | P0 | Retired (DEC-60): the Stock step is executed by the Warehouse Manager or the System Admin and cuts stock only; buying is the Part Purchase step (REQ-PUR-001). | [`Stock`](<../../Design Artifact/steps/Stock.html#Stock>), [`FCMobilePurchase`](<../../Design Artifact/mobile/FCMobilePurchase.html#FCMobilePurchase>) | `work_order_parts.done_by`, `done_at`, `work_order_assignments.executor_roles` | BR-03 |
| REQ-STK-012 | P0 | Retired (DEC-60): there is no Cut stock or Purchase mode per line; the steps built in Create WO decide which steps exist, and the required part list holds only warehouse parts. | [CreateWO](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>), [FCCreateWO](<../../Design Artifact/spk/ReportBreakdownForm.html#ReportBreakdownForm>), [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | work\_order\_parts.- | BR-02 |
| REQ-MEC-007 | P0 | Retired: the stooring area is no longer picked on a Mechanic Action step. The stooring (mobilisation) fee is produced by the Mobilisasi module (`REQ-MBL-*`), which carries the stooring area; a Mechanic Action step neither asks a location nor charges stooring. | [`Mechanic`](<../../Design Artifact/steps/Mechanic.html#Mechanic>), [`MechanicExternal`](<../../Design Artifact/steps/MechanicExternal.html#MechanicExternal>) |  | REQ-MBL-002 |
| REQ-MEC-008 | P0 | Retired: a Mechanic Action step no longer captures the device position at submit. The work location for a field job is captured once from the Driver's breakdown report (`REQ-MOB-003`) and verified through the Mobilisasi step's location trail (`REQ-MBL-005`). | [`MechanicMobileStep`](<../../Design Artifact/mobile/MechanicMobileStep.html#MechanicMobileStep>), [`StepVerify`](<../../Design Artifact/steps/StepVerify.html#StepVerify>) |  | REQ-MBL-005 |
| REQ-MEC-009 | P0 | Retired: a Mechanic Action step no longer charges the stooring (mobilisation) fee. The stooring fee is now produced by the Mobilisasi module (`REQ-MBL-006`); the WO stooring cost and its WO-document and WO-cost lines are unchanged in meaning, only their source step changes. | [WorkOrder](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>), [WODocument](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) | work\_orders.stooring\_cost | REQ-MBL-006, BR-07 |
| REQ-SPK-014 | P0 | Retired (DEC-109): the Requests list of draft SPKs is replaced by the Report Breakdown list (`REQ-BRK-005`). |  |  |  |
| REQ-SPK-016 | P0 | Retired (DEC-109): a Mechanic or Field Coordinator no longer sends a Draft SPK for review; they send a Report Breakdown (`REQ-BRK-001`). The parts-needed list and `spk_part_requests` are removed. |  |  |  |
| REQ-PM-005 | P0 | Retired (DEC-109): breakdown for a driver is now `REQ-BRK-001`. |  |  |  |
| REQ-MOB-004 | P0 | Retired (DEC-109): the Mechanic field finding is now a Report Breakdown (`REQ-BRK-001`). |  |  |  |

## Retired acceptance criteria

| ID | Verified | Acceptance criterion | Why retired |
| --- | --- | --- | --- |
| AC-STK-002 | REQ-STK-005 (retired) | IF an external line has no invoice image, THEN it SHALL be refused; WHEN it has one, it SHALL save and warehouse stock SHALL be unchanged. | DEC-60: the Stock step only cuts warehouse stock; parts bought outside, with their receipt photo, are the Part Purchase step (REQ-PUR-002 to 006, AC-PUR-003) |
| AC-MOB-002 | REQ-MOB-004 (retired) | WHEN a field finding is sent, exactly one Draft SPK SHALL exist and no step SHALL open. | DEC-109: replaced by AC-BRK-001 |
| AC-MOB-004 | REQ-MOB-006 | WHEN a Field Coordinator sends a draft SPK from a driver breakdown on the phone, the SPK SHALL stay Draft, marked Sent for review. | DEC-109: replaced by AC-BRK-005 |

## Retired transactions

| ID | Name | What it writes |
| --- | --- | --- |
| TX-04 | Retired (DEC-60) | Parts supplied by an external workshop are recorded in the Part Purchase step (TX-21). Formerly: write only `work_order_parts` and `wo_attachments` (and, for a tyre, a new `tyres` row with source External\_Workshop, status Issued, plus `tyre_attachments`); never touch `parts_catalog`, `goods_issues` or `stock_cards`. |

## Assumptions \[A\] (all confirmed, DEC-58)

| ID | Assumption built into this spec | Where | Question for the product owner |
| --- | --- | --- | --- |
| ASM-01 | PostgreSQL syntax for the schema | 9 | Confirmed (DEC-58). |
| ASM-02 | Part Replacement and the map cover tyres only; other parts are tracked as part items | 4.6 | Confirmed (DEC-58). |
| ASM-03 | Map position statuses Normal, Due soon, Act now, Empty, Missing, from km and days since fitting, tread and pressure | REQ-PLC-008 | Confirmed (DEC-58). |
| ASM-04 | Decided: a map snapshot is saved at step submit, shown in colour in the system and printed in the WO document as a black-and-white line drawing with a table of changed positions (DEC-33) | REQ-PLC-014 | Decided. |
| ASM-05 | An optional step can be skipped with a reason and Approver consent (P1) | REQ-ENG-009 | Confirmed (DEC-58). |
| ASM-06 | A step returned while the WO is Pending\_Verification puts the WO back to In\_Progress | SM-WO T12 | Confirmed (DEC-58). |
| ASM-07 | No change request while the WO is Pending\_Verification | REQ-CR-007 | Confirmed (DEC-58). |
| ASM-08 | Vehicle status precedence: Inactive, OFF, Blocked, Repair, Active (OFF inserted at precedence 2 by DEC-92) | SM-VEH | Confirmed (DEC-58); OFF added by DEC-92. |
| ASM-09 | A rejected completion keeps the WO in Pending\_Verification | SM-WO T14 | Confirmed (DEC-58). |
| ASM-10 | An Issued tyre returns to In\_Stock when its WO is cancelled or completed without mounting it | SM-TYRE | Confirmed (DEC-58). |
| ASM-11 | A tyre bought by an external workshop is recorded as a new tyre, Issued to the WO (now in the Part Purchase step, DEC-60) | REQ-STK-007 | Confirmed (DEC-58). |
| ASM-12 | The serial number is unique per brand, not across all tyres | REQ-TYR-002 | Confirmed (DEC-58). |
| ASM-13 | Demount offers Needs\_Retread, Worn\_Out or Back to stock; a Worn\_Out tyre cannot go to retread; a retread dispatch needs no approval | 4.14 | Confirmed (DEC-58). |
| ASM-14 | Tyre statuses are master data that the System Admin can extend | REQ-TYR-003 | Confirmed (DEC-58). |
| ASM-15 | A part item without a baseline shows Missing and raises no alert | REQ-BSL-004 | Confirmed (DEC-58). |
| ASM-16 | A completed WO resets every part item linked to its lines through the service or part catalog | REQ-BSL-006 | Confirmed (DEC-58). |
| ASM-17 | A renewal receipt image is required by default, set per document type | REQ-DOC-007 | Confirmed (DEC-58). |
| ASM-18 | The Access Manager can edit the permission matrix (`role_permissions`), except locked cells | REQ-IAM-005 | Confirmed (DEC-58). |
| ASM-19 | The audit log is visible to Access Managers and the System Admin | REQ-IAM-007 | Confirmed (DEC-58). |
| ASM-20 | 5 failed sign-ins lock an account for 15 minutes | REQ-IAM-001 | Decided (DEC-55). |
| ASM-21 | Files are limited to 10 MB each | NFR-06 | Confirmed (DEC-58). |
| ASM-22 | Reports are visible to Supervisor, GM, Planner and System Admin; the Warehouse Manager sees only the Inventory tab | REQ-RPT-004 | Confirmed (DEC-58). |
| ASM-23 | Low stock per tyre size, the overdue retread alert and the Inventory report contents | REQ-TYR-015, REQ-RPT-003 | Confirmed (DEC-58). |
| ASM-24 | Approvers get a reminder when an item waits longer than a set time (P1) | REQ-APR-008 | Confirmed (DEC-58). |
| ASM-25 | The Planner and System Admin record manual odometer readings; the person who entered a reading can request its void | REQ-VEH-006, REQ-VEH-007 | Confirmed (DEC-58). |
| ASM-26 | Forms are full pages; WO cards are dragged directly on the schedule | NAV-4 | Confirmed (DEC-58). |
| ASM-27 | Cancelling a WO reverses its posted issues without a separate verification | TX-14 | Confirmed (DEC-58). |
| ASM-28 | Cloudflare R2 is the first storage provider: US$0,015 per GB-month, 10 GB free, no egress fee | NFR-13 | Confirmed (DEC-58). |
| ASM-29 | Uploaded images are compressed (1600 px, about 80% quality) and the original is not kept | NFR-06 | Confirmed (DEC-58). |
| ASM-30 | Files older than 12 months move to Infrequent Access; storage budget 50 GB with an alert at 80% | NFR-13 | Confirmed (DEC-58). |
| ASM-31 | GPS and every EXIF field except capture time are removed from photos | 8.1 | Confirmed (DEC-58). |
| ASM-32 | Limits: PDF at most 20 pages; a step holds at most 10 photos and 5 documents; signed links expire after 5 minutes | REQ-FUP-002, REQ-FUP-010 | Confirmed (DEC-58). |
| ASM-33 | Seamless upload: images up to 30 MB are accepted and compressed without a message; Submit waits for uploads and sends by itself; 3 silent retries before the user is asked | 8.1 | Confirmed (DEC-58). |
| ASM-34 | One invoice per vehicle per day (not one per customer per day with several vehicles) | REQ-BIL-002 | Decided: per vehicle per day (DEC-43). |
| ASM-35 | Invoice lines are parts and services (DEC-44); tyres count as parts with the markup; document renewal costs are billed at cost; lines are never merged | REQ-BIL-003 | Decided (DEC-50). |
| ASM-36 | PPN 11% from Settings, can be set to 0 | REQ-BIL-004 | Decided: PPN 11% (DEC-45). |
| ASM-37 | Invoices need no approval; Draft, Issued, Paid, Void; full payment only in R1; no email in R1; the running number of the invoice number never resets | REQ-BIL-005, REQ-BIL-006 | Decided (DEC-46, DEC-50). |
| ASM-38 | Early-failure tolerance 80% of normal life per part item type | REQ-BSL-009 | Decided: the Planner adjusts it in Settings (DEC-47); 80% is only the starting value. |
| ASM-39 | GM extra data: all report tabs including Cost, fleet-wide cost cards, early-failure report, audit log; the Supervisor sees no Cost tab | RL-8 | Decided. |
| ASM-40 | Planner approval covers the kinds the Access Manager ticks (DEC-48), with an optional end time | RL-7 | Decided (DEC-48). |
| ASM-41 | The Field Coordinator records Purchase lines but never issues warehouse stock; any of the three roles may submit the step | REQ-STK-010 | Decided (DEC-49); superseded by DEC-60. |
| ASM-42 | The interface says "WO"; "SPK" is listed in the glossary as the same thing | 1.5 | Decided: the interface says WO. |
| ASM-43 | Push notifications are P0 for the R1 mobile roles | REQ-NTF-002 | Confirmed (DEC-58). |
| ASM-44 | A position is required for every submit, on the phone and on the web | REQ-MEC-008 | Decided (DEC-53). |
| ASM-45 | One stooring fee per WO per region per day, even when several steps are done there | REQ-MEC-009 | Decided (DEC-53). |
| ASM-46 | Stooring is billed to the customer at cost, without markup | REQ-BIL-003 | Decided (DEC-53). |
| ASM-47 | Opening balance entered by the System Admin in Setup mode, no approval | REQ-INV-013 | Decided (DEC-55). |
| ASM-48 | Priorities Low, Normal, High, Urgent without deadlines; Urgent notifies every Approver at once | REQ-WO-015 | Decided (DEC-55). |
| ASM-49 | Temporary password from the Access Manager, no email reset; web session 30 minutes idle, mobile 30 days | REQ-IAM-009, NFR-05 | Decided (DEC-55). |
| ASM-50 | Mobile drafts are kept offline but Submit needs a connection | REQ-MOB-009 | Decided (DEC-55). |
| ASM-51 | No branches | RL-10 | Decided (DEC-55). |
| ASM-52 | WIB everywhere; daily job at 00:30 | NFR-14 | Decided (DEC-55). |
| ASM-53 | Number formats of NFR-15 | NFR-15 | Decided: keep for now; editable later (DEC-55). |
| ASM-54 | Rounding half up to a whole rupiah per unit price and on PPN | NFR-16 | Decided (DEC-55). |
| ASM-55 | Daily backup and audit logs kept 1 year | NFR-17 | Decided (DEC-55). |
| ASM-56 | Setup mode before go-live, then normal operation | 10 | Decided (DEC-55). |
| ASM-57 | A vendor not in the master can be typed as Other | REQ-PUR-004 | Decided (DEC-62): choose from the master or type by hand. |
| ASM-58 | No receipt total field or match check; the buyer checks the lines against the receipt by eye | REQ-PUR-003 | Decided (DEC-61). |
| ASM-59 | A confirmed shortfall adds a Part Purchase step right after the Stock step | REQ-PUR-008 | Confirmed (DEC-62). |
| ASM-60 | Parts bought outside are picked from the catalog and reset part items and early failure like issued parts | REQ-PUR-009 | Decided (DEC-62). |
| ASM-61 | Which parts a WO uses is designed by the Planner or System Admin; a part not yet in the catalog is added to the catalog before it is put on the WO | REQ-PUR-002 | Decided (DEC-63). |
| ASM-62 | The buyer types the quantity after buying and may buy more than the shortfall | REQ-PUR-002 | Decided (DEC-64). |
| ASM-63 | Files are on Cloudflare R2 (DEC-32); the API server, workers, PostgreSQL and Redis run on a cloud provider chosen by the internal developers, in a region close to Indonesia | 8.2 | Decided (DEC-67). |
| ASM-64 | Bulk import is available only in Setup mode, and classes, layouts, document types, part item types and PM packages are entered in their screens | REQ-IAM-011 | Decided: Setup mode only. Bulk import is not available after go-live; post-launch records are added through their own screens. |


## Change history

v2.24 (2026-11-09) adds DEC-113, product owner decision: trial first. Phase 1 is reordered so a local trial with dummy data (TASK-131, ADR-0003) comes as early as the task dependencies allow. No requirement changes.

v2.23 (2026-11-09) adds DEC-112 and area PTR, product owner decision: stock lots so an issued part keeps its vendor and price, part installations for every part item fitting, repairs from verified Mechanic Action services and tyre services, a part item history panel, and in Release 2 a Parts report and retread vendor analysis per retread cycle, by cost per km and per day. New: `stock_lots`, `goods_issue_item_lots`, `part_installations`, `part_repairs`, TX-25, TX-26, three screens. Existing tyre cost per km (REQ-TYR-014, REQ-RPT-003) is kept and extended.

v2.22 (2026-11-06) adds DEC-111, product owner decision after the TASK-101 review: SPK source `Part_Item_Alert`, column `spk_change_requests.cr_number`, an OB number in `sa_number` for an opening balance, one database sequence per running code, and the formats stored as the setting `numbering_formats`, checked before use.

v2.21 (2026-11-05) adds DEC-110, product owner decision: CR, GR, GRC, GI, SA, OB, TR, RD, TC and tyre codes TY follow the pattern of SPK and RB, CODE-yymmddNNNN. Each code has its own running number, which never resets. Customer invoices keep NNNN/BMI/dd-mm-yy (DEC-46). Sample numbers in the spec and artboards are updated.

v2.20 (2026-11-05) adds DEC-109, product owner decision: the field sends a Report Breakdown, which is not an SPK. Draft SPKs come automatically only from system alerts, a verified Part Check and an Urgent breakdown report (with one Mobilisasi step); the Planner drafts every other SPK with the report as its reference, shown as "Report reference: RB-yymmddNNNN" in the description. An Urgent breakdown report from a Driver, or entered for one, shows every Planner a blocking pop-up until one presses Create SPK. An inspection Fail, now also by a Mechanic, raises a report. New: area BRK, SM-BRK, TX-23, TX-24, `breakdown_report_photos`, numbering RB-yymmddNNNN. Removed: REQ-SPK-014, REQ-SPK-016, REQ-PM-005, REQ-MOB-004, `spk_part_requests`, `sent_for_review_at`, `spks.dvir_log_id`, the sources Driver\_DVIR, Driver\_Breakdown, Manual\_Mechanic and Manual\_Field\_Coordinator, and the Inspection fail, Breakdown and Field report alert rules. Screens: FCRequests is BreakdownReports, FCCreateSPK is ReportBreakdownForm, FCDraftCancel is RejectReport, FCMobileRequests is MobileReports, DriverBreakdown is MobileReportBreakdown (also replacing MechanicMobileFieldReport and FCMobileCreateSPK), DriverInspection is MobileInspection; new CreateSPKFromReport and UrgentReportPopup. Assumption [A]: the pop-up arrives within 30 seconds.

v2.19 (2026-11-04) adds DEC-108: the table `idempotency_keys` (9.12) and TX-22 give NFR-01 its store; the daily job (TX-16) removes rows older than 30 days [A]. Product owner decision.

v2.18 (2026-11-04) adds DEC-107: the design artifact moves from 61 module files, which held several screens each, to one page per screen. The dialogs, panels and states that the action map named without an artboard get their pages and join the inventory (7.3). Tab names follow REQ-SPK-010 and 7.4 (SPK list, Inventory, Invoices, Reports). All artboard links in the spec point at the new pages. No requirement, table or rule changes.

v2.17 (2026-11-04) adds DEC-106: one entity, one name. The former name is replaced everywhere, also in IDs, tables, permission codes, artboards, files and code; 0.7 is rewritten; DEC-105 is superseded. Entries below this one and the retired items keep the old words as written at the time; this table translates them.

| Former | Now |
| --- | --- |
| Work Order, WO | Surat Perintah Kerja, SPK |
| REQ-WO-*, AC-WO-*, SM-WO, area WO | REQ-SPK-*, AC-SPK-*, SM-SPK, area SPK |
| REQ-WOD-*, AC-WOD-*, area WOD | REQ-SPKD-*, AC-SPKD-*, area SPKD |
| work_orders, work_order_*, wo_*, *_wo_id | spks, spk_*, spk_*, *_spk_id |
| wo.* | spk.* |
| CreateWO, WOList, WorkOrder, WODocument, CancelWO, WOPresets | CreateSPK, SPKList, SPKDetail, SPKDocument, CancelSPK, SPKPresets |
| work-orders/, 4.1-wo.md, 4.9-wod.md | spk/, 4.1-spk.md, 4.9-spkd.md |

v2.16 (2026-11-04) adds 0.7 and DEC-105: SPK and the former Work Order are one entity with two names, with a table of which name appears where. No rule or data changes.

v2.15 (2026-11-04) adds DEC-104: Work Order is renamed Surat Perintah Kerja (SPK) in the spec, DESIGN.md, PRODUCT.md, README and every artboard, and the number becomes SPK-yymmddNNNN (NFR-15, `wo_number_seq` in 9.6; the running part never resets). Requirement IDs, tables, permission codes and artboard names keep WO. Entries below this one and the retired items of this file keep the old name as written at the time.

v2.14 (2026-11-03) adds the product owner's answers OQ-7 to OQ-9: DEC-101 (a Rejected WO can be cancelled by its creator, T6; DQ-06 corrected), DEC-102 (password reset email through an email adapter, the only email in Release 1; 1.4 and Q-03 updated), DEC-103 (DashboardAdmin integration rows are status only in Release 1; DQ-05 updated).

v2.13 (2026-11-03) is editorial only: the screen inventory (7.3) now lists the two artboards it lacked, `Mobilisasi` (the web step view, REQ-MBL-002 to 006) and `ScheduleMonth` (the month view of REQ-SCH-002), found by the coverage check of specs/tools. No rule changes.

v2.12 (2026-11-03) adds DEC-100: MobileProfile is P0 in Release 1 (every R1 mobile menu has Profile); its push mute settings (REQ-NTF-003) stay P1.

v2.11 (2026-11-03) adds the product owner's answers to the plan review: DEC-97 (one draft WO request screen, FCCreateWO, for the Mechanic and the Field Coordinator; FLW-MEC-10), DEC-98 (the Mechanic mobile menu moves to Release 1, R1 step 7; REQ-MOB-004 and REQ-MOB-010 become P0; push for the Mechanic; supersedes the Mechanic part of DEC-41) and DEC-99 (Part Check and Mobilisasi placed in R1 step 4 for server and web, phone screens in step 7); §10 release rows, 2.1, 4.19, 4.20, 7.3 screen priorities and flows 6.2 follow them. TX-16 now names the DEC-92 roll-forward, late alerts and the OFF-day count (editorial).

v2.10 (2026-11-03) is editorial only: flows 6.8e added for requirements that had no flow: FLW-MEC-07 step time (REQ-ENG-012 to 016), FLW-MEC-08 Part Check and FLW-PLN-10 its follow-up WO (REQ-CHK-001 to 007), FLW-MEC-09 Mobilisasi (REQ-MBL-001 to 006), FLW-APR-09 a WO that overruns its planned day, OFF and the OFF-unit cost (DEC-92); the traceability matrix links them. No rule changes.

v2.9 (2026-11-03) is editorial only: flows (6) brought in line with the decisions already in force: Start before editing a step and no Start for Part Replacement (DEC-87, DEC-95), automatic schedule roll-forward (DEC-92), Part Purchase lines from the WO's part list only (DEC-62, DEC-63), a breakdown draft pre-seeded with one Mobilisasi step and stooring moved off Mechanic Action (DEC-90, DEC-91). AC-STK-002 retired with REQ-STK-005; AC-STK-006 now verifies REQ-STK-004 and REQ-PUR-008 instead of the retired REQ-STK-010; AC-REG-002 reworded for WOs and presets (DEC-85); the traceability matrix (12) gets the missing AC ranges and a Part Check row. No rule changes.

v2.8 (2026-11-03) adds DEC-96: the design artifact is the visual target of the end product (0.1, 0.6, 7.1, 7.7); visual style is no longer free at implementation.

v2.7 (2026-11-03) adds DEC-95: `assignment_modules.tracks_work_time`; Part Replacement steps have no Start or Pause and no work time (REQ-ENG-017, AC-ENG-010, SM-STEP row).

v2.6 (2026-11-03) adds DEC-94: design artifacts organised by module (52 files, every old artboard name kept as an anchor, 1.419 links rewritten) and the round floating-rail shell; DESIGN.md updated to match. No behaviour rule changes.

v2.5 (2026-11-03) is editorial only: the single PRD.md is split into the core PRD.md and docs/prd/ (one file per functional area of 4 plus 8.1, flows, UI, action map, data model, traceability, history), with the same section numbers and IDs; fully superseded decisions (DEC-25, DEC-38, DEC-40, DEC-49, DEC-52, DEC-71), retired requirements (REQ-STK-005/007/010/012, REQ-MEC-007/008/009), the retired TX-04 and the assumption log move here. No rule changes.

v2.4 (2026-11-03) adds DEC-93: the three permission layers, the effective capability set, the permission catalogue and menu table (2.4), `GET /me` and `allowedActions` (REQ-IAM-012 to 014, AC-IAM-008 to 010), NAV-9, three new 2.2 rows and the stored Planner approval kinds; no table or column of 9 changes. v2.3 (2026-10-27) adds DEC-59 and DEC-60: step draft on reassignment, and the Part Purchase module (4.4a) split from the Stock step; new assumptions ASM-57 to ASM-60. v2.2 (2026-10-27) adds DEC-43 to DEC-58: invoice lines, markup, numbering and stooring; silent position capture; Setup mode and Go live; opening balance; priorities and late alerts; passwords, offline, time, numbering, rounding and retention rules; no branches; vendor master, driver assignment and step assignment; every earlier assumption confirmed. v2.1 (2026-10-27) applies the meeting decisions DEC-34 to DEC-42: Accounting role and invoices (4.23), Field Coordinator draft WOs and purchase lines, Planner approval switch, GM as director, part age and early failure, mixed Stock step, GPS work location, mobile app for Driver, Field Coordinator and System Admin in R1 step 7; new assumptions ASM-34 to ASM-43. v2 (2026-10-26) restructures the earlier PRD for SDD agents: IDs on every requirement, EARS acceptance criteria, state machines, a consolidated schema (the earlier A.1 to A.14 with every ALTER applied), traceability to screens and tables, and all "added in October" and "Decided" items merged into their sections. Behaviour is unchanged except where 11.2 marks a new assumption (ASM-06, ASM-08, ASM-21, ASM-27) or 9 normalizes a structure (`document_type_classes`, `role_permissions`, `maintenance_alerts.alert_type`).
