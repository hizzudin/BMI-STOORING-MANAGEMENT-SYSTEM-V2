# TASK-125: SPK List & Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement SPK List (8 tabs with filters) and SPK Detail (step tracker, step cards, 5 detail tabs) per REQ-SPK-010, REQ-SPK-011 and Design Artifact artboards.

**Architecture:** Next.js App Router (web), NestJS API, shared Zod schemas, Drizzle ORM, PostgreSQL, Zod, pnpm workspaces, Turborepo.

**Tech Stack:** TypeScript, Next.js 14 (App Router), React 18, NestJS, Drizzle ORM, PostgreSQL, Zod, pnpm workspaces, Turborepo.

**Spec:** 
- PRD: `docs/prd/areas/4.1-spk.md` (REQ-SPK-010, REQ-SPK-011, AC-SPK-*)
- Design Artifact: `Design Artifact/spk/SPKList.html`, `Design Artifact/spk/SPKDetail.html`
- Specs: `specs/tasks.md` (TASK-125), `specs/requirements.md`, `specs/design.md`
- Shared schemas: `packages/shared/src/schemas/spks.ts`

## Global Constraints

- **Entity name:** SPK everywhere (never "Work Order" or "WO") — DEC-106
- **Number format:** Indonesian (48.210 km, Rp 1.240.000, 2,4 mm) — NFR-09
- **Dates/times:** Stored UTC, shown Asia/Jakarta (WIB), `YYYY-MM-DD` / `HH:MM:SS` — NFR-14
- **Document numbers:** `CODE-yymmddNNNN` (SPK, RB, CR, GR, GI, SA, OB, TR, RD, TC, TY) — never reset, never reused — NFR-15
- **Money:** 2 decimals; average cost 4 decimals; markup rounded half-up per unit before multiply — NFR-16
- **Soft delete:** Core records never physically deleted — BR-10
- **Audit:** Every state change writes append-only `audit_logs` with before/after — NFR-02
- **Optimistic lock:** `version` column on mutable tables; second save refused with clear message — NFR-03
- **Permissions:** Three layers (L1 Capability, L2 Record Rule, L3 Interface) — DEC-93. Buttons from `allowedActions`, never role name.
- **Hexagonal architecture:** Domain (`core/**`) imports ONLY `ports/` + `packages/shared`. Never `infra/`, `@nestjs/*`, `drizzle-orm`.
- **TDD:** Tests from 3 sources — ACs (`specs/acceptance-tests.md`), FLWs (`specs/tdd-user-journeys.md`), rules/transitions (SM-SPK, BR-*). RED → GREEN → Refactor.
- **Artboard fidelity:** Match Design Artifact exactly (layout, colors, type, spacing, shapes, icons, states, motion) — DEC-96.

## Review Focus

| Input / Condition | Expected Behavior | Test Location |
|-------------------|-------------------|---------------|
| User without `spk.view` capability accesses SPK List | 403 with one-sentence message | TASK-125.1 (API) |
| User clicks SPK row they don't have `allowedActions` for on detail | Button not rendered; server refuses if called | TASK-125.3 (Detail actions) |
| SPK with `Inactive` vehicle appears in list | Never (REQ-SPK-013) | TASK-125.1 (List query) |
| Urgent SPK submitted while user offline | Push notification queued, delivered on reconnect | TASK-125.2 (Notification integration) |
| List tab counts mismatch actual filtered rows | Counts always match server response | TASK-125.1 (List query) |

---

### Task 125.1: SPK List API — List with Tabs, Filters, Pagination

**Files:**
- Create: `apps/api/src/http/spks/spk-list.controller.ts`
- Create: `apps/api/src/http/spks/spk-list.dto.ts`
- Modify: `apps/api/src/http/spks/spks.controller.ts` (add list endpoint)
- Create: `apps/api/src/core/spk/spk-list-service.ts`
- Modify: `packages/shared/src/schemas/spks.ts` (add list query/response schemas)
- Test: `apps/api/test/spk-list.int.test.ts`

**Interfaces:**
- Consumes: `SpkGateway.findList(filters, pagination)`, `SpkGateway.countList(filters)`
- Produces: `GET /spks` → `SpkListResponse` (items + tab counts)

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/test/spk-list.int.test.ts
it('GET /spks?tab=active returns only Active SPKs with tab counts', async () => {
  const res = await request(app.getHttpServer())
    .get('/spks?tab=active&page=1&pageSize=20')
    .set('Authorization', `Bearer ${plannerToken}`)
    .expect(200);
  expect(res.body.items.every(s => s.status === 'Active' || s.status === 'In_Progress' || s.status === 'Pending_Verification')).toBe(true);
  expect(res.body.tabCounts.active).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bmi/api test:int -- spk-list.int.test.ts`
Expected: FAIL — endpoint not implemented

- [ ] **Step 3: Add list query/response schemas to `packages/shared/src/schemas/spks.ts`**

```typescript
export const SpkListQuerySchema = z.object({
  tab: z.enum(['active', 'mine', 'draft', 'pending', 'rejected', 'completed', 'cancelled', 'all']).default('active'),
  search: z.string().optional(),
  type: z.enum(SPK_CATEGORIES).optional(),
  vehicleId: z.coerce.number().int().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type SpkListQuery = z.infer<typeof SpkListQuerySchema>;

export const SpkListItemSchema = SpkSchema.extend({
  currentStep: z.string().nullable(),
  waitingOn: z.string().nullable(),
});
export type SpkListItem = z.infer<typeof SpkListItemSchema>;

export const SpkTabCountsSchema = z.object({
  active: z.number().int(),
  mine: z.number().int(),
  draft: z.number().int(),
  pending: z.number().int(),
  rejected: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  all: z.number().int(),
});
export type SpkTabCounts = z.infer<typeof SpkTabCountsSchema>;

export const SpkListResponseSchema = z.object({
  items: z.array(SpkListItemSchema),
  tabCounts: SpkTabCountsSchema,
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type SpkListResponse = z.infer<typeof SpkListResponseSchema>;
```

- [ ] **Step 4: Implement `SpkListService` in `apps/api/src/core/spk/spk-list-service.ts`**

Signature:
```typescript
class SpkListService {
  constructor(private readonly unitOfWork: UnitOfWork<SpkGateways>) {}
  async list(actor: Actor, query: SpkListQuery): Promise<SpkListResponse>
  private async buildWhere(actor: Actor, query: SpkListQuery): Promise<SQL>
  private async getTabCounts(actor: Actor): Promise<SpkTabCounts>
}
```
Logic:
- Tab → status mapping: `active`→['Active','In_Progress','Pending_Verification','Pending_Amendment'], `mine`→steps where actor is executor/assignee, `draft`→['Draft'], `pending`→['Pending_Approval'], `rejected`→['Rejected'], `completed`→['Completed'], `cancelled`→['Cancelled'], `all`→all non-deleted
- Search: ILIKE on `spkNumber`, `title`, `licensePlate`
- Type filter: `category` enum
- Vehicle filter: `vehicleId`
- Pagination: offset/limit with total count
- Tab counts: single query with conditional aggregation

- [ ] **Step 5: Implement `SpkListController` in `apps/api/src/http/spks/spk-list.controller.ts`**

```typescript
@Get()
@RequireCapability('spk.view')
@ApiContract({
  operationId: 'listSpks',
  summary: 'List SPKs with tabs, filters, pagination',
  query: { name: 'SpkListQuery', schema: SpkListQuerySchema },
  response: { name: 'SpkListResponse', schema: SpkListResponseSchema },
})
async list(
  @CurrentSession() session: SignedIn,
  @Query(new ZodValidationPipe(SpkListQuerySchema)) query: SpkListQuery,
): Promise<SpkListResponse>
```

- [ ] **Step 6: Add gateway methods to `SpkGateway` interface (`apps/api/src/ports/spks.ts`)**

```typescript
interface SpkGateway {
  // ...existing
  findList(filters: SpkListFilters, pagination: Pagination): Promise<SpkRow[]>;
  countList(filters: SpkListFilters): Promise<number>;
  countByTab(actor: Actor): Promise<SpkTabCounts>;
}
```

- [ ] **Step 7: Implement gateway methods in `DrizzleSpkGateway` (`apps/api/src/infra/db/spk-gateways.ts`)**

Use Drizzle with conditional aggregation for tab counts, parameterized queries.

- [ ] **Step 8: Regenerate API client**

Run: `pnpm gen:client`

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @bmi/api test:int -- spk-list.int.test.ts`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/schemas/spks.ts apps/api/src/core/spk/spk-list-service.ts apps/api/src/http/spks/spk-list.controller.ts apps/api/src/http/spks/spk-list.dto.ts apps/api/src/ports/spks.ts apps/api/src/infra/db/spk-gateways.ts apps/api/test/spk-list.int.test.ts
git commit -m "feat(spk): list API with tabs, filters, pagination [TASK-125, REQ-SPK-010]"
```

---

### Task 125.2: SPK Detail API — Single SPK with Steps, Parts, Cost, History, Change Requests

**Files:**
- Create: `apps/api/src/http/spks/spk-detail.controller.ts`
- Create: `apps/api/src/http/spks/spk-detail.dto.ts`
- Modify: `apps/api/src/http/spks/spks.controller.ts` (add detail endpoint)
- Create: `apps/api/src/core/spk/spk-detail-service.ts`
- Modify: `packages/shared/src/schemas/spks.ts` (add detail response schema)
- Test: `apps/api/test/spk-detail.int.test.ts`

**Interfaces:**
- Consumes: `SpkGateway.findById`, `SpkGateway.findSteps`, `SpkGateway.findParts`, `SpkGateway.findCosts`, `SpkGateway.findHistory`, `SpkGateway.findChangeRequests`
- Produces: `GET /spks/:id/detail` → `SpkDetailResponse`

- [ ] **Step 1: Write the failing test**

```typescript
it('GET /spks/:id/detail returns steps, parts, cost, history, change requests', async () => {
  const res = await request(app.getHttpServer())
    .get(`/spks/${spkId}/detail`)
    .set('Authorization', `Bearer ${plannerToken}`)
    .expect(200);
  expect(res.body.steps).toHaveLength(4);
  expect(res.body.parts.items).toHaveLength(3);
  expect(res.body.cost.total).toBe(1728000);
  expect(res.body.history).toHaveLength(5);
  expect(res.body.changeRequests).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bmi/api test:int -- spk-detail.int.test.ts`
Expected: FAIL

- [ ] **Step 3: Add detail response schema to `packages/shared/src/schemas/spks.ts`**

```typescript
export const SpkStepDetailSchema = z.object({
  sequenceNo: z.number().int(),
  module: z.string(),
  name: z.string(),
  executorRole: z.array(z.enum(ROLES)),
  verifierRole: z.enum(ROLES),
  status: z.enum(ASG_STATUSES),
  statusLabel: z.string(),
  startedAt: z.string().nullable(),
  submittedAt: z.string().nullable(),
  verifiedAt: z.string().nullable(),
  cost: z.number(),
  isCurrentUserStep: z.boolean(),
  allowedActions: z.array(z.enum(STEP_ACTIONS)),
});

export const SpkPartDetailSchema = z.object({
  id: z.number().int(),
  partName: z.string(),
  source: z.enum(['Warehouse', 'Part_Purchase', 'External']),
  plannedQty: z.number(),
  usedQty: z.number(),
  unitPrice: z.number(),
  total: z.number(),
  step: z.string(),
});

export const SpkServiceDetailSchema = z.object({
  id: z.number().int(),
  serviceName: z.string(),
  code: z.string(),
  team: z.enum(['Internal', 'External']),
  price: z.number(),
  step: z.string(),
});

export const SpkCostSummarySchema = z.object({
  parts: z.number(),
  services: z.number(),
  stooring: z.number(),
  total: z.number(),
  byStep: z.array(z.object({
    step: z.string(),
    parts: z.number(),
    services: z.number(),
    stooring: z.number(),
    total: z.number(),
  })),
});

export const SpkHistoryItemSchema = z.object({
  when: z.string(),
  who: z.string(),
  action: z.string(),
  details: z.string().optional(),
});

export const SpkChangeRequestItemSchema = z.object({
  id: z.number().int(),
  crNumber: z.string(),
  raisedBy: z.string(),
  reason: z.string(),
  status: z.enum(CR_STATUSES),
  raisedAt: z.string(),
});

export const SpkDetailResponseSchema = z.object({
  spk: SpkSchema,
  steps: z.array(SpkStepDetailSchema),
  parts: z.object({ items: z.array(SpkPartDetailSchema), services: z.array(SpkServiceDetailSchema) }),
  cost: SpkCostSummarySchema,
  history: z.array(SpkHistoryItemSchema),
  changeRequests: z.array(SpkChangeRequestItemSchema),
  allowedActions: z.array(z.enum(SPK_DETAIL_ACTIONS)),
});
export type SpkDetailResponse = z.infer<typeof SpkDetailResponseSchema>;
```

- [ ] **Step 4: Implement `SpkDetailService` in `apps/api/src/core/spk/spk-detail-service.ts`**

Aggregates data from multiple gateways:
- Steps: `spk_assignments` with computed status labels, current user step detection
- Parts: `spk_parts` + `spk_services` joined with step info
- Cost: sums from parts + services + stooring (from `spk_assignments.stooring_fee`)
- History: `step_time_events` + `spk_approvals` + `spk_change_requests` unified timeline
- Change requests: `spk_change_requests` with status

- [ ] **Step 5: Implement `SpkDetailController` in `apps/api/src/http/spks/spk-detail.controller.ts`**

```typescript
@Get(':id/detail')
@RequireCapability('spk.view')
@ApiContract({
  operationId: 'getSpkDetail',
  summary: 'SPK detail with steps, parts, cost, history, change requests',
  response: { name: 'SpkDetailResponse', schema: SpkDetailResponseSchema },
})
async detail(
  @CurrentSession() session: SignedIn,
  @Param('id', ParseIntPipe) id: number,
): Promise<SpkDetailResponse>
```

- [ ] **Step 6: Add gateway methods and implement in `DrizzleSpkGateway`**

- [ ] **Step 7: Regenerate API client**

Run: `pnpm gen:client`

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm --filter @bmi/api test:int -- spk-detail.int.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/schemas/spks.ts apps/api/src/core/spk/spk-detail-service.ts apps/api/src/http/spks/spk-detail.controller.ts apps/api/src/ports/spks.ts apps/api/src/infra/db/spk-gateways.ts apps/api/test/spk-detail.int.test.ts
git commit -m "feat(spk): detail API with steps, parts, cost, history, CR [TASK-125, REQ-SPK-011]"
```

---

### Task 125.3: Web — SPK List Page (8 Tabs, Filters, DataTable)

**Files:**
- Create: `apps/web/components/spk/SpkList.tsx`
- Create: `apps/web/components/spk/SpkListTabs.tsx`
- Create: `apps/web/components/spk/SpkListFilters.tsx`
- Create: `apps/web/components/spk/SpkListTable.tsx`
- Create: `apps/web/components/spk/SpkListTabCounts.tsx`
- Create: `apps/web/app/(app)/spk/page.tsx` (replace SpkHome with SpkList)
- Modify: `apps/web/lib/spks-api.ts` (add list/detail methods)
- Test: `apps/web/e2e/flows/FLW-PLN-01.spec.ts` (list assertions), `apps/web/components/spk/SpkList.test.tsx`

**Interfaces:**
- Consumes: `spksApi.list(query)`, `spksApi.getTabCounts()`
- Produces: `/spk` page with tabs, filters, paginated table

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/components/spk/SpkList.test.tsx
it('renders 8 tabs with correct counts', async () => {
  render(<SpkList api={mockApi} />);
  await waitFor(() => expect(screen.getByText('Active (4)')).toBeInTheDocument());
  expect(screen.getByText('My steps (2)')).toBeInTheDocument();
  expect(screen.getByText('Draft (1)')).toBeInTheDocument();
  expect(screen.getByText('Pending approval (1)')).toBeInTheDocument();
  expect(screen.getByText('Rejected (1)')).toBeInTheDocument();
  expect(screen.getByText('Completed (0)')).toBeInTheDocument();
  expect(screen.getByText('Cancelled (0)')).toBeInTheDocument();
  expect(screen.getByText('All (9)')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bmi/web test -- SpkList.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add `list` and `getTabCounts` to `apps/web/lib/spks-api.ts`**

```typescript
list: (query: SpkListQuery) => settle(client().GET('/spks', { query })),
getTabCounts: () => settle(client().GET('/spks/tab-counts')),
```

- [ ] **Step 4: Implement `SpkListTabs` component**

8 tabs: Active, My steps, Draft, Pending approval, Rejected, Completed, Cancelled, All
Each shows count from `tabCounts`. Active tab highlighted.

- [ ] **Step 5: Implement `SpkListFilters` component**

Search input (SPK number, title, vehicle), Type select (PM/Corrective/Tyre/Document/Other), Vehicle select (autocomplete from API)

- [ ] **Step 6: Implement `SpkListTable` component**

Use `DataTable` kit component. Columns: SPK (link to detail), Vehicle (link to vehicle), Type, Status (StatusPill), Current step, Waiting on, Action (Open/View button based on `allowedActions`)

- [ ] **Step 7: Implement `SpkList` page component**

Composes tabs, filters, table. Handles pagination, tab switching, filter changes. Uses `useRouter` for navigation.

- [ ] **Step 8: Update `apps/web/app/(app)/spk/page.tsx`**

```tsx
import { SpkList } from '@/components/spk/SpkList';
export default function SpkRoute() {
  return <SpkList api={useWiring().api} />;
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `pnpm --filter @bmi/web test -- SpkList.test.tsx`
Expected: PASS

- [ ] **Step 10: Run E2E test for FLW-PLN-01 list assertions**

Run: `pnpm --filter @bmi/web e2e flows/FLW-PLN-01.spec.ts`
Expected: PASS

- [ ] **Step 11: Visual comparison with Design Artifact**

Run: `ecc:browser-qa` compare `localhost:3000/spk` with `Design Artifact/spk/SPKList.html`

- [ ] **Step 12: Commit**

```bash
git add apps/web/components/spk/SpkList.tsx apps/web/components/spk/SpkListTabs.tsx apps/web/components/spk/SpkListFilters.tsx apps/web/components/spk/SpkListTable.tsx apps/web/components/spk/SpkListTabCounts.tsx apps/web/app/\(app\)/spk/page.tsx apps/web/lib/spks-api.ts apps/web/components/spk/SpkList.test.tsx
git commit -m "feat(web): SPK List page with 8 tabs, filters, DataTable [TASK-125, REQ-SPK-010]"
```

---

### Task 125.4: Web — SPK Detail Page (Step Tracker, Step Cards, 5 Detail Tabs)

**Files:**
- Create: `apps/web/components/spk/SpkDetail.tsx`
- Create: `apps/web/components/spk/SpkStepTracker.tsx`
- Create: `apps/web/components/spk/SpkStepCard.tsx`
- Create: `apps/web/components/spk/SpkDetailTabs.tsx`
- Create: `apps/web/components/spk/SpkDetailParts.tsx`
- Create: `apps/web/components/spk/SpkDetailCost.tsx`
- Create: `apps/web/components/spk/SpkDetailHistory.tsx`
- Create: `apps/web/components/spk/SpkDetailChangeRequests.tsx`
- Create: `apps/web/components/spk/SpkContextPanel.tsx`
- Create: `apps/web/components/spk/SpkActionBar.tsx`
- Create: `apps/web/app/(app)/spk/[id]/page.tsx` (replace with SpkDetail)
- Test: `apps/web/components/spk/SpkDetail.test.tsx`, `apps/web/e2e/flows/FLW-PLN-01.spec.ts` (detail assertions)

**Interfaces:**
- Consumes: `spksApi.getDetail(id)`
- Produces: `/spk/[id]` page with step tracker, step cards, context panel, action bar, 5 tabs

- [ ] **Step 1: Write the failing test**

```typescript
it('renders step tracker with 4 steps: Verified, Open, Locked, Locked', async () => {
  render(<SpkDetail api={mockApi} spkId={1} />);
  await waitFor(() => {
    expect(screen.getByText('Stock')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Part Purchase')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Mechanic Action')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('Part Replacement')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bmi/web test -- SpkDetail.test.tsx`
Expected: FAIL

- [ ] **Step 3: Add `getDetail` to `apps/web/lib/spks-api.ts`**

```typescript
getDetail: (id: number) => settle(client().GET('/spks/{id}/detail', path(id))),
```

- [ ] **Step 4: Implement `SpkStepTracker` component**

Horizontal step indicator with status icons (done/now/locked), step names, module icons. Current step highlighted.

- [ ] **Step 5: Implement `SpkStepCard` component**

Each card: step number, module icon, name + executor role, status pill, timeline (submitted/verified times), action button (Open/View) based on `allowedActions`. "Mine" highlight for current user's step.

- [ ] **Step 6: Implement `SpkContextPanel` component**

Vehicle link, report reference link, odometer, planned day, work location, cost so far.

- [ ] **Step 7: Implement `SpkActionBar` component**

Buttons per `allowedActions`: SPK document, Raise change request (executor), Cancel SPK (Approvers), Reverse issue (WHM/SA).

- [ ] **Step 8: Implement 5 detail tab panels**

- **Steps** (default): Step tracker + step cards
- **Parts and services**: Two tables (Parts + Services) with source, planned/used, prices
- **Cost**: 4 metric cards (Parts, Services, Stooring, Total) + breakdown table
- **History**: Unified timeline table (step events + approvals + CRs)
- **Change requests**: Table with CR number, raiser, reason, status, date

- [ ] **Step 9: Implement `SpkDetail` page component**

Composes header (SPK number, title, status pill, priority pill), action bar, context panel, step tracker, step cards, detail tabs.

- [ ] **Step 10: Update `apps/web/app/(app)/spk/[id]/page.tsx`**

```tsx
import { SpkDetail } from '@/components/spk/SpkDetail';
export default function SpkDetailRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SpkDetail api={useWiring().api} spkId={Number(id)} />;
}
```

- [ ] **Step 11: Run test to verify it passes**

Run: `pnpm --filter @bmi/web test -- SpkDetail.test.tsx`
Expected: PASS

- [ ] **Step 12: Run E2E test for FLW-PLN-01 detail assertions**

Run: `pnpm --filter @bmi/web e2e flows/FLW-PLN-01.spec.ts`
Expected: PASS

- [ ] **Step 13: Visual comparison with Design Artifact**

Run: `ecc:browser-qa` compare `localhost:3000/spk/1` with `Design Artifact/spk/SPKDetail.html`

- [ ] **Step 14: Commit**

```bash
git add apps/web/components/spk/SpkDetail.tsx apps/web/components/spk/SpkStepTracker.tsx apps/web/components/spk/SpkStepCard.tsx apps/web/components/spk/SpkDetailTabs.tsx apps/web/components/spk/SpkDetailParts.tsx apps/web/components/spk/SpkDetailCost.tsx apps/web/components/spk/SpkDetailHistory.tsx apps/web/components/spk/SpkDetailChangeRequests.tsx apps/web/components/spk/SpkContextPanel.tsx apps/web/components/spk/SpkActionBar.tsx apps/web/app/\(app\)/spk/\[id\]/page.tsx apps/web/lib/spks-api.ts apps/web/components/spk/SpkDetail.test.tsx
git commit -m "feat(web): SPK Detail page with step tracker, cards, 5 tabs [TASK-125, REQ-SPK-011]"
```

---

### Task 125.5: Verification Gates & Coverage

**Files:**
- Modify: `specs/tools/tasks.source.mjs` (mark TASK-125 done)
- Create: `specs/evidence/TASK-125.tdd.md`

- [ ] **Step 1: Run ALL verification commands**

```bash
# Unit tests
pnpm --filter @bmi/shared test
pnpm --filter @bmi/api test
pnpm --filter @bmi/web test

# Integration tests
pnpm --filter @bmi/api test:int

# E2E tests
pnpm --filter @bmi/web e2e flows/FLW-PLN-01.spec.ts

# Coverage gates
node specs/tools/check-coverage.mjs --tests
# Must print: "Coverage OK"

# Artboard comparison
ecc:browser-qa SPKList
ecc:browser-qa SPKDetail
```

- [ ] **Step 2: Write evidence document**

`specs/evidence/TASK-125.tdd.md` with test results, artboard comparison screenshots, any deviations.

- [ ] **Step 3: Update tasks.source.mjs and regenerate**

Edit `specs/tools/tasks.source.mjs` → mark TASK-125 `[x]`
Run: `node specs/tools/build-tasks.mjs`
Run: `node specs/tools/check-coverage.mjs` → "Coverage OK"

- [ ] **Step 4: Update CONTEXT.md + AGENT_LOG.md**

- [ ] **Step 5: Commit**

```bash
git add specs/tasks.md specs/tools/tasks.source.mjs specs/evidence/TASK-125.tdd.md specs/CONTEXT.md AGENT_LOG.md
git commit -m "feat(spk): TASK-125 verified — SPK List + Detail complete [TASK-125, REQ-SPK-010, REQ-SPK-011]"
```

- [ ] **Step 6: Push and create PR**

```bash
git push origin feat/phase1-task125-spk-list-detail-v2
gh pr create --base main --head feat/phase1-task125-spk-list-detail-v2 --title "feat(spk): SPK List tabs + Detail with step cards [TASK-125]" --body "## Summary\nImplements TASK-125: SPK List (8 tabs, filters) and SPK Detail (step tracker, step cards, 5 tabs).\n\n## Verification\n- FLW-PLN-01 E2E passes\n- SPKList artboard comparison passes\n- SPKDetail artboard comparison passes\n- Coverage OK"
```

---

## Dependency Conflicts Confirmed

| Conflict | Resolution |
|----------|------------|
| **TASK-125 not on main** | Old implementation on `feat/task-125-spk-list-detail` — preserved. New branch `feat/phase1-task125-spk-list-detail-v2` from main. |
| **SPK Detail needs step data** | Steps come from `spk_assignments` (TASK-120 done). Engine step states (SM-STEP) from TASK-102 done. |
| **Parts/Services need inventory** | `spk_parts` + `spk_services` tables from TASK-120. Parts catalog from TASK-301 (Phase 3) NOT required — SPK Detail shows what's on the SPK, not master data. |
| **Cost needs stooring** | `spk_assignments.stooring_fee` from TASK-120. Mobilisasi step data from TASK-405 (Phase 4) NOT required — shows 0 if no Mobilisasi step. |
| **Change requests** | `spk_change_requests` table from TASK-120. CR API from TASK-611 (Phase 6) NOT required — detail shows existing CRs only. |

---

**Plan complete.** Ready for review and execution method selection.