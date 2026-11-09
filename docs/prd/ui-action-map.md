# 7.9 Action map (DEC-90)

> Part of the BMI Stooring System spec (§7.9 action map). Core rules, roles, state machines, business rules and decisions: [PRD.md](../../PRD.md). Section numbers and IDs are unchanged from the single-file PRD v2.4.


Every control drawn in the canvas, with what it does, where it goes and the rule behind it. Build each control exactly as written here. A control that is in the canvas but not in this map, or a row marked DQ while its decision in 7.11 is open, is not built: list it as a question (7.7). \[New\] marks behaviour defined by this review; it is binding like the rest of the spec. A screen's own rows win over the common controls.

## Common controls (every screen)

| ID | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| C-01 | Sidebar item (web) | Opens the area's first page: Dashboard → the role's dashboard; Surat Perintah Kerja → [SPKList](<../../Design Artifact/spk/SPKList.html#SPKList>); Report Breakdown → [BreakdownReports](<../../Design Artifact/spk/BreakdownReports.html#BreakdownReports>); Schedule → [MaintenanceSchedule](<../../Design Artifact/schedule/MaintenanceSchedule.html#MaintenanceSchedule>) (ScheduleDispatcher for read-only roles); Approvals → [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>); Inventory → [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>) (last Parts/Tyres mode, NAV-7); Vehicles → [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>); Documents → [Documents](<../../Design Artifact/documents/Documents.html#Documents>); Reports → the first Reports tab the role may see; Settings → [Settings](<../../Design Artifact/settings/Settings.html#Settings>); Invoices → [InvoiceList](<../../Design Artifact/billing/InvoiceList.html#InvoiceList>); Customers → [Customers](<../../Design Artifact/billing/Customers.html#Customers>); Users and roles → [UsersRoles](<../../Design Artifact/access/UsersRoles.html#UsersRoles>); Audit log → [AuditLog](<../../Design Artifact/access/AuditLog.html#AuditLog>); Setup and go live → [SetupGoLive](<../../Design Artifact/setup/SetupGoLive.html#SetupGoLive>). Items shown per role as in 7.2 | 7.2, 2.2 |
| C-02 | Collapse menu | Toggles the icon rail (AppShellCollapsed); saved per user; no navigation | DEC-82 |
| C-03 | Bell in the page header | Opens NotificationCenter as a panel over the current page; the badge shows the unread count | REQ-NTF-001, DQ-01 |
| C-04 | User and role in the page header | Opens the user menu: Change password (ChangePassword), Notification settings (P1), Sign out (ends the session, back to WebLogin; a dirty form asks first, C-13) | \[New\], DQ-01 |
| C-05 | Mobile bottom bar item | Driver: Home → [DashboardDriver](<../../Design Artifact/mobile/DashboardDriver.html#DashboardDriver>), Inspection → [MobileInspection](<../../Design Artifact/mobile/MobileInspection.html#MobileInspection>), History → [DriverHistory](<../../Design Artifact/mobile/DriverHistory.html#DriverHistory>), Profile → MobileProfile. Field Coordinator: Fleet → [DispatcherMobileFleet](<../../Design Artifact/mobile/DispatcherMobileFleet.html#DispatcherMobileFleet>), Reports → [MobileReports](<../../Design Artifact/mobile/MobileReports.html#MobileReports>), Purchases → [FCMobilePurchase](<../../Design Artifact/mobile/FCMobilePurchase.html#FCMobilePurchase>) list, Schedule → [DispatcherMobileSchedule](<../../Design Artifact/mobile/DispatcherMobileSchedule.html#DispatcherMobileSchedule>), Alerts → [DispatcherMobileAlerts](<../../Design Artifact/mobile/DispatcherMobileAlerts.html#DispatcherMobileAlerts>); Profile from the header. System Admin: Reports → [MobileReports](<../../Design Artifact/mobile/MobileReports.html#MobileReports>), Purchases → [FCMobilePurchase](<../../Design Artifact/mobile/FCMobilePurchase.html#FCMobilePurchase>) list, Steps → [SAMobileHome](<../../Design Artifact/mobile/SAMobileHome.html#SAMobileHome>) (open steps), Profile → MobileProfile. Mechanic (P1): My steps → [MechanicMobileHome](<../../Design Artifact/mobile/MechanicMobileHome.html#MechanicMobileHome>), Report → [MobileReportBreakdown](<../../Design Artifact/mobile/MobileReportBreakdown.html#MobileReportBreakdown>), Inspection → [MobileInspection](<../../Design Artifact/mobile/MobileInspection.html#MobileInspection>), History → MechanicMobileHistory, Profile → MobileProfile. Supervisor and GM (P1): Approvals → [SupervisorMobileHome](<../../Design Artifact/mobile/SupervisorMobileHome.html#SupervisorMobileHome>), Fleet → [SupervisorMobileFleet](<../../Design Artifact/mobile/SupervisorMobileFleet.html#SupervisorMobileFleet>), History → SupervisorMobileHistory, Profile → MobileProfile | REQ-MOB-001, DQ-03, DQ-04 |
| C-06 | Tab (inside a page) | Changes the content of the same page and keeps the filters of that tab; never opens a new page; the count in the label is live | NAV-2 |
| C-07 | Row, list card or calendar card (click) | On a master-detail page selects the row and fills the right panel; on a list page opens the record's page. A row the user may only read opens it read only | NAV-3, 7.2 |
| C-08 | Open (on a row or item) | Opens the exact record named: a step → its step screen (NAV-1), an SPK → [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>), an invoice → [InvoiceDetail](<../../Design Artifact/billing/InvoiceDetail.html#InvoiceDetail>), a document → the document panel, a count → its count page | NAV-5 |
| C-09 | View (on a row) | Same as Open, read only, for a row that is not waiting for this user (no action bar) | \[New\] |
| C-10 | Review (on a dashboard item) | Opens the matching review: creation → [ApprovalReview](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>), amendment → [AmendmentReview](<../../Design Artifact/approvals/AmendmentReview.html#AmendmentReview>), completion → [CompletionReview](<../../Design Artifact/approvals/CompletionReview.html#CompletionReview>), stock opname → [StockOpnameApproval](<../../Design Artifact/approvals/StockOpnameApproval.html#StockOpnameApproval>), tyre count → [TyreCountApproval](<../../Design Artifact/approvals/TyreCountApproval.html#TyreCountApproval>), odometer void request → [OdometerVoid](<../../Design Artifact/fleet/OdometerVoid.html#OdometerVoid>) in review mode, a part-check draft → [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | NAV-5 |
| C-11 | Create SPK / Create SPK | From a header: CreateSPK blank. From an alert row: CreateSPKFromAlert with vehicle, source and the alert rule's preset. From a vehicle: CreateSPK with the vehicle. Only roles that may create an SPK see it (Planner, System Admin); the field roles have Report breakdown instead | REQ-SPK-012, FLW-PLN-02 |
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
| C-22 | Resume ([StepPaused](<../../Design Artifact/steps/StepPaused.html#StepPaused>)) | Ends the pause at once (no dialog) and unlocks the form | REQ-ENG-013 |
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
| [WebLogin](<../../Design Artifact/shell/WebLogin.html#WebLogin>) | Sign in | Checks email and password; 5 wrong tries lock the account (unlock by the Access Manager); first sign-in → [ChangePassword](<../../Design Artifact/shell/ChangePassword.html#ChangePassword>); then the role's dashboard (Access Manager → [UsersRoles](<../../Design Artifact/access/UsersRoles.html#UsersRoles>); System Admin in Setup mode → [SetupGoLive](<../../Design Artifact/setup/SetupGoLive.html#SetupGoLive>)) | REQ-IAM-001 |
| [WebLogin](<../../Design Artifact/shell/WebLogin.html#WebLogin>) | Forgot password? | Sends a password reset link to the account's email; the link opens a reset page and expires after a set time. Decided (DQ-02, 7.11) | DQ-02, 7.11 |
| [MobileLogin](<../../Design Artifact/mobile/MobileLogin.html#MobileLogin>) | Sign in | As WebLogin; then the role's mobile home (C-05). A role with no mobile menu sees Use the web app | REQ-MOB-001 |
| [ChangePassword](<../../Design Artifact/shell/ChangePassword.html#ChangePassword>) | Save and continue | Checks the current and new password (rules of REQ-IAM-001); then the role's dashboard | REQ-IAM-001 |
| [NotificationCenter](<../../Design Artifact/shell/NotificationCenter.html#NotificationCenter>) | Mark all read | Marks every notice of this user read; no navigation | \[New\] |
| [NotificationCenter](<../../Design Artifact/shell/NotificationCenter.html#NotificationCenter>) | Notice (click) | Marks it read and opens the record it names | REQ-NTF-001, NAV-5 |
| [NotificationCenter](<../../Design Artifact/shell/NotificationCenter.html#NotificationCenter>) | Filter tabs (All, Approvals, Steps, Alerts, Schedule) | C-06 | C-06 |
| [AppShellCollapsed](<../../Design Artifact/shell/AppShellCollapsed.html#AppShellCollapsed>) | Review | C-10 | C-10 |
| [PhotoViewer](<../../Design Artifact/components/PhotoViewer.html#PhotoViewer>) | Zoom, 100%, ‹ › | View only | REQ-FUP-016 |
| [PhotoViewer](<../../Design Artifact/components/PhotoViewer.html#PhotoViewer>) | Close | C-14 | C-14 |
| [FileUploadStates](<../../Design Artifact/components/FileUploadStates.html#FileUploadStates>) | Remove | Removes the file from the slot | REQ-FUP-007 |
| [FileUploadStates](<../../Design Artifact/components/FileUploadStates.html#FileUploadStates>) | Save draft | C-15 | C-15 |
| [FileUploadStates](<../../Design Artifact/components/FileUploadStates.html#FileUploadStates>) | Sending when photos finish… | C-18 while files upload; submits by itself when all are Ready | REQ-FUP-012 |
| [Main](<../../Design Artifact/index.html#Main>) | (none) | Canvas overview only; not built | 7.3 |

## Action map: Dashboards

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Review | C-10 | C-10 |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Step time report | Opens ReportsStepTime (Step time tab) for the last 30 days | REQ-DSH-010 |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | View (bottleneck row) | Opens ReportsStepTime filtered to open steps whose phase is Waiting for verification over 8 hours | REQ-DSH-010, \[New\] |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Vehicle row, early failure row | Vehicle → [VehicleOverview](<../../Design Artifact/fleet/VehicleOverview.html#VehicleOverview>); early failure → the SPK's ApprovalReview read only | NAV-5 |
| [Dashboard](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Invoices rows | InvoiceList on the Issued tab (Overdue row adds the overdue filter) | \[New\] |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Create SPK | C-11 (CreateSPK blank) | FLW-PLN-01 |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Verify | SPKDetailVerify of that SPK, scrolled to the step | FLW-PLN-05 |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Revise | CreateSPKRevision of the change request | FLW-PLN-06 |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Request | SPKDetailVerify with the Completion card | FLW-PLN-07 |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Open (draft row) | CreateSPK in edit mode for that draft | FLW-PLN-02 |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Review (part-check draft) | [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | REQ-CHK-004 |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Create SPK (alert row) | C-11 from an alert | FLW-PLN-02 |
| [DashboardPlanner](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Summary cards | Each opens SPKList on the matching tab, or the schedule for Not on the schedule | \[New\] |
| [DashboardMechanic](<../../Design Artifact/dashboard/DashboardMechanic.html#DashboardMechanic>) | Report breakdown | [ReportBreakdownForm](<../../Design Artifact/spk/ReportBreakdownForm.html#ReportBreakdownForm>) | FLW-MEC-10 |
| [DashboardMechanic](<../../Design Artifact/dashboard/DashboardMechanic.html#DashboardMechanic>) | Open | The step screen (C-08) | FLW-MEC-01 |
| [DashboardMechanic](<../../Design Artifact/dashboard/DashboardMechanic.html#DashboardMechanic>) | View (locked step) | [StepLocked](<../../Design Artifact/spk/StepLocked.html#StepLocked>) | REQ-ENG-008 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/DashboardWarehouse.html#DashboardWarehouse>) | Goods Receipt | [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | FLW-WHM-03 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/DashboardWarehouse.html#DashboardWarehouse>) | Receive tyres | [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | FLW-WHM-06 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/DashboardWarehouse.html#DashboardWarehouse>) | Open | The Stock step, StockOpnameReturned or the item named | C-08 |
| [DashboardWarehouse](<../../Design Artifact/dashboard/DashboardWarehouse.html#DashboardWarehouse>) | Receive (dispatch row) | RetreadReceipt for that dispatch | FLW-WHM-07 |
| [DashboardAdmin](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Add vehicle | [AddVehicle](<../../Design Artifact/fleet/AddVehicle.html#AddVehicle>) | FLW-SA-01 |
| [DashboardAdmin](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Add document | AddDocument for that vehicle and type | FLW-SA-02 |
| [DashboardAdmin](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Open | C-08 | C-08 |
| [DashboardAdmin](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Review | C-10 (self-approval shows Self-approved) | C-10 |
| [DashboardAdmin](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Parts baseline | PartsBaseline for that vehicle | FLW-SA-01 |
| [DashboardAdmin](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Manage (master data row) | The matching Settings page (DocumentTypes, ChassisLayouts, …) | NAV-6 |
| [DashboardAdmin](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Integrations rows | Show each integration's status; a row opens `SettingsIntegrations`, where the System Admin connects WhatsApp, the Protrack/Cartrack odometer API and other external tools (credentials, enable/disable, connection test). Decided (DQ-05, 7.11) | DQ-05, 7.11, REQ-AI-002 |
| [DashboardDispatcher](<../../Design Artifact/dashboard/DashboardDispatcher.html#DashboardDispatcher>) | Report breakdown | [ReportBreakdownForm](<../../Design Artifact/spk/ReportBreakdownForm.html#ReportBreakdownForm>) | FLW-FC-04 |
| [DashboardDispatcher](<../../Design Artifact/dashboard/DashboardDispatcher.html#DashboardDispatcher>) | Open reports | [BreakdownReports](<../../Design Artifact/spk/BreakdownReports.html#BreakdownReports>) | FLW-FC-04 |
| [DashboardDispatcher](<../../Design Artifact/dashboard/DashboardDispatcher.html#DashboardDispatcher>) | Not available row | VehicleOverview read only | FLW-FC-01 |
| [DashboardAccounting](<../../Design Artifact/dashboard/DashboardAccounting.html#DashboardAccounting>) | Open | InvoiceDetail of that invoice | FLW-ACC-01 |
| [DashboardAccounting](<../../Design Artifact/dashboard/DashboardAccounting.html#DashboardAccounting>) | Summary cards | InvoiceList on the matching tab | \[New\] |
| [DashboardDriver](<../../Design Artifact/mobile/DashboardDriver.html#DashboardDriver>) | Start daily inspection | [MobileInspection](<../../Design Artifact/mobile/MobileInspection.html#MobileInspection>) | FLW-DRV-01 |
| [DashboardDriver](<../../Design Artifact/mobile/DashboardDriver.html#DashboardDriver>) | Record odometer | [DriverOdometer](<../../Design Artifact/mobile/DriverOdometer.html#DriverOdometer>) | FLW-DRV-03 |
| [DashboardDriver](<../../Design Artifact/mobile/DashboardDriver.html#DashboardDriver>) | Report breakdown | [MobileReportBreakdown](<../../Design Artifact/mobile/MobileReportBreakdown.html#MobileReportBreakdown>) | FLW-DRV-02 |

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
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPKFromAlert.html#CreateSPKFromAlert>) | Remove, Add part | C-30 and step lines as CreateSPK | REQ-SPK-012 |
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPKFromAlert.html#CreateSPKFromAlert>) | Cancel | C-12; the alert stays Pending | C-12 |
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPKFromAlert.html#CreateSPKFromAlert>) | Save draft | C-15; the alert shows Draft SPK | C-15 |
| [CreateSPKFromAlert](<../../Design Artifact/spk/CreateSPKFromAlert.html#CreateSPKFromAlert>) | Submit for approval | As CreateSPK | REQ-SPK-004 |
| [CreateSPKRevision](<../../Design Artifact/spk/CreateSPKRevision.html#CreateSPKRevision>) | Remove, Add part | Edit steps not yet started (DEC-85) | REQ-CR-003 |
| [CreateSPKRevision](<../../Design Artifact/spk/CreateSPKRevision.html#CreateSPKRevision>) | Cancel | C-12; the change request stays In\_Revision | C-12 |
| [CreateSPKRevision](<../../Design Artifact/spk/CreateSPKRevision.html#CreateSPKRevision>) | Save draft | C-15 | C-15 |
| [CreateSPKRevision](<../../Design Artifact/spk/CreateSPKRevision.html#CreateSPKRevision>) | Send revision for approval | AmendmentReview for the Approvers | FLW-PLN-06 |
| [SPKRejected](<../../Design Artifact/spk/SPKRejected.html#SPKRejected>) | Edit and resubmit | CreateSPK in edit mode | FLW-PLN-03 |
| [SPKRejected](<../../Design Artifact/spk/SPKRejected.html#SPKRejected>) | (no Cancel) | A rejected SPK returns to its creator as a Draft carrying the rejector's note; there is no cancel or un-reject on this screen, and even the rejector cannot revert the rejection. The creator edits the Draft and submits it for approval again (SM-SPK T5). Decided (DQ-06, 7.11) | DQ-06, 7.11 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | SPK document (PDF) | SPKDocument (or SPKDocumentCheck for a Part Check SPK), C-27 | REQ-SPKD-001 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Raise change request (step executor) | [ChangeRequest](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) raised by the executor of the open step when they disagree with the SPK creator's assignment design; it puts the SPK in Pending Amendment and the SPK creator (Planner or System Admin) receives and decides the amendment (SM-SPK T8 to T10, FLW-MEC-05). Only the open step's executor raises it, never the SPK creator. Decided (DQ-07, 7.11) | REQ-CR-001, DQ-07, 7.11 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Cancel SPK | CancelSPK (Supervisor, GM, System Admin only) | FLW-APR-05 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Reverse issue | StockReversal (Warehouse Manager, System Admin) | FLW-WHM-02 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Open step | The step screen | NAV-1 |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Assign / Reassign | Assign step dialog: pick an active user of the step's executor roles; Reassign also needs a reason; the user is notified | FLW-PLN-09, \[New\] dialog |
| [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Correct time (System Admin, on a step's time line) | Correct step time dialog: event, new time, reason → Save; writes step\_time\_corrections and the audit log | REQ-ENG-014, \[New\] dialog |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | SPK document (PDF) | C-27 | REQ-SPKD-001 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | Reverse issue | [StockReversal](<../../Design Artifact/steps/StockReversal.html#StockReversal>) | FLW-WHM-02 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | Verify | StepVerify (PartCheckVerify for Part Check) | FLW-PLN-05 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | Return | StepVerify with the note field focused | FLW-PLN-05 |
| [SPKDetailVerify](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | Request completion approval | Disabled with the reason until every step is Verified or Skipped; sends to CompletionReview | FLW-PLN-07 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Return to executor | Needs the note; the step becomes Open (Returned) and the executor is notified (StepReturned) | REQ-ENG-005, REQ-ENG-015 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Verify | Adds the verifier stamp; back to SPKDetailVerify | REQ-ENG-005 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Open trail on map | For a Mobilisasi step, opens the mechanic's recorded location trail and destination on an external map. The trail is recorded only while the step is In\_Progress and is scoped to the stooring verification (duration and route), visible to Planner and System Admin only, with every access logged; it is not continuous or deliberate employee tracking outside the step (DEC-90, REQ-MBL-005, RSK-09). Decided (DQ-08, 7.11) | DQ-08, 7.11 |
| [StepVerify](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Thumbnails | C-29 | C-29 |
| [StepLocked](<../../Design Artifact/spk/StepLocked.html#StepLocked>) | Back to SPK | C-28 | NAV-1 |
| [StepReturned](<../../Design Artifact/spk/StepReturned.html#StepReturned>) | Pause | C-21 | C-21 |
| [StepReturned](<../../Design Artifact/spk/StepReturned.html#StepReturned>) | Internal team / External workshop | Switches the team as in Mechanic | REQ-MEC-003 |
| [StepReturned](<../../Design Artifact/spk/StepReturned.html#StepReturned>) | Save draft | C-15 | C-15 |
| [StepReturned](<../../Design Artifact/spk/StepReturned.html#StepReturned>) | Submit step again | C-18 | REQ-ENG-005 |
| [CancelSPK](<../../Design Artifact/spk/CancelSPK.html#CancelSPK>) | SPK document (PDF) | C-27 | C-27 |
| [CancelSPK](<../../Design Artifact/spk/CancelSPK.html#CancelSPK>) | Cancel SPK | Needs the reason; reverses posted issues, returns Issued tyres to In Stock, notifies the creator and executors; SPKList Cancelled | REQ-SPK-008 |
| [CancelSPK](<../../Design Artifact/spk/CancelSPK.html#CancelSPK>) | Keep the SPK | C-14 | C-14 |
| [ChangeRequest](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) | Cancel | C-12 | C-12 |
| [ChangeRequest](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) | Submit request | Needs the reason and the requested change; the SPK becomes Pending\_Amendment; the step pauses with reason Change request | REQ-CR-001, REQ-ENG-013 |
| [SPKDocument](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) | Print, Download PDF | C-27 | C-27 |
| [SPKDocumentCheck](<../../Design Artifact/spk/SPKDocumentCheck.html#SPKDocumentCheck>) | Print, Download PDF | C-27 | C-27 |
| [SPKDocumentCheck](<../../Design Artifact/spk/SPKDocumentCheck.html#SPKDocumentCheck>) | Follow-up SPK number | Opens SPKDetail of the follow-up SPK when the reader may see it; prints as text | REQ-CHK-006 |
| [BreakdownReports](<../../Design Artifact/spk/BreakdownReports.html#BreakdownReports>) | Tabs | C-06 | C-06 |
| [BreakdownReports](<../../Design Artifact/spk/BreakdownReports.html#BreakdownReports>) | Open | Selects the report in the right panel | NAV-3 |
| [BreakdownReports](<../../Design Artifact/spk/BreakdownReports.html#BreakdownReports>) | Create SPK | [CreateSPKFromReport](<../../Design Artifact/spk/CreateSPKFromReport.html#CreateSPKFromReport>) for that report (the draft if the report is already Converted); Planner and System Admin only | REQ-BRK-006 |
| [BreakdownReports](<../../Design Artifact/spk/BreakdownReports.html#BreakdownReports>) | Reject | Opens [RejectReport](<../../Design Artifact/spk/RejectReport.html#RejectReport>): reason → the report is Rejected, a linked Draft SPK is Cancelled, the reporter is notified, the report stays in the vehicle history. Decided (DQ-11, 7.11) | DQ-11, 7.11 |
| [ReportBreakdownForm](<../../Design Artifact/spk/ReportBreakdownForm.html#ReportBreakdownForm>) | Cancel | C-12 | C-12 |
| [ReportBreakdownForm](<../../Design Artifact/spk/ReportBreakdownForm.html#ReportBreakdownForm>) | Send | Sends the report; an Urgent one also drafts an SPK | REQ-BRK-001, REQ-BRK-003 |
| [CreateSPKFromReport](<../../Design Artifact/spk/CreateSPKFromReport.html#CreateSPKFromReport>) | Cancel | C-12; no SPK is made and the report stays New | C-12 |
| [CreateSPKFromReport](<../../Design Artifact/spk/CreateSPKFromReport.html#CreateSPKFromReport>) | Save draft | C-15; the report becomes Converted | C-15 |
| [CreateSPKFromReport](<../../Design Artifact/spk/CreateSPKFromReport.html#CreateSPKFromReport>) | Submit for approval | As CreateSPK (T2) | FLW-PLN-11 |
| [RejectReport](<../../Design Artifact/spk/RejectReport.html#RejectReport>) | Cancel | C-14 | C-14 |
| [RejectReport](<../../Design Artifact/spk/RejectReport.html#RejectReport>) | Reject report | Needs a reason; TX-24 | REQ-BRK-007 |
| [UrgentReportPopup](<../../Design Artifact/shell/UrgentReportPopup.html#UrgentReportPopup>) | Create SPK | Records who and when, closes the pop-up for all Planners and opens [CreateSPKFromReport](<../../Design Artifact/spk/CreateSPKFromReport.html#CreateSPKFromReport>) in a new tab | REQ-BRK-004 |
| [MobileReportBreakdown](<../../Design Artifact/mobile/MobileReportBreakdown.html#MobileReportBreakdown>) | Send | As ReportBreakdownForm; refused while offline, the report stays a draft on the phone (REQ-MOB-009) | REQ-BRK-001 |

## Action map: Step screens

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Pause | C-21 | C-21 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Confirm shortfall | Confirms the missing quantity; adds a Part Purchase step right after this one with those lines and alerts the Field Coordinators | REQ-PUR-008 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Raise change request | C-23 | C-23 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Save draft | C-15 | C-15 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Submit step and post Goods Issue | C-18, posts the Goods Issue (stock down, tyres Issued, cost on the SPK) | REQ-STK-005 |
| [StockReversal](<../../Design Artifact/steps/StockReversal.html#StockReversal>) | Cancel | C-12 | C-12 |
| [StockReversal](<../../Design Artifact/steps/StockReversal.html#StockReversal>) | Submit reversal | Needs the lines, quantities and a reason; waits for a Planner or System Admin to verify | REQ-STK-008 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Resume | C-22 | C-22 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Photo | Adds a receipt photo (camera or file) | REQ-PUR-004 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Raise change request | C-23 | C-23 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Submit with no lines and a reason | Opens Nothing bought? dialog: reason → Submit step | REQ-PUR-007, \[New\] dialog |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Save draft | C-15 | C-15 |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Submit step · total | C-18; adds the total to parts cost | REQ-PUR-006 |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | I started earlier | C-20 | C-20 |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Start work | C-19 | C-19 |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Internal team / External workshop | Switches the form; External opens the MechanicExternal layout; lines of the other team are cleared after Switch team? (Switch, Keep) | REQ-MEC-003, \[New\] confirm |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Add service | Opens the catalog picker (search code or name, active services only, fixed price) → adds a line | REQ-MEC-001, \[New\] picker |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Save draft | C-15 | C-15 |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Submit step | C-18; needs at least one repair photo | REQ-MEC-002 |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Release step | Release step dialog: reason → the step is unassigned, its draft stays | FLW-PLN-09, \[New\] dialog |
| [MechanicExternal](<../../Design Artifact/steps/MechanicExternal.html#MechanicExternal>) | Pause | C-21 | C-21 |
| [MechanicExternal](<../../Design Artifact/steps/MechanicExternal.html#MechanicExternal>) | Internal team / External workshop | As Mechanic | REQ-MEC-003 |
| [MechanicExternal](<../../Design Artifact/steps/MechanicExternal.html#MechanicExternal>) | Save draft | C-15 | C-15 |
| [MechanicExternal](<../../Design Artifact/steps/MechanicExternal.html#MechanicExternal>) | Submit step | C-18; needs vendor, price and the invoice image | REQ-MEC-003 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Pause | C-21 | C-21 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Good / Repair / Replace | Sets the part's decision; Good clears Unsafe to drive | REQ-CHK-002 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Add (photo) | Adds a photo to that part (camera or file) | REQ-CHK-002 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Add a finding not on the list / Remove finding | Adds or removes a part marked Added by mechanic | REQ-CHK-002 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Internal team / External workshop, Add service | As Mechanic, for the check service | REQ-CHK-007 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Save draft | C-15 | C-15 |
| [PartCheck](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Submit step | C-18; refused until every part is complete and a service line exists | REQ-CHK-002, REQ-CHK-007 |
| [PartCheckVerify](<../../Design Artifact/steps/PartCheckVerify.html#PartCheckVerify>) | Return with note | As StepVerify; no draft is made | REQ-CHK-003 |
| [PartCheckVerify](<../../Design Artifact/steps/PartCheckVerify.html#PartCheckVerify>) | Verify | Stamps the step and makes the follow-up Draft SPK when a part is Repair or Replace | REQ-CHK-003 |
| [PartCheckVerify](<../../Design Artifact/steps/PartCheckVerify.html#PartCheckVerify>) | Thumbnails | C-29 | C-29 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | Open SPK-2611040181 (check SPK) | SPKDetail of the check SPK | REQ-CHK-004 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | Edit steps in Create SPK | CreateSPK in edit mode for this draft | REQ-CHK-004 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | Discard draft | Needs the reason; the draft is Cancelled and keeps its link to the check; never made again | REQ-CHK-004 |
| [CreateSPKFromCheck](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | Activate: submit for approval | Submits for approval like CreateSPK; the activating user counts as creator for BR-03 | REQ-CHK-004, \[New\] BR-03 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Pause | C-21 | C-21 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Replace | PlacementReplace in the right panel for the selected position | FLW-MEC-03 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Rotate | PlacementRotate in the right panel | FLW-MEC-03 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Tyre on the map (tap) | Selects the position | REQ-PLC-002 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Save draft | C-15 | C-15 |
| [Placement](<../../Design Artifact/steps/Placement.html#Placement>) | Submit step | C-18 | REQ-PLC-006 |
| [PlacementReplace](<../../Design Artifact/steps/PlacementReplace.html#PlacementReplace>) | Pause | C-21 | C-21 |
| [PlacementReplace](<../../Design Artifact/steps/PlacementReplace.html#PlacementReplace>) | Cancel | C-14 (closes the panel) | C-14 |
| [PlacementReplace](<../../Design Artifact/steps/PlacementReplace.html#PlacementReplace>) | Confirm replacement | Records the change in the step draft (old tyre condition, tread, pressure); saved on Submit | REQ-PLC-003, REQ-PLC-004 |
| [PlacementRotate](<../../Design Artifact/steps/PlacementRotate.html#PlacementRotate>) | Pause | C-21 | C-21 |
| [PlacementRotate](<../../Design Artifact/steps/PlacementRotate.html#PlacementRotate>) | Cancel | C-14 | C-14 |
| [PlacementRotate](<../../Design Artifact/steps/PlacementRotate.html#PlacementRotate>) | Confirm rotation | Records the swap in the step draft | REQ-PLC-005 |
| [PlacementTrailer](<../../Design Artifact/steps/PlacementTrailer.html#PlacementTrailer>) | Pause | C-21 | C-21 |
| [PlacementTrailer](<../../Design Artifact/steps/PlacementTrailer.html#PlacementTrailer>) | Replace, Rotate | As Placement | FLW-MEC-03 |
| [PlacementTrailer](<../../Design Artifact/steps/PlacementTrailer.html#PlacementTrailer>) | Swap with spare | Swaps the selected tyre with the spare slot (a rotation with the spare) | REQ-PLC-018, \[New\] wording |
| [PlacementTrailer](<../../Design Artifact/steps/PlacementTrailer.html#PlacementTrailer>) | Save draft | C-15 | C-15 |
| [PlacementTrailer](<../../Design Artifact/steps/PlacementTrailer.html#PlacementTrailer>) | Submit step | C-18 | REQ-PLC-006 |
| [DocStep](<../../Design Artifact/steps/DocStep.html#DocStep>) | Resume | C-22 | C-22 |
| [DocStep](<../../Design Artifact/steps/DocStep.html#DocStep>) | Save draft | C-15 | C-15 |
| [DocStep](<../../Design Artifact/steps/DocStep.html#DocStep>) | Submit step | C-18; needs number, dates, scan, cost, receipt when required | REQ-DOC-007 |

## Action map: Approvals and schedule

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>) | Tabs Surat Perintah Kerja, Warehouse, History | C-06 | C-06 |
| [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>) | Type chips | Filter the list | C-33 |
| [Approvals](<../../Design Artifact/approvals/Approvals.html#Approvals>) | Open review | C-10 for the selected item | FLW-APR-01 |
| [ApprovalsWarehouse](<../../Design Artifact/approvals/ApprovalsWarehouse.html#ApprovalsWarehouse>) | Tabs Surat Perintah Kerja, Warehouse, History | C-06 | C-06 |
| [ApprovalsWarehouse](<../../Design Artifact/approvals/ApprovalsWarehouse.html#ApprovalsWarehouse>) | Type chips | Filter the list | C-33 |
| [ApprovalsWarehouse](<../../Design Artifact/approvals/ApprovalsWarehouse.html#ApprovalsWarehouse>) | Open review | C-10 for the selected item | FLW-APR-01 |
| [ApprovalsHistory](<../../Design Artifact/approvals/ApprovalsHistory.html#ApprovalsHistory>) | Tabs Surat Perintah Kerja, Warehouse, History | C-06 | C-06 |
| [ApprovalsHistory](<../../Design Artifact/approvals/ApprovalsHistory.html#ApprovalsHistory>) | Type chips | Filter the list | C-33 |
| [ApprovalsHistory](<../../Design Artifact/approvals/ApprovalsHistory.html#ApprovalsHistory>) | Open SPK | SPKDetail read only | FLW-APR-06 |
| [ApprovalReview](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>) | Reject | C-25 | C-25 |
| [ApprovalReview](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>) | Approve | C-24; the SPK becomes Active and step 1 opens | FLW-APR-01 |
| [AmendmentReview](<../../Design Artifact/approvals/AmendmentReview.html#AmendmentReview>) | Reject | C-25; the original content stays | FLW-APR-02 |
| [AmendmentReview](<../../Design Artifact/approvals/AmendmentReview.html#AmendmentReview>) | Approve revision | C-24; amendment number +1, the step resumes | FLW-APR-02 |
| [CompletionReview](<../../Design Artifact/approvals/CompletionReview.html#CompletionReview>) | Open SPK document | SPKDocument (Not final) | C-27 |
| [CompletionReview](<../../Design Artifact/approvals/CompletionReview.html#CompletionReview>) | Reject | C-25; SPK stays Pending\_Verification | FLW-APR-03 |
| [CompletionReview](<../../Design Artifact/approvals/CompletionReview.html#CompletionReview>) | Approve completion | C-24; SPK Completed, vehicle status recalculated | FLW-APR-03 |
| [StockOpnameApproval](<../../Design Artifact/approvals/StockOpnameApproval.html#StockOpnameApproval>) | Reject | C-25; back to Draft, marked Returned | FLW-APR-04 |
| [StockOpnameApproval](<../../Design Artifact/approvals/StockOpnameApproval.html#StockOpnameApproval>) | Approve adjustment | C-24; stock adjusted | FLW-APR-04 |
| [TyreCountApproval](<../../Design Artifact/approvals/TyreCountApproval.html#TyreCountApproval>) | Reject | C-25 | FLW-APR-04 |
| [TyreCountApproval](<../../Design Artifact/approvals/TyreCountApproval.html#TyreCountApproval>) | Approve count | C-24; missing tyres become Lost | FLW-APR-04 |
| [MaintenanceSchedule](<../../Design Artifact/schedule/MaintenanceSchedule.html#MaintenanceSchedule>) | ‹ ›, Today, Week/Month | Moves the period; no data change | \[New\] |
| [MaintenanceSchedule](<../../Design Artifact/schedule/MaintenanceSchedule.html#MaintenanceSchedule>) | Drag a card | Places or moves the SPK on a day; the Field Coordinators are alerted; the SPK never changes | REQ-SCH-001 to 004 |
| [MaintenanceSchedule](<../../Design Artifact/schedule/MaintenanceSchedule.html#MaintenanceSchedule>) | Card (click) | [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | C-07 |
| [ScheduleDispatcher](<../../Design Artifact/schedule/ScheduleDispatcher.html#ScheduleDispatcher>) | ‹ › | Moves the period | \[New\] |
| [ScheduleDispatcher](<../../Design Artifact/schedule/ScheduleDispatcher.html#ScheduleDispatcher>) | Card (click) | SPKDetail read only; cards cannot move | REQ-SCH-005 |

## Action map: Vehicles and documents

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Vehicle tabs (Overview, Documents, Chassis and parts, SPK history, Inspections) | C-06; each tab is its own artboard | C-06 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Add vehicle | [AddVehicle](<../../Design Artifact/fleet/AddVehicle.html#AddVehicle>) | FLW-SA-01 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Parts baseline | PartsBaseline (only while the vehicle has no baseline; then Correct baseline per part) | FLW-SA-01 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Create SPK | C-11 with the vehicle | FLW-PLN-02 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Create SPK (alert row) | C-11 from that alert | FLW-PLN-02 |
| [Vehicles](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Vehicle in the list | Selects it (NAV-3) | C-07 |
| [VehicleOverview](<../../Design Artifact/fleet/VehicleOverview.html#VehicleOverview>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As Vehicles; Edit vehicle → [VehicleEdit](<../../Design Artifact/fleet/VehicleEdit.html#VehicleEdit>) | FLW-SA-03 |
| [VehicleOverview](<../../Design Artifact/fleet/VehicleOverview.html#VehicleOverview>) | Record reading | [VehicleOdometer](<../../Design Artifact/fleet/VehicleOdometer.html#VehicleOdometer>) | FLW-SA-03 |
| [VehicleOverview](<../../Design Artifact/fleet/VehicleOverview.html#VehicleOverview>) | Odometer history | VehicleOdometer scrolled to the readings list, with Void per reading | FLW-SA-03, \[New\] |
| [VehicleOverview](<../../Design Artifact/fleet/VehicleOverview.html#VehicleOverview>) | Change (driver) | Change driver dialog: pick an active driver (or none) → Save; both drivers are notified | REQ-VEH-010, \[New\] dialog |
| [VehicleDocuments](<../../Design Artifact/fleet/VehicleDocuments.html#VehicleDocuments>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As VehicleOverview | C-06 |
| [VehicleDocuments](<../../Design Artifact/fleet/VehicleDocuments.html#VehicleDocuments>) | Add document | AddDocument for that type | FLW-SA-02 |
| [VehicleDocuments](<../../Design Artifact/fleet/VehicleDocuments.html#VehicleDocuments>) | View scan | [DocumentScan](<../../Design Artifact/documents/DocumentScan.html#DocumentScan>) | FLW-SA-02 |
| [VehicleDocuments](<../../Design Artifact/fleet/VehicleDocuments.html#VehicleDocuments>) | Open SPK | SPKDetail of the renewal SPK | NAV-5 |
| [VehicleDocuments](<../../Design Artifact/fleet/VehicleDocuments.html#VehicleDocuments>) | Correct entry | DocumentCorrectEntry (only before the first renewal) | REQ-DOC-011 |
| [VehicleSPKHistory](<../../Design Artifact/fleet/VehicleSPKHistory.html#VehicleSPKHistory>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As VehicleOverview | C-06 |
| [VehicleSPKHistory](<../../Design Artifact/fleet/VehicleSPKHistory.html#VehicleSPKHistory>) | Row (click) | [SPKDetail](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | C-07 |
| [VehicleSPKHistory](<../../Design Artifact/fleet/VehicleSPKHistory.html#VehicleSPKHistory>) | Document | SPKDocument of that SPK | REQ-SPKD-001 |
| [VehicleInspections](<../../Design Artifact/fleet/VehicleInspections.html#VehicleInspections>) | Vehicle tabs, Add vehicle, Edit vehicle, Parts baseline, Create SPK | As VehicleOverview | C-06 |
| [VehicleInspections](<../../Design Artifact/fleet/VehicleInspections.html#VehicleInspections>) | Report breakdown | [AdminBreakdownForm](<../../Design Artifact/fleet/AdminBreakdownForm.html#AdminBreakdownForm>) | FLW-SA-04 |
| [VehicleInspections](<../../Design Artifact/fleet/VehicleInspections.html#VehicleInspections>) | Record inspection | [AdminInspectionForm](<../../Design Artifact/fleet/AdminInspectionForm.html#AdminInspectionForm>) | FLW-SA-04 |
| [VehicleChassis](<../../Design Artifact/fleet/VehicleChassis.html#VehicleChassis>) | History (part item row) | Opens [PartItemHistory](<../../Design Artifact/fleet/PartItemHistory.html#PartItemHistory>) | REQ-PTR-005 |
| [PartItemHistory](<../../Design Artifact/fleet/PartItemHistory.html#PartItemHistory>) | Close | C-14 | C-14 |
| [Stock](<../../Design Artifact/steps/Stock.html#Stock>) | Change lots | Opens [StockLotPicker](<../../Design Artifact/steps/StockLotPicker.html#StockLotPicker>) for the line | REQ-PTR-002 |
| [StockLotPicker](<../../Design Artifact/steps/StockLotPicker.html#StockLotPicker>) | Use these lots | Sets the lots of the line; the total must equal the quantity issued | REQ-PTR-002 |
| [StockLotPicker](<../../Design Artifact/steps/StockLotPicker.html#StockLotPicker>) | Cancel | C-14 | C-14 |
| [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Tyre (tyre service) | Picks a tyre mounted on the vehicle; required for a tyre service | REQ-PTR-004 |
| [ReportsParts](<../../Design Artifact/reports/ReportsParts.html#ReportsParts>) | Group by | Brand or vendor | REQ-PTR-006 |
| [ReportsParts](<../../Design Artifact/reports/ReportsParts.html#ReportsParts>) | Open (row) | The installations of that row with their history | REQ-PTR-006 |
| [BaselineCorrect](<../../Design Artifact/fleet/BaselineCorrect.html#BaselineCorrect>) | Vehicle tabs, Add vehicle | As Vehicles | C-06 |
| [BaselineCorrect](<../../Design Artifact/fleet/BaselineCorrect.html#BaselineCorrect>) | Correct baseline | Opens this side panel | REQ-BSL-005 |
| [BaselineCorrect](<../../Design Artifact/fleet/BaselineCorrect.html#BaselineCorrect>) | Cancel | C-14 | C-14 |
| [BaselineCorrect](<../../Design Artifact/fleet/BaselineCorrect.html#BaselineCorrect>) | Save correction | Needs a reason; refused once an SPK touched the part | REQ-BSL-005 |
| [VehicleDeactivate](<../../Design Artifact/fleet/VehicleDeactivate.html#VehicleDeactivate>) | Vehicle tabs, Add vehicle | As Vehicles | C-06 |
| [VehicleDeactivate](<../../Design Artifact/fleet/VehicleDeactivate.html#VehicleDeactivate>) | Cancel | C-14 | C-14 |
| [VehicleDeactivate](<../../Design Artifact/fleet/VehicleDeactivate.html#VehicleDeactivate>) | Deactivate vehicle | Refused while an SPK is open; needs a reason; the vehicle becomes Inactive | REQ-VEH-008 |
| [AddVehicle](<../../Design Artifact/fleet/AddVehicle.html#AddVehicle>) | Upload (document scan) | Adds the scan for that document row (FileDrop) | REQ-DOC-008 |
| [AddVehicle](<../../Design Artifact/fleet/AddVehicle.html#AddVehicle>) | Cancel | C-12 | C-12 |
| [AddVehicle](<../../Design Artifact/fleet/AddVehicle.html#AddVehicle>) | Save and add parts | Saves the vehicle (Active, or Blocked when a required document is missing) → [PartsBaseline](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | FLW-SA-01 |
| [VehicleEdit](<../../Design Artifact/fleet/VehicleEdit.html#VehicleEdit>) | Deactivate vehicle | [VehicleDeactivate](<../../Design Artifact/fleet/VehicleDeactivate.html#VehicleDeactivate>) | FLW-SA-03 |
| [VehicleEdit](<../../Design Artifact/fleet/VehicleEdit.html#VehicleEdit>) | Cancel | C-12 | C-12 |
| [VehicleEdit](<../../Design Artifact/fleet/VehicleEdit.html#VehicleEdit>) | Save changes | Class and layout only while no tyre is mounted and no SPK is open | REQ-VEH-003 |
| [VehicleOdometer](<../../Design Artifact/fleet/VehicleOdometer.html#VehicleOdometer>) | Back to vehicle | C-28 | C-28 |
| [VehicleOdometer](<../../Design Artifact/fleet/VehicleOdometer.html#VehicleOdometer>) | Cancel | C-12 | C-12 |
| [VehicleOdometer](<../../Design Artifact/fleet/VehicleOdometer.html#VehicleOdometer>) | Save reading | Refused below the last reading; warns above 1.500 km a day | REQ-VEH-005 |
| [OdometerVoid](<../../Design Artifact/fleet/OdometerVoid.html#OdometerVoid>) | Back to vehicle | C-28 | C-28 |
| [OdometerVoid](<../../Design Artifact/fleet/OdometerVoid.html#OdometerVoid>) | Void | Opens the void dialog for that reading | REQ-VEH-006 |
| [OdometerVoid](<../../Design Artifact/fleet/OdometerVoid.html#OdometerVoid>) | Keep reading | C-14 | C-14 |
| [OdometerVoid](<../../Design Artifact/fleet/OdometerVoid.html#OdometerVoid>) | Void reading | Needs a reason; the reading is kept but voided; PM due recalculated | REQ-VEH-006 |
| [PartsBaseline](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | Skip for now | Leaves without a baseline; the vehicle shows No baseline on DashboardAdmin | REQ-BSL-001 |
| [PartsBaseline](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | Save baseline | Saves tyres and part items; the next due dates are computed | REQ-BSL-002 |
| [AdminInspectionForm](<../../Design Artifact/fleet/AdminInspectionForm.html#AdminInspectionForm>) | Cancel | C-12 | C-12 |
| [AdminInspectionForm](<../../Design Artifact/fleet/AdminInspectionForm.html#AdminInspectionForm>) | Save inspection | A Fail needs photo, description and urgency and raises a Report Breakdown | REQ-PM-004, REQ-BRK-009 |
| [AdminInspectionForm](<../../Design Artifact/fleet/AdminInspectionForm.html#AdminInspectionForm>) | checklist-1024.jpg | C-29 | C-29 |
| [AdminBreakdownForm](<../../Design Artifact/fleet/AdminBreakdownForm.html#AdminBreakdownForm>) | Cancel | C-12 | C-12 |
| [AdminBreakdownForm](<../../Design Artifact/fleet/AdminBreakdownForm.html#AdminBreakdownForm>) | Send breakdown report | As ReportBreakdownForm, for the named driver; an Urgent one also shows the pop-up | REQ-BRK-001, REQ-BRK-004 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Create SPK | C-11 for a document in Warning or Expired with no open renewal SPK | FLW-SA-02 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Add (Missing cell) | AddDocument for that vehicle and type | FLW-SA-02 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Open SPK-… | SPKDetail of the renewal SPK | NAV-5 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | View scan | [DocumentScan](<../../Design Artifact/documents/DocumentScan.html#DocumentScan>) | FLW-SA-02 |
| [Documents](<../../Design Artifact/documents/Documents.html#Documents>) | Matrix cell | Selects it (NAV-3) | C-07 |
| [AddDocument](<../../Design Artifact/documents/AddDocument.html#AddDocument>) | Cancel | C-12 | C-12 |
| [AddDocument](<../../Design Artifact/documents/AddDocument.html#AddDocument>) | Save and add another | Saves and clears the form for the next document of the same vehicle | REQ-DOC-006 |
| [AddDocument](<../../Design Artifact/documents/AddDocument.html#AddDocument>) | Save document | Saves; back to the page it came from | REQ-DOC-006 |
| [DocumentScan](<../../Design Artifact/documents/DocumentScan.html#DocumentScan>) | Download | Saves the file; written to document\_view\_logs | REQ-DOC-009 |
| [DocumentScan](<../../Design Artifact/documents/DocumentScan.html#DocumentScan>) | Back | C-28 | C-28 |
| [DocumentScan](<../../Design Artifact/documents/DocumentScan.html#DocumentScan>) | ‹ › Zoom out 100% Zoom in Rotate | View only | REQ-FUP-016 |
| [DocumentCorrectEntry](<../../Design Artifact/documents/DocumentCorrectEntry.html#DocumentCorrectEntry>) | Replace scan | Picks a new scan for the correction | REQ-DOC-011 |
| [DocumentCorrectEntry](<../../Design Artifact/documents/DocumentCorrectEntry.html#DocumentCorrectEntry>) | Cancel | C-12 | C-12 |
| [DocumentCorrectEntry](<../../Design Artifact/documents/DocumentCorrectEntry.html#DocumentCorrectEntry>) | Save correction | Needs a reason; logged | REQ-DOC-011 |
| [DocumentTypes](<../../Design Artifact/settings/DocumentTypes.html#DocumentTypes>) | New document type | C-31 | C-31 |
| [DocumentTypes](<../../Design Artifact/settings/DocumentTypes.html#DocumentTypes>) | Discard changes | C-16 | C-16 |
| [DocumentTypes](<../../Design Artifact/settings/DocumentTypes.html#DocumentTypes>) | Save | C-17 | REQ-DOC-002 |

## Action map: Inventory and tyres

| Screen | Control | What it does and where it goes | Ref |
| --- | --- | --- | --- |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>), [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipts.html#GoodsReceipts>), [StockCard](<../../Design Artifact/inventory/StockCard.html#StockCard>), [StockCardExport](<../../Design Artifact/inventory/StockCardExport.html#StockCardExport>), [StockOpname](<../../Design Artifact/inventory/StockOpname.html#StockOpname>), [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>), [RetreadList](<../../Design Artifact/inventory/RetreadList.html#RetreadList>), [TyreCount](<../../Design Artifact/inventory/TyreCount.html#TyreCount>), [TyreColumns](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>), [TyreWornOut](<../../Design Artifact/inventory/TyreWornOut.html#TyreWornOut>), [TyreScrap](<../../Design Artifact/inventory/TyreScrap.html#TyreScrap>) | Parts / Tyres | Switches the Inventory mode; remembered per user | NAV-7 |
| Same screens | Tabs (Stock, Goods Receipts, Stock card, Stock opname; Tyres, Retread, Tyre count) | C-06 | C-06 |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>), [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipts.html#GoodsReceipts>) | Add part | [AddPart](<../../Design Artifact/inventory/AddPart.html#AddPart>) | FLW-WHM-04 |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>), [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipts.html#GoodsReceipts>) | Goods Receipt | [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | FLW-WHM-03 |
| [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>) | Stock row | Selects the part; the stock card on the right follows; the part name opens PartDetail | NAV-3, \[New\] |
| [GoodsReceipts](<../../Design Artifact/inventory/GoodsReceipts.html#GoodsReceipts>) | Receipt row | [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceiptDetail.html#GoodsReceiptDetail>) | FLW-WHM-03 |
| [StockCard](<../../Design Artifact/inventory/StockCard.html#StockCard>) | Export | [StockCardExport](<../../Design Artifact/inventory/StockCardExport.html#StockCardExport>) | FLW-WHM-04 |
| [StockCardExport](<../../Design Artifact/inventory/StockCardExport.html#StockCardExport>) | Close / Cancel | C-14 | C-14 |
| [StockCardExport](<../../Design Artifact/inventory/StockCardExport.html#StockCardExport>) | Export | Exports the stock card for the chosen part, period and format; logged | REQ-INV-008 |
| [StockOpname](<../../Design Artifact/inventory/StockOpname.html#StockOpname>) | Save draft | C-15 | C-15 |
| [StockOpname](<../../Design Artifact/inventory/StockOpname.html#StockOpname>) | Submit for approval | Refused while a row has a variance or Missing without a reason | REQ-INV-010 |
| [StockOpnameReturned](<../../Design Artifact/inventory/StockOpnameReturned.html#StockOpnameReturned>) | Save draft | C-15 | C-15 |
| [StockOpnameReturned](<../../Design Artifact/inventory/StockOpnameReturned.html#StockOpnameReturned>) | Submit for approval again | As StockOpname | FLW-WHM-05 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | Add item | Adds a part line (catalog search) | REQ-INV-004 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | Cancel | C-12 | C-12 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | Save draft | C-15 | C-15 |
| [GoodsReceiptForm](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | Post receipt | Stock and average cost update at once; no approval; cannot be edited after | REQ-INV-005 |
| [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceiptDetail.html#GoodsReceiptDetail>) | Back to Goods Receipts | C-28 | C-28 |
| [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceiptDetail.html#GoodsReceiptDetail>) | Print | C-27 | C-27 |
| [GoodsReceiptDetail](<../../Design Artifact/inventory/GoodsReceiptDetail.html#GoodsReceiptDetail>) | GR correction | GRCorrection for this receipt | FLW-WHM-03 |
| [GRCorrection](<../../Design Artifact/inventory/GRCorrection.html#GRCorrection>) | Cancel | C-12 | C-12 |
| [GRCorrection](<../../Design Artifact/inventory/GRCorrection.html#GRCorrection>) | Save draft | C-15 | C-15 |
| [GRCorrection](<../../Design Artifact/inventory/GRCorrection.html#GRCorrection>) | Post correction | Needs a reason; linked to the original receipt | REQ-INV-006 |
| [GRCorrection](<../../Design Artifact/inventory/GRCorrection.html#GRCorrection>) | INV-7781-rev.jpg | C-29 | C-29 |
| [AddPart](<../../Design Artifact/inventory/AddPart.html#AddPart>) | Cancel | C-12 | C-12 |
| [AddPart](<../../Design Artifact/inventory/AddPart.html#AddPart>) | Save part | Creates the part; SKU unique | REQ-INV-002 |
| [PartDetail](<../../Design Artifact/inventory/PartDetail.html#PartDetail>) | Back to stock | C-28 | C-28 |
| [PartDetail](<../../Design Artifact/inventory/PartDetail.html#PartDetail>) | Open stock card | StockCard for this part | REQ-INV-007 |
| [PartDetail](<../../Design Artifact/inventory/PartDetail.html#PartDetail>) | Edit part | [PartEdit](<../../Design Artifact/inventory/PartEdit.html#PartEdit>) | FLW-WHM-04 |
| [PartEdit](<../../Design Artifact/inventory/PartEdit.html#PartEdit>) | Deactivate part | PartDeactivate (only at quantity 0) | REQ-INV-003 |
| [PartEdit](<../../Design Artifact/inventory/PartEdit.html#PartEdit>) | Cancel | C-12 | C-12 |
| [PartEdit](<../../Design Artifact/inventory/PartEdit.html#PartEdit>) | Save changes | Quantity and average cost are never editable here | REQ-INV-002 |
| [PartDeactivate](<../../Design Artifact/inventory/PartDeactivate.html#PartDeactivate>) | Cancel | C-14 | C-14 |
| [PartDeactivate](<../../Design Artifact/inventory/PartDeactivate.html#PartDeactivate>) | Deactivate part | Refused when quantity is not 0 or an open SPK uses it | REQ-INV-003 |
| [OpeningBalance](<../../Design Artifact/inventory/OpeningBalance.html#OpeningBalance>) | Add SKU | Adds a row | REQ-INV-013 |
| [OpeningBalance](<../../Design Artifact/inventory/OpeningBalance.html#OpeningBalance>) | Import from spreadsheet | Uses the SetupImport flow for entity opening\_balance (template, check, import all or nothing) | REQ-IAM-011, \[New\] |
| [OpeningBalance](<../../Design Artifact/inventory/OpeningBalance.html#OpeningBalance>) | Save draft | C-15 | C-15 |
| [OpeningBalance](<../../Design Artifact/inventory/OpeningBalance.html#OpeningBalance>) | Save opening balance | Setup mode only; closed for good at go-live | REQ-INV-013 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>), [TyreColumns](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>), [TyreCount](<../../Design Artifact/inventory/TyreCount.html#TyreCount>), [RetreadList](<../../Design Artifact/inventory/RetreadList.html#RetreadList>) | Receive tyres | [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | FLW-WHM-06 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>), [TyreColumns](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>), [TyreCount](<../../Design Artifact/inventory/TyreCount.html#TyreCount>), [RetreadList](<../../Design Artifact/inventory/RetreadList.html#RetreadList>) | Send to retread | RetreadDispatch with the selected Needs Retread tyres | FLW-WHM-07 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Receive (open dispatch strip) | RetreadReceipt for that dispatch | FLW-WHM-07 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Columns | [TyreColumns](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>) | FLW-WHM-08 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Worn out | [TyreWornOut](<../../Design Artifact/inventory/TyreWornOut.html#TyreWornOut>) | FLW-WHM-08 |
| [Tyres](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Scrap | [TyreScrap](<../../Design Artifact/inventory/TyreScrap.html#TyreScrap>) | FLW-WHM-08 |
| [TyreColumns](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>) | Close | C-14 | C-14 |
| [TyreColumns](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>) | Reset to default | Restores the default columns in the panel | REQ-TYR-010 |
| [TyreColumns](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>) | Apply | Saves the columns for this user | NAV-7 |
| [TyreWornOut](<../../Design Artifact/inventory/TyreWornOut.html#TyreWornOut>) | Cancel | C-14 | C-14 |
| [TyreWornOut](<../../Design Artifact/inventory/TyreWornOut.html#TyreWornOut>) | Confirm Worn out | Sets Worn Out with the reason | REQ-TYR-005 |
| [TyreScrap](<../../Design Artifact/inventory/TyreScrap.html#TyreScrap>) | Cancel | C-14 | C-14 |
| [TyreScrap](<../../Design Artifact/inventory/TyreScrap.html#TyreScrap>) | Scrap tyre | Final; needs a reason | REQ-TYR-005 |
| [TyreCount](<../../Design Artifact/inventory/TyreCount.html#TyreCount>) | Save draft | C-15 | C-15 |
| [TyreCount](<../../Design Artifact/inventory/TyreCount.html#TyreCount>) | Submit for approval | Each Missing tyre needs a reason and note | REQ-TYR-011 |
| [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | Receipt type switch | New tyres or Retread return (→ [RetreadReceipt](<../../Design Artifact/inventory/RetreadReceipt.html#RetreadReceipt>)) | FLW-WHM-06 |
| [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | Add tyre | Adds a row | REQ-TYR-006 |
| [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | Copy brand and size to new rows | Fills empty brand and size of new rows from the first row | \[New\] |
| [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | Cancel | C-12 | C-12 |
| [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | Save draft | C-15 | C-15 |
| [ReceiveTyres](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | Confirm receipt | Each tyre In Stock with a generated code | REQ-TYR-006 |
| [RetreadList](<../../Design Artifact/inventory/RetreadList.html#RetreadList>) | Receive | RetreadReceipt for that dispatch | FLW-WHM-07 |
| [RetreadList](<../../Design Artifact/inventory/RetreadList.html#RetreadList>) | View | [RetreadDispatchDetail](<../../Design Artifact/inventory/RetreadDispatchDetail.html#RetreadDispatchDetail>) | FLW-WHM-07 |
| [RetreadDispatch](<../../Design Artifact/inventory/RetreadDispatch.html#RetreadDispatch>) | Add tyre | Adds a Needs Retread tyre | REQ-TYR-008 |
| [RetreadDispatch](<../../Design Artifact/inventory/RetreadDispatch.html#RetreadDispatch>) | Cancel | C-12 | C-12 |
| [RetreadDispatch](<../../Design Artifact/inventory/RetreadDispatch.html#RetreadDispatch>) | Save draft | C-15 | C-15 |
| [RetreadDispatch](<../../Design Artifact/inventory/RetreadDispatch.html#RetreadDispatch>) | Confirm dispatch | Tyres become On Retread | REQ-TYR-008 |
| [RetreadDispatchDetail](<../../Design Artifact/inventory/RetreadDispatchDetail.html#RetreadDispatchDetail>) | Back to Retread | C-28 | C-28 |
| [RetreadDispatchDetail](<../../Design Artifact/inventory/RetreadDispatchDetail.html#RetreadDispatchDetail>) | Print | C-27 (delivery note) | REQ-TYR-008 |
| [RetreadReceipt](<../../Design Artifact/inventory/RetreadReceipt.html#RetreadReceipt>) | Cancel | C-12 | C-12 |
| [RetreadReceipt](<../../Design Artifact/inventory/RetreadReceipt.html#RetreadReceipt>) | Save draft | C-15 | C-15 |
| [RetreadReceipt](<../../Design Artifact/inventory/RetreadReceipt.html#RetreadReceipt>) | Confirm receipt | Accepted → In Stock (retread count +1); Rejected → Scrapped; Not returned yet stays On Retread | REQ-TYR-009 |
