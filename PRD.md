# BMI Stooring System: SDD Spec v2

Oct 26, 2026 · @rolling

This spec defines BMI Stooring System (formerly Fleet PM System, DEC-81), a web and mobile fleet preventive maintenance system in which no maintenance action happens on a vehicle unless an approved Surat Perintah Kerja (SPK) authorizes it. It is written for a spec-driven development (SDD) agent: every requirement has an ID, a priority, a testable statement and links to the screens, tables and rules it touches. It replaces the earlier Fleet PM System PRD as of rev 228 of that document, with every later addition merged into the section where it belongs.

## 0. How to read this spec

### 0.1 Source of truth

| Concern | Wins | Notes |
| --- | --- | --- |
| Behaviour, rules, data, field lists | Sections 2 to 5 and 9 | The design artifact never overrides them |
| Look and layout of every screen: regions, placement, paging, navigation, colour, type, spacing, shape, icons, elevation, motion | The design artifact ([Design Artifact/index.html](<Design Artifact/index.html>)), written down as a system in DESIGN.md (DEC-96) | The artifact is the visual target of the end product: build each screen to look like its artboard. Where DESIGN.md and an artboard differ, the artboard wins and DESIGN.md is corrected |
| Sample data, names and numbers in an artboard; the `?review` strip | Not built as drawn | Placeholders and a review aid; real data comes from the API and master data |
| A control, field or rule in the artifact but not in this spec | Not built | Raise it as a question; the spec decides behaviour |
| Something in this spec but not in the artifact | Built | Design it in the artifact's style, in the nearest matching region, and add it to the artifact |

### 0.2 ID scheme

| Prefix | Meaning | Example |
| --- | --- | --- |
| `R-` | Role | `R-PLN` Planner |
| `SM-` | State machine | `SM-SPK` Surat Perintah Kerja lifecycle |
| `REQ-<area>-<nnn>` | Functional requirement | `REQ-SPK-003` |
| `AC-<area>-<nnn>` | Acceptance criterion; names the REQ it verifies | `AC-SPK-002` verifies `REQ-SPK-003` |
| `BR-<nn>` | Business rule; an invariant no permission change can switch off | `BR-03` |
| `NFR-<nn>` | Non-functional requirement | `NFR-04` |
| `FLW-<role>-<nn>` | User flow | `FLW-PLN-01` |
| `DEC-`, `ASM-`, `Q-`, `RSK-` | Decision, assumption, open question, risk | `DEC-12` |
| Screen names in code | The artboard name. Artboards are module files in `Design Artifact/` (one screen per module for every role that reaches it, DEC-94); each artboard name is an anchor in its module file, and `Design Artifact/index.html` lists them all | [`CreateSPK`](<Design Artifact/spk/CreateSPK.html#CreateSPK>) |
| Table names in code | A table in section 9 | `spks` |

Area codes: `SPK` Surat Perintah Kerja lifecycle, `ENG` assignment engine, `REG` module registry and designer, `STK` Stock step, `MEC` Mechanic Action step, `MBL` Mobilisasi (mobilisation) step, `PLC` Part Replacement and map, `DOC` documents, `CR` change request and amendment, `SPKD` SPK document, `VEH` vehicles and odometer, `PM` maintenance and inspections, `BSL` parts baseline, `INV` parts inventory, `TYR` tyres and retread, `APR` approvals, `DSH` dashboards, `SCH` maintenance schedule, `IAM` accounts and access, `NTF` notifications, `MOB` mobile app, `RPT` reports, `AI` AI assistant, FUP file upload and compression.

### 0.3 Requirement syntax (EARS)

Every requirement and acceptance criterion uses one of these patterns. `THE SYSTEM SHALL` is a must; nothing in this spec is optional unless its priority says so.

| Pattern | Form |
| --- | --- |
| Ubiquitous | THE SYSTEM SHALL \<response>. |
| Event | WHEN \<trigger>, THE SYSTEM SHALL \<response>. |
| State | WHILE \<state>, THE SYSTEM SHALL \<response>. |
| Unwanted | IF \<condition>, THEN THE SYSTEM SHALL \<response>. |
| Optional | WHERE \<feature is included>, THE SYSTEM SHALL \<response>. |

### 0.4 Priorities and tags

| Tag | Meaning |
| --- | --- |
| P0 | Release 1 (the first release) |
| P1 | Release 2 |
| P2 | Later |
| \[A\] | Assumption the product owner has since confirmed (DEC-58); build it as written and keep it easy to change. Listed in [docs/prd/history.md](docs/prd/history.md) (11.2) |

### 0.5 Conventions used everywhere

- "System Admin" (`R-SA`) passes every operational role check (`BR-03`). Wherever a requirement names an operational role, read "or the System Admin".
- "Approver" means a Supervisor, the GM or the System Admin; any one of them is enough (`BR-04`).
- "Verifier" means a Planner or the System Admin.
- Numbers use the Indonesian format (48.210 km, Rp 1.240.000, 2,4 mm); dates are `YYYY-MM-DD`, times `HH:MM:SS` (`NFR-09`).
- Build order for an agent: data model (section 9) and rules (section 5) first, then requirements by release step (section 10), then screens (section 7).

### 0.6 Spec files and what to load

The spec is split so an agent loads only what its task needs. Section numbers and IDs are the same in every file, so a reference such as "4.6", "REQ-PLC-008" or "9.13" means the same thing wherever it appears. This file (PRD.md) is the core and wins over the others when they disagree.

| File | Holds | Load it when |
| --- | --- | --- |
| PRD.md (this file) | 0 to 3 (scope, roles, permissions, capability catalogue 2.4, state machines), 5 business rules, 8 NFRs, stack and engineering practices, 10 release plan, 11 active decisions, open questions and risks; plus the index of every area file | Always |
| `docs/prd/areas/<n>-<code>.md` | One functional area of 4 (requirements and acceptance criteria), and 8.1 file upload | Working on that area; the index is in section 4 |
| [docs/prd/data-model.md](docs/prd/data-model.md) | 9: the schema, integrity rules and key transactions (TX-\*) | Touching tables, migrations, the DataGateway or a transaction |
| [Design Artifact/index.html](<Design Artifact/index.html>) | The visual target of every screen, web and `mobile/` (DEC-96) | Building or changing any screen: open its artboard first |
| [docs/prd/ui.md](docs/prd/ui.md) | 7.1 to 7.8 and 7.11: layout, screen inventory, key layouts, shared components, navigation, brand, DQ decisions | Building or changing a screen |
| [docs/prd/ui-action-map.md](docs/prd/ui-action-map.md) | 7.9: every control on every screen and what it does | Wiring the controls of a screen |
| [docs/prd/flows.md](docs/prd/flows.md) | 6: user flows by role (FLW-\*) | Writing an end-to-end test or checking a journey |
| [docs/prd/traceability.md](docs/prd/traceability.md) | 12: per area, where it is specified, tested, shown, stored and guarded | Finding everything that belongs to one area |
| [docs/prd/history.md](docs/prd/history.md) | Superseded decisions, retired requirements and transactions, the assumption log (11.2), earlier change history | Only to look up an old ID; nothing in it is built |

A typical task loads PRD.md, one area file and the matching part of data-model.md.

### 0.7 Naming: one entity, one name

**The entity is named Surat Perintah Kerja, SPK for short, everywhere: screens, documents, this spec, requirement IDs, tables, permission codes, artboards, files and code (DEC-106).** The former name (Work Order, WO) is retired and survives only in docs/prd/history.md. If someone still says it in conversation they mean an SPK; there is no second entity and nothing to map.

| Where | Form |
| --- | --- |
| Menus, page titles, headings | Surat Perintah Kerja |
| Buttons, tables, running text | SPK |
| Document number | SPK-yymmddNNNN |
| Requirement, criterion and machine IDs, area code | REQ-SPK-*, AC-SPK-*, SM-SPK, SPK |
| SPK document area | REQ-SPKD-*, AC-SPKD-*, SPKD |
| Tables and columns | spks, spk_*, spk_number, issued_spk_id |
| Permission codes | spk.view, spk.create, spk.approve, spk.cancel |
| Artboards, files, folders | CreateSPK, SPKList, SPKDetail, SPKDocument, spk/ |
| TypeScript types and classes | SpkGateway, core/spk/ |

## 1. Overview and scope

### 1.1 Problem

The company runs light delivery vans, medium trucks and heavy trucks. Breakdowns interrupt deliveries, work and parts are not tied to a vehicle and an authorization, tyre history is unknown, legal documents (STNK, KIR, insurance) can lapse while a vehicle still operates, and nobody can prove who approved, did and checked a repair.

### 1.2 Product principles

| ID | Principle | Enforced by |
| --- | --- | --- |
| PR-1 | The SPK is the only door: every module action needs an active SPK and its open step | `BR-01` |
| PR-2 | Scope lock: a step touches only the vehicle and parts named in its SPK | `BR-02` |
| PR-3 | Ordered, not blocked: steps run in sequence; verification runs in parallel and never holds the next step | `BR-05` |
| PR-4 | Everything leaves a trail: executor stamp, verifier stamp, timestamps and an audit record | `NFR-02` |
| PR-5 | Show, don't tell: tyre positions are shown on a vehicle map, not in a list | `REQ-PLC-*` |
| PR-6 | Data, not code: modules, steps, vehicle classes, chassis layouts, tyre statuses and document types are master data | `REQ-REG-*`, `REQ-PLC-*` |

### 1.3 Goals and success metrics

| ID | Goal | Metric | Target |
| --- | --- | --- | --- |
| G-1 | No unauthorized maintenance | Stock issues, part placements and service lines linked to an approved SPK | 100% |
| G-2 | Fewer breakdowns through PM | PM completed on time (km or days, whichever first) | Set after baseline (Q-01) |
| G-3 | Legal compliance | Vehicles assigned to trips with an Expired or Missing document | 0 |
| G-4 | Full accountability | Completed SPKs with executor, verifier and approver stamps | 100% |
| G-5 | Cost visibility | SPKs with complete parts, labor and document cost; cost per vehicle and per km | 100% costed |
| G-6 | Inventory accuracy | Variance at stock opname | Set after baseline (Q-01) |
| G-7 | Speed | SPK cycle time, Active to Completed | Set after baseline (Q-01) |

### 1.4 Out of scope

- A live WhatsApp gateway and email notifications (P2); the only email in Release 1 is the password reset link (DEC-102). Telematics is an adapter; Protrack is the first odometer provider (P1).
- Procurement and purchase orders beyond a PO number on a Goods Receipt; cash advances and reimbursement for parts bought by the Field Coordinator (the system records only price and receipt).
- Parallel steps inside one SPK (P2).
- Driver payroll, tax filing and the accounting ledger (customer invoices are in scope, 4.23); video upload of any kind (DEC-31).

### 1.5 Glossary

| Term | Meaning |
| --- | --- |
| Surat Perintah Kerja (SPK) | The authorization for maintenance on one vehicle; holds an ordered list of steps. Numbered SPK-yymmddNNNN, for example SPK-2611040142 (NFR-15). See 0.7 |
| SPK preset | A saved step sequence (steps, order, executor, verifier and step details) that a Planner or System Admin may start an SPK from; the SPK may change it freely and never follows later changes; versioned |
| Category | The kind of work of an SPK: PM, Corrective, Tyre, Document or Other; used for lists, filters and reports |
| Part Check | A step module for troubleshooting: the mechanic reports the condition of each requested part, decides Good, Repair or Replace and adds photos; the not-good findings become a Draft SPK for the Planner |
| Report Breakdown | What a Driver, Mechanic or Field Coordinator sends from the field: a finding note, photos and an urgency, with the location captured by the device. It is not an SPK: the Planner or System Admin creates the SPK with the report as its reference (REQ-BRK-001 to REQ-BRK-009, DEC-109). Numbered RB-yymmddNNNN |
| Step (assignment) | One unit of work in an SPK, run by one module (Stock, Part Purchase, Mechanic Action, Mobilisasi, Part Replacement, Document) |
| Module | A registered kind of step with a fixed contract (`REQ-REG-*`) |
| Mobilisasi (Mobilization) | A registered assignment module (master data, PR-6) for sending a mechanic to the driver's location; its executor is the Mechanic travelling there, and it produces the stooring fee of its region (`REQ-MBL-*`) |
| Executor | The user who fills and submits a step |
| Verifier | Planner or System Admin who checks a submitted step |
| Approver | Supervisor, GM or System Admin who approves SPK creation, amendment, completion and warehouse counts; a Planner also approves SPKs while the Access Manager has switched Planner approval on (REQ-IAM-008) |
| Change request | A request by a step executor to change SPK content; puts the SPK in Pending Amendment |
| Amendment | An approved revision of SPK content; raises the amendment number |
| Scope lock | The rule that a step may change only its SPK's vehicle and listed parts |
| Parts baseline | First entry of the tyres and service parts a vehicle already has, without an SPK |
| Part item type | A tracked service part (oil filter, brake pads, battery) with a life in km and days |
| Chassis layout | Data that defines axles, tyre positions and spare positions of a unit (head, trailer tail, rigid truck); the map is drawn from it |
| Tyre code | System identifier of a tyre (TY-0101), generated, never reused |
| Serial number | The number printed on the tyre; unique per brand \[A\] |
| Goods Receipt (GR) | Parts into the warehouse from a supplier; posted without approval |
| Goods Issue (GI) | Parts out of the warehouse into an SPK, written by the Stock step |
| Stock opname | Physical count of parts; one document, many SKU rows; needs approval |
| Tyre count | Physical count of tyres in the warehouse; needs approval |
| Retread dispatch | Tyres sent to a retread vendor (vulkanisir) |
| Maintenance schedule | The Planner's calendar of SPK cards; a plan, never a rule on the SPK |
| Self-approved / Self-verified | Mark on a stamp when the System Admin decides its own work |
| DVIR | Daily vehicle inspection report |
| CPK | Cost per km |
| Purchase line | A line of the Part Purchase step: a part from the SPK's part list (set by the Planner or System Admin) bought outside, with a typed quantity and price; never changes warehouse stock |
| Normal life | The km and days a part item type should last, set by the Planner |
| Early failure | A part replaced before the tolerance of its normal life; raises an alert, never blocks |
| Invoice | The bill to a vehicle's customer for the SPKs completed on one day |
| Setup mode | The state before go-live: only the System Admin enters data, without approval; no SPKs exist |
| Go live | The one-way switch from Setup mode to normal operation |
| Stooring | The mobilisation fee for work done outside the workshop, priced per area |
| OFF | A derived vehicle status (SM-VEH): the unit is not operating because a scheduled SPK ran past its planned day while the vehicle was already in Repair; it holds until that SPK is Completed or Cancelled (DEC-92) |
| OFF-unit cost | The daily charge while a vehicle is OFF: `off_days` × the OFF-unit daily rate from Settings, billed to the vehicle's customer at cost as the `Off_Unit` invoice line (REQ-BIL-003, DEC-92) |
| Vendor | A supplier, workshop, retread vendor or shop picked from the vendor master |
| Claim | Taking an unassigned step by being the first executor to open it |

## 2. Roles and permissions

Ten roles exist, each account holds exactly one, and exactly one account holds System Admin (`BR-14`). The permission matrix in 2.2 is the default; the Access Manager may change it except for the cells marked locked (`REQ-IAM-005`).

### 2.1 Role catalogue

| ID | Role (`role_t`) | Channel | Purpose |
| --- | --- | --- | --- |
| `R-PLN` | Maintenance Planner (`Planner`), called "PM" | Web | Plans maintenance: creates SPKs and builds their steps, maintains SPK presets, plans the schedule, verifies steps, requests completion, sets the normal life of part item types. Agrees approval decisions with the Supervisor or GM; approves in the system only while Planner approval is switched on (`RL-7`) |
| `R-MEC` | Mechanic ([`Mechanic`](<Design Artifact/steps/Mechanic.html#Mechanic>)) | Web or tablet; mobile in R1 step 7 (DEC-98) | Does repairs: Mechanic Action, Part Replacement and Part Check steps with the work location, change requests, inspections and Report Breakdowns |
| `R-WHM` | Warehouse Manager (`Warehouse_Manager`), the only warehouse role | Web | Parts and tyres: Goods Receipts, Stock steps and Part Purchase steps, receive tyres, retread, stock opname, tyre count |
| `R-SUP` | Supervisor (`Supervisor`) | Web; mobile from P1 | Approver; owns customer invoices together with Accounting |
| `R-GM` | General Manager (`GM`), acts as director | Web; mobile from P1 | Approver with every right of `R-SUP`, plus wider data (`RL-8`) |
| `R-SA` | System Admin (`System_Admin`), exactly one account | Web; mobile field menu (R1 step 7) | Every operational permission of every other role (the urgent report pop-up shows only to Planners, REQ-BRK-004), plus master data, vehicles, documents, baseline, odometer voids and AI settings. Covers the field admin work (admin lapangan): creates SPKs from Report Breakdowns, records purchase lines, repairs, verifies. May self-approve and self-verify (marked). Cannot manage accounts, roles or permissions |
| `R-AM` | Access Manager (`Access_Manager`), one or more accounts | Web | Accounts, roles, permissions, the Planner approval switch, and moving the System Admin role. No operational work |
| `R-DRV` | Driver (`Driver`) | Mobile (R1 step 7) | Daily inspection, Report Breakdown, odometer. Until the mobile app ships, the System Admin enters this data for the driver |
| `R-FC` | Field Coordinator / Koordinator Lapangan (`Field_Coordinator`), merged with the former Dispatcher | Web; mobile (R1 step 7) | Fleet availability, schedule and alerts for trip planning; sends Report Breakdowns and follows the Report Breakdown list; executes the Part Purchase step (`RL-6`) |
| `R-ACC` | Accounting (`Accounting`) | Web | Customers and invoices: reviews the daily invoice drafts, issues, prints, marks paid or void (4.23). Reads completed SPK costs; no maintenance work |

### 2.2 Permission matrix

X = allowed, V = view only, blank = not allowed, L = locked by a business rule (the Access Manager cannot change it), S = switchable: off by default, the Access Manager switches it on or off (REQ-IAM-008).

| Capability | PLN | MEC | WHM | SUP | GM | SA | AM | DRV | FC | ACC | Ref |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Role dashboard (web or mobile home) | V | V | V | V | V | V |  | V | V | V | REQ-DSH-\*, 2.4 |
| View Surat Perintah Kerja (list and detail) | V | V | V | V | V | X |  |  | V |  | REQ-SPK-\*, RL-9, 2.4 |
| Report Breakdown list; create an SPK from a report or reject it | X |  |  |  |  | X |  |  | V |  | REQ-BRK-005, 2.4 |
| Create, edit and submit an SPK | X |  |  |  |  | X |  |  |  |  | REQ-SPK-001 |
| Approve or reject SPK creation, amendment, completion | S |  |  | X L | X L | X L |  |  |  |  | BR-04, REQ-IAM-008 |
| Cancel an SPK |  |  |  | X | X | X |  |  |  |  | REQ-SPK-008 |
| Stock step (cut stock from the warehouse) |  |  | X |  |  | X |  |  |  |  | REQ-STK-001 |
| Part Purchase step (bought outside) |  |  | X |  |  | X |  |  | X |  | REQ-PUR-001 |
| Execute Mechanic Action or Part Replacement |  | X |  |  |  | X |  |  |  |  | REQ-MEC-*, REQ-PLC-* |
| Execute a Mobilisasi step |  | X |  |  |  | X |  |  |  |  | REQ-MBL-* |
| Execute a Document step |  |  |  |  |  | X |  |  |  |  | REQ-DOC-007 |
| Verify or return a step | X |  |  |  |  | X |  |  |  |  | REQ-ENG-005 |
| Request completion approval | X |  |  |  |  | X |  |  |  |  | REQ-ENG-006 |
| Raise a change request (executor of the open step) |  | X | X |  |  | X |  |  | X |  | REQ-CR-001 |
| Build SPK steps, maintain SPK presets and PM packages | X |  |  |  |  | X |  |  |  |  | REQ-REG-001 |
| Part item types: normal life and early-failure tolerance | X |  |  |  |  | X |  |  |  |  | REQ-BSL-007 |
| Other master data (services, classes and layouts, document types, thresholds, tyre statuses, stooring rates, OFF-unit rate, vendors) |  |  |  |  |  | X |  |  |  |  | 7.3 |
| Add, edit, deactivate vehicles; document first entry and correction; parts baseline and correction; odometer void |  |  |  |  |  | X |  |  |  |  | REQ-VEH-*, REQ-DOC-*, REQ-BSL-\* |
| Record a manual odometer reading \[A\] | X |  |  |  |  | X |  |  |  |  | REQ-VEH-006 |
| Inspection and Report Breakdown for a driver (until the mobile app ships) |  |  |  |  |  | X |  |  |  |  | REQ-PM-004, REQ-BRK-001 |
| Send a Report Breakdown |  | X |  |  |  | X |  | X | X |  | REQ-BRK-001 |
| Urgent report pop-up | X |  |  |  |  |  |  |  |  |  | REQ-BRK-004 |
| Inspection on the phone |  | X |  |  |  |  |  | X |  |  | REQ-MOB-003, REQ-BRK-008 |
| Driver menu: odometer and history on the phone |  |  |  |  |  |  |  | X |  |  | REQ-MOB-003 |
| Goods Receipt, GR correction, parts master, stock opname |  |  | X |  |  | X |  |  |  |  | REQ-INV-\* |
| Receive tyres, retread, worn out, scrap, tyre count |  |  | X |  |  | X |  |  |  |  | REQ-TYR-\* |
| Approve stock opname and tyre count | S |  |  | X L | X L | X L |  |  |  |  | BR-12 |
| Place and move schedule cards | X |  |  |  |  | X |  |  | V |  | REQ-SCH-002 |
| View the schedule | X | V | V | V | V | X |  |  | V |  | REQ-SCH-005 |
| View vehicles, documents and the placement map | V | V | V | V | V | X |  |  | V | V | REQ-PLC-012 |
| Part age and early-failure alerts | V |  |  | V | V | V |  |  |  |  | REQ-APR-011, REQ-BSL-009 |
| Customers and invoices |  |  |  | X | V \[A\] | X |  |  |  | X | REQ-BIL-\* |
| Reports (P1) | V |  | V (Inventory tab) \[A\] | V (no Cost tab) \[A\] | V (all tabs) | V |  |  |  | V (Billing tab) \[A\] | REQ-RPT-004 |
| Manage accounts, roles, permissions; move System Admin |  |  |  |  |  | L | X L |  |  |  | BR-14 |
| Switch Planner approval on or off |  |  |  |  |  | L | X L |  |  |  | REQ-IAM-008 |
| Audit log \[A\] |  |  |  |  | V | V | V |  |  |  | REQ-IAM-007 |
| AI assistant settings (P1) |  |  |  |  |  | X |  |  |  |  | REQ-AI-002 |
| Setup mode data entry without approval; Go live | - | - | - | - | - | X L | - | - | - | - | REQ-IAM-010 |
| Assign or reassign a step | X | - | - | - | - | X | - | - | - | - | REQ-ENG-011 |
| Set the driver of a vehicle | - | - | - | - | - | X | - | - | X | - | REQ-VEH-010 |

### 2.3 Role rules

| ID | Rule |
| --- | --- |
| RL-1 | Each account has exactly one role (`uq_one_role_per_user`). The mobile app therefore always shows one menu. |
| RL-2 | Exactly one account holds System Admin (`BR-14`). Only an Access Manager moves it, in one step with a reason. |
| RL-3 | The System Admin passes every operational role check (executor, verifier, approver) and every self-decision is marked Self-approved or Self-verified (`BR-03`). It also covers the field admin work, so no separate field admin role exists. |
| RL-4 | The System Admin never manages accounts, roles or permissions and never opens Users and roles. |
| RL-5 | The Access Manager does no operational work: no SPKs, steps, stock, approvals or verifications. |
| RL-6 | The Field Coordinator sends Report Breakdowns and sees the Report Breakdown list, executes the Part Purchase step and sets the driver of a vehicle (REQ-VEH-010). Everything else is read only: it never creates an SPK, issues from the warehouse, moves a schedule card, verifies or approves. |
| RL-7 | Planner approval is off by default. While an Access Manager has switched it on, every Planner is an Approver for the approval kinds the Access Manager ticked: SPK creation, amendment, completion, stock opname, tyre count. `BR-03` still applies: a Planner never approves an SPK it created. Every switch is written to the audit log and notified to Supervisors and GMs. |
| RL-8 | The GM is the director: every right of the Supervisor, plus fleet-wide cost figures, all report tabs including Cost, the early-failure report and the audit log \[A\]. |
| RL-9 | Accounting does no maintenance work; it sees completed SPKs only through their invoices and the vehicles read only. |
| RL-10 | The company has no branches: there is no branch field, filter or data scope anywhere (DEC-55). |

### 2.4 Capabilities, effective permissions and what the interface shows (DEC-93)

The matrix of 2.2 says *what kind of action* a role may take. It does not say whether a user may take that action *on one record*, and it does not say what a screen shows. Those are three separate checks, always made on the server (`REQ-IAM-006`):

| Layer | Question | Decided by | Example |
| --- | --- | --- | --- |
| L1 Capability | May this role take this kind of action at all? | The effective capability set (below) | A Mechanic has `mechanic.execute`; an Accounting user does not |
| L2 Record rule | May this user take this action on this record now? | One policy function per action on the server (8.3), on top of L1 | Only the executor role of the open step (`REQ-ENG-003`); an Approver never approves its own SPK (`BR-03`); scope lock (`BR-02`); the record's state machine (3) |
| L3 Interface | Which menu items, tabs, sections and buttons does this user see? | The effective capability set (menu) and the record's `allowedActions` (buttons); never the role name | The Supervisor sees Issue, Mark paid and Void on an invoice; the GM opens the same page and sees none of them |

**Effective capability set.** THE SYSTEM SHALL compute, in one server function used by the endpoint guard, the record policies, the menu and `GET /me`, a user's capabilities as: the `role_permissions` rows of the user's role with `allowed = true` (seeded from 2.2, edited by the Access Manager, `REQ-IAM-005`), plus `spk.approve` while Planner approval is on for SPK creation, amendment or completion and `count.approve` while it is on for stock opname or tyre count (`REQ-IAM-008`; the ticked kinds stay with the switch and are checked again by the L2 approval policy), minus the operational capabilities blocked by Setup mode (`REQ-IAM-010`: no `spk.*`, `step.*`, `stock.issue`, `purchase.line`, `*.execute`, `changerequest.raise`, `schedule.manage`, `invoice.manage`, `spk.approve` or `count.approve`). The System Admin's set is every operational capability (`BR-03`) and never holds `accounts.manage` (`RL-4`).

**From cell to code.** An X cell grants the action code of its row (and the row's view code, if it has one); a V cell grants only the view code; S is off until switched on; L is an X whose `role_permissions.is_locked` is true. A row with a V anywhere therefore has two codes, `<area>.view` and an action code, so "same page, different powers" is two rows in `role_permissions`, not a new column.

**Permission catalogue.** These are the only `role_permissions.permission_code` values. A new code is added here first; the guard, the menu and the Access Manager matrix ([`AMRolesPermissions`](<Design Artifact/access/AMRolesPermissions.html#AMRolesPermissions>)) read the same list.

| Code | Granted by the 2.2 row | Opens or allows |
| --- | --- | --- |
| `dashboard.view` | Role dashboard | Dashboard item; mobile home |
| `spk.view` | View Surat Perintah Kerja (any cell) | Surat Perintah Kerja item, SPK detail, step screens read only |
| `spk.create` | Create, edit and submit an SPK | Create SPK; Submit |
| `breakdown.view` | Report Breakdown list (V or X) | Report Breakdown item |
| `breakdown.review` | Report Breakdown list (X) | Create an SPK from a report, reject a report |
| `breakdown.send` | Send a Report Breakdown | Report breakdown on the web and the phone |
| `breakdown.urgent_alert` | Urgent report pop-up | Shows the blocking pop-up of REQ-BRK-004 |
| `spk.approve` | Approve or reject SPK creation, amendment, completion | Approvals item; approve and reject an SPK, an amendment, a completion |
| `spk.cancel` | Cancel an SPK | Cancel SPK |
| `stock.issue` | Stock step | Execute a Stock step |
| `purchase.line` | Part Purchase step | Execute a Part Purchase step |
| `mechanic.execute` | Execute Mechanic Action or Part Replacement | Execute those steps and Part Check |
| `mobilisasi.execute` | Execute a Mobilisasi step | Execute a Mobilisasi step |
| `docstep.execute` | Execute a Document step | Execute a Document step |
| `step.verify` | Verify or return a step | Verify, Return |
| `step.request_completion` | Request completion approval | Request completion |
| `step.assign` | Assign or reassign a step | Assign, reassign |
| `changerequest.raise` | Raise a change request | Raise change request (L2: only the executor of the open step) |
| `registry.manage` | Build SPK steps, maintain SPK presets and PM packages | Settings item; SPK presets, PM packages |
| `parttype.manage` | Part item types | Settings item; part item types |
| `masterdata.manage` | Other master data | Settings item; every other master data page |
| `settings.manage` | Other master data | Settings item; tax, markup, OFF-unit rate, alert thresholds |
| `vehicle.view` | View vehicles, documents and the placement map | Vehicles and Documents items, read only |
| `vehicle.manage` | Add, edit, deactivate vehicles; documents; baseline; odometer void | Add vehicle, edit, deactivate, Correct entry, Correct baseline, void |
| `vehicle.driver_set` | Set the driver of a vehicle | Set driver |
| `odometer.manual` | Record a manual odometer reading | Record odometer |
| `inspection.proxy` | Inspection and Report Breakdown for a driver | Vehicles › Inspections: enter for a driver |
| `inspection.perform` | Inspection on the phone | Inspection item of the mobile menu |
| `driver.menu` | Driver menu | Driver mobile menu |
| `inventory.manage` | Goods Receipt, GR correction, parts master, stock opname | Inventory item (Parts) and its actions; stock card export |
| `tyre.manage` | Receive tyres, retread, worn out, scrap, tyre count | Inventory item (Tyres) and its actions |
| `count.approve` | Approve stock opname and tyre count | Approvals item; approve and reject a count |
| `schedule.view` | View the schedule, and the V cell of Place and move schedule cards | Schedule item, read only |
| `schedule.manage` | Place and move schedule cards (X) | Drag and drop on the schedule |
| `partage.view` | Part age and early-failure alerts | Part age card, early-failure alerts |
| `invoice.view` | Customers and invoices (V or X) | Invoices and Customers items, read only |
| `invoice.manage` | Customers and invoices (X) | Create, issue, print, mark paid, void; customers |
| `report.view` | Reports (P1) | Reports item; the tabs follow `REQ-RPT-004` (P1) |
| `audit.view` | Audit log | Audit log item; audit log export |
| `accounts.manage` | Manage accounts, roles, permissions; move System Admin | Users and roles item |
| `iam.planner_approval_switch` | Switch Planner approval on or off | The Planner approval switch |
| `ai.settings` | AI assistant settings (P1) | AI settings (P1) |
| `setup.golive` | Setup mode data entry without approval; Go live | Setup and go live item; bulk import |
| `files.upload` | Not a row: held by every role that holds an action code above whose screen has an upload slot | Signed upload link (`REQ-FUP-004`) |

**Menu.** Each navigation item names the codes that show it; it shows when the user holds at least one of them (`NAV-9`). The table replaces any per-role list of items.

| Item (web) | Shown with any of |
| --- | --- |
| Dashboard | `dashboard.view` |
| Surat Perintah Kerja | `spk.view` |
| Report Breakdown | `breakdown.view` |
| Schedule | `schedule.view`, `schedule.manage` |
| Approvals | `spk.approve`, `count.approve` |
| Inventory | `inventory.manage`, `tyre.manage` |
| Vehicles, Documents | `vehicle.view`, `vehicle.manage` |
| Invoices, Customers | `invoice.view`, `invoice.manage` |
| Reports (P1) | `report.view` |
| Settings | `registry.manage`, `parttype.manage`, `masterdata.manage`, `settings.manage` |
| Users and roles | `accounts.manage` |
| Audit log | `audit.view` |
| Setup and go live | `setup.golive`, while the system is in Setup mode |

**Allowed actions.** Every API response that returns an SPK, step, change request, Goods Receipt, stock opname, tyre count, retread dispatch, schedule card or invoice SHALL carry `allowedActions`: the actions the signed-in user may take on that record now, computed by the same L1 and L2 functions that check the action when it is sent (`REQ-IAM-014`). Web and mobile show a button only when its action is in the list and never decide it from the role name. A hidden button is a convenience; the server still refuses the action.

## 3. Domain model and state machines

The SPK is the root aggregate: every stock movement into an SPK, service line, tyre placement and document renewal hangs off one SPK step. A state not listed in a machine below cannot be entered; a transition not listed is refused.

### 3.1 Entities

| Entity | What it is | Main tables | Area |
| --- | --- | --- | --- |
| User and role | An account with exactly one role | `users`, `user_roles` | IAM |
| Vehicle | A fleet unit with class, chassis layout, odometer and derived status | `vehicles`, `vehicle_classes`, `chassis_layouts`, `odometer_logs` | VEH |
| Vehicle document | STNK, KIR, insurance and other types, one current row per type | `document_types`, `vehicle_documents`, `document_renewals`, `document_corrections` | DOC |
| SPK preset | Saved step sequence; an optional starting point for an SPK | `spk_presets`, `spk_preset_steps`, `assignment_modules` | REG |
| Surat Perintah Kerja | The authorization with status, approvals and cost | `spks`, `spk_approvals` | SPK |
| Step | One assignment of an SPK, built in Create SPK and frozen at approval | `spk_assignments` | ENG |
| SPK content | Part lines, tyre lines, service lines, attachments | `spk_parts`, `spk_services`, `spk_attachments` | STK, MEC |
| Change request | Request to amend SPK content | `spk_change_requests` | CR |
| Part | A catalog SKU with quantity and moving average cost | `parts_catalog`, `stock_cards` | INV |
| Warehouse document | Goods Receipt, GR correction, Goods Issue, stock opname | `goods_receipts`, `gr_corrections`, `goods_issues`, `stock_adjustments` | INV |
| Tyre | An individual asset with code, serial number and status | `tyres`, `tyre_statuses`, `tyre_events` | TYR |
| Tyre document | Receive tyres, retread dispatch, tyre count | `tyre_receipts`, `retread_orders`, `tyre_counts` | TYR |
| [Placement](<Design Artifact/steps/Placement.html#Placement>) | Which tyre sits at which position now, and its history | `part_positions`, `part_placements`, `part_placement_logs` | PLC |
| Part item | A tracked service part per vehicle, with last replacement and next due | `part_item_types`, `vehicle_part_items` | BSL |
| Alert | PM, part item, tyre or document alert that can draft an SPK | `maintenance_alerts` | PM |
| Inspection | The daily checklist of a Driver or the inspection of a Mechanic; the System Admin enters it for a driver until the mobile app ships. A Fail raises a Report Breakdown | `dvir_logs` | PM |
| Report Breakdown | A field report with note, photos, urgency and location; the reference of the SPK made from it | `breakdown_reports`, `breakdown_report_photos` | BRK |
| Schedule card | An SPK placed on a planned day | `spk_schedule`, `spk_schedule_log`, `schedule_alerts` | SCH |
| Notification | An in-app notice, also pushed to the mobile app | `notifications`, `notification_deliveries` | NTF |
| Audit record | Append-only record of every change | `audit_logs` | NFR |
| Customer and invoice | The owner of a vehicle, and the daily bill for its completed SPKs | customers, invoices, invoice\_lines, invoice\_payments | BIL |
| Early failure | A part item or tyre replaced before the tolerance of its normal life | early\_failure\_events | BSL |

### 3.2 SM-SPK: Surat Perintah Kerja lifecycle

&#91;embedded content: SPK lifecycle · 9 states, transitions T1 to T15\]

Approval sits at both ends of the main row; Pending Amendment, Rejected and the return of a step are side loops, and only Completed and Cancelled are final.

**Where an SPK begins (DEC-109).** Its life starts with a Report Breakdown from a Field Coordinator, Mechanic or Driver, or an inspection Fail from a Mechanic or Driver, which raises a report; or with the system. An SPK then comes into being in one of two ways. Automatically as a Draft: from an Urgent breakdown report (with one Mobilisasi step), from a PM, part item, tyre or document alert, or from a verified Part Check. By hand: the Planner or System Admin drafts it with a Report Breakdown or inspection Fail as its reference, and "Report reference: RB-yymmddNNNN" shows in its description as the source. Either way the Planner composes the steps and submits it for approval (T2), and the completion cycle begins.

| # | From | Event | Actor | Guard | To | Effect |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | (new) | Create, or an alert, a Part Check or an Urgent breakdown report drafts it | Creator or system | Vehicle is not Inactive; the system is Live (REQ-IAM-010) | Draft | Number assigned |
| T2 | Draft | Submit | Planner or System Admin | Every required creation section filled (`REQ-SPK-004`) | Pending\_Approval | Approvers notified |
| T3 | Pending\_Approval | Approve | Approver | Approver is not the creator, unless System Admin (`BR-03`) | Active | Steps frozen; step 1 Open, others Locked; creation stamp |
| T4 | Pending\_Approval | Reject | Approver | Reason given | Rejected | Creator notified |
| T5 | Rejected | Edit and resubmit | Creator | As T2 | Pending\_Approval |  |
| T6 | Draft, Rejected | Cancel | Creator; for a Draft the system made, a Planner or the System Admin | Reason given | Cancelled | A linked Report Breakdown follows SM-BRK |
| T7 | Active | First step started | System |  | In\_Progress | `started_at` set; downtime SPK sets vehicle Repair |
| T8 | Active, In\_Progress | Change request submitted | Executor of the open step |  | Pending\_Amendment | `status_before_amendment` saved; open step frozen |
| T9 | Pending\_Amendment | Revision approved | Approver |  | status before | Content replaced; amendment number +1 |
| T10 | Pending\_Amendment | Revision rejected | Approver | Reason given | status before | Content unchanged |
| T11 | In\_Progress | Last step submitted | System | Every step Submitted, Verified or Skipped | Pending\_Verification |  |
| T12 | Pending\_Verification | A step is returned | Verifier | Note given | In\_Progress \[A\] | Step back to its executor |
| T13 | Pending\_Verification | Completion approved | Approver | Completion requested; every step Verified or Skipped (`BR-05`) | Completed | Completion stamp; vehicle status recalculated; part items reset; Issued tyres released |
| T14 | Pending\_Verification | Completion rejected | Approver | Reason given | Pending\_Verification | Planner notified |
| T15 | any open status | Cancel | Approver | Reason given; posted issues reversed first | Cancelled | Issued tyres return to In\_Stock; schedule card leaves open lists |

### 3.3 SM-STEP: step (assignment)

| From | Event | Actor | To | Effect |
| --- | --- | --- | --- | --- |
| Locked | SPK approved (step 1) or previous step submitted | System | Open | Executor notified; opened\_at set, the waiting time starts |
| Open | Start, or Start from an earlier time with a reason (DEC-87) | Executor; Field Coordinator or System Admin for an external workshop | In\_Progress | `started_at` set by Start only, never by opening, viewing or Save draft; claims an unassigned step; the form becomes editable |
| Open | First save or first action on the form, for a module that does not track work time (`assignment_modules.tracks_work_time = false`, DEC-95) | Executor | In\_Progress | Claims an unassigned step; no `started_at`, no Pause or Resume, no work time; the form is editable while the step is Open |
| In\_Progress, not paused | Submit | Executor | Submitted | Executor stamp; module submit behaviour runs; next step opens |
| In\_Progress | Pause with a reason | Executor; System for a change request | In\_Progress, shown as Paused | Work time stops; form read-only; Submit unavailable |
| In\_Progress, Paused | Resume | Executor; System when the change request is decided | In\_Progress | Work time runs again |
| Submitted | Verify | Verifier | Verified | Verifier stamp (Self-verified when System Admin verifies own step) |
| Submitted | Return with note | Verifier | Open, shown as Returned; the next attempt needs Start again | Later steps stay as they are |
| Open | Skip with reason (P1) | Executor, Approver consent \[A\] | Skipped | Only for an optional step |

WHILE the SPK is Pending\_Amendment, THE SYSTEM SHALL refuse every edit and submit on its open step.

Module contract, Mobilisasi (`REQ-MBL-*`): the Mobilisasi step uses the standard SM-STEP lifecycle above with no new states. Its Start opens a map and route to the driver's captured location (`REQ-MBL-003`); WHEN the mechanic reaches that location THE SYSTEM SHALL auto-submit the step, and a manual Finish stooring control SHALL also submit it (`REQ-MBL-004`); WHILE the step is In\_Progress THE SYSTEM SHALL record the mechanic's location trail for the duration of the step only (`REQ-MBL-005`, RSK-09).

### 3.4 SM-VEH: vehicle status (derived)

| Status | Holds while | Precedence \[A\] |
| --- | --- | --- |
| Inactive | The System Admin deactivated it | 1 |
| OFF | A scheduled SPK of the vehicle has missed its planned day (its planned day ended with the SPK not Completed) and that SPK's first step has already been Started, so the vehicle was already in Repair; holds until that SPK is Completed or Cancelled (DEC-92) | 2 |
| Blocked | A required document is Missing or Expired | 3 |
| Repair | An SPK of a downtime type is In\_Progress, Pending\_Verification or Pending\_Amendment | 4 |
| Active | None of the above | 5 |

OFF is an escalation of Repair: a vehicle in Repair for an SPK moves to OFF when that SPK overruns its scheduled day (DEC-92). Unlike Inactive, OFF does not block SPK creation or amendment (REQ-SPK-013 applies only to Inactive).

THE SYSTEM SHALL recalculate the status whenever an SPK, a document or the deactivation flag changes, and also on the daily job's missed / roll-forward evaluation (REQ-SCH-003, NFR-14), and show the highest-precedence status.

### 3.5 SM-DOC: vehicle document status

| From | Event | To |
| --- | --- | --- |
| (none for a required type) | Vehicle saved without it | Missing |
| Missing | First entry saved | Valid, Warning or Expired by its dates |
| Valid | Daily job: today ≥ expiry − `document_types.warning_days` | Warning (one Draft Document SPK created) |
| Warning | Daily job: today ≥ expiry date | Expired |
| Warning, Expired | Document step of the renewal SPK verified | Valid |
| any | Correct entry by the System Admin, before the first renewal SPK | Recalculated from the corrected dates |

### 3.6 SM-TYRE: tyre status

| From | Event | Document | To |
| --- | --- | --- | --- |
| (new) | Receive tyres confirmed, type New | `tyre_receipts` | In\_Stock |
| (new) | Tyre bought outside, recorded in the Part Purchase step | SPK | Issued |
| In\_Stock | Chosen in a Stock step that is submitted | SPK | Issued (`issued_spk_id` set) |
| Issued | SPK cancelled, completed without mounting, or issue reversed | SPK | In\_Stock (event Released) |
| Issued | Mount in the Part Replacement step of the same SPK | SPK | Mounted |
| In\_Stock | Mounted in the parts baseline | none | Mounted |
| Mounted | Rotate | SPK | Mounted (new position) |
| Mounted | Demount, condition chosen | SPK | Needs\_Retread, Worn\_Out or In\_Stock |
| Mounted | Scrap | SPK | Scrapped |
| Needs\_Retread | Retread dispatch confirmed | `retread_orders` | On\_Retread |
| Needs\_Retread | Worn out dialog | none | Worn\_Out |
| Needs\_Retread, Worn\_Out | Scrap dialog | none | Scrapped |
| On\_Retread | Retread return, Accepted | `tyre_receipts` | In\_Stock (retread count +1) |
| On\_Retread | Retread return, Rejected | `tyre_receipts` | Scrapped |
| In\_Stock, Needs\_Retread, Worn\_Out | Tyre count approved with result Missing | `tyre_counts` | Lost |

Scrapped and Lost are final. Every transition writes one `tyre_events` row with the document, user and time.

### 3.7 Warehouse and tyre documents

| Machine | States and transitions |
| --- | --- |
| SM-GR Goods Receipt | Draft → Posted (Post, no approval). A posted receipt is changed only by a GR correction, which is posted directly. |
| SM-SA Stock opname, SM-TC Tyre count | Draft → Pending\_Approval (Submit) → Approved (Approver; stock or tyre status adjusted). Pending\_Approval → Draft with `returned_reason` (Reject; shown as Returned). |
| SM-TR Receive tyres | Draft → Confirmed. |
| SM-RD Retread dispatch | Draft → Sent (Confirm) → Partial (some tyres returned) → Closed (every tyre Accepted or Rejected). |
| SM-CR Change request | Submitted → In\_Revision (creator opens it) → Pending\_Approval (revision sent) → Approved or Rejected. |
| SM-SCH Schedule card | Not planned → Planned (placed) → Missed (daily job, day passed, SPK not Completed) → Planned (moved automatically to the next day by the same daily job, flagged rolled-over / late). The daily job repeats the Missed → Planned (moved) roll-forward each day, with no limit, until the SPK is Completed or Cancelled; the only consequence of each overrun is the OFF-unit cost (REQ-SCH-003, DEC-92). A Completed or Cancelled SPK leaves the open lists and stays on its last day. |
| SM-INV Invoice | Draft (completed SPKs added) → Issued (number given, lines locked) → Paid (payment recorded). Draft or Issued → Void (reason; its SPKs return to a new Draft). Paid and Void are final. |
| SM-BRK Report Breakdown | New → Converted (an SPK is saved from it, or the system drafts one for an Urgent breakdown). New → Rejected (Reject, reason; Planner or System Admin; the reporter is notified). Converted → Rejected (Reject while its SPK is still Draft; the Draft is Cancelled with the same reason, TX-24). Converted → New (its SPK is Cancelled any other way; the pop-up does not return). Rejected is final. |

## 4. Functional requirements

Each area lists its requirements and then its acceptance criteria. Columns: **ID**, **P** (priority), **Requirement** (EARS), **Screens** (artboard names), **Data** (tables), **Rules**. Every requirement is written in EARS, so each one is directly testable as stated. The acceptance criteria add concrete examples for the behaviours most likely to be built wrong; each names the requirement it verifies. The state machines in section 3 are tested transition by transition.

Each area lives in its own file. Load the core PRD.md plus the area file of the task at hand.

| § | Code | Area | Priority and risk | File |
| --- | --- | --- | --- | --- |
| 4.1 | SPK | Surat Perintah Kerja lifecycle | P0, risk: high | [4.1-spk.md](docs/prd/areas/4.1-spk.md) |
| 4.2 | ENG | assignment engine | P0, risk: critical | [4.2-eng.md](docs/prd/areas/4.2-eng.md) |
| 4.3 | REG | module registry, step composer and SPK presets | P0, risk: critical | [4.3-reg.md](docs/prd/areas/4.3-reg.md) |
| 4.4 | STK | Stock step | P0, risk: high | [4.4-stk.md](docs/prd/areas/4.4-stk.md) |
| 4.4a | PUR | Part Purchase step | P0 | [4.4a-pur.md](docs/prd/areas/4.4a-pur.md) |
| 4.5 | MEC | Mechanic Action step | P0 | [4.5-mec.md](docs/prd/areas/4.5-mec.md) |
| 4.5a | MBL | Mobilisasi | mobilisation) step (P0, risk: high | [4.5a-mbl.md](docs/prd/areas/4.5a-mbl.md) |
| 4.6 | PLC | Part Replacement step and chassis map | P0, risk: high | [4.6-plc.md](docs/prd/areas/4.6-plc.md) |
| 4.7 | DOC | vehicle documents | P0 | [4.7-doc.md](docs/prd/areas/4.7-doc.md) |
| 4.8 | CR | change request and amendment | P0 | [4.8-cr.md](docs/prd/areas/4.8-cr.md) |
| 4.9 | SPKD | SPK digital document | P0 | [4.9-spkd.md](docs/prd/areas/4.9-spkd.md) |
| 4.10 | VEH | vehicles and odometer | P0 | [4.10-veh.md](docs/prd/areas/4.10-veh.md) |
| 4.11 | PM | preventive maintenance, inspections and breakdowns | P0 | [4.11-pm.md](docs/prd/areas/4.11-pm.md) |
| 4.11a | BRK | Report Breakdown | P0 | [4.11a-brk.md](docs/prd/areas/4.11a-brk.md) |
| 4.12 | BSL | parts baseline | P0 | [4.12-bsl.md](docs/prd/areas/4.12-bsl.md) |
| 4.13 | INV | parts inventory | P0, risk: high | [4.13-inv.md](docs/prd/areas/4.13-inv.md) |
| 4.14 | TYR | tyres and retread | P0 | [4.14-tyr.md](docs/prd/areas/4.14-tyr.md) |
| 4.15 | APR | approvals inbox | P0 | [4.15-apr.md](docs/prd/areas/4.15-apr.md) |
| 4.16 | DSH | role dashboards | P0 | [4.16-dsh.md](docs/prd/areas/4.16-dsh.md) |
| 4.17 | SCH | maintenance schedule | P0 | [4.17-sch.md](docs/prd/areas/4.17-sch.md) |
| 4.18 | IAM | sign-in, accounts and access | P0 | [4.18-iam.md](docs/prd/areas/4.18-iam.md) |
| 4.19 | NTF | notifications | P0 in-app, push P0 for the R1 mobile roles, P1 for the rest | [4.19-ntf.md](docs/prd/areas/4.19-ntf.md) |
| 4.20 | MOB | mobile app | risk: high; P0 in R1 step 7 for Driver, Field Coordinator, Mechanic and System Admin; P1 for Supervisor and GM (DEC-98) | [4.20-mob.md](docs/prd/areas/4.20-mob.md) |
| 4.21 | RPT | reports | P1 | [4.21-rpt.md](docs/prd/areas/4.21-rpt.md) |
| 4.22 | AI | AI assistant | P1 | [4.22-ai.md](docs/prd/areas/4.22-ai.md) |
| 4.23 | BIL | customers and invoices | P0 | [4.23-bil.md](docs/prd/areas/4.23-bil.md) |
| 8.1 | FUP | File upload and compression | P0 | [8.1-fup.md](docs/prd/areas/8.1-fup.md) |

## 5. Business rules

Business rules are invariants. They hold for every role, the System Admin included unless the rule says otherwise, and no permission change can switch them off. Each is enforced in the service layer; the Database column names the second line of defence in section 9.

| ID | Rule | Database guard | Requirements |
| --- | --- | --- | --- |
| BR-01 | No stock movement, tyre placement or service line without an active SPK and an open step of the matching module. Exceptions, each with its own document and audit record: first entry of documents, the parts baseline, tyre documents (Receive tyres, retread dispatch and return, worn out, scrap, tyre count) and the warehouse documents Goods Receipt, GR correction and approved stock opname. | `goods_issues.spk_id NOT NULL`; `part_placements` check `is_baseline OR installed_spk_id` | REQ-SPK-001, REQ-PLC-001, REQ-DOC-006, REQ-BSL-001 |
| BR-02 | A step may change only the vehicle and parts named in its SPK (scope lock), as declared in the module's `scope_rules`. | `goods_issues.vehicle_id` equals the SPK vehicle (trigger) | REQ-STK-002, REQ-DOC-010 |
| BR-03 | The creator of an SPK cannot approve it, the executor of a step cannot verify it, and the person who counted cannot approve the count. Exception: the System Admin may do all of these; each such decision is marked Self-approved or Self-verified on the stamp and in the audit log. | `self_approved`, `self_verified` columns; checks in service layer | REQ-SPK-006, REQ-ENG-007, REQ-INV-011, REQ-TYR-012 |
| BR-04 | One approval from a Supervisor, GM or System Admin is enough at each stage: creation, amendment, completion, stock opname, tyre count. WHILE Planner approval is switched on (REQ-IAM-008), a Planner's approval also counts for the approval kinds the Access Manager ticked. | `spk_approvals` check on `approver_role` | REQ-SPK-005, REQ-APR-005 |
| BR-05 | The next step opens when the previous one is submitted. Completion approval needs every step Verified or Skipped. | completion request check | REQ-ENG-002, REQ-ENG-006 |
| BR-06 | Warehouse part stock changes only through a Goods Receipt, a GR correction, a Goods Issue tied to an SPK, a verified reversal of an issue, an approved stock opname, or the opening balance saved in Setup mode. Parts bought outside (Part Purchase step) never change warehouse stock. | `stock_cards.reference_doc_id NOT NULL`; `stock_qty >= 0` | REQ-STK-003, REQ-INV-006 |
| BR-07 | Prices used in an SPK are saved as snapshots; later price changes do not alter history. | `unit_price`, `price` stored on the line | REQ-STK-003, REQ-MEC-002 |
| BR-08 | A vehicle with an Expired or Missing required document cannot be assigned to trips. It can still be placed on the maintenance schedule, for example for its renewal SPK. | derived `vehicles.status = Blocked` | REQ-DOC-005 |
| BR-09 | Odometer readings are positive whole numbers and never lower than the last reading that is not voided. A jump above 1.500 km per day warns but is not refused. | trigger on `odometer_logs` | REQ-VEH-005, REQ-VEH-007 |
| BR-10 | Core records are never physically deleted; they are soft-deleted, deactivated or voided. Stamps, approvals, stock cards, placement logs, tyre events and audit records are append-only. The only removal is the monthly archive of audit records older than 1 year (NFR-17). | `deleted_at`; `ON DELETE RESTRICT` | REQ-SPKD-004, REQ-VEH-004 |
| BR-11 | Tyres enter the In Stock count only through Receive tyres or a demount marked Back to stock, and leave it only through the parts baseline, the Stock step of an SPK and an approved tyre count. Only a tyre Issued to an SPK can be mounted in that SPK. | `tyres.issued_spk_id`; mount check | REQ-STK-006, REQ-PLC-003, REQ-TYR-007 |
| BR-12 | A Goods Receipt and a GR correction need no approval. A stock opname and a tyre count need an Approver. | status checks | REQ-INV-004, REQ-INV-011, REQ-TYR-012 |
| BR-13 | The maintenance schedule is a plan. Missing a planned day never changes, blocks or cancels an SPK; it only raises a schedule alert. | none (no FK from status to schedule) | REQ-SCH-003 |
| BR-14 | Exactly one account holds System Admin and each account holds exactly one role. Only an Access Manager moves the System Admin role, in one step with a reason; the System Admin cannot move it, and its account cannot be deactivated while it holds it. | `uq_one_system_admin`, `uq_one_role_per_user` | REQ-IAM-004 |
| BR-15 | An SPK is billed at most once: it sits on at most one invoice that is not Void, and only a Completed SPK can be billed. Issued and Paid invoices never change; a mistake is fixed by voiding and re-issuing. | uq\_spk\_billed\_once (partial unique index on invoice\_wos) | REQ-BIL-002, REQ-BIL-006 |
| BR-16 | A Completed SPK is never reopened or edited. A mistake found later is fixed outside the SPK: a billing error by an invoice adjustment or Void (REQ-BIL-006), a stock error by a stock opname, a placement error by the next SPK; each is logged. | status check on every SPK write | REQ-SPK-008, REQ-BIL-006 |

## 6. User flows by role and scenario

Step-by-step flows per role (FLW-*): [docs/prd/flows.md](docs/prd/flows.md).

## 7. UI specification

Layout authority, global patterns, screen inventory, key layouts, shared components, navigation (NAV-*), working rules, brand and design-question decisions (DQ): [docs/prd/ui.md](docs/prd/ui.md). Every control per screen (C-* and screen rows, §7.9): [docs/prd/ui-action-map.md](docs/prd/ui-action-map.md).

## 8. Non-functional requirements

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-01 | Data integrity | A goods issue, the stock decrement, the stock card row and the SPK part line SHALL commit or roll back together; the same holds for every multi-table write named in 9.13. Submit, approve, post and issue actions SHALL be safe to retry (idempotent). |
| NFR-02 | Audit | Every state change, approval, verification, change request, amendment, stock movement, tyre status change, master data change and access change SHALL write an append-only audit record with user, role, time, before and after; a System Admin self-decision SHALL be flagged. |
| NFR-03 | Concurrency | IF two users save the same SPK, part or placement, THEN the second save SHALL be refused with a clear message (optimistic lock on `version`). |
| NFR-04 | Security | Every action SHALL check the role on the server; inputs SHALL be validated on the server; queries SHALL be parameterized; API keys and secrets SHALL be encrypted at rest; the AI assistant SHALL use a read-only database account. |
| NFR-05 | Sign-in | Passwords SHALL be stored only as hashes, have at least 8 characters with letters and digits, and be changed at the first sign-in; 5 failed sign-ins SHALL lock the account for 15 minutes; a web session SHALL end after 30 minutes without activity and a mobile session after 30 days (REQ-IAM-009). |
| NFR-06 | Files | Only JPG, PNG, HEIC/HEIF and PDF SHALL be accepted, images up to 30 MB and PDFs up to 10 MB before compression \[A\]; video is never accepted (DEC-31). Images SHALL be compressed per the upload profiles of 8.1 (Photo 1600 px, Document image 2400 px) and only the compressed file and its thumbnail SHALL be kept \[A\]. Files SHALL be stored privately and served only to users who can see the record (NFR-13). Photos marked "camera" on mobile SHALL come from the camera. |
| NFR-07 | Deletion | Core records SHALL be soft-deleted, never physically deleted (`BR-10`). |
| NFR-08 | Tables | One field per column, every column sortable and filterable (7.2). |
| NFR-09 | Language and format | The interface SHALL be translatable (Indonesian and English); numbers SHALL use a dot for thousands and a comma for decimals (48.210 km, Rp 1.240.000, 2,4 mm); dates `YYYY-MM-DD`, times `HH:MM:SS`. |
| NFR-10 | Usability | Web screens SHALL be usable on a desktop and a tablet; the mobile app (R1 step 7 and P1) SHALL be mobile first; status colours carry a text label (green Active or Passed, yellow Warning or Pending, red Blocked or Expired). |
| NFR-11 | Extensibility | Telematics, push, WhatsApp and email providers SHALL plug in through adapters; modules, SPK presets, classes, layouts, tyre statuses and document types SHALL be data (PR-6). |
| NFR-12 | Jobs | A daily job SHALL run document status, PM and part item alerts, schedule Missed marks and the Today list; jobs SHALL be idempotent and logged. |
| NFR-13 | File storage | Files SHALL be kept in S3-compatible object storage behind a storage adapter, Cloudflare R2 first \[A\] (DEC-32, ASM-28); the database SHALL hold only the object key and metadata (name, type, size, uploader). Files SHALL be private and opened through signed links that expire after a few minutes. Files are never deleted (BR-10); files older than 12 months SHALL move to the cheaper Infrequent Access class \[A\]. A daily job SHALL read total usage; WHEN usage reaches 80% of the budget set in Settings (default 50 GB), THE SYSTEM SHALL alert the System Admin. Sizing: under 100 vehicles and compressed photos give about 1 GB per month, about 12 GB per year. |
| NFR-14 | Time | Every date and time SHALL be stored in UTC and shown in Asia/Jakarta (WIB); a day (invoice day, stooring day, schedule day, daily job) is a WIB calendar day; the daily job SHALL run at 00:30 WIB. |
| NFR-15 | Numbering | Document numbers SHALL be running numbers that are never reused, also after cancel or void: SPK-yymmddNNNN (yymmdd is the WIB date the SPK is created; NNNN is a running number that never resets, DEC-104), RB-yymmddNNNN (built like the SPK number, DEC-109), CR-NNNN, GR-NNNN, GRC-NNNN, GI-NNNN, SA-NNNN, OB-NNNN, TR-NNNN, RD-NNNN, TC-NNNN, tyre codes TY-NNNN, invoices NNNN/BMI/dd-mm-yy (DEC-46); four digits, widening when needed; the formats live in one numbering configuration so the product owner can change them after the build without code changes. |
| NFR-16 | Money | Amounts SHALL be stored with 2 decimals and average costs with 4; a marked-up invoice price SHALL be rounded half up to a whole rupiah per unit before the line is multiplied, and PPN SHALL be computed on the subtotal and rounded half up to a whole rupiah. |
| NFR-17 | Backup and retention | The database SHALL be backed up daily and kept 1 year, with point-in-time restore for 7 days; files are never deleted while their record exists; audit logs SHALL be kept 1 year in the database; each month a job SHALL export the records older than 1 year to a read-only archive file in object storage (CSV, checksum logged) and only then delete them from the database (DEC-57); a restore SHALL be tested before go-live. |
| NFR-18 | Platforms | The web app SHALL run in current desktop Chrome and Edge. In Release 1 the mobile app SHALL run on Android phones from Android 8.0 (Oreo) upward with Google Play services (needed for push), installed from a signed APK outside the Play Store; the Expo SDK chosen SHALL still support Android 8.0, and an SDK upgrade that drops it needs the client's agreement; the iPhone app follows in Release 2 from the same code. Web and mobile SHALL reach the data only through the API server (8.2, DEC-66). |
| NFR-19 | Capacity | The system SHALL be sized for about 100 vehicles, 15 users and 100 to 500 SPKs per month, and SHALL keep its response targets at three times that load (300 vehicles, 45 users, 1.500 SPKs per month) without a change of design; at launch the smallest managed tiers are enough (one Cloud Run instance kept warm, a small Cloud SQL instance, a basic Redis), and they scale up by setting only. |

### 8.1 FUP: file upload and compression (P0)

[docs/prd/areas/8.1-fup.md](docs/prd/areas/8.1-fup.md).

### 8.2 Technology stack and architecture (DEC-66)

The system is built by AI coding agents and finished by internal developers (code review, hardening, deployment). The stack therefore uses one language end to end, one repository and one source for every shared rule, so an agent never has to keep two versions of the same logic in sync.

**Architecture.** The web app and the mobile app are two clients of one API server. Only the API server connects to the database and the file storage; no client ever connects to the database directly. Every business rule, transaction (TX-01 onward), permission check, scope lock and numbering runs on the server, so the web and the phone always see the same data and the same rules (REQ-MOB-002).

```
Web app (desktop browser) ──┐
                            ├──►  API server  ──►  PostgreSQL
Mobile app (Android APK) ───┘         │
                                      ├──►  Object storage (photos, PDFs)
                                      └──►  Job queue (alerts, archive, PDFs)
```

| Layer | Choice | Notes |
| --- | --- | --- |
| Language | TypeScript (strict) everywhere | Web, mobile, API and shared code |
| Repository | One monorepo with pnpm workspaces and Turborepo | apps/web, apps/mobile, apps/api, packages/shared |
| Shared package | packages/shared | Enums of 9.1, status machines of section 3, validation schemas (Zod), rule constants (tolerances, markup, numbering formats) and the API types; web, mobile and API import it, never copy it |
| API server | NestJS on Node.js, REST with JSON | An OpenAPI description is generated from the code and the web and mobile clients are generated from it |
| Database | PostgreSQL on Google Cloud SQL (Jakarta) | Schema of section 9 as plain SQL migration files; Drizzle ORM for queries; enums, CHECKs and triggers stay in the database |
| File storage | Cloudflare R2 behind the storage adapter (NFR-13, DEC-32) | Photos and PDFs; the client compresses (8.1) and uploads with a short-lived signed URL; the database keeps only the key |
| Web app | Next.js (React) | Desktop browser only; calls the API, holds no business rule beyond form checks from packages/shared |
| Mobile app | React Native with Expo | Android only in Release 1; iPhone (iOS) in Release 2 from the same code |
| Mobile device features | Expo camera and image picker, Expo location, Expo SQLite, Expo secure store, Expo notifications | Camera photos, the reporter's location captured once at Report Breakdown and the mechanic's location trail while a Mobilisasi step is In\_Progress (REQ-MOB-003, REQ-MBL-005), offline drafts and photo queue (REQ-MOB-009, REQ-FUP-011), token storage, push |
| Sign-in | Own accounts in the API; short-lived access token and refresh token | Password rules of NFR-05; tokens on the phone are kept in secure storage |
| Push | Firebase Cloud Messaging through the Expo push service | In-app notifications are written by the API (NTF) and pushed to the phone |
| Background jobs | BullMQ on Redis | PM and late-SPK alerts, monthly audit archive (NFR-17), PDF rendering, exports |
| PDF and exports | Server side: HTML templates rendered with headless Chromium; xlsx and CSV with ExcelJS | SPK document, invoice PDF, stock card and report exports |
| Hosting | Google Cloud, Jakarta region, with Cloudflare in front (DEC-67) | Cloud Run for the API, the workers and the web app; Cloud SQL for PostgreSQL with daily backup and point-in-time restore (NFR-17); Memorystore for Redis; Secret Manager for the release keystore and secrets; files on Cloudflare R2; Cloudflare DNS, TLS and attack protection in front of the web app and the API |
| Environments | Development, staging, production | Setup mode and Go live happen in production |
| Tests | Vitest for shared rules and services; API integration tests against a real PostgreSQL; Playwright for web flows | The acceptance criteria of section 4 are the test cases |

**Android distribution.** The mobile app is delivered as an installable APK, not through the Play Store, in Release 1:

1. Build with EAS Build using a profile with buildType apk (a local Gradle build gives the same file). A Play Store build (.aab) can come from the same code later.
2. Every build is signed with one release keystore kept in Google Secret Manager; losing it means installed apps can no longer be updated.
3. The APK is shared by a download link; each phone allows "Install unknown apps" once.
4. Changes to screens and logic reach the phones as over-the-air updates (EAS Update) without reinstalling; a change to native features or permissions needs a new APK.
5. On first use the app asks the Android permissions for camera, location and notifications; position capture stays invisible in the screens, but the operating system permission is still asked once.

**Working rules for the agents.** Build the API contract first; a screen is built only against a generated client. Put every enum, status, validation and constant in packages/shared. A module of the registry (4.3) is one folder in the API plus one step screen in web and mobile, wired only through its registry row (REQ-REG-006). Internal developers review every merge to the main branch, own the release keystore and the cloud accounts, and run the production deployments.

### 8.3 Engineering practices that reduce delivery risk (DEC-78)

These practices are binding for the implementing agents and the internal developers; code review rejects a change that breaks one of them. They change no behaviour of the system.

| Area | Practice |
| --- | --- |
| SPK lifecycle (4.1) | One transition table per state machine of section 3 in packages/shared and one transition endpoint on the server; an automated test for every allowed and every refused transition |
| Assignment engine (4.2) | Built and tested first with a dummy module, before any real module; the steps of an SPK are frozen as a JSON snapshot when it is approved; the engine package may not import any module package, checked in CI |
| Module registry (4.3) | Stock and Mechanic Action are built first as the reference modules; one contract test suite that every module, current or future, must pass |
| Stock and inventory (4.4, 4.13) | The stock card is the single source of truth (a ledger); stock and average cost are computed by one function; a lock per SKU during a stock transaction; corrections are always reversing entries, never edits of old rows; a daily reconciliation job alerts on any difference |
| Part Purchase (4.4a) | Line and grand totals use the same function on client and server, from packages/shared, with decimal arithmetic, never floating point |
| Mechanic Action (4.5) | Photo rules run on the server; the Mechanic Action step no longer reads or stores any position (REQ-MEC-008 retired) |
| Mobilisasi (4.5a) | The stooring fee (one per SPK per region per day) and the auto-submit-on-arrival run on the server; the mechanic's location trail is accepted only between Start and Submit of the step, stored for the verifier, and every read is access-logged (REQ-MBL-005, REQ-MBL-006, RSK-09) |
| Chassis map (4.6) | The map component is built first as a separate library, with fixtures for every launch layout and generated layouts (DEC-73) and an image snapshot test per layout |
| Tyres and retread (4.14) | Every tyre status change goes through one service that always writes tyre\_events; the tyre transition table is tested like the SPK one |
| Baseline, PM and part age (4.11, 4.12) | One life-used function (km or days, days only for a Towed unit) shared by tyres, part items and PM |
| Daily jobs (documents, PM, late SPKs) | Every job is idempotent and guarded by a unique index; staging offers a dry run that lists the alerts a job would create |
| SPK document and invoice PDF (4.9, 4.23) | One template engine; the document data is frozen when the SPK completes; PDFs are rendered in a worker; golden-file tests compare each PDF with an approved sample |
| Approvals (4.15) | One policy function canApprove(user, object) for every kind of approval, including four-eyes, System Admin self-approval and the Planner switch |
| Access (4.18) | A capability guard on every endpoint through a decorator, never only in the UI; the role x capability test matrix is generated from the permission table of section 2. The guard, the record policies, `GET /me` and `allowedActions` all call the one effective-capability function of 2.4, which reads `role_permissions` and the Planner approval switch, never a constant copied into code; the permission codes live once in packages/shared. A test per record type checks that `allowedActions` equals what the server accepts (DEC-93) |
| Notifications (4.19) | Outbox pattern: a notification is written in the same transaction as its event and sent by a worker with a dedupe key |
| File upload (8.1) | A proven compression library on web and phone; an idempotency key on every upload; automatic retry on a weak signal |
| Invoices (4.23) | The invoice number comes from a database sequence inside the Issue transaction; a Draft has no number |
| Schedule (4.17) | A mature drag-and-drop library; the server decides, the screen only proposes |
| Dashboards and reports (4.16, 4.21) | Aggregates come from views or a cache refreshed on a schedule, not recomputed on every page open |
| Mobile app (4.20) | A small mobile spike in R1 step 1 (sign-in, camera, position, push, APK build on an Android 8 phone), although the full app comes in step 7 |
| All areas | The example data of the design canvas seeds staging; every acceptance criterion of this spec is an automated test in CI; staging can always be reset to Setup mode |

### 8.4 Risk tiers: where to spend the most effort (DEC-79)

The areas below carry the highest delivery risk. Their section headings in 4 are marked risk: critical or risk: high. An agent working in a marked area spends more of its effort there than the size of the area suggests, and follows the extra rules of its tier.

| Tier | Areas | Why | Extra rules |
| --- | --- | --- | --- |
| Critical | 4.2 ENG assignment engine, 4.3 REG module registry | Every module and every SPK runs on them; a design mistake spreads to all of them | Built first in its step and before any module; design note reviewed by an internal developer before coding; contract and transition tests with a dummy module; two reviewers per merge |
| High | 4.1 SPK lifecycle, 4.4 STK Stock step, 4.13 INV inventory, 4.6 PLC Part Replacement and chassis map, 4.20 MOB mobile app | Money, stock and status consistency across modules; offline phones; one map component for every unit type | Built at the start of its release step; concurrency tests for stock; image snapshot tests for every layout; mobile spike in R1 step 1; an internal developer reviews every merge |
| Normal | Every other area | Standard rules and validation | The practices of 8.3 and the acceptance criteria of 4 |

A tier is about delivery effort, not priority: every P0 area is still required for Release 1.

## 9. Data model

The PostgreSQL schema, integrity rules and key transactions (TX-*): [docs/prd/data-model.md](docs/prd/data-model.md).

## 10. Release plan

Release 1 is built in seven steps; each step ends with its acceptance criteria passing and a UAT sign-off on staging by the product owner or the System Admin (DEC-77), and step 7 (mobile app and invoices) starts only when the web core of steps 1 to 6 is done (DEC-41). Release 2 adds the P1 items; P2 comes later.

| Stage | Scope | Requirement areas | Priority |
| --- | --- | --- | --- |
| R1 step 1 | Setup mode and Go live, sign-in, roles (Accounting included), vendor master, Access Manager area with the Planner approval switch, audit log, file storage adapter with upload compression, vehicles, classes and chassis layouts, document master, SPK core with approvals and stamps, scope lock | IAM, VEH, PLC-013, DOC-001/002, SPK, APR, BR-01 to BR-04, BR-14 | P0 |
| R1 step 2 | Assignment engine, module registry, step composer and SPK presets, SPK document with approval block | ENG, REG, SPKD | P0 |
| R1 step 3 | Stock step (cut stock) and Part Purchase step, and parts inventory: catalog, Goods Receipt and correction, issues and reversal, stock card and export, low stock, stock opname | STK, INV | P0 |
| R1 step 4 | Mechanic Action and service catalog; Part Check and its follow-up SPK; Mobilisasi with stooring rates (server and web; the phone screens come in step 7, DEC-99) | MEC, CHK, MBL | P0 |
| R1 step 5 | Tyres (receive, retread, worn out, scrap, tyre count), Part Replacement and the chassis map, parts baseline and correction, normal life and early-failure alerts | TYR, PLC, BSL | P0 |
| R1 step 6 | Document management and renewal, PM engine and alerts, inspections and Report Breakdowns entered by the System Admin, manual odometer and void, change request and amendment, maintenance schedule, role dashboards, in-app notifications, Report Breakdown list, create SPK from a report and the urgent pop-up, bulk import of master data for go-live | DOC, PM, VEH-005 to VEH-008, CR, SCH, DSH, NTF-001, BRK, IAM-011, DOC-013, BSL-008 | P0 |
| R1 step 7 (after steps 1 to 6 pass) | Customers and invoices with the Accounting role; one Android mobile app (APK) with push for Driver, Field Coordinator, Mechanic and the System Admin field menu, with the Mobilisasi route and location trail (DEC-98) | BIL, MOB-001 to 003, MOB-006, MOB-008, MOB-010, MBL-003 to 005 (phone), NTF-002 (those roles) | P0 |
| Release 2 | iPhone (iOS) build of the mobile app (DEC-66); mobile menu for Supervisor/GM; reports and cost analytics, tyre CPK, dead stock, tyre minimum per size; AI assistant; Protrack odometer adapter; amendment history attachment; optional step skip; photo labels | MOB-005, MOB-007, NTF-002/003, RPT, AI, VEH-009, ENG-009, SPKD-006 | P1 |
| Later | WhatsApp and email notifications, invoice email, parallel steps, mechanic shift schedule | NTF-004, BIL-011 | P2 |

**Go-live steps** (in Setup mode, REQ-IAM-010; every step by the System Admin except accounts): 1. accounts and roles by the Access Manager; 2. master data (classes and layouts, document types, part item types with normal life, services, stooring rates, customers, tax and markup); 3. vehicles with first documents; 4. tyres received with source Existing; 5. parts baseline per vehicle; 6. opening balance (REQ-INV-013); 7. a test restore of the backup (NFR-17); 8. Go live. From that moment the system runs normally with every approval; nothing is migrated from paper jobs.

**Dependencies.** Protrack API access (automatic odometer; manual and driver input cover the gap). Part item, position and service master data must be entered before launch. Service catalog prices are needed before Internal services can be recorded. A push provider is needed for R1 step 7. Customer master data and the tax rate are needed before the first invoice.

## 11. Decisions, assumptions, open questions and risks

### 11.1 Decisions (confirmed by the product owner)

| ID | Decision | Applies to |
| --- | --- | --- |
| DEC-01 | "PM" means Maintenance Planner | 2.1 |
| DEC-02 | Any one of Supervisor, GM or System Admin approves SPK creation, amendment and completion, stock opname and tyre count | BR-04 |
| DEC-03 | Approval shows as a stamp or signature in an "Approved by GM/Supervisor" block at the bottom of the SPK document, two lines: creation and completion | REQ-SPKD-003 |
| DEC-04 | A Planner or the System Admin verifies every step; the next step opens without waiting for verification; completion needs every step verified | BR-05 |
| DEC-05 | Modules are a registry; an SPK type may repeat a module; the Planner and System Admin design the process (SPK types superseded by DEC-85: the process is now built per SPK in Create SPK) | 4.3 |
| DEC-06 | The part list is fixed at creation; executors raise change requests; submitting one puts the SPK in Pending\_Amendment; the Approver only decides the revision; later steps stay Locked | 4.8 |
| DEC-07 | The visual placement map is a core feature | 4.6 |
| DEC-08 | The System Admin has every operational permission, may self-approve and self-verify (marked), and cannot manage accounts, roles or permissions; exactly one System Admin account | BR-03, BR-14 |
| DEC-09 | A separate Access Manager role (one or more accounts) manages accounts, roles and permissions and moves the System Admin role; self-handover by the System Admin is not allowed | 4.18 |
| DEC-10 | Each account has exactly one role | RL-1 |
| DEC-11 | One warehouse role, the Warehouse Manager; Goods Receipts and GR corrections are posted without approval | BR-12 |
| DEC-12 | Tyres are never in a Goods Receipt or the part catalog; Receive tyres is the only door, with type New tyres (Supplier or Existing) or Retread return; there is no separate tyre registration screen | 4.14 |
| DEC-13 | The In Stock tyre count goes down only through the parts baseline, the Stock step and an approved tyre count; SPK creation includes tyre lines | BR-11 |
| DEC-14 | A tyre missing in an approved count gets the final status Lost | REQ-TYR-012 |
| DEC-15 | Warehouse documents: Draft → Pending\_Approval → Approved; a reject returns to Draft marked Returned; one stock opname holds many SKU rows | 3.7 |
| DEC-16 | Vehicle statuses are Active, Repair, Blocked and Inactive (OFF added later as a derived escalation of Repair, DEC-92) | SM-VEH |
| DEC-17 | Class or layout changes only with no mounted tyre and no open SPK; mostly done at setup | REQ-VEH-003 |
| DEC-18 | The maintenance schedule: the Planner drags SPK cards onto days, several per day; not strict; a missed card is marked Missed and moved; the Field Coordinator views it and gets alerts | 4.17 |
| DEC-19 | The Dispatcher role is merged into Field Coordinator (Koordinator Lapangan) with the Dispatcher capabilities | 2.1 |
| DEC-20 | Document warning days are set only per document type; first entry and Correct entry happen outside an SPK; renewal goes through a Document SPK | 4.7 |
| DEC-21 | BR-08 means a blocked vehicle cannot be assigned to trips; it can still be placed on the schedule | BR-08 |
| DEC-22 | A wrong odometer reading is voided (never deleted) by the System Admin with a reason; a jump above 1.500 km per day warns | BR-09 |
| DEC-23 | A wrong parts baseline value is corrected by the System Admin with Correct baseline until an SPK touches that part | REQ-BSL-005 |
| DEC-26 | One mobile app with a menu per role: Driver, Mechanic, Supervisor/GM, Field Coordinator | 4.20 |
| DEC-27 | Push notifications come with the mobile app (R1 step 7 for Driver, Field Coordinator and System Admin, P1 for the rest, DEC-41); email and WhatsApp later (P2) | 4.19 |
| DEC-28 | Users and roles is the Access Manager's own area, outside Settings | REQ-IAM-003 |
| DEC-29 | No Auditor role | 2.1 |
| DEC-30 | Indonesian number format; one field per column in every table | NFR-08, NFR-09 |
| DEC-31 | No video uploads; evidence is photos (JPG, PNG) and PDF only | NFR-06 |
| DEC-32 | Files may be stored outside Indonesia; the company SOP sets no data-location rule. Fleet size is under 100 vehicles | NFR-13 |
| DEC-33 | The SPK document is print-ready: no photos or colour images, attachments listed as text, and the placement snapshot printed as a black-and-white line drawing plus a table of changed positions. Verifiers and Approvers see the photos in the system (StepVerify, ApprovalReview, CompletionReview, mobile review) through one shared viewer | REQ-SPKD-007, REQ-FUP-016 |
| DEC-35 | Approval stays with the Supervisor, GM or System Admin; the Planner decides with them outside the system, and an Access Manager can switch Planner approval on for urgent cases | RL-7, REQ-IAM-008 |
| DEC-36 | The approval review shows the part age, and an early failure (replaced before its normal life) raises an alert; the Planner sets the normal life in Settings | REQ-APR-011, REQ-BSL-009 |
| DEC-37 | The GM acts as director: the rights of the Supervisor plus wider data | RL-8 |
| DEC-39 | Internal services stay catalog only; completion approval stays | REQ-MEC-002, BR-05 |
| DEC-41 | The mobile app for Driver, Field Coordinator and System Admin moves to release 1 (P0), built in R1 step 7 after the web core; Mechanic and Supervisor/GM menus stay P1. Replaces DEC-25 and the release part of DEC-26 | 4.20, 10 |
| DEC-42 | A new Accounting role and an invoice feature: invoices go to the vehicle's customer, grouped per day, with every SPK of the unit; owned by Accounting and the Supervisor | 4.23, BR-15 |
| DEC-43 | One invoice per vehicle per day | REQ-BIL-002 |
| DEC-44 | Invoice lines show the parts and services used, not the SPKs; parts are billed at purchase cost + 50%, services without markup; the PDF shows prices only, never the markup | REQ-BIL-003, REQ-BIL-007 |
| DEC-45 | PPN 11% | REQ-BIL-004 |
| DEC-46 | Invoice number: running number/BMI/dd-mm-yy | REQ-BIL-005 |
| DEC-47 | The early-failure tolerance is adjustable by the Planner in Settings | REQ-BSL-007 |
| DEC-48 | Which approvals the Planner gets when switched on is a checklist in the Access Manager menu | REQ-IAM-008 |
| DEC-50 | The invoice running number never resets; tyres carry the 50% part markup; document renewals are billed at cost; invoice lines are never merged; invoices need no approval, take full payment only and are not emailed in R1; a short Cut stock line may be moved to Purchase without a change request | REQ-BIL-003, REQ-BIL-005, REQ-BIL-006, REQ-STK-004 |
| DEC-51 | The SPK document carries a stooring (mobilisation) fee; prices are set per region in the stooring rates master data, maintained by the System Admin. Since DEC-90 the fee is produced by the Mobilisasi step (its destination from the breakdown report), not by the Mechanic Action step | REQ-MBL-006, REQ-MEC-010 |
| DEC-53 | Superseded by DEC-90 for position capture: no position is required on Mechanic Action, Part Replacement or Part Check submit. Stooring is charged by the Mobilisasi step, once per SPK per region per day, and is still billed to the customer at cost, without markup | REQ-MBL-006, REQ-BIL-003 |
| DEC-54 | The remaining gaps of the audit are closed with the defaults of REQ-INV-013 (opening balance), REQ-SPK-015 (priority), REQ-IAM-009 (passwords), REQ-MOB-009 (offline), REQ-NTF-005 (notification matrix), BR-16 (no reopening), RL-10 (branch), NFR-14 to 17 (time, numbering, money, backup) and the go-live steps of 10; each default is marked \[A\] and listed in 11.2 | 4, 5, 8, 10 |
| DEC-55 | Before go-live the system is in Setup mode: only the System Admin enters data, nothing needs approval, and a Go live button switches it to normal operation. No priority deadlines, but late SPKs alert everyone involved and the GM. Password policy confirmed; submit needs a connection; no branches; WIB; number formats kept for now and editable later; rounding confirmed; backups and audit logs kept 1 year. Mechanic shift schedule comes in a later release | REQ-IAM-010, REQ-INV-013, REQ-SCH-007, RL-10, NFR-14 to 17, 10 |
| DEC-56 | In Setup mode no role other than the System Admin and Access Managers can sign in | REQ-IAM-010 |
| DEC-57 | Audit records older than 1 year are exported to an archive file in storage and then deleted from the database; this is the only exception to append-only BR-10 | BR-10, NFR-17 |
| DEC-58 | Audit answers: a step is assigned to a named user or claimed by the first executor; parts bought for a cancelled SPK go into stock by Goods Receipt and are never billed; a retreaded tyre is billed at its latest retread cost plus markup; one tyre early-failure tolerance in Settings; no stooring for External work; the verifier checks the position on the map; cash advances stay outside the system; the invoice has an optional wet signature, no approval; the System Admin or Field Coordinator sets each vehicle's driver; a vendor master; no on-trip status; KPI targets after about 3 months; every earlier assumption ASM-01 to ASM-46 is confirmed | REQ-ENG-011, REQ-SPK-008, REQ-BIL-003, REQ-BIL-007, REQ-BSL-009, REQ-MBL-005, REQ-VEH-010, REQ-INV-014, 11.2 |
| DEC-59 | A step's draft moves with the step when it is reassigned; an assignee may release a step with a reason, and the Planners are notified | REQ-ENG-011 |
| DEC-60 | The Stock step only cuts warehouse stock. Buying parts outside is a separate Part Purchase module: the buyer types quantity and price for the parts the Planner or System Admin put on the SPK (DEC-63), and sees each line total and the grand total at once to check against the shop receipt. Replaces the mixed Stock step of DEC-38 and DEC-49 and the Cut stock or Purchase mode per line | REQ-STK-001, REQ-PUR-001 |
| DEC-61 | The Part Purchase step has no Total on receipt field and no match check; it shows the line totals and the calculated total only; the step verifier checks them against the receipt photo (DEC-62) | REQ-PUR-003 |
| DEC-62 | Part Purchase lines pick the part from the parts catalog so part age and early failure work; quantity and price are typed. A vendor may be chosen or typed by hand. A confirmed shortfall adds a Part Purchase step after the Stock step. The step verifier checks the lines and total against the receipt photo and returns the step with a note when they differ | REQ-PUR-002 to 004, REQ-PUR-008, REQ-PUR-009 |
| DEC-63 | The Planner and the System Admin design which parts an SPK uses. The Warehouse Manager only confirms availability and issues in the Stock step; the Field Coordinator only types quantity and price in the Part Purchase step. Neither adds or changes parts; that needs a change request | REQ-PUR-002, REQ-PUR-008 |
| DEC-64 | For the Part Purchase step the Planner lists only which parts to buy, without quantity; the Field Coordinator types the quantity actually bought, which may exceed the shortfall, and the price. This applies only to the Part Purchase module; the Stock step keeps planned quantities | REQ-SPK-001, REQ-PUR-002 |
| DEC-65 | Not every SPK type has every module; the Create SPK form follows the step design of the chosen type, one section per step in order, from each module's creation section, so no module is hard-coded in the form (superseded by DEC-85: the steps are composed in the form itself) | REQ-SPK-017, REQ-SPK-004 |
| DEC-66 | Technology stack: TypeScript monorepo with a NestJS API server, PostgreSQL, Cloudflare R2 file storage (DEC-32), Next.js web and an Expo React Native mobile app; web and mobile reach the database only through the API. The Android app is distributed as a signed APK; iPhone follows in Release 2. Hosting is in the cloud. The system is built by AI agents and finished by internal developers | 8.2, NFR-18 |
| DEC-67 | Hosting: Google Cloud in the Jakarta region (Cloud Run for API, workers and web; Cloud SQL for PostgreSQL; Memorystore for Redis; Secret Manager), files on Cloudflare R2, and Cloudflare DNS, TLS and protection in front | 8.2, NFR-17 |
| DEC-68 | Vehicle classes have a unit kind: Powered (tractor head, wingbox rigid truck, van) or Towed (trailer tail). A Towed unit has no odometer and counts tyre life, part age and PM in days only. Head and trailer tail are separate units with separate SPKs and no coupling record. Layouts may have spare tyre positions, from 0 upward. The fleet has no lift axles, so axle roles stay Steer, Drive and Trailer | REQ-PLC-017 to 020 |
| DEC-69 | The fleet includes pickup trucks used as safety patrol vehicles (Toyota Hilux): class Pickup\_Patrol, unit kind Powered, layout of 2 axles (Steer and Drive) with 1 tyre per side and 1 spare, 5 positions. It is an internal vehicle, so it has no customer and is never invoiced (REQ-BIL-001) | REQ-PLC-017 |
| DEC-70 | PM packages are set per vehicle class: each package (interval, tasks, suggested parts, SPK preset since DEC-85) belongs to one class, a class may have several, and a Towed class uses days only. A vehicle gets alerts only from the packages of its own class | REQ-REG-007, REQ-PM-001, REQ-PM-002 |
| DEC-72 | A change request may change only steps that are not yet submitted; a submitted step is corrected by the verifier returning it, and posted stock by a reversal | REQ-CR-008 |
| DEC-73 | Release 1 testing of the chassis map covers the launch layouts (tractor head, trailer tail 2 and 3 axles, wingbox rigid, pickup patrol Hilux, van) plus generated layouts of 1 to 6 axles with every role, single or dual, and 0 to 2 spares, so a future unit type is added by the System Admin as data, without code change | REQ-PLC-017, AC-PLC-010 |
| DEC-74 | Release 1 file exports (xlsx, CSV, PDF) are only the stock card and the audit log; the SPK document and invoice PDFs are documents, not exports, and stay in Release 1. Every other export, including list exports and Reports, comes in Release 2 | REQ-INV-008, REQ-IAM-007, REQ-RPT-001 |
| DEC-75 | Bulk import moves to Release 1: the System Admin prepares the master data before go-live, importing customers, vendors, services, stooring rates, parts, vehicles, documents, existing tyres, baselines and the opening balance from spreadsheets in Setup mode; an import goes in only when every row is valid | REQ-IAM-011, REQ-DOC-013, REQ-BSL-008 |
| DEC-76 | In Release 1 the odometer comes from the Driver: the daily inspection in the mobile app asks the reading and saves it with source Driver; System Admin manual readings remain; the Protrack adapter stays in Release 2 | REQ-MOB-003, REQ-VEH-006, REQ-VEH-009 |
| DEC-77 | User acceptance testing and sign-off at the end of each Release 1 step are done by the product owner or the System Admin, on staging, with real work cases | 10 |
| DEC-78 | The risk-reducing engineering practices of the development plan are binding for the agents and internal developers (8.3) | 8.3 |
| DEC-79 | The highest-risk areas are marked so agents focus their effort on them: critical for the assignment engine and module registry; high for the SPK lifecycle, Stock step, inventory, Part Replacement and chassis map, and the mobile app | 8.4 |
| DEC-80 | Data simplification after the schema audit: removed unused columns (driver licence and WhatsApp, position service life and coordinates, signature hashes); removed duplicates (vehicle axle and tyre counts, read from the layout; the SPK link on alerts, inspections and breakdowns, kept only on spks with one-live-SPK unique indexes; the inspection odometer, now a link to odometer\_logs); tyre tread and pressure kept as a same-transaction cache; usual validity now prefills the renewal expiry. No feature or relation is lost | 9, REQ-DOC-007 |
| DEC-81 | The product is named BMI Stooring System and uses the BMI logo supplied by the client. Brand tokens: primary red #AD2713, dark red #8A1D0C, gold #C09D11 (dark surfaces only), and the Petrol Complement neutrals petrol #1F4E5F, petrol ink #14262E and selection mist #E6EFF1 (DEC-84, which replaced the original ink #1A1A1A and sand #F7F1E8); the status red #B91C1C stays separate and every status keeps its text. Logo on a white tile on dark surfaces, grayscale on printed documents. This narrows the earlier rule that visual style is fully free (0.1): the rest of the style stays free (superseded by DEC-96: the design artifact now fixes the full visual design) | 0.1, 7.1, 7.7, 7.8 |
| DEC-82 | The web navigation is collapsible to a 64 px icon rail, saved per user, and icons are used where they help users find their way: every navigation item on web and mobile, assignment modules on step cards and in the SPK designer, Settings home items, vehicle detail tabs, and add and back buttons. Icons come from one outline set and always sit beside a text label, except in the collapsed rail | 7.2, 7.3, 7.5 |
| DEC-83 | The UI gives immediate feedback on every control and uses motion only to acknowledge actions and explain state changes; the approval stamp is the one authored moment. Interactions are clickable in the design canvas (stamp, Pass/Fail, collapse menu). Reduced motion is respected | 7.5 |
| DEC-84 | Palette Petrol Complement: petrol #1F4E5F joins BMI red as the second colour (links, info states, icons, charts); the frame becomes petrol ink #14262E and selection mist #E6EFF1, with cool grey neutrals. This replaces the ink #1A1A1A and sand #F7F1E8 of DEC-81; red, gold, status colours and the logo rules are unchanged | 7.8, DESIGN.md |
| DEC-85 | SPK types and the SPK type designer in Settings are removed. The Planner or System Admin builds each SPK's steps directly in Create SPK, on one screen: modules are dragged from a palette (or added with Add step), reordered by drag or Move up and Move down, and each step's roles and details are filled in place. Saved step sequences become SPK presets (Save as preset, Settings: SPK presets), used as optional starting points and by PM packages and alerts. Each SPK gets a title, a required category (PM, Corrective, Tyre, Document, Other) and a Vehicle goes to the workshop flag, which replace the type in lists, reports and the Repair status. A change request may add, remove or move steps that have not started. The engine is unchanged: it already runs each SPK's own steps (DEC-65 and DEC-05 apply to SPKs instead of types) | 4.1, 4.3, REQ-SPK-017, REQ-REG-001 to 005, REQ-CR-003, 9 |
| DEC-86 | A new Settings: Alert rules screen holds, per alert kind (PM due, Document expiry, Tyre tread, Part item life), the trigger and the action: Show the alert only or draft an SPK, when to draft, the preset, the priority and who is notified. The preset is per package for PM and per document type for documents, the same values as in PM packages and Document types (editable in both places), and per rule for the other kinds. Tyre and part item limits move from Alert thresholds, which keeps only warning-only limits (odometer, dead stock, schedule, file storage). Earlier rule that document warning days are set only on document types is relaxed: they are also editable in Alert rules | REQ-PM-003, REQ-PM-006 to 010, REQ-SPK-012, 7.3, 7.4, 9 |
| DEC-87 | A step's start time is the moment its executor presses Start, not the moment the step opens after the previous one is submitted, and not the first edit. Each step records Open, Start, Pause (with a reason), Resume, Submit, Return and Verify in an append-only log, so time splits into waiting to start, working, paused and waiting for verification, per attempt. A forgotten Start may be entered up to 2 hours back with a reason and is marked; other corrections are System Admin only, with reason and audit. For external workshops the Field Coordinator or System Admin presses Start at hand-over. The times show in the SPK document (Execution time) and in a Step time report and dashboard card for the GM and Supervisor, and never on an invoice. Durations are calendar time; working hours and holidays are not deducted (pauses cover breaks and shift ends). | REQ-ENG-012 to 016, REQ-SPKD-008, REQ-RPT-005, REQ-DSH-010, 4.2 |
| DEC-88 | A sixth module, Part Check (troubleshooting), lets the Planner list parts to check in Create SPK. The mechanic reports per part the condition, Good, Repair or Replace, an optional Unsafe to drive mark and at least one photo, and may add parts not on the list. When the step is verified, the not-good findings become one Draft SPK with steps built from them (Stock or Part Purchase for Replace, Mechanic Action for Repair, Part Replacement for tyres). The Planner activates it, which means submitting it for approval, or discards it with a reason; the draft is never Active on its own, keeping the approval rule. Repairs never run in the same SPK as the check, so the check SPK can be completed and billed on its own. Unsafe to drive warns and notifies but does not block the vehicle. | REQ-CHK-001 to 006, 9.6 |
| DEC-89 | The Part Check is billed: its step carries a check service from the service catalog (new category Diagnosis: SVC-095 Brake system check, SVC-096 Electrical system check, SVC-097 General vehicle check) or an external workshop's price; stooring for a field check is charged by the SPK's Mobilisasi step (DEC-90), not by the Part Check step. At least one service line is required; a free check needs a Rp 0 catalog service. The repairs it finds are billed with the follow-up SPK. Replaces the no-cost rule of DEC-88 | REQ-CHK-001, REQ-CHK-007, REQ-MBL-006, 9.6 |
| DEC-90 | The stooring (mobilisation) capability moves out of the Mechanic Action step into a new, data-driven assignment module Mobilisasi (REQ-MBL-\*), a peer of Stock, Part Purchase, Mechanic Action, Part Replacement and Document. Mechanic Action no longer captures the device position (REQ-MEC-007 to 009 retired, superseding DEC-40, DEC-52, DEC-53 position capture and DEC-71). A Report Breakdown captures the reporter's location once; only an Urgent one auto-drafts an SPK pre-seeded with one Mobilisasi step at that location (DEC-109, REQ-BRK-003), and for any other report the Planner adds Mobilisasi by hand with the destination filled from the report; the Planner composes the rest. The Mobilisasi step shows a route to the destination, auto-submits on arrival with a manual Finish stooring fallback, and records the mechanic's location trail only while In\_Progress; it produces the stooring fee (one per SPK per region per day). The continuous trail is broader than the old one-time capture, so the RSK-09 / UU PDP handling (privacy notice, trail scoped to the active step, access logged, visible to Planner and System Admin only) applies | REQ-MBL-001 to 006, REQ-SPK-003, REQ-BRK-003, REQ-MOB-003, RSK-09, 3.3, 9.5, 9.6 |
| DEC-91 | Every SPK made from a Report Breakdown carries its note as a field-finding note (`spks.finding_note`), so the Planner sees the full repair context before composing the SPK. It is copied once from `breakdown_reports.description` when the SPK is created and is preserved separately from `description`: the Planner may rewrite `description` into the official work scope without losing it. The note is mandatory on the report and on such an SPK (enforced by a table CHECK). The Report Breakdown list shows it alongside the report photos (REQ-BRK-005) | REQ-SPK-003, REQ-BRK-001, REQ-BRK-005, REQ-BRK-006, 9 |
| DEC-92 | OFF unit, schedule roll-forward, OFF-unit cost and SPK urgency. (1) A new derived vehicle status **OFF** is added to SM-VEH between Inactive and Blocked (precedence Inactive 1, OFF 2, Blocked 3, Repair 4, Active 5); it does not replace Inactive and, unlike Inactive, does not block SPK creation or amendment (REQ-SPK-013 stays Inactive-only). OFF is an escalation of Repair: a vehicle in Repair for an SPK becomes OFF when that SPK overruns its scheduled day, and leaves OFF only when the SPK is Completed or Cancelled. (2) The schedule's daily job (00:30 WIB, idempotent, NFR-14, BR-13) no longer only marks a missed card Missed: it also moves the card forward to the next day and keeps doing so each day, with **no limit**, until the SPK is Completed or Cancelled, flagging the card rolled-over / late (`spk_schedule.is_rolled_over`); the schedule still never blocks or cancels an SPK (BR-13). (3) Each OFF day is charged as a per-day **OFF-unit cost** from System-Admin master data: a single global daily rate `app_settings.off_unit_daily_rate` (global, not per vehicle_class, matching invoice_tax_pct / invoice_part_markup_pct); `spks.off_days` is incremented once per WIB day by the idempotent daily job (guarded by `off_last_counted_date`) and billed as a new `Off_Unit` invoice line = off_days × rate, at cost with no markup (REQ-BIL-003). (4) The Mechanic mobile task list (REQ-MOB-010) shows only SPKs scheduled for today and assigned to that mechanic, ordered by urgency (`spks.priority`) with rolled-over / late SPKs first within each level. (5) SPK urgency (`spks.priority`, REQ-SPK-015) is shown everywhere as a colour-coded urgency pill that always carries its text label (NFR-A11Y): Urgent → danger, High → warning, Normal → info/neutral, Low → neutral (DESIGN.md urgency pills) | SM-VEH, SM-SCH, REQ-SPK-015, REQ-SCH-003, REQ-MOB-010, REQ-BIL-003, REQ-BIL-012, 9.1, 9.6, 9.11, 9.12, 9.14, DESIGN.md |
| DEC-93 | Permissions work in three layers: capability (may this role take this kind of action), record rule (may this user take it on this record now) and interface (what the user sees). One server function computes the effective capability set from `role_permissions`, the Planner approval switch and Setup mode, and it alone feeds the endpoint guard, the record policies, the menu and `GET /me`. The `permission_code` values are a fixed catalogue (2.4); X and V cells become an action code and a `*.view` code, so `role_permissions` keeps its boolean `allowed` and the schema of 9 is unchanged. Menus come from the catalogue's menu table and buttons from each record's `allowedActions`, never from the role name, so a matrix edit or the Planner switch changes what a user sees on the next page load. Three rows are added to 2.2 (role dashboard, view Surat Perintah Kerja, Report Breakdown list) to cover screens that had no row; Accounting reaches SPKs only through invoices (RL-9) | 2.2, 2.4, 7.2, 7.6 NAV-9, 8.3, REQ-IAM-008, REQ-IAM-012 to 014 |
| DEC-94 | The design artifacts are organised by module, not by role: one screen per module (a step module, the SPK detail, the approval review, the schedule, a master-data page) serves every role that reaches it, and a role only changes which actions show (its `allowedActions`, DEC-93). The 153 per-role artboards are merged into module files under `Design Artifact/<area>/`, on one shared kit; every old artboard name stays an anchor in its module file, so screen names in code and spec links keep working, and duplicate per-role screens (seven dashboards, five review screens, separate mobile copies) are gone. The shell is redesigned for a friendlier, rounder look that puts the main screen first: a floating rail capsule on the left with circular icons, the logo in a circle at its top and an expand button for names; one raised white main sheet that holds the header, the pill tabs and the content; pills for buttons, round step and status markers. This refines DEC-82 (the collapsed rail becomes the default, floating) and DESIGN.md's shapes, elevation and navigation. The phone version of a module is a separate file under `Design Artifact/mobile/` with the module's name. The role switch ("Viewed as"), the allowedActions line and the state labels are a design-review aid shown only when an artboard is opened with `?review`; they are never part of the product UI | 0.2, 7.2, 7.3, DESIGN.md, Design Artifact/ |
| DEC-95 | Some modules need no work-time audit. A module of the registry carries `tracks_work_time` (default true); Part Replacement is seeded false, because its step serves part traceability (which tyre went where, by whom, under which SPK), not labour analysis. Its step has no Start, Start earlier, Pause or Resume: the form is editable while the step is Open, the first save or action claims it and sets it In_Progress, and it keeps only its Open, Submit, Return and Verify events. It is left out of the step time report and dashboard card, and the SPK document shows only its submit time. Refines DEC-87 for such modules; adds one column to `assignment_modules` (9.6) | 3.3, 9.6, REQ-ENG-012 to 017, REQ-RPT-005, REQ-DSH-010, REQ-SPKD-008 |
| DEC-96 | The design artifact is the visual target of the end product. Agents build every web and mobile screen to look like its artboard in `Design Artifact/`: layout and the full visual design (shell, colours, type, spacing, radii, shapes, elevation, icons, states, chassis map, motion). The spec still decides behaviour, rules and data; sample data and the `?review` strip are not built; artboards are reproduced in the app's own components, not imported. Where DESIGN.md and an artboard differ, the artboard wins and DESIGN.md is corrected. Replaces the earlier rule that the canvas is a layout reference only and that visual style is free at implementation (0.1, 7.1, 7.7, and the last sentence of DEC-81) | 0.1, 0.6, 7.1, 7.7, DESIGN.md, CLAUDE.md |
| DEC-98 | The Mechanic mobile menu is essential and moves to Release 1, built in R1 step 7 with the Driver, Field Coordinator and System Admin menus: My steps for today (REQ-MOB-010), the step screens (Mechanic Action, Part Replacement, Part Check, Mobilisasi with route and location trail), Report Breakdown and inspection (REQ-BRK-001, REQ-BRK-008), history and push. REQ-MOB-010 becomes P0. The Supervisor/GM menu stays in Release 2. Supersedes the Mechanic part of DEC-41 | 2.1, 4.20, 4.19, 7.3, 10 |
| DEC-99 | Part Check (DEC-88, DEC-89) and Mobilisasi (DEC-90) are essential Release 1 features: their server, web screens and verification are built in R1 step 4 with Mechanic Action; their phone screens in R1 step 7 | 10, 4.5, 4.5a |
| DEC-100 | MobileProfile is P0 in Release 1, because every Release 1 mobile menu has a Profile tab: identity, language, app and session info and sign out. Its per-kind push mute (REQ-NTF-003) stays P1 | 7.3, REQ-MOB-001 |
| DEC-101 | A Rejected SPK stays Rejected with the rejector's note; its creator edits and resubmits it (T5) or cancels it with a reason (T6). DQ-06 is corrected to match SM-SPK | 3.2, 7.11, REQ-SPK-007 |
| DEC-102 | The password reset of DQ-02 sends one transactional email with an expiring link, through an email adapter (NFR-11). It is the only email in Release 1; email notifications stay P2. The email provider account joins Q-03 | 1.4, 7.11, REQ-IAM-001, REQ-IAM-009 |
| DEC-103 | In Release 1 the DashboardAdmin integration rows show status only and open nothing; SettingsIntegrations comes with the P1 and P2 adapters (DQ-05) | 7.11, REQ-DSH-005 |
| DEC-104 | The authorization entity is named Surat Perintah Kerja, SPK for short, in everything people read: the full name in menus, page titles and headings, SPK in buttons, tables, numbers and running text. The number is SPK-yymmddNNNN: yymmdd is the WIB date of creation and NNNN a four-digit running number that widens when needed, never resets and is never reused. Replaces the assumption ASM-42 | 1.5, 3.2, 7.3, NFR-15, REQ-SPK-001, REQ-SPK-010, REQ-SPKD-001 |
| DEC-106 | One entity, one name: SPK replaces the former name everywhere, also in requirement IDs, state machine and area codes, tables and columns, permission codes, artboards, files, folders and code, so an agent never meets two names for one thing. Nothing is built yet, so no data or code is migrated. The former IDs are listed in docs/prd/history.md for lookup only. Replaces DEC-105 | 0.2, 0.7, 2.4, 9, 12, NFR-15 |
| DEC-107 | The design artifact has one page per screen: every screen, dialog, side panel and state of 7.3 sits on its own page named after it, in the folder of its area; a dialog or side panel is drawn over the page it opens from; tabs that are their own screen link to its page, and tabs that filter a list or switch a record work in place (NAV-2). Controls connect as in 7.9, so the artifact can be clicked through like the end product. This replaces the file-per-module arrangement of DEC-94 (one screen for every role still holds: a role changes the controls, not the page). Sample data stays non-binding (7.1) | 7.1, 7.3, 7.9 |
| DEC-108 | Retried requests are recognised by a new table `idempotency_keys` (9.12), written in the same transaction as the action (TX-22), so a retry can never repeat a committed action and a failed action leaves no trace. The rows are a technical record, not a core record of BR-10: they are removed after 30 days [A] by the daily job | NFR-01, TX-22, 9.12 |
| DEC-109 | The field no longer drafts SPKs. A Driver, Mechanic or Field Coordinator sends a Report Breakdown (note, photos, urgency; vehicle, and the location captured by the device), and the Planner or System Admin creates the SPK with the report as its reference. Draft SPKs are made automatically only by system alerts (PM, document, tyre, part item), by a verified Part Check, and by an Urgent breakdown report, whichever role sent it: that draft holds one Mobilisasi step at the captured location. For every other report the Planner adds Mobilisasi by hand. An inspection Fail, by a Driver or a Mechanic, raises a report and never a draft. An Urgent breakdown report from a Driver, or entered for a driver by the System Admin, also shows every Planner a blocking pop-up that closes only when one of them presses Create SPK. Replaces DEC-24, DEC-34 and DEC-97; changes DEC-64, DEC-85, DEC-86, DEC-90, DEC-91 and DEC-98. An SPK made from a report shows "Report reference: RB-yymmddNNNN" in its description as its source. The report number is generated like the SPK number: yymmdd is the WIB date the report is sent, NNNN a running number of at least four digits that never resets and is never reused. Product owner decision: field users must not carry a complicated system | 2, 3, 4.1, 4.11, 4.11a, 4.20, 9, REQ-BRK-001 to REQ-BRK-009 |

Fully superseded decisions (DEC-25, DEC-38, DEC-40, DEC-49, DEC-52, DEC-71, DEC-105) are in [docs/prd/history.md](docs/prd/history.md).

### 11.2 Assumptions \[A\]

Every assumption ASM-01 to ASM-64 is confirmed or decided (DEC-58 and later). An \[A\] tag in the spec marks where one applies; the list with its origin is in [docs/prd/history.md](docs/prd/history.md).

### 11.3 Other open questions

| ID | Question |
| --- | --- |
| Q-01 | Targets for G-2 (PM on time), G-6 (opname variance) and G-7 (SPK cycle time), to set after about 3 months of live use (DEC-58). |
| Q-02 | Answered by DEC-109 and DEC-58: the Field Coordinator sends Report Breakdowns and executes Part Purchase steps (RL-6); there is no on-trip status in R1. |
| Q-03 | Open, to define later (product owner): who owns the Google Cloud, Cloudflare, Firebase and Expo (EAS) accounts and the email provider account for password reset (DEC-102), and which domain the web app and API use. Needed before the first staging deploy (R1 step 1) and before the first APK build (R1 step 7). |
| Q-04 | Decided: the AI assistant (REQ-AI-001 to 004) and its settings page are deferred to a later release; they have no artboard and are not built in Release 1. |
| Q-05 | Decided: the Indonesian translation of the UI is deferred to a later release. The current canvas screens are English only; Indonesian becomes the default language once the translation is delivered (NFR-09). |

### 11.4 Risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| RSK-01 | Approver bottleneck: all work waits for one approval | Any one Approver suffices; waiting items show on dashboards, in-app and by push (P1), with a reminder (ASM-24) |
| RSK-02 | A change request freezes the step | Keep requests small; show how long an SPK has waited |
| RSK-03 | A badly designed step sequence stalls SPKs | Live checks in Create SPK (REQ-REG-004), approval of every SPK's steps, presets as tested starting points |
| RSK-04 | Master data (layouts, part items, services, positions) missing at go-live | Load it in R1 step 1 to 5; bulk import in Release 1 (REQ-IAM-011) |
| RSK-05 | Drivers and mechanics do not adopt the mobile app | Short flows, camera-first photos, release 1 fallback through the System Admin and desktop |
| RSK-06 | Protrack API access delayed | Manual and driver readings cover the gap |
| RSK-07 | R1 grows by a mobile app and invoicing, so the web core may ship later | Mobile and invoicing are R1 step 7, started only after steps 1 to 6 pass; they can ship as a separate R1 drop |
| RSK-08 | Planner approval left on by mistake weakens the four-eyes rule | Optional end time, audit record, notice to Supervisors and GMs, BR-03 still enforced |
| RSK-09 | Recording an employee's position without telling them may conflict with the Indonesian personal data protection law (UU PDP 27/2022); the phone also asks for location permission once. The Mobilisasi module (DEC-90, REQ-MBL-005) now records a continuous location trail of the mechanic while the step is In\_Progress — broader than the old one-time capture — raising the privacy exposure | Cover it in the employment agreement or company policy and the app privacy notice (not on the step screen); scope the location trail strictly to the duration a Mobilisasi step is In\_Progress and stop recording at submit; keep the data only for verification, visible to Planner and System Admin, with every access logged |

## 12. Traceability matrix

Per area: where it is specified, tested, shown, stored, guarded and walked through: [docs/prd/traceability.md](docs/prd/traceability.md). Earlier change history: [docs/prd/history.md](docs/prd/history.md).
