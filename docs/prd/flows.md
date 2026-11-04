# 6. User flows by role and scenario

> Part of the BMI Stooring System spec (§6 user flows). Core rules, roles, state machines, business rules and decisions: [PRD.md](../../PRD.md). Section numbers and IDs are unchanged from the single-file PRD v2.4.


Each flow lists the screens of the design canvas in the order the user meets them, and names the requirements it exercises. Every web flow starts at [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) and lands on the role's dashboard; every mobile flow (R1 step 7 or P1, see 4.20) starts at [`MobileLogin`](<../../Design Artifact/mobile/MobileApp.html#MobileLogin>), whose menu follows the role. The bell in the page header opens [`NotificationCenter`](<../../Design Artifact/shell/Notifications.html#NotificationCenter>) from any screen; in the mobile app the same notices also arrive as push notifications. The System Admin can run every flow of every operational role; where it decides its own work the stamp is marked Self-approved or Self-verified. In every step flow, opening a step leaves its form read only until the executor presses Start (or Start from an earlier time with a reason); a module that does not track work time, such as Part Replacement, has no Start and is editable while Open (SM-STEP, DEC-87, DEC-95).

## 6.1 Planner (web)

**FLW-PLN-01 Create a planned Surat Perintah Kerja** (REQ-SPK-001, REQ-SPK-004).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`DashboardPlanner`](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>).
2. Sidebar Surat Perintah Kerja → [`SPKList`](<../../Design Artifact/spk/SPKList.html#SPKList>) → "+ Create SPK" → [`CreateSPK`](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>): title, vehicle, category, description; start from a preset or drag modules into the step list, and fill each step's details on the same screen.
3. Submit for approval. The SPK shows under the Pending approval tab of [`SPKList`](<../../Design Artifact/spk/SPKList.html#SPKList>); the Approvers are notified (FLW-APR-01).

**FLW-PLN-02 Create an SPK from an alert or a vehicle** (REQ-SPK-012, REQ-PM-003).

1. [`DashboardPlanner`](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) shows PM, tyre, part and document alerts → "Create SPK" → [`CreateSPKFromAlert`](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromAlert>) with vehicle, source and the preset's steps filled.
2. Or Vehicles → [`VehicleOverview`](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) → "Create SPK" → [`CreateSPK`](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) with the vehicle filled.
3. Submit for approval, as in FLW-PLN-01.

**FLW-PLN-03 Rejected SPK** (REQ-SPK-007).

1. Notification "SPK rejected" → [`SPKList`](<../../Design Artifact/spk/SPKList.html#SPKList>), Rejected tab → [`SPKRejected`](<../../Design Artifact/spk/SPKDetail.html#SPKRejected>) shows the Approver's reason.
2. "Edit and resubmit" → [`CreateSPK`](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) in edit mode → Submit → Pending\_Approval again; or cancel the draft.

**FLW-PLN-04 Plan the SPK on the maintenance schedule** (REQ-SCH-001 to REQ-SCH-004).

1. Sidebar Schedule → [`MaintenanceSchedule`](<../../Design Artifact/schedule/Schedule.html#MaintenanceSchedule>).
2. Drag an SPK card from "Not on the schedule" onto a day; a day can hold several cards. The Field Coordinator is alerted (FLW-FC-02).
3. A card whose day passed without completion is marked Missed by the daily job, flagged rolled-over / late and moved to the next day automatically, every day until the SPK is Completed or Cancelled; the Planner may still drag it to another day. The SPK itself never changes (BR-13, REQ-SCH-003, DEC-92).

**FLW-PLN-05 Verify a submitted step** (REQ-ENG-005, REQ-ENG-007).

1. [`DashboardPlanner`](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) "To verify" or the notification → [`SPKDetailVerify`](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>).
2. Verify on a submitted step → [`StepVerify`](<../../Design Artifact/steps/StepVerify.html#StepVerify>): evidence, lines, executor stamp, note.
3. Verify (stamp added) or Return to executor with a required note; the executor then sees [`StepReturned`](<../../Design Artifact/spk/SPKDetail.html#StepReturned>) (FLW-MEC-04).
4. A reversal raised in [`StockReversal`](<../../Design Artifact/steps/Stock.html#StockReversal>) (FLW-WHM-02) is verified the same way.

**FLW-PLN-06 Revise an SPK after a change request** (REQ-CR-003).

1. Notification "Change request" → [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) shows Pending\_Amendment; later steps show [`StepLocked`](<../../Design Artifact/spk/SPKDetail.html#StepLocked>).
2. "Revise" → [`CreateSPKRevision`](<../../Design Artifact/spk/ChangeRequest.html#CreateSPKRevision>): the requested change, the reason and the editable content.
3. Send revision for approval → the Approver decides in [`AmendmentReview`](<../../Design Artifact/approvals/ApprovalReview.html#AmendmentReview>) (FLW-APR-02).

**FLW-PLN-07 Request completion** (REQ-ENG-006).

1. When every step is Verified, [`SPKDetailVerify`](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>) enables "Request completion approval".
2. The Approver decides in [`CompletionReview`](<../../Design Artifact/approvals/ApprovalReview.html#CompletionReview>) (FLW-APR-03). After approval the SPK is Completed and [`SPKDocument`](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) holds every stamp.

**FLW-PLN-08 Maintain SPK presets and PM packages, with the System Admin** (REQ-REG-001, REQ-REG-007).

1. Settings → [`SettingsSPKPresets`](<../../Design Artifact/settings/SPKPresets.html#SettingsSPKPresets>): rename or deactivate presets. A preset's steps are changed by opening it in [`CreateSPK`](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>) (Edit steps in Create SPK) and saving it again with Save as preset, which adds a version.
2. Settings → [`SettingsPMPackages`](<../../Design Artifact/settings/SPKPresets.html#SettingsPMPackages>): packages grouped by vehicle class, with intervals, tasks and suggested parts.

## 6.2 Mechanic (web or tablet, and mobile from R1 step 7)

**FLW-MEC-01 Do a Mechanic Action step, internal team** (REQ-MEC-001, REQ-MEC-002).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`DashboardMechanic`](<../../Design Artifact/dashboard/Dashboard.html#DashboardMechanic>), "My steps" → Open. A step that is not open yet shows [`StepLocked`](<../../Design Artifact/spk/SPKDetail.html#StepLocked>).
2. Start → [`Mechanic`](<../../Design Artifact/steps/MechanicAction.html#Mechanic>): team Internal, services from the catalog (fixed prices), at least one repair photo. The step asks no location and adds no stooring; that comes from the SPK's Mobilisasi step (REQ-MEC-009 retired, DEC-90).
3. Submit step → waits for verification (FLW-PLN-05).

**FLW-MEC-02 Repair at an outside workshop** (REQ-MEC-003).

1. In [`Mechanic`](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) switch the team to External → [`MechanicExternal`](<../../Design Artifact/steps/MechanicAction.html#MechanicExternal>): vendor, services and price, invoice image (required), photos.
2. Submit step.

**FLW-MEC-03 Part Replacement step** (REQ-PLC-002 to REQ-PLC-005).

1. [`DashboardMechanic`](<../../Design Artifact/dashboard/Dashboard.html#DashboardMechanic>) → Open → [`Placement`](<../../Design Artifact/steps/Placement.html#Placement>): the chassis map with each position and its tyre. There is no Start or Pause: the form is editable while the step is Open, and the first change claims the step (DEC-95, REQ-ENG-017).
2. Replace: pick a position → [`PlacementReplace`](<../../Design Artifact/steps/Placement.html#PlacementReplace>): choose a tyre Issued to this SPK, set the old tyre's condition (Needs Retread, Worn Out or Back to stock), tread and pressure.
3. Rotate: [`PlacementRotate`](<../../Design Artifact/steps/Placement.html#PlacementRotate>): move tyres between positions.
4. Submit step.

**FLW-MEC-04 Returned step** (REQ-ENG-005).

1. Notification "Step returned" → [`StepReturned`](<../../Design Artifact/spk/SPKDetail.html#StepReturned>) shows the verifier's note.
2. Start again → fix the content → Submit step again.

**FLW-MEC-05 The SPK content is wrong** (REQ-CR-001, REQ-CR-002).

1. Inside the open step → "Raise change request" → [`ChangeRequest`](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>): what changes, requested change, reason.
2. Submit request → the SPK is Pending\_Amendment and later steps stay Locked until the Approver decides (FLW-PLN-06, FLW-APR-02).

**FLW-MEC-06 Mobile app (R1 step 7)** (REQ-MOB-002, REQ-MOB-004, REQ-MOB-010, DEC-98).

1. [`MobileLogin`](<../../Design Artifact/mobile/MobileApp.html#MobileLogin>) → Mechanic menu → [`MechanicMobileHome`](<../../Design Artifact/mobile/MobileApp.html#MechanicMobileHome>) (the SPKs scheduled for today and assigned to the mechanic, Urgent first, rolled-over first within a level).
2. Open a step → [`MechanicMobileStep`](<../../Design Artifact/mobile/MechanicAction.html#MechanicMobileStep>) (Mechanic Action), [`MechanicMobilePlacement`](<../../Design Artifact/mobile/Placement.html#MechanicMobilePlacement>) (Part Replacement), [`MechanicMobileCheck`](<../../Design Artifact/mobile/PartCheck.html#MechanicMobileCheck>) (Part Check) or [`MobilisasiMobile`](<../../Design Artifact/mobile/Mobilisasi.html#MobilisasiMobile>) (Mobilisasi), same rules as FLW-MEC-01 to FLW-MEC-03, FLW-MEC-08 and FLW-MEC-09 → Submit.
3. Report → [`MechanicMobileFieldReport`](<../../Design Artifact/mobile/Requests.html#MechanicMobileFieldReport>): vehicle, location, description, suggested category, urgency, photos → Send. It drafts an SPK for the Planner (FLW-PLN-02); no work starts from the report.

## 6.3 Warehouse Manager (web)

**FLW-WHM-01 Issue parts and tyres for an SPK** (REQ-STK-001 to REQ-STK-007).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`DashboardWarehouse`](<../../Design Artifact/dashboard/Dashboard.html#DashboardWarehouse>), "My steps" → Open → [`Stock`](<../../Design Artifact/steps/Stock.html#Stock>).
2. Start → for each line on the SPK list enter the quantity used; for each tyre line choose a tyre In Stock by code and serial number. When stock is short, issue what is on hand and confirm the shortfall: a Part Purchase step is added after this step (REQ-STK-004).
3. Parts bought outside: [`PartPurchase`](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) step. Its lines are the parts the Planner or System Admin listed on the SPK, picked from the parts catalog; the buyer types only the quantity bought and the unit price, sees each line total and the grand total at once to check against the receipt, and adds the receipt photo. No part can be added; warehouse stock does not change (REQ-PUR-002, REQ-PUR-003, DEC-62, DEC-63).
4. If the list is wrong → "Raise change request" → [`ChangeRequest`](<../../Design Artifact/spk/ChangeRequest.html#ChangeRequest>) (FLW-MEC-05).
5. Submit step → stock goes down, chosen tyres become Issued and the cost lands on the SPK.

**FLW-WHM-02 Reverse an issue after submit** (REQ-STK-008).

1. [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) → step 1 Stock → "Reverse issue" → [`StockReversal`](<../../Design Artifact/steps/Stock.html#StockReversal>): lines, quantities, reason.
2. Submit → a Planner or System Admin verifies (FLW-PLN-05) → stock and cost return.

**FLW-WHM-03 Goods Receipt, no approval** (REQ-INV-004, REQ-INV-005).

1. Inventory → [`GoodsReceipts`](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceipts>) → "+ Goods Receipt" → [`GoodsReceiptForm`](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>): supplier, invoice, lines → Post receipt. Stock and average cost update at once.
2. Open a posted receipt → [`GoodsReceiptDetail`](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptDetail>).
3. A mistake → "GR correction" → [`GRCorrection`](<../../Design Artifact/inventory/GoodsReceipt.html#GRCorrection>) with a reason → Post. It links to the original receipt.

**FLW-WHM-04 Parts master and stock card** (REQ-INV-002, REQ-INV-003, REQ-INV-007, REQ-INV-008).

1. [`Inventory`](<../../Design Artifact/inventory/Inventory.html#Inventory>) → "+ Add part" → [`AddPart`](<../../Design Artifact/inventory/PartForm.html#AddPart>); select a part → [`PartDetail`](<../../Design Artifact/inventory/Inventory.html#PartDetail>) → Edit → [`PartEdit`](<../../Design Artifact/inventory/PartForm.html#PartEdit>); a part with quantity 0 can be deactivated → [`PartDeactivate`](<../../Design Artifact/inventory/Inventory.html#PartDeactivate>).
2. [`StockCard`](<../../Design Artifact/inventory/Inventory.html#StockCard>) → Export → [`StockCardExport`](<../../Design Artifact/inventory/Inventory.html#StockCardExport>).

**FLW-WHM-05 Stock opname** (REQ-INV-010, REQ-INV-011).

1. Inventory → [`StockOpname`](<../../Design Artifact/inventory/StockOpname.html#StockOpname>): one document with many rows (system and counted quantity, reason when different) → Submit for approval.
2. The Approver decides in [`StockOpnameApproval`](<../../Design Artifact/approvals/ApprovalReview.html#StockOpnameApproval>) (FLW-APR-04).
3. Rejected → notification → [`StockOpnameReturned`](<../../Design Artifact/inventory/StockOpname.html#StockOpnameReturned>) with the reason → fix → Submit again.

**FLW-WHM-06 Receive tyres** (REQ-TYR-006).

1. Inventory → [`Tyres`](<../../Design Artifact/inventory/Tyres.html#Tyres>) → "Receive tyres" → [`ReceiveTyres`](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>), receipt type New tyres, source Supplier (invoice required) or Existing (tyres already owned at go-live) → Confirm receipt. Each tyre becomes In Stock with a generated code.
2. Receipt type Retread return → [`RetreadReceipt`](<../../Design Artifact/inventory/TyreReceive.html#RetreadReceipt>) (FLW-WHM-07).

**FLW-WHM-07 Retread** (REQ-TYR-008, REQ-TYR-009).

1. [`Tyres`](<../../Design Artifact/inventory/Tyres.html#Tyres>) → select tyres with status Needs Retread → "Send to retread" → [`RetreadDispatch`](<../../Design Artifact/inventory/Retread.html#RetreadDispatch>): vendor, delivery note → Confirm dispatch. The tyres become On Retread.
2. Follow open dispatches in [`RetreadList`](<../../Design Artifact/inventory/Retread.html#RetreadList>) → [`RetreadDispatchDetail`](<../../Design Artifact/inventory/Retread.html#RetreadDispatchDetail>).
3. When tyres come back → "Receive" on the dispatch → [`RetreadReceipt`](<../../Design Artifact/inventory/TyreReceive.html#RetreadReceipt>): per tyre Accepted (In Stock, retread count +1), Rejected (Scrapped, reason) or Not returned yet.

**FLW-WHM-08 Tyre condition and list** (REQ-TYR-005, REQ-TYR-010).

1. [`Tyres`](<../../Design Artifact/inventory/Tyres.html#Tyres>) → select a tyre → "Worn out" → [`TyreWornOut`](<../../Design Artifact/inventory/Tyres.html#TyreWornOut>), or "Scrap" → [`TyreScrap`](<../../Design Artifact/inventory/Tyres.html#TyreScrap>) (final, reason required).
2. Column chooser → [`TyreColumns`](<../../Design Artifact/inventory/Tyres.html#TyreColumns>).

**FLW-WHM-09 Tyre count** (REQ-TYR-011, REQ-TYR-012).

1. Tyres → Tyre count → [`TyreCount`](<../../Design Artifact/inventory/Tyres.html#TyreCount>): Found or Missing per tyre, a reason and note for each missing one → Submit for approval.
2. The Approver decides in [`TyreCountApproval`](<../../Design Artifact/approvals/ApprovalReview.html#TyreCountApproval>) (FLW-APR-04); approved missing tyres get status Lost. A returned count uses the [`StockOpnameReturned`](<../../Design Artifact/inventory/StockOpname.html#StockOpnameReturned>) layout.

## 6.4 Supervisor and GM (web, mobile from P1)

**FLW-APR-01 Approve SPK creation** (REQ-SPK-005 to REQ-SPK-007, REQ-APR-004).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`Dashboard`](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>) "Needs my action", or the notification → [`Approvals`](<../../Design Artifact/approvals/Approvals.html#Approvals>), Surat Perintah Kerja tab, chip Creation.
2. Select the SPK → "Open review" → [`ApprovalReview`](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>).
3. Approve: the stamp is added, the SPK becomes Active and step 1 opens. Or Reject with a required reason: the SPK becomes Rejected and goes back to its creator (FLW-PLN-03).

**FLW-APR-02 Approve an amendment** (REQ-CR-004, REQ-CR-005).

1. [`Approvals`](<../../Design Artifact/approvals/Approvals.html#Approvals>), chip Amendment → [`AmendmentReview`](<../../Design Artifact/approvals/ApprovalReview.html#AmendmentReview>): current and proposed content side by side, reason.
2. Approve revision (the amendment number goes up and the step resumes with the new content) or Reject (the original content stays and the step resumes).

**FLW-APR-03 Approve completion** (T13, T14 of SM-SPK).

1. [`Approvals`](<../../Design Artifact/approvals/Approvals.html#Approvals>), chip Completion → [`CompletionReview`](<../../Design Artifact/approvals/ApprovalReview.html#CompletionReview>): verified steps, cost, stamps.
2. Approve: the SPK is Completed, the vehicle status is recalculated and [`SPKDocument`](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>) is final. Reject with reason: the SPK stays Pending\_Verification.

**FLW-APR-04 Approve warehouse documents** (REQ-APR-003, REQ-INV-011, REQ-TYR-012).

1. [`Approvals`](<../../Design Artifact/approvals/Approvals.html#Approvals>) → Warehouse tab → [`ApprovalsWarehouse`](<../../Design Artifact/approvals/Approvals.html#ApprovalsWarehouse>).
2. A stock opname → [`StockOpnameApproval`](<../../Design Artifact/approvals/ApprovalReview.html#StockOpnameApproval>); a tyre count → [`TyreCountApproval`](<../../Design Artifact/approvals/ApprovalReview.html#TyreCountApproval>).
3. Approve (stock or tyre status is adjusted) or Reject with reason (back to Draft, marked Returned: FLW-WHM-05, FLW-WHM-09).

**FLW-APR-05 Cancel an SPK** (REQ-SPK-008).

1. [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) → "Cancel SPK" → [`CancelSPK`](<../../Design Artifact/components/Dialogs.html#CancelSPK>): reason (required); posted issues are reversed and Issued tyres return to In Stock first.
2. Confirm → the SPK shows Cancelled in [`SPKList`](<../../Design Artifact/spk/SPKList.html#SPKList>).

**FLW-APR-06 Look back and follow up** (REQ-APR-007, REQ-RPT-001, REQ-SCH-005).

1. [`ApprovalsHistory`](<../../Design Artifact/approvals/Approvals.html#ApprovalsHistory>): past decisions with reasons and stamps.
2. [`Reports`](<../../Design Artifact/reports/Reports.html#Reports>) → [`ReportsMaintenance`](<../../Design Artifact/reports/Reports.html#ReportsMaintenance>), [`ReportsTyres`](<../../Design Artifact/reports/Reports.html#ReportsTyres>), [`ReportsInventory`](<../../Design Artifact/reports/Reports.html#ReportsInventory>) (P1).
3. [`MaintenanceSchedule`](<../../Design Artifact/schedule/Schedule.html#MaintenanceSchedule>), view only.

**FLW-APR-07 Mobile app (P1)** (REQ-MOB-005).

1. [`MobileLogin`](<../../Design Artifact/mobile/MobileApp.html#MobileLogin>) → Supervisor/GM menu → [`SupervisorMobileHome`](<../../Design Artifact/mobile/Approvals.html#SupervisorMobileHome>) lists every waiting item.
2. Tap an item → [`SupervisorMobileReview`](<../../Design Artifact/mobile/Approvals.html#SupervisorMobileReview>) → Approve, or Reject with a reason; same rules as FLW-APR-01 to FLW-APR-04.
3. Fleet → [`SupervisorMobileFleet`](<../../Design Artifact/mobile/Fleet.html#SupervisorMobileFleet>): status counts and vehicles that need attention.

## 6.5 System Admin (web)

**FLW-SA-01 Add a vehicle with its first data** (REQ-VEH-002, REQ-DOC-008, REQ-BSL-001, REQ-BSL-002).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`DashboardAdmin`](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>) → Vehicles → [`Vehicles`](<../../Design Artifact/fleet/Vehicles.html#Vehicles>) → "+ Add vehicle" → [`AddVehicle`](<../../Design Artifact/fleet/VehicleForm.html#AddVehicle>): plate, class and chassis layout, odometer and the first documents.
2. "Save and add parts" → [`PartsBaseline`](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>): last replacement of each part item and the tyres already mounted (received first with [`ReceiveTyres`](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>), source Existing) → Save baseline.
3. The vehicle is Active, or Blocked while a required document is Missing.

**FLW-SA-02 Documents** (REQ-DOC-006 to REQ-DOC-009, REQ-DOC-011).

1. [`Documents`](<../../Design Artifact/documents/Documents.html#Documents>) or [`VehicleDocuments`](<../../Design Artifact/fleet/Vehicle.html#VehicleDocuments>) → "+ Add document" → [`AddDocument`](<../../Design Artifact/documents/DocumentForm.html#AddDocument>) for a document never entered; "View scan" → [`DocumentScan`](<../../Design Artifact/documents/Documents.html#DocumentScan>).
2. A wrong number or date before the first renewal SPK → "Correct entry" → [`DocumentCorrectEntry`](<../../Design Artifact/documents/DocumentForm.html#DocumentCorrectEntry>) with a reason.
3. Renewal: the Document SPK drafted at Warning is approved (FLW-APR-01) → the System Admin opens the Document step and presses Start → [`DocStep`](<../../Design Artifact/steps/DocStep.html#DocStep>): new number, dates, scan, cost, receipt → Submit → verified (FLW-PLN-05) → the block is lifted.
4. Document types → [`DocumentTypes`](<../../Design Artifact/settings/MasterData.html#DocumentTypes>).

**FLW-SA-03 Keep a vehicle up to date** (REQ-VEH-003 to REQ-VEH-008, REQ-BSL-005).

1. [`VehicleOverview`](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) → "Edit vehicle" → [`VehicleEdit`](<../../Design Artifact/fleet/VehicleForm.html#VehicleEdit>) (class and layout only when no tyre is mounted and no SPK is open).
2. [`VehicleOdometer`](<../../Design Artifact/fleet/Vehicle.html#VehicleOdometer>): record a manual reading; a jump above 1.500 km per day warns. A wrong reading → "Void" → [`OdometerVoid`](<../../Design Artifact/fleet/Vehicle.html#OdometerVoid>) with a reason.
3. [`VehicleSPKHistory`](<../../Design Artifact/fleet/Vehicle.html#VehicleSPKHistory>) for past SPKs and cost.
4. Chassis and parts tab → "Correct baseline" → [`BaselineCorrect`](<../../Design Artifact/fleet/PartsBaseline.html#BaselineCorrect>) while no SPK has touched the part.
5. Sold or out of service → [`VehicleDeactivate`](<../../Design Artifact/fleet/VehicleForm.html#VehicleDeactivate>) (no open SPK).

**FLW-SA-04 Enter driver data in release 1** (REQ-PM-004, REQ-PM-005).

1. Vehicles → Inspections tab → [`VehicleInspections`](<../../Design Artifact/fleet/Vehicle.html#VehicleInspections>).
2. "+ Record inspection" → [`AdminInspectionForm`](<../../Design Artifact/fleet/FieldReports.html#AdminInspectionForm>) for the named driver; a Fail needs photo and description and drafts an SPK (FLW-PLN-02).
3. "Report breakdown" → [`AdminBreakdownForm`](<../../Design Artifact/fleet/FieldReports.html#AdminBreakdownForm>): location, description, photo; it drafts an SPK with source Driver\_Breakdown, pre-seeded with exactly one Mobilisasi step whose destination is the reported location, and the description copied as its field-finding note (REQ-SPK-003, DEC-90, DEC-91).

**FLW-SA-05 Master data** (REQ-REG-001, REQ-MEC-005, REQ-PLC-013, REQ-DOC-002, REQ-BSL-007, REQ-PM-006, REQ-TYR-003).

1. [`Settings`](<../../Design Artifact/settings/Settings.html#Settings>) → [`SettingsSPKPresets`](<../../Design Artifact/settings/SPKPresets.html#SettingsSPKPresets>), [`SettingsServiceCatalog`](<../../Design Artifact/settings/MasterData.html#SettingsServiceCatalog>), [`ChassisLayouts`](<../../Design Artifact/settings/ChassisLayouts.html#ChassisLayouts>), [`DocumentTypes`](<../../Design Artifact/settings/MasterData.html#DocumentTypes>), [`SettingsPartItemTypes`](<../../Design Artifact/settings/MasterData.html#SettingsPartItemTypes>), [`SettingsPMPackages`](<../../Design Artifact/settings/SPKPresets.html#SettingsPMPackages>), `SettingsAlertRules, SettingsAlertThresholds`, [`SettingsTyreStatuses`](<../../Design Artifact/settings/MasterData.html#SettingsTyreStatuses>).
2. Each page saves with its own audit record.

**FLW-SA-06 Oversight** (REQ-DSH-005, REQ-IAM-007).

1. [`DashboardAdmin`](<../../Design Artifact/dashboard/Dashboard.html#DashboardAdmin>): every role's waiting work and alerts.
2. [`AuditLog`](<../../Design Artifact/access/AuditLog.html#AuditLog>): every change with user and time; self-approvals and self-verifications are flagged.
3. The System Admin can run any flow above; it never opens Users and roles.

## 6.6 Access Manager (web)

**FLW-AM-01 Create an account** (REQ-IAM-002).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`UsersRoles`](<../../Design Artifact/access/UsersRoles.html#UsersRoles>) (the Access Manager's own area; no dashboard and no Settings) → "+ New account" → [`AMAccountForm`](<../../Design Artifact/access/UsersRoles.html#AMAccountForm>): name, email, one role → Save.

**FLW-AM-02 Change a role or its permissions** (REQ-IAM-002, REQ-IAM-005).

1. [`UsersRoles`](<../../Design Artifact/access/UsersRoles.html#UsersRoles>) → select the account → [`AMAccountForm`](<../../Design Artifact/access/UsersRoles.html#AMAccountForm>) → change the role → Save.
2. Roles and permissions tab → [`AMRolesPermissions`](<../../Design Artifact/access/UsersRoles.html#AMRolesPermissions>): switch the screens and actions a role has; locked cells cannot change.

**FLW-AM-03 Move the System Admin role** (REQ-IAM-004).

1. [`UsersRoles`](<../../Design Artifact/access/UsersRoles.html#UsersRoles>) → "Move System Admin role" → choose another active account, give a reason → confirm.
2. The new account becomes System Admin, the old one loses the role, and one audit record is written.

**FLW-AM-04 Lock, unlock or deactivate an account** (REQ-IAM-001, REQ-IAM-002).

1. [`UsersRoles`](<../../Design Artifact/access/UsersRoles.html#UsersRoles>) → select the account → [`AMAccountForm`](<../../Design Artifact/access/UsersRoles.html#AMAccountForm>) → Unlock (after failed sign-ins) or Deactivate. The System Admin account cannot be deactivated while it holds the role.

**FLW-AM-05 Review access changes** (REQ-IAM-007).

1. Access history tab → [`AMAccessHistory`](<../../Design Artifact/access/UsersRoles.html#AMAccessHistory>); full trail → [`AuditLog`](<../../Design Artifact/access/AuditLog.html#AuditLog>).

## 6.7 Driver (mobile, R1 step 7)

Until the mobile app ships in R1 step 7, the System Admin enters inspections and breakdowns for the driver (FLW-SA-04). Each inspection Fail and each breakdown drafts an SPK that appears in the Requests list of the Field Coordinator, System Admin and Planner (FLW-FC-04).

**FLW-DRV-01 Daily inspection** (REQ-MOB-003, REQ-PM-004).

1. [`MobileLogin`](<../../Design Artifact/mobile/MobileApp.html#MobileLogin>) → Driver menu → [`DashboardDriver`](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>): my vehicle, its status and document reminders.
2. Inspection → [`DriverInspection`](<../../Design Artifact/mobile/FieldReports.html#DriverInspection>): Pass or Fail per item, odometer; a Fail needs a photo and a description → Submit.
3. A Fail drafts an SPK for the Planner (FLW-PLN-02).

**FLW-DRV-02 Breakdown** (REQ-MOB-003, REQ-PM-005).

1. [`DashboardDriver`](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>) → "Report breakdown" → [`DriverBreakdown`](<../../Design Artifact/mobile/FieldReports.html#DriverBreakdown>): location (captured once from the phone), description, photo → Send. It drafts an SPK with source Driver\_Breakdown, pre-seeded with exactly one Mobilisasi step to the captured location, and the description copied as its field-finding note (REQ-SPK-003, REQ-MOB-003, DEC-90, DEC-91).

**FLW-DRV-03 Odometer** (REQ-MOB-003, REQ-VEH-005).

1. [`DashboardDriver`](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>) → "Record odometer" → [`DriverOdometer`](<../../Design Artifact/mobile/FieldReports.html#DriverOdometer>) → Save; a reading lower than the last one is refused, a jump above 1.500 km per day warns.

**FLW-DRV-04 History** (REQ-MOB-003, REQ-DOC-012).

1. History → [`DriverHistory`](<../../Design Artifact/mobile/FieldReports.html#DriverHistory>): past inspections, breakdowns and readings.
2. A Blocked vehicle shows a reminder on [`DashboardDriver`](<../../Design Artifact/mobile/FieldReports.html#DashboardDriver>) not to operate it.

## 6.8 Field Coordinator (web and mobile)

**FLW-FC-01 Check which vehicles can go on trips** (REQ-DSH-006, REQ-DOC-005).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`DashboardDispatcher`](<../../Design Artifact/dashboard/Dashboard.html#DashboardDispatcher>): Active, Repair and Blocked counts, vehicles that are not available with the reason and planned day, today's workshop list.
2. Open a vehicle → [`VehicleOverview`](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) and [`VehicleDocuments`](<../../Design Artifact/fleet/Vehicle.html#VehicleDocuments>), read only.

**FLW-FC-02 Follow the maintenance schedule** (REQ-SCH-004, REQ-SCH-005).

1. Schedule → [`ScheduleDispatcher`](<../../Design Artifact/schedule/Schedule.html#ScheduleDispatcher>): the Planner's calendar, read only; cards cannot be moved.
2. A card placed, moved or missed → notification → [`NotificationCenter`](<../../Design Artifact/shell/Notifications.html#NotificationCenter>) → opens the schedule.

**FLW-FC-03 Mobile app (R1 step 7)** (REQ-MOB-006, REQ-NTF-002).

1. [`MobileLogin`](<../../Design Artifact/mobile/MobileApp.html#MobileLogin>) → Field Coordinator menu → [`DispatcherMobileFleet`](<../../Design Artifact/mobile/Fleet.html#DispatcherMobileFleet>) (availability).
2. Schedule → [`DispatcherMobileSchedule`](<../../Design Artifact/mobile/Fleet.html#DispatcherMobileSchedule>) (week list per day, read only).
3. Alerts → [`DispatcherMobileAlerts`](<../../Design Artifact/mobile/MobileApp.html#DispatcherMobileAlerts>); each alert also arrives as a push notification.

**FLW-FC-04 Turn a driver request into an SPK** (REQ-SPK-014, REQ-SPK-001, RL-6).

1. [`DashboardDispatcher`](<../../Design Artifact/dashboard/Dashboard.html#DashboardDispatcher>) → Requests → [`FCRequests`](<../../Design Artifact/spk/Requests.html#FCRequests>): Draft SPKs from inspections, breakdowns and field findings, with the report photos.
2. Open one → [`FCCreateSPK`](<../../Design Artifact/spk/CreateSPK.html#FCCreateSPK>): vehicle and source prefilled; choose a suggested category, write the description, list the parts needed → Send to Planner, who adds the steps. Or "+ Create SPK" for a new request the driver phoned in (source Manual\_Field\_Coordinator).
3. The Planner checks it, may change it, and submits it; it then waits for a Supervisor or GM (FLW-APR-01). The Field Coordinator cannot submit or approve it. On the phone: [`FCMobileRequests`](<../../Design Artifact/mobile/Requests.html#FCMobileRequests>) → [`FCMobileCreateSPK`](<../../Design Artifact/mobile/Requests.html#FCMobileCreateSPK>).

**FLW-FC-05 Buy parts for an SPK** (REQ-PUR-001 to 008).

1. Purchase alert → [`PartPurchase`](<../../Design Artifact/steps/PartPurchase.html#PartPurchase>) (web) or Purchases → [`FCMobilePurchase`](<../../Design Artifact/mobile/PartPurchase.html#FCMobilePurchase>) (phone), with the suggested items.
2. Start → pick the vendor, type receipt number and date, type the quantity bought and unit price of each listed part and take the receipt photo; the total is calculated as you type. No part can be added to the list (DEC-63).
3. Submit step; the next step opens (BR-05).

## 6.8a System Admin field menu (mobile, R1 step 7)

**FLW-SA-07 Field work on the phone** (REQ-MOB-008, REQ-MBL-005).

1. [`MobileLogin`](<../../Design Artifact/mobile/MobileApp.html#MobileLogin>) → System Admin field menu → [`SAMobileHome`](<../../Design Artifact/mobile/MobileApp.html#SAMobileHome>): requests, purchases and open steps.
2. Requests and Purchases work as FLW-FC-04 and FLW-FC-05.
3. Steps → [`MechanicMobileStep`](<../../Design Artifact/mobile/MechanicAction.html#MechanicMobileStep>) → Start. A Mobilisasi step shows the route to the driver's captured location, records the location trail while In\_Progress and submits on arrival or with Finish stooring; its stooring area and fee come from the destination (REQ-MBL-002 to 006). A Mechanic Action step takes services and photos and has no stooring area (DEC-90) → Submit. Either is marked Self-verified if the System Admin later verifies it.

## 6.8b Accounting (web)

**FLW-ACC-01 Issue the daily invoices** (REQ-BIL-002 to 005, REQ-BIL-007).

1. [`WebLogin`](<../../Design Artifact/shell/SignIn.html#WebLogin>) → [`DashboardAccounting`](<../../Design Artifact/dashboard/Dashboard.html#DashboardAccounting>): drafts waiting, overdue, not billable.
2. Invoices → [`InvoiceList`](<../../Design Artifact/billing/Invoices.html#InvoiceList>) (Draft tab): one draft per vehicle per day.
3. Open → [`InvoiceDetail`](<../../Design Artifact/billing/Invoices.html#InvoiceDetail>): check the part and service lines, add an adjustment if needed → Issue → Print → [`InvoiceDocument`](<../../Design Artifact/billing/InvoiceDocument.html#InvoiceDocument>) (black and white).

**FLW-ACC-02 Record a payment or void** (REQ-BIL-006).

1. [`InvoiceList`](<../../Design Artifact/billing/Invoices.html#InvoiceList>) (Issued tab) → [`InvoiceDetail`](<../../Design Artifact/billing/Invoices.html#InvoiceDetail>) → Record payment → [`InvoicePayment`](<../../Design Artifact/billing/Invoices.html#InvoicePayment>) → Save; the invoice is Paid.
2. A wrong invoice: Void → [`InvoiceVoid`](<../../Design Artifact/billing/Invoices.html#InvoiceVoid>) with a reason; its SPKs move to a new Draft.

**FLW-ACC-03 Maintain customers** (REQ-BIL-001, REQ-BIL-009).

1. Customers → [`Customers`](<../../Design Artifact/billing/Customers.html#Customers>) → "+ Add customer" or open one → [`CustomerForm`](<../../Design Artifact/billing/Customers.html#CustomerForm>) → Save.
2. [`InvoiceList`](<../../Design Artifact/billing/Invoices.html#InvoiceList>) (Not billable tab): SPKs of vehicles without a customer; set the customer on the vehicle and the SPKs move to a Draft.

## 6.8c Planner approval switch and early failure

**FLW-AM-06 Let Planners approve for a while** (REQ-IAM-008, RL-7).

1. Access Manager → [`AMRolesPermissions`](<../../Design Artifact/access/UsersRoles.html#AMRolesPermissions>) → Planner approval → On, with a reason and an end time → Save; Supervisors and GMs are notified.
2. Planners now see Approvals and decide SPKs they did not create (FLW-APR-01). At the end time the switch turns off by itself.

**FLW-APR-08 Early failure on a review** (REQ-APR-011, REQ-BSL-009).

1. [`ApprovalReview`](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>) (or [`SupervisorMobileReview`](<../../Design Artifact/mobile/Approvals.html#SupervisorMobileReview>)): the Part age card flags Early failure with life used against normal life.
2. The Approver decides as usual; the SPK is never blocked. The event appears on the GM dashboard ([`Dashboard`](<../../Design Artifact/dashboard/Dashboard.html#Dashboard>)) and the Planner reviews the normal life in [`SettingsPartItemTypes`](<../../Design Artifact/settings/MasterData.html#SettingsPartItemTypes>).

## 6.8d Setup, master data and assignment

**FLW-SA-08 Set up and go live** (REQ-IAM-010, REQ-INV-013).

1. First sign-in of the System Admin → [`SetupGoLive`](<../../Design Artifact/setup/SetupGoLive.html#SetupGoLive>) (Setup mode): checklist of what is in the system.
2. Enter master data in [`Settings`](<../../Design Artifact/settings/Settings.html#Settings>), vehicles in [`AddVehicle`](<../../Design Artifact/fleet/VehicleForm.html#AddVehicle>), documents, tyres in [`ReceiveTyres`](<../../Design Artifact/inventory/TyreReceive.html#ReceiveTyres>) (source Existing), [`PartsBaseline`](<../../Design Artifact/fleet/PartsBaseline.html#PartsBaseline>) and [`OpeningBalance`](<../../Design Artifact/inventory/StockOpname.html#OpeningBalance>); nothing needs approval.
3. Back on [`SetupGoLive`](<../../Design Artifact/setup/SetupGoLive.html#SetupGoLive>): type GO LIVE → Go live now. Every role can now sign in and every approval applies.

**FLW-SA-09 Maintain vendors** (REQ-INV-014).

1. [`Settings`](<../../Design Artifact/settings/Settings.html#Settings>) → Vendors → [`SettingsVendors`](<../../Design Artifact/settings/MasterData.html#SettingsVendors>) → "+ Add vendor" or select one → Save. The vendor appears in Goods Receipts, Part Purchase steps, external services and retread dispatches.

**FLW-SA-10 Set a vehicle's driver** (REQ-VEH-010).

1. System Admin or Field Coordinator: [`VehicleOverview`](<../../Design Artifact/fleet/Vehicle.html#VehicleOverview>) → Driver → Change → pick the driver → Save. Both drivers are notified and the driver app shows the new vehicle.

**FLW-PLN-09 Assign a step** (REQ-ENG-011).

1. [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) → a step card → Assign (or Reassign with a reason) → pick a user of the step's executor role. The assignee is notified.
2. Without an assignment, the first executor who opens the step claims it; others see it read only. The assignee can Release it with a reason; the draft stays with the step.

**FLW-WHM-10 Receive parts of a cancelled SPK** (REQ-SPK-008).

1. Notification → [`GoodsReceiptForm`](<../../Design Artifact/inventory/GoodsReceipt.html#GoodsReceiptForm>) with type From cancelled SPK, prefilled with the Part Purchase items and prices; map each to a SKU or mark it not kept → Post receipt.

## 6.8e Step time, troubleshooting, mobilisation and OFF units

**FLW-MEC-10 Send a field finding for review on the web** (REQ-SPK-016, DEC-91, DEC-97).

1. Surat Perintah Kerja → "+ Create SPK" → [`FCCreateSPK`](<../../Design Artifact/spk/CreateSPK.html#FCCreateSPK>), the same request screen the Field Coordinator uses (DEC-97): vehicle, suggested category, description, the field-finding note (required), the parts needed and photos; no steps.
2. Send to Planner: the SPK stays Draft, marked Sent for review, with source Manual\_Mechanic and the Mechanic as creator; the Planners and the System Admin are notified, and the Planner continues as in FLW-FC-04 step 3. The Mechanic cannot submit or approve it.

**FLW-MEC-07 Start, pause and resume a step** (REQ-ENG-012 to REQ-ENG-016, DEC-87).

1. Open a step that tracks work time: the form is read only and the waiting time runs from the moment the step opened; opening, viewing or Save draft never starts it.
2. Start, or "I started earlier" for a forgotten Start: up to 2 hours back and never before the step opened, with a reason; the start is marked entered.
3. Pause with a reason (Waiting for parts, Waiting for the vehicle, Waiting for vendor or agency, Break or shift ended, Other): work time stops, the form is read only and Submit is unavailable. Resume unlocks it at once. A change request pauses the step by itself with reason Change request and resumes it when the request is decided (FLW-MEC-05).
4. Submit. A wrong time is corrected only by the System Admin on [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>) (Correct time, with a reason and an audit record). A module that does not track work time, such as Part Replacement, skips this flow (DEC-95).

**FLW-MEC-08 Do a Part Check step** (REQ-CHK-001, REQ-CHK-002, REQ-CHK-005, REQ-CHK-007, DEC-88, DEC-89).

1. [`DashboardMechanic`](<../../Design Artifact/dashboard/Dashboard.html#DashboardMechanic>), "My steps" → Open → Start → [`PartCheck`](<../../Design Artifact/steps/PartCheck.html#PartCheck>): one card per part the Planner listed, with what to check.
2. For each part write the condition, choose Good, Repair or Replace and add at least one photo; a Repair or Replace part may be marked Unsafe to drive. Parts not on the list may be added (Added by mechanic) under the same rules.
3. Record the check service: for an internal team at least one catalog service of category Diagnosis at its fixed price (a free check uses a Rp 0 service); for an external workshop the vendor, description, price and invoice image. Stooring for a field check comes from the SPK's Mobilisasi step (FLW-MEC-09), not from this step.
4. Submit; it is refused until every part is complete. A part marked Unsafe to drive notifies the Planner, Supervisor and Field Coordinators and shows a warning on the vehicle and the schedule; it never blocks the vehicle.

**FLW-PLN-10 Turn a Part Check into a repair SPK** (REQ-CHK-003, REQ-CHK-004, REQ-CHK-006).

1. Verify the Part Check step in [`PartCheckVerify`](<../../Design Artifact/steps/StepVerify.html#PartCheckVerify>) (as FLW-PLN-05). When at least one part is Repair or Replace, the system creates one Draft SPK with source Part\_Check for the same vehicle, priority Urgent when a part is Unsafe to drive, with its steps built from the findings; when every part is Good, no draft is made.
2. Open the draft → [`CreateSPKFromCheck`](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromCheck>): the findings and their photos are carried over; change the steps as in any SPK.
3. Activate: submit for approval; the SPK becomes Active only after an Approver approves it (FLW-APR-01), and the activating user counts as its creator for BR-03. Or Discard draft with a reason; the draft keeps its link to the check and is never made again for that step.
4. The check SPK completes and is billed on its own; [`SPKDocumentCheck`](<../../Design Artifact/spk/SPKDocument.html#SPKDocumentCheck>) prints the Part Check section with the follow-up SPK number for reference.

**FLW-MEC-09 Mobilisasi to a broken-down vehicle** (REQ-MBL-001 to REQ-MBL-006, REQ-SPK-003, DEC-90).

1. A breakdown (FLW-DRV-02, FLW-SA-04) drafts an SPK pre-seeded with one Mobilisasi step to the driver's captured location; the Planner adds the other steps in [`CreateSPK`](<../../Design Artifact/spk/CreateSPK.html#CreateSPK>), where Mobilisasi is also in the module palette, and submits it (FLW-PLN-01, FLW-APR-01).
2. When the step opens, the executor opens it on the phone ([`MobilisasiMobile`](<../../Design Artifact/mobile/Mobilisasi.html#MobilisasiMobile>), or [`MechanicMobileStep`](<../../Design Artifact/mobile/MechanicAction.html#MechanicMobileStep>) from the System Admin field menu, FLW-SA-07) and presses Start: the map shows the route to the destination, and the location trail is recorded while the step is In\_Progress and online.
3. Reaching the destination submits the step by itself; Finish stooring submits it before arrival. Recording stops at submit.
4. The stooring fee of the destination's area is charged as a snapshot: once per SPK per area per day, Rp 0 for the workshop. The Planner or System Admin sees the trail and the stooring duration in [`StepVerify`](<../../Design Artifact/steps/StepVerify.html#StepVerify>) and the SPK detail; every view is written to the access log. The trail never appears on the SPK document or the invoice.

**FLW-APR-09 Follow an SPK that overruns its planned day** (REQ-SCH-003, REQ-SCH-007, REQ-BIL-003, SM-VEH, DEC-92).

1. The daily job at 00:30 WIB finds a scheduled SPK not Completed after its planned day: the card is marked Missed, flagged rolled-over / late and moved to the next day (FLW-PLN-04). The SPK creator, the executor of its open step, the Planners, the Field Coordinators and the GM get a late alert, again every morning until the SPK is Completed, Cancelled or moved.
2. If that SPK's first step had already started (the vehicle was in Repair), the vehicle becomes OFF and the SPK's OFF days rise by one per WIB day, counted once even when the job runs twice. OFF never blocks or changes the SPK (BR-13) and does not block SPK creation or amendment.
3. When the SPK is Completed or Cancelled the vehicle leaves OFF. The invoice draft of a completed SPK carries an Off\_Unit line, OFF days × the OFF-unit daily rate from Settings, at cost without markup (FLW-ACC-01).

## 6.9 Cross-role flow: a PM service from alert to SPK document

| Order | Role | Action | Screens | Transition |
| --- | --- | --- | --- | --- |
| 1 | System | Odometer reaches the PM interval and raises a PM alert | [`DashboardPlanner`](<../../Design Artifact/dashboard/Dashboard.html#DashboardPlanner>) |  |
| 2 | Planner | Creates the SPK from the alert and submits it | [`CreateSPKFromAlert`](<../../Design Artifact/spk/CreateSPK.html#CreateSPKFromAlert>) | T1, T2 |
| 3 | Supervisor or GM | Approves creation | [`Approvals`](<../../Design Artifact/approvals/Approvals.html#Approvals>), [`ApprovalReview`](<../../Design Artifact/approvals/ApprovalReview.html#ApprovalReview>) | T3 |
| 4 | Planner | Places the SPK on a day; the Field Coordinator is alerted | [`MaintenanceSchedule`](<../../Design Artifact/schedule/Schedule.html#MaintenanceSchedule>), [`ScheduleDispatcher`](<../../Design Artifact/schedule/Schedule.html#ScheduleDispatcher>) |  |
| 5 | Warehouse Manager | Issues parts and tyres in the Stock step | [`Stock`](<../../Design Artifact/steps/Stock.html#Stock>) | T7 |
| 6 | Planner | Verifies step 1 | [`SPKDetailVerify`](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>), [`StepVerify`](<../../Design Artifact/steps/StepVerify.html#StepVerify>) |  |
| 7 | [Mechanic](<../../Design Artifact/steps/MechanicAction.html#Mechanic>) | Does the service and fits the tyres | [`Mechanic`](<../../Design Artifact/steps/MechanicAction.html#Mechanic>), [`Placement`](<../../Design Artifact/steps/Placement.html#Placement>), [`PlacementReplace`](<../../Design Artifact/steps/Placement.html#PlacementReplace>) | T11 |
| 8 | Planner | Verifies steps 2 and 3, requests completion | [`SPKDetailVerify`](<../../Design Artifact/spk/SPKDetail.html#SPKDetailVerify>), [`StepVerify`](<../../Design Artifact/steps/StepVerify.html#StepVerify>) |  |
| 9 | Supervisor or GM | Approves completion | [`CompletionReview`](<../../Design Artifact/approvals/ApprovalReview.html#CompletionReview>) | T13 |
| 10 | All | The SPK is Completed; the vehicle is Active again | [`SPKDetail`](<../../Design Artifact/spk/SPKDetail.html#SPKDetail>), [`SPKDocument`](<../../Design Artifact/spk/SPKDocument.html#SPKDocument>), [`VehicleSPKHistory`](<../../Design Artifact/fleet/Vehicle.html#VehicleSPKHistory>) |  |

Side paths: a wrong part list (FLW-MEC-05, FLW-PLN-06, FLW-APR-02), a returned step (FLW-PLN-05, FLW-MEC-04), a rejection (FLW-APR-01, FLW-PLN-03), a cancellation (FLW-APR-05) and a reversal (FLW-WHM-02).
