# TASK-215 Settings Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A holder of `registry.manage` opens Settings › Modules, sees every module (status, open SPKs), renames one, reorders the Create SPK palette (drag or Move up/down, Save order), and deactivates or activates one with a reason; every save is audited and protected by an optimistic lock.

**Architecture:** Migration 0016 adds `version` and a unique `lower(name)` index to `assignment_modules`. `RegistryService` (engine/registry, critical tier, 90 % coverage) gains `rename` and `reorder` under `runIdempotent`, decided by two policy tables (`MODULE_PAGE_POLICIES`, `MODULE_POLICIES`) on rows locked in `id` order with `FOR NO KEY UPDATE`. Two new routes on the TASK-203 controller; the web page `/settings/modules` follows the Vendors pattern with native HTML5 drag and drop.

**Tech Stack:** NestJS, Drizzle + plain SQL migrations, PostgreSQL 16, Zod (`@bmi/shared`), openapi-fetch client, Next.js 16 App Router, Vitest + Testing Library, Playwright.

**Spec:** `specs/design.md` §5.27 (and the DEC-151 lines of §5.26); PRD DEC-148, DEC-150, DEC-151; `docs/prd/areas/4.3-reg.md` REQ-REG-005, REQ-REG-008; `docs/prd/ui-action-map.md` rows SettingsModules, DeactivateModule, ActivateModule; artboards `Design Artifact/settings/SettingsModules.html`, `DeactivateModule.html`, `ActivateModule.html`, `Settings.html`.

## Global Constraints

- Every test title starts with `REQ-REG-008` or `REQ-REG-005` (or the ID it proves).
- `core/`, `engine/`, `modules/` import no Drizzle, `pg` or Nest HTTP types; dependency-cruiser must stay green.
- Permissions only through `assertAllowed` / `allowedActions` (DEC-93); never a role name.
- Every mutating route needs an `Idempotency-Key` and runs inside `runIdempotent` (NFR-01).
- Name: trimmed, 1 to 100 characters, unique regardless of case. Reason: trimmed, 1 to 500.
- Sentences (exact): "Another module already has this name." · "The order must list every module once." · "This module is already inactive." · "This module is already active." · stale = `ConcurrentUpdateError` "Someone else saved this record first. Reload it and try again."
- Open SPKs: statuses `NOT_FINAL_SPK_STATUSES` (every status but Completed and Cancelled), `deleted_at IS NULL`, each SPK once, newest 50 numbers plus the full count.
- Lock order: `assignment_modules` rows always in `id` order; writers `FOR NO KEY UPDATE`; `assertOfferable` `FOR SHARE`.
- No module-only code literal in non-test source (static-checks test of TASK-203).
- Web: no new dependency; do not copy artboard HTML/CSS or sample data; status pills Active `ok`, Inactive `neu`, Not in code `warn`.
- Never stage the untracked `HANDOFF_PROMPT.md`, `check_*.js`, `apps/web/AGENTS.md`, `apps/web/next-env.d.ts`.

## Review Focus

1. **Registry with one row or none** (production starts empty): the page shows an empty table without errors, Save order stays disabled, Move up/down disabled — test in Task 6 (`modules.test.tsx` "empty registry") and Task 3 (`list()` page allowedActions with zero rows).
2. **A name that differs only by case or surrounding spaces** ("stock " vs "Stock"): trimmed and refused as taken for another module, accepted as unchanged for the same module — Task 3 service spec.
3. **Double click on Save order / network retry**: the same Idempotency-Key replays the first answer, never a stale 409 — Task 4 integration ("same key twice").
4. **Dragging a row onto itself or outside the table**: the local order is unchanged and Save order stays disabled — Task 6 (`modules.test.tsx` "drop on itself").
5. **A module renamed while the user has an unsaved order**: Save order still succeeds because versions are merged from the rename response — Task 6 ("reorder then rename then Save order").

---

### Task 1: E2E journey first (RED)

**Files:**
- Create: `apps/web/e2e/settings-modules.spec.ts`
- Modify: `apps/api/src/infra/db/e2e-database-cli.ts` (seed one more row `E2e_Codeless`, name "Wheel alignment", so the table has three rows and one Not in code; names stay distinct)

**Interfaces:** consumes `signIn(page, key)` from `e2e/spk-helpers.ts`.

- [ ] **Step 1: Write the spec** (serial):
  - `REQ-REG-008 DEC-150 the System Admin renames a module and reorders the palette`: sign in `systemAdmin`, `/settings` → link "Modules" → URL `/settings/modules`, h1 "Modules"; select row "Wheel alignment", status "Not in code"; Name ← "Wheel alignment E2E", Save → status "Saved."; Move up → "Palette order changed. Not saved yet."; Save order → "Saved."; reload, the row is one place higher; restore the name and the order at the end.
  - `REQ-REG-005 DEC-150 a Planner deactivates and activates a module with a reason`: sign in `planner`, open `/settings/modules`, select "Mechanic Action", Deactivate → dialog "Deactivate Mechanic Action?", Deactivate disabled until Reason is filled, fill "E2E check", Deactivate → pill "Inactive"; Activate → reason → Activate → "Active".
- [ ] **Step 2: Run** `pnpm --filter @bmi/web build`, then in `apps/web` `npx playwright test e2e/settings-modules.spec.ts` (with `TEST_DATABASE_URL`, `E2E_SERVER_START_MS=300000`). Expected: FAIL (no Modules link).
- [ ] **Step 3: Commit** `test(registry): settings modules e2e journey, RED [TASK-215, REQ-REG-008]`.

### Task 2: Migration 0016 and the shared shapes

**Files:**
- Create: `apps/api/migrations/0016_assignment_modules_name_version.sql`
- Modify: `apps/api/src/infra/db/schema/index.ts` (`assignmentModules.version`)
- Modify: `packages/shared/src/enums/index.ts`, `packages/shared/src/registry/index.ts`
- Test: `apps/api/test/integration/db/assignment-modules-0016.test.ts`, the registry schema test in `packages/shared`, `packages/shared/src/machines/machines.test.ts`

**Interfaces — produces:**
```ts
// enums/index.ts
export const NOT_FINAL_SPK_STATUSES: readonly SpkStatus[]; // SPK_STATUSES minus Completed, Cancelled
// registry/index.ts
export const MODULE_STATUSES = ['Active', 'Inactive', 'Not_in_code'] as const;
export const MODULE_ACTIONS = ['rename', 'deactivate', 'activate'] as const;
export const MODULE_PAGE_ACTIONS = ['reorder', 'openSpk'] as const; // openSpk: anyOf spk.view
export const ModuleNameSchema;          // z.string().trim().min(1).max(100)
export const AssignmentModuleSchema;    // + version:int, status, openSpkCount:int, openSpks:{id,spkNumber}[], allowedActions: MODULE_ACTIONS[]
export const AssignmentModuleListResponseSchema; // { items, allowedActions: MODULE_PAGE_ACTIONS[] }
export const ModuleRenameRequestSchema; // { name: ModuleNameSchema, version: int>=1 }
export const ModuleOrderRequestSchema;  // { items: { code: string, version: int>=1 }[] (min 1) }
```
`version` is NOT added to `ModuleRowSchema`. `NOT_FINAL_SPK_STATUSES` lives in `enums` (which `machines` imports), so it is a filter of `SPK_STATUSES` checked by a test against `SPK_MACHINE` and `APPROVER_CANCEL_STATUSES`, not derived from the machine at run time (design §5.27 line corrected in the same commit). `openSpk` is the page action for the SPK links (DEC-151, `spk.view`), so the web needs no capability lookup for them.

- [ ] **Step 1: Failing tests**
  - migration: `REQ-REG-008 0016 adds version 1 to every row`; `… lower(name) is unique` (insert "Stock" then "stock" → 23505); `… renumbers rows 1..n by sort_order, name, id` (three rows of sort_order 0 named C, A, B → A=1, B=2, C=3), on the pattern of `assignment-migrations.test.ts`.
  - shared: `NOT_FINAL_SPK_STATUSES` equals `SPK_MACHINE.states` minus `finals` and equals `APPROVER_CANCEL_STATUSES` as a set; `ModuleNameSchema.parse('  Stock  ') === 'Stock'`, `''` and 101 characters refused; `ModuleOrderRequestSchema` refuses `{ items: [] }`.
- [ ] **Step 2: Run** `pnpm --filter @bmi/shared test -t "REQ-REG-008"` and `pnpm --filter @bmi/api test:int -t "0016"` → FAIL.
- [ ] **Step 3: Implement.** Renumbering is one statement: `UPDATE assignment_modules m SET sort_order = r.n FROM (SELECT id, row_number() OVER (ORDER BY sort_order, name, id) AS n FROM assignment_modules) r WHERE m.id = r.id;`. Drizzle `version: integer('version').notNull().default(1)`.
- [ ] **Step 4: Run** both filters plus `pnpm --filter @bmi/api test:int -t "drift|conventions"` → PASS.
- [ ] **Step 5: Commit** `feat(db): assignment_modules version and unique name, migration 0016 [TASK-215, REQ-REG-008, DEC-150]`.

### Task 3: Policies, port and RegistryService (unit, fake gateway)

**Files:**
- Create: `apps/api/src/engine/registry/module-policies.ts`, `module-policies.spec.ts`
- Modify: `apps/api/src/ports/registry.ts`, `apps/api/src/engine/registry/registry-service.ts`, `registry-service.spec.ts`

**Interfaces — produces:**
```ts
// ports/registry.ts
export type StoredModuleRow = ModuleRow & { id: number; version: number };
export interface OpenSpks { count: number; items: { id: number; spkNumber: string }[] }
export interface RegistryGateway {
  list(): Promise<StoredModuleRow[]>;                               // ORDER BY sort_order, id
  openSpks(limit: number): Promise<Map<string, OpenSpks>>;
  lock(code: string): Promise<StoredModuleRow | null>;              // FOR NO KEY UPDATE
  lockAll(): Promise<StoredModuleRow[]>;                            // ORDER BY id FOR NO KEY UPDATE
  holdForUse(codes: readonly string[]): Promise<StoredModuleRow[]>; // ORDER BY id FOR SHARE
  nameTaken(name: string, exceptId: number): Promise<boolean>;
  rename(id: number, name: string, version: number): Promise<StoredModuleRow>;    // ConcurrentUpdateError | ModuleNameTakenError
  setOrder(id: number, sortOrder: number, version: number): Promise<StoredModuleRow>;
  setActive(id: number, isActive: boolean, version: number): Promise<StoredModuleRow>;
}
export class ModuleNameTakenError extends Error {} // "Another module already has this name."
// engine/registry/module-policies.ts
export const MODULE_POLICIES: Policies<StoredModuleRow, ModuleAction>;
export const MODULE_PAGE_POLICIES: Policies<null, ModulePageAction>;
// engine/registry/registry-service.ts
list(actor: Actor): Promise<AssignmentModuleListResponse>;
rename(actor, code, req: ModuleRenameRequest, key): Promise<IdempotentResponse>;  // body AssignmentModule
reorder(actor, req: ModuleOrderRequest, key): Promise<IdempotentResponse>;         // body AssignmentModuleListResponse
deactivate / activate                                                              // same signature; 403 on a wrong state
assertOfferable(gateways, codes: readonly string[]): Promise<void>;
export class ModuleOrderInvalidError extends Error {} // 400, "The order must list every module once."
```
`ModuleStateConflictError` is deleted. Status: `Not_in_code` when `!catalog.isImplemented(code)`, else `Active` or `Inactive`.

- [ ] **Step 1: Failing tests** (`registry-service.spec.ts` with the existing fake gateway extended; `module-policies.spec.ts`):
  - policies: `REQ-REG-008 rename, deactivate on an active row and reorder are allowed with registry.manage`; `… none without it` (NOT_ALLOWED); `REQ-REG-005 deactivate of an inactive row refuses "This module is already inactive."`, activate mirrored; `openSpk` needs `spk.view`.
  - `list`: items carry status (three cases), `openSpkCount`, `openSpks`, `allowedActions`; the page `allowedActions` with zero rows is `['reorder', 'openSpk']` for a Planner.
  - `rename`: writes and audits `{ entity: 'assignment_module', action: 'rename', before: { name: 'Stock' }, after: { name: 'Gudang' } }`; `'  Gudang '` is stored as `'Gudang'`; an unchanged name answers 200 with no write and no audit; a taken name in another case → `ModuleNameTakenError`; stale version → `ConcurrentUpdateError`; unknown code → `ModuleNotFoundError`; no capability → `ActionRefusedError`; the response has the new version.
  - `reorder`: three rows → sort 1..3, only changed rows written, one audit `{ entity: 'assignment_modules', entityId: 0, action: 'reorder', before: { order }, after: { order } }`; duplicate code or unknown code → `ModuleOrderInvalidError`; a row missing from the body or a stale version → `ConcurrentUpdateError`; the same order → no write, no audit.
  - `deactivate` of an inactive module → `ActionRefusedError` "This module is already inactive."; the response has the new version.
  - `assertOfferable(g, ['A', 'B'])` calls `holdForUse` once; inactive or unimplemented → `ModuleUnavailableError`; a missing code → `ModuleNotFoundError`.
- [ ] **Step 2: Run** `pnpm --filter @bmi/api test -t "REQ-REG-00[58]"` → FAIL.
- [ ] **Step 3: Implement.** `reorder` asserts the page policy with record `null` before locking, then `lockAll()`, then validates. `rename`: lock → assert → version → trim and unchanged → `nameTaken` → write.
- [ ] **Step 4: Run** the filter and the API unit coverage; `engine/` ≥ 90 % → PASS.
- [ ] **Step 5: Commit** `feat(registry): rename and reorder in the registry service with module policies [TASK-215, REQ-REG-008, REQ-REG-005, DEC-151]`.

### Task 4: Drizzle gateway, routes, audit format, client (integration)

**Files:**
- Modify: `apps/api/src/infra/db/registry-gateways.ts`, `apps/api/src/http/registry/assignment-modules.controller.ts`, `apps/api/src/core/audit/audit-format.ts` (+ spec)
- Create: `apps/api/test/integration/registry/registry-edit.test.ts`
- Modify: `apps/api/test/integration/registry/assignment-modules.test.ts` (409 → 403 for already inactive or active)
- Regenerate: `packages/api-client`

**Interfaces — produces:** `PATCH /assignment-modules/{code}` (`renameAssignmentModule`) and `PUT /assignment-modules/order` (`reorderAssignmentModules`); `RegistryErrorFilter` maps `ModuleNotFoundError` 404, `ModuleOrderInvalidError` 400, `ModuleNameTakenError` and `ModuleUnavailableError` 409 (`ConcurrentUpdateError` and `ActionRefusedError` are already mapped globally; check it).

- [ ] **Step 1: Failing tests** (`registry-edit.test.ts`, harness `startEngineApp`, `insertModuleRow`, `insertSpkWithSteps`):
  - `REQ-REG-008 PATCH renames with an audit record`; 400 for `''`; 409 name taken; 409 stale version; 404 unknown; 403 for an Accounting account.
  - `… the same Idempotency-Key twice replays 200` (Review Focus 3).
  - `… two parallel renames of one module: one 200, one 409` (real transactions, `Promise.all`).
  - `… two modules renamed in parallel to one name: one 200, one 409 "Another module already has this name."` (the unique index path).
  - `… PUT order renumbers and audits once; 400 duplicate; 409 missing row; 409 stale`.
  - `… a reorder in parallel with a transaction that inserted steps of two modules in the opposite id order: both finish` (a `testPool()` client: `BEGIN`, insert the two steps, start the reorder, `COMMIT`, await both; no 40P01).
  - `… GET lists status, openSpkCount and the newest numbers, leaving out Completed, Cancelled and deleted SPKs and counting an SPK with two steps once`.
  - `… the allowedActions contract` with `findContractBreaks` for the record and the page.
  - audit-format spec: `recordOf({ entity: 'assignment_modules', entityId: 0 })` → "Module palette order"; summaries "Name: Stock → Gudang" and "Order: A, B, C → A, C, B".
- [ ] **Step 2: Run** `pnpm --filter @bmi/api test:int -t "REQ-REG-00[58]"` → FAIL.
- [ ] **Step 3: Implement** the gateway (`rename`, `setOrder` and `setActive` call `updateWithVersion`, then select the row by id; a Postgres `23505` on `uq_assignment_modules_name` → `ModuleNameTakenError`; `openSpks` runs the SQL of design §5.27, grouped in code, newest 50), the two controller methods (`@ApiContract`, `@RequireCapability('registry.manage')`, `@IdempotencyKey()`, `hashRequest`), and the list route with `actorOf(session)`.
- [ ] **Step 4: Run** the filter, then `pnpm --filter @bmi/api test:int -t "REQ-REG"`, `pnpm gen:client && pnpm --filter @bmi/api-client build`, `pnpm check:client`, the dependency-cruiser check → PASS.
- [ ] **Step 5: Commit** `feat(registry): rename and order routes, open SPKs, gateway locks in id order [TASK-215, REQ-REG-008, DEC-151]`.

### Task 5: Settings home card by capability

**Files:**
- Modify: `apps/web/components/shell/SignedInShell.tsx` (provide a `CapabilitiesContext` from `me.capabilities`; export `useCapabilities(): ReadonlySet<PermissionCode>`), `apps/web/components/settings/SettingsHome.tsx` (card `{ label: 'Modules', href: '/settings/modules', icon: 'box', needs: 'registry.manage' }` after SPK presets; a card with `needs` shows only when it is held), `apps/web/app/(app)/settings/page.test.tsx`

- [ ] **Step 1: Failing test** `REQ-REG-008 DEC-151 the Modules card shows only with registry.manage` (rendered inside the provider, with and without the code).
- [ ] **Steps 2 to 4:** `pnpm --filter @bmi/web test -t "REQ-REG-008"` FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat(web): Modules card on the Settings home by capability [TASK-215, REQ-REG-008]`.

### Task 6: The Modules page

**Files:**
- Create: `apps/web/lib/registry-api.ts`, `apps/web/components/settings/Modules.tsx`, `ModulesPage.tsx`, `modules.test.tsx`, `apps/web/app/(app)/settings/modules/page.tsx`
- Modify: `apps/web/app/globals.css` (grip cell and order bar, tokens only)

**Interfaces — produces:**
```ts
export function registryApi(given?: ApiClient): {
  list(): Promise<Outcome<AssignmentModuleListResponse>>;
  rename(code: string, body: ModuleRenameRequest): Promise<Outcome<AssignmentModule>>;
  reorder(body: ModuleOrderRequest): Promise<Outcome<AssignmentModuleListResponse>>;
  deactivate(code: string, body: ModuleStatusChangeRequest): Promise<Outcome<AssignmentModule>>;
  activate(code: string, body: ModuleStatusChangeRequest): Promise<Outcome<AssignmentModule>>;
};
export type RegistryApi = ReturnType<typeof registryApi>;
export function Modules({ api }: { api: RegistryApi }): JSX.Element;
```
Each mutation sends an Idempotency-Key made per click, as the other web APIs do.

- [ ] **Step 1: Failing tests** (`modules.test.tsx`, a fake api as in `vendors.test.tsx`):
  - `REQ-REG-008 lists modules in palette order with status pills and open SPK counts` (Active, Inactive, Not in code).
  - `… selecting a row fills the panel; Not in code shows "This module has no code yet; it is not offered in Create SPK."`
  - `… open SPK numbers are links to /spks/:id only when the page lists openSpk`.
  - `… Save sends the trimmed name with the version and shows Saved.`; `… Discard changes asks first`; `… selecting another row with a dirty name asks first`.
  - `… Move up and Move down change the local order, show "Palette order changed. Not saved yet." and are disabled at the ends`; `… Save order sends every code with its version in the new order and shows Saved.`
  - `… a drop moves the dragged row before the target`; `… a drop on itself changes nothing` (Review Focus 4).
  - `… reorder, then rename, then Save order sends the renamed module's new version` (Review Focus 5).
  - `… without reorder in the page actions there is no grip, no Move up or down and no Save order`; `… Name is read only without rename`.
  - `REQ-REG-005 Deactivate opens "Deactivate <name>?" naming the open SPK count; the button is disabled until a reason`; Activate mirrored; after success the pill changes.
  - `… a 409 shows its sentence and reloads the list`; `… an empty registry renders the table and disables the order buttons` (Review Focus 1).
- [ ] **Step 2: Run** `pnpm --filter @bmi/web test -t "REQ-REG-00[58]"` → FAIL.
- [ ] **Step 3: Implement** on the Vendors pattern (`DataTable` if it allows draggable rows, otherwise a plain table with the `tbl` class; a reason dialog as `ApproverCancelDialog` does; `useLeaveGuard(dirtyName || dirtyOrder)`; `StatusPill`). State: `saved: AssignmentModule[]`, `order: string[]` (codes), `versions: Map<string, number>`, updated from every response.
- [ ] **Step 4: Run** the filter, web typecheck and lint, then the full web test with coverage → PASS.
- [ ] **Step 5: Commit** `feat(web): Settings Modules page with rename, palette order and deactivate [TASK-215, REQ-REG-008, REQ-REG-005]`.

### Task 7: GREEN e2e, gates, QA, evidence, merge review

- [ ] **Step 1:** Redis up; run `e2e/settings-modules.spec.ts` → PASS; then every gate: `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm --filter @bmi/api test:int`, the dependency-cruiser check, `pnpm check:client`, `node specs/tools/check-coverage.mjs --tests`. The known local-only failures (BR-10 identity-schema, NFR-14 real-transactions, BullMQ without Redis, S3 skipped) are listed apart.
- [ ] **Step 2: QA** on `bmi_trial` (`api-trial-build` and `web-build`), 1440 × 900: SettingsModules (three states), both dialogs and the Settings home beside their artboards; fix drift.
- [ ] **Step 3:** `specs/evidence/TASK-215.tdd.md` (RED and GREEN per suite, the note review, QA, skills loaded); `tasks.source.mjs` `done: true` → `build-tasks.mjs`; `CONTEXT.md` row 55 and the resume block (PRD v2.63); `AGENT_LOG.md` with the workflow audit.
- [ ] **Step 4:** ADR-0002 merge review by an independent agent in a separate session on the branch diff; fold in the findings.
- [ ] **Step 5:** commit and push; report to the owner and wait for "Ya, buat PR".
