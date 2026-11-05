# 7. UI specification

> Part of the BMI Stooring System spec (§7 UI specification except the action map). Core rules, roles, state machines, business rules and decisions: [PRD.md](../../PRD.md). Section numbers and IDs are unchanged from the single-file PRD v2.4.


This section fixes where objects sit, how pages are divided and how users move between screens. It does not fix visual style (0.1), except the BMI brand in 7.8.

## 7.1 Layout authority

The design artifact in `Design Artifact/` (index: `Design Artifact/index.html`) is the visual target of the end product (DEC-96). The built web and mobile screens SHALL look like their artboards.

| Binding: build exactly as the artboard shows | Not binding |
| --- | --- |
| Which regions a screen has and where each object sits; which pages, tabs, steps, panels and dialogs exist, and their order | Sample data, names, numbers and dates shown in an artboard (they are placeholders) |
| The full visual design: the shell (floating rail, logo circle, main sheet, pill tabs), colours, type sizes and weights, spacing, corner radii, shapes, elevation, icons, status pills, the chassis map, motion | The `?review` strip (role switch, allowedActions, state labels): a design-review aid, never product UI |
| How the user moves from screen to screen (section 6, 7.6) and which controls each role sees (allowedActions, DEC-93) | How the artboard is coded: its HTML, CSS and kit script are a reference to reproduce, not code to import |
| Status names and meanings; every status shows its text label, never colour alone | Wording of hints and empty states, within the artboard's tone |
| App name BMI Stooring System, the BMI logo and the brand tokens (7.8) | |

Data that the spec keeps in master data (modules, steps, classes, layouts, tyre positions, statuses) is drawn from data, never written into screens, even where an artboard shows fixed examples. DESIGN.md records the same design as tokens and rules; where it and an artboard differ, the artboard wins and DESIGN.md is corrected.

## 7.2 Global layout patterns

| Pattern | Rule |
| --- | --- |
| App shell | A floating navigation rail on the left and one main screen (DEC-94). Items: Dashboard, Surat Perintah Kerja, Report Breakdown, Schedule, Approvals, Inventory, Vehicles, Documents, Reports, Settings, shown by the user's effective capabilities through the menu table of 2.4 (`NAV-9`, `REQ-IAM-013`); the outcome with the default matrix of 2.2 is: the System Admin sees every item; Mechanics have no Approvals item and Planners see it only while Planner approval is on. Accounting sees Dashboard, Invoices, Customers, Vehicles (read only) and Reports; Supervisors and the System Admin also see Invoices and Customers, the GM sees them read only. The Access Manager has its own navigation: Users and roles, Audit log. In Setup mode the System Admin sees only Setup and go live, Inventory, Vehicles, Documents and Settings (REQ-IAM-010). The rail is a floating capsule: the BMI logo in a circle at the top (it opens the dashboard), one circular icon per item, then the expand button and the user's circle at the foot. Collapsed is the default: each item shows its name as a tooltip and a waiting count on the icon's corner; the active item is a filled circle. Expand widens the same capsule to show names and counts; the choice is saved per user, the toggle works by keyboard, and the main screen moves aside without losing width (screen AppShellCollapsed). The main screen is one raised white sheet that holds everything of the page: the title, status pills and primary action in its header row, then the tabs as a pill group inside the sheet, then the content. The bell ([`NotificationCenter`](<../../Design Artifact/shell/NotificationCenter.html#NotificationCenter>)) sits with the page actions in that header row (DEC-82, DEC-94). |
| List page | Header with the primary create button, then tabs, a filter row, the table. Rows waiting for the current user are marked and carry Open. |
| Master-detail page | List on the left, detail of the selected row on the right; selecting a row never leaves the page. |
| Step screen | Context banner (SPK number, plate, "Step n of N", module, hint), the form, a bottom action bar aligned right (Save draft, Submit step). Raise change request sits in the content, not in the bar. |
| Form page | Cards in data-entry order and a bottom bar (Cancel, Save draft or Save, main action). Forms are full pages. Small actions use a side panel or a dialog: Replace and Rotate a tyre, column chooser, export, Cancel SPK, Worn out, Scrap, deactivate, void, Correct baseline. |
| [Settings](<../../Design Artifact/settings/Settings.html#Settings>) | Same shell; the Settings home groups items in cards (Surat Perintah Kerja; Fleet and maintenance; Alerts and system); each opens its own page. Users and roles is not in Settings. |
| One field per column | Each data item has its own sortable, filterable column; never two items in one column or two lines in one cell; wide tables offer a column chooser; a matrix cell holds one value. A person column shows the name; the role gets its own column where it matters. |
| Responsive | Web screens are desktop first and usable on a tablet. The mobile app (R1 step 7; the Supervisor menu in release 2, DEC-98) is mobile first at 390 × 844, one app whose menu follows the role. |

## 7.3 Screen inventory

Every artboard of the design artifact ([Design Artifact/index.html](<../../Design Artifact/index.html>)), grouped by area, with the requirements it serves. Every screen, dialog, side panel and state has its own page, named after the screen (DEC-107); there is no page that holds several screens. Dialog artboards show the dialog over its parent page.

| Screen | Title in the canvas | P | Requirements |
| --- | --- | --- | --- |
| **Shell and general** |  |  |  |
| [`WebLogin`](<../../Design Artifact/shell/WebLogin.html#WebLogin>) | Sign in (web) | P0 | REQ-IAM-001 |
| [`NotificationCenter`](<../../Design Artifact/shell/NotificationCenter.html#NotificationCenter>) | Notification center | P0 | REQ-NTF-001 |
| [`AppShellCollapsed`](<../../Design Artifact/shell/AppShellCollapsed.html#AppShellCollapsed>) | App shell: navigation collapsed | P0 | 7.2 App shell, DEC-82 |
| [`Main`](<../../Design Artifact/index.html#Main>) | Screen map | - | Overview of the canvas only; not built |
| **Dashboards** |  |  |  |
| [`Dashboard`](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) | Dashboard (Supervisor) | P0 | REQ-DSH-001 |
| [`DashboardPlanner`](<../../Design Artifact/dashboard/DashboardPlanner.html#DashboardPlanner>) | Dashboard (Planner) | P0 | REQ-DSH-002 |
| [`DashboardMechanic`](<../../Design Artifact/dashboard/DashboardMechanic.html#DashboardMechanic>) | Dashboard (Mechanic) | P0 | REQ-DSH-003 |
| [`DashboardWarehouse`](<../../Design Artifact/dashboard/DashboardWarehouse.html#DashboardWarehouse>) | Dashboard (Warehouse Manager) | P0 | REQ-DSH-004 |
| [`DashboardAdmin`](<../../Design Artifact/dashboard/DashboardAdmin.html#DashboardAdmin>) | Dashboard (System Admin) | P0 | REQ-DSH-005 |
| [`DashboardDispatcher`](<../../Design Artifact/dashboard/DashboardDispatcher.html#DashboardDispatcher>) | Dashboard (Field Coordinator) | P0 | REQ-DSH-006 |
| **Surat Perintah Kerja** |  |  |  |
| [`SPKList`](<../../Design Artifact/spk/SPKList.html#SPKList>) | Surat Perintah Kerja tab | P0 | REQ-SPK-010 |
| [`CreateSPK`](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Create SPK | P0 | REQ-SPK-001, REQ-SPK-004, REQ-SPK-017 |
| [`CreateSPKFromAlert`](<../../Design Artifact/spk/CreateSPKFromAlert.html#CreateSPKFromAlert>) | Create SPK from an alert | P0 | REQ-SPK-012 |
| [`SPKRejected`](<../../Design Artifact/spk/SPKRejected.html#SPKRejected>) | Surat Perintah Kerja rejected | P0 | REQ-SPK-007 |
| [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Surat Perintah Kerja detail | P0 | REQ-SPK-011 |
| [`SPKDetailVerify`](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | SPK detail: verification and completion | P0 | REQ-ENG-005, REQ-ENG-006 |
| [`StepVerify`](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Verify a step | P0 | REQ-ENG-005, REQ-ENG-007 |
| [`StepLocked`](<../../Design Artifact/spk/StepLocked.html#StepLocked>) | Step state: locked | P0 | REQ-ENG-008 |
| [`StepReturned`](<../../Design Artifact/spk/StepReturned.html#StepReturned>) | Step state: returned | P0 | REQ-ENG-008 |
| [`CancelSPK`](<../../Design Artifact/spk/CancelSPK.html#CancelSPK>) | Cancel Surat Perintah Kerja (dialog) | P0 | REQ-SPK-008 |
| [`ChangeRequest`](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) | Raise a change request | P0 | REQ-CR-001 |
| [`CreateSPKRevision`](<../../Design Artifact/spk/CreateSPKRevision.html#CreateSPKRevision>) | Revise an SPK (amendment) | P0 | REQ-CR-003 |
| [`SPKDocument`](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) | SPK document | P0 | REQ-SPKD-001 to REQ-SPKD-003 |
| **Steps** |  |  |  |
| [`Stock`](<../../Design Artifact/steps/Stock.html#Stock>) | Step: Stock | P0 | REQ-STK-001 to REQ-STK-006 |
| [`PartPurchase`](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Step: Part Purchase (bought outside) | P0 | REQ-PUR-001 to 008 |
| [`StockReversal`](<../../Design Artifact/steps/StockReversal.html#StockReversal>) | Stock step: reversal after submit | P0 | REQ-STK-008 |
| [`Mechanic`](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Step: Mechanic Action | P0 | REQ-MEC-001, REQ-MEC-002 |
| [`MechanicExternal`](<../../Design Artifact/steps/MechanicExternal.html#MechanicExternal>) | Mechanic Action: external team | P0 | REQ-MEC-003 |
| [`PartCheck`](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Step: Part Check | P0 | REQ-CHK-002 |
| [`Mobilisasi`](<../../Design Artifact/steps/Mobilisasi.html#Mobilisasi>) | Step: Mobilisasi (web view and verification of the route, trail and stooring) | P0 | REQ-MBL-002 to REQ-MBL-006, DEC-99 |
| [`PartCheckVerify`](<../../Design Artifact/steps/PartCheckVerify.html#PartCheckVerify>) | Verify a Part Check step | P0 | REQ-CHK-003 |
| [`CreateSPKFromCheck`](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | Draft SPK from a Part Check | P0 | REQ-CHK-003, REQ-CHK-004 |
| [`MechanicMobileCheck`](<../../Design Artifact/mobile/MechanicMobileCheck.html#MechanicMobileCheck>) | Mobile: Part Check step | P0 (R1 step 7, DEC-98) | REQ-CHK-002 |
| [`SPKDocumentCheck`](<../../Design Artifact/spk/SPKDocumentCheck.html#SPKDocumentCheck>) | SPK document of a Part Check SPK | P0 | REQ-CHK-006, REQ-CHK-007, REQ-SPKD-008 |
| [`Placement`](<../../Design Artifact/steps/Placement.html#Placement>) | Step: Part Replacement map | P0 | REQ-PLC-001 to REQ-PLC-010 |
| [`PlacementReplace`](<../../Design Artifact/steps/PlacementReplace.html#PlacementReplace>) | Part Replacement: replace | P0 | REQ-PLC-003, REQ-PLC-004 |
| [`PlacementRotate`](<../../Design Artifact/steps/PlacementRotate.html#PlacementRotate>) | Part Replacement: rotate | P0 | REQ-PLC-005 |
| [`DocStep`](<../../Design Artifact/steps/DocStep.html#DocStep>) | Step: Document renewal | P0 | REQ-DOC-007 |
| **Approvals** |  |  |  |
| [`Approvals`](<../../Design Artifact/approvals/Approvals.html#Approvals>) | Approvals (inbox) | P0 | REQ-APR-001, REQ-APR-002 |
| [`ApprovalsWarehouse`](<../../Design Artifact/approvals/ApprovalsWarehouse.html#ApprovalsWarehouse>) | Approvals: Warehouse tab | P0 | REQ-APR-003 |
| [`ApprovalsHistory`](<../../Design Artifact/approvals/ApprovalsHistory.html#ApprovalsHistory>) | Approvals: History | P0 | REQ-APR-007 |
| [`ApprovalReview`](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>) | Review approval: creation | P0 | REQ-SPK-005, REQ-APR-004 |
| [`AmendmentReview`](<../../Design Artifact/approvals/AmendmentReview.html#AmendmentReview>) | Review approval: amendment | P0 | REQ-CR-004, REQ-CR-005 |
| [`CompletionReview`](<../../Design Artifact/approvals/CompletionReview.html#CompletionReview>) | Review: completion approval | P0 | SM-SPK T13, T14 |
| [`StockOpnameApproval`](<../../Design Artifact/approvals/StockOpnameApproval.html#StockOpnameApproval>) | Review: Stock opname | P0 | REQ-INV-011 |
| [`TyreCountApproval`](<../../Design Artifact/approvals/TyreCountApproval.html#TyreCountApproval>) | Review: Tyre count | P0 | REQ-TYR-012 |
| **Schedule** |  |  |  |
| [`MaintenanceSchedule`](<../../Design Artifact/schedule/MaintenanceSchedule.html#MaintenanceSchedule>) | Maintenance schedule (Planner) | P0 | REQ-SCH-001 to REQ-SCH-003, REQ-SCH-006 |
| [`ScheduleDispatcher`](<../../Design Artifact/schedule/ScheduleDispatcher.html#ScheduleDispatcher>) | Maintenance schedule (Field Coordinator, read only) | P0 | REQ-SCH-005 |
| [`ScheduleMonth`](<../../Design Artifact/schedule/ScheduleMonth.html#ScheduleMonth>) | Maintenance schedule, month view | P0 | REQ-SCH-001, REQ-SCH-002 |
| **Vehicles** |  |  |  |
| [`Vehicles`](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Vehicles tab (Chassis and parts) | P0 | REQ-VEH-001, REQ-PLC-010 |
| [`VehicleOverview`](<../../Design Artifact/fleet/VehicleOverview.html#VehicleOverview>) | Vehicles: Overview tab | P0 | REQ-VEH-001, REQ-VEH-006 |
| [`VehicleDocuments`](<../../Design Artifact/fleet/VehicleDocuments.html#VehicleDocuments>) | Vehicles: Documents tab | P0 | REQ-DOC-011 |
| [`VehicleSPKHistory`](<../../Design Artifact/fleet/VehicleSPKHistory.html#VehicleSPKHistory>) | Vehicles: SPK history tab | P0 | REQ-VEH-008 |
| [`VehicleInspections`](<../../Design Artifact/fleet/VehicleInspections.html#VehicleInspections>) | Vehicles: Inspections tab | P0 | REQ-PM-004 |
| [`AddVehicle`](<../../Design Artifact/fleet/AddVehicle.html#AddVehicle>) | Add vehicle with first documents | P0 | REQ-VEH-002 |
| [`VehicleEdit`](<../../Design Artifact/fleet/VehicleEdit.html#VehicleEdit>) | Edit vehicle | P0 | REQ-VEH-003 |
| [`VehicleDeactivate`](<../../Design Artifact/fleet/VehicleDeactivate.html#VehicleDeactivate>) | Deactivate vehicle (dialog) | P0 | REQ-VEH-004 |
| [`VehicleOdometer`](<../../Design Artifact/fleet/VehicleOdometer.html#VehicleOdometer>) | Vehicles: odometer history and manual reading | P0 | REQ-VEH-005, REQ-VEH-006 |
| [`OdometerVoid`](<../../Design Artifact/fleet/OdometerVoid.html#OdometerVoid>) | Void odometer reading (dialog) | P0 | REQ-VEH-007 |
| [`PartsBaseline`](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | Parts baseline (first entry) | P0 | REQ-BSL-001 to REQ-BSL-003 |
| [`BaselineCorrect`](<../../Design Artifact/fleet/BaselineCorrect.html#BaselineCorrect>) | Correct parts baseline (dialog) | P0 | REQ-BSL-005 |
| [`AdminInspectionForm`](<../../Design Artifact/fleet/AdminInspectionForm.html#AdminInspectionForm>) | Record inspection for a driver | P0 | REQ-PM-004 |
| [AdminBreakdownForm](<../../Design Artifact/fleet/AdminBreakdownForm.html#AdminBreakdownForm>) | Report Breakdown for a driver | P0 | REQ-BRK-001 |
| **Documents** |  |  |  |
| [`Documents`](<../../Design Artifact/documents/Documents.html#Documents>) | Documents tab | P0 | REQ-DOC-011 |
| [`AddDocument`](<../../Design Artifact/documents/AddDocument.html#AddDocument>) | Add document (first entry) | P0 | REQ-DOC-008 |
| [`DocumentScan`](<../../Design Artifact/documents/DocumentScan.html#DocumentScan>) | View scan | P0 | REQ-DOC-011 |
| [`DocumentCorrectEntry`](<../../Design Artifact/documents/DocumentCorrectEntry.html#DocumentCorrectEntry>) | Correct a first document entry | P0 | REQ-DOC-009 |
| **Inventory: parts** |  |  |  |
| [`Inventory`](<../../Design Artifact/inventory/Inventory.html#Inventory>) | [Inventory](<../../Design Artifact/inventory/Inventory.html#Inventory>) | P0 | REQ-INV-001, REQ-TYR-004 |
| [`AddPart`](<../../Design Artifact/inventory/AddPart.html#AddPart>) | Inventory: Add part | P0 | REQ-INV-002 |
| [`PartDetail`](<../../Design Artifact/inventory/PartDetail.html#PartDetail>) | Inventory: Part detail | P0 | REQ-INV-001 |
| [`PartEdit`](<../../Design Artifact/inventory/PartEdit.html#PartEdit>) | Inventory: Edit part | P0 | REQ-INV-002 |
| [`PartDeactivate`](<../../Design Artifact/inventory/PartDeactivate.html#PartDeactivate>) | Deactivate part (dialog) | P0 | REQ-INV-003 |
| [`GoodsReceipts`](<../../Design Artifact/inventory/GoodsReceipts.html#GoodsReceipts>) | Inventory: Goods Receipts | P0 | REQ-INV-004 |
| [`GoodsReceiptForm`](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | New Goods Receipt | P0 | REQ-INV-004 |
| [`GoodsReceiptDetail`](<../../Design Artifact/inventory/GoodsReceiptDetail.html#GoodsReceiptDetail>) | Goods Receipt detail | P0 | REQ-INV-004 |
| [`GRCorrection`](<../../Design Artifact/inventory/GRCorrection.html#GRCorrection>) | GR correction | P0 | REQ-INV-005 |
| [`StockCard`](<../../Design Artifact/inventory/StockCard.html#StockCard>) | Inventory: Stock card | P0 | REQ-INV-007 |
| [`StockCardExport`](<../../Design Artifact/inventory/StockCardExport.html#StockCardExport>) | Stock card: Export | P0 | REQ-INV-008 |
| [`StockOpname`](<../../Design Artifact/inventory/StockOpname.html#StockOpname>) | Inventory: Stock opname | P0 | REQ-INV-010 |
| [`StockOpnameReturned`](<../../Design Artifact/inventory/StockOpnameReturned.html#StockOpnameReturned>) | Stock opname returned (also serves a returned tyre count) | P0 | REQ-INV-011, REQ-TYR-012 |
| **Inventory: tyres** |  |  |  |
| [`Tyres`](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Inventory: Tyres | P0 | REQ-TYR-005 |
| [`TyreColumns`](<../../Design Artifact/inventory/TyreColumns.html#TyreColumns>) | Tyres: column chooser | P0 | REQ-TYR-005 |
| [`ReceiveTyres`](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>) | Receive tyres: new tyres | P0 | REQ-TYR-006 |
| [`RetreadReceipt`](<../../Design Artifact/inventory/RetreadReceipt.html#RetreadReceipt>) | Receive tyres: retread return | P0 | REQ-TYR-009 |
| [`RetreadDispatch`](<../../Design Artifact/inventory/RetreadDispatch.html#RetreadDispatch>) | Send tyres to retread | P0 | REQ-TYR-008 |
| [`RetreadList`](<../../Design Artifact/inventory/RetreadList.html#RetreadList>) | Inventory: Tyres, Retread | P0 | REQ-TYR-008 |
| [`RetreadDispatchDetail`](<../../Design Artifact/inventory/RetreadDispatchDetail.html#RetreadDispatchDetail>) | Retread dispatch detail | P0 | REQ-TYR-008 |
| [`TyreWornOut`](<../../Design Artifact/inventory/TyreWornOut.html#TyreWornOut>) | Tyres: confirm Worn out | P0 | REQ-TYR-010 |
| [`TyreScrap`](<../../Design Artifact/inventory/TyreScrap.html#TyreScrap>) | Tyres: confirm Scrap | P0 | REQ-TYR-010 |
| [`TyreCount`](<../../Design Artifact/inventory/TyreCount.html#TyreCount>) | Inventory: Tyres, Tyre count | P0 | REQ-TYR-011 |
| **Settings** |  |  |  |
| [`Settings`](<../../Design Artifact/settings/Settings.html#Settings>) | Settings (home) | P0 | 7.2 |
| [`SettingsSPKPresets`](<../../Design Artifact/settings/SettingsSPKPresets.html#SettingsSPKPresets>) | Settings: SPK presets | P0 | REQ-REG-003, REQ-REG-005 |
| [`SettingsAlertRules`](<../../Design Artifact/settings/SettingsAlertRules.html#SettingsAlertRules>) | Settings: Alert rules | P0 | REQ-PM-007 to REQ-PM-010 |
| [`ChassisLayouts`](<../../Design Artifact/settings/ChassisLayouts.html#ChassisLayouts>) | Vehicle classes and chassis layouts | P0 | REQ-PLC-013 |
| [`DocumentTypes`](<../../Design Artifact/settings/DocumentTypes.html#DocumentTypes>) | Settings: Document types | P0 | REQ-DOC-002 |
| [`SettingsServiceCatalog`](<../../Design Artifact/settings/SettingsServiceCatalog.html#SettingsServiceCatalog>) | Settings: Service catalog | P0 | REQ-MEC-005 |
| [`SettingsPartItemTypes`](<../../Design Artifact/settings/SettingsPartItemTypes.html#SettingsPartItemTypes>) | Settings: Part item types | P0 | REQ-BSL-007 |
| [`SettingsPMPackages`](<../../Design Artifact/settings/SettingsPMPackages.html#SettingsPMPackages>) | Settings: PM packages and tasks | P0 | REQ-REG-007 |
| [`SettingsAlertThresholds`](<../../Design Artifact/settings/SettingsAlertThresholds.html#SettingsAlertThresholds>) | Settings: Alert thresholds | P0 | REQ-PM-006 |
| [`SettingsTyreStatuses`](<../../Design Artifact/settings/SettingsTyreStatuses.html#SettingsTyreStatuses>) | Settings: Tyre statuses | P0 | REQ-TYR-003 |
| `SettingsIntegrations` | Settings: Integrations (WhatsApp, Protrack/Cartrack, external tools) | P1 | DQ-05 (no artboard yet; follows 7.2) |
| **Access Manager area** |  |  |  |
| [`UsersRoles`](<../../Design Artifact/access/UsersRoles.html#UsersRoles>) | Users and roles: Accounts | P0 | REQ-IAM-002 to REQ-IAM-004 |
| [`AMAccountForm`](<../../Design Artifact/access/AMAccountForm.html#AMAccountForm>) | New or edit account | P0 | REQ-IAM-002 |
| [`AMRolesPermissions`](<../../Design Artifact/access/AMRolesPermissions.html#AMRolesPermissions>) | Users and roles: Roles and permissions | P0 | REQ-IAM-005 |
| [`AMAccessHistory`](<../../Design Artifact/access/AMAccessHistory.html#AMAccessHistory>) | Users and roles: Access history | P0 | REQ-IAM-003 |
| [`AuditLog`](<../../Design Artifact/access/AuditLog.html#AuditLog>) | Audit log | P0 | REQ-IAM-007 |
| **Reports** |  |  |  |
| [`Reports`](<../../Design Artifact/reports/Reports.html#Reports>) | Reports (Cost) | P1 | REQ-RPT-001, REQ-RPT-002 |
| [`ReportsTyres`](<../../Design Artifact/reports/ReportsTyres.html#ReportsTyres>) | Reports: Tyres | P1 | REQ-RPT-003 |
| [`ReportsMaintenance`](<../../Design Artifact/reports/ReportsMaintenance.html#ReportsMaintenance>) | Reports: Maintenance | P1 | REQ-RPT-003 |
| [`ReportsInventory`](<../../Design Artifact/reports/ReportsInventory.html#ReportsInventory>) | Reports: Inventory | P1 | REQ-RPT-003 |
| [`ReportsStepTime`](<../../Design Artifact/reports/ReportsStepTime.html#ReportsStepTime>) | Reports: Step time | P1 | REQ-RPT-005, REQ-DSH-010 |
| **Mobile app (390 × 844)** |  |  |  |
| [`MobileLogin`](<../../Design Artifact/mobile/MobileLogin.html#MobileLogin>) | Sign in; the menu follows the role | P0 | REQ-MOB-001 |
| [`DashboardDriver`](<../../Design Artifact/mobile/DashboardDriver.html#DashboardDriver>) | Driver home | P0 | REQ-DSH-007 |
| [MobileInspection](<../../Design Artifact/mobile/MobileInspection.html#MobileInspection>) | Driver and Mechanic: inspection | P0 | REQ-MOB-003, REQ-BRK-008, REQ-BRK-009 |
| [MobileReportBreakdown](<../../Design Artifact/mobile/MobileReportBreakdown.html#MobileReportBreakdown>) | Driver, Mechanic, Field Coordinator, System Admin: Report Breakdown | P0 | REQ-BRK-001 |
| [`DriverOdometer`](<../../Design Artifact/mobile/DriverOdometer.html#DriverOdometer>) | Driver: record odometer | P0 | REQ-MOB-003 |
| [`DriverHistory`](<../../Design Artifact/mobile/DriverHistory.html#DriverHistory>) | Driver: history | P0 | REQ-MOB-003 |
| [`MechanicMobileHome`](<../../Design Artifact/mobile/MechanicMobileHome.html#MechanicMobileHome>) | Mechanic: my steps | P0 (DEC-98) | REQ-MOB-002, REQ-MOB-010 |
| [`MechanicMobileStep`](<../../Design Artifact/mobile/MechanicMobileStep.html#MechanicMobileStep>) | Mechanic: Mechanic Action step | P0 (Mechanic and System Admin field menu, DEC-98) | REQ-MOB-002 |
| [`MechanicMobilePlacement`](<../../Design Artifact/mobile/MechanicMobilePlacement.html#MechanicMobilePlacement>) | Mechanic: Part Replacement step | P0 (DEC-98) | REQ-MOB-002 |
| [`MechanicMobileHistory`](<../../Design Artifact/mobile/MechanicMobileHistory.html#MechanicMobileHistory>) | Mechanic: history | P0 (DEC-98) | REQ-MOB-002, DQ-04 |
| [`MobilisasiMobile`](<../../Design Artifact/mobile/MobilisasiMobile.html#MobilisasiMobile>) | Mechanic and System Admin: Mobilisasi step (route, location trail, Finish stooring) | P0 (DEC-98, DEC-99) | REQ-MBL-002 to REQ-MBL-005 |
| [`SupervisorMobileHome`](<../../Design Artifact/mobile/SupervisorMobileHome.html#SupervisorMobileHome>) | Supervisor/GM: approvals | P1 | REQ-MOB-005 |
| [`SupervisorMobileReview`](<../../Design Artifact/mobile/SupervisorMobileReview.html#SupervisorMobileReview>) | Supervisor/GM: review and decide | P1 | REQ-MOB-005 |
| [`SupervisorMobileFleet`](<../../Design Artifact/mobile/SupervisorMobileFleet.html#SupervisorMobileFleet>) | Supervisor/GM: fleet today | P1 | REQ-MOB-005 |
| [`SupervisorMobileHistory`](<../../Design Artifact/mobile/SupervisorMobileHome.html#SupervisorMobileHistory>) | Supervisor/GM: decision history | P1 | REQ-MOB-005, DQ-04 |
| [`MobileProfile`](<../../Design Artifact/mobile/MobileProfile.html#MobileProfile>) | Mobile: profile and settings (every role) | P0 (DEC-100; the push mute settings of REQ-NTF-003 stay P1) | REQ-MOB-001, DQ-01, DQ-03 |
| [`DispatcherMobileFleet`](<../../Design Artifact/mobile/DispatcherMobileFleet.html#DispatcherMobileFleet>) | Field Coordinator: fleet availability | P0 | REQ-MOB-006 |
| [`DispatcherMobileSchedule`](<../../Design Artifact/mobile/DispatcherMobileSchedule.html#DispatcherMobileSchedule>) | Field Coordinator: schedule, read only | P0 | REQ-MOB-006 |
| [`DispatcherMobileAlerts`](<../../Design Artifact/mobile/DispatcherMobileAlerts.html#DispatcherMobileAlerts>) | Field Coordinator: alerts | P0 | REQ-MOB-006, REQ-NTF-002 |
| [FileUploadStates](<../../Design Artifact/components/FileUploadStates.html#FileUploadStates>) | Component: file upload states (FileDrop) | P0 | REQ-FUP-001 to 007 |
| [MechanicMobileUpload](<../../Design Artifact/mobile/MechanicMobileUpload.html#MechanicMobileUpload>) | Mechanic: photos uploading in the background, submit when done | P0 (DEC-98) | REQ-FUP-006, REQ-FUP-011 to 015 |
| [PhotoViewer](<../../Design Artifact/components/PhotoViewer.html#PhotoViewer>) | Component: photo and file viewer (dialog) | P0 | REQ-FUP-016, REQ-ENG-010, REQ-APR-009, REQ-APR-010 |
| **Field Coordinator requests and purchases (R1)** | - | - | - |
| [BreakdownReports](<../../Design Artifact/spk/BreakdownReports.html#BreakdownReports>) | Report Breakdown list | P0 | REQ-BRK-005 |
| [ReportBreakdownForm](<../../Design Artifact/spk/ReportBreakdownForm.html#ReportBreakdownForm>) | Report Breakdown form on the web (Mechanic, Field Coordinator, System Admin) | P0 | REQ-BRK-001 |
| [CreateSPKFromReport](<../../Design Artifact/spk/CreateSPKFromReport.html#CreateSPKFromReport>) | Create SPK from a Report Breakdown | P0 | REQ-BRK-003, REQ-BRK-006 |
| [UrgentReportPopup](<../../Design Artifact/shell/UrgentReportPopup.html#UrgentReportPopup>) | Urgent report pop-up (blocking) | P0 | REQ-BRK-004 |
| [MobileReports](<../../Design Artifact/mobile/MobileReports.html#MobileReports>) | Field Coordinator and System Admin: reports, read only | P0 | REQ-MOB-006, REQ-BRK-005 |
| [FCMobilePurchase](<../../Design Artifact/mobile/FCMobilePurchase.html#FCMobilePurchase>) | Field Coordinator: Part Purchase step | P0 | REQ-PUR-001 to 008, REQ-MOB-006 |
| [SAMobileHome](<../../Design Artifact/mobile/SAMobileHome.html#SAMobileHome>) | System Admin: field menu | P0 | REQ-MOB-008 |
| [RejectReport](<../../Design Artifact/spk/RejectReport.html#RejectReport>) | Reject a report (dialog) | P0 | REQ-BRK-007, DQ-11 |
| **Invoices and customers** | - | - | - |
| [DashboardAccounting](<../../Design Artifact/dashboard/DashboardAccounting.html#DashboardAccounting>) | Dashboard (Accounting) | P0 | REQ-DSH-009 |
| [InvoiceList](<../../Design Artifact/billing/InvoiceList.html#InvoiceList>) | Invoices | P0 | REQ-BIL-008, REQ-BIL-009 |
| [InvoiceDetail](<../../Design Artifact/billing/InvoiceDetail.html#InvoiceDetail>) | Invoice detail | P0 | REQ-BIL-003 to 006 |
| [InvoicePayment](<../../Design Artifact/billing/InvoicePayment.html#InvoicePayment>) | Record payment (dialog) | P0 | REQ-BIL-006 |
| [InvoiceVoid](<../../Design Artifact/billing/InvoiceVoid.html#InvoiceVoid>) | Void invoice (dialog) | P0 | REQ-BIL-006 |
| [InvoiceDocument](<../../Design Artifact/billing/InvoiceDocument.html#InvoiceDocument>) | Invoice print (black and white) | P0 | REQ-BIL-007 |
| [Customers](<../../Design Artifact/billing/Customers.html#Customers>) | [Customers](<../../Design Artifact/billing/Customers.html#Customers>) | P0 | REQ-BIL-001 |
| [CustomerForm](<../../Design Artifact/billing/CustomerForm.html#CustomerForm>) | Add or edit customer | P0 | REQ-BIL-001 |
| [SettingsBilling](<../../Design Artifact/settings/SettingsBilling.html#SettingsBilling>) | Settings: Invoices and tax | P0 | REQ-BIL-004, REQ-BIL-007 |
| [SettingsStooringRates](<../../Design Artifact/settings/SettingsStooringRates.html#SettingsStooringRates>) | Settings: Stooring rates | P0 | REQ-MEC-010 |
| [OpeningBalance](<../../Design Artifact/inventory/OpeningBalance.html#OpeningBalance>) | Inventory: opening balance before go-live | P0 | REQ-INV-013 |
| [ChangePassword](<../../Design Artifact/shell/ChangePassword.html#ChangePassword>) | Change password at first sign-in | P0 | REQ-IAM-009 |
| [SetupGoLive](<../../Design Artifact/setup/SetupGoLive.html#SetupGoLive>) | System Admin: Setup mode and Go live | P0 | REQ-IAM-010 |
| [SettingsVendors](<../../Design Artifact/settings/SettingsVendors.html#SettingsVendors>) | Settings: Vendors | P0 | REQ-INV-014 |
| [PlacementTrailer](<../../Design Artifact/steps/PlacementTrailer.html#PlacementTrailer>) | Part Replacement on a trailer tail (towed unit, spare) | P0 | REQ-PLC-017 to 020 |
| [SetupImport](<../../Design Artifact/setup/SetupImport.html#SetupImport>) | System Admin: bulk import of master data (Setup mode) | P0 | REQ-IAM-011, REQ-DOC-013, REQ-BSL-008 |
| **Dialogs, panels and states named by the action map (DEC-107)** | - | - | - |
| [`ForgotPassword`](<../../Design Artifact/shell/ForgotPassword.html#ForgotPassword>) | Forgot password | P0 | DQ-02, DEC-102 |
| [`ResetPassword`](<../../Design Artifact/shell/ResetPassword.html#ResetPassword>) | Reset password (from the link) | P0 | DQ-02, DEC-102 |
| [`UserMenu`](<../../Design Artifact/shell/UserMenu.html#UserMenu>) | User menu (panel) | P0 | C-04 |
| [`LeaveConfirm`](<../../Design Artifact/components/LeaveConfirm.html#LeaveConfirm>) | Leave without saving? (dialog) | P0 | C-12, C-13 |
| [`DiscardConfirm`](<../../Design Artifact/components/DiscardConfirm.html#DiscardConfirm>) | Discard your changes? (dialog) | P0 | C-16 |
| [`DeactivateMaster`](<../../Design Artifact/components/DeactivateMaster.html#DeactivateMaster>) | Deactivate a master record (dialog) | P0 | C-32 |
| [`ExportDialog`](<../../Design Artifact/components/ExportDialog.html#ExportDialog>) | Export (dialog) | P0 | C-26, REQ-RPT-001 |
| [`StartFromPreset`](<../../Design Artifact/spk/StartFromPreset.html#StartFromPreset>) | Start from preset (dialog) | P0 | REQ-REG-003 |
| [`SavePreset`](<../../Design Artifact/spk/SavePreset.html#SavePreset>) | Save as preset (panel) | P0 | REQ-REG-003 |
| [`PartPicker`](<../../Design Artifact/spk/PartPicker.html#PartPicker>) | Add part (panel) | P0 | REQ-SPK-017 |
| [`AssignStep`](<../../Design Artifact/spk/AssignStep.html#AssignStep>) | Assign or reassign a step (dialog) | P0 | FLW-PLN-09 |
| [`CorrectStepTime`](<../../Design Artifact/spk/CorrectStepTime.html#CorrectStepTime>) | Correct step time (dialog) | P0 | REQ-ENG-014 |
| [`PauseStep`](<../../Design Artifact/steps/PauseStep.html#PauseStep>) | Why are you pausing? (dialog) | P0 | C-21, REQ-ENG-013 |
| [`StartEarlier`](<../../Design Artifact/steps/StartEarlier.html#StartEarlier>) | I started earlier (panel) | P0 | C-20, REQ-ENG-014 |
| [`ReleaseStep`](<../../Design Artifact/steps/ReleaseStep.html#ReleaseStep>) | Release step (dialog) | P0 | FLW-PLN-09 |
| [`SwitchTeam`](<../../Design Artifact/steps/SwitchTeam.html#SwitchTeam>) | Switch team? (dialog) | P0 | REQ-MEC-003 |
| [`CatalogPicker`](<../../Design Artifact/steps/CatalogPicker.html#CatalogPicker>) | Add service (panel) | P0 | REQ-MEC-001 |
| [`NothingBought`](<../../Design Artifact/steps/NothingBought.html#NothingBought>) | Nothing bought? (dialog) | P0 | REQ-PUR-007 |
| [`StepPaused`](<../../Design Artifact/steps/StepPaused.html#StepPaused>) | Step paused, with Resume | P0 | C-22, REQ-ENG-013 |
| [`VehicleChassis`](<../../Design Artifact/fleet/VehicleChassis.html#VehicleChassis>) | Vehicle: Chassis and parts | P0 | REQ-PLC-002, REQ-BSL-005 |
| [`ChangeDriver`](<../../Design Artifact/fleet/ChangeDriver.html#ChangeDriver>) | Change driver (dialog) | P0 | REQ-VEH-010 |
| [`GoLiveConfirm`](<../../Design Artifact/setup/GoLiveConfirm.html#GoLiveConfirm>) | Go live? (dialog) | P0 | REQ-IAM-010 |
| [`MobilePauseSheet`](<../../Design Artifact/mobile/MobilePauseSheet.html#MobilePauseSheet>) | Mobile: why are you pausing? (sheet) | P0 | C-21, REQ-MOB-009 |

The AI sidebar and its settings page have no artboard yet and are deferred to a later release (see 11.3); they follow the patterns of 7.2. `SettingsIntegrations` (DQ-05) also has no artboard yet. The design canvas screens are currently in English only; the Indonesian translation of the UI is deferred to a later release (see 11.3), with Indonesian as the default language once delivered.

## 7.4 Key screen layouts

Regions are listed left to right, top to bottom. Screens not listed follow their canvas artboard and the patterns of 7.2.

| Screen | Layout | Primary actions |
| --- | --- | --- |
| [`Dashboard`](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) and role dashboards | Summary cards across the top; below, "Needs my action" (wider, left) and a status or work list (right) | Open the item |
| [`SPKList`](<../../Design Artifact/spk/SPKList.html#SPKList>) | Header with "+ Create SPK"; tabs with counts; filter row (search, type, vehicle); table (SPK, vehicle, type, status, current step, waiting on, action) | Open, Create |
| [`CreateSPK`](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) | Header: title, Start from preset, Save as preset. Left: Surat Perintah Kerja card (title, vehicle with chips, category, priority, Vehicle goes to the workshop, description) and Checks card. Right: Steps card with the module palette (draggable chips), drop zones that appear while dragging, one step card per step (drag handle, number, module icon and name, Optional, Move up, Move down, Remove; Executed by and Verified by; the module's details) and Add step. Bottom: Cancel, Save draft, Submit for approval | Submit for approval |
| [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) | Header (number, type, status; SPK document, Raise change request, Cancel SPK). A row of step cards with status and Open on the user's step (Reverse issue on a submitted Stock step). Below: left description, cost so far, timeline; right the approval block | Open step |
| [`SPKDetailVerify`](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | Step cards with Verify and Return on submitted steps; Completion card with "Request completion approval" (disabled with the reason until all steps are verified); approval block right | Verify, Request completion |
| [`StepVerify`](<../../Design Artifact/steps/StepVerify.html#StepVerify>) | Banner "Verify step n of N"; the work read only, with every photo and invoice as a thumbnail that opens PhotoViewer; executor stamp; verification card (note, required to return; stamp preview; Return to executor, Verify) | Verify |
| [`Stock`](<../../Design Artifact/steps/Stock.html#Stock>) | Banner; part table (part, planned, source, in stock, quantity used, unit price) with a tyre picker (code, serial number) under each tyre line; cards for invoice images and change request; bottom bar | Submit step |
| [`Mechanic`](<../../Design Artifact/steps/Mechanic.html#Mechanic>) | Banner with the work to do; team switch Internal or External; services table (catalog service, fixed price, mechanic); repair photos; labor total left of the bottom bar | Submit step |
| [`Placement`](<../../Design Artifact/steps/Placement.html#Placement>) | Banner; left the chassis map (editable); right the selected tyre with Replace and Rotate, tyres available to fit (Issued to this SPK), legend; bottom bar. Replace and Rotate open in the right panel | Replace, Rotate, Submit step |
| [`DocStep`](<../../Design Artifact/steps/DocStep.html#DocStep>) | Banner; left the current document read only; right the renewed document form (number, issue date, new expiry, scan, cost, receipt) with validation | Submit step |
| [`ApprovalReview`](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>), [`CompletionReview`](<../../Design Artifact/approvals/CompletionReview.html#CompletionReview>) | Header (SPK, approval type, status). Left: description, vehicle, parts, steps (executed by, verified by) and an Evidence card (completion: each step's photos, invoices and placement snapshot; creation: the photos of the source report). Right: decision card (reason, stamp preview, Reject, Approve), rules card, history card | Approve, Reject |
| [`AmendmentReview`](<../../Design Artifact/approvals/AmendmentReview.html#AmendmentReview>) | Left: reason, comparison table (field, current, proposed) with changed lines marked, step states. Right: decision card (Reject, Approve revision) and outcomes | Approve revision |
| [`Approvals`](<../../Design Artifact/approvals/Approvals.html#Approvals>), [`ApprovalsWarehouse`](<../../Design Artifact/approvals/ApprovalsWarehouse.html#ApprovalsWarehouse>), [`ApprovalsHistory`](<../../Design Artifact/approvals/ApprovalsHistory.html#ApprovalsHistory>) | Tabs Surat Perintah Kerja, Warehouse, History with counts; type chips and search; master-detail (table left, preview right with "Open review") | Open review |
| [`MaintenanceSchedule`](<../../Design Artifact/schedule/MaintenanceSchedule.html#MaintenanceSchedule>) | Week or month calendar with SPK cards per day; left lists "Not on the schedule" and "Missed the planned day"; cards are dragged directly | Drag a card |
| [`Vehicles`](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Search and "+ Add vehicle"; left the vehicle list; right the profile with tabs and header buttons "+ Parts baseline", "Create SPK"; Chassis and parts tab: map left (read only), alert list right with "Create SPK" per alert and "Correct baseline" per untouched part item | Create SPK |
| [`PartsBaseline`](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) | Two cards: Tyres (position table) and Service parts (with next due and status); bottom Skip for now, Save baseline | Save baseline |
| [`Documents`](<../../Design Artifact/documents/Documents.html#Documents>) | Three summary cards; left a matrix of vehicles by document type (vehicle status column, one status per cell); right the selected document with renewal history | Open SPK, + Add document, View scan |
| [`Inventory`](<../../Design Artifact/inventory/Inventory.html#Inventory>) | Parts or Tyres picker beside the title. Parts mode: "+ Add part", "+ Goods Receipt"; tabs Stock, Goods Receipts, Stock card, Stock opname; summary cards; stock table left, stock card of the selected part right. Tyres mode: "Receive tyres", "Send to retread"; tabs Tyres, Retread, Tyre count. Buttons of one mode never show in the other | + Goods Receipt, Receive tyres |
| [`GoodsReceiptForm`](<../../Design Artifact/inventory/GoodsReceiptForm.html#GoodsReceiptForm>) | Left: header card (generated number, date, supplier, PO, invoice) and item table with "+ Add item" (parts only). Right: summary and "what posting does". Bottom: Cancel, Save draft, Post receipt | Post receipt |
| [`StockOpname`](<../../Design Artifact/inventory/StockOpname.html#StockOpname>), [`TyreCount`](<../../Design Artifact/inventory/TyreCount.html#TyreCount>) | Banner; row with count date, counted by, rack filter, summary; the sheet; a row with a variance or Missing and no reason shows an error under the table; bottom Save draft, Submit for approval | Submit for approval |
| [`ReceiveTyres`](<../../Design Artifact/inventory/ReceiveTyres.html#ReceiveTyres>), [`RetreadReceipt`](<../../Design Artifact/inventory/RetreadReceipt.html#RetreadReceipt>) | Receipt type switch on top (New tyres, Retread return). Header card and tyre table; right summary and "what confirming does"; bottom Cancel, Save draft, Confirm receipt | Confirm receipt |
| [`Tyres`](<../../Design Artifact/inventory/Tyres.html#Tyres>) | Eight status cards; open-dispatch strip with Receive; filter row with column chooser; master-detail (tyre table left, detail with history and actions right) | Send to retread, Worn out, Scrap |
| [`SettingsSPKPresets`](<../../Design Artifact/settings/SettingsSPKPresets.html#SettingsSPKPresets>) | Left: table of presets (name, category, steps, used by, status) with search and a category filter. Right: the selected preset (version, category, workshop flag, PM packages that use it, its steps with module icon, executor and details); bottom Deactivate, Rename, Edit steps in Create SPK | Edit steps in Create SPK |
| [`SettingsAlertRules`](<../../Design Artifact/settings/SettingsAlertRules.html#SettingsAlertRules>) | Left: the alert rules (PM due, Document expiry, Tyre tread, Part item life), each showing Drafts SPK with its preset or Alert only. Right: Trigger card for the selected rule (PM: due soon km and days, and a preset per package; Document: warning days and a preset per document type; Tyre: Act now and due soon tread, pressure tolerance; Part item: due soon % of life and check time) and When it triggers card (Show the alert only or Show the alert and draft an SPK, Draft the SPK at, Preset, Priority, category of the SPK, Notify roles, Checks) | Save (refused while a check fails), Discard |
| [`ChassisLayouts`](<../../Design Artifact/settings/ChassisLayouts.html#ChassisLayouts>) | Left classes; centre layout header and axle table; right preview drawn by the map component; bottom Discard, Save as new layout version | Save layout |
| [`SPKDocument`](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) | Toolbar (Print, Download PDF) and a paper page: header, description, vehicle, one section per step with stamps, timestamps and cost, approval block at the bottom; black and white with no photos, attachments listed as text | Download PDF |
| [`Reports`](<../../Design Artifact/reports/Reports.html#Reports>) | Export; tabs Cost, Tyres, Maintenance, Inventory; filter row (period, class); summary cards, charts and tables per tab (REQ-RPT-002, REQ-RPT-003) | Export |
| [`ReportsStepTime`](<../../Design Artifact/reports/ReportsStepTime.html#ReportsStepTime>) | Reports tabs with Step time selected; filter row (period, category, vehicle class, internal or external); five summary cards (lead time, waiting to start, working, waiting for verification with the largest share marked, entered starts); Where the time goes per module (stacked bar per module: waiting to start, working, paused, waiting for verification); Pause reasons; Longest phases table (SPK, vehicle, step, executor, phase, time); By person table (GM and Supervisor only) | Export; row opens the SPK |
| [`PartCheck`](<../../Design Artifact/steps/PartCheck.html#PartCheck>) | Context bar; step time bar (Start, Pause); SPK description. Left: one card per part (number, part, what to check, Complete or what is missing; Condition; Good, Repair, Replace; Unsafe to drive when not Good; photos with Add) and Add a finding not on the list. Right: Summary (Good, Repair, Replace, not decided, what happens at verification), Checks, Overall note | Save draft, Submit step (refused until every part is complete) |
| [`CreateSPKFromCheck`](<../../Design Artifact/spk/CreateSPKFromCheck.html#CreateSPKFromCheck>) | Header with Draft and priority, link to the check SPK; note that Activate means submit for approval. Left: findings carried over with decision, Unsafe mark, condition and photos. Right: steps built from the findings with executors and Edit steps in Create SPK. Bottom: reason field | Discard draft (reason required), Activate: submit for approval |
| Mobile screens | Header, one task per screen, large touch targets, bottom navigation with the role's four or five menu items | per role |
| [InvoiceList](<../../Design Artifact/billing/InvoiceList.html#InvoiceList>) | Header with the date filter; tabs Draft, Issued, Paid, Void, Not billable, All with counts; filter row (customer, vehicle, search); table (invoice, date, customer, vehicle, SPKs, total, status, due date) | Open |
| [InvoiceDetail](<../../Design Artifact/billing/InvoiceDetail.html#InvoiceDetail>) | Header (number or Draft, status, Print, Void). Left: customer card, vehicle card, lines table (item, kind, SPK reference, quantity, unit price, amount) and adjustment lines. Right: totals card (subtotal, tax, total), payment card, history. Bottom: Issue invoice on a Draft, Record payment on an Issued invoice | Issue, Record payment |
| [ReportBreakdownForm](<../../Design Artifact/spk/ReportBreakdownForm.html#ReportBreakdownForm>) | One card: vehicle, finding note (required), photos, urgency as four pills; the location is captured when sent | Send |
| [CreateSPKFromReport](<../../Design Artifact/spk/CreateSPKFromReport.html#CreateSPKFromReport>) | As CreateSPK, with a Report reference card (number, kind, urgency, reporter, note, photos, location, read only) above the step list and "Report reference: RB-yymmddNNNN" in the description | Submit for approval |
| [UrgentReportPopup](<../../Design Artifact/shell/UrgentReportPopup.html#UrgentReportPopup>) | A dialog over any page with no close control: vehicle, reporter, note, first photo, location, time, and the count when several wait; focus stays inside (`role="alertdialog"`) | Create SPK |
| [PartPurchase](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) | Banner; header card (vendor, receipt number and date, receipt photos); line table from the SPK part list (part, kind, shortfall hint and unit read only; quantity bought and unit price typed; line total), no add or remove; a large calculated total, updated as you type | Submit step |

## 7.5 Shared components

Each component exists once and takes its data from the spec, never from literals.

| Component | Used in | Rule |
| --- | --- | --- |
| AppShell | Every web screen | Navigation by role with an icon per item, collapsible to an icon rail with the state saved per user, and the page header (7.2) |
| StepBanner | Every step screen | SPK number, plate, "Step n of N" and module, from the SPK's steps |
| StepTracker, StepCard | [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>), [`SPKDetailVerify`](<../../Design Artifact/spk/SPKDetailVerify.html#SPKDetailVerify>) | One card per step, in order, with status |
| StatusPill | Everywhere | Always a text label; the look per status is a style choice |
| ChassisMap | [`Placement`](<../../Design Artifact/steps/Placement.html#Placement>), [`Vehicles`](<../../Design Artifact/fleet/Vehicles.html#Vehicles>), [`ChassisLayouts`](<../../Design Artifact/settings/ChassisLayouts.html#ChassisLayouts>), [`MechanicMobilePlacement`](<../../Design Artifact/mobile/MechanicMobilePlacement.html#MechanicMobilePlacement>) | One component, drawn from the chassis layout; modes editable, read only, preview |
| ApprovalBlock | [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>), [`SPKDocument`](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) | Two lines (creation, completion): stamp, name, role, time, Self-approved mark |
| AlertList | Dashboards, [`Vehicles`](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) | Per alert "Create SPK" prefilled with vehicle and type |
| FileDrop | Invoices, photos, scans | One profile per slot; compresses on the device and shows the file states of REQ-FUP-007 (FileUploadStates) |
| ActionBar | Step screens and forms | Bottom, aligned right |
| ColumnChooser | Wide tables ([`Tyres`](<../../Design Artifact/inventory/Tyres.html#Tyres>) first) | Show, hide, reorder; saved per user |
| [PhotoViewer](<../../Design Artifact/components/PhotoViewer.html#PhotoViewer>) | Every thumbnail: StepVerify, reviews, Vehicles, Tyres, Documents, mobile | One viewer for photos and PDFs, with zoom, previous and next, and file details (REQ-FUP-016) |
| PartAgeCard | [ApprovalReview](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>), [SupervisorMobileReview](<../../Design Artifact/mobile/SupervisorMobileReview.html#SupervisorMobileReview>) | One row per part item or tyre position the SPK replaces: last replaced, km and days used, normal life, life used %, Early failure flag (REQ-APR-011) |
| LocationField | [Mechanic](<../../Design Artifact/steps/Mechanic.html#Mechanic>), [MechanicMobileStep](<../../Design Artifact/mobile/MechanicMobileStep.html#MechanicMobileStep>), [Placement](<../../Design Artifact/steps/Placement.html#Placement>), [SettingsStooringRates](<../../Design Artifact/settings/SettingsStooringRates.html#SettingsStooringRates>) | The stooring area and its fee belong to the Mobilisasi step (its destination comes from the Report Breakdown or the Planner); the mechanic's location trail is recorded only while the Mobilisasi step is In\_Progress and shown only on StepVerify and the SPK detail to the Planner and System Admin (REQ-MBL-005, REQ-MBL-006) |
| Icon | Web navigation, mobile bottom bar, step cards, module chips, Settings home, vehicle tabs, add and back buttons | One outline icon set in one stroke weight. An icon always sits beside its text label, never alone, except in the collapsed navigation rail, where the label becomes a tooltip and the accessible name. Each assignment module has one fixed icon from its registry entry (Stock package, Part Purchase cart, Mechanic Action wrench, Part Replacement tyre, Document file), so a new module brings its own icon (REQ-REG-006). The mobile bottom bar shows an icon above each label, with a target of at least 48 px |
| Motion and feedback | Every web and mobile screen; ApprovalBlock decision on ApprovalReview, AmendmentReview, CompletionReview, StockOpnameApproval, TyreCountApproval, SupervisorMobileReview | Motion only acknowledges an action or explains a state change; there is no page-load choreography. Buttons depress when pressed; table rows, list cards and Settings items highlight on hover; inputs change border on hover and focus (100 to 200 ms). Pass and Fail switch at once and the What is wrong panel appears while any item is Fail. The step waiting for the current user pulses twice when the SPK opens, then rests. Dialogs fade in over their page (about 300 ms). On Approve, the approver's stamp is pressed into the stamp box with the time (about 450 ms) and Reject is disabled; this is the one authored moment. With reduced motion set on the device, movement is replaced by a plain fade and state changes stay visible |

A module's step screen opens through its registry entry (`ui_component`), so a new module appears in the SPK workspace without changing the shell.

## 7.6 Navigation and paging rules

| ID | Rule |
| --- | --- |
| NAV-1 | A step screen opens only from the SPK detail or from Open in [`SPKList`](<../../Design Artifact/spk/SPKList.html#SPKList>) or a dashboard, and Back returns to the SPK detail. |
| NAV-2 | Tabs change content inside the same page; they never open a new page. |
| NAV-3 | On master-detail pages the right side follows the selected row. |
| NAV-4 | Creation and edit forms are full pages \[A\]; confirmations and small actions are dialogs or side panels (7.2). |
| NAV-5 | A notification, an alert or a dashboard item opens the exact SPK, step, document or vehicle it names. |
| NAV-6 | Settings home → a setting → its page → back to Settings home. |
| NAV-7 | The Parts or Tyres choice in Inventory and the column choice per table are remembered per user. |
| NAV-8 | Links from tyre alerts open Inventory in Tyres mode. |
| NAV-9 | Navigation items, tabs and action controls follow the effective capability set from `GET /me` and the record's `allowedActions` (2.4, REQ-IAM-013, REQ-IAM-014), never the role name; a change to the matrix or the Planner approval switch shows on the next page load. Opening the URL of a hidden page shows the not-allowed page, because the server refuses its data. |

## 7.7 Working rules for the implementing agent

1. Build the data model (section 9) and business rules (section 5) first, then requirements in release order (section 10).
2. Place objects, divide pages and wire navigation as in 7.2 to 7.6 and the artboard of the screen.
3. Reproduce the artboard's visual design exactly (7.1, DEC-96): open it, match its layout, colours, type, spacing, radii, shapes, icons and states, and compare the built screen with it side by side before reporting the screen done. Re-create it in the app's own components and styles (DESIGN.md tokens); do not import the artboard's HTML, CSS or kit script, and do not copy its sample data.
4. If a control, field or rule is in the artifact but not in this spec, do not build its behaviour; list it as a question. If something is in this spec but not in the artifact, design it in the artifact's style in the nearest matching region and add it to the artifact.
5. Treat every \[A\] as buildable but keep it configurable or isolated, so the answer to its question in 11.2 ([history.md](history.md)) needs a small change.
6. After each screen, report the artboard it matches, any visual difference left and why, what came from the spec, the REQ and AC IDs covered, and any conflict found.

## 7.8 Brand (DEC-81)

The product name is **BMI Stooring System** on every screen, the browser tab, the mobile app name and launcher, the login screens and printed documents. The short form in tight places is "BMI Stooring". Red and gold below are taken from the BMI logo supplied by the client; petrol, petrol ink and mist complete the Petrol Complement palette (DEC-84); they live as tokens in packages/shared and are never typed as literals in a screen. The full design system (every color, type, radius and spacing token, the component rules and the do's and don'ts, under the north star "The Workshop Logbook") is recorded in DESIGN.md, delivered with the design canvas; agents read it before building a screen. Where DESIGN.md and this spec disagree, this spec wins.

| Token | Hex | Use | Rule |
| --- | --- | --- | --- |
| brand.primary | #AD2713 | Primary buttons, active navigation item, active tab, focus ring, the approval stamp | White text on it (contrast 6.8:1) |
| brand.primaryDark | #8A1D0C | Hover and pressed state of primary | White text on it |
| brand.gold | #C09D11 | Accent on dark surfaces only (app bar, mobile header, logo highlights) | Never as text or a thin line on white (contrast 2.6:1) |
| brand.petrol | #1F4E5F | Second colour, the complement of brand.primary: in-text links, info and In Progress pills (on a #DCEBEF tint), module and Settings icons, the first series of every chart | Carries information, never authority: never a primary button, never an error; red and petrol never swap roles |
| brand.ink | #14262E | Petrol ink: web side navigation, mobile header, dialog scrim (55%) | Logo sits on a white tile on this surface |
| brand.mist | #E6EFF1 | Selected row, info panels, soft highlight | Text in normal ink |
| status.danger | #B91C1C | Error, Act now, Rejected, destructive actions | Kept apart from brand.primary: a status always carries its text label (7.1), and destructive buttons are outlined with an explicit verb |

| Logo use | Rule |
| --- | --- |
| Web side navigation and mobile header | Full-colour logo on a white rounded tile, with the name beside it |
| Login and change password | Larger logo with the name, on the dark surface |
| SPK document and invoice PDF | Logo in grayscale beside the document title or company name, so it prints well in black and white |
| Favicon and app icon | The logo on white; minimum 48 px on the launcher |
| Never | Stretch, recolour, crop the letters, or put the logo directly on brand.primary |

## 7.11 Design-question decisions (DQ)

The Action map (7.9) marks a few controls with a DQ code where the earlier review left the behaviour open. This table closes them; each decision is binding like the rest of the spec, and the matching 7.9 rows carry the detail. A DQ shown as Deferred is intentionally out of Release 1.

| ID | Question | Decision |
| --- | --- | --- |
| DQ-01 | What does "Notification settings" in the user menu do? | It lives on the mobile `MobileProfile` screen (and the web user menu): per-channel and per-event toggles for push and in-app notices, saved per account. P1. |
| DQ-02 | "Forgot password?" on `WebLogin` — email reset or "ask your Access Manager"? | A password reset link is sent to the account's email through the email adapter, the one email Release 1 sends (DEC-102); the link opens a reset page and expires after a set time. The Access Manager can still issue a temporary password (REQ-IAM-009). |
| DQ-03 | The mobile "Profile" destination on every role's bottom bar. | One shared `MobileProfile` screen for every role: identity, notification settings (DQ-01), language, app and session info, Change password, Sign out. P1. |
| DQ-04 | The mobile "History" destination for the Mechanic and Supervisor/GM menus. | `MechanicMobileHistory` (the mechanic's past steps, returns, inspections and Report Breakdowns) and `SupervisorMobileHistory` (the Supervisor/GM's past approval decisions), read only, opening each record. P1. |
| DQ-05 | DashboardAdmin "Integrations" rows — are they clickable, and to where? | In Release 1 they show each integration's status as text and are not clickable (DEC-103). The `SettingsIntegrations` screen, where the System Admin connects WhatsApp, the Protrack/Cartrack odometer API and other external tools (credentials, enable or disable, a connection test), comes with those adapters: P1; no artboard yet, follows 7.2. |
| DQ-06 | Can the creator (or the rejector) cancel a Rejected SPK? | Yes, the creator can (DEC-101): a Rejected SPK stays Rejected with the rejector's note; its creator either edits and resubmits it (SM-SPK T5) or cancels it with a reason (T6). The rejector cannot revert the rejection. |
| DQ-07 | Who raises "Request amendment" on an SPK — the creator or the step executor? | The executor of the open step raises a change request when they disagree with the SPK creator's assignment design; it puts the SPK in Pending Amendment and the SPK creator (Planner or System Admin) receives and decides the amendment (REQ-CR-001, SM-SPK T8 to T10). The SPK creator never raises it against their own design. |
| DQ-08 | "Open trail on map" in `StepVerify` — which map, and is this employee tracking? | For a Mobilisasi step it opens, on an external map, the mechanic's location trail and destination. Since DEC-90 the trail is recorded only while the step is In\_Progress (not a continuous background feed and no longer a one-time capture on Mechanic Action); it is scoped to stooring verification, visible to Planner and System Admin only, with access logged, and the privacy handling of RSK-09 / UU PDP applies. |
| DQ-10 | The Field Coordinator's place in the Report Breakdown list. | Read only: it sends reports and follows them. Create SPK and Reject show only for the Planner and System Admin through `allowedActions`. The former "Complete and send to Planner" control is removed (DEC-109). |
| DQ-11 | The reject dialog of the Report Breakdown list. | Built as `RejectReport`: a required reason marks the report Rejected, cancels a linked Draft SPK, notifies the reporter and keeps the report in the vehicle history; nothing is billed. |
