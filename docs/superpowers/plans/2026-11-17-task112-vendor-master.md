# TASK-112 plan: Vendor master

Branch `feat/phase1-task112-vendor-master`. Spec: REQ-INV-014 and DEC-134 (PRD v2.46), following the Document types pattern of DEC-121.

## Goal
- **The System Admin** (`masterdata.manage`) keeps the vendor master on Settings › Vendors:
  - fields: code, name, kind (Supplier, Workshop, Retread or Shop), phone and address;
  - actions: create, edit, deactivate with a confirmation, and activate again;
  - each save writes one audit record.
- **The pick list:** later screens pick from a list of active vendors, by kind.

**Done when:**
- `e2e FLW-SA-09` passes;
- `int "vendors"` passes;
- SettingsVendors matches its artboard.

## Architecture
- **Migration 0012 `vendors`:**
  - the columns of §9: code (unique), name, vendor_type (with its check), phone, address and is_active;
  - plus `id`, `created_at`, `updated_at` and `deleted_at` (SD), as §9.0 adds.
- **Shared (`schemas/vendors.ts`):**
  - `VENDOR_KINDS`;
  - `VendorSchema`;
  - `VendorRequestSchema`: the code is 1 to 20 characters of letters, digits and underscore; the name is required, up to 150; phone up to 30; address up to 500;
  - `VendorUpdateRequestSchema`: without the code;
  - the list response with `allowedActions`;
  - `VendorOptionsResponseSchema`.
- **API (hexagonal):**
  - `ports/vendors.ts`;
  - `core/inventory/vendor-service.ts`:
    - "This code is taken." on a duplicate (case-insensitive);
    - one audit record per create, update, deactivate and activate;
    - entity `vendor`, area Settings in `AREA_OF`;
  - `infra/db/vendor-gateways.ts`.
- **Routes (`VendorsController`):**

  | Route | Needs |
  | --- | --- |
  | `GET /vendors` | `masterdata.manage`; every vendor, the inactive marked |
  | `POST /vendors` | `masterdata.manage` |
  | `PATCH /vendors/:id` | `masterdata.manage` |
  | `POST /vendors/:id/deactivate` | `masterdata.manage` |
  | `POST /vendors/:id/activate` | `masterdata.manage` |
  | `GET /vendors/options?kind=` | any of `masterdata.manage`, `inventory.manage`, `tyre.manage`, `purchase.line`, `mechanic.execute` (the screens that will pick); active vendors only, ordered by name |

- **Web (`/settings/vendors`, `Vendors`), as DocumentTypes:**
  - the head: "Back to Settings" and "New vendor";
  - the table: Vendor, Kind, Phone, with an Inactive pill;
  - the panel: Code (fixed once saved), Vendor, Kind, Phone, Address, and Deactivate or Activate, Discard changes and Save;
  - the leave guard and C-16 as on DocumentTypes;
  - the Settings home card already links here.
- **Trial seed:** three dummy vendors (Supplier, Workshop, Retread).

## Tests (written first, run red)
- **Shared:** the code pattern and the kinds.
- **Integration (`test/integration/inventory/vendors.test.ts`):**
  - REQ-INV-014: create, list, edit (the code is unchanged), a duplicate code refused, deactivate and activate, and one audit record each;
  - a Planner gets 403;
  - options: only active vendors, filtered by kind, for a Warehouse Manager.
- **Web:** the list, the panel, a new vendor, the fixed code, the Deactivate confirmation, Activate.
- **E2E (`vendors-flw-sa-09.spec.ts`):** the System Admin adds a vendor, edits its phone, deactivates it (shown Inactive) and activates it again.

## Review focus
1. **A duplicate code across case.** Owned by the duplicate test.
2. **An inactive vendor offered for picking.** Owned by the options test.
3. **The code changed after it is saved.** Owned by the update test and the fixed field.
4. **A non-System Admin edits vendors.** Owned by the 403 test.
5. **A save without an audit record.** Owned by the audit assertions.

## Out of scope
- The screens that pick a vendor (Goods Receipt, Part Purchase, External workshop service, retread dispatch); each tests its pick list.
- Replacing the `vendor_name` columns of later tables; their own tasks do it.

## Execution
- **Order:** shared, migration and API (RED, then GREEN), `gen:client`, the E2E spec, web (RED, then GREEN), the trial seed, QA, gates, bookkeeping.
