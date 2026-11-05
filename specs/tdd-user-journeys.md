# TDD User Journeys — BMI Stooring System v2

> The journey side of the TDD reference, derived from the user flows of PRD §6 ([docs/prd/flows.md](../docs/prd/flows.md)).
> One journey = one `FLW-*` flow; every test case points at a PRD ID (AC-, REQ-, BR-, T-, NFR-).
> Journeys are **one of three test sources** (§0.0). The acceptance criteria are the other main source and have their own generated catalogue, [acceptance-tests.md](acceptance-tests.md), which lists every AC whether or not a flow contains it.
> This file is an **index**, not a restatement: the full requirement text lives in the area files.
> Where this file and PRD.md / docs/prd/ differ, **the PRD wins**.

Status: TDD step 1 (user journeys) and step 2 (test cases) are written; nothing has run yet.
The RED gate (step 3) starts once the monorepo and its test runners exist (phase 0 scaffold, TASK-005 onward).

---

## 0. How to use this file

### 0.0 Three sources of tests, all required

| Source | Where it is listed | What it proves | Test form |
| --- | --- | --- | --- |
| **Acceptance criteria** (AC-*, PRD §4: "the acceptance criteria are the test cases") | [acceptance-tests.md](acceptance-tests.md): every AC with its task, area file and journeys; the task's `_Acceptance_` line | each concrete behaviour, edge case and refusal exactly as the PRD states it | at least one integration test per AC, named `AC-…` (unit test when the AC is a pure rule); written RED at the start of its task |
| **User flows** (FLW-*, PRD §6) | this file; the task's `_Journey_` line | the user can complete the journey across screens and roles, and only the allowed buttons show | one E2E spec per flow, named `FLW-…`; journey steps that restate an AC assert it again end to end |
| **Rules and machines** (BR-*, SM-*/T*, TX-*, NFR-*, §2.2 matrix) | the task's `_Rules_` line; §10 and §11 below | every allowed and refused transition, every invariant, every capability cell, atomic and idempotent writes | table-driven unit tests and generated integration matrices, named by the rule ID |

An AC that no flow covers is still tested: it is in the catalogue and on its task's `_Acceptance_` line. A flow step with no AC is still tested in its E2E spec. `node specs/tools/check-coverage.mjs` proves every AC is placed; `--tests` proves every AC of a finished task has a named test.

### 0.1 Three test layers (PRD §8.2 "Tests", §8.3)

| Layer | Runner | Location | Holds | Source in the PRD |
| --- | --- | --- | --- | --- |
| U — Unit | Vitest | `packages/shared/**/*.test.ts`, `apps/api/src/**/*.spec.ts` | State machine transition tables, pure functions (totals, life used, effective capabilities, numbering, rounding) | §3 (every allowed **and** every refused transition), BR-*, NFR-15/16 |
| I — Integration | Vitest + real PostgreSQL | `apps/api/test/integration/**` | Endpoints, L1/L2 policies, TX-* transactions, `allowedActions` | AC-* (§4: "the acceptance criteria are the test cases") |
| E — E2E | Playwright | `apps/web/e2e/flows/<FLW-ID>.spec.ts` | One spec per flow, screens in flows.md order | FLW-* |

Rules:
- **One FLW = one E2E file.** `describe` carries the ID and title, e.g. `describe('FLW-PLN-01 Create a planned Surat Perintah Kerja')`.
- **One AC = at least one integration test.** Each `it` starts with the AC ID, e.g. `it('AC-SPK-001 refuses approval by the creator; accepts a Supervisor')`. The task `_Verify_` lines filter on these IDs (`-t "AC-SPK-001|AC-SPK-002"`).
- E2E proves the **journey** (screens, buttons from `allowedActions`, end state); rule detail is proven in the I/U layers so E2E stays small and fast.
- Buttons and menus are tested through capabilities and `allowedActions`, **never** the role name (DEC-93). Every E2E also asserts that buttons that must not show are absent.
- E2E selectors use role and accessible name (`getByRole('button', { name: 'Submit for approval' })`), never CSS classes.
- Every test builds its own data through factories (no test depends on another's order). Artboard files are never imported or parsed (CLAUDE.md); names and figures from the ACs (SPK-2611040142, Agus, Rp 336.000) are used as fixture values because they come from the PRD.
- Time is controlled (fake clock in WIB, NFR-14) for every AC that names a time or day, and for every daily job.

### 0.2 The TDD cycle per task (`ecc:tdd-workflow`)

1. Take the task's `_Acceptance_`, `_Journey_` and `_Rules_` lines in `specs/tasks.md`; read each AC's full text in its area file.
2. Write the tests from all three sources: a test per AC (named by the AC ID), the E2E spec of each journey, and the rule and transition tests. Run them; confirm **RED because the feature is missing** (not because setup is broken). Commit `test: ... [TASK-nnn]`.
3. Write the minimal code → GREEN on the same test target. Commit `feat: ... [TASK-nnn]`.
4. Refactor with the tests green. Coverage: 80 % global, 90 % for `packages/shared`, ENG and REG.
5. Write the RED/GREEN evidence to `specs/evidence/TASK-nnn.tdd.md` and copy its summary into the squash PR body.

---

## 1. Findings resolved before this file was written

Reading flows.md against PRD.md and the area files showed flow steps and ACs that lagged behind later decisions. All were fixed as editorial spec changes (history.md v2.9 and v2.10); the tests below follow the corrected spec.

| # | Was | Now (spec) |
| --- | --- | --- |
| F-1 | FLW-PLN-04: a Missed card is dragged by hand | The daily job marks it Missed and rolls it to the next day (DEC-92, REQ-SCH-003) |
| F-2 | FLW-WHM-01: Part Purchase with free-text lines | Lines are the SPK's listed parts; only quantity and price are typed (DEC-62/63) |
| F-3 | FLW-SA-07: stooring area picked on Mechanic Action | Stooring is produced by the Mobilisasi step (DEC-90) |
| F-4 | Step flows edit right after Open | Start first; Part Replacement has no Start (DEC-87/95) |
| F-5 | An Urgent report "drafts an SPK" | The draft holds one Mobilisasi step and a finding note; any other report drafts nothing (REQ-BRK-002, REQ-BRK-003, DEC-109) |
| F-6 | AC-STK-002 verified retired REQ-STK-005 | Retired to history.md; AC-STK-006 now verifies REQ-STK-004 and REQ-PUR-008 |
| F-7 | AC-REG-002 named a "SPK type" | Reworded for SPKs and presets (DEC-85) |
| F-8 | Traceability AC ranges incomplete | Completed; Part Check row added |
| F-9 | No flow for step time, Part Check, Mobilisasi, OFF | FLW-MEC-07, FLW-MEC-08, FLW-PLN-10, FLW-MEC-09, FLW-APR-09 added |

Answered in spec v2.11: the Mechanic and the Field Coordinator send a report on one screen (DEC-109, FLW-MEC-10); the Mechanic mobile menu, with Part Check and Mobilisasi on the phone, is in Release 1 (DEC-98, DEC-99).

---

## 2. Master journey: a PM service from alert to SPK document (§6.9)

> As the fleet operator, I want one PM to run from its alert to an SPK document with every stamp, so that no maintenance happens without authorization (G-1, G-4).

File: `apps/web/e2e/flows/golden-path-pm.spec.ts`, one long multi-account test (one `browserContext` per role).

| # | Step | Role | Assert | Transition / ID |
| --- | --- | --- | --- | --- |
| 1 | Odometer passes the PM interval | System (job) | PM alert and Draft SPK on DashboardPlanner | AC-PM-001, T1 |
| 2 | Create the SPK from the alert, Submit | Planner | Pending_Approval; Approvers notified | T2, REQ-SPK-004 |
| 3 | Approve creation | Supervisor | Creation stamp, Active, step 1 Open, steps 2–3 Locked | T3, AC-SPK-002 |
| 4 | Place it on the schedule | Planner | Card on that day; exactly one alert to the Field Coordinator | AC-SCH-001 |
| 5 | Stock step: Start, quantities, tyre, Submit | Warehouse Manager | SPK In_Progress, stock down, tyre Issued, step 2 Open | T7, AC-ENG-001, AC-STK-004 |
| 6 | Verify step 1 | Planner | Verifier stamp | SM-STEP Submitted→Verified |
| 7 | Mechanic Action and Part Replacement, Submit | Mechanic | SPK Pending_Verification | T11 |
| 8 | Verify steps 2–3, Request completion | Planner | Enabled only once every step is Verified | AC-ENG-002, BR-05 |
| 9 | Approve completion | GM | Completed, vehicle Active, part items reset | T13 |
| 10 | Open SPKDocument | all | Creation, executor, verifier and completion stamps | REQ-SPKD-*, G-4 |

Side paths are tested in their own flow files: FLW-MEC-05 → FLW-PLN-06 → FLW-APR-02 (change request), FLW-PLN-05 → FLW-MEC-04 (return), FLW-APR-01 reject → FLW-PLN-03, FLW-APR-05 (cancel), FLW-WHM-02 (reversal).

---

## 3. Planner (web)

### FLW-PLN-01 Create a planned Surat Perintah Kerja
> As a Planner, I want to compose an SPK and its steps on one screen and submit it, so that work starts only after approval.

| Test | Layer | Ref |
| --- | --- | --- |
| creates an SPK with title, vehicle, category and steps and submits it → Pending approval tab | E | REQ-SPK-001, T2 |
| starts from a preset; changing the steps leaves the preset unchanged | I | AC-REG-005 |
| refuses submit with no step | I | AC-REG-001 |
| refuses submit when a Stock step has no part line, with a message | I | AC-SPK-003 |
| saves the Stock module in two steps of one SPK or preset | I | AC-REG-002 |
| renumbers steps after drag / Move up / Move down and keeps each step's details | U+E | AC-REG-004 |
| refuses an SPK for an Inactive vehicle; allows one for an OFF vehicle | I | T1 guard, REQ-SPK-013, DEC-92 |
| refuses every `spk.*` action in Setup mode | I | REQ-IAM-010, AC-IAM-006 |
| assigns SPK-yymmddNNNN: four digits that widen when needed, never reset across days, never reused, also after cancel | U+I | NFR-15, DEC-104 |
| the date part is the WIB day: 23:59 WIB on 3 Nov gives SPK-261103…, 00:01 WIB on 4 Nov gives SPK-261104… although both are the same UTC day | U | NFR-14, DEC-104 |
| screens, notifications and PDFs say Surat Perintah Kerja or SPK | E | DEC-104 |
| notifies every Approver on submit | I | T2 effect, REQ-NTF-* |

### FLW-PLN-02 Create an SPK from an alert or a vehicle
> As a Planner, I want to start an SPK from an alert or a vehicle page, so that the vehicle and preset steps are filled in.

| Test | Layer | Ref |
| --- | --- | --- |
| "Create SPK" on a PM alert opens CreateSPKFromAlert with vehicle, source and preset steps | E | REQ-SPK-012, REQ-PM-003 |
| "Create SPK" on VehicleOverview opens CreateSPK with the vehicle | E | REQ-SPK-012 |
| an alert-drafted SPK is Draft, never Active | I | REQ-SPK-003 |
| a second low tyre reading makes no second draft while the first is open | I | AC-PM-005 |
| PM alerts follow only the packages of the vehicle's class (Hilux by km, trailer by days) | I | AC-PM-003 |

### FLW-PLN-03 Rejected SPK
> As a Planner, I want to see why an SPK was rejected and resubmit it, so that the work can still go ahead.

| Test | Layer | Ref |
| --- | --- | --- |
| a rejected SPK is in the creator's Rejected tab with the reason | E+I | AC-SPK-005 |
| Edit and resubmit returns it to Pending_Approval | E | T5 |
| the creator can cancel a Draft or Rejected SPK with a reason | I | T6 |

### FLW-PLN-04 Plan the SPK on the maintenance schedule
> As a Planner, I want to place SPK cards on the calendar, so that the Field Coordinator knows which vehicles go to the workshop.

| Test | Layer | Ref |
| --- | --- | --- |
| dragging SPK-2611040154 onto Tuesday shows it there; exactly one alert reaches the Field Coordinator | E+I | AC-SCH-001 |
| two SPKs can share a day | I | AC-SCH-002 |
| the daily job marks a passed card Missed, flags it rolled-over and moves it to the next day; the SPK stays In_Progress; the card is still movable | I | AC-SCH-003, REQ-SCH-003, BR-13 |
| the daily job is idempotent: two runs move the card once | I | NFR-12, §8.3 |
| a Field Coordinator drag is refused | I+E | AC-SCH-004 |

### FLW-PLN-05 Verify a submitted step
> As a Planner, I want to check a step's evidence and verify or return it, so that every piece of work is proven.

| Test | Layer | Ref |
| --- | --- | --- |
| "To verify" opens SPKDetailVerify → StepVerify with evidence, lines and executor stamp | E | REQ-ENG-005 |
| verify adds the verifier stamp; the System Admin on its own step is Self-verified | I | SM-STEP, BR-03 |
| return without a note is refused; with a note the executor sees it on StepReturned | I+E | AC-ENG-005 |
| the executor of a step cannot verify it | I | AC-ENG-004 |
| a stock reversal waits for verification, then stock and cost return | I | AC-STK-005, REQ-STK-008 |
| the next step opened without waiting for verification | I | BR-05, DEC-04 |

### FLW-PLN-06 Revise an SPK after a change request
> As a Planner, I want to revise SPK content as a change request asks, so that an Approver can decide the revision.

| Test | Layer | Ref |
| --- | --- | --- |
| in Pending_Amendment later steps are Locked and edit/submit of the open step is refused | I+E | AC-CR-001, §3.3 |
| Revise opens CreateSPKRevision; Send revision → Pending_Approval (SM-CR) | E | REQ-CR-003 |
| a revision switching the vehicle is refused | I | AC-CR-004 |
| a revision of a submitted step is refused; of the open step accepted | I | AC-CR-005, DEC-72 |

### FLW-PLN-07 Request completion
> As a Planner, I want to request completion once every step is verified, so that the SPK can close.

| Test | Layer | Ref |
| --- | --- | --- |
| Request completion is not in `allowedActions` until every step is Verified or Skipped | I+E | AC-ENG-002, BR-05 |
| the API refuses the request with a clear message while a step is unverified | I | AC-ENG-002 |

### FLW-PLN-08 Maintain SPK presets and PM packages
> As a Planner, I want to save step sequences as versioned presets, so that later SPKs start fast without changing earlier ones.

| Test | Layer | Ref |
| --- | --- | --- |
| Save as preset adds a version; an SPK on version 3 keeps its steps after version 4 | I | AC-ENG-003, AC-REG-005 |
| PM packages are grouped by class; a Towed class takes days only | I | REQ-REG-007, DEC-70 |
| Alert rules refuses Save when a drafting PM package has no preset, naming it | I | AC-PM-004 |
| a newly registered and activated module row appears in the composer palette and the SPK document with no engine change | I | AC-REG-003, REQ-REG-006 |

### FLW-PLN-09 Assign a step
> As a Planner, I want to assign a step to a named person, so that responsibility is clear.

| Test | Layer | Ref |
| --- | --- | --- |
| the first opener claims an unassigned step; others see it read only with the assignee | I+E | AC-ENG-006 |
| reassign with a reason notifies both; the draft moves with the step | I | AC-ENG-006, DEC-59 |
| only users of the step's executor role can be picked | I | REQ-ENG-011 |

### FLW-PLN-10 Turn a Part Check into a repair SPK
> As a Planner, I want troubleshooting findings to become a repair draft, so that repairs still pass approval.

| Test | Layer | Ref |
| --- | --- | --- |
| verify with Replace+Unsafe, Repair, Repair → Draft SPK Urgent with Stock, Part Purchase and Mechanic Action steps; all Good → no draft | I | AC-CHK-002 |
| Activate → Pending approval, not Active; the activating user counts as creator for BR-03 | I+E | AC-CHK-003, REQ-CHK-004 |
| Discard with a reason → verifying the check again makes no new draft | I | AC-CHK-003 |
| SPKDocumentCheck prints the Part Check section with the follow-up SPK number | I | REQ-CHK-006 |

---

## 4. Mechanic (web/tablet in R1, mobile in P1)

### FLW-MEC-01 Mechanic Action, internal team
> As a Mechanic, I want to record catalog services and repair photos, so that my work is recorded and can be verified.

| Test | Layer | Ref |
| --- | --- | --- |
| a step not yet open shows StepLocked | E | SM-STEP Locked |
| Open → Start → catalog services → photo → Submit; the next step opens | E | REQ-MEC-001, AC-ENG-001 |
| Internal price is read only and equals the catalog price | I+E | AC-MEC-001 |
| a later catalog price change leaves the saved line unchanged | I | AC-MEC-003, BR-07 |
| submit records no device position and adds Rp 0 stooring | I | AC-MEC-004, AC-MEC-005 |
| submit without a repair photo is refused on the server | I | REQ-MEC-001, §8.3 |

### FLW-MEC-02 Repair at an outside workshop
| Test | Layer | Ref |
| --- | --- | --- |
| switching to External shows vendor, services, price and invoice image | E | REQ-MEC-003 |
| an External service without an invoice image does not save | I | AC-MEC-002 |

### FLW-MEC-03 Part Replacement step
> As a Mechanic, I want to replace and rotate tyres on the chassis map, so that every tyre's position is traced.

| Test | Layer | Ref |
| --- | --- | --- |
| editable while Open; the first action claims it and sets In_Progress; no Start or Pause offered | I+E | AC-ENG-010, DEC-95 |
| only tyres Issued to this SPK are selectable | I | AC-PLC-001, BR-11 |
| a seventh tyre on a six-tyre vehicle is refused | I | AC-PLC-002 |
| demount as Needs_Retread empties the position | I | AC-TYR-001 |
| rotate swaps two positions and both stay Mounted; spare swap works | I | AC-PLC-003, AC-PLC-009 |
| tread 2,5 mm shows Act now and drafts a tyre SPK | I | AC-PLC-004 |
| the mounted tyre shows at the same position in Vehicles › Chassis and parts | E | AC-PLC-006 |
| the map renders every launch and generated layout (image snapshot) | U | AC-PLC-007, AC-PLC-010, DEC-73 |

### FLW-MEC-04 Returned step
| Test | Layer | Ref |
| --- | --- | --- |
| the notification opens StepReturned with the note; Start again is needed before editing | E | AC-ENG-005, SM-STEP Return |
| resubmit after fixing → Submitted | E | SM-STEP |

### FLW-MEC-05 The SPK content is wrong
> As the executor of the open step, I want to raise a change request, so that wrong SPK content is fixed through approval.

| Test | Layer | Ref |
| --- | --- | --- |
| Raise change request is only in the `allowedActions` of the open step's executor | I | REQ-CR-001, §2.4 |
| submit → SPK Pending_Amendment, step paused by the system, later steps Locked | I+E | AC-CR-001, T8 |

### FLW-MEC-06 Mobile app (R1 step 7, DEC-98)
> As a Mechanic, I want my day's steps, inspections and Report Breakdowns on the phone, so that I can work at the vehicle.

| Test | Layer | Ref |
| --- | --- | --- |
| My steps shows only SPKs scheduled today and assigned to me, Urgent above High, rolled-over first within a level | I | AC-MOB-005, REQ-MOB-010 |
| a Normal report on the phone keeps a report, drafts no SPK and opens no step; an empty note is refused | I | AC-BRK-001, AC-BRK-002 |
| a Mechanic's inspection Fail raises one report and no SPK (FLW-MEC-11) | I+E | AC-BRK-008, AC-BRK-009 |
| Mechanic Action, Part Replacement, Part Check and Mobilisasi on the phone apply the web rules | I | REQ-MOB-002 |
| a phone submit gives the same stamps and photos in the SPK document | I | AC-MOB-001 |
| a Mechanic sees only the Mechanic menu | E (mobile) | REQ-MOB-001 |

### FLW-MEC-07 Start, pause and resume a step
> As the GM, I want waiting, working and paused time recorded per step, so that bottlenecks show.

| Test | Layer | Ref |
| --- | --- | --- |
| step 1 submitted 10:40, Start on step 2 at 11:25 → waited 45 min; opening at 11:00 leaves the form read only with no start | U+I | AC-ENG-007 |
| Start 11:25, Pause 12:00, Resume 13:00, Submit 14:20 → worked 1 h 55 min, paused 1 h; Submit refused while paused | U+I | AC-ENG-008 |
| at 14:40 Start from 14:22 with a reason → accepted and marked; 3 h back or before the step opened → refused | I | AC-ENG-009 |
| Part Replacement is left out of the step time report | I | AC-ENG-010 |
| a change request pauses the step and resumes it when decided | I | SM-STEP, REQ-CR-002 |
| the SPK document Execution time marks the longest phase; the invoice shows no step time | I | AC-SPKD-008 |

### FLW-MEC-08 Do a Part Check step
> As a Mechanic, I want to report each checked part with its condition, decision and photos, so that the Planner can plan the repair.

| Test | Layer | Ref |
| --- | --- | --- |
| Open → Start → condition, decision and photo per part → service → Submit | E | REQ-CHK-002 |
| a Repair part without a photo blocks Submit and names the part | I | AC-CHK-001 |
| SVC-095 at Rp 175.000 → one service line on the invoice, no stooring; no service line → refused | I | AC-CHK-004 |
| Unsafe to drive notifies and warns but does not block the vehicle | I | REQ-CHK-005 |

### FLW-MEC-09 Mobilisasi to a broken-down vehicle
> As a Mechanic, I want a route to the driver and a step that finishes itself on arrival, so that stooring is recorded without manual input.

| Test | Layer | Ref |
| --- | --- | --- |
| Mobilisasi is in the module palette and adds a Mechanic step with no engine change | I | AC-MBL-001 |
| arrival submits the step; Finish stooring before arrival also submits | I | AC-MBL-002 |
| the trail is recorded only while In_Progress and stops at submit; only Planner and System Admin see it; every view is access-logged | I | AC-MBL-003, RSK-09 |
| Bekasi Rp 250.000 is added once per SPK per area per day; workshop Rp 0 | U+I | AC-MBL-004 |

---

## 5. Warehouse Manager (web)

### FLW-WHM-01 Issue parts and tyres for an SPK
> As the Warehouse Manager, I want to issue the parts and tyres the SPK lists, so that stock and SPK cost always match.

| Test | Layer | Ref |
| --- | --- | --- |
| Start → quantity per line → In Stock tyre by code/serial → Submit; stock down, tyre Issued, cost on the SPK | E | REQ-STK-001 to 006 |
| a part not on the SPK list is not selectable | I | AC-STK-003, BR-02 |
| 8 needed, 5 in stock → submit refused, stock stays 5, no Goods Issue | I | AC-STK-001 |
| issue 5 L and confirm a 3 L shortfall → one GI of 5 L and a Part Purchase step after it | I | AC-STK-006 |
| TY-0110 chosen → Issued with `issued_spk_id` = this SPK | I | AC-STK-004 |
| issue, stock card and SPK line commit or roll back together; a retry is idempotent | I | NFR-01, TX-* |
| two concurrent issues of one SKU never take stock below 0 | I | §8.3 lock per SKU, BR-06 |
| a goods issue for another vehicle is refused | I | BR-02 trigger |

### FLW-WHM-02 Reverse an issue after submit
| Test | Layer | Ref |
| --- | --- | --- |
| reversal with lines, quantities and reason → stock unchanged until verified → then returned | I+E | AC-STK-005 |

### FLW-WHM-03 Goods Receipt, no approval
| Test | Layer | Ref |
| --- | --- | --- |
| posting updates stock and moving average at once (10 @ 80.000 + 10 @ 100.000 → 20 @ 90.000) | U+I | AC-INV-001 |
| editing a posted receipt is refused and GR correction offered | I+E | AC-INV-002 |
| a GR correction posts directly and links to the original | I | REQ-INV-005, SM-GR |
| the GR form offers no tyre | E | AC-TYR-007, DEC-12 |

### FLW-WHM-04 Parts master and stock card
| Test | Layer | Ref |
| --- | --- | --- |
| deactivating a part with quantity 3 is refused; quantity 0 is allowed | I | AC-INV-005 |
| stock card export produces xlsx and CSV | I | REQ-INV-008, DEC-74 |

### FLW-WHM-05 Stock opname
| Test | Layer | Ref |
| --- | --- | --- |
| a variance row without a reason code blocks submit with an error under the sheet | I+E | AC-INV-003 |
| the counter cannot approve; a System Admin counter can, Self-approved | I | AC-INV-004, BR-03 |
| reject → Draft marked Returned with the reason → fix → submit again | E | SM-SA |

### FLW-WHM-06 Receive tyres
| Test | Layer | Ref |
| --- | --- | --- |
| New / Supplier needs an invoice; each tyre In_Stock with a generated TY code | I+E | REQ-TYR-006, NFR-15 |
| source Existing is accepted | I | REQ-TYR-006 |

### FLW-WHM-07 Retread
| Test | Layer | Ref |
| --- | --- | --- |
| dispatch confirmed → tyres On_Retread and not selectable in a Stock step | I | AC-TYR-002 |
| Accepted → In_Stock, retread count +1 | I | AC-TYR-003 |
| Rejected without a reason is refused | I | AC-TYR-004 |
| one tyre Not returned yet → dispatch Partial | I | AC-TYR-005 |

### FLW-WHM-08 Tyre condition and list
| Test | Layer | Ref |
| --- | --- | --- |
| Worn out and Scrap follow SM-TYRE; Scrap is final and needs a reason | U+I | SM-TYRE, REQ-TYR-010 |

### FLW-WHM-09 Tyre count
| Test | Layer | Ref |
| --- | --- | --- |
| an approved count with one Missing tyre sets it Lost and out of In Stock | I | AC-TYR-006 |
| the counter cannot approve | I | REQ-TYR-012, BR-03 |

### FLW-WHM-10 Receive parts of a cancelled SPK
| Test | Layer | Ref |
| --- | --- | --- |
| GR type From cancelled SPK is prefilled from the Part Purchase items; each line maps to a SKU or is not kept | I+E | REQ-SPK-008 |

---

## 6. Supervisor and GM (web; mobile in P1)

### FLW-APR-01 Approve SPK creation
> As an Approver, I want to review and approve or reject an SPK, so that only authorized work runs.

| Test | Layer | Ref |
| --- | --- | --- |
| Approvals › Surat Perintah Kerja › Creation → ApprovalReview → Approve: stamp, Active, step 1 Open | E | T3, AC-SPK-002 |
| the creator's approval is refused; a Supervisor's is accepted | I | AC-SPK-001, BR-03 |
| an SPK created by the viewer is not in their list, unless System Admin | I | AC-APR-003 |
| the System Admin approving its own SPK → Self-approved stamp and audit flag | I | AC-SPK-006 |
| reject without a reason is refused; with one → Rejected, creator notified | I | AC-APR-004, T4 |
| once a Supervisor approves, the item leaves the GM's list | I | AC-APR-002, BR-04 |
| a Mechanic, and a Planner while the switch is off, do not see Approvals; the System Admin does | I+E | AC-APR-001 |
| approve is idempotent on retry | I | NFR-01 |

### FLW-APR-02 Approve an amendment
| Test | Layer | Ref |
| --- | --- | --- |
| approve → amendment number +1, old list kept in history, step resumes | I | AC-CR-003, T9 |
| reject → original content stays, step resumes | I | AC-CR-002, T10 |

### FLW-APR-03 Approve completion
| Test | Layer | Ref |
| --- | --- | --- |
| approve → Completed, vehicle status recalculated, part items reset, unmounted Issued tyres released | I | T13, AC-PUR-004 |
| reject with a reason → stays Pending_Verification, Planner notified | I | T14 |
| a Completed SPK refuses every write | I | BR-16 |

### FLW-APR-04 Approve warehouse documents
| Test | Layer | Ref |
| --- | --- | --- |
| an approved stock opname adjusts stock; an approved tyre count sets Lost | I | SM-SA, SM-TC, AC-TYR-006 |
| reject → Draft marked Returned | I | SM-SA |

### FLW-APR-05 Cancel an SPK
| Test | Layer | Ref |
| --- | --- | --- |
| cancel needs a reason; reverses the posted issue, sets the Issued tyre In_Stock, then the SPK Cancelled, in that order | I | AC-SPK-004, T15 |
| the cancelled SPK's schedule card leaves the open lists | I | T15 effect |
| the cancelled number is never reused | U | NFR-15 |

### FLW-APR-06 Look back and follow up
| Test | Layer | Ref |
| --- | --- | --- |
| ApprovalsHistory lists past decisions with reasons and stamps | E | REQ-APR-007 |
| the schedule is view only for Supervisor and GM | I | REQ-SCH-005 |
| Reports (P1): deferred | — | REQ-RPT-* |

### FLW-APR-07 Mobile app (P1): deferred.

### FLW-APR-08 Early failure on a review
| Test | Layer | Ref |
| --- | --- | --- |
| battery 200 of 730 days → 27 % life used and the Early failure flag | U+I | AC-APR-005 |
| brake pads at 45 % with tolerance 80 % → flag, notify Planner, Supervisor and GM; the SPK is still approvable | I | AC-BSL-005 |
| one life-used function (km or days; days only for Towed) serves tyres, part items and PM | U | §8.3, AC-PLC-008 |

### FLW-APR-09 Follow an SPK that overruns its planned day
> As a Supervisor, I want a unit that overruns its plan marked OFF and its cost billed, so that delays are visible and charged.

| Test | Layer | Ref |
| --- | --- | --- |
| status precedence Inactive > OFF > Blocked > Repair > Active | U | SM-VEH |
| a scheduled SPK in Repair that misses its day makes the vehicle OFF until Completed or Cancelled | I | DEC-92 |
| `off_days` rises once per WIB day even when the job runs twice | I | DEC-92, NFR-12 |
| creator, open-step executor, Planners, FCs and GM get one late alert on each overrun morning | I | AC-SCH-005 |
| the invoice has an `Off_Unit` line = off_days × rate, without markup | U+I | REQ-BIL-003 |
| OFF does not block SPK creation or amendment | I | REQ-SPK-013 |

---

## 7. System Admin (web and the mobile field menu)

### FLW-SA-01 Add a vehicle with its first data
| Test | Layer | Ref |
| --- | --- | --- |
| AddVehicle → Save and add parts → PartsBaseline → Save; vehicle Active | E | REQ-VEH-002, REQ-BSL-001 |
| saved without insurance → insurance Missing, vehicle Blocked | I | AC-DOC-004 |
| a document with a past expiry shows Expired | I | AC-DOC-005 |
| baseline tyres show on the Part Replacement map and the Vehicles map | I+E | AC-BSL-002 |
| a trailer (Towed) has no odometer field | E | AC-PLC-008 |

### FLW-SA-02 Documents
| Test | Layer | Ref |
| --- | --- | --- |
| KIR 30 days from expiry → Warning and exactly one Draft Document SPK | I | AC-DOC-001 |
| on the expiry date → Expired and refused for trips | I | AC-DOC-002, BR-08 |
| renewal Document step verified → Valid, assignable to trips again | I+E | AC-DOC-003 |
| Correct entry after a renewal SPK exists is refused | I | AC-DOC-006 |

### FLW-SA-03 Keep a vehicle up to date
| Test | Layer | Ref |
| --- | --- | --- |
| a class change with a mounted tyre is refused | I | AC-VEH-003 |
| 48.000 km after 48.210 km is refused; a jump above 1.500 km/day warns | U+I | AC-VEH-001, BR-09 |
| voiding 418.200 km returns the odometer to the last valid reading, logged | I | AC-VEH-002 |
| Correct baseline on a part reset by a completed SPK is refused | I | AC-BSL-004 |
| deactivation is refused while an SPK is open | I | REQ-VEH-004 |
| oil filter at 10.100 km with a 10.000 km life → next due 20.100 km; no baseline → no alert | U | AC-BSL-001, AC-BSL-003 |

### FLW-SA-04 Enter driver data in release 1
| Test | Layer | Ref |
| --- | --- | --- |
| an inspection Fail without a photo is refused | I | AC-PM-002 |
| an inspection Fail raises a Report Breakdown and drafts no SPK | I | REQ-PM-004, REQ-BRK-009 |
| an Urgent report for a driver drafts an SPK with one Mobilisasi step and shows the pop-up; a Normal report does neither | I | REQ-BRK-003, REQ-BRK-004 |

### FLW-SA-05 Master data
| Test | Layer | Ref |
| --- | --- | --- |
| each master data save writes its own audit record | I | NFR-02 |
| Towed layout of 3 axles × 2 per side + 1 spare → 13 positions with a kingpin | U | AC-PLC-007 |
| a new class (8x4, 0 spares) → 12 positions, drawn everywhere without code change | U+E | AC-PLC-010 |

### FLW-SA-06 Oversight
| Test | Layer | Ref |
| --- | --- | --- |
| AuditLog flags self-approvals and self-verifications | I | NFR-02, BR-03 |
| the System Admin never sees or opens Users and roles | I+E | AC-IAM-003, RL-4 |

### FLW-SA-07 Field work on the phone (R1 step 7)
| Test | Layer | Ref |
| --- | --- | --- |
| SAMobileHome lists reports, purchases and open steps | E (mobile) | REQ-MOB-008 |
| a Mobilisasi step on the phone follows FLW-MEC-09; a Mechanic Action step has no stooring area | I | AC-MBL-002, AC-MEC-005 |
| a phone submit gives the same stamps and photos in the SPK document | I | AC-MOB-001 |

### FLW-SA-08 Set up and go live
| Test | Layer | Ref |
| --- | --- | --- |
| in Setup mode only the System Admin and Access Managers sign in; a Planner gets "The system is being set up" | I+E | AC-IAM-006, DEC-56 |
| opening balance 420 L @ Rp 76.500 → one OB row, no approval; refused after Go live | I | AC-INV-006 |
| a bulk import with 2 invalid rows imports nothing and lists them; fixed → 100 created; refused when Live | I | AC-IAM-007 |
| typing GO LIVE switches to Live once, one way | I+E | REQ-IAM-010 |

### FLW-SA-09 Maintain vendors
| Test | Layer | Ref |
| --- | --- | --- |
| a saved vendor is pickable in GR, Part Purchase, external services and retread dispatch | I | REQ-INV-014 |

### FLW-SA-10 Set a vehicle's driver
| Test | Layer | Ref |
| --- | --- | --- |
| setting Joko on B 1234 ABC clears D 4410 KL; both notified; the app shows only B 1234 ABC | I | AC-VEH-004 |

---

## 8. Access Manager, Driver, Field Coordinator, Accounting

### FLW-AM-01 to 05 Accounts and access
| Test | Layer | Ref |
| --- | --- | --- |
| an account gets exactly one role; a second role is refused | I+E | AC-IAM-004, RL-1 |
| locked matrix cells cannot change; other cells change what the user sees on the next page load | I+E | REQ-IAM-005, AC-IAM-009 |
| removing `vehicle.view` from Accounting hides Vehicles and `GET /vehicles` returns 403 | I | AC-IAM-009 |
| a second System Admin is refused; moving Yusuf → Rina writes exactly one audit record | I | AC-IAM-001, AC-IAM-002 |
| the System Admin account cannot be deactivated while it holds the role | I | BR-14 |
| 5 failed sign-ins lock the account for 15 min; Unlock clears it | I | NFR-05, REQ-IAM-001 |
| the Access Manager does no operational work | I | RL-5 |

### FLW-AM-06 Planner approval switch
| Test | Layer | Ref |
| --- | --- | --- |
| on until 18:00 → a Planner approves a Mechanic's SPK, its own is refused; after 18:00 Approvals disappears | I | AC-IAM-005 |
| on for SPK creation only → `GET /me` holds `spk.approve`, not `count.approve`; stock opname approval refused | I | AC-IAM-008 |
| a Planner's own Pending SPK never carries `approve` in `allowedActions` | I | AC-IAM-010 |
| each switch is audited and notified to Supervisors and GMs | I | RL-7 |

### FLW-DRV-01 to 04 Driver (mobile, R1 step 7)
| Test | Layer | Ref |
| --- | --- | --- |
| a Driver sees only the Driver menu | E (mobile) | AC-MOB-003 |
| an inspection Fail needs a photo, a description and an urgency, and raises a report without a draft | I | AC-PM-002, REQ-BRK-009 |
| a report captures the location once; only Urgent drafts an SPK with one Mobilisasi step and shows the pop-up | I+E | AC-BRK-003, AC-BRK-004, REQ-MOB-003 |
| a reading lower than the last is refused; above 1.500 km/day warns | I | BR-09 |
| a Blocked vehicle shows a do-not-operate reminder | E | REQ-DOC-012 |

### FLW-FC-01 to 05 Field Coordinator
| Test | Layer | Ref |
| --- | --- | --- |
| the dashboard shows Active, Repair and Blocked counts with reasons | E | REQ-DSH-006 |
| the placement map has no edit controls for the FC | E | AC-PLC-005 |
| the schedule is read only; a drag is refused | I | AC-SCH-004 |
| the FC sends a report; the list is read only: Create SPK, Reject, Submit and Approve are absent | I+E | AC-BRK-005, RL-6 |
| an Urgent report from the FC drafts an SPK without the pop-up | I | AC-BRK-003 |
| a report without a note or a photo is refused | I | AC-BRK-002 |
| Part Purchase: 3 L × 82.000 and 2 × 45.000 → 246.000, 90.000, total 336.000 | U+E | AC-PUR-001 |
| price changed to 85.000 → 255.000 and 345.000 at once, without saving | U+E | AC-PUR-002 |
| 5 L bought for a 3 L shortfall is accepted; no way to add an unlisted part | I | AC-PUR-006 |
| submit leaves warehouse stock unchanged and raises the SPK parts cost | I | AC-PUR-003, BR-06 |
| returned with "Receipt total 340.000" → the step reopens with its lines kept | I | AC-PUR-005 |
| line and grand totals use one shared decimal function, never floating point | U | §8.3 |

### FLW-ACC-01 to 03 Accounting
| Test | Layer | Ref |
| --- | --- | --- |
| two SPKs of one vehicle completed on 3 Nov → one Draft invoice; a 4 Nov SPK → a new draft | I | AC-BIL-001 |
| oil filter cost 64.000 → billed 96.000; service 150.000 without markup; the PDF shows no cost, markup or SPK number | U+I | AC-BIL-005, NFR-16 |
| editing a line of an Issued invoice is refused | I | AC-BIL-002 |
| void with a reason → SPKs on a new Draft; the voided number is never reused | I | AC-BIL-003, BR-15 |
| a vehicle without a customer → Not billable; customer set → Draft | I | AC-BIL-004 |
| Supervisor `allowedActions` hold mark_paid and void; the GM's are empty and the API refuses a GM mark_paid | I | AC-IAM-010 |

### FLW-MEC-10 Send a Report Breakdown on the web (DEC-109)
| Test | Layer | Ref |
| --- | --- | --- |
| a Mechanic opens ReportBreakdownForm, picks the vehicle, writes the note, adds a photo and an urgency, and sends: one New report, no SPK | E+I | AC-BRK-001 |
| Planners, the FC and the System Admin are notified; the Mechanic has no Create SPK, Submit or Approve | I | REQ-BRK-002, RL-6 |

### FLW-PLN-11 Create an SPK from a Report Breakdown (DEC-109)
| Test | Layer | Ref |
| --- | --- | --- |
| the pop-up shows on any page, ignores Escape and a click outside, and Create SPK closes it for every Planner and opens the draft in a new tab | E | AC-BRK-004 |
| Create SPK on a New report fills vehicle, source and priority; leaving without saving makes no SPK and uses no number | I+E | AC-BRK-006 |
| the description shows "Report reference: RB-yymmddNNNN" on Create SPK, the detail, the approval review and the document, and editing the description cannot remove it | I+E | REQ-BRK-006, DEC-91 |
| a Mobilisasi step added by hand has its destination filled from the report; a blank destination refuses Submit | I | REQ-MBL-002, REQ-SPK-004 |
| Reject needs a reason, cancels a linked Draft, notifies the reporter; cancelling the SPK otherwise returns the report to New with no pop-up | I | AC-BRK-007, SM-BRK |

### FLW-MEC-11 Inspect a vehicle on the phone (DEC-109)
| Test | Layer | Ref |
| --- | --- | --- |
| the Mechanic picks the vehicle; the reading is saved with source Mechanic | I+E | AC-BRK-009 |
| a Fail raises one Inspection_Fail report at any urgency, with no SPK and no pop-up | I | AC-BRK-008 |

## 9. File upload (8.1, applies to every flow with a photo or PDF)

| Test | Layer | Ref |
| --- | --- | --- |
| a 4,2 MB 4032 × 3024 photo is stored as a 1600 × 1200 JPEG below 1 MB without EXIF GPS, plus a 320 px thumbnail | I | AC-FUP-001 |
| an MP4 renamed .jpg is refused on the device and set Rejected by the server | U+I | AC-FUP-002 |
| an uncompressed 8 MB JPEG is compressed by the worker before Ready | I | AC-FUP-003 |
| Submit while a photo uploads submits once it is Ready, without a second tap | E | AC-FUP-004 |
| a 1,8 MB PDF is stored unchanged with a first-page thumbnail | I | AC-FUP-005 |
| a photo of a cancelled form is gone after 24 hours | I | AC-FUP-006 |
| an upload resumes after the signal returns (phone) | E (mobile) | AC-FUP-007 |
| a 14 MB camera photo is accepted and stored below 1 MB silently | I | AC-FUP-008 |
| thumbnails never show Compressing, Processing or sizes | E | AC-FUP-009 |

---

## 10. State machine tests (U layer, required by §8.3)

For each machine, a table test (`it.each`) reads the transition table in `packages/shared`: **every listed transition is accepted and every (state, event) pair not listed is refused.**

| Machine | Source | Allowed transitions |
| --- | --- | --- |
| SM-SPK | PRD §3.2 | T1–T15 |
| SM-STEP | §3.3, plus the `tracks_work_time = false` variant | 9 rows |
| SM-VEH (derived) | §3.4 | 5 statuses and precedence |
| SM-DOC | §3.5 | 6 rows |
| SM-TYRE | §3.6 | 16 rows; Scrapped and Lost final |
| SM-GR, SM-SA, SM-TC, SM-TR, SM-RD, SM-CR, SM-SCH, SM-INV | §3.7 | one per row |

At the I layer, each machine's single transition endpoint refuses an illegal transition with a clear message.

---

## 11. Capability matrix (I layer, generated)

A `role × permission_code` matrix is generated from §2.2 / §2.4 (10 roles × about 40 codes). For every cell:
- the guarded endpoint accepts (X/V) or refuses with 403 (blank);
- `GET /me` and the web menu agree with the cell (NAV-9);
- an L cell cannot be changed by the Access Manager;
- Setup mode removes the operational codes (REQ-IAM-010).

Plus one test per record type: `allowedActions` equals what the server accepts (DEC-93, REQ-IAM-014).

---

## 12. TDD order follows the release plan (PRD §10)

| Release step | Journeys tested first |
| --- | --- |
| R1 step 1 | §10 SM-SPK, §11 capability matrix, FLW-SA-08, FLW-AM-01 to 06, FLW-SA-01 (vehicles, layouts), FLW-PLN-01 (SPK core), FLW-APR-01, FLW-PLN-03, FLW-APR-05, BR-01 to 04, §9 uploads |
| R1 step 2 | SM-STEP with a dummy module, FLW-MEC-07, FLW-PLN-05, 07, 08, 09, FLW-APR-03, the master journey on dummy modules |
| R1 step 3 | FLW-WHM-01 to 05, FLW-FC-05 |
| R1 step 4 | FLW-MEC-01, 02, 08, FLW-PLN-10, FLW-MEC-09 (server side) |
| R1 step 5 | FLW-MEC-03, FLW-WHM-06 to 10, FLW-APR-08, baseline parts of FLW-SA-01 and 03 |
| R1 step 6 | FLW-SA-02, 04, 05, FLW-PLN-02, 04, 06, FLW-MEC-04, 05, FLW-APR-02, 04, 06, 09, FLW-FC-01, 02, 04, FLW-MEC-10, FLW-PLN-11, the full master journey |
| R1 step 7 | FLW-ACC-01 to 03, FLW-DRV-01 to 04, FLW-FC-03, FLW-SA-07, FLW-SA-10, FLW-MEC-06, FLW-MEC-09 (phone), FLW-MEC-11 |
| Release 2 | FLW-APR-07, Reports |
