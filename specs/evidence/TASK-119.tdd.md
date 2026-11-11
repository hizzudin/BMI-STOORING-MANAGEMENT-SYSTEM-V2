# TASK-119 Vehicles

Requirements: REQ-VEH-001 to REQ-VEH-004, REQ-PLC-018. Rules: DEC-17, DEC-122, DEC-123, BR-10, TX-18, NFR-03; also REQ-PLC-013 (DEC-120 Vehicles column) and REQ-DOC-002 (DEC-121 non-compliance count). Journeys: FLW-SA-01 and FLW-SA-03 as far as this task goes. Tables: vehicles (§9.3), audit_logs.

## Spec first (DEC-122 PRD v2.34, DEC-123 PRD v2.35)

Owner decisions:

- `customer_id` stays a plain column until the customers (TASK-701).
- The first documents come with the document entry (TASK-601); ChangeDriver and the drivers come with REQ-VEH-010 (TASK-606).
- The class change rule is built now behind a port. Its open-SPK case is tested in TASK-120 and AC-VEH-003 in TASK-501.
- What a later task builds is hidden, not disabled.
- Fuel type is free text.
- The AddVehicle odometer sets `current_odometer`.
- An edit asks a reason.
- DEC-123: the odometer is read only in VehicleEdit; after AddVehicle it changes by readings under BR-09 (TASK-605).

Artboards changed before the code:

- AddVehicle, VehicleEdit and VehicleDeactivate gained VIN, engine number, brand, model, year, fuel type and the read-only "Axles and tyres".
- The two edit pages gained "Reason for the change" and the read-only odometer.
- ChassisLayouts gained the Vehicles column.
- DocumentTypes gained the non-compliance note.

## What changed

- **Migration:** 0008 (`vehicles`, partial unique plate and VIN, class and layout references RESTRICT) and its Drizzle table; drift and conventions tests pass.
- **Shared:**
  - `schemas/vehicles.ts`: vehicle, list with form classes and page actions, add, edit with reason and version, deactivate with reason, `blankToNull`.
  - `layout.vehicleCount` on vehicle classes; `vehicleCount` on the document type classes.
  - The optional texts carry no transform, so the OpenAPI contract stays JSON Schema.
- **API:**
  - `VehicleService`: one policy table for edit, change_class and deactivate, giving both the check and `allowedActions`, plus the `classLock` sentence.
  - `DrizzleVehicleGateway` updates through `updateWithVersion`.
  - The `VehicleActivityGateway` port (`VEHICLE_ACTIVITY`) uses the `NoVehicleActivityYet` adapter until TASK-120 and TASK-501.
  - Routes under vehicle.view or vehicle.manage; `VehicleErrorFilter`.
  - Each write leaves one audit record, with the reason on update and deactivate.
- **Web:**
  - Pages: `/vehicles` (status tabs), `/vehicles/new`, `/vehicles/:id` (Overview and Chassis and parts, read-only map with every position Missing), and `/vehicles/:id/edit` (reason, class lock note, Deactivate dialog with reason).
  - `PageHead` gained an optional `status` slot, so the pill sits beside the plate.
  - ChassisLayouts gained its Vehicles column; DocumentTypes shows the non-compliance count before Save.
- **E2E:** `vehicles.spec.ts`:
  - FLW-SA-01: add a vehicle; a trailer has no odometer field (AC-PLC-008).
  - FLW-SA-03: an edit with a reason, then a deactivation with a reason.

## How the spec was read

- REQ-VEH-004 "hide it from lists" covers the lists of other areas (alerts, schedule, new SPKs). The Vehicles page keeps its Inactive tab and All shows every vehicle, as on the Vehicles artboard.
- A class change takes the new class's default layout version; without a class change, a vehicle keeps its version (DEC-120). A move to a Towed class sets the odometer to 0 (REQ-PLC-018); the audit record keeps the old value.
- The non-compliance count is the vehicles of each newly ticked class that are not Inactive: no vehicle has a document yet (TASK-601).
- Plate and VIN are unique without regard to case among vehicles that are not soft-deleted (TX-18).

## Evidence

- **RED:**
  - The integration test `fleet/vehicles.test.ts` was written before the port, service, gateway and controller; its first run failed on the audit expectations and on the class count.
  - Drizzle left a one-table subquery unqualified, so the class count compared `vehicles.id`. The subqueries now name their tables.
- **GREEN:**
  - shared: 296 tests, 100 %.
  - API: 179 tests, 96.3 % statements, including `vehicles.test.ts` 9:
    - add with counts and one audit record;
    - unique plate and VIN, and the Planner refused;
    - Towed without odometer, and an unknown class;
    - list for readers and managers, and 404;
    - edit with reason, stale version 409, no reason 400;
    - class change and the DEC-17 lock with its sentence;
    - deactivate refused while an SPK is open, then Inactive with the reason;
    - the layout and class counts;
    - AC-IAM-009.
  - `vehicle-service.spec.ts`: the lock and refusal sentences.
  - web: 121 tests, 88 %, including `vehicles.test.ts` 13 and the count tests of ChassisLayouts and DocumentTypes.
  - chassis-map: 129 tests.
  - e2e: 15 of 15.
  - Layers, lint, types, secrets and `check-coverage --tests` are clean. Format is clean except a local design-hook cache that git does not track.
- **QA** at 1440 x 900 against Vehicles, AddVehicle, VehicleOverview, VehicleEdit, VehicleDeactivate and ChassisLayouts on the local database:
  - Fixed:
    - read-only inputs are grey, as in the kit;
    - the status pill sits beside the plate;
    - the map sits on its grey panel in the wide column;
    - plate links are bold;
    - Odometer is aligned left;
    - the class table of ChassisLayouts fits its column with the Vehicles column (tighter cells and a wider list column; the axle selects keep their text).
  - Kept on purpose:
    - the kit's search box and column filters (NFR-08);
    - the hidden tabs, buttons, columns and cards of DEC-122.
