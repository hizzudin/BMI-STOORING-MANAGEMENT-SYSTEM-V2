# TASK-112 Vendor master

- **Requirement:** REQ-INV-014.
- **Decision:** DEC-134 (PRD v2.46, commit 5ca7845).
- **Rules:** C-16, C-17, C-31, C-32, DEC-121 (the master pattern).
- **Journey:** FLW-SA-09.
- **Tables:** vendors (new, migration 0012), audit_logs.

## Spec first (DEC-134, PRD v2.46, commit 5ca7845)

The owner decided before any code:
- **The form:** every field of REQ-INV-014, with the code typed, unique and fixed once saved, as DEC-121. The artboard gained Code, Phone and Address.
- **Access:** the page is the System Admin's only (`masterdata.manage`, 2.2); the artboard's Planner viewer was removed.
- **Inactive vendors:** a deactivated vendor stays listed, marked Inactive, and can be activated again.
- **The pick list:** TASK-112 gives the list of active vendors by kind. That each later screen picks from it is tested by the task that builds that screen; the journey test was split for this.

The plan is `docs/superpowers/plans/2026-11-17-task112-vendor-master.md`; the owner approved it ("Ya, setujui").

## What changed
- **Migration 0012:** `vendors` (§9.7 with the §9.0 columns; SD).
- **Shared:** `schemas/vendors.ts`.
- **API:**
  - `ports/vendors.ts`, `core/inventory/vendor-service.ts` and `infra/db/vendor-gateways.ts`;
  - `VendorsController` with 6 routes and an error filter (404, 409);
  - the audit area `vendor` (Settings), and the vendor code as the Audit log record name.
- **Web:**
  - `/settings/vendors` (`Vendors`, on the DocumentTypes pattern);
  - `lib/vendors-api.ts`.
- **Trial seed:** three dummy vendors.

## Divergences from the plan
None. I first wrote a case-insensitive unique index into the migration and removed it before any run: §9 has none, and the service checks the code without regard to case.

## Skills loaded
None by the Skill tool in this session; the DocumentTypes code and the project conventions were followed. This is in the workflow audit.

## Evidence

### RED, each run before its code
- **Shared `vendors.test.ts`:** failed (no module).
- **API `vendors.test.ts`:** 6 of 6 failed.
- **Web `vendors.test.tsx`:** failed (no module).
- **E2E:** `vendors-flw-sa-09.spec.ts` was written before the web screen.

### GREEN
- **Shared:** 4 of 4.
- **API `vendors.test.ts`:** 6 of 6:
  - create with its fields and one audit record;
  - a duplicate code is refused (409) whatever its case;
  - an edit leaves the code unchanged;
  - deactivate keeps the vendor listed as inactive, then activate, with an audit record each;
  - 404 for an unknown id;
  - a Planner gets 403;
  - the pick list holds only active vendors, by name, of one kind when asked, for a Warehouse Manager.
- **API:** drift and the audit log tests pass (28 with vendors).
- **API trial seed:** 6 of 6.
- **Web `vendors.test.tsx`:** 5 of 5.

### Gates
- `pnpm lint` and `pnpm typecheck`: 9 of 9.
- `pnpm check:layers`: 403 modules, no violation.
- `pnpm check:secrets`: clean.
- `check-coverage --tests`: Coverage OK.
- Prettier was run on every touched file.

### Suites
- **Shared:** 324.
- **Web:** 199.
- **API unit:** 30.

### E2E
- **Full run (`pnpm e2e`):** 27 of 28. The failure was FLW-AM-05, the first spec of the run, at its Planner approval click. That spec is untouched by this task.
- **FLW-AM-05 and FLW-SA-09 run alone:** 2 of 2.

This is the third full run in a row whose first spec failed on a cold server right after the build: TASK-110 (sign-in), TASK-111 (login page) and here. It is noted as a follow-up.

### QA at 1440 x 900
A throwaway `zz-qa.spec.ts` took a screenshot, then was deleted and never committed. SettingsVendors matches the artboard: the table Vendor, Kind, Phone, and the panel with Code (fixed), Vendor, Kind, Phone, Address, Deactivate, Discard changes and Save. The search box and column filters come from the kit's DataTable, as on DocumentTypes.
