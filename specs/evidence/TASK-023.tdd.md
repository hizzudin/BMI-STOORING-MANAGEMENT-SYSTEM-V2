# TASK-023 Part traceability and performance

Spec and visual task (DEC-112, PRD v2.23). No code yet.

## What the PRD had

- Tyres one by one with every event, vehicle, position, retread and scrap (REQ-TYR-013), and tyre cost per km per tyre, per brand and retread vendor counts (REQ-TYR-014, REQ-RPT-003, both P1).
- Part items: only the current state per vehicle and the early-failure events (REQ-BSL-006, REQ-BSL-009). No history of fittings, no vendor, no repairs, no cost per km or per day.

## What changed

- New area 4.12a PTR: REQ-PTR-001 to 005 (P0, data from go-live) and REQ-PTR-006, 007 (P1, analysis in Release 2); AC-PTR-001 to 006.
- Data: `stock_lots`, `goods_issue_item_lots`, `part_installations`, `part_repairs`, two columns on `spk_services`, one on `service_catalog`, TX-25, TX-26, and lot steps added to TX-03, TX-05, TX-06, TX-07.
- Plan: TASK-315 (lots), TASK-515 (installations and history panel), TASK-516 (repairs and history).
- Artboards: new StockLotPicker, PartItemHistory, ReportsParts; lots on Stock, tyre choice on Mechanic, Applies to on the service catalog, History on the vehicle chassis tab, a Parts tab on every Reports page, retread cycles on the Tyres report.

## Verify

- `node specs/tools/check-coverage.mjs --tests`: Coverage OK.
- 3.194 artboard links checked, none broken.
- In the browser at 1280 px: no page or panel overflows, and no table scrolls inside the changed pages. The segmented choices of urgency, which earlier showed as narrow circles, now use the kit links and fit a 300 px phone.
- The Release 2 example (Rp 12,5 per km) sits in REQ-PTR-006, because the plan keeps no acceptance criterion for a P1 requirement.
