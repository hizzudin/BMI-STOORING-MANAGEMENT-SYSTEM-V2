# TASK-117 @bmi/chassis-map library with snapshot tests for every launch and generated layout

Drives REQ-PLC-008 and REQ-PLC-010 (screens in TASK-116, TASK-508, TASK-509). Rules: DEC-07, DEC-73, DEC-119. Acceptance touched: AC-PLC-007, AC-PLC-009, AC-PLC-010 (positions and drawing; the screens that save and show them are later tasks).

## Spec first (DEC-119, PRD v2.30)

The artboards numbered the positions P1 to P10, T1 to T8 and S1, S2, while AC-PLC-007 names them A1_LO to A3_RO and SP1; the PRD gave no look for the Missing status and no meaning for an axle's spacing. Owner decisions: the map shows the PRD codes (A1_L, A2_LO, SP1), written upright in a wheel; Missing is grey with a solid dark outline and a "?"; each axle after the first is Close or Wide. The 14 map artboards were recoded from their drawing (axle rows by position, left to right), the legends list Missing, the kit draws `.t-miss`, VehicleChassis shows one Missing tyre and ChassisLayouts shows the spacing column. These were committed first, on their own.

## What changed

- Shared: `schemas/chassis-layout.ts`: the definition schema (refuses no axle, a lift role, three tyres per side, negative spares, a spacing on the first axle or none after it) and `generatePositions` / `layoutCounts` (codes, kinds, axle, side, ordinal 1 outer 2 inner, labels; the tyre count includes spares).
- `@bmi/chassis-map`: `chassisGeometry` (pure; measures from the Placement, PlacementTrailer and VehicleChassis artboards), `ChassisMap` (read-only image, or a group of buttons with `onSelect`; click, Enter and Space; `aria-pressed` for the chosen tyre; every tyre's title carries code, label and status; legend), `chassis-map.css` on the web tokens, launch fixtures and the generated set.
- Tests: geometry (116 layouts: one shape per position in order, no overlap, inside the drawing, gaps, front drawing, spares), the component (roles, titles, legend, Missing, keyboard) and one SVG image snapshot per layout.

## How the spec was read

- The fixtures are the launch layouts of DEC-73 as test data; the real layouts are created by the System Admin as data (REQ-PLC-013, TASK-116), so nothing is seeded.
- Image snapshots are standalone SVG files with the map's style sheet: they open as pictures and compare the same on Windows and on the Linux CI, where PNG screenshots would differ by font rendering.
- The phone draws the same geometry with its own renderer when the mobile placement screen is built.

## Evidence

- RED: the shared tests failed before `chassis-layout.ts` existed. The library tests were written before or with their code and first ran after it.
- GREEN: shared 287 tests, 100 %; chassis-map 129 tests (8 geometry, 5 component, 116 image snapshots), 100 % statements, 87 % branches. Types, lint, format, layers, secrets and `check-coverage --tests` clean.
- `qa` against the artboards: the tractor head matches Placement (bumper, single steer, SP1 in the gap, two dual drive axles, fifth wheel between them), the trailer matches PlacementTrailer (front crossbar, kingpin, SP1 and SP2 side by side, two close dual axles), and the 8x4 of AC-PLC-010 draws two close steer axles, a wide gap and two dual drive axles. The "?" of a Missing spare first touched the rim; it moved between the hub and the rim.
