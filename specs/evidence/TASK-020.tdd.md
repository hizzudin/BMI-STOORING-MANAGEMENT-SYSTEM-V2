# TASK-020 Report Breakdown replaces the field draft SPK

Spec and visual task (DEC-109, PRD v2.20). No code existed for this behaviour.

## What changed

- The field sends a Report Breakdown, which is not an SPK: new area `docs/prd/areas/4.11a-brk.md`, REQ-BRK-001 to 009, AC-BRK-001 to 009.
- Draft SPKs come automatically only from alerts, a verified Part Check and an Urgent breakdown report (REQ-SPK-003, REQ-BRK-003).
- New state machine SM-BRK, TX-23, TX-24, table `breakdown_report_photos`, numbering RB-yymmddNNNN.
- Removed: REQ-SPK-014, REQ-SPK-016, REQ-PM-005, REQ-MOB-004, AC-MOB-002, AC-MOB-004, `spk_part_requests`, `sent_for_review_at`, `spks.dvir_log_id`, four SPK sources and three alert rules. All are in `docs/prd/history.md`.
- Screens: BreakdownReports, ReportBreakdownForm, RejectReport, MobileReports, MobileReportBreakdown and MobileInspection replace the former pages; CreateSPKFromReport and UrgentReportPopup are new.

## Verify

- `node specs/tools/check-coverage.mjs --tests`: Coverage OK.
- Every artboard link in the artifact and the spec resolves.
- The changed pages were opened in the browser and read against the spec.
