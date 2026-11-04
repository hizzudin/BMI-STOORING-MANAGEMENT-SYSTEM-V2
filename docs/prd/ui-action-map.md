# 7.9 Action map (DEC-90)

> Part of the BMI Stooring System spec (§7.9 action map). Core rules, roles, state machines, business rules and decisions: [PRD.md](../../PRD.md). Section numbers and IDs are unchanged from the single-file PRD v2.4.


Every control drawn in the canvas, with what it does, where it goes and the rule behind it. Build each control exactly as written here. A control that is in the canvas but not in this map, or a row marked DQ while its decision in 7.11 is open, is not built: list it as a question (7.7). \[New\] marks behaviour defined by this review; it is binding like the rest of the spec. A screen's own rows win over the common controls.

## Common controls (every screen)

| ID | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| C-01 | Sidebar item (web) | Opens the area's first page: Dashboard → the role's dashboard; Surat Perintah Kerja → [SPKList](<../../Design Artifact/spk/SPKList.html#SPKList>); Requests → [FCRequests](<../../Design Artifact/spk/Requests.html#FCRequests>); Schedule → [MaintenanceSchedule](<../../Design Artifact/schedule/Schedule.html#MaintenanceSchedule>) (ScheduleDispatcher for read-only roles); Approvals → [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>); Inventory → [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>) (last Parts/Tyres mode, NAV-7); Vehicles → [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>); Documents → [Documents](<../../Design Artifact/documents/Documents.html#Documents>); Reports → the first Reports tab the role may see; Settings → [Settings](<../../Design Artifact/settings/Settings.html#Settings>); Invoices → [InvoiceList](<../../Design Artifact/billing/Invoices.html#InvoiceList>); Customers → [Customers](<../../Design Artifact/billing/Customers.html#Customers>); Users and roles → [UsersRoles](<../../Design Artifact/access/UsersRoles.html#UsersRoles>); Audit log → [AuditLog](<../../Design Artifact/access/AuditLog.html#AuditLog>); Setup and go live → [SetupGoLive](<../../Design Artifact/setup/SetupGoLive.html#SetupGoLive>). Items shown per role as in 7.2 | 7.2, 2.2 |
| C-02 | Collapse menu | Toggles the icon rail (AppShellCollapsed); saved per user; no navigation | DEC-82 |
| C-03 | Bell in the page header | Opens NotificationCenter as a panel over the current page; the badge shows the unread count | REQ-NTF-001, DQ-01 |
| C-04 | User and role in the page header | Opens the user menu: Change password (ChangePassword), Notification settings (P1), Sign out (ends the session, back to WebLogin; a dirty form asks first, C-13) | \[New\], DQ-01 |
| C-05 | Mobile bottom bar item | Driver: Home → [DashboardDriver](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>), Inspection → [DriverInspection](<../../Design Artifact/mobile/FieldReports.html#DriverInspection>), History → [DriverHistory](<../../Design Artifact/mobile/FieldReports.html#DriverHistory>), Profile → MobileProfile. Field Coordinator: Fleet → [DispatcherMobileFleet](<../../Design Artifact/mobile/Fleet.html#DispatcherMobileFleet>), Requests → [FCMobileRequests](<../../Design Artifact/mobile/Requests.html#FCMobileRequests>), Purchases → [FCMobilePurchase](<../../Design Artifact/mobile/PartPurchase.html#FCMobilePurchase>) list, Schedule → [DispatcherMobileSchedule](<../../Design Artifact/mobile/Fleet.html#DispatcherMobileSchedule>), Alerts → [DispatcherMobileAlerts](<../../Design Artifact/mobile/MobileApp.html#DispatcherMobileAlerts>); Profile from the header. System Admin: Requests → [FCMobileRequests](<../../Design Artifact/mobile/Requests.html#FCMobileRequests>), Purchases → [FCMobilePurchase](<../../Design Artifact/mobile/PartPurchase.html#FCMobilePurchase>) list, Steps → [SAMobileHome](<../../Design Artifact/mobile/MobileApp.html#SAMobileHome>) (open steps), Profile → MobileProfile. Mechanic (P1): My steps → [MechanicMobileHome](<../../Design Artifact/mobile/MobileApp.html#MechanicMobileHome>), Report → [MechanicMobileFieldReport](<../../Design Artifact/mobile/Requests.html#MechanicMobileFieldReport>), History → MechanicMobileHistory, Profile → MobileProfile. Supervisor and GM (P1): Approvals → [SupervisorMobileHome](<../../Design Artifact/mobile/Approvals.html#SupervisorMobileHome>), Fleet → [SupervisorMobileFleet](<../../Design Artifact/mobile/Fleet.html#SupervisorMobileFleet>), History → SupervisorMobileHistory, Profile → MobileProfile | REQ-MOB-001, DQ-03, DQ-04 |
| C-06 | Tab (inside a page) | Changes the content of the same page and keeps the filters of that tab; never opens a new page; the count in the label is live | NAV-2 |
| C-07 | Row, list card or calendar card (click) | On a master-detail page selects the row and fills the right panel; on a list page opens the record's page. A row the user may only read opens it read only | NAV-3, 7.2 |
| C-08 | Open (on a row or item) | Opens the exact record named: a step → its step screen (NAV-1), an SPK → [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>), an invoice → [InvoiceDetail](<../../Design Artifact/billing/Invoices.html#InvoiceDetail>), a document → the document panel, a count → its count page | NAV-5 |
| C-09 | View (on a row) | Same as Open, read only, for a row that is not waiting for this user (no action bar) | \[New\] |
| C-10 | Review (on a dashboard item) | Opens the matching review: creation → [ApprovalReview](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>), amendment → [AmendmentReview](<../../Design Artifact/approvals/ApprovalReview.html#AmendmentReview>), completion → [CompletionReview](<../../Design Artifact/approvals/ApprovalReview.html#CompletionReview>), stock opname → [StockOpnameApproval](<../../Design Artifact/approvals/ApprovalReview.html#StockOpnameApproval>), tyre count → [TyreCountApproval](<../../Design Artifact/approvals/ApprovalReview.html#TyreCountApproval>), odometer void request → [OdometerVoid](<../../Design Artifact/fleet/Vehicle.html#OdometerVoid>) in review mode, a part-check draft → [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromCheck>) | NAV-5 |
| C-11 | Create SPK / Create SPK | From a header: CreateSPK blank. From an alert row: CreateSPKFromAlert with vehicle, source and the alert rule's preset. From a vehicle: CreateSPK with the vehicle. Only roles that may create an SPK see it (Planner, System Admin; Field Coordinator and Mechanic get the draft form FCCreateSPK) | REQ-SPK-012, FLW-PLN-02 |
| C-12 | Cancel (form page) | Leaves the form without saving and returns to the page it came from; if anything was typed, asks Leave without saving? (Leave, Stay) | \[New\] |
| C-13 | Leaving a page with unsaved changes (any way) | Same question as C-12; Save draft is never automatic except the mobile offline draft (REQ-MOB-009) | \[New\] |
| C-14 | Cancel (dialog) / Close / × | Closes the dialog or panel; nothing changes | \[New\] |
| C-15 | Save draft | Saves what is typed without the submit checks; stays on the page; shows Saved at hh:mm; only the owner and the SPK creator see a draft | \[New\] |
| C-16 | Discard / Discard changes (settings and masters) | Reverts the page to the last saved version after Discard your changes? (Discard, Keep editing); no navigation | \[New\] |
| C-17 | Save (settings and masters) | Runs the page checks, saves one version with an audit record, stays on the page and shows Saved; refused with the reason when a check fails | FLW-SA-05 |
| C-18 | Submit step / Submit step again | Runs the module's submit checks; on success stamps the executor, sets Submitted, opens the next step and returns to SPKDetail with Step n submitted. Disabled with the reason while a check fails, while paused (REQ-ENG-013) or while files are still uploading (shows Sending when photos finish) | REQ-ENG-002, NAV-1 |
| C-19 | Start work / Start | Sets the real start time and unlocks the form (DEC-87); claims an unassigned step. Not shown on a step whose module does not track work time (Part Replacement): there the first save or action claims the step (DEC-95) | REQ-ENG-012, REQ-ENG-017 |
| C-20 | I started earlier | Opens the Start earlier panel: Started (15 min, 30 min, 1 h, 2 h ago; never before the step opened) and Why (Forgot to press Start, No signal, Phone was off) → Start from that time; marked entered | REQ-ENG-014 |
| C-21 | Pause (not on a module that does not track work time, REQ-ENG-017) | Opens the Why are you pausing? dialog (web) or sheet (phone): Waiting for parts, Waiting for the vehicle, Waiting for vendor or agency, Break or shift ended, Other with a note → Pause. Form read only while paused | REQ-ENG-013 |
| C-22 | Resume | Ends the pause at once (no dialog) and unlocks the form | REQ-ENG-013 |
| C-23 | Raise change request | Opens ChangeRequest for the open step | REQ-CR-001 |
| C-24 | Approve (decision card) | Commits at once, adds the stamp with the time (7.5 motion) and disables Reject; there is no undo; the page then shows Decided and a link back to the inbox | REQ-APR-004, \[New\] no undo |
| C-25 | Reject (decision card) | Enabled only when the reason has text; commits at once with the reason; no undo | REQ-SPK-006 |
| C-26 | Export | Opens the Export dialog (StockCardExport pattern): format xlsx or csv (pdf where the page is a document), what is exported = the current table with its filters and only the columns the role may see → Export; written to export\_logs | REQ-RPT-001, \[New\] |
| C-27 | Print / Download PDF | Print opens the browser print of the document page; Download PDF saves the same page. Before the SPK is Completed the document carries the mark Not final on every page | REQ-SPKD-001, \[New\] Not final mark |
| C-28 | Back / Back to … / Back to SPK / Back to vehicle | Returns to the named parent page, keeping its tab and filters | NAV-1 |
| C-29 | Thumbnail or file name | Opens PhotoViewer on that file (previous and next walk the files of the same record) | REQ-FUP-016 |
| C-30 | Remove (line in a form) | Removes the line from the form at once; nothing is saved until Save draft or the main action | \[New\] |
| C-31 | New … / Add … in a master-detail settings page | Adds a blank record in the right panel, selected and marked New; nothing is saved until Save; Discard drops it | \[New\] |
| C-32 | Deactivate (master record) | Opens a confirm dialog naming what stops (for example: no new SPK lines can use this service; saved lines keep it) → Deactivate; refused with the reason when the rule of that master forbids it | \[New\] |
| C-33 | Filters, search and sort | Change the table at once; search matches the code and name columns; the choice is kept while the user stays in the area | 7.2 One field per column |
| C-34 | Any button while its request runs | Is disabled and shows progress, so it cannot be sent twice; a refused request (no permission, a newer version saved by someone else, a rule) shows one sentence and leaves the form as typed | \[New\], NFR |
| C-35 | Any action on the phone without signal | Save draft, Start, Pause, Resume and photo capture work offline and sync later; Submit, Approve, Reject and Send need a connection and say so | REQ-MOB-009 |

## Action map: Shell and sign-in

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [WebLogin](<../../Design Artifact/shell/SignIn.html#WebLogin>) | Sign in | Checks email and password; 5 wrong tries lock the account (unlock by the Access Manager); first sign-in → [ChangePassword](<../../Design Artifact/shell/SignIn.html#ChangePassword>); then the role's dashboard (Access Manager → [UsersRoles](<../../Design Artifact/access/UsersRoles.html#UsersRoles>); System Admin in Setup mode → [SetupGoLive](<../../Design Artifact/setup/SetupGoLive.html#SetupGoLive>)) | REQ-IAM-001 |
| [WebLogin](<../../Design Artifact/shell/SignIn.html#WebLogin>) | Forgot password? | Sends a password reset link to the account's email; the link opens a reset page and expires after a set time. Decided (DQ-02, 7.11) | DQ-02, 7.11 |
| [MobileLogin](<../../Design Artifact/mobile/MobileApp.html#MobileLogin>) | Sign in | As WebLogin; then the role's mobile home (C-05). A role with no mobile menu sees Use the web app | REQ-MOB-001 |
| [ChangePassword](<../../Design Artifact/shell/SignIn.html#ChangePassword>) | Save and continue | Checks the current and new password (rules of REQ-IAM-001); then the role's dashboard | REQ-IAM-001 |
| [NotificationCenter](<../../Design Artifact/shell/Notifications.html#NotificationCenter>) | Mark all read | Marks every notice of this user read; no navigation | \[New\] |
| [NotificationCenter](<../../Design Artifact/shell/Notifications.html#NotificationCenter>) | Notice (click) | Marks it read and opens the record it names | REQ-NTF-001, NAV-5 |
| [NotificationCenter](<../../Design Artifact/shell/Notifications.html#NotificationCenter>) | Filter tabs (All, Approvals, Steps, Alerts, Schedule) | C-06 | C-06 |
| [AppShellCollapsed](<../../Design Artifact/shell/AppShell.html#AppShellCollapsed>) | Review | C-10 | C-10 |
| [PhotoViewer](<../../Design Artifact/components/PhotoViewer.html#PhotoViewer>) | Zoom, 100%, ‹ › | View only | REQ-FUP-016 |
| [PhotoViewer](<../../Design Artifact/components/PhotoViewer.html#PhotoViewer>) | Close | C-14 | C-14 |
| [FileUploadStates](<../../Design Artifact/components/FileUpload.html#FileUploadStates>) | Remove | Removes the file from the slot | REQ-FUP-007 |
| [FileUploadStates](<../../Design Artifact/components/FileUpload.html#FileUploadStates>) | Save draft | C-15 | C-15 |
| [FileUploadStates](<../../Design Artifact/components/FileUpload.html#FileUploadStates>) | Sending when photos finish… | C-18 while files upload; submits by itself when all are Ready | REQ-FUP-012 |
| [Main](<../../Design Artifact/index.html#Main>) | (none) | Canvas overview only; not built | 7.3 |

## Action map: Dashboards

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Review | C-10 | C-10 |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Step time report | Opens ReportsStepTime (Step time tab) for the last 30 days | REQ-DSH-010 |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | View (bottleneck row) | Opens ReportsStepTime filtered to open steps whose phase is Waiting for verification over 8 hours | REQ-DSH-010, \[New\] |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Vehicle row, early failure row | Vehicle → [VehicleOverview](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>); early failure → the SPK's ApprovalReview read only | NAV-5 |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Invoices rows | InvoiceList on the Issued tab (Overdue row adds the overdue filter) | \[New\] |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Create SPK | C-11 (CreateSPK blank) | FLW-PLN-01 |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Verify | SPKDetailVerify of that SPK, scrolled to the step | FLW-PLN-05 |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Revise | CreateSPKRevision of the change request | FLW-PLN-06 |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Request | SPKDetailVerify with the Completion card | FLW-PLN-07 |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Open (draft row) | CreateSPK in edit mode for that draft | FLW-PLN-02 |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Review (part-check draft) | [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromCheck>) | REQ-CHK-004 |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Create SPK (alert row) | C-11 from an alert | FLW-PLN-02 |
| [DashboardPlanner](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) | Summary cards | Each opens SPKList on the matching tab, or the schedule for Not on the schedule | \[New\] |
| [DashboardMechanic](<../../Design Artifact/dashboard/Dashboard.html#DashboardMechanic>) | Create SPK | FCCreateSPK as a Mechanic draft (no steps; sent to the Planner) | REQ-SPK-016 |
| [DashboardMechanic](<../../Design Artifact/dashboard/Dashboard.html#DashboardMechanic>) | Open | The step screen (C-08) | FLW-MEC-01 |
| [DashboardMechanic](<../../Design Artifact/dashboard/Dashboard.html#DashboardMechanic>) | View (locked step) | [StepLocked](<../../Design Artifact/spk/SPKDetail.html#StepLocked>) | REQ-ENG-008 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/Dashboard.html#DashboardWarehouse>) | Goods Receipt | [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>) | FLW-WHM-03 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/Dashboard.html#DashboardWarehouse>) | Receive tyres | [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | FLW-WHM-06 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/Dashboard.html#DashboardWarehouse>) | Open | The Stock step, StockOpnameReturned or the item named | C-08 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/Dashboard.html#DashboardWarehouse>) | Receive (dispatch row) | RetreadReceipt for that dispatch | FLW-WHM-07 |
| [DashboardAdmin](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) | Add vehicle | [AddVehicle](<../../Design Artifact/fleet/VehicleForm.html#AddVehicle>) | FLW-SA-01 |
| [DashboardAdmin](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) | Add document | AddDocument for that vehicle and type | FLW-SA-02 |
| [DashboardAdmin](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) | Open | C-08 | C-08 |
| [DashboardAdmin](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) | Review | C-10 (self-approval shows Self-approved) | C-10 |
| [DashboardAdmin](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) | Parts baseline | PartsBaseline for that vehicle | FLW-SA-01 |
| [DashboardAdmin](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) | Manage (master data row) | The matching Settings page (DocumentTypes, ChassisLayouts, …) | NAV-6 |
| [DashboardAdmin](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) | Integrations rows | Show each integration's status; a row opens `SettingsIntegrations`, where the System Admin connects WhatsApp, the Protrack/Cartrack odometer API and other external tools (credentials, enable/disable, connection test). Decided (DQ-05, 7.11) | DQ-05, 7.11, REQ-AI-002 |
| [DashboardDispatcher](<../../Design Artifact/dashboard/Dashboard.html#DashboardDispatcher>) | Create SPK | FCCreateSPK (source Manual\_Field\_Coordinator) | FLW-FC-04 |
| [DashboardDispatcher](<../../Design Artifact/dashboard/Dashboard.html#DashboardDispatcher>) | Open requests | [FCRequests](<../../Design Artifact/spk/Requests.html#FCRequests>) | FLW-FC-04 |
| [DashboardDispatcher](<../../Design Artifact/dashboard/Dashboard.html#DashboardDispatcher>) | Not available row | VehicleOverview read only | FLW-FC-01 |
| [DashboardAccounting](<../../Design Artifact/dashboard/Dashboard.html#DashboardAccounting>) | Open | InvoiceDetail of that invoice | FLW-ACC-01 |
| [DashboardAccounting](<../../Design Artifact/dashboard/Dashboard.html#DashboardAccounting>) | Summary cards | InvoiceList on the matching tab | \[New\] |
| [DashboardDriver](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>) | Start daily inspection | [DriverInspection](<../../Design Artifact/mobile/FieldReports.html#DriverInspection>) | FLW-DRV-01 |
| [DashboardDriver](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>) | Record odometer | [DriverOdometer](<../../Design Artifact/mobile/FieldReports.html#DriverOdometer>) | FLW-DRV-03 |
| [DashboardDriver](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>) | Report breakdown | [DriverBreakdown](<../../Design Artifact/mobile/FieldReports.html#DriverBreakdown>) | FLW-DRV-02 |

## Action map: Surat Perintah Kerja

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [SPKList](<../../Design Artifact/spk/SPKList.html#SPKList>) | Create SPK | C-11 | FLW-PLN-01 |
| [SPKList](<../../Design Artifact/spk/SPKList.html#SPKList>) | Tabs (Active, My steps, Draft, Pending approval, Rejected, Completed, Cancelled, All) | C-06; Rejected rows open SPKRejected | FLW-PLN-03 |
| [SPKList](<../../Design Artifact/spk/SPKList.html#SPKList>) | Open | The user's step (C-08) or, for a draft, CreateSPK in edit mode | NAV-1 |
| [SPKList](<../../Design Artifact/spk/SPKList.html#SPKList>) | View | SPKDetail read only (C-09) | C-09 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Start from preset | Replaces the steps with the preset's (asks first when steps exist); title and category are filled only when empty | REQ-REG-003 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Save as preset / Save preset | Opens the name panel; Save preset stores the steps, roles and details (not the vehicle) as a new preset or a new version of a preset with that name | REQ-REG-003 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Module chip (drag) / Add step menu | Adds the module as a step at the drop place / at the end | REQ-SPK-017 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Move step up, Move step down, drag handle | Reorders; numbers follow | AC-REG-004 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Remove step | Removes the step at once (C-30) | C-30 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Add part, Add part to buy, Add part to check, Remove part | Edits the step's lines | REQ-SPK-017, REQ-CHK-001 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Position chips (Part Replacement) | Toggle the positions to change | REQ-PLC-001 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Cancel | C-12; a new SPK never saved leaves nothing behind | C-12 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Save draft | C-15; the SPK stays Draft in SPKList | C-15 |
| [CreateSPK](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Submit for approval | Disabled while Checks shows an error; sends to the Approvers; SPKList Pending approval | REQ-SPK-004 |
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromAlert>) | Remove, Add part | C-30 and step lines as CreateSPK | REQ-SPK-012 |
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromAlert>) | Cancel | C-12; the alert stays Pending | C-12 |
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromAlert>) | Save draft | C-15; the alert shows Draft SPK | C-15 |
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromAlert>) | Submit for approval | As CreateSPK | REQ-SPK-004 |
| [CreateSPKRevision](<../../Design Artifact/spk/ChangeRequest.html#CreateSPKRevision>) | Remove, Add part | Edit steps not yet started (DEC-85) | REQ-CR-003 |
| [CreateSPKRevision](<../../Design Artifact/spk/ChangeRequest.html#CreateSPKRevision>) | Cancel | C-12; the change request stays In\_Revision | C-12 |
| [CreateSPKRevision](<../../Design Artifact/spk/ChangeRequest.html#CreateSPKRevision>) | Save draft | C-15 | C-15 |
| [CreateSPKRevision](<../../Design Artifact/spk/ChangeRequest.html#CreateSPKRevision>) | Send revision for approval | AmendmentReview for the Approvers | FLW-PLN-06 |
| [SPKRejected](<../../Design Artifact/spk/SPKDetail.html#SPKRejected>) | Edit and resubmit | CreateSPK in edit mode | FLW-PLN-03 |
| [SPKRejected](<../../Design Artifact/spk/SPKDetail.html#SPKRejected>) | (no Cancel) | A rejected SPK returns to its creator as a Draft carrying the rejector's note; there is no cancel or un-reject on this screen, and even the rejector cannot revert the rejection. The creator edits the Draft and submits it for approval again (SM-SPK T5). Decided (DQ-06, 7.11) | DQ-06, 7.11 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | SPK document (PDF) | SPKDocument (or SPKDocumentCheck for a Part Check SPK), C-27 | REQ-SPKD-001 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Raise change request (step executor) | [ChangeRequest](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) raised by the executor of the open step when they disagree with the SPK creator's assignment design; it puts the SPK in Pending Amendment and the SPK creator (Planner or System Admin) receives and decides the amendment (SM-SPK T8 to T10, FLW-MEC-05). Only the open step's executor raises it, never the SPK creator. Decided (DQ-07, 7.11) | REQ-CR-001, DQ-07, 7.11 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Cancel SPK | CancelSPK (Supervisor, GM, System Admin only) | FLW-APR-05 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Reverse issue | StockReversal (Warehouse Manager, System Admin) | FLW-WHM-02 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Open step | The step screen | NAV-1 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Assign / Reassign | Assign step dialog: pick an active user of the step's executor roles; Reassign also needs a reason; the user is notified | FLW-PLN-09, \[New\] dialog |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Correct time (System Admin, on a step's time line) | Correct step time dialog: event, new time, reason → Save; writes step\_time\_corrections and the audit log | REQ-ENG-014, \[New\] dialog |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>) | SPK document (PDF) | C-27 | REQ-SPKD-001 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>) | Reverse issue | [StockReversal](<../../Design Artifact/steps/Stock.html#StockReversal>) | FLW-WHM-02 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>) | Verify | StepVerify (PartCheckVerify for Part Check) | FLW-PLN-05 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>) | Return | StepVerify with the note field focused | FLW-PLN-05 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>) | Request completion approval | Disabled with the reason until every step is Verified or Skipped; sends to CompletionReview | FLW-PLN-07 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Return to executor | Needs the note; the step becomes Open (Returned) and the executor is notified (StepReturned) | REQ-ENG-005, REQ-ENG-015 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Verify | Adds the verifier stamp; back to SPKDetailVerify | REQ-ENG-005 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Open trail on map | For a Mobilisasi step, opens the mechanic's recorded location trail and destination on an external map. The trail is recorded only while the step is In\_Progress and is scoped to the stooring verification (duration and route), visible to Planner and System Admin only, with every access logged; it is not continuous or deliberate employee tracking outside the step (DEC-90, REQ-MBL-005, RSK-09). Decided (DQ-08, 7.11) | DQ-08, 7.11 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Thumbnails | C-29 | C-29 |
| [StepLocked](<../../Design Artifact/spk/SPKDetail.html#StepLocked>) | Back to SPK | C-28 | NAV-1 |
| [StepReturned](<../../Design Artifact/spk/SPKDetail.html#StepReturned>) | Pause | C-21 | C-21 |
| [StepReturned](<../../Design Artifact/spk/SPKDetail.html#StepReturned>) | Internal team / External workshop | Switches the team as in Mechanic | REQ-MEC-003 |
| [StepReturned](<../../Design Artifact/spk/SPKDetail.html#StepReturned>) | Save draft | C-15 | C-15 |
| [StepReturned](<../../Design Artifact/spk/SPKDetail.html#StepReturned>) | Submit step again | C-18 | REQ-ENG-005 |
| [CancelSPK](<../../Design Artifact/components/Dialogs.html#CancelSPK>) | SPK document (PDF) | C-27 | C-27 |
| [CancelSPK](<../../Design Artifact/components/Dialogs.html#CancelSPK>) | Cancel SPK | Needs the reason; reverses posted issues, returns Issued tyres to In Stock, notifies the creator and executors; SPKList Cancelled | REQ-SPK-008 |
| [CancelSPK](<../../Design Artifact/components/Dialogs.html#CancelSPK>) | Keep the SPK | C-14 | C-14 |
| [ChangeRequest](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) | Cancel | C-12 | C-12 |
| [ChangeRequest](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) | Submit request | Needs the reason and the requested change; the SPK becomes Pending\_Amendment; the step pauses with reason Change request | REQ-CR-001, REQ-ENG-013 |
| [SPKDocument](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) | Print, Download PDF | C-27 | C-27 |
| [SPKDocumentCheck](<../../Design Artifact/spk/SPKDocument.html#SPKDocumentCheck>) | Print, Download PDF | C-27 | C-27 |
| [SPKDocumentCheck](<../../Design Artifact/spk/SPKDocument.html#SPKDocumentCheck>) | Follow-up SPK number | Opens SPKDetail of the follow-up SPK when the reader may see it; prints as text | REQ-CHK-006 |
| [FCRequests](<../../Design Artifact/spk/Requests.html#FCRequests>) | Create SPK | FCCreateSPK (Manual\_Field\_Coordinator) | FLW-FC-04 |
| [FCRequests](<../../Design Artifact/spk/Requests.html#FCRequests>) | Tabs | C-06 | C-06 |
| [FCRequests](<../../Design Artifact/spk/Requests.html#FCRequests>) | Open | Selects the draft in the right panel | NAV-3 |
| [FCRequests](<../../Design Artifact/spk/Requests.html#FCRequests>) | Complete and send to Planner | [FCCreateSPK](<../../Design Artifact/spk/CreateSPK.html#FCCreateSPK>) for that draft; the Field Coordinator completes it and sends it to the Planner, who submits it for approval (REQ-SPK-016). The control is labelled "Complete and send to Planner", never "submit". Decided (DQ-10, 7.11) | REQ-SPK-016, DQ-10, 7.11 |
| [FCRequests](<../../Design Artifact/spk/Requests.html#FCRequests>) | Cancel draft | Opens [FCDraftCancel](<../../Design Artifact/components/Dialogs.html#FCDraftCancel>): reason → the draft is Cancelled, the reporter is notified, the report stays in the vehicle history. Decided (DQ-11, 7.11) | DQ-11, 7.11 |
| [FCCreateSPK](<../../Design Artifact/spk/CreateSPK.html#FCCreateSPK>) | Remove, Add part | Edits Parts needed | REQ-SPK-016 |
| [FCCreateSPK](<../../Design Artifact/spk/CreateSPK.html#FCCreateSPK>) | Cancel draft | Opens [FCDraftCancel](<../../Design Artifact/components/Dialogs.html#FCDraftCancel>), as FCRequests. Decided (DQ-11, 7.11) | DQ-11, 7.11 |
| [FCCreateSPK](<../../Design Artifact/spk/CreateSPK.html#FCCreateSPK>) | Save draft | C-15 | C-15 |
| [FCCreateSPK](<../../Design Artifact/spk/CreateSPK.html#FCCreateSPK>) | Send to Planner | Sends the draft; the Planner adds the steps | REQ-SPK-016 |

## Action map: Step screens

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Pause | C-21 | C-21 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Confirm shortfall | Confirms the missing quantity; adds a Part Purchase step right after this one with those lines and alerts the Field Coordinators | REQ-PUR-008 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Raise change request | C-23 | C-23 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Save draft | C-15 | C-15 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Submit step and post Goods Issue | C-18, posts the Goods Issue (stock down, tyres Issued, cost on the SPK) | REQ-STK-005 |
| [StockReversal](<../../Design Artifact/steps/Stock.html#StockReversal>) | Cancel | C-12 | C-12 |
| [StockReversal](<../../Design Artifact/steps/Stock.html#StockReversal>) | Submit reversal | Needs the lines, quantities and a reason; waits for a Planner or System Admin to verify | REQ-STK-008 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Resume | C-22 | C-22 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Photo | Adds a receipt photo (camera or file) | REQ-PUR-004 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Raise change request | C-23 | C-23 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Submit with no lines and a reason | Opens Nothing bought? dialog: reason → Submit step | REQ-PUR-007, \[New\] dialog |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Save draft | C-15 | C-15 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Submit step · total | C-18; adds the total to parts cost | REQ-PUR-006 |
| [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | I started earlier | C-20 | C-20 |
| [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | Start work | C-19 | C-19 |
| [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | Internal team / External workshop | Switches the form; External opens the MechanicExternal layout; lines of the other team are cleared after Switch team? (Switch, Keep) | REQ-MEC-003, \[New\] confirm |
| [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | Add service | Opens the catalog picker (search code or name, active services only, fixed price) → adds a line | REQ-MEC-001, \[New\] picker |
| [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | Save draft | C-15 | C-15 |
| [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | Submit step | C-18; needs at least one repair photo | REQ-MEC-002 |
| [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | Release step | Release step dialog: reason → the step is unassigned, its draft stays | FLW-PLN-09, \[New\] dialog |
| [MechanicExternal](<../../Design Artifact/steps/MechanicAction.html#MechanicExternal>) | Pause | C-21 | C-21 |
| [MechanicExternal](<../../Design Artifact/steps/MechanicAction.html#MechanicExternal>) | Internal team / External workshop | As Mechanic | REQ-MEC-003 |
| [MechanicExternal](<../../Design Artifact/steps/MechanicAction.html#MechanicExternal>) | Save draft | C-15 | C-15 |
| [MechanicExternal](<../../Design Artifact/steps/MechanicAction.html#MechanicExternal>) | Submit step | C-18; needs vendor, price and the invoice image | REQ-MEC-003 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Pause | C-21 | C-21 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Good / Repair / Replace | Sets the part's decision; Good clears Unsafe to drive | REQ-CHK-002 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Add (photo) | Adds a photo to that part (camera or file) | REQ-CHK-002 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Add a finding not on the list / Remove finding | Adds or removes a part marked Added by mechanic | REQ-CHK-002 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Internal team / External workshop, Add service | As Mechanic, for the check service | REQ-CHK-007 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Save draft | C-15 | C-15 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Submit step | C-18; refused until every part is complete and a service line exists | REQ-CHK-002, REQ-CHK-007 |
| [PartCheckVerify](<../../Design Artifact/steps/StepVerify.html#PartCheckVerify>) | Return with note | As StepVerify; no draft is made | REQ-CHK-003 |
| [PartCheckVerify](<../../Design Artifact/steps/StepVerify.html#PartCheckVerify>) | Verify | Stamps the step and makes the follow-up Draft SPK when a part is Repair or Replace | REQ-CHK-003 |
| [PartCheckVerify](<../../Design Artifact/steps/StepVerify.html#PartCheckVerify>) | Thumbnails | C-29 | C-29 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromCheck>) | Open SPK-2611040181 (check SPK) | SPKDetail of the check SPK | REQ-CHK-004 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromCheck>) | Edit steps in Create SPK | CreateSPK in edit mode for this draft | REQ-CHK-004 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromCheck>) | Discard draft | Needs the reason; the draft is Cancelled and keeps its link to the check; never made again | REQ-CHK-004 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromCheck>) | Activate: submit for approval | Submits for approval like CreateSPK; the activating user counts as creator for BR-03 | REQ-CHK-004, \[New\] BR-03 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Pause | C-21 | C-21 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Replace | PlacementReplace in the right panel for the selected position | FLW-MEC-03 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Rotate | PlacementRotate in the right panel | FLW-MEC-03 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Tyre on the map (tap) | Selects the position | REQ-PLC-002 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Save draft | C-15 | C-15 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Submit step | C-18 | REQ-PLC-006 |
| [PlacementReplace](<../../Design Artifact/steps/Placement.html#PlacementReplace>) | Pause | C-21 | C-21 |
| [PlacementReplace](<../../Design Artifact/steps/Placement.html#PlacementReplace>) | Cancel | C-14 (closes the panel) | C-14 |
| [PlacementReplace](<../../Design Artifact/steps/Placement.html#PlacementReplace>) | Confirm replacement | Records the change in the step draft (old tyre condition, tread, pressure); saved on Submit | REQ-PLC-003, REQ-PLC-004 |
| [PlacementRotate](<../../Design Artifact/steps/Placement.html#PlacementRotate>) | Pause | C-21 | C-21 |
| [PlacementRotate](<../../Design Artifact/steps/Placement.html#PlacementRotate>) | Cancel | C-14 | C-14 |
| [PlacementRotate](<../../Design Artifact/steps/Placement.html#PlacementRotate>) | Confirm rotation | Records the swap in the step draft | REQ-PLC-005 |
| [PlacementTrailer](<../../Design Artifact/steps/Placement.html#PlacementTrailer>) | Pause | C-21 | C-21 |
| [PlacementTrailer](<../../Design Artifact/steps/Placement.html#PlacementTrailer>) | Replace, Rotate | As Placement | FLW-MEC-03 |
| [PlacementTrailer](<../../Design Artifact/steps/Placement.html#PlacementTrailer>) | Swap with spare | Swaps the selected tyre with the spare slot (a rotation with the spare) | REQ-PLC-018, \[New\] wording |
| [PlacementTrailer](<../../Design Artifact/steps/Placement.html#PlacementTrailer>) | Save draft | C-15 | C-15 |
| [PlacementTrailer](<../../Design Artifact/steps/Placement.html#PlacementTrailer>) | Submit step | C-18 | REQ-PLC-006 |
| [DocStep](<../../Design Artifact/steps/DocStep.html#DocStep>) | Resume | C-22 | C-22 |
| [DocStep](<../../Design Artifact/steps/DocStep.html#DocStep>) | Save draft | C-15 | C-15 |
| [DocStep](<../../Design Artifact/steps/DocStep.html#DocStep>) | Submit step | C-18; needs number, dates, scan, cost, receipt when required | REQ-DOC-007 |

## Action map: Approvals and schedule

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>) | Tabs Surat Perintah Kerja, Warehouse, History | C-06 | C-06 |
| [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>) | Type chips | Filter the list | C-33 |
| [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>) | Open review | C-10 for the selected item | FLW-APR-01 |
| [ApprovalsWarehouse](<../../Design Artifact/approvals/Approvals.html#ApprovalsWarehouse>) | Tabs Surat Perintah Kerja, Warehouse, History | C-06 | C-06 |
| [ApprovalsWarehouse](<../../Design Artifact/approvals/Approvals.html#ApprovalsWarehouse>) | Type chips | Filter the list | C-33 |
| [ApprovalsWarehouse](<../../Design Artifact/approvals/Approvals.html#ApprovalsWarehouse>) | Open review | C-10 for the selected item | FLW-APR-01 |
| [ApprovalsHistory](<../../Design Artifact/approvals/Approvals.html#ApprovalsHistory>) | Tabs Surat Perintah Kerja, Warehouse, History | C-06 | C-06 |
| [ApprovalsHistory](<../../Design Artifact/approvals/Approvals.html#ApprovalsHistory>) | Type chips | Filter the list | C-33 |
| [ApprovalsHistory](<../../Design Artifact/approvals/Approvals.html#ApprovalsHistory>) | Open SPK | SPKDetail read only | FLW-APR-06 |
| [ApprovalReview](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>) | Reject | C-25 | C-25 |
| [ApprovalReview](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>) | Approve | C-24; the SPK becomes Active and step 1 opens | FLW-APR-01 |
| [AmendmentReview](<../../Design Artifact/approvals/ApprovalReview.html#AmendmentReview>) | Reject | C-25; the original content stays | FLW-APR-02 |
| [AmendmentReview](<../../Design Artifact/approvals/ApprovalReview.html#AmendmentReview>) | Approve revision | C-24; amendment number +1, the step resumes | FLW-APR-02 |
| [CompletionReview](<../../Design Artifact/approvals/ApprovalReview.html#CompletionReview>) | Open SPK document | SPKDocument (Not final) | C-27 |
| [CompletionReview](<../../Design Artifact/approvals/ApprovalReview.html#CompletionReview>) | Reject | C-25; SPK stays Pending\_Verification | FLW-APR-03 |
| [CompletionReview](<../../Design Artifact/approvals/ApprovalReview.html#CompletionReview>) | Approve completion | C-24; SPK Completed, vehicle status recalculated | FLW-APR-03 |
| [StockOpnameApproval](<../../Design Artifact/approvals/ApprovalReview.html#StockOpnameApproval>) | Reject | C-25; back to Draft, marked Returned | FLW-APR-04 |
| [StockOpnameApproval](<../../Design Artifact/approvals/ApprovalReview.html#StockOpnameApproval>) | Approve adjustment | C-24; stock adjusted | FLW-APR-04 |
| [TyreCountApproval](<../../Design Artifact/approvals/ApprovalReview.html#TyreCountApproval>) | Reject | C-25 | FLW-APR-04 |
| [TyreCountApproval](<../../Design Artifact/approvals/ApprovalReview.html#TyreCountApproval>) | Approve count | C-24; missing tyres become Lost | FLW-APR-04 |
| [MaintenanceSchedule](<../../Design Artifact/schedule/Schedule.html#MaintenanceSchedule>) | ‹ ›, Today, Week/Month | Moves the period; no data change | \[New\] |
| [MaintenanceSchedule](<../../Design Artifact/schedule/Schedule.html#MaintenanceSchedule>) | Drag a card | Places or moves the SPK on a day; the Field Coordinators are alerted; the SPK never changes | REQ-SCH-001 to 004 |
| [MaintenanceSchedule](<../../Design Artifact/schedule/Schedule.html#MaintenanceSchedule>) | Card (click) | [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | C-07 |
| [ScheduleDispatcher](<../../Design Artifact/schedule/Schedule.html#ScheduleDispatcher>) | ‹ › | Moves the period | \[New\] |
| [ScheduleDispatcher](<../../Design Artifact/schedule/Schedule.html#ScheduleDispatcher>) | Card (click) | SPKDetail read only; cards cannot move | REQ-SCH-005 |

## Action map: Vehicles and documents

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Vehicle tabs (Overview, Documents, Chassis and parts, SPK history, Inspections) | C-06; each tab is its own artboard | C-06 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Add vehicle | [AddVehicle](<../../Design Artifact/fleet/VehicleForm.html#AddVehicle>) | FLW-SA-01 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Parts baseline | PartsBaseline (only while the vehicle has no baseline; then Correct baseline per part) | FLW-SA-01 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Create SPK | C-11 with the vehicle | FLW-PLN-02 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Create SPK (alert row) | C-11 from that alert | FLW-PLN-02 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Vehicle in the list | Selects it (NAV-3) | C-07 |
| [VehicleOverview](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As Vehicles; Edit vehicle → [VehicleEdit](<../../Design Artifact/fleet/VehicleForm.html#VehicleEdit>) | FLW-SA-03 |
| [VehicleOverview](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) | Record reading | [VehicleOdometer](<../../Design Artifact/fleet/Vehicle.html#VehicleOdometer>) | FLW-SA-03 |
| [VehicleOverview](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) | Odometer history | VehicleOdometer scrolled to the readings list, with Void per reading | FLW-SA-03, \[New\] |
| [VehicleOverview](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) | Change (driver) | Change driver dialog: pick an active driver (or none) → Save; both drivers are notified | REQ-VEH-010, \[New\] dialog |
| [VehicleDocuments](<../../Design Artifact/fleet/Vehicle.html#VehicleDocuments>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As VehicleOverview | C-06 |
| [VehicleDocuments](<../../Design Artifact/fleet/Vehicle.html#VehicleDocuments>) | Add document | AddDocument for that type | FLW-SA-02 |
| [VehicleDocuments](<../../Design Artifact/fleet/Vehicle.html#VehicleDocuments>) | View scan | [DocumentScan](<../../Design Artifact/documents/Documents.html#DocumentScan>) | FLW-SA-02 |
| [VehicleDocuments](<../../Design Artifact/fleet/Vehicle.html#VehicleDocuments>) | Open SPK | SPKDetail of the renewal SPK | NAV-5 |
| [VehicleDocuments](<../../Design Artifact/fleet/Vehicle.html#VehicleDocuments>) | Correct entry | DocumentCorrectEntry (only before the first renewal) | REQ-DOC-011 |
| [VehicleSPKHistory](<../../Design Artifact/fleet/Vehicle.html#VehicleSPKHistory>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As VehicleOverview | C-06 |
| [VehicleSPKHistory](<../../Design Artifact/fleet/Vehicle.html#VehicleSPKHistory>) | Row (click) | [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | C-07 |
| [VehicleSPKHistory](<../../Design Artifact/fleet/Vehicle.html#VehicleSPKHistory>) | Document | SPKDocument of that SPK | REQ-SPKD-001 |
| [VehicleInspections](<../../Design Artifact/fleet/Vehicle.html#VehicleInspections>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As VehicleOverview | C-06 |
| [VehicleInspections](<../../Design Artifact/fleet/Vehicle.html#VehicleInspections>) | Report breakdown | [AdminBreakdownForm](<../../Design Artifact/fleet/FieldReports.html#AdminBreakdownForm>) | FLW-SA-04 |
| [VehicleInspections](<../../Design Artifact/fleet/Vehicle.html#VehicleInspections>) | Record inspection | [AdminInspectionForm](<../../Design Artifact/fleet/FieldReports.html#AdminInspectionForm>) | FLW-SA-04 |
| [BaselineCorrect](<../../Design Artifact/fleet/PartsBaseline.html#BaselineCorrect>) | Vehicle tabs, Add vehicle | As Vehicles | C-06 |
| [BaselineCorrect](<../../Design Artifact/fleet/PartsBaseline.html#BaselineCorrect>) | Correct baseline | Opens this side panel | REQ-BSL-005 |
| [BaselineCorrect](<../../Design Artifact/fleet/PartsBaseline.html#BaselineCorrect>) | Cancel | C-14 | C-14 |
| [BaselineCorrect](<../../Design Artifact/fleet/PartsBaseline.html#BaselineCorrect>) | Save correction | Needs a reason; refused once an SPK touched the part | REQ-BSL-005 |
| [VehicleDeactivate](<../../Design Artifact/fleet/VehicleForm.html#VehicleDeactivate>) | Vehicle tabs, Add vehicle | As Vehicles | C-06 |
| [VehicleDeactivate](<../../Design Artifact/fleet/VehicleForm.html#VehicleDeactivate>) | Cancel | C-14 | C-14 |
| [VehicleDeactivate](<../../Design Artifact/fleet/VehicleForm.html#VehicleDeactivate>) | Deactivate vehicle | Refused while an SPK is open; needs a reason; the vehicle becomes Inactive | REQ-VEH-008 |
| [AddVehicle](<../../Design Artifact/fleet/VehicleForm.html#AddVehicle>) | Upload (document scan) | Adds the scan for that document row (FileDrop) | REQ-DOC-008 |
| [AddVehicle](<../../Design Artifact/fleet/VehicleForm.html#AddVehicle>) | Cancel | C-12 | C-12 |
| [AddVehicle](<../../Design Artifact/fleet/VehicleForm.html#AddVehicle>) | Save and add parts | Saves the vehicle (Active, or Blocked when a required document is missing) → [PartsBaseline](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | FLW-SA-01 |
| [VehicleEdit](<../../Design Artifact/fleet/VehicleForm.html#VehicleEdit>) | Deactivate vehicle | [VehicleDeactivate](<../../Design Artifact/fleet/VehicleForm.html#VehicleDeactivate>) | FLW-SA-03 |
| [VehicleEdit](<../../Design Artifact/fleet/VehicleForm.html#VehicleEdit>) | Cancel | C-12 | C-12 |
| [VehicleEdit](<../../Design Artifact/fleet/VehicleForm.html#VehicleEdit>) | Save changes | Class and layout only while no tyre is mounted and no SPK is open | REQ-VEH-003 |
| [VehicleOdometer](<../../Design Artifact/fleet/Vehicle.html#VehicleOdometer>) | Back to vehicle | C-28 | C-28 |
| [VehicleOdometer](<../../Design Artifact/fleet/Vehicle.html#VehicleOdometer>) | Cancel | C-12 | C-12 |
| [VehicleOdometer](<../../Design Artifact/fleet/Vehicle.html#VehicleOdometer>) | Save reading | Refused below the last reading; warns above 1.500 km a day | REQ-VEH-005 |
| [OdometerVoid](<../../Design Artifact/fleet/Vehicle.html#OdometerVoid>) | Back to vehicle | C-28 | C-28 |
| [OdometerVoid](<../../Design Artifact/fleet/Vehicle.html#OdometerVoid>) | Void | Opens the void dialog for that reading | REQ-VEH-006 |
| [OdometerVoid](<../../Design Artifact/fleet/Vehicle.html#OdometerVoid>) | Keep reading | C-14 | C-14 |
| [OdometerVoid](<../../Design Artifact/fleet/Vehicle.html#OdometerVoid>) | Void reading | Needs a reason; the reading is kept but voided; PM due recalculated | REQ-VEH-006 |
| [PartsBaseline](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | Skip for now | Leaves without a baseline; the vehicle shows No baseline on DashboardAdmin | REQ-BSL-001 |
| [PartsBaseline](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | Save baseline | Saves tyres and part items; the next due dates are computed | REQ-BSL-002 |
| [AdminInspectionForm](<../../Design Artifact/fleet/FieldReports.html#AdminInspectionForm>) | Cancel | C-12 | C-12 |
| [AdminInspectionForm](<../../Design Artifact/fleet/FieldReports.html#AdminInspectionForm>) | Save inspection | A Fail needs photo and description and drafts an SPK | REQ-PM-004 |
| [AdminInspectionForm](<../../Design Artifact/fleet/FieldReports.html#AdminInspectionForm>) | checklist-1024.jpg | C-29 | C-29 |
| [AdminBreakdownForm](<../../Design Artifact/fleet/FieldReports.html#AdminBreakdownForm>) | Cancel | C-12 | C-12 |
| [AdminBreakdownForm](<../../Design Artifact/fleet/FieldReports.html#AdminBreakdownForm>) | Send breakdown report | Drafts an SPK with source Driver\_Breakdown | REQ-PM-005 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Create SPK | C-11 for a document in Warning or Expired with no open renewal SPK | FLW-SA-02 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Add (Missing cell) | AddDocument for that vehicle and type | FLW-SA-02 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Open SPK-… | SPKDetail of the renewal SPK | NAV-5 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | View scan | [DocumentScan](<../../Design Artifact/documents/Documents.html#DocumentScan>) | FLW-SA-02 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Matrix cell | Selects it (NAV-3) | C-07 |
| [AddDocument](<../../Design Artifact/documents/DocumentForm.html#AddDocument>) | Cancel | C-12 | C-12 |
| [AddDocument](<../../Design Artifact/documents/DocumentForm.html#AddDocument>) | Save and add another | Saves and clears the form for the next document of the same vehicle | REQ-DOC-006 |
| [AddDocument](<../../Design Artifact/documents/DocumentForm.html#AddDocument>) | Save document | Saves; back to the page it came from | REQ-DOC-006 |
| [DocumentScan](<../../Design Artifact/documents/Documents.html#DocumentScan>) | Download | Saves the file; written to document\_view\_logs | REQ-DOC-009 |
| [DocumentScan](<../../Design Artifact/documents/Documents.html#DocumentScan>) | Back | C-28 | C-28 |
| [DocumentScan](<../../Design Artifact/documents/Documents.html#DocumentScan>) | ‹ › Zoom out 100% Zoom in Rotate | View only | REQ-FUP-016 |
| [DocumentCorrectEntry](<../../Design Artifact/documents/DocumentForm.html#DocumentCorrectEntry>) | Replace scan | Picks a new scan for the correction | REQ-DOC-011 |
| [DocumentCorrectEntry](<../../Design Artifact/documents/DocumentForm.html#DocumentCorrectEntry>) | Cancel | C-12 | C-12 |
| [DocumentCorrectEntry](<../../Design Artifact/documents/DocumentForm.html#DocumentCorrectEntry>) | Save correction | Needs a reason; logged | REQ-DOC-011 |
| [DocumentTypes](<../../Design Artifact/settings/MasterData.html#DocumentTypes>) | New document type | C-31 | C-31 |
| [DocumentTypes](<../../Design Artifact/settings/MasterData.html#DocumentTypes>) | Discard changes | C-16 | C-16 |
| [DocumentTypes](<../../Design Artifact/settings/MasterData.html#DocumentTypes>) | Save | C-17 | REQ-DOC-002 |

## Action map: Inventory and tyres

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>), [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceipts>), [StockCard](<../../Design Artifact/inventory/Inventory.html#StockCard>), [StockCardExport](<../../Design Artifact/inventory/Inventory.html#StockCardExport>), [StockOpname](<../../Design Artifact/inventory/StockOpname.html#StockOpname>), [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>), [RetreadList](<../../Design Artifact/inventory/Retread.html#RetreadList>), [TyreCount](<../../Design Artifact/inventory/Tyres.html#TyreCount>), [TyreColumns](<../../Design Artifact/inventory/Tyres.html#TyreColumns>), [TyreWornOut](<../../Design Artifact/inventory/Tyres.html#TyreWornOut>), [TyreScrap](<../../Design Artifact/inventory/Tyres.html#TyreScrap>) | Parts / Tyres | Switches the Inventory mode; remembered per user | NAV-7 |
| Same screens | Tabs (Stock, Goods Receipts, Stock card, Stock opname; Tyres, Retread, Tyre count) | C-06 | C-06 |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>), [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceipts>) | Add part | [AddPart](<../../Design Artifact/inventory/PartForm.html#AddPart>) | FLW-WHM-04 |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>), [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceipts>) | Goods Receipt | [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>) | FLW-WHM-03 |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>) | Stock row | Selects the part; the stock card on the right follows; the part name opens PartDetail | NAV-3, \[New\] |
| [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceipts>) | Receipt row | [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptDetail>) | FLW-WHM-03 |
| [StockCard](<../../Design Artifact/inventory/Inventory.html#StockCard>) | Export | [StockCardExport](<../../Design Artifact/inventory/Inventory.html#StockCardExport>) | FLW-WHM-04 |
| [StockCardExport](<../../Design Artifact/inventory/Inventory.html#StockCardExport>) | Close / Cancel | C-14 | C-14 |
| [StockCardExport](<../../Design Artifact/inventory/Inventory.html#StockCardExport>) | Export | Exports the stock card for the chosen part, period and format; logged | REQ-INV-008 |
| [StockOpname](<../../Design Artifact/inventory/StockOpname.html#StockOpname>) | Save draft | C-15 | C-15 |
| [StockOpname](<../../Design Artifact/inventory/StockOpname.html#StockOpname>) | Submit for approval | Refused while a row has a variance or Missing without a reason | REQ-INV-010 |
| [StockOpnameReturned](<../../Design Artifact/inventory/StockOpname.html#StockOpnameReturned>) | Save draft | C-15 | C-15 |
| [StockOpnameReturned](<../../Design Artifact/inventory/StockOpname.html#StockOpnameReturned>) | Submit for approval again | As StockOpname | FLW-WHM-05 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>) | Add item | Adds a part line (catalog search) | REQ-INV-004 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>) | Cancel | C-12 | C-12 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>) | Save draft | C-15 | C-15 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>) | Post receipt | Stock and average cost update at once; no approval; cannot be edited after | REQ-INV-005 |
| [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptDetail>) | Back to Goods Receipts | C-28 | C-28 |
| [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptDetail>) | Print | C-27 | C-27 |
| [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptDetail>) | GR correction | GRCorrection for this receipt | FLW-WHM-03 |
| [GRCorrection](<../../Design Artifact/inventory/GoodsReceipt.html#GRCorrection>) | Cancel | C-12 | C-12 |
| [GRCorrection](<../../Design Artifact/inventory/GoodsReceipt.html#GRCorrection>) | Save draft | C-15 | C-15 |
| [GRCorrection](<../../Design Artifact/inventory/GoodsReceipt.html#GRCorrection>) | Post correction | Needs a reason; linked to the original receipt | REQ-INV-006 |
| [GRCorrection](<../../Design Artifact/inventory/GoodsReceipt.html#GRCorrection>) | INV-7781-rev.jpg | C-29 | C-29 |
| [AddPart](<../../Design Artifact/inventory/PartForm.html#AddPart>) | Cancel | C-12 | C-12 |
| [AddPart](<../../Design Artifact/inventory/PartForm.html#AddPart>) | Save part | Creates the part; SKU unique | REQ-INV-002 |
| [PartDetail](<../../Design Artifact/inventory/Inventory.html#PartDetail>) | Back to stock | C-28 | C-28 |
| [PartDetail](<../../Design Artifact/inventory/Inventory.html#PartDetail>) | Open stock card | StockCard for this part | REQ-INV-007 |
| [PartDetail](<../../Design Artifact/inventory/Inventory.html#PartDetail>) | Edit part | [PartEdit](<../../Design Artifact/inventory/PartForm.html#PartEdit>) | FLW-WHM-04 |
| [PartEdit](<../../Design Artifact/inventory/PartForm.html#PartEdit>) | Deactivate part | PartDeactivate (only at quantity 0) | REQ-INV-003 |
| [PartEdit](<../../Design Artifact/inventory/PartForm.html#PartEdit>) | Cancel | C-12 | C-12 |
| [PartEdit](<../../Design Artifact/inventory/PartForm.html#PartEdit>) | Save changes | Quantity and average cost are never editable here | REQ-INV-002 |
| [PartDeactivate](<../../Design Artifact/inventory/Inventory.html#PartDeactivate>) | Cancel | C-14 | C-14 |
| [PartDeactivate](<../../Design Artifact/inventory/Inventory.html#PartDeactivate>) | Deactivate part | Refused when quantity is not 0 or an open SPK uses it | REQ-INV-003 |
| [OpeningBalance](<../../Design Artifact/inventory/StockOpname.html#OpeningBalance>) | Add SKU | Adds a row | REQ-INV-013 |
| [OpeningBalance](<../../Design Artifact/inventory/StockOpname.html#OpeningBalance>) | Import from spreadsheet | Uses the SetupImport flow for entity opening\_balance (template, check, import all or nothing) | REQ-IAM-011, \[New\] |
| [OpeningBalance](<../../Design Artifact/inventory/StockOpname.html#OpeningBalance>) | Save draft | C-15 | C-15 |
| [OpeningBalance](<../../Design Artifact/inventory/StockOpname.html#OpeningBalance>) | Save opening balance | Setup mode only; closed for good at go-live | REQ-INV-013 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>), [TyreColumns](<../../Design Artifact/inventory/Tyres.html#TyreColumns>), [TyreCount](<../../Design Artifact/inventory/Tyres.html#TyreCount>), [RetreadList](<../../Design Artifact/inventory/Retread.html#RetreadList>) | Receive tyres | [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | FLW-WHM-06 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>), [TyreColumns](<../../Design Artifact/inventory/Tyres.html#TyreColumns>), [TyreCount](<../../Design Artifact/inventory/Tyres.html#TyreCount>), [RetreadList](<../../Design Artifact/inventory/Retread.html#RetreadList>) | Send to retread | RetreadDispatch with the selected Needs Retread tyres | FLW-WHM-07 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Receive (open dispatch strip) | RetreadReceipt for that dispatch | FLW-WHM-07 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Columns | [TyreColumns](<../../Design Artifact/inventory/Tyres.html#TyreColumns>) | FLW-WHM-08 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Worn out | [TyreWornOut](<../../Design Artifact/inventory/Tyres.html#TyreWornOut>) | FLW-WHM-08 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Scrap | [TyreScrap](<../../Design Artifact/inventory/Tyres.html#TyreScrap>) | FLW-WHM-08 |
| [TyreColumns](<../../Design Artifact/inventory/Tyres.html#TyreColumns>) | Close | C-14 | C-14 |
| [TyreColumns](<../../Design Artifact/inventory/Tyres.html#TyreColumns>) | Reset to default | Restores the default columns in the panel | REQ-TYR-010 |
| [TyreColumns](<../../Design Artifact/inventory/Tyres.html#TyreColumns>) | Apply | Saves the columns for this user | NAV-7 |
| [TyreWornOut](<../../Design Artifact/inventory/Tyres.html#TyreWornOut>) | Cancel | C-14 | C-14 |
| [TyreWornOut](<../../Design Artifact/inventory/Tyres.html#TyreWornOut>) | Confirm Worn out | Sets Worn Out with the reason | REQ-TYR-005 |
| [TyreScrap](<../../Design Artifact/inventory/Tyres.html#TyreScrap>) | Cancel | C-14 | C-14 |
| [TyreScrap](<../../Design Artifact/inventory/Tyres.html#TyreScrap>) | Scrap tyre | Final; needs a reason | REQ-TYR-005 |
| [TyreCount](<../../Design Artifact/inventory/Tyres.html#TyreCount>) | Save draft | C-15 | C-15 |
| [TyreCount](<../../Design Artifact/inventory/Tyres.html#TyreCount>) | Submit for approval | Each Missing tyre needs a reason and note | REQ-TYR-011 |
| [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | Receipt type switch | New tyres or Retread return (→ [RetreadReceipt](<../../Design Artifact/inventory/TyreReceive.html#RetreadReceipt>)) | FLW-WHM-06 |
| [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | Add tyre | Adds a row | REQ-TYR-006 |
| [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | Copy brand and size to new rows | Fills empty brand and size of new rows from the first row | \[New\] |
| [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | Cancel | C-12 | C-12 |
| [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | Save draft | C-15 | C-15 |
| [ReceiveTyres](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) | Confirm receipt | Each tyre In Stock with a generated code | REQ-TYR-006 |
| [RetreadList](<../../Design Artifact/inventory/Retread.html#RetreadList>) | Receive | RetreadReceipt for that dispatch | FLW-WHM-07 |
| [RetreadList](<../../Design Artifact/inventory/Retread.html#RetreadList>) | View | [RetreadDispatchDetail](<../../Design Artifact/inventory/Retread.html#RetreadDispatchDetail>) | FLW-WHM-07 |
| [RetreadDispatch](<../../Design Artifact/inventory/Retread.html#RetreadDispatch>) | Add tyre | Adds a Needs Retread tyre | REQ-TYR-008 |
| [RetreadDispatch](<../../Design Artifact/inventory/Retread.html#RetreadDispatch>) | Cancel | C-12 | C-12 |
| [RetreadDispatch](<../../Design Artifact/inventory/Retread.html#RetreadDispatch>) | Save draft | C-15 | C-15 |
| [RetreadDispatch](<../../Design Artifact/inventory/Retread.html#RetreadDispatch>) | Confirm dispatch | Tyres become On Retread | REQ-TYR-008 |
| [RetreadDispatchDetail](<../../Design Artifact/inventory/Retread.html#RetreadDispatchDetail>) | Back to Retread | C-28 | C-28 |
| [RetreadDispatchDetail](<../../Design Artifact/inventory/Retread.html#RetreadDispatchDetail>) | Print | C-27 (delivery note) | REQ-TYR-008 |
| [RetreadReceipt](<../../Design Artifact/inventory/TyreReceive.html#RetreadReceipt>) | Cancel | C-12 | C-12 |
| [RetreadReceipt](<../../Design Artifact/inventory/TyreReceive.html#RetreadReceipt>) | Save draft | C-15 | C-15 |
| [RetreadReceipt](<../../Design Artifact/inventory/TyreReceive.html#RetreadReceipt>) | Confirm receipt | Accepted → In Stock (retread count +1); Rejected → Scrapped; Not returned yet stays On Retread | REQ-TYR-009 |
