# CONTEXT — session journal

> Read this first in every session (CLAUDE.md step 0), then requirements.md, design.md and tasks.md.

## Resume

| Item | Value |
| --- | --- |
| Active task | Phase 0 is done. Next task: **TASK-101** |
| Phase | 0 (specs and scaffold) |
| Spec status | TASK-004 merged into `main` on the owner's go-ahead (2026-11-04) |
| Blockers | Q-03 blocks TASK-127 part B, TASK-128, TASK-709 to TASK-711 |
| Spec version | PRD v2.19 |
| Branching | squash merges on `main`; pushed to `origin` from session 13 on owner's go-ahead; the next task branches from `main` |

**Ringkasan untuk product owner:** Phase 0 selesai dan `main` sudah di GitHub; CI hijau. Tersisa untuk Anda: mengaktifkan branch protection di `main`. Berikutnya TASK-101. Masa simpan Idempotency-Key 30 hari masih asumsi [A].

## Session log

| # | Date | Summary | Files |
| --- | --- | --- | --- |
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
| Q-03 | Who owns the Google Cloud, Cloudflare, Firebase and Expo (EAS) accounts, and which domain do web and API use? (PRD §11.3) | TASK-127 B, 128, 709 to 711; R1 step 1 close | — (product owner) |
| OQ-5 | Is an internal developer available to review the ENG/REG design note and critical merges (§8.4)? | TASK-202, 203 | Until one joins, ADR-0002 applies |

## Divergences

| Item | Status |
| --- | --- |
| ADR-0001 staging seed from canvas values (PRD §8.3 vs CLAUDE.md) | Accepted (Q6); CLAUDE.md note added |
| ADR-0002 interim reviewer rule (PRD §8.4) | Accepted (Q20); revisit when an internal developer joins |
