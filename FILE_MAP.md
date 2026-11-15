# File Map — BMI Stooring System v2

> **Annotated directory structure** — What each folder/file contains and why it exists.
> Read this to navigate the codebase quickly. Generated files marked **[GEN]**, source files marked **[SRC]**.

---

## Project Root

```
D:\project\BMI Stooring System v2\
├── AGENT_GUIDE.md           [SRC]  Single entry point for every agent/session (READ FIRST)
├── AGENT_LOG.md             [SRC]  Append-only log of agent actions across sessions
├── FILE_MAP.md              [SRC]  This file — annotated directory structure
├── WORKFLOW_STANDARDS.md    [SRC]  Enforced workflow for consistent agent behavior
├── CLAUDE.md                [SRC]  Project constitution (rules, constraints, SDD process)
├── PRD.md                   [SRC]  Core spec (SDD Spec v2) — ALWAYS WINS on behaviour/rules/data
├── DESIGN.md                [SRC]  Design tokens (colors, typography, spacing, components)
├── PRODUCT.md               [SRC]  Product summary for context
├── README.md                [SRC]  Project overview
├── package.json             [SRC]  Root pnpm workspace config
├── pnpm-workspace.yaml      [SRC]  Workspace package patterns
├── turbo.json               [SRC]  Turborepo pipeline config
├── .dependency-cruiser.cjs  [SRC]  Layer rules for CI (enforces hexagonal architecture)
├── .gitignore / .gitattributes / .prettierrc / .nvmrc / .editorconfig  [SRC]  Tool configs
└── .claude/                 [SRC]  Claude Code settings, hooks, skills, launch.json
```

---

## specs/ — Generated Spec Artifacts (Single Source of Truth for Implementation)

```
specs/
├── CONTEXT.md               [GEN]  Session journal — resume block, session log, key decisions, open questions, divergences
├── requirements.md          [GEN]  Index of all PRD IDs by release step (P0/P1/P2)
├── design.md                [GEN]  Architecture, file structure, skill map, ADR index
├── tasks.md                 [GEN]  Ordered implementation plan (checkboxes, REQ/AC/Verify/Skill lines) — EDIT tasks.source.mjs
├── acceptance-tests.md      [GEN]  Every AC as a test case (one per AC ID)
├── tdd-user-journeys.md     [GEN]  Every FLW as E2E spec (one per FLW ID)
├── decision-index.md        [GEN]  DEC tracking with status
├── evidence/                [GEN]  Per-task TDD evidence (TASK-nnn.tdd.md)
└── tools/                   [SRC]  Build scripts
    ├── tasks.source.mjs     [SRC]  **EDIT THIS** to add/change tasks — then run build-tasks.mjs
    ├── build-tasks.mjs      [SRC]  Generates tasks.md from tasks.source.mjs + PRD
    ├── check-coverage.mjs   [SRC]  Proves nothing in PRD is left out (must print "Coverage OK")
    ├── next-numbers.mjs     [SRC]  Lists claimed tasks + next free DEC/PRD version/migration/CONTEXT row
    └── serve-artifact.mjs   [SRC]  Serves Design Artifact for local viewing
```

---

## docs/ — Specification Documents (Part of PRD)

```
docs/
├── prd/
│   ├── areas/               [SRC]  One file per functional area (4.1 through 4.23 + 8.1)
│   │   ├── 4.1-spk.md       [SRC]  SPK lifecycle requirements + ACs
│   │   ├── 4.2-eng.md       [SRC]  Assignment engine (CRITICAL risk)
│   │   ├── 4.3-reg.md       [SRC]  Module registry, step composer, SPK presets (CRITICAL risk)
│   │   ├── 4.4-stk.md       [SRC]  Stock step (HIGH risk)
│   │   ├── 4.4a-pur.md      [SRC]  Part Purchase step
│   │   ├── 4.5-mec.md       [SRC]  Mechanic Action step
│   │   ├── 4.5a-mbl.md      [SRC]  Mobilisasi step (HIGH risk)
│   │   ├── 4.6-plc.md       [SRC]  Part Replacement + chassis map (HIGH risk)
│   │   ├── 4.7-doc.md       [SRC]  Vehicle documents
│   │   ├── 4.8-cr.md        [SRC]  Change request & amendment
│   │   ├── 4.9-spkd.md      [SRC]  SPK digital document
│   │   ├── 4.10-veh.md      [SRC]  Vehicles & odometer
│   │   ├── 4.11-pm.md       [SRC]  PM, inspections, breakdowns
│   │   ├── 4.11a-brk.md     [SRC]  Report Breakdown
│   │   ├── 4.12-bsl.md      [SRC]  Parts baseline
│   │   ├── 4.12a-ptr.md     [SRC]  Part traceability & performance
│   │   ├── 4.13-inv.md      [SRC]  Parts inventory (HIGH risk)
│   │   ├── 4.14-tyr.md      [SRC]  Tyres & retread
│   │   ├── 4.15-apr.md      [SRC]  Approvals inbox
│   │   ├── 4.16-dsh.md      [SRC]  Role dashboards
│   │   ├── 4.17-sch.md      [SRC]  Maintenance schedule
│   │   ├── 4.18-iam.md      [SRC]  Sign-in, accounts, access
│   │   ├── 4.19-ntf.md      [SRC]  Notifications
│   │   ├── 4.20-mob.md      [SRC]  Mobile app (HIGH risk)
│   │   ├── 4.21-rpt.md      [SRC]  Reports (P1)
│   │   ├── 4.22-ai.md       [SRC]  AI assistant (P1)
│   │   ├── 4.23-bil.md      [SRC]  Customers & invoices
│   │   └── 8.1-fup.md       [SRC]  File upload & compression
│   ├── data-model.md        [SRC]  Complete PostgreSQL schema (§9) — dependency order
│   ├── flows.md             [SRC]  User flows by role (FLW-*)
│   ├── ui.md                [SRC]  Layout, screen inventory, key layouts, shared components, navigation, brand
│   ├── ui-action-map.md     [SRC]  Every control on every screen + what it does (C-* + screen rows)
│   ├── traceability.md      [SRC]  Per area: specified, tested, shown, stored, guarded, walked through
│   └── history.md           [SRC]  Superseded decisions, retired requirements, assumption log
├── adr/                     [SRC]  Architecture Decision Records
│   ├── 0001-staging-seed-from-canvas-values.md
│   ├── 0002-interim-review-rule.md
│   └── 0003-local-trial-seed.md
├── dev-setup.md             [SRC]  Local development setup (WSL, PostgreSQL, Redis)
└── dev-setup-wsl.sh         [SRC]  WSL setup script
```

---

## Design Artifact/ — Visual Target (179 Pages, One Per Screen/Dialog/Panel)

```
Design Artifact/
├── index.html               [SRC]  Entry point — screen map with links to all 179 artboards
├── _kit/                    [SRC]  Shared design kit (bmi.css, kit.js) — tokens, components, interactions
├── shell/                   [SRC]  App shell, sign-in, notification center, user menu, confirm dialogs
├── spk/                     [SRC]  SPK screens (Create, List, Detail, Document, Revisions, etc.)
├── steps/                   [SRC]  Step execution screens (one per module)
├── approvals/               [SRC]  Approval inbox + review screens
├── fleet/                   [SRC]  Vehicles, documents, chassis, inspections, parts baseline
├── inventory/               [SRC]  Parts, tyres, stock, retread, goods receipts
├── settings/                [SRC]  All master data screens
├── access/                  [SRC]  Users, roles, permissions, audit
├── dashboard/               [SRC]  Role dashboards
├── schedule/                [SRC]  Maintenance schedule
├── billing/                 [SRC]  Customers & invoices
├── documents/               [SRC]  Document entry/correction
├── setup/                   [SRC]  Setup mode & Go live
├── reports/                 [SRC]  Reports (P1)
├── components/              [SRC]  Shared component references
└── mobile/                  [SRC]  27 mobile screens (Driver, Mechanic, FC, SA, Supervisor/GM)
```

---

## apps/api/ — NestJS API Server

```
apps/api/
├── src/
│   ├── main.ts              [SRC]  Bootstrap, global pipes, Swagger
│   ├── app.module.ts        [SRC]  Root module — imports all feature modules
│   ├── app.tokens.ts        [SRC]  DI tokens for gateway interfaces (hexagonal)
│   ├── worker.ts            [SRC]  BullMQ worker entry point
│   ├── core/                [SRC]  Domain logic (pure, no framework deps)
│   │   ├── iam/             [SRC]  Identity & access — capabilities, policies, auth
│   │   ├── fleet/           [SRC]  Vehicles, chassis, documents, odometer
│   │   ├── spk/             [SRC]  SPK lifecycle, steps, approvals, assignments
│   │   ├── notifications/   [SRC]  In-app notifications, outbox, delivery
│   │   └── idempotency/     [SRC]  Idempotency key validation
│   ├── http/                [SRC]  Controllers, DTOs, OpenAPI decorators
│   │   ├── auth/            [SRC]  Sign-in, password reset, sessions
│   │   ├── accounts/        [SRC]  Access Manager: accounts, roles, permissions
│   │   ├── role-permissions/ [SRC]  Roles & permissions matrix API
│   │   ├── planner-approval/[SRC]  Planner approval switch API
│   │   ├── spks/            [SRC]  SPK CRUD, approvals, steps, documents
│   │   ├── vehicles/        [SRC]  Vehicles, documents, chassis, odometer
│   │   ├── vehicle-classes/ [SRC]  Vehicle classes & chassis layouts
│   │   ├── document-types/  [SRC]  Document types master
│   │   ├── notifications/   [SRC]  Notification center, bell
│   │   ├── system-mode/     [SRC]  Setup mode & Go live
│   │   ├── openapi/         [SRC]  OpenAPI document generation
│   │   ├── contract.ts      [SRC]  @ApiContract decorator for runtime response validation
│   │   ├── concurrent-update.filter.ts  [SRC]  Optimistic lock exception filter
│   │   ├── contract.interceptor.ts      [SRC]  Response contract interceptor
│   │   ├── health.controller.ts         [SRC]  /health endpoint
│   │   └── idempotency-key.decorator.ts [SRC]  Idempotency key decorator
│   ├── infra/               [SRC]  Infrastructure adapters (implement ports)
│   │   ├── db/              [SRC]  PostgreSQL (Drizzle), migrations, gateways
│   │   │   ├── migrations/  [SRC]  SQL migration files (0001_... to 0010_...)
│   │   │   ├── *.gateway.ts [SRC]  Gateway implementations (implement ports/*)
│   │   │   ├── schema/      [SRC]  Drizzle table definitions
│   │   │   ├── e2e-database-cli.ts [SRC]  Test database management
│   │   │   └── connection.ts [SRC]  Database connection pool
│   │   ├── crypto/          [SRC]  Password hashing, token signing
│   │   ├── email/           [SRC]  Email adapter (console in dev, adapter in prod)
│   │   ├── queue/           [SRC]  BullMQ/Redis queue adapters
│   │   └── clock/           [SRC]  WIB clock (fake in tests)
│   └── ports/               [SRC]  Gateway interfaces (hexagonal — domain depends on these)
│       ├── iam.ts
│       ├── spks.ts
│       ├── vehicles.ts
│       ├── vehicle-classes.ts
│       ├── document-types.ts
│       ├── notifications.ts
│       ├── numbering.ts
│       ├── planner-approval.ts
│       ├── role-permissions.ts
│       ├── accounts.ts
│       ├── idempotency.ts
│       ├── queue.ts
│       ├── clock.ts
│       ├── errors.ts
│       ├── unit-of-work.ts
│       └── system-mode.ts
├── test/                    [SRC]  Integration tests (real PostgreSQL)
├── package.json
├── tsconfig.json
└── vitest.config.mjs
```

---

## apps/web/ — Next.js Web App (App Router, Desktop Browser Only)

```
apps/web/
├── app/                     [SRC]  App Router pages (route segments = folders)
│   ├── (app)/               [SRC]  Authenticated layout group
│   │   ├── spk/             [SRC]  SPK list, detail, create, document
│   │   ├── vehicles/        [SRC]  Vehicles master-detail, overview, edit
│   │   ├── settings/        [SRC]  All master data screens
│   │   ├── access/          [SRC]  Users & roles, permissions matrix, audit log
│   │   ├── approvals/       [SRC]  Approvals inbox, review screens
│   │   ├── schedule/        [SRC]  Maintenance schedule (Planner/FC views)
│   │   ├── inventory/       [SRC]  Parts, tyres, stock, retread
│   │   ├── dashboard/       [SRC]  Role dashboards
│   │   └── layout.tsx       [SRC]  AppShell with floating rail, header, bell
│   ├── auth/                [SRC]  Sign-in, password reset, change password
│   ├── layout.tsx           [SRC]  Root layout (fonts, globals.css)
│   └── globals.css          [SRC]  Design tokens + global styles (from DESIGN.md)
├── components/              [SRC]  React components
│   ├── shell/               [SRC]  AppShell, Bell, NotificationCenter, UserMenu, confirm dialogs
│   ├── spk/                 [SRC]  SpkList, SpkDetail, CreateSPK, StepTracker, StepCard, SpkDocument
│   ├── steps/               [SRC]  Stock, Mechanic, PartCheck, PartPurchase, Mobilisasi, Placement, DocStep
│   ├── fleet/               [SRC]  Vehicles, VehicleOverview, AddVehicle, VehicleEdit, VehicleChassis
│   ├── settings/            [SRC]  SettingsHome, ChassisLayouts, DocumentTypes, SPKPresets, etc.
│   ├── access/              [SRC]  UsersRoles, AMAccountForm, AMRolesPermissions, AMAccessHistory, AuditLog
│   ├── approvals/           [SRC]  Approvals, ApprovalReview, AmendmentReview, CompletionReview
│   ├── inventory/           [SRC]  GoodsReceipts, StockCard, ReceiveTyres, RetreadDispatch, etc.
│   ├── schedule/            [SRC]  MaintenanceSchedule, ScheduleMonth
│   ├── dashboard/           [SRC]  Role-specific dashboard components
│   ├── kit/                 [SRC]  Design system kit: Button, BusyButton, StatusPill, Tabs, DataTable, Icon, Input, Select, Dialog, ConfirmDialog, useLeaveGuard, useTablePreferences
│   └── ui/                  [SRC]  Primitive UI components (if any)
├── lib/                     [SRC]  Utilities & API clients
│   ├── api-client.ts        [SRC]  Generated from OpenAPI (packages/api-client)
│   ├── spks-api.ts          [SRC]  SPK-specific API helpers
│   ├── vehicles-api.ts      [SRC]  Vehicle API helpers
│   ├── system-mode-api.ts   [SRC]  System mode API helpers
│   ├── allowed-actions.ts   [SRC]  allowedActions hook for UI permissions
│   └── utils.ts             [SRC]  Formatters (Indonesian numbers, WIB dates), validators
├── e2e/                     [SRC]  Playwright E2E tests
│   ├── flows/               [SRC]  One spec per FLW (FLW-PLN-01.spec.ts, etc.)
│   ├── accounts.ts          [SRC]  Test accounts per role
│   ├── global-setup.ts      [SRC]  E2E database setup
│   └── fixtures/            [SRC]  Test fixtures
├── public/                  [SRC]  Static assets
├── package.json
├── tsconfig.json
├── next.config.ts
├── playwright.config.ts
├── vitest.config.mjs
└── AGENTS.md                [SRC]  Web-specific agent notes
```

---

## apps/mobile/ — Expo React Native (Android, Release 1)

```
apps/mobile/
├── app/                     [SRC]  Expo Router screens
│   ├── (auth)/              [SRC]  Sign-in, profile
│   ├── (app)/               [SRC]  Authenticated tabs per role
│   │   ├── driver/          [SRC]  Dashboard, Inspection, Report Breakdown, Odometer, History
│   │   ├── mechanic/        [SRC]  My Steps, Step screens (Mechanic, Part Check, Placement, Mobilisasi)
│   │   ├── fc/              [SRC]  Schedule, Fleet, Alerts, Part Purchase
│   │   ├── sa/              [SRC]  Field menu, Report Breakdown, Inspection
│   │   └── supervisor/      [SRC]  Approvals, Review, Fleet (P1)
│   └── _layout.tsx          [SRC]  Root layout, providers
├── src/                     [SRC]  Shared mobile code
│   ├── components/          [SRC]  Mobile-specific components
│   ├── hooks/               [SRC]  Mobile hooks (camera, location, offline queue, push)
│   ├── lib/                 [SRC]  API client, storage (Expo SecureStore, SQLite)
│   └── utils/               [SRC]  Formatters, validators
├── app.json                 [SRC]  Expo config (name, icons, permissions, plugins)
├── package.json
└── tsconfig.json
```

---

## packages/ — Shared Libraries

```
packages/
├── shared/                  [SRC]  **Core shared package** — imported by api, web, mobile
│   ├── src/
│   │   ├── enums/           [SRC]  All PRD §9.1 enums (role_t, spk_status_t, vehicle_status_t, etc.)
│   │   ├── machines/        [SRC]  State machine tables + transition() functions (SM-SPK, SM-STEP, SM-VEH, etc.)
│   │   ├── schemas/         [SRC]  Zod validation schemas (mirror DB constraints)
│   │   ├── utils/           [SRC]  Numbering, money, date/time, Indonesian format helpers
│   │   ├── constants/       [SRC]  Rule constants (tolerances, markup, numbering formats)
│   │   ├── types/           [SRC]  TypeScript types for API contracts
│   │   └── index.ts         [SRC]  Barrel export
│   ├── test/                [SRC]  Unit tests for shared logic
│   ├── package.json
│   └── vitest.config.mjs
├── api-client/              [GEN]  Generated from OpenAPI (pnpm gen:client)
│   ├── src/
│   │   ├── schema.gen.ts    [GEN]  Zod schemas from OpenAPI
│   │   ├── client.gen.ts    [GEN]  Typed API client
│   │   └── index.ts         [GEN]  Barrel export
│   └── openapi.json         [GEN]  OpenAPI spec from API server
├── chassis-map/             [SRC]  Standalone map library (geometry + React component + snapshot tests)
│   ├── src/
│   │   ├── geometry/        [SRC]  Layout parsing, position generation, SVG rendering
│   │   ├── components/      [SRC]  ChassisMap React component
│   │   └── index.ts         [SRC]  Barrel export
│   ├── test/                [SRC]  116 SVG image snapshot tests (launch + generated layouts)
│   └── package.json
└── config/                  [SRC]  Shared tooling config (ESLint, Prettier, TypeScript bases)
    ├── eslint.config.mjs
    ├── prettier.config.mjs
    └── tsconfig.base.json
```

---

## Key File Relationships

| If you're working on... | Read these first |
|-------------------------|------------------|
| **SPK API** | `apps/api/src/ports/spks.ts` → `apps/api/src/core/spk/` → `apps/api/src/http/spks/` → `packages/shared/src/schemas/spk.ts` |
| **SPK Web UI** | `Design Artifact/spk/` → `apps/web/components/spk/` → `apps/web/app/(app)/spk/` → `apps/web/lib/spks-api.ts` |
| **Vehicle API** | `apps/api/src/ports/vehicles.ts` → `apps/api/src/core/fleet/` → `apps/api/src/http/vehicles/` |
| **Vehicle Web UI** | `Design Artifact/fleet/` → `apps/web/components/fleet/` → `apps/web/app/(app)/vehicles/` |
| **Permissions** | `PRD.md §2.4` → `packages/shared/src/enums/permissions.ts` → `apps/api/src/core/iam/` → `apps/api/src/ports/iam.ts` |
| **State Machines** | `PRD.md §3` → `packages/shared/src/machines/` → `packages/shared/src/schemas/*-status.ts` |
| **Database** | `docs/prd/data-model.md` → `apps/api/src/infra/db/migrations/` → `apps/api/src/infra/db/schema/` |
| **Design Tokens** | `DESIGN.md` → `apps/web/app/globals.css` → `Design Artifact/_kit/bmi.css` |

---

## Generated vs Source Files — Critical Distinction

| File | Type | Edit? |
|------|------|-------|
| `specs/tasks.md` | **[GEN]** | **NO** — edit `specs/tools/tasks.source.mjs` then run `node specs/tools/build-tasks.mjs` |
| `specs/requirements.md` | **[GEN]** | **NO** — generated from PRD |
| `specs/design.md` | **[GEN]** | **NO** — generated from PRD + decisions |
| `packages/api-client/src/*` | **[GEN]** | **NO** — run `pnpm gen:client` from API changes |
| `apps/api/src/infra/db/migrations/*.sql` | **[SRC]** | **YES** — create new migration file for schema changes |
| `Design Artifact/**/*.html` | **[SRC]** | **YES** — visual target; artboard wins over DESIGN.md (DEC-96) |
| `docs/prd/**/*.md` | **[SRC]** | **YES** — part of PRD; changes require PO approval |
| `PRD.md` | **[SRC]** | **YES** — core spec; PO approval required |

---

*Last updated: 2026-11-14 | Matches actual directory structure as of this session*