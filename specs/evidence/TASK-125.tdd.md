# TASK-125 SPK list tabs and SPK detail with step cards and stamps

Requirements: REQ-SPK-010, REQ-SPK-011, REQ-SPK-015. Decision: DEC-127. Journey: FLW-PLN-01 as far as this task goes. Tables read: spks, spk_assignments, assignment_modules, spk_approvals, vehicles, vehicle_classes, users, user_roles.

## Spec first (DEC-127, PRD v2.39)

The branch `feat/phase1-task125-spk-list-detail-v2` was started without a spec checkpoint. The owner chose to fix it in place and decided:

- SPKList pages on the server: 20 per page by default, with 10, 20, 50 or 100, Previous, Next and "Page n of m (total)". Tab counts count every matching SPK.
- The urgency pill sits beside the SPK number; Urgent and High sort first.
- What later tasks build is hidden, not disabled (as DEC-122):
  - on SPKDetail, the Parts and services, Cost and Change requests tabs;
  - the SPK document, Raise change request, Cancel SPK, Reverse issue, Assign, Reassign, Correct time and Open step buttons;
  - the report reference, planned day and work location of the context card.
- In SPKList, Open goes to Create SPK for a Draft or Rejected SPK of its creator; every other row offers View.

The SPKList artboard gained the urgency pills and the pager before the code.

## What was wrong on the branch and is fixed

- **Hexagonal rule:** the port and the list service imported `drizzle-orm`. The port now takes plain filters, and the queries live in `infra/db/spk-gateways.ts`. `pnpm check:layers` is clean.
- **List logic:**
  - tab counts now use the same search, type and vehicle filters;
  - My steps now filters;
  - the search now matches anywhere in the SPK number, title or plate;
  - Urgent and High now sort first;
  - the current step and Waiting on are now filled in.
- **Contract:**
  - `allowedActions` is the action enum again, and the casts in CreateSpk are gone;
  - the `Actor` copy in `@bmi/shared` is removed;
  - one `SpksController` and one `SpkErrorFilter` remain.
- **Query contract:** `ApiContract.query` was never written to the OpenAPI document, and the web client sent the list query outside `params`. The list therefore always showed the Active tab. The E2E run caught it. Fixed in `openapi/document.ts` and `lib/spks-api.ts`, and pinned by tests.
- **Code errors:** the JSX close order, the duplicate types and the broken tests are fixed. Turbopack stays on.

## What changed

- **Shared:** `SPK_TABS`, `SPK_PAGE_SIZES`, `SpkListQuerySchema`, list items with the current step and Waiting on, and the list response with tab counts, pagination, vehicles and the page action. Also `SpkDetailSchema`, with steps, approvals and costs.
- **API:**
  - `SpkGateway.listPage`, `countMatching`, `vehiclesWithSpks` and `detail`;
  - `SpkListService`, which maps the tabs, computes Waiting on (specs/design.md 5.11) and the `allowedActions` from the Create SPK policy table, and adds the page action `create` for spk.create;
  - `GET /spks` and `GET /spks/:id/detail`, both needing spk.view.
- **Web:**
  - `/spk`: SPKList with the search, tabs with counts, type and vehicle filters, the table and the pager;
  - `/spk/:id`: SPKDetail with the header and subline, the Steps tab (StepTracker, StepCard, the context card, ApprovalBlock) and the History tab;
  - `SpkHome` is replaced by SpkList.
- **E2E:**
  - `create-spk.spec.ts`: FLW-PLN-01 now goes on to the Draft tab, where Open returns to Create SPK.
  - `spk-list.spec.ts`:
    - another user with spk.view finds the draft by its plate, and View opens SPKDetail;
    - an account without spk.view gets the not-allowed page.
  - Shared helpers are in `spk-helpers.ts`.

## Evidence

- **RED:** the API integration test, and the shared and web tests, were written before the code. The first E2E run caught the query bug that the mocked web tests missed.
- **GREEN:**
  - API `spk-list.test.ts`: 9 of 9:
    - counts with filters;
    - order;
    - search, type and vehicle;
    - pages, including an empty page and a page past the end;
    - My steps by assignment and by role;
    - Waiting on per status;
    - `allowedActions`;
    - detail with steps, approvals and costs;
    - 404 and 403.
  - API `openapi.test.ts`: 12 of 12, with the query parameter.
  - Shared: 304. Web: 147, including SPKList 6, SPKDetail 5 and the `spks-api` query string.
  - E2E: 18 of 18. The first full run passed 17 of 18; the not-allowed check was then fixed and its spec rerun.
- **Gates:** typecheck, lint, check:layers, check:secrets and `check-coverage --tests` pass. Prettier is clean on tracked files; only untracked local scratch files are flagged.
- **API coverage run, environmental failures:** 7 tests outside this task fail on this machine today:
  - 5 queue tests, because WSL Redis is not reachable from Windows;
  - 2 database tests (UTC session; restrict error code), because a Windows PostgreSQL 18 holds port 5432 instead of the WSL PostgreSQL 16 that CI matches.
  - None of them touches SPK code; CI runs on PostgreSQL 16 and Redis.
- **QA** at 1440 x 900 against SPKList and SPKDetail, on the e2e database (three SPKs; one In_Progress with three steps and a creation approval written by the QA script):
  - SPKList matches: header with search and Create SPK, tabs with counts, filter row, the columns with the urgency pill beside the number, status pills, current step, Waiting on, and the pager.
  - Fixed: Open is a plain button, as in the artboard.
  - Kept: the vehicle filter is a select of the vehicles that have an SPK; the artboard shows a text input.
  - SPKDetail matches: crumb, title, status and urgency pills, subline, Steps and History tabs, tracker, step cards, context card with odometer and cost so far, and approval block. What DEC-127 hides is absent.
