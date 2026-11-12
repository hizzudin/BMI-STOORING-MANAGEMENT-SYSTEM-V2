---
inclusion: always
---

# Structure and the patterns every task reuses

Full architecture, per-feature notes and the skill map: `specs/design.md` (read the sections the
task touches). Search for an existing helper before writing a new one (`ecc:search-first`).

## API (`apps/api`)

- `src/core/<area>/`: business logic. Never imports a DB driver, Drizzle or Nest (checked by
  `pnpm check:layers`). Depends on interfaces in `src/ports/`.
- `src/ports/<area>.ts`: gateway interfaces and row types.
- `src/infra/db/`: Drizzle gateways (`<area>-gateways.ts` exporting `<area>Gateways(tx)`),
  `schema/index.ts` (every table, listed in `allTables` for the drift test), `optimistic-lock.ts`.
- `migrations/NNNN_name.sql`: plain SQL, numbered, immutable once merged (checksums). §9.0
  conventions: id, created_at, updated_at on every table; `-- SD` tables have `deleted_at` and their
  unique indexes skip deleted rows; `-- OL` tables have `version`; `-- AO` tables get the
  `refuse_change_of_append_only()` trigger; every foreign key is `ON DELETE RESTRICT`.
  A column that refers to a table a later task builds is a plain column; that task adds the
  reference (DEC-124).
- `src/http/<area>/<area>.controller.ts`: `@UseGuards(SessionGuard)`, `@RequireCapability(...)`,
  `@ApiContract(...)` with the Zod schemas of `@bmi/shared`, `@ValidBody()`; one error filter per
  feature (404/400/409 with one sentence), registered in `app.module.ts`.
- `src/app.module.ts` is the composition root; DI tokens in `src/app.tokens.ts`.

Reuse, do not re-invent:

- `UnitOfWork<Gateways>.run(...)`: one transaction per action (§9.13 TX-*).
- `core/iam/actions.ts`: a `Policies` table per record answers both the check (`assertAllowed`) and
  the `allowedActions` of the response; `ActionRefusedError` becomes 403 with one sentence (C-34).
  Never decide a permission, menu item or button from the role name (DEC-93).
- `updateWithVersion` for every `-- OL` table: a stale version becomes 409 (NFR-03).
- `AuditGateway.write` once per write, with the reason when the action asks one.
- Notifications: `NotificationGateway.send(recipients, { kind, title, body, linkRecord, dedupeKey })`
  inside the transaction of the event; recipients by the REQ-NTF-005 matrix (DEC-125).
- Numbers: `DocumentNumberGateway.next(kind, createdAt)` (stored formats, own sequence, WIB date).

## Shared (`packages/shared`)

Zod schemas per area in `src/schemas/<area>.ts`, exported from `src/index.ts`. No `.transform()` in
request schemas (the OpenAPI contract must stay JSON Schema). Messages are one plain sentence.

## Web (`apps/web`)

- `app/(app)/<route>/page.tsx` stays thin; it renders a `components/<area>/<X>Pages.tsx` wrapper that
  wires `lib/<area>-api.ts` (generated client + `settle()`) and the router into a component that
  takes `api` and `navigate` props, so it can be tested with fakes.
- Kit: `Button`, `DataTable`, `Tabs`, `StatusPill`, `Field`, `Refusal`, `Panel`, `ConfirmDialog`,
  `useLeaveGuard`, and `PageHead` (crumb, title, status, actions). Colours and spacing come from the
  tokens in `app/globals.css` and `DESIGN.md`; re-create the look of the artboard, never copy its
  HTML or CSS.
- Shared controls of `docs/prd/ui-action-map.md`: C-12 leave guard, C-15 Save draft, C-16 Discard
  asks first, C-17 Save then "Saved.", C-31 New, C-32 Deactivate names what stops, C-34 one-sentence
  refusals.
- Hidden until built (DEC-122): a tab, button, column or field that a later task builds is hidden,
  not shown disabled.

## Tests

- Names start with the PRD IDs they prove (`REQ-...`, `AC-...`, `BR-...`, `DEC-...`, `FLW-...`).
- Shared and web: `*.test.ts(x)` next to the code. API unit: `src/**/*.spec.ts`. API integration:
  `test/integration/<area>/*.test.ts`; each file starts with an empty database, so seed what it needs
  (`seedRolePermissions()`, re-run the seed INSERT of a migration); `audit_logs` is append-only, so
  read rows above an id baseline.
- E2E: `apps/web/e2e/*.spec.ts`, one worker; names unique per attempt (`Date.now().toString(36)`);
  label lookups use `{ exact: true }` where the rail has a similar name (for example "Vehicles").
- A navigation that changes the route remounts the page: test it end to end, not only with a mocked
  `navigate`.
