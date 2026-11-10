# CONTEXT — session journal

> Read this first in every session (CLAUDE.md step 0), then requirements.md, design.md and tasks.md.

## Resume

| Item | Value |
| --- | --- |
| Active task | TASK-109 done on branch `feat/phase1-task109-planner-approval-switch`. Next task: **TASK-117** (@bmi/chassis-map library), then TASK-116 (trial first, DEC-113) |
| Phase | 1 (R1 step 1) |
| Spec status | PRD v2.23 merged into `main` and pushed on the owner go-ahead (2026-11-09) |
| Blockers | Q-03 blocks TASK-127 part B, TASK-128, TASK-709 to TASK-711 |
| Spec version | PRD v2.30 |
| Branching | squash merges on `main`; pushed to `origin` from session 13 on owner's go-ahead; the next task branches from `main` |

**Ringkasan untuk product owner:** Phase 0 selesai dan `main` sudah di GitHub; CI hijau. Tersisa untuk Anda: mengaktifkan branch protection di `main`. Berikutnya TASK-101. Masa simpan Idempotency-Key 30 hari masih asumsi [A].

## Session log

| # | Date | Summary | Files |
| --- | --- | --- | --- |
| 30 | 2026-11-11 | TASK-109: DEC-118 (v2.29; card and side panel, Change while on, a reason for every change, the end at its end time audited by a delayed job, the notice to Supervisors and GMs moved to TASK-130); Planner approval switch API, end job and card; FLW-AM-06 e2e; side panel parts shared in kit/SidePanel | apps/, packages/shared, specs/, Design Artifact/access, Design Artifact/_kit, PRD.md |
| 29 | 2026-11-11 | TASK-108: DEC-117 (v2.28, ten role columns, rows by area with meanings, staged save with one audit record; REQ-IAM-005 locks approval codes outside Supervisor, GM, System Admin and account codes outside the Access Manager, migration 0005); Roles and permissions matrix API and screen; FLW-AM-02 e2e | apps/, packages/shared, specs/, Design Artifact/access, PRD.md |
| 28 | 2026-11-10 | TASK-107: DEC-116 (v2.27); Users and roles (accounts with one role, temporary password, unlock, reset, deactivate and activate, move System Admin, audit records), account allowedActions with the contract test, Access Manager lands on Users and roles; qa found and fixed a refresh race that signed web users out | apps/, packages/shared, specs/, Design Artifact/access |
| 27 | 2026-11-10 | TASK-106: allowedActions framework (Policies, allowedActions, assertAllowed, shared rules for BR-02 and BR-03), contract helper for every record type, 403 with one sentence; web shell behind the sign-in with the menu from GET /me, not-allowed page, sign out, refresh on 401 | apps/api/, apps/web/, specs/ |
| 26 | 2026-11-10 | TASK-105: DEC-115 (v2.26, lock rules, - cells, files.upload); permission catalogue, 2.2 matrix and menu in @bmi/shared; role_permissions seed migration 0004; effective capability set per request; SessionGuard with @RequireCapability; GET /me with capabilities and system mode; capability matrix test (10 roles x 44 codes). WSL service hung and needed the owner to restart it | apps/api/, packages/, specs/, PRD.md |
| 25 | 2026-11-09 | TASK-104: sign-in, lock after 5 failures, web and mobile sessions, first sign-in change, forgot and reset password by link (console email adapter locally), GET /me; four web screens matched to the artboards; e2e auth runs the API on a fresh bmi_e2e database | apps/api/, apps/web/, packages/, specs/ |
| 24 | 2026-11-09 | TASK-126 merged; web coverage gate fixed (tests for /kit, /settings and the user menu). TASK-104 started: owner decisions DEC-114 (v2.25): REQ-IAM-009 follows DEC-102 (reset link by email, 60 minutes, once); 9.2 gains auth_sessions and password_reset_tokens; e2e FLW-AM-04 runs in TASK-107. design.md 5.1 describes sign-in and sessions | PRD.md, docs/prd/, specs/ |
| 23 | 2026-11-09 | TASK-126: web kit (Button, BusyButton, StatusPill, Tabs, ConfirmDialog, useLeaveGuard, DataTable, Icon), AppShell with floating rail, PageHead with the bell, Settings home, globals.css matched to the artboards, dev-only /kit gallery; DESIGN.md page colour and headline size corrected to the artboards. 22 web tests | apps/web/, DESIGN.md, specs/ |
| 22 | 2026-11-09 | TASK-103: migration 0002 with every §9.1 enum, users, user_roles (BR-14 indexes), role_permissions, append-only audit_logs, app_settings, stored_files, user_table_preferences, and the users foreign key of idempotency_keys. 48 database tests, API lines 99,48 percent | apps/api/, specs/ |
| 21 | 2026-11-09 | TASK-102: every machine of PRD §3 as a table in @bmi/shared with transition(), derived vehicle status, document status by dates, paused step state. 162 SM tests, 100 percent coverage of @bmi/shared | packages/shared/, specs/ |
| 20 | 2026-11-09 | Owner wants to try the system locally with dummy data as soon as possible. Phase 1 reordered (DEC-113, v2.24): the 19 open tasks a sign-in, vehicle and SPK approval flow depends on come first, then TASK-131 adds a local dummy seed and `pnpm trial` (ADR-0003). No task loses content. Earlier the same day: tyres already cannot be mounted on a second unit before a demount (REQ-PLC-003, REQ-STK-006, `uq_active_tyre`); the owner chose not to track other parts per piece | PRD.md, docs/adr/, specs/ |
| 19 | 2026-11-09 | Owner asked for part analysis by cost per km and per day of use, by brand, vendor and retread vendor, with traceability. Found in the PRD: tyre tracking and tyre cost per km (P1) only. Added DEC-112, area PTR (v2.23): stock lots, part installations, repairs, history panel (P0, R1 steps 3 and 5) and the Parts report and retread cycle analysis (P1). Tasks TASK-315, TASK-515, TASK-516. Local test runs: the web test failure is proven to be the 60 s fork start limit of Vitest on this HDD; a 30 s test timeout and a jsdom-free API test are on `chore/phase1-test-timeouts` | PRD.md, docs/prd/, Design Artifact/, specs/ |
| 18 | 2026-11-06 | TASK-101 review, all fixes approved by the owner (DEC-111, v2.22): numbering formats validated (unknown token, repeated or missing running number refused, repeated date token replaced everywhere), `roundHalfUp` refuses invalid decimals with RangeError, `Part_Item_Alert`, `cr_number`, OB number in `sa_number`, one sequence per code, TASK-120 seeds and reads `numbering_formats`. Corrected: the session 17 note that the PRD had no stored setting was wrong | packages/shared/, PRD.md, docs/prd/, specs/ |
| 17 | 2026-11-05 | TASK-101: enums of 9.1 with a drift test against the data model, decimal money with big.js, Indonesian number format, WIB date and time, one numbering configuration. 71 tests, 100 percent coverage of `@bmi/shared` | packages/shared/, specs/ |
| 16 | 2026-11-05 | Owner: every running code follows CODE-yymmddNNNN (DEC-110, v2.21), also tyre codes; customer invoices keep NNNN/BMI/dd-mm-yy (DEC-46). Sample numbers updated in the spec and artboards. No code used these formats yet | PRD.md, docs/prd/, Design Artifact/, specs/ |
| 15 | 2026-11-05 | Owner replaced the field draft SPK with the Report Breakdown (DEC-109, v2.20). New area BRK, SM-BRK, TX-23, TX-24, numbering RB-yymmddNNNN, `breakdown_report_photos`. Drafts come only from alerts, a verified Part Check and an Urgent breakdown report (with one Mobilisasi step). Blocking pop-up for Planners on an Urgent report from a Driver. An inspection Fail, now also by a Mechanic, raises a report. "Report reference: RB-yymmddNNNN" shows in the description of an SPK made from a report. Report number RB-yymmddNNNN like the SPK number (owner). Eight screens renamed or merged, two new. Defaults the owner approved: Urgent inspection Fail has no pop-up, Mechanic inspection uses the same checklist and is not daily, a report is rejected with a reason, Mechanic and Field Coordinator report on web and phone. Added by the agent, to be reviewed: at least one photo is required, pop-up within 30 seconds [A], draft opens in a new tab | PRD.md, docs/prd/, Design Artifact/, specs/ |
| 14 | 2026-11-04 | Phase 0 review, four fixes: OpenAPI generated from `@ApiContract` on the controllers with a run-time response check (§8.2); full layer table of design.md §3 in dependency-cruiser; `updated_at` stamped by `updateWithVersion`; 90 % gates proven, registry placed in `engine/registry/`. Smaller review points stay open: Approvals preview and Vehicles master-detail against 7.4, `SettingsIntegrations` row in 7.3, the 30-day [A] in 11.2, no independent review yet | apps/api/, packages/chassis-map/, .dependency-cruiser.cjs, specs/design.md, specs/evidence/ |
| 13 | 2026-11-04 | Owner approved the first push: `main` pushed, CI run 41806304702 green, TASK-008 closed; phase 0 done | specs/ |
| 12 | 2026-11-04 | Owner chose a new table for the idempotency store: DEC-108, TX-22, v2.19. TASK-009 closed: 50 integration tests. Leftover former names hidden behind escaped underscores in the spec replaced (table names, `source` value 'SPK', heading 9.6); the checker now sees them | docs/prd/data-model.md, PRD.md, apps/api/, specs/ |
| 11 | 2026-11-04 | Design artifact: one page per screen (DEC-107, v2.18), 180 pages; old module files removed; dialogs and panels of the action map added; tabs work; controls linked; all spec links rewritten. Sample data stays non-binding | Design Artifact/, docs/prd/ui.md, ui-action-map.md, PRD.md, history.md, CLAUDE.md, specs/ |
| 10 | 2026-11-04 | Phase 0 run. TASK-005, 006, 007, 010 done and squashed to local `main`. TASK-008 local only. TASK-009 without the idempotency store. Expo SDK 58 / RN 0.88 has minSdk 24, so Android 8 (API 26) is supported on paper (NFR-18); no real phone yet. `pnpm-workspace.yaml` has `minimumReleaseAgeExclude` entries for six Expo packages that were newer than pnpm's release-age policy: review them when Expo updates. Skills loaded for TASK-006 to 010 were a subset of each _Skill_ line, listed in the owner's report | apps/*, packages/*, .github/workflows/ci.yml, specs/evidence/TASK-006 to 010 |
| 1 | 2026-11-03 | Read the PRD and flows; TDD journeys; spec v2.9 and v2.10 editorial fixes; grilling of the build plan (Q1–Q26); spec set written | docs/prd/flows.md, history.md, traceability.md, areas/4.3-reg.md, areas/4.4-stk.md; specs/*; docs/adr/0001, 0002; CLAUDE.md (seed note) |
| 9 | 2026-11-04 | One entity, one name (DEC-106, v2.17): SPK everywhere, also in IDs, tables, permissions, artboards, files and code; replaces the two-name approach of sessions 7 and 8. check-coverage fails on the former name outside docs/prd/history.md. Committed on the spec branch, reaches main with TASK-004 | whole spec, Design Artifact/*, CLAUDE.md, specs/* |
| 7 | 2026-11-04 | Entity named Surat Perintah Kerja (SPK), number SPK-yymmddNNNN, running part never resets, four digits (DEC-104, v2.15). Schedule cards and phone rows fixed for the longer number; launch.json now uses specs/tools/serve-artifact.mjs because npx serve hung | PRD.md, DESIGN.md, PRODUCT.md, README.md, docs/prd/*, Design Artifact/*, specs/* |
| 6 | 2026-11-03 | Dependency safety audit: 37 tables used before creation, 3 tables never created, 5 ACs before their builders, 41 unordered screens fixed; notifications foundation moved to phase 1 (TASK-130 replaces TASK-614); check-coverage now also checks table creation order, AC builders, extensions, touched-screen order and later-phase dependencies | specs/tools/*, specs/tasks.md, specs/acceptance-tests.md, specs/decision-index.md |
| 5 | 2026-11-03 | Repo hygiene (TASK-015): LF via .gitattributes, wider .gitignore, README, design-artifact preview; PLAYWRIGHT_BROWSERS_PATH=D:\ms-playwright; WSL Ubuntu disk moved to D:\wsl\Ubuntu-24.04 (C: 16,8 GB free, D: 11,3 GB free). GateGuard exemption left to the owner (.claude/settings.json) | .gitattributes, .gitignore, README.md, .claude/launch.json, specs/CONTEXT.md |
| 4 | 2026-11-03 | Readiness audit: links, anchors and IDs clean; dependency cycle TASK-104/105/126 removed and a graph check added to the coverage tool; acceptance criteria made a test source of their own (acceptance-tests.md, --tests) | specs/tools/*, specs/tasks.md, specs/acceptance-tests.md, specs/CONTEXT.md |
| 3 | 2026-11-03 | Coverage audit found the plan incomplete; tasks.md now generated from tasks.source.mjs and PRD columns; check-coverage.mjs reports Coverage OK (251 REQ, 133 AC, 87 tables, every P0 screen, C-*, NAV, DQ, 94 DEC); spec v2.13 lists two missing artboards; OQ-7 to OQ-9 opened and answered (v2.14) | specs/tools/*, specs/tasks.md, specs/decision-index.md, specs/design.md, CLAUDE.md, docs/prd/ui.md, history.md |
| 2 | 2026-11-03 | Owner answered OQ-1 to OQ-4: spec v2.11 (DEC-97 to 99, TX-16); specs aligned; TASK-712 and TASK-713 added for the Mechanic phone menu; OQ-6 answered (DEC-100, v2.12) | PRD.md, docs/prd/flows.md, ui.md, data-model.md, history.md, traceability.md, areas/4.19-ntf.md, areas/4.20-mob.md; specs/requirements.md, tasks.md, tdd-user-journeys.md, CONTEXT.md |

## Key decisions

The design choices are D-01 to D-14 in design.md §11. Process and product decisions not in design.md:

- Phase 0 order: TASK-001 to 004 (documents), owner review, then TASK-005 onward (scaffold). Code work starts only when the owner says the source files are ready (Q19, Q26).
- tasks.md details every R1 step at task level now (Q2 answer a).
- requirements.md lists P0 IDs in full, P1/P2 as ranges, and never lists retired IDs (Q3).
- Q-03 stays open; deploy tasks are marked BLOCKED, and Q-03 must be answered before R1 step 1 can close (Q5).
- Staging seed may re-type canvas example values (ADR-0001, Q6).
- Interim reviewer rule until an internal developer joins (ADR-0002, Q20).
- Phase N = R1 step N; TASK-N01 onward; phase 0 = specs and scaffold (Q9); a task found later takes the next free number of its phase (TASK-011, TASK-712, TASK-713).
- The GitHub repository stays **public** (owner decision, 2026-11-03). Consequences for every task: never commit secrets, keys, keystores, .env files or real customer data; the CI secret scan (TASK-008) blocks a merge that adds one; staging and production credentials live only in Secret Manager.
- OQ-1 → DEC-97: one draft SPK request screen (FCCreateSPK) for the Mechanic and the Field Coordinator; on the phone the Mechanic keeps MechanicMobileFieldReport (REQ-MOB-004), the Field Coordinator FCMobileCreateSPK.
- OQ-2 → DEC-98: the Mechanic mobile menu is essential and in Release 1 (R1 step 7), with the Driver, Field Coordinator and System Admin menus; the Supervisor/GM menu stays in Release 2.
- OQ-3 → DEC-99: Part Check and Mobilisasi are essential Release 1 features; server and web in R1 step 4, phone screens in R1 step 7.
- OQ-6 → DEC-100: MobileProfile is P0 in Release 1; its push mute (REQ-NTF-003) stays P1.
- OQ-7 → DEC-101: a Rejected SPK can be cancelled by its creator (T6); DQ-06 corrected.
- OQ-8 → DEC-102: the password reset email is the only email in Release 1, through an email adapter; the provider account joins Q-03.
- OQ-9 → DEC-103: DashboardAdmin integration rows are status only in Release 1.
- OQ-10 → DEC-108: the idempotency store is a table in §9 (`idempotency_keys`, TX-22), written in the transaction of the action; 30 days of retention is [A].
- OQ-4 → TX-16 now names the roll-forward, late alerts and the OFF-day count (editorial, v2.11).

## Open questions

| ID | Question | Blocks | Proposed answer |
| --- | --- | --- | --- |
| OQ-6 | NFR-15 stores the number formats in `app_settings.numbering_formats` (9.12), but no screen edits that setting. Does the owner want one, or is a change by a developer in the database enough? | Nothing yet | No screen until the owner asks; the value is checked with `NumberingConfigSchema` before use |
| Q-03 | Who owns the Google Cloud, Cloudflare, Firebase and Expo (EAS) accounts, and which domain do web and API use? (PRD §11.3) | TASK-127 B, 128, 709 to 711; R1 step 1 close | — (product owner) |
| OQ-5 | Is an internal developer available to review the ENG/REG design note and critical merges (§8.4)? | TASK-202, 203 | Until one joins, ADR-0002 applies |

## Divergences

| Item | Status |
| --- | --- |
| ADR-0001 staging seed from canvas values (PRD §8.3 vs CLAUDE.md) | Accepted (Q6); CLAUDE.md note added |
| ADR-0002 interim reviewer rule (PRD §8.4) | Accepted (Q20); revisit when an internal developer joins |
