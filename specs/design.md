# Design — BMI Stooring System v2

> How Release 1 is built. Behaviour, rules and data are decided by the PRD ([PRD.md](../PRD.md), [docs/prd/](../docs/prd/)); the look of every screen by its artboard ([Design Artifact/](../Design%20Artifact/index.html), DEC-96). This file decides only what the PRD leaves to the implementation, and records each choice in §11.
> Spec version: PRD v2.24. A change to this file that diverges from the PRD needs an ADR in [docs/adr/](../docs/adr/) first (CLAUDE.md divergence protocol).

## 0. One entity, one name (PRD §0.7, DEC-106)

The entity is SPK everywhere: `spks`, `SpkGateway`, `core/spk/`, `spk.*`, `CreateSPK`, and Surat Perintah Kerja or SPK in what people read. The number is SPK-yymmddNNNN.

## 1. Architecture (PRD §8.2, DEC-66)

```
apps/web (Next.js) ──┐                                ┌──► PostgreSQL 16  (Cloud SQL Jakarta; local: WSL)
                     ├── HTTPS / JSON ──► apps/api ───┼──► Redis + BullMQ (Memorystore; local: WSL)
apps/mobile (Expo) ──┘   generated client  (NestJS)   └──► Object storage (R2; local: filesystem adapter)
  Android APK + mobile web (react-native-web, HTTPS), one code base (DEC-142)
                                           └── worker entry (jobs, PDFs, file processing)
```

- Only the API touches the database, Redis and storage. Clients hold no business rule beyond form checks imported from `packages/shared`.
- One NestJS code base, two entry points: `main.ts` (HTTP) and `worker.ts` (BullMQ processors). Both deploy to Cloud Run.
- Every business rule, transaction, permission check, scope lock and number runs on the server (REQ-MOB-002).

## 2. File structure

```
/
├── apps/
│   ├── api/                      NestJS: HTTP + worker
│   │   ├── src/
│   │   │   ├── core/             domain + application services per area (no DB driver imports)
│   │   │   │   ├── iam/ vehicles/ documents/ spk/ approvals/ inventory/ tyres/
│   │   │   │   └── placements/ baseline/ pm/ schedule/ notifications/ billing/ files/ audit/
│   │   │   ├── engine/           assignment engine: sequencing, step lifecycle, step time (imports no module)
│   │   │   ├── modules/          one folder per registered module: stock/ purchase/ mechanic/ part-check/
│   │   │   │                     mobilisasi/ placement/ document/ (+ dummy/ for tests)
│   │   │   ├── ports/            gateway interfaces, UnitOfWork, StoragePort, PushPort, EmailPort (reset link, DEC-102), ClockPort, PdfPort
│   │   │   ├── infra/            adapters: db/ (Drizzle + SQL), storage/ (fs, r2), queue/ (BullMQ), pdf/, push/
│   │   │   ├── http/             controllers, DTOs (Zod from shared), guards, allowedActions, OpenAPI
│   │   │   ├── jobs/             daily job, reconciliation, archive, file cleanup processors
│   │   │   └── main.ts  worker.ts
│   │   ├── migrations/           plain SQL, numbered, in the order of TX-01
│   │   └── test/integration/     per area; harness/ (template DB, factories, fake clock)
│   ├── web/                      Next.js App Router
│   │   ├── app/                  one route per artboard screen; module step screens under steps/
│   │   ├── components/           design kit re-created from DESIGN.md and the artboards (never imported)
│   │   ├── lib/                  query hooks over the generated client, formatting, capability helpers
│   │   └── e2e/flows/            Playwright, one file per FLW
│   └── mobile/                   Expo React Native (Android; spike in step 1, app in step 7)
│       ├── app/                  expo-router, one stack per role menu
│       └── src/                  offline drafts (SQLite), upload queue, secure store, location trail
├── packages/
│   ├── shared/                   enums (9.1), state machine tables (§3), permission catalogue (§2.4),
│   │                             Zod schemas, decimal money, life used, numbering formats, WIB formatting
│   ├── api-client/               generated from the API's OpenAPI (openapi-typescript + openapi-fetch)
│   ├── chassis-map/              layout → positions → drawing; web and native renderers
│   └── config/                   tsconfig, eslint, prettier, vitest presets
├── specs/                        requirements, design, tasks, CONTEXT, tdd-user-journeys, evidence/
├── docs/                         prd/, adr/, dev-setup.md
├── .github/workflows/            ci.yml
└── pnpm-workspace.yaml  turbo.json  package.json
```

Package names: `@bmi/api`, `@bmi/web`, `@bmi/mobile`, `@bmi/shared`, `@bmi/api-client`, `@bmi/chassis-map`, `@bmi/config`.

## 3. Layering inside the API (hexagonal)

| Layer | May import | Never imports |
| --- | --- | --- |
| `core/*`, `engine/`, `modules/*` | `@bmi/shared`, `ports/` | Drizzle, `pg`, BullMQ, S3 SDK, Nest HTTP types |
| `engine/` | `core/iam` (policies, `assertAllowed`, `allowedActions`), `core/idempotency` (`runIdempotent`), `core/` contracts, `ports/` (DEC-146) | any `modules/*` folder (checked in CI, §8.3), `infra/` |
| `modules/*` | the engine's module contract, `core/`, `ports/` | another module |
| `infra/*` | everything above | — |
| `http/*` | `core/`, `engine/`, `modules/` services | `infra/` directly |

Enforced by `dependency-cruiser` rules in CI (TASK-008).

### 3.1 Gateways and UnitOfWork (D-07)

- One port per aggregate: `UserGateway`, `RolePermissionGateway`, `VehicleGateway`, `DocumentGateway`, `SpkGateway` (SPK, approvals, steps), `StockLedgerGateway`, `PurchaseGateway`, `TyreGateway`, `PlacementGateway`, `PartItemGateway`, `AlertGateway`, `ScheduleGateway`, `NotificationOutboxGateway`, `InvoiceGateway`, `FileGateway`, `AuditGateway`, `SettingsGateway`.
- `UnitOfWork.run(async (tx) => …)` hands every gateway the same transaction; each TX-* of §9.13 is exactly one `run`. Retries are idempotent through an `Idempotency-Key` on every mutating request (NFR-01), stored with its response in `idempotency_keys` inside the same `run` (TX-22, DEC-108).
- Row locks (`SELECT … FOR UPDATE`) for TX-03, TX-05 and TX-21 live inside gateway methods (`lockSkus(ids)`), never in a service.
- Optimistic lock (NFR-03): every update of an `-- OL` table carries `WHERE version = $n`; a miss raises `ConcurrentUpdateError` → HTTP 409 with a clear message.
- Migrations: `infra/db/migrate.ts` applies numbered files, each in one transaction, and refuses an applied file that was edited. Its ledger `meta.schema_migrations` lives in schema `meta`, outside the §9 tables in `public`.
- Schema: the plain SQL migrations are the source of truth (enums, CHECKs, triggers, partial unique indexes of §9). Drizzle table definitions match them and are checked against the migrated database in CI (drift test), so §9 is never changed through Drizzle (D-12).

## 4. State machines and transition endpoints (D-05)

- `packages/shared/src/machines/<sm>.ts` holds one table per machine, `{ from, event, to, actor, guard? }[]`, typed from the §9.1 enums, plus a pure `transition(machine, state, event)` returning the target or a refusal.
- The server has one transition endpoint per aggregate (e.g. `POST /spk/:id/transitions { event, reason? }`), which runs L1, L2 (§5) and the table, then that event's TX. UIs read the table only to label states; buttons come from `allowedActions`.
- Tests: `it.each` over every row (accepted) and every missing (state, event) pair (refused), §8.3.
- SM-VEH, including OFF, is derived: one pure `deriveVehicleStatus(facts)` with the precedence table, recomputed on every trigger listed in §3.4.

## 5. Permissions (PRD §2.4, DEC-93)

- `packages/shared/src/permissions/index.ts` holds the permission code catalogue, the 2.2 matrix cell for cell, the DEC-115 lock rules, `defaultRolePermissions()` and the menu table with `menuFor()`, once. Migration `0004_role_permissions_seed.sql` is generated from `defaultRolePermissions()` (440 rows) and an integration test keeps the two equal.
- `effectiveCapabilities(inputs)` in `core/iam/capabilities.ts` (pure), loaded per request by `CapabilityService` through `CapabilityGateway` (`role_permissions`, app_settings `planner_approval_kinds`, `planner_approval_until`, `system_mode`; no row means Setup, REQ-IAM-010; the switch is on while at least one kind is ticked and the end time has not passed): the role's `role_permissions` rows with `allowed`, plus `spk.approve` / `count.approve` while the Planner switch is on for the ticked kinds, minus the codes blocked in Setup mode; the System Admin holds every operational code and never `accounts.manage`. The guard, the record policies, `GET /me` and `allowedActions` all call this one function.
- `@RequireCapability('spk.approve')` with `SessionGuard` on every endpoint (L1); several codes mean any of them; a refusal is 403 "You do not have permission to do this." `AppModule` exports the guard so every feature module uses it. Record policies (L2) are one function per action, e.g. `canApprove(user, object)` covering every approval kind, four-eyes, self-approval marks and the Planner switch (§8.3).
- `core/iam/actions.ts`: a record type declares one `Policies` table (per action: the codes of L1 and the L2 rules, each a function answering null or the sentence that refuses). `allowedActions(policies, actor, record)` builds the list for the response and `assertAllowed(...)` checks the action when it is sent, both through the one `refusalOf`; a refusal is 403 with that sentence. Shared rules: `inState`, `onlyOwner`, `notOwnWork` (BR-03, with `isSelfDecision` for the System Admin mark) and `withinScope` (BR-02: needs the payload, so it passes while listing and is checked when sent). The test helper `findContractBreaks` (`test/integration/harness/allowed-actions-contract.ts`) is the contract every record type runs: every listed action is accepted, every other one answers 403.
- Web: every page behind the sign-in sits in the `app/(app)` route group, whose layout renders `SignedInShell`: it loads `GET /me` on each page load (one refresh on 401), builds the rail from `menuFor(capabilities, systemMode)`, marks the item of the open path, shows the not-allowed page for the path of a hidden item (NAV-9), keeps the rail choice per user in the browser (C-02) and signs out (C-04).
- A generated matrix test turns the §2.2 rows × roles into expected codes and checks the guard of each endpoint.

### 5.2 Users and roles (REQ-IAM-002 to REQ-IAM-004, DEC-116)

- `core/iam/account-service.ts` behind `AccountGateways` (`accounts`, `audit` and the sign-in gateways): list with each account's `allowedActions` (edit, unlock, reset_password, deactivate, activate) from one `Policies` table, create with a temporary password, edit, unlock, reset password, deactivate (ends every session), activate, and Move System Admin role. Every change writes one `audit_logs` row (entity `user`); the move is one transaction: the old holder's role row is deleted, the new holder's row becomes System_Admin.
- Routes `/accounts` need `accounts.manage` at the controller (`@RequireCapability` on the class; the guard reads class and route). 404 and 409 come from `AccountErrorFilter`. NFR-01 asks idempotency for submit, approve, post and issue, so these routes take no Idempotency-Key.
- Rules: the create form never offers System Admin; an edit may send the current System_Admin role, and a change to or from it is refused; an Access Manager cannot change its own role or deactivate itself, and the last active Access Manager stays (DEC-116). The temporary password is returned once and never stored in clear.
- Web: `app/(app)/users` renders `UsersRoles` (table with search and column filters, status pills, tabs as links to the area's pages, the account and move panels, confirmations). A user without the Dashboard item lands on its first menu item, so the Access Manager opens Users and roles.

### 5.3 Roles and permissions (REQ-IAM-005, DEC-115, DEC-117)

- `@bmi/shared` `permissions/groups.ts`: `PERMISSION_GROUPS` (the 2.4 codes by area, each code once), `PERMISSION_MEANINGS` (2.4 text) and `isSwitchableCell` (the Planner S cells). The DEC-117 lock rule (approval codes outside Supervisor, GM, System Admin; account codes outside the Access Manager) sits in `defaultRolePermissions()`; migration `0005_role_permissions_locks.sql` applies it to a database seeded by 0004, and the seed test runs both (`harness/role-permissions.ts`).
- `core/iam/role-permission-service.ts` behind `RolePermissionGateways` (`rolePermissions`, `audit`): `matrix(actor)` returns every cell with `isLocked`, `switchable` and the page action `edit`; `change(actor, changes)` locks the rows (`FOR UPDATE`), refuses the whole save with 403 when any change touches a locked or S cell, skips changes equal to the stored value and writes one `audit_logs` row (entity `role_permissions`, entity_id 0, before and after `{ role: { code: allowed } }`) when anything changed.
- Routes `GET` and `PATCH /role-permissions`, `accounts.manage` on the controller. A change shows on the user's next request, because the capability set is read per request (NAV-9).
- Web: `app/(app)/users/roles` renders `RolesPermissions`: ten role columns, group rows, a toggle per unlocked cell (`aria-pressed`), staged cells marked "changed", a sticky bar with the count, Cancel and Save changes, and the leave guard while anything is staged. The Planner approval card of the artboard is TASK-109.

### 5.4 Planner approval switch (REQ-IAM-008, RL-7, TX-20, DEC-118)

- `@bmi/shared` `schemas/planner-approval.ts`: `APPROVAL_KINDS` with labels (the API's capability function imports them), the response (`on`, `kinds`, `until`, `allowedActions` switch_on, change, switch_off) and the requests (kinds, optional ISO end time, reason; switch off: reason). `time/wib.ts` reads and writes a datetime-local field in WIB.
- `core/iam/planner-approval-service.ts` behind `PlannerApprovalGateways` (`plannerApproval` over app_settings `planner_approval_kinds` and `planner_approval_until` with a transaction advisory lock, `audit`) and the `PlannerApprovalEndScheduler` port: `state`, `set` (switch on or change; an end time must be later than now, 400), `switchOff` (403 when already off) and `endIfDue`. Every change writes one `audit_logs` row (entity `planner_approval`, entity_id 0, before, after, reason); a switch whose end time passed is ended first in every call, with one "end" record and no user.
- `infra/queue/planner-approval-end-queue.ts`: a delayed BullMQ job per end time (job id = the end time), connected on first use, given up after 3 s with an error log so a down Redis never holds the save; `worker.ts` runs `endIfDue` for each job. Capabilities never wait for the job: they read the end time on every request (REQ-IAM-012).
- Routes `GET` and `PUT /planner-approval`, `POST /planner-approval/switch-off`, `iam.planner_approval_switch` on the controller.
- Web: `PlannerApprovalCard` above the matrix on `/users/roles`, its side panel (kinds, end time in WIB, reason) through the shared `kit/SidePanel`. The notice to Supervisors and GMs is TASK-130 (DEC-118).

### 5.5 Vehicle classes and chassis layouts (REQ-PLC-013, REQ-PLC-017, REQ-PLC-019, DEC-120)

- Migration `0006_vehicle_classes_layouts.sql`: `chassis_layouts`, `vehicle_classes`, `part_positions` as in §9.3 (identity ids, ON DELETE RESTRICT).
- `core/fleet/vehicle-class-service.ts` behind `VehicleClassGateways` (`vehicleClasses`, `audit`): `list` (each class with its default layout version), `create` (a typed code unique without regard to case, 409; layout v1 with the class code; positions from `generatePositions`; one audit record) and `newLayoutVersion` (class row locked; the next version of the layout code with its positions becomes the class default; older versions and their positions stay for the vehicles that use them; one audit record). Routes `GET`/`POST /vehicle-classes`, `POST /vehicle-classes/:id/layouts` under `masterdata.manage`; 404 and 409 from `VehicleClassErrorFilter`.
- Web: `/settings/chassis-layouts` renders `ChassisLayouts`: the class table, the layout panel (new class: code, name, unit kind; existing: name with its version note), front drawing, axle rows (role, tyres per side, spacing after the first, remove), Add axle, spare positions, the live preview from `@bmi/chassis-map` (its style sheet loads in the root layout; the package is transpiled by Next), Discard with a confirmation (C-16) and Save. The Vehicles column (TASK-119, DEC-123) counts the vehicles that are not soft-deleted on each layout version (`layout.vehicleCount`).

### 5.6 Document types (REQ-DOC-001, REQ-DOC-002, DEC-20, DEC-121)

- Migration `0007_document_types.sql`: `document_types` (without `preset_id`, which comes with the SPK presets in TASK-208) and `document_type_classes`, and the four launch types STNK_Annual, STNK_5Year, KIR and Insurance (30 warning days, receipt required, no class). `vehicle_documents` and `document_corrections` come with the document first entry in TASK-601 (DEC-122).
- `core/fleet/document-type-service.ts` behind `DocumentTypeGateways`: `list` (active types, the classes, page actions create, edit, deactivate), `create` (C-31; a typed code unique without regard to case, 409), `update` (C-17; fields and required classes in one transaction; unknown class 400), `deactivate` (C-32; the type leaves the list, documents already entered keep it); one audit record each. Routes under `masterdata.manage`; `DocumentTypeErrorFilter` for 400, 404 and 409.
- Web: `/settings/document-types` renders `DocumentTypes` (list, record panel with code fixed once saved, validity and warning days, receipt, class checklist, New marked New, Discard changes and Deactivate with confirmations, Saved). The non-compliance count (TASK-119, DEC-123): each class carries `vehicleCount` (vehicles that are not Inactive); ticking a class the saved type does not require shows "Saving makes N vehicles of … non-compliant until each has a …" before Save.

### 5.7 Vehicles (REQ-VEH-001 to REQ-VEH-004, REQ-PLC-018, DEC-17, DEC-122, DEC-123)

- Migration `0008_vehicles.sql`: `vehicles` as in §9.3 (SD, OL), `customer_id` without its reference until TASK-701; TX-18 partial unique indexes on the plate and the VIN among rows that are not soft-deleted; class and layout references ON DELETE RESTRICT.
- `core/fleet/vehicle-service.ts` behind `VehicleGateways` (`vehicles`, `vehicleClasses`, `audit`) and the `VehicleActivityGateway` port (`VEHICLE_ACTIVITY`): mounted tyres and open SPK numbers per vehicle. The adapter `DrizzleVehicleActivity` reads the open SPKs of each vehicle from `spks` (TASK-120, DEC-124); mounted tyres stay 0 until TASK-501 adds them. The vehicles integration test sets both with a fake; `vehicle-open-spk.test.ts` uses the real adapter. One policy table (`edit`, `change_class`, `deactivate`) answers both the check and `allowedActions`: nothing on an Inactive vehicle; `change_class` refused with the `classLock` sentence while a tyre is mounted or an SPK is open (DEC-17); `deactivate` refused while an SPK is open (REQ-VEH-004).
- `create` (vehicle.manage): the class decides the layout version (its default) and the counts; a Towed class takes no odometer (400 when one is given, stored 0, REQ-PLC-018); the typed odometer sets `current_odometer` (its log entry comes with TASK-605); plate and VIN unique without regard to case (409); empty optional texts are stored as null. `update` needs a reason (written to the audit record) and the version it was read at (`updateWithVersion`, 409 when stale); a new class takes its default layout. `deactivate` sets Inactive with the reason and the time; the record stays readable. Routes `GET /vehicles`, `GET /vehicles/:id` (vehicle.view or vehicle.manage; the form classes and the page action `create` only for vehicle.manage), `POST /vehicles`, `PATCH /vehicles/:id`, `POST /vehicles/:id/deactivate` (vehicle.manage); `VehicleErrorFilter` for 400, 404 and 409.
- Web: `/vehicles` (`VehicleList`: status tabs All, Active, Repair, OFF, Blocked, Inactive; plate, class, odometer with a dash for a Towed unit, status), `/vehicles/new` and `/vehicles/:id/edit` (`VehicleForm`: plate, class, odometer for a Powered unit only and read only after AddVehicle (DEC-123), axles and tyres read only from the layout, VIN, engine number, brand, model, year, fuel type, the layout preview, the class lock note, the reason, Cancel with C-16, Deactivate vehicle with its reason dialog), `/vehicles/:id` (`VehicleDetail`: status pill beside the plate through `PageHead status`, Overview and Chassis and parts with the read-only map, every position Missing until the baseline of TASK-511). DEC-122 hides, not disables, what later tasks build: the Documents, SPK history and Inspections tabs, Parts baseline, Create SPK, Record reading, Odometer history and Change driver, the Customer field and column, the Driver and alert count columns, the first documents and "Save and add parts".

### 5.8 SPK tables and numbering (NFR-15, DEC-104, DEC-111, DEC-124)

- Migration `0009_spks.sql`: `assignment_modules` (empty; each module registers itself in its own task), `spk_number_seq`, `spks` (SD, OL; partial unique number and DEC-80 source indexes that skip deleted rows), `spk_assignments`, `spk_approvals` (AO trigger), `spk_parts`, `spk_attachments`, and the setting `numbering_formats` seeded with `NUMBERING_CONFIG`. DEC-124: a column that refers to a table a later task builds is a plain column; the owning task adds its reference (listed in DEC-124 and on those tasks).
- `ports/numbering.ts` (`DocumentNumberGateway.next(kind, createdAt)`, `NumberingConfigError`) and `ports/spks.ts` (`SpkGateway`: `insert`, `findById`, `openNumbersByVehicle`), implemented in `infra/db/spk-gateways.ts`: a number reads the stored formats, checks them with `NumberingConfigSchema` (a missing or broken value is refused), takes `nextval` of the code's own sequence inside the caller's transaction (never given back, also after a rollback or a cancel) and formats it with the WIB date. `OPEN_SPK_STATUSES` in `@bmi/shared` is the REQ-SCH-001 list.
- The drift check compares `numeric(p, s)` without the space Drizzle writes.

### 5.9 In-app notifications (REQ-NTF-001, REQ-NTF-005, C-03, DEC-118, DEC-125)

- Migration `0010_notifications.sql`: `notifications` with `dedupe_key` (unique per user) and `notification_deliveries`; `device_id` stays a plain column until `push_devices` comes with mobile push (the DEC-124 rule).
- `ports/notifications.ts` and `infra/db/notification-gateways.ts`: `send(userIds, notice)` is the outbox of 8.3. It writes the notices in the caller's transaction (`ON CONFLICT (user_id, dedupe_key) DO NOTHING`) and an InApp delivery row, Sent, for each one written. Recipients the matrix names by role come from `activeUsersWithRoles`, active accounts only. Every later task adds its events by calling `send` in its own transaction with a key naming the event.
- `core/notifications/notification-service.ts` and `/notifications` for any signed-in user, own notices only:
  - list: the newest 50, with unread counts per tab;
  - unread count;
  - read one: 404 when it is not the user's;
  - read all.
- DEC-118: `PlannerApprovalService` sends "switched on", "changed", "switched off" and "ended" to active Supervisors and GMs, kind Approval, no link, in the transaction of its audit record. The end is keyed by the end time it passed, so a rerun of the end job adds nothing.
- Web:
  - `SignedInShell` takes `notices`. It reads the badge on page load and every `NOTIFICATION_POLL_MS` (60 s), and opens `NotificationCenter` from the bell of `PageHead`.
  - The panel has tabs All, Approvals, Steps, Alerts and Schedule with unread counts, Mark all read, Close and Escape (C-14). A notice marks itself read, then opens its link or stays (DEC-125). Times are shown in WIB.

### 5.10 Create SPK (REQ-SPK-001, REQ-SPK-002, REQ-SPK-013, REQ-SPK-015, T1, T2, T5, DEC-126)

- `core/spk/spk-service.ts` behind `SpkGateways` (`spks`, `numbers`, `audit`, `notifications`, `plannerApproval`).
- One policy table (`edit`, `submit`) answers both the check and `allowedActions`: spk.create, Draft or Rejected, the creator only.
- `create` (T1):
  - refuses an unknown or Inactive vehicle (400, REQ-SPK-013); Setup mode already removes spk.* (REQ-IAM-010);
  - takes the number from `spk_number_seq` with the stored format;
  - the source is Manual_Planner for a Planner, otherwise Manual_Admin (REQ-SPK-002).
- `update` (C-15) saves at the version on screen (409 when stale).
- `submit` (T2, T5):
  - refused with "Add at least one step before submitting." while the SPK has no step (DEC-126; TASK-207 adds the section checks of REQ-SPK-004);
  - sets Pending_Approval and writes one `spk_approvals` row (Creation, Submit);
  - notifies Supervisors, GM and System Admin, plus Planners while the switch covers spk_creation (REQ-NTF-005), keyed per submission.
- One audit record per create, update and submit.
- Routes: `GET /spks/options` (vehicles that are not Inactive), `POST /spks`, `GET /spks/:id` (spk.view or spk.create), `PATCH /spks/:id`, `POST /spks/:id/submit`.
- Vehicles: a vehicle's `allowedActions` gains `create_spk` (spk.create, not Inactive), and VehicleOverview shows Create SPK (C-11).
- Web:
  - `/spk`: the page header with Create SPK; SPKList comes with TASK-125.
  - `/spk/new?vehicle=`: CreateSPK with the common fields (title, vehicle, category, urgency with the order of REQ-SPK-015, Vehicle goes to the workshop, description), Cancel (C-12), Save draft (the page follows the new draft to `/spk/:id/edit`), and Submit for approval (saves first).
  - An SPK no longer Draft or Rejected shows read only with its status and urgency pills.
  - The Steps section, palette, Checks and presets stay hidden until TASK-207 and TASK-208, and PartPicker comes with TASK-306.

### 5.11 SPK list and detail (REQ-SPK-010, REQ-SPK-011, REQ-SPK-015, DEC-127)

- `core/spk/spk-list-service.ts` behind the same `SpkGateways`; the port takes plain filters (`SpkListFilter`: statuses, My steps, search, type, vehicle), and the Drizzle query lives in `infra/db/spk-gateways.ts`.
- Tabs: Active is Active, In_Progress, Pending_Verification and Pending_Amendment; Draft, Pending approval, Rejected, Completed and Cancelled are one status each; All is every status.
- My steps: an SPK with an Open or In_Progress step that is assigned to the user, or unassigned with the user's role among its executor roles (matching data in `executor_roles`, not a permission).
- Every tab count uses the same search, type and vehicle. Search is "contains, any case" over the SPK number, the title and the plate.
- Order: Urgent, High, Normal, Low, then newest first. Pages of 10, 20, 50 or 100 (20 by default); `totalPages` is at least 1.
- Each row: the SPK with its `allowedActions` from the Create SPK policy table, its current step and who it waits on. The current step (DEC-147) is the first step that is Open or In_Progress, else the first not Verified or Skipped; one function `currentStepOf` in `@bmi/shared` serves SPKList and the SPKDetail tracker:

  | Status | Waiting on |
  | --- | --- |
  | Draft, Rejected, Pending_Amendment | the creator (role and name) |
  | Pending_Approval | "Approvers" |
  | Active, In_Progress | the assignee of the current step, else its executor roles |
  | Pending_Verification | the verifier role of the current step |
  | Completed, Cancelled | none |

- The page action is `create` with spk.create; the response also carries the vehicles that have an SPK (the vehicle filter).
- Detail: the header, the vehicle with class, unit kind and odometer, the creator, the steps (status, executor roles, assignee, opened, submitted and verified times), the `spk_approvals` rows and the costs with their total, as decimal strings.
- Routes: `GET /spks` (spk.view, `SpkListQuerySchema`) and `GET /spks/:id/detail` (spk.view, 404 when unknown), both in `SpksController`.
- Web:
  - `/spk`: SPKList with the search in the header, Create SPK when the page allows it, the tabs with counts, type and vehicle filters, a plain table (server-side pages cannot use the client-side `DataTable`), and the pager.
  - The vehicle filter is a select of the vehicles that have an SPK, where the SPKList artboard shows a text input (owner, 2026-11-16).
  - Open goes to Create SPK when the row allows `edit`; every other row offers View.
  - `/spk/:id`: SPKDetail read only, with the Steps tab (`StepTracker`, `StepCard`, the context card with odometer and cost so far, `ApprovalBlock`) and the History tab (the `spk_approvals` rows, newest first).
  - What later tasks build stays hidden (DEC-127).

### 5.12 Approvals (REQ-SPK-005 to REQ-SPK-007, REQ-APR-001 to REQ-APR-007, BR-03, BR-04, DEC-128)

- `core/approvals/can-approve.ts`: one policy table (`APPROVAL_POLICIES`) for every approval kind (§8.3). An `ApprovalItem` carries:
  - the kind;
  - the owner (the creator, or the counter, BR-03);
  - whether it still waits;
  - the kinds the Planner switch covers now.

  Its rules:
  - the kind's capability (`spk.approve` for the SPK kinds, `count.approve` for the counts);
  - a Planner decides only the ticked kinds while the switch is on;
  - the item must still wait;
  - `notOwnWork`, with the System Admin as the one exception, marked Self-approved.

  The inbox lists the items the user may decide now (`inInbox`). The other kinds reuse the table when their tasks come.
- `core/approvals/approval-service.ts` behind `ApprovalGateways` (the SPK gateways plus `approvals` and `idempotency`). The Planner switch is read inside the transaction of each request.
  - Approve (T3, TX-02):
    - lock the SPK;
    - set Active at the version on screen;
    - `openFirstStep`: step 1 Open with `opened_at`, the rest Locked;
    - write the Approve row (`self_approved`) and `audit_logs.self_decision`;
    - notify the users of step 1's executor roles.
  - Reject (T4):
    - a reason is required ("Give a reason to reject.");
    - set Rejected;
    - write the Reject row with the reason;
    - notify the creator.
  - Both run under `runIdempotent` with the `Idempotency-Key` (NFR-01, TX-22).
- Inbox order: Urgent, High, Normal, Low, then the longest waiting. The waiting time runs from the last Submit row.
- History lists the Approve and Reject rows of every Approver, newest first. "Decided by" shows the role the decision was taken in.
- Routes:

  | Route | Needs |
  | --- | --- |
  | `GET /approvals/count` | spk.approve or count.approve |
  | `GET /approvals/history` | spk.approve or count.approve |
  | `GET /approvals/spk` | spk.approve |
  | `GET /approvals/spk/:id` | spk.approve |
  | `POST /approvals/spk/:id/approve` | spk.approve and an Idempotency-Key |
  | `POST /approvals/spk/:id/reject` | spk.approve and an Idempotency-Key |

  An unknown SPK is 404; a stale version is 409.
- SPKList: a Rejected SPK waited on "Rejected: <reason>" until SPKRejected came in TASK-123 (5.13). It now waits on its creator again.
- Web:
  - `/approvals` (Surat Perintah Kerja tab):
    - the chips All and Creation, and the search;
    - the DEC-128 columns, with the urgency pill and Yours;
    - a preview panel of the selected row; Open review on each row and in the preview.
  - `/approvals/history`:
    - the chips All, Approved and Rejected;
    - the PRD columns;
    - a preview with the stamp, the reason and Open SPK.
  - `/approvals/spk/:id` (ApprovalReview):
    - the SPK, its title, description and steps;
    - the decision card: Reject is enabled once the reason has text (C-25); Approve commits at once (C-24);
    - the stamp plays a short scale-in, none under reduced motion (DEC-83);
    - a retry of the same decision keeps its key.
  - The Approvals menu item shows the waiting count, read when a page loads and every 60 seconds (as DEC-125).
  - Hidden until their tasks: the Warehouse tab, the Amendment and Completion chips, the report reference and part age, and Needs my action.
- E2E: until TASK-207, the e2e database command seeds three SPKs waiting for approval, with their steps (DEC-126). The web still never touches the database (DEC-66).

### 5.13 Rejected SPK and the creator's cancel (REQ-SPK-007, T5, T6, DQ-06, DEC-101, DEC-129)

- **T5:** built in TASK-121. `SPK_POLICIES.edit` and `submit` allow a creator's Draft or Rejected SPK. Submit writes a new Submit row and notifies the Approvers again.
- **T6:** `SPK_POLICIES.cancel` needs spk.create, a Draft or Rejected SPK, and its creator.
  - The rejector holds no spk.create, so a rejection cannot be reverted (DQ-06).
  - `SpkService.cancel` runs under the Idempotency-Key (`SpkGateways.idempotency`):
    - lock the SPK and assert `cancel`;
    - `spks.cancel` sets Cancelled, `cancel_reason` and `cancelled_by` at the version on screen;
    - write one audit record `cancel` with the reason (its time is the cancel time; §9.6 has no `cancelled_at`);
    - notify nobody.
  - Route: `POST /spks/:id/cancel`, which needs spk.create and an Idempotency-Key. A missing reason is 400; a refusal is 403; a stale version is 409.
  - Cancelling a system-made Draft as a Planner or the System Admin (TX-24) comes with the Report Breakdown tasks.
- **Web:**
  - **`SpkDetail`** renders **`SpkRejected`** while the SPK is Rejected. It shows:
    - the crumb, the title and the Rejected pill, and the subline;
    - the latest Reject row as a `.note.bad` ("Rejected by <role> <name> · <time WIB>" and the reason);
    - the SPK card and the Steps card, with each step's real status;
    - for the creator only, Edit and resubmit (`/spk/:id/edit`) and Cancel SPK.

    SPK document stays hidden.
  - **`CancelSpkDialog`:** a required reason; Keep SPK, Escape and the scrim close it (C-14); a retry keeps its key. On success the page goes to `/spk?tab=cancelled`.
  - **`CreateSpk`:** shows the rejection note above the form for a Rejected SPK, and Cancel SPK when the SPK allows `cancel`. Cancel still leaves without saving (C-12).
  - **SPKList:** reads `?tab=`, and a Rejected row opens `/spk/:id`.
- **E2E seed:** two SPKs ("Resubmit me", "Cancel me") already rejected by the e2e Supervisor, numbered from `spk_number_seq`.

### 5.14 Local trial (DEC-113, DEC-130, ADR-0003)

- **`apps/api/src/infra/db/trial/`** (ADR-0003 first named `apps/api/seeds/local/`, outside the API build):
  - **`trial-target.ts`:** the trial URL. `TRIAL_DATABASE_URL` overrides the default; only `bmi_trial` on `localhost` or `127.0.0.1` is accepted.
  - **`trial-seed.ts`:** `seedTrial(db, {now, password})`, typed by hand (ADR-0001), in one transaction. It refuses a database that already holds `@trial.test` accounts. It writes:
    - one account per role;
    - Live mode;
    - two layouts and two classes (Powered, Towed) and four vehicles;
    - the modules Stock, Part_Purchase and Mechanic_Action (`ON CONFLICT DO NOTHING`);
    - one SPK per status, numbered from `spk_number_seq`, with steps and approval rows that agree.

    Times are written as UTC text (NFR-14). Without stored numbering formats it uses `NUMBERING_CONFIG`.
  - **`trial-cli.ts`:** creates `bmi_trial` when it is missing (`--reset` drops it first), migrates, and seeds once. It writes `.data/trial-accounts.md` and prints emails only.
- **`scripts/trial.mjs`:** builds the shared package and the API, runs the CLI, then starts the API on `bmi_trial` and `next dev` with `[api]`/`[web]` prefixes; Ctrl+C stops both. `pnpm trial` and `pnpm trial:reset` (database only).
- **CI:** "Local trial seed follows the migrations" runs the CLI with `--reset` after the tests.
- **`.claude/launch.json`:** `api-trial` runs the API on `bmi_trial` for the preview tools.
- **Later tasks:** each adds its dummy data to `seedTrial`.

### 5.15 Audit log, export and Access history (REQ-IAM-007, NFR-02, DEC-74, DEC-131)

- **Writer:** every service already writes through `AuditGateway.write` in its own transaction. `core/audit/audit-format.ts` `AREA_OF` maps each written entity to an area:

  | Entity | Area |
  | --- | --- |
  | spk | SPK |
  | user, role_permissions, planner_approval | Access |
  | vehicle, vehicle_class | Vehicles |
  | document_type | Settings |

  A unit test reads every `entity: '…'` that `src/` writes and fails while one has no area; a later task adds its entity there and its area to `AUDIT_AREAS` (`@bmi/shared`).
- **Shared (`schemas/audit.ts`):**
  - `AuditLogQuerySchema`: `userId`, `area`, `from`, `to` (WIB days, From ≤ To), `page`, and `pageSize` of 10, 20, 50 or 100.
  - `AuditLogExportQuerySchema`: the same filters and `format` (csv or xlsx).
  - `AccessHistoryQuerySchema`: the page only.
  - `selfLabel`: Self-approved, or Self-verified for a verify action.
- **Port (`ports/audit-log.ts`):**
  - `AuditLogGateway`: `page`, `count`, `one`, `users`, `userNames`;
  - `ExportLogGateway.write` into `export_logs`;
  - `SpreadsheetWriter.xlsx`, implemented by `infra/files/exceljs-spreadsheet-writer.ts` (the one library DEC-131 allows), so the core never imports it.
- **Gateway (`infra/db/audit-log-gateways.ts`):** newest first (`at`, then `id`). The record name comes from left joins on the entity: SPK number, plate, account name, class code or document type code.
- **Service (`core/audit/audit-log-service.ts`):**
  - **Range:** without dates, the last 7 WIB days up to today. The dates become UTC instants with an exclusive end.
  - **Summary:** the status when it changes; otherwise the changed top-level fields, at most 3, cut at 120 characters.
  - **Export:** refused above 10,000 rows ("Narrow the filters to export at most 10,000 rows."). CSV is RFC 4180 with CRLF and a UTF-8 BOM. A cell that starts with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`. xlsx cells are text. Each export writes `export_logs` (`audit_log`, the format, the effective filters) in the same transaction.
  - **Access history:** the Access-area rows, all time, in words (`accessChange`).
- **Routes:**

  | Route | Needs | Answers |
  | --- | --- | --- |
  | `GET /audit-logs` | `audit.view` | a page of rows |
  | `GET /audit-logs/export` | `audit.view` | a file, `audit-log-<WIB day>.<format>` |
  | `GET /audit-logs/:id` | `audit.view` | one row with its full JSON |
  | `GET /access-history` | `accounts.manage` | a page of access changes |

  A file route carries `@ApiFileContract` (its media types in the OpenAPI document; the interceptor passes the bytes through).
- **Migration 0011:** `export_logs` as §9.12, append-only by trigger.
- **Web:**
  - **`/audit-log` (`AuditLog`):**
    - the filters: User, Area, From and To; `?area=` opens it on one area;
    - the table: Time (WIB), User, Role, Area, Record, Before, After, Self;
    - the pager (`kit/Pager`);
    - the Record button opens the "Audit record" panel: the full JSON and the reason;
    - Export opens the C-26 dialog (xlsx or csv, then a download).
  - **`/users/history` (`AccessHistory`):** When, Who, What, the pager, and "Full trail in Audit log" (`/audit-log?area=Access`).
- **E2E seed:** "Self approval check", an SPK submitted by the System Admin, waits for creation approval (FLW-SA-06).

### 5.16 Setup mode and Go live, both ways (REQ-IAM-010, AC-IAM-006, DEC-56, DEC-132)

- **Shared (`schemas/system-mode.ts`):**
  - `SETUP_SIGN_IN_ROLES` (System_Admin, Access_Manager);
  - `GO_LIVE_PHRASE` and `BACK_TO_SETUP_PHRASE`;
  - `SystemModeSwitchRequestSchema` (`reason`, `confirmation`);
  - `SystemModeResponseSchema` (`mode`, `wentLiveAt`, `checklist`, `allowedActions`);
  - `SYSTEM_MODE_MESSAGES`.
- **Menu:** the Setup and go live item shows in both modes (`setupModeOnly` is no longer set on it).
- **Auth gate (`AuthService`):** `signIn`, `authenticate` and `refresh` refuse `setupMode` (403, "The system is being set up.") while the mode is Setup and the account's role is not in `SETUP_SIGN_IN_ROLES`.
  - The check runs before the session-open check, so a session that Back to Setup revoked answers "being set up" while in Setup, and "session ended" once Live again.
- **Service (`core/iam/system-mode-service.ts`), `setup.golive` only:**
  - `status`: the mode, the latest Go live, and the checklist counts (active accounts; active vehicle classes plus document types; vehicles).
  - `goLive` and `backToSetup`:
    - the trimmed reason is required, and the phrase must match exactly;
    - the current mode must be the other one ("The system is already Live." / "already in Setup mode");
    - each runs under an Idempotency-Key in one transaction, and writes `system_mode` (and `went_live_at` on Go live);
    - Back to Setup revokes every open session of the other roles;
    - each writes one audit record (entity `system_mode`, action `go_live` or `back_to_setup`, before and after mode, the reason; area Settings).
- **Gateway (`infra/db/system-mode-gateways.ts`):**
  - `app_settings` upserts;
  - the counts;
  - `revokeSessionsExceptRoles`: an `UPDATE auth_sessions` of the users not in `user_roles` for those roles.
- **Routes:** `GET /system-mode`, `POST /system-mode/go-live` and `POST /system-mode/back-to-setup`. Refusals answer 400 (`SystemModeErrorFilter`).
- **Web:**
  - **`/setup` (`SetupGoLive`):**
    - in Setup: the crumb "Setup mode", the checklist (`ol.steps`, ticked when the count is above 0), the lock note and Go live;
    - in Live: the crumb "Live since …", the note and Back to Setup;
    - the dialogs GoLiveConfirm and BackToSetupConfirm ask for the reason and the typed phrase, with one Idempotency-Key per dialog;
    - after a switch the page loads again, so `/me` and the menu follow.
  - **Landing:** in Setup the holder of `setup.golive` lands on `/setup` (WebLogin row).
- **Tests run Live unless they test Setup:** `auth.test.ts` now sets Live, as the other suites do.
- **DEC-133 (PRD v2.45):**
  - **Setup mode removes no capability:** `blockedInSetupMode` is gone, and `effectiveCapabilities` ignores the mode.
  - **`Actor` carries `systemMode`:** `actorOf` copies it from the signed-in snapshot.
  - **`notOwnWork`:** refuses one's own work while Live, whatever the role (the System Admin included), and allows it in Setup. `isSelfDecision` still marks the stamp and the audit record.
  - **Approvals:** the inbox (REQ-APR-006) and `allowedActions` use the same policy, so one's own SPK is hidden and refused while Live, and shown as Yours and decidable in Setup.

### 5.17 Vendor master (REQ-INV-014, DEC-134)

- **Migration 0012:** `vendors` as §9.7 with the §9.0 columns (SD `deleted_at`). The code is unique; the service checks it without regard to case.
- **Shared (`schemas/vendors.ts`):**
  - `VENDOR_KINDS`;
  - `VendorSchema` (with `isActive`);
  - `VendorRequestSchema`: a code of 1 to 20 letters, digits and underscores; a name; the kind; phone and address, which may be null;
  - `VendorUpdateRequestSchema`: without the code;
  - the list, the options query and the options response.
- **API:**
  - `ports/vendors.ts`, `core/inventory/vendor-service.ts` and `infra/db/vendor-gateways.ts`;
  - every save writes one audit record (entity `vendor`, area Settings); the Audit log names the record by its code.
- **Routes:**

  | Route | Needs |
  | --- | --- |
  | `GET /vendors`, `POST /vendors`, `PATCH /vendors/:id`, `POST /vendors/:id/deactivate`, `POST /vendors/:id/activate` | `masterdata.manage` |
  | `GET /vendors/options?kind=` (active vendors by name) | any of `masterdata.manage`, `inventory.manage`, `tyre.manage`, `purchase.line`, `mechanic.execute` |

- **Web `/settings/vendors` (`Vendors`), on the DocumentTypes pattern:**
  - the table: Vendor (with an Inactive pill), Kind, Phone;
  - the panel: Code (fixed once saved), Vendor, Kind, Phone, Address;
  - Deactivate (with C-32) or Activate, Discard changes (C-16) and Save (C-17).
- **Trial seed:** three dummy vendors (Supplier, Workshop, Retread).

### 5.18 Storage port and adapters (REQ-FUP-004, REQ-FUP-008, NFR-13, D-03, DEC-135)

- **Shared:** `STORAGE_LINK_SECONDS` (900) and `storageKey` (`{env}/{yyyy}/{mm}/{entity}/{id}.{ext}` by the UTC month; parts are letters, digits, `_` and `-`).
- **Port (`ports/storage.ts`):**
  - `StoragePort`: `signUpload` (an exact content type and size), `signDownload`, `head`, `read`, `write` (refuses an existing key), `remove` (DEC-136: incoming objects and never-attached files only, a missing key is not an error) and `totalBytes`; a Ready or attached file is never removed (BR-10);
  - `SignedLinkServer` for an adapter that serves its own links;
  - the errors `StorageOverwriteError` (409), `StorageLinkError` (403), `StorageMismatchError` (400) and `StorageMissingError` (404).
- **`FsStorageAdapter`:**
  - files under `STORAGE_FS_ROOT` (`.data/storage`), written with `wx`;
  - an HMAC token (key, operation, expiry, type, size) with `STORAGE_SIGNING_SECRET` on the injected clock;
  - links are `{STORAGE_PUBLIC_URL}/storage/fs/{token}`.
- **`S3StorageAdapter` (AWS SDK v3):**
  - path-style, region auto;
  - uploads presigned with the content type, length and `If-None-Match: *` signed;
  - writes are conditional (412 is an overwrite);
  - `totalBytes` pages `ListObjectsV2`.
- **Routes:** `FsStorageController` (`PUT`/`GET /storage/fs/:token`) is registered only when `STORAGE_DRIVER=fs`, injects `STORAGE_LINKS` (`useExisting: STORAGE`) and reads the raw body up to 25 MB.
- **Composition:** `STORAGE_DRIVER` (`fs` or `s3`) picks the adapter; s3 needs `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`.
- **Contract suite (`test/integration/storage/storage-contract.test.ts`):**
  - one `describe.each` for fs always, and for s3 when `R2_ENDPOINT` is set;
  - CI runs LocalStack (`localstack/localstack:4.0.3`, S3 only, signature validation on) and sets the `R2_*` names;
  - without them the s3 run is reported skipped.

### 5.19 Upload pipeline, server (REQ-FUP-001, 002, 003, 005, 009, 010, 013, NFR-06, DEC-31, DEC-136)

- **Shared (`files/index.ts`, `schemas/files.ts`):**
  - `UPLOAD_PROFILES` (the 8.1 table), `sniffFileType` (JPEG, PNG, PDF and HEIC/HEIF by their first bytes; video and everything else is `unknown`), `checkUpload` and `checkStepFileLimits` (10 photos, 5 documents), with `FILE_MESSAGES`;
  - `UploadLinkRequestSchema`, `UploadLinkResponseSchema` and `StoredFileResponseSchema`.
- **Port (`ports/files.ts`):** `FileGateway` (insert, find, set Ready, set Rejected, list expirable, set Expired), `MediaProcessor` and `FileJobs`.
- **Core (`core/files/`):**
  - `FileService`: `requestUpload` (needs `files.upload`, checks the declared type and size, creates a Pending row and signs an upload to `incoming/{storage_key}`), `markUploaded` (enqueues one job per file) and `get` (only the uploader until the attach tasks; signed links only when Ready). Both POSTs take an Idempotency-Key;
  - `FileProcessor`: reads the incoming object, sniffs it, runs `checkUpload`, compresses images or counts PDF pages, writes the output and the `-thumb.jpg` thumbnail, sets Ready with sha256, size, width, height or pages, then removes the incoming object. An earlier output found on a rerun is kept. An error is thrown for a retry; on the last attempt the file is Rejected with one sentence;
  - `FileCleanup`: Pending or Rejected rows never attached and older than 24 hours lose their objects and become Expired; a rerun finds nothing.
- **Infra:**
  - `SharpPdfjsMediaProcessor` (`infra/files/media-processor.ts`): sharp (EXIF rotation, resize without upscaling, flatten on white, the quality ladder, no metadata written, `captured_at` from EXIF), `heic-decode` for HEIC, `pdfjs-dist` legacy build with `@napi-rs/canvas` for the first page. Image and PDF are one class because they serve one port;
  - `DrizzleFileGateway` (`infra/db/file-gateways.ts`);
  - `FileProcessingQueue` (job id `file-{id}`, 4 attempts, exponential backoff from 5 s) and `FileCleanupQueue` (an hourly job scheduler), both registered in `worker.ts`.
- **Routes (`FilesController`, all `files.upload`):** `POST /files/upload-links`, `POST /files/:id/uploaded`, `GET /files/:id`; `FileErrorFilter` maps 400 and 404.
- **Settings:** `STORAGE_ENV` is the first part of every storage key (default `local`).
- **Tests:** `test/integration/files/upload-pipeline.test.ts` runs the worker job in the test (the queue is replaced by a recorder), with photos and PDFs generated in the test and one HEIC fixture (`test/fixtures/photo.heic`, an HEVC still made with ffmpeg and wrapped in HEIF).

### 5.20 Daily storage usage alert (NFR-13, NFR-12, NFR-14, DEC-137)

- **Port (`ports/storage-usage.ts`):** `StorageUsageGateway.settings()` (`storage_budget_gb`, `storage_alert_pct` of app_settings, null when missing) and `highestStepSent(budgetGb)` (from the `storage-usage:{budget}:{step}` dedupe keys of notifications).
- **Core (`core/files/storage-usage.ts`):**
  - `usageStep(pct, alertPct)`: null below the alert percentage, otherwise the 5% step reached (80, 85, … beyond 100);
  - `usageNotice`: "File storage is NN% full" and "X GB of the Y GB budget is used." (one decimal);
  - `StorageUsageCheck.run()`: reads `StoragePort.totalBytes`, applies the defaults 50 GB and 80%, and in one transaction notifies the active System Admins (kind Alert, no link) only when the step is above the highest step sent for this budget. It returns `{ usedBytes, budgetGb, pct, step, notified }`.
- **Infra:** `DrizzleStorageUsageGateway` (`infra/db/storage-usage-gateways.ts`) and `StorageUsageQueue` (a BullMQ job scheduler, cron `30 0 * * *` in `Asia/Jakarta`), started in `worker.ts`, which logs every run.
- **Tests:** `test/integration/files/storage-usage.test.ts` (a storage whose total the test sets, a 1 GB budget) and the unit spec `core/files/storage-usage.spec.ts`.

### 5.21 Monthly audit archive (NFR-17, DEC-57, DEC-131, DEC-138)

- **Migration 0013:** `audit_log_append_only()` replaces the shared append-only function on `audit_logs` only. A DELETE passes when the transaction set `bmi.audit_archive = on` and the row is older than one year by the database clock; every UPDATE and every other DELETE raises the BR-10 error.
- **Port (`ports/audit-archive.ts`):** `monthsBefore(cutoff)` (the WIB months with rows before the cutoff), `rowsOf(from, to)` (every column) and `deleteRange(from, to)` (`SET LOCAL`, then DELETE, returning the count), plus `AuditGateway`.
- **Core (`core/audit/audit-archive.ts`):**
  - `archiveCutoff(wibToday)`: the WIB start of the run month minus 12 months; `wibMonthRange(month)`;
  - `AuditArchiveJob.run()`: per month, the CSV of every column (`toCsv`), its SHA-256, the write at `{env}/{yyyy}/{mm}/audit-archive/audit-{yyyy}-{mm}.csv` (an existing file is kept only when it matches), the read-back check, then one transaction that deletes the month (the count must equal the rows written) and writes the `audit_archive` record (`after`: file, month, records, sha256; by the system). A failing month is reported and the others still run;
  - `AREA_OF.audit_archive = Access`.
- **Shared:** `storageKey` takes `csv`; the fs adapter serves it as `text/csv`.
- **Infra:** `DrizzleAuditArchiveGateway` (`infra/db/audit-archive-gateways.ts`) and `AuditArchiveQueue` (cron `30 0 1 * *` in `Asia/Jakarta`), started in `worker.ts`, which logs each month's file, count and SHA-256, or its error.
- **Tests:** `test/integration/audit/audit-archive.test.ts` (rows in 2025 with the clock at 2026-11-01, because the trigger checks the real age) and `core/audit/audit-archive.spec.ts`.

### 5.22 Web upload: FileDrop, upload queue, PhotoViewer (REQ-FUP-006, 007, 012, 014, 016, DEC-139)

- **API follow-ups of TASK-114:** `UploadLinkRequest` takes `capturedAt` and `originalBytes` (the size before the browser compressed it, §9.12); `StoredFile` returns `uploadedBy { name, role }` and `uploadedAt`. The worker keeps the EXIF time when there is one, otherwise the time the browser sent.
- **`lib/uploads/prepare.ts`:** the device check of 8.1 step 2 (`sniffFileType`, `checkUpload`, the PDF page count) and step 3. JPEG is compressed down the profile quality ladder; HEIC and PNG go unchanged (the server converts HEIC and flattens transparency on white). The browser parts (`lib/uploads/browser.ts`) are `browser-image-compression` on the page, without its web worker (that worker loads the library from a CDN), `exifr` for the capture time and pdf.js (`lib/uploads/pdf.ts`, worker served by the app).
- **`lib/uploads/upload-queue.ts` (`UploadQueue`, framework free):** the items with the three user states, link, PUT and uploaded signal each done once with their Idempotency-Keys, 3 retries after 1, 2 and 4 s, a retry when the browser comes online, polling until Ready or Rejected, and `submitWhenReady(slots, submit)`, which runs the submit once when every file of the slots is done.
- **`components/files/UploadProvider.tsx`:** one queue in the `(app)` layout, so uploads and a pending Submit go on across navigation; `useUploads` reads it with `useSyncExternalStore`.
- **`components/files/FileDrop.tsx`:** the FileUploadStates artboard: the slot card, thumbnails with only the ring, check or red badge (the local copy until the server thumbnail is Ready), the drop area, the note, and the detail panel (Original, Stored, Profile, the sentence, Retry, Remove); `onUploadingChange` lets the screen ask once before leaving (REQ-FUP-014). `SubmitWhenReady` shows "Sending when photos finish…" (C-18) until the queue submits.
- **`components/files/PhotoViewer.tsx`:** the PhotoViewer artboard: the photo with zoom (to 400%), 100% and drag to pan, a PDF page by page fitted to the stage, previous and next across the record (C-29), the details (Step, Slot, Taken at, Uploaded by and role, Uploaded at), Close and Esc (C-14), and Remove only when the screen passes `onRemove`.
- **Kit gallery:** `components/dev/UploadsPreview.tsx` over an in-memory queue (development only).
- **Local setting:** with the filesystem storage, `STORAGE_PUBLIC_URL` must point at an origin the browser can PUT to (the web proxy `/api` locally); with R2 the bucket needs a CORS rule for the web origin (TASK-128).

### 5.23 Approver cancel (REQ-SPK-008, T15, TX-14, BR-06, DEC-140)

Written before code (WORKFLOW_STANDARDS §1 step 10); updated at the end of TASK-124 if the build differs. Plan: `docs/superpowers/plans/2026-11-20-task124-approver-cancel.md`.

- **Policy:** `SPK_POLICIES.approverCancel` needs spk.cancel (Supervisor, GM, System Admin) and an SPK in `OPEN_SPK_STATES` (every state but Completed and Cancelled, Draft and Rejected included). T6 (`cancel`, §5.13) is unchanged.
- **Port `SpkCancelSteps`** (`SpkGateways.cancelSteps`): `reversePostedIssues`, `releaseIssuedTyres`, `listPurchasedItems`, `leaveOpenSchedule`, `reopenReportBreakdown`, called in that order. The adapter `NoCancelStepsYet` does nothing; TASK-308, TASK-502, TASK-313, TASK-612 and TASK-610 fill one method each.
- **`SpkService.approverCancel`** under the Idempotency-Key, in one transaction: lock the SPK and assert `approverCancel`; the five steps; `spks.cancel` (Cancelled, `cancel_reason`, `cancelled_by`, at the version on screen); a `spk_approvals` row `Cancel` with the reason as note (stage Creation before Active, Amendment in Pending_Amendment, Completion otherwise); one audit record `approver_cancel` with the reason; a notice of kind Approval to the creator unless the creator cancels (executors from TASK-206).
- **Route:** `POST /spks/:id/approver-cancel`, needs spk.cancel and an Idempotency-Key, body `SpkCancelRequest`. A missing reason is 400; a refusal is 403, a final SPK included ("This SPK is already Completed or Cancelled.", as every policy refusal, like T6); an unknown id 404; a stale version 409.
- **Shared:** `APPROVER_CANCEL_STATUSES` (every state but Completed and Cancelled, Rejected included, unlike `OPEN_SPK_STATUSES`), kept equal to the From states of T15 by `machines.test.ts`; `approverCancel` in `SPK_ACTIONS`.
- **Web:** SPKDetail shows Cancel SPK in its header when `allowedActions` holds `approverCancel`; `ApproverCancelDialog` (in `CancelSpkDialog.tsx`, sharing the dialog of T6) is the CancelSPK artboard (reason required, Keep the SPK, Cancel SPK; the SPK document link hidden until TASK-212); after the cancel SPKDetail reloads Cancelled with the History row. A Rejected SPK shows SPKRejected (DEC-129), so its header carries the same Cancel SPK for an Approver who is not its creator; the creator keeps T6.
- **Tests:** `spk-policies.spec.ts`, `approver-cancel.spec.ts` (TX-14 order with a recording fake), `test/integration/spk/spk-approver-cancel.test.ts`, `approver-cancel-dialog.test.tsx`, `spk-detail.test.tsx`, `spk-rejected.test.tsx`, `e2e/approvals-flw-apr-05.spec.ts` with the seeded SPK "Approver cancel me". `playwright.config.ts` reads `E2E_SERVER_START_MS` (default 120 s) for slow local machines.
- **Moved out (DEC-140):** AssignStep to TASK-206, CorrectStepTime to TASK-204.

### 5.25 Engine core: approved design note (REQ-ENG-001 to 003, BR-05, TX-02, DEC-139, DEC-145, DEC-146)

Critical tier (§8.4). Reviewed before code under ADR-0002: an independent agent review in a separate session (`ecc:architect`, verdict "approve with changes", 2 blocking and 9 other findings) and the product owner, who approved the note with the changes (DEC-146). The review is recorded in `specs/evidence/TASK-202.tdd.md`.

- **Where:** `apps/api/src/engine/` (new): `step-lifecycle.ts` (pure functions: which step opens next, whether the SPK moves T7 or T11) and `step-service.ts` (`StepService.submit`). It imports `ports/`, `@bmi/shared`, `core/iam` and `core/idempotency` (DEC-146), never `modules/` or `infra/` (dependency-cruiser rule `engine-never-imports-a-module`, already in CI). Port `ports/engine.ts`: `EngineGateways` = the SPK and step rows locked for update, the step write methods, stored file statuses, notifications, audit, idempotency.
- **Freeze (DEC-145, DEC-146):** the `spk_assignments` rows are the frozen steps. Migration `0015` adds a trigger that, while the SPK is not Draft or Rejected, refuses an INSERT of a step, a DELETE of a step, and an UPDATE of `spk_id`, `module`, `sequence_no`, `step_config`, `is_optional`, `executor_roles` or `verifier_role`; the lifecycle columns stay writable. A test lists every column of `spk_assignments` as frozen or lifecycle, so a new column has to be placed. Change requests (TASK-611) apply a revision through a named exception, `SET LOCAL bmi.step_revision = 'on'`, as migration 0013 does for the audit archive.
- **Submit (`POST /spks/:id/steps/:stepId/submit`, Idempotency-Key, body `{ fileIds: number[] }`), one transaction:**
  1. lock in one fixed order, the SPK, then its steps, then the files (the same order in approve, cancel and change requests); the SPK must be Active or In_Progress (Pending_Amendment freezes the open step, T8);
  2. the step must be Open or In_Progress, moved by `transition(STEP_MACHINE, …, 'Submit')` (SM-STEP gains Open → Submitted, DEC-146; the "not paused" check comes with Pause in TASK-204); a submitted step gets 409 "This step is already submitted." for another key, the same key replays;
  3. L1: the actor holds the execute capability of the step's module, from one map in `@bmi/shared/permissions` (`MODULE_EXECUTE_CAPABILITY`; the tests' dummy module maps to `mechanic.execute`; an unknown module refuses). L2 (REQ-ENG-003): `passesExecutorCheck(role, executorRoles)` in `@bmi/shared`, true for one of the step's roles or the System Admin (RL-3, DEC-08); the same predicate serves `allowedActions` and later verify (TASK-205); no Setup-mode limit (a submit is not a decision, DEC-133);
  4. DEC-139, REQ-FUP-006, REQ-FUP-009: every `fileIds` file is locked, must be the actor's and unattached; a Rejected or Expired file refuses with its sentence, a Pending one with 409 "Wait until every file is ready." (the client queue retries with the same key); Rejected is checked first. The notice naming a Rejected file is written in its own unit of work after the refusal, so the rollback keeps it (dedupe `file:<id>:failed`). On success each file gets `attached_at`;
  5. the step becomes Submitted with `submitted_at` and `executed_by`; only the step at `sequence_no + 1` opens, and only while Locked (a resubmit after a Return opens nothing), with `opened_at`; its assignee, or else the users of its executor roles, are notified (dedupe `spk:<id>:step:<assignmentId>:open:a<attempt>`); the verifiers (Planners and the System Admin) are notified of the submit (REQ-NTF-005);
  6. T7: an Active SPK becomes In_Progress with `started_at` (the vehicle Repair status is TASK-604); T11: when no step is Locked, Open or In_Progress, the SPK becomes Pending_Verification. A one-step SPK runs T7 then T11 in the same transaction; each SPK status change goes through `transition(SPK_MACHINE, …)`, raises `spks.version` and writes its audit record;
  7. one audit record `step_submit` (entity `spk_assignment`, area SPK) with the step status before and after and the `fileIds`.
- **Policy:** `submit` is a step action in a policy table, so the step's `allowedActions` in SPKDetail equals what the server accepts (DEC-93), with the contract test per record type.
- **Not here:** the step time log (`step_time_events`, TASK-204), files attached to the step record (each module), verify and return (TASK-205), the module contract and hooks (TASK-203), any step screen or button (DEC-145).
- **Review answers (DEC-146):** (a) the System Admin exception stays, in one shared predicate behind the L1 check (DEC-93 governs L1 and L3; REQ-ENG-003 defines L2 by role); (b) the database trigger; (c) a Pending file refuses with 409, the client queue waits. Concurrency is tested with two submits in parallel on real transactions and a submit against a change request lock (T8 locks the SPK row too).

### 5.24 Engine tables (DEC-95, DEC-124, DEC-144)

Written before code (WORKFLOW_STANDARDS §1 step 10). Plan: `docs/superpowers/plans/2026-11-28-task201-engine-migrations.md`.

- **Migration `0014_engine_tables.sql`:** `spk_presets` (SD; the `UNIQUE (name, version)` of §9.6 becomes a unique index `WHERE deleted_at IS NULL`, §9.0), `spk_preset_steps`, `step_time_events`, `step_time_corrections`, `mobilisation_location_trail` (the last three AO with `refuse_change_of_append_only()`), `cr_number_seq` and `spk_change_requests`, `spk_check_items` (`sku` and `part_item_type_id` plain columns until TASK-301 and the part item task, DEC-124); then the foreign keys of `spks.preset_id`, `spk_attachments.check_item_id` and `spk_approvals.change_request_id`. Every foreign key `ON DELETE RESTRICT`; the standard columns of §9.0.
- **Drizzle:** the seven tables in `infra/db/schema/index.ts` and in `allTables`, so the D-12 drift check covers them.
- **No gateway method and no module row** (DEC-144): TASK-202 registers the dummy module in its harness and adds the methods it uses.

### 5.26 Module registry and contract: approved design note (REQ-REG-002, REQ-REG-005, REQ-REG-006, NFR-11, DEC-05, DEC-144, DEC-148, DEC-149)

Critical tier (§8.4). Reviewed before code under ADR-0002: an independent agent review in a separate session (`ecc:architect`, verdict "approve with changes", 3 blocking, 4 should-fix, 3 nits) and the product owner, who approved the note with every finding (DEC-149). The review is recorded in `specs/evidence/TASK-203.tdd.md`. No screen and no migration: `assignment_modules` (§9.6, migration 0009) already has every column.

- **Two halves of one module (DEC-148):** the row in `assignment_modules` (data, PR-6) and the code in `apps/api/src/modules/<folder>/` (one folder per module, §8.2). A module's own task adds both: the folder and a migration that inserts its row. Only migrations insert an `assignment_modules` row (the tests and the e2e seed insert the dummy's); TASK-215 edits only `name`, `sort_order` and `is_active`. The row is what the designer, the workspace and the SPK document read; the code is what runs on submit.
- **Contract in code (`engine/module-contract.ts`):**
  ```ts
  interface ModuleContract<G = void> {
    code: string;                         // = assignment_modules.code
    executeCapability: PermissionCode;    // DEC-148: replaces the DEC-146 map in @bmi/shared
    row: ModuleRowDefinition;             // what its migration writes (shared Zod, below)
    validateSubmit?(ctx: SubmitContext, gateways: G): Promise<ModuleRefusal | null>; // { status: 400 | 409, sentence }
    onSubmit?(ctx: SubmitContext, gateways: G): Promise<void>;                        // the module's TX, same transaction
  }
  interface SubmitContext { spkId; stepId; sequenceNo; stepConfig: unknown; actor: Actor; fileIds; now: Date }
  defineModule<G>({ contract: ModuleContract<G>, gateways: (tx: TxHandle) => G }): RegisteredModule
  ```
  A module parses `stepConfig` with its own Zod schema (equal to `row.configSchema`); a parse failure of a frozen step is a defect (500), not user input. `onVerify` (TASK-205) and the document rows (TASK-212) are added by the tasks that call them, by a DEC (DEC-144 rule).
- **Typed module gateways (DEC-149):** `defineModule` pairs a contract with the factory of its own port `G` (`ports/modules/<folder>.ts`, adapter in `infra/db/modules/`), so a wrong factory fails `tsc`. The registry turns each pair into `hooksOf(code): { validate(ctx, tx), submit(ctx, tx) } | null`, closures that build `G` on the engine's transaction handle; `G` never appears in the engine's types. `EngineGateways` gains only the opaque `tx: TxHandle`. Hooks do database work only, through `G`; an external effect (storage, push, queue) goes through the outbox. A module's own row locks come after the engine's (SPK, steps, files, then the module's rows, such as the TX-03 SKUs); cancel (TX-14) and change requests keep the same order. The dummy has `G = void`.
- **Row shapes (`@bmi/shared/src/registry/`, DEC-149):**
  - `config_schema` (step options) and the free fields of a creation section: `{ fields: { key, label, type: 'text'|'number'|'boolean'|'select', required, options? }[] }`;
  - `creation_schema` (null = the step shows only its name): `{ required: boolean, lists: ('parts_with_quantity'|'parts'|'tyre_sizes_with_quantity'|'parts_to_check'|'vehicle_document')[], fields }`, the kinds of the 4.3 contract table;
  - `scope_rules` and `completion_section`: a minimal strict object now (`{}` accepted, the columns are NOT NULL). Their full shape and the enforcement of the scope lock (BR-02) are decided by a DEC in TASK-306 (scope rules) and TASK-212 (completion section), before the first real module row is migrated. TASK-203 does not claim the scope-lock half of REQ-REG-006.
  - `ModuleRowSchema` adds `code` (`^[A-Z][A-Za-z_]{1,39}$`), `name`, `uiComponent`, `executorRoles` (at least one role), `costKind`, `tracksWorkTime`, `isActive`, `sortOrder`.
- **Code list (`src/app.modules.ts`, built so; the note said `modules/index.ts`):** `MODULES: RegisteredModule[]` sits at the composition root, because pairing a contract with its gateway adapter needs `infra/`, which a `modules/` file may not import. Nest gets it through the token `MODULE_LIST` (tests override it with test-only modules) and builds `ModuleCatalogService` under `MODULE_CATALOG`. The catalog and `RegistryService` receive the list in their constructors and import no module. `modules/dummy/` is always in the list: with no row in staging or production (DEC-144) it is never offered there; the harness and the e2e seed insert its row from `dummy.row`.
- **CI rules (DEC-149):** besides `engine-never-imports-a-module` and `module-never-imports-another-module`, `.dependency-cruiser.cjs` gains `core-never-imports-a-module` and `only-the-composition-root-imports-a-module` (only `app.modules.ts`, the module folders and test files may import `modules/`).
- **Registry service (`engine/registry/registry-service.ts`, 90 % coverage, D-09):** built from `MODULES` and `RegistryGateway` (port `ports/registry.ts`, Drizzle in `infra/db/registry-gateways.ts`). Refuses at construction two modules with one code or a `row` that fails `ModuleRowSchema`.
  - `list()`: every row by `sort_order`, then `name`, each with `isActive`, `implemented` (a contract has its code) and `offered` (active and implemented, REQ-REG-002, DEC-148).
  - `assertOfferable(code)`: refuses an inactive or unimplemented module, "This module is not available for new steps." "New use" (REQ-REG-005, DEC-149) is every way a step is added, each calling it: Create SPK (TASK-207), a preset saved or started from (TASK-208), a change request adding steps (TASK-611), and the SPKs the system drafts (TASK-610 breakdown, TASK-607 alerts and PM): a system draft is made without the step of an inactive module and the Planner is notified which step was left out.
  - `executeCapabilityOf(code)` and `executeCapabilities()` (the union over `MODULES`): the narrow port `ModuleCatalog` in `ports/registry.ts`, which `core/spk` depends on (§3 unchanged).
  - `hooksOf(code)`: the bound hooks or null.
  - `deactivate(actor, code, { reason })` and `activate(...)`: `registry.manage`, a reason of 1 to 500 characters, one transaction under an Idempotency-Key with an audit record (entity `assignment_module`, action `deactivate` or `activate`, before and after `is_active`, the reason); deactivating an inactive module or activating an active one is 409.
- **Deactivation (REQ-REG-005):** stops new use only. Steps already saved keep their module (a Draft included, which may still be submitted and approved, REQ-REG-004 adds no other rule), every SPK stays readable (the row is never deleted, BR-10), and a running step can still be submitted, so no SPK is stuck.
- **Engine changes (TASK-202 code, one commit):** `StepItem` gains `executeCapability: PermissionCode | null` from `ModuleCatalog.executeCapabilityOf(step.module)`, used by `StepService` and by `SpkListService` (SPKDetail `allowedActions`); a null refuses with "The module of this step is not available yet." (a row with no code, DEC-148). `moduleExecuteCapability` and its map leave `@bmi/shared`. The submit route's guard (`http/spks/module-execute.guard.ts`, after `SessionGuard`) and `stepPolicies(codes).submit.anyOf` both use `executeCapabilities()`, so a user with no execute code (Accounting) is refused at the guard and a new module touches no route. In `submitIn`, after the file checks: `validate` (its refusal is 400 or 409 with its sentence), then `submit`, then the engine's own writes; a throw rolls back the whole submit.
- **Gateway (`infra/db/registry-gateways.ts`):** reads the JSONB columns with the shared schemas strictly, so a stored row that does not fit them is a defect (500), not a silent default.
- **Routes (`http/registry/assignment-modules.controller.ts`, `@ApiContract`):** `GET /assignment-modules` (`registry.manage`; the list above), `POST /assignment-modules/:code/deactivate` and `/activate` (`registry.manage`, Idempotency-Key, body `{ reason }`); 400 without a reason, 404 for an unknown code, 409 as above. The name and palette order edit is TASK-215.
- **Contract test suite (`test/integration/registry/module-contract.suite.ts`, REQ-REG-006):** `describe.each(MODULES)`: the code is unique; `row` passes `ModuleRowSchema`; every role in `row.executorRoles` holds `executeCapability` in the seeded 2.2 matrix; the stored row (inserted for the dummy, migrated for a real module) equals `row` except `name`, `sort_order` and `is_active`; a step of the module in a one-step SPK is submitted through the engine route by an executor and refused for another role. A test-only second module, built in the test and not in `MODULES`, runs the same suite and submit with no engine change. TASK-207 adds the rule that a step's `executor_roles` are a subset of its module's.
- **Static checks (DEC-149, `test/integration/registry/static-checks.test.ts`):** no file of `apps/api/src/{engine,core,http,ports}` or `packages/shared/src/{permissions,machines,registry,schemas}` (tests excepted) contains a module-only code literal (`'Part_Purchase'`, `'Mechanic_Action'`, `'Part_Replacement'`, `'Mobilisasi'`, `'Dummy'`); `'Stock'`, `'Document'` and `'Part_Check'` are left out because they are also a cost kind, an SPK category or an SPK source (§9.1), and the trial and e2e seeds keep their code-less rows (DEC-148). No file in `apps/api/migrations/` inserts the dummy's code.
- **Tests RED first:** shared schema tests, the registry service unit test with a fake gateway, the step policy test for the null capability, the engine integration tests (hooks in the transaction, a refusing `validate` with 400 and 409, a throwing `submit` rolls back), the guard test (no execute code is 403 at the guard), the routes, the suite, the static checks. Every title starts with its ID (REQ-REG-002, REQ-REG-005, REQ-REG-006).

### 5.1 Sign-in and sessions (NFR-05, DEC-102, DEC-114)

- Passwords: scrypt hashes from `node:crypto` (OWASP parameters N=2^17, r=8, p=1; no native dependency); rules in `@bmi/shared` (`PasswordSchema`: at least 8 characters, letters and digits) so web, phone and API refuse the same input.
- `core/iam/AuthService` depends on `UserGateway`, `AuthSessionGateway`, `PasswordResetGateway`, `PasswordHasher`, `EmailPort` and `ClockPort` only. Five failures in a row set `locked_until = now + 15 min`; a success resets `failed_logins`. A locked, inactive or unknown account gets the same one-sentence refusal, except a locked one, which says it is locked and who unlocks it.
- A sign-in creates one `auth_sessions` row and returns a short-lived access token (JWT, 5 minutes, claims `sub` and `sid`) and an opaque refresh token (32 random bytes; only its SHA-256 is stored, rotated on every refresh). The guard checks the token and that its session is open: a web session closes 30 minutes after `last_seen_at` (touched at most once a minute), a mobile one at `expires_at` (30 days). Sign out ends its own row; a reset by link, an Access Manager reset and a deactivation set `revoked_at` on every open row of the user, and a password change on every row but the current one, so the next request on those devices is refused.
- Web: the Next.js app proxies `/api/*` to the API (same origin), and the API sets both tokens as `HttpOnly`, `Secure` (outside local), `SameSite=Strict` cookies; mutating requests also need the `Origin` of the web app. Phone: tokens in the response body, kept in Expo secure store.
- `must_change_password` lets the session reach only `POST /auth/change-password`, `POST /auth/sign-out` and `GET /me` until the password is changed.
- Forgot password: `POST /auth/forgot-password` always answers the same way (no account discovery); for an active account it voids older links, stores the SHA-256 of a new 32-byte token valid 60 minutes, and sends the link through `EmailPort`. Adapters: `FakeEmailAdapter` (tests), `ConsoleEmailAdapter` (local trial, prints the link), the provider adapter after Q-03. `POST /auth/reset-password` accepts a token once, sets the new password, clears the lock and `must_change_password`, and revokes every session.

## 6. Assignment engine and module registry (critical tier)

- The engine is built and tested first with `modules/dummy` (§8.3). It owns step order, freezing the steps at approval by locking their `spk_assignments` rows (TX-02, DEC-145), Locked → Open on the previous submit (BR-05), claim and assignment (REQ-ENG-011), the step time log (`step_time_events`, REQ-ENG-012 to 017, honouring `tracks_work_time`), verify and return attempts, and the completion request.
- Module contract (`engine/module-contract.ts`, §5.26, DEC-148, DEC-149): `code`, `executeCapability`, `row` (the values of its `assignment_modules` row) and the hooks `validateSubmit` and `onSubmit` on the module's own typed gateways; `onVerify` and the document rows come with TASK-205 and TASK-212. A module is registered by its `assignment_modules` row and wired only through it (REQ-REG-006).
- One contract test suite (`test/integration/registry/module-contract.suite.ts`, §5.26) runs against every module in `modules/index.ts`, current and future.
- The ENG/REG design note is reviewed before coding (§8.4), under ADR-0002 until an internal developer joins.

## 7. Transactions and jobs

- Migrations follow the TX-01 creation order; each release step adds the §9 groups it first needs.
- Daily job (TX-16, NFR-12, NFR-14): a BullMQ repeatable job at 00:30 WIB. Each sub-job (documents, PM and part items, tyres, schedule Missed / roll-forward / OFF days, late alerts, vehicle status) is idempotent through a unique index on its output (one pending alert per subject, `off_last_counted_date`) and is logged. Staging has a dry-run mode that lists what it would create (§8.3).
- Other jobs: daily stock reconciliation, cleanup of unattached uploads after 24 h (REQ-FUP-009), storage usage check (NFR-13), monthly audit archive (NFR-17), PDF rendering, exports.
- Notifications: an outbox row is written in the event's transaction; a worker delivers in-app (and push for the R1 mobile roles from step 7) with a dedupe key (§8.3), to the recipients of the REQ-NTF-005 matrix.
- Time: stored in UTC; a `ClockPort` gives "now" and the WIB calendar day; tests use a fake clock.

## 8. Files (8.1, NFR-06, NFR-13)

- `StoragePort` with `FsStorageAdapter` (local and tests: files under `.data/storage`, signed links are API URLs with an expiring HMAC token) and `R2StorageAdapter` (staging and production). Both pass one contract suite; the R2 run happens in CI against staging once Q-03 is answered (D-03).
- The client compresses per profile (Photo 1600 px, Document image 2400 px) and uploads through a signed link with an idempotency key; the worker re-checks type, size and dimensions and compresses anything uncompressed before Ready; only the compressed file and its thumbnail are kept.

## 9. Clients

- API contract first (§8.2): each route carries `@ApiContract` with its Zod schemas from `@bmi/shared`; the OpenAPI document is generated from the controllers, a route without a contract stops it, and an interceptor checks every response at run time; `pnpm gen:client` writes `@bmi/api-client` with openapi-typescript + openapi-fetch (D-04). CI fails when the committed client differs from a fresh generation.
- Web: Next.js App Router, TanStack Query over the generated client, the shell (floating rail, main sheet, pill tabs) and the kit re-created from DESIGN.md and the artboards. Menus from `GET /me`; buttons from `allowedActions`. Every screen is compared with its artboard (`ecc:browser-qa`) before its task closes.
- Mobile: Expo on an SDK that still supports Android 8 (NFR-18), expo-router, the same client; SQLite drafts and a photo queue offline (REQ-MOB-009); the location trail only while a Mobilisasi step is In_Progress and online.
- Chassis map (DEC-73, DEC-119): `@bmi/shared` `schemas/chassis-layout.ts` holds the definition schema (axles from the front with role, tyres per side and Close or Wide spacing, front drawing, spare count) and `generatePositions` (A<n>_L/R, A<n>_LO/LI/RI/RO, SP<n>, labels, ordinals), used by the API when a layout is saved (TASK-116) and by the map. `@bmi/chassis-map` turns a definition into pure geometry (`chassisGeometry`: rails, crossmembers, bumper or kingpin, fifth wheel over the drive axles, axles, tyres, spares in the first gap they fit, else behind the last axle), so a native renderer can reuse it, and draws it with the React `ChassisMap` (read only as an image; with `onSelect` each position is a button; a tyre shows only its code and status colour, Act now and Empty with a dashed outline; a guide under the map gives each colour with its status and meaning). Its style sheet is `@bmi/chassis-map/chassis-map.css` on the web tokens. Image snapshots: one standalone SVG per layout (the launch layouts, AC-PLC-007, AC-PLC-010 and the 108 generated ones) in `src/__image_snapshots__`, compared on every run; SVG, not PNG, so the comparison is the same on Windows and on the Linux CI.

## 10. Environments, local setup, CI and testing

| Item | Choice |
| --- | --- |
| Local services | PostgreSQL 16 and Redis inside the existing WSL Ubuntu 24.04, moved to D: (D-01); API, web and tests run on Windows against `localhost` |
| Integration DB isolation | migrations applied once to `bmi_template`; each Vitest worker gets `test_w<N>` created from it; tables truncated between test files; no per-test rollback (D-02) |
| Storage locally | filesystem adapter (D-03) |
| CI | GitHub Actions on every PR: install, lint, typecheck, unit, integration (Postgres and Redis service containers), Playwright, dependency-cruiser, client drift, migration drift, coverage gates (D-06) |
| Coverage | 80 % global; 90 % for `@bmi/shared` and `engine/`, which holds the module registry service in `engine/registry/` (D-09) |
| Branches and merges | `type/phaseN-taskNNN-slug`; RED and GREEN checkpoint commits on the branch; squash merge to `main` with the RED/GREEN summary in the PR body; evidence in `specs/evidence/TASK-nnn.tdd.md` (D-08) |
| Environments | development (local), staging, production; staging and production deploys wait for Q-03 |
| Staging seed | canvas example values re-typed as a staging-only seed script; never imported from artboards, never in production (ADR-0001) |

Test layers, naming and journeys: [tdd-user-journeys.md](tdd-user-journeys.md). `_Verify_` lines in tasks.md filter tests by AC or FLW ID.

## 11. Design decisions

| ID | Decision | Why | Origin |
| --- | --- | --- | --- |
| D-01 | Local Postgres 16 and Redis in WSL Ubuntu (moved to D:), no Docker | Little disk (C: 7,5 GB free); WSL already installed; real PostgreSQL as §8.2 requires | grilling Q4, Q10 |
| D-02 | One test database per worker from a template, truncate per file | Tests must exercise real commits, rollbacks and row locks (NFR-01, §8.3) | Q11 |
| D-03 | Filesystem storage adapter locally, R2 in staging, one contract suite | No MinIO install; NFR-13 adapter boundary kept | Q12 |
| D-04 | openapi-typescript + openapi-fetch, TanStack Query on top | Thin generated layer, same client on web and mobile | Q14 |
| D-05 | Plain transition tables and a pure `transition()` in `@bmi/shared`, no XState | State lives in the database; one table drives server, UI labels and tests (§8.3) | Q15 |
| D-06 | GitHub Actions with service containers; `main` accepts only green PRs | Runners have Docker without local disk cost | Q13 |
| D-07 | A gateway port per aggregate + UnitOfWork; Drizzle and locks inside infra | CLAUDE.md hexagonal rule; each TX-* is one `run` | Q16 |
| D-08 | Squash merge; RED/GREEN summary in the PR body and `specs/evidence/` | Clean `main` without losing the TDD proof | Q21, Q22 |
| D-09 | Coverage 80 % global, 90 % for shared, ENG and REG | Critical tier (§8.4) | Q23 |
| D-10 | Tasks are vertical slices per AC group or journey with Req/Journey/Skill/Verify/Depends lines; foundations are horizontal tasks | Small PRs, each proving one journey | Q17 |
| D-11 | Mobile spike split: sign-in, camera, location in Expo Go on the owner's phone over the LAN, with no Expo account (DEC-141); push and signed APK wait for Q-03 | Q-03 open; a local Android SDK is too large for the disk | Q18, DEC-141 |
| D-12 | Plain SQL migrations are the schema source; Drizzle definitions are checked for drift | §8.2 keeps enums, CHECKs and triggers in the database; §9 cannot change silently | PRD §8.2 |
| D-13 | One NestJS code base with HTTP and worker entry points | Shared services and transactions; two Cloud Run services | PRD §8.2 |
| D-14 | Spec files and code in English; a short Indonesian summary for the product owner in CONTEXT.md | Same terms as the PRD and the code | Q8 |
| D-16 | Local trial with a dummy seed (DEC-113, ADR-0003) | The owner tries each feature on a local database as it lands; `pnpm trial` migrates, seeds and runs the API and web app, `pnpm trial:reset` reseeds | PRD §10 |
| D-17 | One Expo code base for the Android APK and the mobile web app in Chrome on the phone (Expo Router web with react-native-web) | DEC-142: the field users must work from the phone browser or the app; one set of screens and rules; camera, position and push in the browser need HTTPS; the web build is served from the API's origin behind a proxy, so the API needs no CORS (DEC-143) | DEC-142, DEC-143 |
| D-15 | big.js for decimal money in `packages/shared` | Exact decimals with half-up rounding on web, phone and API; small, no dependencies, MIT; a private constructor keeps its settings local | NFR-16 |

ADRs (divergences): [ADR-0001](../docs/adr/0001-staging-seed-from-canvas-values.md), staging seed from canvas values (Q6); [ADR-0002](../docs/adr/0002-interim-review-rule.md), interim reviewer rule until an internal developer joins (Q20).

## 12. Skill map

Always on for every implementation task (not repeated on task lines): `ecc:search-first`, `ecc:coding-standards` + `typescript-pro`, `ecc:git-workflow`, `ecc:verification-loop`, `ecc:architecture-decision-records` (before any divergence), `ecc:tdd-workflow`.

| Area | Skills named on `_Skill_` lines |
| --- | --- |
| API | nestjs-expert, api-designer, fullstack-guardian, ecc:nestjs-patterns, ecc:backend-patterns, ecc:api-design, ecc:error-handling |
| Data seam | ecc:hexagonal-architecture |
| PostgreSQL | postgres-pro, database-optimizer, ecc:postgres-patterns, ecc:database-migrations, ecc:benchmark |
| Jobs | ecc:redis-patterns |
| Web | nextjs-developer, impeccable, frontend-design-direction, ecc:frontend-patterns, ecc:react-patterns, ecc:react-performance, ecc:design-system, ecc:make-interfaces-feel-better, ecc:motion-foundations, ecc:frontend-a11y |
| Mobile | react-native-expert, ecc:react-native-patterns, ecc:accessibility |
| Tests | test-master, ecc:react-testing, ecc:e2e-testing, ecc:browser-qa |
| Security | security-reviewer, ecc:security-review, ecc:production-audit |
| Deploy | ecc:deployment-patterns, ecc:docker-patterns, ecc:delivery-gate, ecc:canary-watch |
| Docs | code-documenter, ecc:living-docs-governance |

## 13. Spec tooling: how the specs stay identical to the PRD

| File | Role |
| --- | --- |
| `specs/tools/tasks.source.mjs` | The only hand-written part of the plan: per task its ID, phase, title, the explicit REQ IDs it builds, extra PRD IDs (AC, BR, SM, TX, NFR, RL, C-, NAV-, DQ-, DEC-), extra screens and tables, flows, dependencies, skill bundles, scope sentence, extra verify lines; plus `ACCEPTANCE_HOME` (an AC moved to the task where it can pass, with the reason) and `SCREEN_HOME` (the task that builds a screen several tasks touch) |
| `specs/tools/build-tasks.mjs` | Generates `specs/tasks.md`, `specs/decision-index.md` and `specs/acceptance-tests.md` (every AC with its area file, the task that writes its test RED, the journeys that also assert it, and the test name prefix). Tests come from three sources: acceptance criteria, user flows, and rules and machines (tdd-user-journeys.md §0.0). For every task it **derives** from the PRD: the screens (with their artboard links) and tables named by its requirements' Screens and Data columns, the rules of their Rules column, every AC that verifies them, and the `_Read_` list (area files, data-model sections, ui.md and ui-action-map.md rows, artboards, flows) |
| `specs/tools/check-coverage.mjs` | Reads the PRD directly and fails unless every P0 REQ (and the R1 part of REQ-NTF-002), every AC that verifies one, every BR, NFR, SM, TX, flow, P0 screen of the 7.3 inventory, §9 table, shared control C-*, NAV-*, DQ-* and decision is placed in a task, every screen has its artboard in `Design Artifact/`, and every task has `_Read_`, an `ecc:` skill and `_Verify_`. Deferred items are named in the tool with their PRD reason (Supervisor/GM mobile flow; the AI, tyre-minimum and push-mute tables) |

The checker runs in CI (TASK-008) and before a task is closed. When the PRD changes, the plan is regenerated and the checker shows what the change left unplaced.

## 14. Open questions

Tracked in [CONTEXT.md](CONTEXT.md) under Open questions; answered ones move into this file.
