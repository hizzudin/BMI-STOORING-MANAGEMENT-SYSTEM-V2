# TASK-116 Vehicle classes and chassis layouts with position generation

Requirements: REQ-PLC-013, REQ-PLC-017, REQ-PLC-019, REQ-PLC-020. Acceptance: AC-PLC-007, AC-PLC-010. Rules: BR-01, DEC-68, DEC-69, DEC-73, DEC-120. Journey: FLW-SA-05. Tables: vehicle_classes, chassis_layouts, part_positions (§9.3), audit_logs.

## Spec first (DEC-120, PRD v2.32)

Open points the owner decided: a changed layout is saved as the next version and existing vehicles keep theirs; the vehicle count per layout arrives with the vehicles in TASK-119 (its task line now says so); the unit kind does not restrict the layout; the System Admin types the class code. REQ-PLC-013 asks to create classes, which the artboard could not do, and ui.md 7.4 asks for three columns with a live preview: the artboard gained New class, the class fields, the front drawing, per-axle role, tyres per side and spacing selects, remove and add axle, and the live preview with its colour guide, before the code.

## What changed

- Migration 0006 with the three §9.3 tables and their Drizzle definitions (drift test passes).
- Shared: `schemas/vehicle-classes.ts` (unit kinds, class with its layout, list, new class request with code rules, layout version request).
- API: `VehicleClassService` (list, create, new layout version; one audit record each; positions from `generatePositions`), `DrizzleVehicleClassGateway`, routes under `masterdata.manage`, 404 and 409 filter.
- Web: `/settings/chassis-layouts` with `ChassisLayouts` and the live `ChassisMap` preview; `@bmi/chassis-map` is now a web dependency, transpiled by Next, its style sheet loaded in the root layout.
- E2E: `chassis-layouts.spec.ts` (FLW-SA-05 with the AC-PLC-010 8x4 and a second version). FLW-AM-03 now moves the System Admin role back at its end, so later specs keep their System Admin.

## How the spec was read

- REQ-PLC-020 (head and trailer are separate vehicles) holds by the model: a class is one unit; no coupling exists. Vehicles themselves are TASK-119.
- The class code and unit kind do not change on this page (DEC-120); the class name shown for an existing class is read only, since no rename control is specified.
- Saving a new class labels its button "Save class"; an existing class keeps the artboard's "Save as new layout version".

## Evidence

- RED: the shared tests for the class request failed before the schema existed; the integration and web tests were written before their code and first ran after it.
- GREEN: shared 290 tests, 100 %; API 163 tests, 96.3 % statements, including `vehicle-classes.test.ts` 5 (only the System Admin; AC-PLC-007 13 positions; AC-PLC-010 12 positions; a new version keeps the old one and its positions; unique code 409, unknown class 404, bad layout 400) and the drift test; web 99 tests, 90.7 %, including `chassis-layouts.test.ts` 7; e2e 12 of 12. Layers, lint, format, secrets, types and `check-coverage --tests` clean.
- The first full e2e run had a timeout in FLW-AM-01 before its page loaded (passes on rerun) and showed the specs depended on order: FLW-AM-03 left the System Admin role on another account. Fixed by moving it back in that test.
- `qa` at 1440 x 900 against ChassisLayouts with a Tractor head created through the screen on the local database: class row, class field with its version note, front drawing, axle table, Add axle, spares, preview with the guide, Discard and Save as new layout version match. The first look had the editor touching the header and the Remove button cut off; the editor now has space above it and the axle selects fit their cells.
