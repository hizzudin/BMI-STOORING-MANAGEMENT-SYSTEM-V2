# TASK-203 Module registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A module is a registry row plus one code folder, and the engine runs any registered module (its execute capability and its submit hooks) without knowing its name. Offering, deactivating and activating modules goes through registry routes.

**Architecture:** `@bmi/shared` holds the row shapes. `engine/module-contract.ts` defines the contract and `defineModule`. `engine/registry/` has two parts: the pure `ModuleCatalog` (built from the composition root's module list, implements the narrow port `ports/registry.ts`) and `RegistryService` (database: list, deactivate, activate). The submit route and the step policy take their codes from the catalog, and `StepService.submit` runs the module's bound hooks inside its transaction. No screen, no migration.

**Tech Stack:** NestJS 11, Drizzle over PostgreSQL 16, Zod in `@bmi/shared`, Vitest (unit and int projects), dependency-cruiser.

**Spec:** `specs/design.md` §5.26 (approved note), §3; PRD DEC-148, DEC-149; `docs/prd/areas/4.3-reg.md`.

## Success criteria

- `pnpm --filter @bmi/api test -t "module contract"` and `pnpm --filter @bmi/api test:int -t "REQ-REG-002|REQ-REG-005|REQ-REG-006"` pass. Each test was seen failing first.
- No literal of a module-only code in business code, and `moduleExecuteCapability` is gone from `@bmi/shared`.
- `pnpm check:layers` passes with the two new rules, and `pnpm check:client` passes after the generated client is committed.
- Every TASK-202 step-submit test still passes.

## Workflow

| Step | Status |
| --- | --- |
| Claim, next-numbers (DEC-148, v2.60) | done |
| Owner questions (two rounds, deviation recorded) | done, DEC-148 |
| Design note §5.26, ADR-0002 agent review, owner approval | done, DEC-149 |
| This plan, owner approval ("Ya, setujui") | waiting |
| TDD tasks 1–6, gates, evidence, CONTEXT, AGENT_LOG | after approval |
| Second ADR-0002 review (independent agent on the branch diff), PR on "Ya, buat PR", merge on "Ya, merge setelah hijau" | end |

No screen changes, so there is no E2E or artboard QA. The CreateSPK regression check is the existing web tests plus `spk-detail` (step `allowedActions`).

## Global Constraints

- §3: `core/*`, `engine/` and `modules/*` never import `infra/`, Drizzle, `pg` or Nest HTTP. The engine never imports `modules/`. `core/spk` reaches the registry only through `ports/registry.ts`.
- DEC-148: only migrations insert real `assignment_modules` rows; the tests and the e2e seed insert the dummy's from `dummyModule.row`.
- DEC-149: hooks do database work only, through their own port `G`; lock order is SPK, steps, files, then module rows.
- Sentences (exact copy): `"This module is not available for new steps."`, `"The module of this step is not available yet."`, `"This module is already active."`, `"This module is already inactive."`, `"Give a reason."`, `"This module was not found."`.
- Every test title starts with the ID it proves. Run test packages one at a time with `--maxWorkers=1`.

## Decisions made in this plan (not in the note)

1. **The module list is `src/app.modules.ts`, not `modules/index.ts`.** Pairing a contract with its gateway factory needs `infra/` (for the adapter), and a `modules/` file may not import `infra/`. So the composition root holds the list. Nest gets it through the token `MODULE_LIST`, which lets a test override it with test-only modules.
2. **The catalog and the service are split.** `ModuleCatalog` (pure, no database) answers the engine and `core/spk`. `RegistryService` handles the database routes.
3. **Static check scope.** It scans `apps/api/src/{engine,core,http,ports}` and `packages/shared/src/{permissions,machines,registry,schemas}` for the module-only literals `'Part_Purchase'`, `'Mechanic_Action'`, `'Part_Replacement'`, `'Mobilisasi'` and `'Dummy'`. It leaves out `'Stock'`, `'Document'` and `'Part_Check'`, which are also cost kinds, categories or SPK sources (§9.1). Seeds (`infra/db/trial`, `e2e-database-cli`) keep their rows with no code (DEC-148).
4. **`GET /assignment-modules` returns `configSchema` and `creationSchema`, but not scope rules or completion section.** The designer (TASK-207) needs the first two. The other two have no consumer yet (DEC-149).
5. **A steps route guard, `ModuleExecuteGuard`, in `http/spks/`.** It runs after `SessionGuard` and refuses with 403 `NOT_ALLOWED` when the actor holds none of `catalog.executeCapabilities()`. `SessionGuard` stays free of engine imports.

## File Structure

| File | Change |
| --- | --- |
| `packages/shared/src/registry/index.ts` (+ `registry.test.ts`), `src/index.ts` | create: row shapes, list and status-change schemas |
| `packages/shared/src/permissions/index.ts`, `permissions.test.ts` | remove `MODULE_EXECUTE_CAPABILITY`, `moduleExecuteCapability` and their test |
| `apps/api/src/ports/unit-of-work.ts` | add `TxHandle` |
| `apps/api/src/ports/registry.ts` | create: `ModuleCatalog`, `RegistryGateway`, `RegistryGateways` |
| `apps/api/src/engine/module-contract.ts` (+ `.spec.ts`) | create: contract types, `defineModule` |
| `apps/api/src/engine/registry/module-catalog.ts` (+ `.spec.ts`) | create |
| `apps/api/src/engine/registry/registry-service.ts` (+ `.spec.ts`) | create |
| `apps/api/src/modules/dummy/dummy-module.ts` | create |
| `apps/api/src/app.modules.ts`, `app.tokens.ts`, `app.module.ts` | create the list; token `MODULE_LIST`; wiring |
| `apps/api/src/engine/step-policies.ts`, `step-service.ts` (+ new `step-policies.spec.ts`) | `stepPolicies(codes)`, `executeCapability`, hooks |
| `apps/api/src/ports/engine.ts`, `infra/db/engine-gateways.ts` | `EngineGateways.tx`; `lockSteps` also returns `stepConfig` |
| `apps/api/src/core/spk/spk-list-service.ts` | `ModuleCatalog` in its constructor |
| `apps/api/src/infra/db/registry-gateways.ts` | create |
| `apps/api/src/http/spks/steps.controller.ts`, `http/spks/module-execute.guard.ts` | guard |
| `apps/api/src/http/registry/assignment-modules.controller.ts` | create: 3 routes and an error filter |
| `apps/api/src/core/audit/audit-format.ts` (+ spec) | `assignment_module: 'Settings'` |
| `.dependency-cruiser.cjs` | two rules |
| `apps/api/test/integration/registry/{module-contract.suite.ts,module-contract.test.ts,assignment-modules.test.ts,engine-hooks.test.ts,static-checks.test.ts}` | create |
| `apps/api/test/integration/harness/modules.ts` | create: `insertModuleRow(row)`, `testModule(...)` |
| `packages/api-client/*` | regenerate |

## Interfaces

```ts
// @bmi/shared registry
FieldSchema = z.object({ key, label, type: z.enum(['text','number','boolean','select']), required: z.boolean(), options: z.array(z.string()).optional() }).strict()
ConfigSchemaSchema = z.object({ fields: z.array(FieldSchema) }).strict()
CreationSchemaSchema = z.object({ required: z.boolean(), lists: z.array(z.enum(['parts_with_quantity','parts','tyre_sizes_with_quantity','parts_to_check','vehicle_document'])), fields: z.array(FieldSchema) }).strict()
ScopeRulesSchema = z.object({}).strict()          // DEC-149: full shape in TASK-306
CompletionSectionSchema = z.object({}).strict()   // DEC-149: full shape in TASK-212
ModuleRowSchema = z.object({ code: z.string().regex(/^[A-Z][A-Za-z_]{1,39}$/), name: 1..100, uiComponent: 1..80,
  configSchema: ConfigSchemaSchema.nullable(), creationSchema: CreationSchemaSchema.nullable(), executorRoles: z.array(RoleSchema).min(1),
  scopeRules: ScopeRulesSchema, completionSection: CompletionSectionSchema, costKind: z.enum(['Parts','Labor','Document','None']),
  tracksWorkTime: z.boolean(), isActive: z.boolean(), sortOrder: z.number().int() })
AssignmentModuleSchema = ModuleRowSchema.omit({ scopeRules, completionSection }).extend({ implemented: z.boolean(), offered: z.boolean() })
AssignmentModuleListResponseSchema = z.object({ items: z.array(AssignmentModuleSchema) })
ModuleStatusChangeRequestSchema = z.object({ reason: z.string().trim().min(1, 'Give a reason.').max(500) })
type ModuleRow, AssignmentModule, ModuleStatusChangeRequest
```

```ts
// ports/unit-of-work.ts
export interface TxHandle { readonly __txHandle: never }      // opaque; infra casts its DbTransaction
// ports/registry.ts
export interface ModuleCatalog {
  executeCapabilityOf(code: string): PermissionCode | null;
  executeCapabilities(): readonly PermissionCode[];           // de-duplicated, sorted
  hooksOf(code: string): BoundHooksFactory | null;
  isImplemented(code: string): boolean;
}
export type BoundHooksFactory = (tx: TxHandle) => BoundHooks;
export interface BoundHooks { validate(ctx: SubmitContext): Promise<ModuleRefusal | null>; submit(ctx: SubmitContext): Promise<void> }
export interface SubmitContext { spkId: number; stepId: number; sequenceNo: number; stepConfig: unknown; actor: Actor; fileIds: readonly number[]; now: Date }
export interface ModuleRefusal { status: 400 | 409; sentence: string }
export interface RegistryGateway { list(): Promise<ModuleRow[]>; lock(code: string): Promise<ModuleRow | null>; setActive(code: string, isActive: boolean, at: Date): Promise<void> }
export interface RegistryGateways { modules: RegistryGateway; audit: AuditGateway; idempotency: IdempotencyGateway }
```
(`SubmitContext` and the refusal types live in `ports/registry.ts`, so `core` and `engine` both depend on the port, not on each other. `Actor` is imported type-only from `core/iam/actions`, as the ports already do.)

```ts
// engine/module-contract.ts
export interface ModuleContract<G = void> { code: string; executeCapability: PermissionCode; row: ModuleRow;
  validateSubmit?(ctx: SubmitContext, gateways: G): Promise<ModuleRefusal | null>; onSubmit?(ctx: SubmitContext, gateways: G): Promise<void> }
export interface RegisteredModule { contract: ModuleContract<unknown>; bind: BoundHooksFactory }
export function defineModule<G>(m: { contract: ModuleContract<G>; gateways: (tx: TxHandle) => G }): RegisteredModule
// engine/registry/module-catalog.ts
export class ModuleCatalogService implements ModuleCatalog { constructor(modules: readonly RegisteredModule[]); contractOf(code): ModuleContract<unknown> | null }
//   throws Error('Two modules share the code X.') / Error('The registry row of module X is invalid: …') at construction
// engine/registry/registry-service.ts
export class RegistryService { constructor(uow: UnitOfWork<RegistryGateways>, catalog: ModuleCatalog, clock: ClockPort);
  list(): Promise<AssignmentModule[]>; assertOfferable(code: string): Promise<void>;   // throws ModuleUnavailableError (409)
  deactivate(actor, code, req: ModuleStatusChangeRequest, key): Promise<IdempotentResponse>; activate(...same) }
export class ModuleNotFoundError (404), ModuleStateConflictError (409), ModuleUnavailableError (409)
// engine/step-policies.ts
export interface StepItem { spkStatus; module; status; executorRoles; executeCapability: PermissionCode | null }
export function stepPolicies(executeCodes: readonly PermissionCode[]): Policies<StepItem, StepAction>
// modules/dummy/dummy-module.ts
export const dummyModule: ModuleContract = { code: 'Dummy', executeCapability: 'mechanic.execute', row: { code: 'Dummy', name: 'Dummy step',
  uiComponent: 'DummyStep', executorRoles: ['Mechanic'], configSchema: null, creationSchema: null, scopeRules: {}, completionSection: {},
  costKind: 'None', tracksWorkTime: true, isActive: true, sortOrder: 0 } }
// app.modules.ts
export const MODULES: readonly RegisteredModule[] = [defineModule({ contract: dummyModule, gateways: () => undefined })]
```

## Review Focus

1. **A module row whose code has no contract (trial `Mechanic_Action`).** SPKDetail must list no `submit` for its step, and the route must refuse it with `"The module of this step is not available yet."` → Task 3 int test.
2. **A deactivated module with a running step.** The submit still succeeds (deactivation never strands an SPK) → Task 4 int test.
3. **A retried deactivate with the same Idempotency-Key.** It replays 200 and writes one audit record, not a 409 → Task 4.
4. **A user with no execute capability (Accounting).** Refused at the guard with 403 before the SPK is read; the response does not reveal whether the step exists → Task 3.
5. **An `onSubmit` that throws after `validate` passed.** The step stays Open, no file gets `attached_at`, no notice or idempotency row is written, and a retry with the same key runs again → Task 3.

---

### Task 1: Shared row shapes

**Files:** create `packages/shared/src/registry/index.ts`, `registry.test.ts`; modify `packages/shared/src/index.ts`.

- [ ] **Step 1: Failing tests** (`registry.test.ts`), each titled `REQ-REG-006 …`:
  - `ModuleRowSchema` accepts the dummy row;
  - it refuses code `'stock'`, code `'A'`, `executorRoles: []`, `costKind: 'Fuel'`;
  - `ScopeRulesSchema` refuses `{ vehicle: 'write' }` (strict, DEC-149);
  - `CreationSchemaSchema` accepts `{ required: true, lists: ['parts_with_quantity','tyre_sizes_with_quantity'], fields: [] }` (Stock) and refuses `lists: ['tyres']`;
  - `ModuleStatusChangeRequestSchema` refuses `'  '` with `'Give a reason.'` and refuses 501 characters.
- [ ] **Step 2:** `pnpm --filter @bmi/shared test -- registry` → FAIL (module not found).
- [ ] **Step 3:** implement the Interfaces block and export it from `src/index.ts`.
- [ ] **Step 4:** the same command → PASS; `pnpm --filter @bmi/shared typecheck` passes.
- [ ] **Step 5:** commit `feat(shared): module registry row shapes [TASK-203, REQ-REG-006, DEC-149]`.

### Task 2: Contract, dummy module and catalog

**Files:** create `ports/registry.ts`, `engine/module-contract.ts` (+ spec), `engine/registry/module-catalog.ts` (+ spec), `modules/dummy/dummy-module.ts`, `app.modules.ts`; modify `ports/unit-of-work.ts`.

**Interfaces:** consumes Task 1. Produces `ModuleCatalog`, `defineModule`, `MODULES`, `dummyModule` as above.

- [ ] **Step 1: Failing unit tests**, titles starting with `REQ-REG-006 module contract`:
  - `defineModule` binds hooks that receive the factory's gateways (a fake `G` recording calls); a contract without hooks binds `validate → null` and a no-op `submit`;
  - the catalog answers `executeCapabilityOf('Dummy') === 'mechanic.execute'` and `executeCapabilityOf('Mechanic_Action') === null`;
  - `executeCapabilities()` de-duplicates (two modules with one capability give `['mechanic.execute']`);
  - construction throws on two modules with code `Dummy` and on a row with `executorRoles: []`;
  - `MODULES` holds `dummyModule`.
- [ ] **Step 2:** `pnpm --filter @bmi/api test -t "module contract"` → FAIL.
- [ ] **Step 3:** implement. The catalog validates each `contract.row` with `ModuleRowSchema` and checks `row.code === contract.code`.
- [ ] **Step 4:** → PASS; `pnpm check:layers` passes.
- [ ] **Step 5:** commit `feat(engine): module contract, dummy module and catalog [TASK-203, REQ-REG-006, DEC-148, DEC-149]`.

### Task 3: Engine reads the module from the catalog (one commit, nit 10)

**Files:** modify `engine/step-policies.ts`, `engine/step-service.ts`, `ports/engine.ts`, `infra/db/engine-gateways.ts`, `core/spk/spk-list-service.ts`, `http/spks/steps.controller.ts`, `app.tokens.ts`, `app.module.ts`, shared `permissions/index.ts` and its test; create `engine/step-policies.spec.ts`, `http/spks/module-execute.guard.ts`, `test/integration/registry/engine-hooks.test.ts`, `test/integration/harness/modules.ts`.

**Interfaces:**
- Consumes `ModuleCatalog` and `MODULES`.
- Produces `stepPolicies(codes)`, the tokens `MODULE_LIST` and `MODULE_CATALOG` (provider `ModuleCatalogService` from `MODULE_LIST`), `StepService(uow, clock, catalog)`, `SpkListService(uow, catalog)`.
- Produces `insertModuleRow(row: ModuleRow)` and `testModule(code, overrides)`, which returns a `RegisteredModule` with `executeCapability 'mechanic.execute'`, roles `['Mechanic']` and the given hooks.

- [ ] **Step 1: Failing unit test** (`step-policies.spec.ts`): `REQ-REG-006 a step whose module has no code is refused "The module of this step is not available yet."`; and `REQ-ENG-003 the policy takes its L1 codes from the catalog`, where `stepPolicies(['mechanic.execute']).submit.anyOf` equals `['mechanic.execute']`.
- [ ] **Step 2: Failing int tests** (`engine-hooks.test.ts`). The app is built with `overrideProvider(MODULE_LIST)`, holding the dummy plus test modules `Hooked_Ok`, `Hooked_Refuse400`, `Hooked_Refuse409` and `Hooked_Throw`, rows inserted by `insertModuleRow`.
  - `REQ-REG-006 onSubmit runs in the submit's transaction`: `Hooked_Ok`'s test gateway factory writes an `audit_logs` row on the engine's transaction; after the submit both that row and `Submitted` exist.
  - `REQ-REG-006 validateSubmit refuses with its status and sentence`: 400 and 409, with the step still Open.
  - `REQ-REG-006 a throwing onSubmit rolls the submit back`: the step is Open, `attached_at` is null, there is no `idempotency_keys` row, and a retry with the same key gives 500 again (Review Focus 5).
  - `REQ-REG-006 a step of a row with no code`: SPKDetail lists no `submit`; the route answers 403 with the sentence (Review Focus 1).
  - `REQ-ENG-003 an Accounting user is refused 403 at the guard` for an unknown SPK id 999999 too (no 404, Review Focus 4).
- [ ] **Step 3:** run `pnpm --filter @bmi/api test -t "REQ-REG-006|REQ-ENG-003" --maxWorkers=1` and `pnpm --filter @bmi/api test:int -- registry/engine-hooks --maxWorkers=1` → FAIL.
- [ ] **Step 4: Implement.**
  - `EngineStepRow` gains `stepConfig: unknown`; `EngineGateways` gains `tx: TxHandle`.
  - `submitIn` sets `item.executeCapability` from the catalog. After `checkFiles` it binds the hooks: `validate` first, where a refusal throws `StepInvalidError` (400) or `StepConflictError` (409); then `submit`.
  - `STEP_POLICIES` becomes `stepPolicies(catalog.executeCapabilities())`, built in the constructor. `holdsModuleCapability` uses `item.executeCapability`; when it is null the rule returns the "not available yet" sentence.
  - `ModuleExecuteGuard` is applied on the route after `SessionGuard`, replacing `@RequireCapability(five codes)`.
  - Remove the shared map and its test.
- [ ] **Step 5:** both commands → PASS. Also `pnpm --filter @bmi/api test:int -- engine/step-submit spk/ --maxWorkers=1` → every TASK-202 and SPK test still passes.
- [ ] **Step 6:** commit `feat(engine): execute capability and submit hooks from the module catalog [TASK-203, REQ-REG-006, DEC-148, DEC-149]`.

### Task 4: Registry service, gateway and routes

**Files:** create `engine/registry/registry-service.ts` (+ spec), `infra/db/registry-gateways.ts`, `http/registry/assignment-modules.controller.ts`, `test/integration/registry/assignment-modules.test.ts`; modify `core/audit/audit-format.ts` (+ spec), `app.module.ts`.

- [ ] **Step 1: Failing unit tests** (fake gateway):
  - `REQ-REG-002 list marks offered only for an active row with code, sorted by sort_order then name`;
  - `REQ-REG-005 assertOfferable refuses an inactive or unimplemented module "This module is not available for new steps."`;
  - `REQ-REG-005 deactivate writes is_active false and one audit record with the reason`;
  - `REQ-REG-005 deactivating an inactive module is 409 "This module is already inactive."`; and the same for activate.
- [ ] **Step 2: Failing int tests** (`assignment-modules.test.ts`). Rows: Dummy (code), `Mechanic_Action` (no code), and an inactive test module.
  - `REQ-REG-002 GET /assignment-modules offers only active rows with code`: `offered` is true only for Dummy, with the Planner and the System Admin; Mechanic gets 403.
  - `REQ-REG-005 deactivate needs a reason (400 "Give a reason."), 404 for an unknown code, 403 for a Mechanic`.
  - `REQ-REG-005 deactivate then GET shows Dummy not offered; activate brings it back; each writes an audit record with entity assignment_module, the reason and before/after is_active`.
  - `REQ-REG-005 the same Idempotency-Key replays without a second audit record` (Review Focus 3).
  - `REQ-REG-005 BR-10 an SPK with a step of a deactivated module stays readable and its running step can still be submitted` (Review Focus 2).
- [ ] **Step 3:** run both → FAIL.
- [ ] **Step 4: Implement.**
  - Controller under `SessionGuard` with `@RequireCapability('registry.manage')` and `@ApiContract`: operations `listAssignmentModules`, `deactivateAssignmentModule` and `activateAssignmentModule`, the two POSTs with `IdempotencyKey`.
  - `RegistryErrorFilter` maps 404 and 409.
  - The gateway's `lock` uses `FOR UPDATE`.
  - Add `assignment_module: 'Settings'` to the audit area map.
- [ ] **Step 5:** → PASS.
- [ ] **Step 6:** commit `feat(registry): list, deactivate and activate modules [TASK-203, REQ-REG-002, REQ-REG-005]`.

### Task 5: Contract suite, static checks, CI rules

**Files:** create `test/integration/registry/module-contract.suite.ts`, `module-contract.test.ts`, `static-checks.test.ts`; modify `.dependency-cruiser.cjs`.

- [ ] **Step 1: Write the suite.** `runModuleContractSuite(modules: readonly RegisteredModule[])` runs `describe.each` with these tests, each titled `REQ-REG-006 <code> …`:
  - the code is unique;
  - the row passes `ModuleRowSchema`;
  - every executor role holds `executeCapability` in `defaultRolePermissions()`;
  - the stored row equals `row` except `name`, `sort_order` and `is_active` (the dummy's row is inserted by `insertModuleRow`; for a real module the suite reads the migrated row and fails when it is missing);
  - an executor submits a one-step SPK (200), and a Driver is refused (403).
- [ ] **Step 2:** `module-contract.test.ts` runs the suite over `MODULES` and over `[testModule('Second_Module')]` with the app built on that list. `static-checks.test.ts`:
  - `REQ-REG-006 no business file names a module-only code` (decision 3);
  - `DEC-149 no migration inserts the Dummy row`.
- [ ] **Step 3:** prove that they fail. Temporarily give `dummyModule.executeCapability` the value `'stock.issue'`: the role test must fail. Add `'Mechanic_Action'` to a scratch file under `src/core`: the static check must fail. Revert both and record the failing output in the evidence.
- [ ] **Step 4: Add the rules.**
  - `core-never-imports-a-module`: from `^apps/api/src/core/` to `^apps/api/src/modules/`.
  - `only-the-composition-root-imports-a-module`: from `^apps/api/src/` with pathNot `^apps/api/src/(app\.modules\.ts|modules/)` to `^apps/api/src/modules/`.
  - Prove each fails on a scratch import, then revert.
- [ ] **Step 5:** the suite, the static checks and `pnpm check:layers` → PASS.
- [ ] **Step 6:** commit `test(registry): module contract suite and static checks [TASK-203, REQ-REG-006, DEC-149]`.

### Task 6: Client, gates, bookkeeping

- [ ] Run `pnpm gen:client && pnpm --filter @bmi/api-client build` and commit the client.
- [ ] Gates: check:coverage, check:kiro-skills, check:secrets, format, lint, typecheck, check:client, check:layers. Then one at a time: shared unit, web unit (functions ≥ 80 %), API unit, full API int. The known local failures (BR-10 identity-schema, NFR-14 real-transactions, BullMQ when Redis is down) are listed apart and never counted as passed.
- [ ] Update design.md §5.26 wherever the build differs. Finish the evidence, set `done: true` in tasks.source and run `build-tasks`, add CONTEXT row 54 and the Active task line, and put the AGENT_LOG row on top with the workflow audit. Push.
- [ ] Second ADR-0002 review: an independent agent in a separate session reviews the branch diff. Record it in the evidence and the PR body. Then ask "Buat PR untuk TASK-203?".
