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
| `engine/` | `core/` contracts, `ports/` | any `modules/*` folder (checked in CI, §8.3) |
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

### 5.1 Sign-in and sessions (NFR-05, DEC-102, DEC-114)

- Passwords: scrypt hashes from `node:crypto` (OWASP parameters N=2^17, r=8, p=1; no native dependency); rules in `@bmi/shared` (`PasswordSchema`: at least 8 characters, letters and digits) so web, phone and API refuse the same input.
- `core/iam/AuthService` depends on `UserGateway`, `AuthSessionGateway`, `PasswordResetGateway`, `PasswordHasher`, `EmailPort` and `ClockPort` only. Five failures in a row set `locked_until = now + 15 min`; a success resets `failed_logins`. A locked, inactive or unknown account gets the same one-sentence refusal, except a locked one, which says it is locked and who unlocks it.
- A sign-in creates one `auth_sessions` row and returns a short-lived access token (JWT, 5 minutes, claims `sub` and `sid`) and an opaque refresh token (32 random bytes; only its SHA-256 is stored, rotated on every refresh). The guard checks the token and that its session is open: a web session closes 30 minutes after `last_seen_at` (touched at most once a minute), a mobile one at `expires_at` (30 days). Sign out ends its own row; a reset by link, an Access Manager reset and a deactivation set `revoked_at` on every open row of the user, and a password change on every row but the current one, so the next request on those devices is refused.
- Web: the Next.js app proxies `/api/*` to the API (same origin), and the API sets both tokens as `HttpOnly`, `Secure` (outside local), `SameSite=Strict` cookies; mutating requests also need the `Origin` of the web app. Phone: tokens in the response body, kept in Expo secure store.
- `must_change_password` lets the session reach only `POST /auth/change-password`, `POST /auth/sign-out` and `GET /me` until the password is changed.
- Forgot password: `POST /auth/forgot-password` always answers the same way (no account discovery); for an active account it voids older links, stores the SHA-256 of a new 32-byte token valid 60 minutes, and sends the link through `EmailPort`. Adapters: `FakeEmailAdapter` (tests), `ConsoleEmailAdapter` (local trial, prints the link), the provider adapter after Q-03. `POST /auth/reset-password` accepts a token once, sets the new password, clears the lock and `must_change_password`, and revokes every session.

## 6. Assignment engine and module registry (critical tier)

- The engine is built and tested first with `modules/dummy` (§8.3). It owns step order, freezing the steps as a JSON snapshot at approval (TX-02), Locked → Open on the previous submit (BR-05), claim and assignment (REQ-ENG-011), the step time log (`step_time_events`, REQ-ENG-012 to 017, honouring `tracks_work_time`), verify and return attempts, and the completion request.
- Module contract (`engine/module-contract.ts`): `code`, `creationSection` schema (what Create SPK collects), `stepForm` schema, `scopeRules` (BR-02), `validateSubmit(ctx)`, `onSubmit(ctx, tx)` (the module's TX), `onVerify?`, `documentSection` (input to the SPK document renderer), `costContribution`. A module is registered by its `assignment_modules` row and wired only through it (REQ-REG-006).
- One contract test suite (`engine/test/module-contract.suite.ts`) runs against every module folder, current and future.
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
- Chassis map: `@bmi/chassis-map` turns a layout into positions and draws them; image snapshot tests for every launch layout and the generated set (1–6 axles, single or dual, 0–2 spares, DEC-73).

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
| D-11 | Mobile spike split: sign-in, camera, location on a temporary Expo account; push and signed APK wait for Q-03 | Q-03 open; a local Android SDK is too large for the disk | Q18 |
| D-12 | Plain SQL migrations are the schema source; Drizzle definitions are checked for drift | §8.2 keeps enums, CHECKs and triggers in the database; §9 cannot change silently | PRD §8.2 |
| D-13 | One NestJS code base with HTTP and worker entry points | Shared services and transactions; two Cloud Run services | PRD §8.2 |
| D-14 | Spec files and code in English; a short Indonesian summary for the product owner in CONTEXT.md | Same terms as the PRD and the code | Q8 |
| D-16 | Local trial with a dummy seed (DEC-113, ADR-0003) | The owner tries each feature on a local database as it lands; `pnpm trial` migrates, seeds and runs the API and web app, `pnpm trial:reset` reseeds | PRD §10 |
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
