# 9. Data model

> Part of the BMI Stooring System spec (§9 data model). Core rules, roles, state machines, business rules and decisions: [PRD.md](../../PRD.md). Section numbers and IDs are unchanged from the single-file PRD v2.4.


This is the final schema in PostgreSQL syntax, the database of 8.2; any relational database with transactions can implement it. It already includes every later decision, so there are no ALTER steps to replay. File columns (file\_url, photo\_url, receipt\_url) hold the storage\_key of a Ready row in stored\_files (9.12), never a public URL (8.1, NFR-13). Tables appear in dependency order except where 9.13 notes a circular key.

## 9.0 Conventions

- Every table has `id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY`, `created_at TIMESTAMP NOT NULL DEFAULT now()` and `updated_at TIMESTAMP`; they are left out below.
- `-- SD` = soft delete (`deleted_at TIMESTAMP`); unique indexes on such tables ignore deleted rows. Every foreign key is `ON DELETE RESTRICT`.
- `-- OL` = optimistic lock (`version INT NOT NULL DEFAULT 1`).
- `-- AO` = append-only: no UPDATE or DELETE is allowed.
- Money `NUMERIC(14,2)`, unit cost `NUMERIC(14,4)`; dates `DATE`, timestamps `TIMESTAMP`.
- `-- guard` = also enforced in the service layer (section 5); the database check is the second line of defence.

## 9.1 Enumerations

```sql
CREATE TYPE role_t            AS ENUM ('Planner','Mechanic','Warehouse_Manager','Supervisor','GM','System_Admin','Access_Manager','Driver','Field_Coordinator','Accounting');
CREATE TYPE vehicle_status_t  AS ENUM ('Active','Repair','Blocked','OFF','Inactive');   -- OFF: a scheduled SPK ran past its planned day while in Repair (SM-VEH, DEC-92)
CREATE TYPE doc_status_t      AS ENUM ('Valid','Warning','Expired','Missing');
CREATE TYPE odo_source_t      AS ENUM ('Admin','Driver','GPS');
CREATE TYPE trigger_t         AS ENUM ('Mileage','Time');
CREATE TYPE alert_type_t      AS ENUM ('PM','Part_Item','Tyre','Document');
CREATE TYPE alert_status_t    AS ENUM ('Pending','Converted_To_WO','Dismissed');
CREATE TYPE wo_status_t       AS ENUM ('Draft','Pending_Approval','Rejected','Active','In_Progress','Pending_Verification','Pending_Amendment','Completed','Cancelled');
CREATE TYPE wo_source_t       AS ENUM ('System_PM','Tyre_Alert','Document_Alert','Driver_DVIR','Driver_Breakdown','Part_Check','Manual_Planner','Manual_Mechanic','Manual_Field_Coordinator','Manual_Admin');
CREATE TYPE wo_category_t     AS ENUM ('PM','Corrective','Tyre','Document','Other');   -- DEC-85
CREATE TYPE asg_status_t      AS ENUM ('Locked','Open','In_Progress','Submitted','Verified','Skipped');
CREATE TYPE approval_stage_t  AS ENUM ('Creation','Completion','Amendment');
CREATE TYPE approval_action_t AS ENUM ('Submit','Approve','Reject','Cancel','Request_Completion');
CREATE TYPE cr_status_t       AS ENUM ('Submitted','In_Revision','Pending_Approval','Approved','Rejected');
CREATE TYPE part_source_t     AS ENUM ('Warehouse');   -- the Stock step cuts stock only; outside purchases live in work_order_purchases (DEC-60)
CREATE TYPE invoice_status_t  AS ENUM ('Draft','Issued','Paid','Void');
CREATE TYPE location_capture_t AS ENUM ('Captured','Denied','Unavailable');
CREATE TYPE team_t            AS ENUM ('Internal','External');
CREATE TYPE attachment_t      AS ENUM ('Invoice','Repair_Photo','Document_Scan','Receipt','DVIR_Photo','Check_Photo');
CREATE TYPE tyre_type_t       AS ENUM ('Tube','Tubeless');
CREATE TYPE placement_act_t   AS ENUM ('Baseline','Mount','Rotate','Demount','Scrap');
CREATE TYPE stock_tx_t        AS ENUM ('OB','GR','GRC','GI','GIR','SA');   -- opening balance, receipt, receipt correction, issue, issue reversal, stock opname
CREATE TYPE reason_t          AS ENUM ('Damaged','Entry_Error','Lost','Found');
CREATE TYPE ai_provider_t     AS ENUM ('OpenAI','Anthropic');
-- Modules and tyre statuses are rows, not enums: assignment_modules (9.6), tyre_statuses (9.9).
```

## 9.2 Identity, access and audit

```sql
CREATE TABLE users (                          -- SD
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_logins SMALLINT NOT NULL DEFAULT 0,
  must_change_password BOOLEAN NOT NULL DEFAULT true,   -- REQ-IAM-009
  locked_until TIMESTAMP                      -- 5 failed sign-ins lock 15 minutes [A]
);
CREATE TABLE user_roles (
  user_id BIGINT NOT NULL REFERENCES users(id),
  role role_t NOT NULL,
  PRIMARY KEY (user_id, role)
);
CREATE UNIQUE INDEX uq_one_role_per_user ON user_roles (user_id);                            -- BR-14
CREATE UNIQUE INDEX uq_one_system_admin  ON user_roles (role) WHERE role = 'System_Admin';   -- BR-14
CREATE TABLE role_permissions (               -- [A] permission matrix of 2.2, edited by the Access Manager
  role role_t NOT NULL,
  permission_code VARCHAR(60) NOT NULL,       -- for example wo.create, wo.approve, stock.issue
  allowed BOOLEAN NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,   -- fixed by a business rule; cannot be changed
  PRIMARY KEY (role, permission_code)
);
CREATE TABLE audit_logs (                     -- AO
  entity VARCHAR(60) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(40) NOT NULL,
  before JSONB,
  after JSONB,
  reason TEXT,
  user_id BIGINT REFERENCES users(id),
  user_role role_t,
  self_decision BOOLEAN NOT NULL DEFAULT false,   -- Self-approved or Self-verified
  at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit_logs (entity, entity_id);
-- Moving System_Admin (Access_Manager only): one transaction deletes the old user_roles row, inserts the new one, writes audit_logs.
-- Service layer: refuse to deactivate or soft-delete the user who holds System_Admin.
```

## 9.3 Fleet, chassis and odometer

```sql
CREATE TABLE chassis_layouts (
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  definition JSONB NOT NULL,                  -- axles in order: role (Steer, Drive, Trailer), tyres per side (1 or 2), spacing; front drawing (None, Fifth_wheel, Kingpin); spare_count (REQ-PLC-017)
  axle_count SMALLINT NOT NULL CHECK (axle_count > 0),
  tyre_count SMALLINT NOT NULL CHECK (tyre_count > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (code, version)
);
CREATE TABLE vehicle_classes (
  code VARCHAR(30) NOT NULL UNIQUE,           -- Tractor_Head, Trailer_Tail, Wingbox_Rigid, Pickup_Patrol, Light_Van, future classes
  unit_kind VARCHAR(7) NOT NULL DEFAULT 'Powered' CHECK (unit_kind IN ('Powered','Towed')),   -- Towed: no odometer, days only (REQ-PLC-018)
  name VARCHAR(100) NOT NULL,
  default_chassis_layout_id BIGINT NOT NULL REFERENCES chassis_layouts(id),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE part_positions (                 -- generated from a layout's definition when the layout is saved
  chassis_layout_id BIGINT NOT NULL REFERENCES chassis_layouts(id),
  code VARCHAR(40) NOT NULL,                  -- for example A2_LO
  position_kind VARCHAR(5) NOT NULL DEFAULT 'Wheel' CHECK (position_kind IN ('Wheel','Spare')),   -- REQ-PLC-019
  axle_index SMALLINT,                        -- NULL for a Spare position
  side VARCHAR(5) CHECK (side IN ('Left','Right')),   -- NULL for a Spare position
  CHECK (position_kind = 'Spare' OR (axle_index IS NOT NULL AND side IS NOT NULL)),
  ordinal SMALLINT NOT NULL,                  -- inner or outer on a dual axle
  label VARCHAR(80) NOT NULL,
  UNIQUE (chassis_layout_id, code)
);
CREATE TABLE vehicles (                       -- SD, OL
  license_plate VARCHAR(20) NOT NULL UNIQUE,
  vin VARCHAR(30) UNIQUE,
  engine_number VARCHAR(30),
  vehicle_class_id BIGINT NOT NULL REFERENCES vehicle_classes(id),
  chassis_layout_id BIGINT NOT NULL REFERENCES chassis_layouts(id),   -- layout version in use
  brand VARCHAR(50), model VARCHAR(50), year SMALLINT,
  fuel_type VARCHAR(20),
  customer_id BIGINT REFERENCES customers(id),   -- REQ-BIL-001; NULL = not billable (9.14)
  current_odometer INT NOT NULL DEFAULT 0 CHECK (current_odometer >= 0),   -- latest reading that is not voided, mainly from the Driver's daily inspection (DEC-76); stays 0 for a Towed unit (REQ-PLC-018); axle and tyre counts are read from the layout (DEC-80)
  status vehicle_status_t NOT NULL DEFAULT 'Active',                       -- derived (SM-VEH)
  deactivated_at TIMESTAMP,
  deactivate_reason TEXT,
  version INT NOT NULL DEFAULT 1
);
CREATE TABLE drivers (                        -- SD
  user_id BIGINT UNIQUE REFERENCES users(id), -- the driver's mobile account (R1 step 7); NULL until it is created
  name VARCHAR(100) NOT NULL,
  assigned_vehicle_id BIGINT REFERENCES vehicles(id)
);
CREATE TABLE odometer_logs (
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  reading INT NOT NULL CHECK (reading > 0),
  reading_at TIMESTAMP NOT NULL,              -- when it was read, not when entered
  source odo_source_t NOT NULL,
  note TEXT,
  jump_warning BOOLEAN NOT NULL DEFAULT false,   -- more than 1.500 km per day
  recorded_by BIGINT REFERENCES users(id),
  void_requested_by BIGINT REFERENCES users(id), -- [A]
  voided_at TIMESTAMP,
  voided_by BIGINT REFERENCES users(id),      -- must hold System_Admin
  void_reason TEXT,
  CHECK (voided_at IS NULL OR (voided_by IS NOT NULL AND void_reason IS NOT NULL))
);
-- trigger (BR-09): reading >= the last reading of the vehicle WHERE voided_at IS NULL; then refresh vehicles.current_odometer
```

## 9.4 Documents

```sql
CREATE TABLE document_types (
  code VARCHAR(30) NOT NULL UNIQUE,           -- STNK_Annual, STNK_5Year, KIR, Insurance, ...
  name VARCHAR(100) NOT NULL,
  usual_validity_months SMALLINT,             -- prefills the new expiry on renewal (REQ-DOC-007)
  warning_days SMALLINT NOT NULL DEFAULT 30 CHECK (warning_days > 0),  -- also edited in Settings: Alert rules (DEC-86)
  preset_id BIGINT REFERENCES wo_presets(id), -- preset of the SPK its expiry alert drafts (REQ-PM-008)
  receipt_required BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE document_type_classes (          -- which classes must have the type
  document_type_id BIGINT NOT NULL REFERENCES document_types(id),
  vehicle_class_id BIGINT NOT NULL REFERENCES vehicle_classes(id),
  PRIMARY KEY (document_type_id, vehicle_class_id)
);
CREATE TABLE vehicle_documents (              -- SD, the current document per type
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  document_type_id BIGINT NOT NULL REFERENCES document_types(id),
  document_number VARCHAR(60) NOT NULL,
  issuer VARCHAR(150),
  issue_date DATE,
  expiry_date DATE NOT NULL,
  status doc_status_t NOT NULL DEFAULT 'Valid',   -- set by the daily job; Missing is derived for a required type with no row
  file_url VARCHAR(500) NOT NULL
);
CREATE UNIQUE INDEX uq_vehicle_doc ON vehicle_documents (vehicle_id, document_type_id) WHERE deleted_at IS NULL;
CREATE TABLE document_corrections (           -- Correct entry, only before the first renewal
  vehicle_document_id BIGINT NOT NULL REFERENCES vehicle_documents(id),
  field VARCHAR(30) NOT NULL,
  old_value TEXT, new_value TEXT,
  reason TEXT NOT NULL,
  corrected_by BIGINT NOT NULL REFERENCES users(id),   -- must hold System_Admin
  corrected_at TIMESTAMP NOT NULL DEFAULT now()
);   -- guard: refused when document_renewals has a row for the document
CREATE TABLE document_view_logs (             -- AO
  vehicle_document_id BIGINT NOT NULL REFERENCES vehicle_documents(id),
  action VARCHAR(10) NOT NULL CHECK (action IN ('View','Download')),
  user_id BIGINT NOT NULL REFERENCES users(id),
  at TIMESTAMP NOT NULL DEFAULT now()
);
-- document_renewals is in 9.6 because it references work_orders
```

## 9.5 Maintenance rules, part items, alerts and inspections

```sql
CREATE TABLE pm_packages (
  vehicle_class_id BIGINT NOT NULL REFERENCES vehicle_classes(id),   -- each package belongs to one class (DEC-70)
  package_code VARCHAR(20) NOT NULL,          -- PM-1, PM-2, PM-3, PM-HILUX, PM-TRAILER
  package_name VARCHAR(100) NOT NULL,
  interval_km INT CHECK (interval_km > 0),     -- NULL for a Towed class (REQ-PLC-018)
  interval_days INT NOT NULL CHECK (interval_days > 0),
  preset_id BIGINT NOT NULL REFERENCES wo_presets(id),   -- steps drafted for this package's alerts (REQ-REG-007, REQ-WO-012)
  UNIQUE (vehicle_class_id, package_code),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE pm_tasks (
  package_id BIGINT NOT NULL REFERENCES pm_packages(id),
  task_description TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE vehicle_pm_schedule (            -- state for the km-or-days trigger
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  package_id BIGINT NOT NULL REFERENCES pm_packages(id),
  last_done_odometer INT NOT NULL DEFAULT 0,
  last_done_date DATE NOT NULL,
  next_due_km INT NOT NULL,
  next_due_date DATE NOT NULL,
  UNIQUE (vehicle_id, package_id)
);
CREATE TABLE part_item_types (                -- tracked service parts
  code VARCHAR(30) NOT NULL UNIQUE,           -- ENGINE_OIL, OIL_FILTER, BRAKE_PADS_FRONT, BATTERY, ...
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,              -- Lubricant, Filter, Brake, Fluid, Electrical
  default_life_km INT, default_life_days INT,  -- normal life, set by the Planner or System Admin
  early_failure_pct SMALLINT NOT NULL DEFAULT 80 CHECK (early_failure_pct BETWEEN 1 AND 100),   -- REQ-BSL-009 [A]
  pm_package_id BIGINT REFERENCES pm_packages(id),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE part_item_type_classes (
  part_item_type_id BIGINT NOT NULL REFERENCES part_item_types(id),
  vehicle_class_id BIGINT NOT NULL REFERENCES vehicle_classes(id),
  PRIMARY KEY (part_item_type_id, vehicle_class_id)
);
CREATE TABLE vehicle_part_items (             -- baseline and current state of each service part
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  part_item_type_id BIGINT NOT NULL REFERENCES part_item_types(id),
  sku VARCHAR(40) REFERENCES parts_catalog(sku),
  last_replaced_date DATE NOT NULL,
  last_replaced_odometer INT NOT NULL CHECK (last_replaced_odometer >= 0),
  life_km INT, life_days INT,                 -- copied from the type, editable per vehicle
  next_due_km INT, next_due_date DATE,
  source VARCHAR(10) NOT NULL DEFAULT 'Baseline' CHECK (source IN ('Baseline','Work_Order')),
  last_work_order_id BIGINT REFERENCES work_orders(id),   -- set once an SPK touched it; Correct baseline is then refused
  UNIQUE (vehicle_id, part_item_type_id),
  CHECK (source = 'Baseline' OR last_work_order_id IS NOT NULL)
);
CREATE TABLE early_failure_events (           -- AO, REQ-BSL-009; never blocks an SPK
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  part_item_id BIGINT REFERENCES vehicle_part_items(id),
  tyre_id BIGINT REFERENCES tyres(id),
  stage VARCHAR(10) NOT NULL CHECK (stage IN ('Submitted','Completed')),
  km_used INT NOT NULL, days_used INT NOT NULL,
  life_km INT, life_days INT,
  life_used_pct NUMERIC(5,1) NOT NULL,         -- larger of km and days ratio
  tolerance_pct SMALLINT NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT now(),
  CHECK (part_item_id IS NOT NULL OR tyre_id IS NOT NULL)
);
CREATE TABLE maintenance_alerts (
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  alert_type alert_type_t NOT NULL,
  package_id BIGINT REFERENCES pm_packages(id),             -- PM
  part_item_id BIGINT REFERENCES vehicle_part_items(id),    -- Part_Item
  tyre_id BIGINT REFERENCES tyres(id),                      -- Tyre (tread below threshold)
  vehicle_document_id BIGINT REFERENCES vehicle_documents(id),   -- Document
  trigger_reason trigger_t,                   -- which limit came first (PM, Part_Item)
  alert_date DATE NOT NULL,
  status alert_status_t NOT NULL DEFAULT 'Pending',
  CHECK ((alert_type = 'PM' AND package_id IS NOT NULL) OR (alert_type = 'Part_Item' AND part_item_id IS NOT NULL)
      OR (alert_type = 'Tyre' AND tyre_id IS NOT NULL) OR (alert_type = 'Document' AND vehicle_document_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_open_pm_alert   ON maintenance_alerts (vehicle_id, package_id) WHERE status = 'Pending' AND package_id IS NOT NULL;
CREATE UNIQUE INDEX uq_open_part_alert ON maintenance_alerts (part_item_id) WHERE status = 'Pending' AND part_item_id IS NOT NULL;
CREATE UNIQUE INDEX uq_open_tyre_alert ON maintenance_alerts (tyre_id) WHERE status = 'Pending' AND tyre_id IS NOT NULL;
CREATE TABLE alert_rules (                    -- SD, one row per alert kind; Settings: Alert rules (DEC-86)
  rule_kind VARCHAR(20) NOT NULL UNIQUE CHECK (rule_kind IN ('PM','Document','Tyre','Part_Item','Inspection_Fail','Breakdown','Field_Report')),
  drafts_wo BOOLEAN NOT NULL DEFAULT true,    -- false = Show the alert only
  draft_at VARCHAR(12) CHECK (draft_at IN ('Due_Soon','Due','Warning','Expiry','Act_Now')),
  preset_id BIGINT REFERENCES wo_presets(id), -- Tyre, Part_Item and reported problems; NULL = no preset, the Planner adds steps; PM uses pm_packages.preset_id, Document uses document_types.preset_id
  priority VARCHAR(6) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Normal','High','Urgent')),
  notify_roles role_t[] NOT NULL DEFAULT '{Planner}',
  trigger_config JSONB NOT NULL DEFAULT '{}', -- PM: due_soon_km, due_soon_days; Tyre: act_now_mm = 3, due_soon_mm = 4, pressure_pct = 10; Part_Item: due_soon_pct = 10, check_time; Inspection_Fail: Any or Critical
  updated_by BIGINT NOT NULL REFERENCES users(id),
  CHECK (drafts_wo OR rule_kind IN ('PM','Document','Tyre','Part_Item'))   -- reported problems always draft
);
CREATE TABLE dvir_logs (                      -- daily inspection
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  log_date TIMESTAMP NOT NULL,
  odometer_log_id BIGINT REFERENCES odometer_logs(id),   -- the reading this inspection saved (source Driver, DEC-76); NULL for a Towed unit
  inspection_status VARCHAR(4) NOT NULL CHECK (inspection_status IN ('Pass','Fail')),
  checklist JSONB NOT NULL,                  -- brakes, lights, tyres, engine oil, body damage: Pass or Fail each
  notes TEXT,
  photo_url VARCHAR(500),
  entered_by BIGINT NOT NULL REFERENCES users(id),   -- the driver in the app, or the System Admin entering for a driver
  entered_for_driver BOOLEAN NOT NULL DEFAULT false, -- shown as Entered by System Admin
  CHECK (inspection_status = 'Pass' OR (photo_url IS NOT NULL AND notes IS NOT NULL))
);
CREATE TABLE breakdown_reports (
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  driver_id BIGINT NOT NULL REFERENCES drivers(id),
  reported_at TIMESTAMP NOT NULL DEFAULT now(),
  location TEXT,
  location_lat NUMERIC(9,6), location_lng NUMERIC(9,6),   -- driver's device location captured once at report (REQ-MOB-003); seeds the Mobilisasi destination (REQ-MBL-002)
  location_captured_at TIMESTAMP,
  description TEXT NOT NULL,
  photo_url VARCHAR(500),
  entered_by BIGINT NOT NULL REFERENCES users(id)
);
```

## 9.6 Work orders, steps and approvals

```sql
CREATE TABLE assignment_modules (             -- module registry (REQ-REG-002)
  code VARCHAR(40) NOT NULL UNIQUE,           -- Stock, Part_Purchase, Mechanic_Action, Mobilisasi (MBL), Part_Replacement, Document, Part_Check (DEC-88), future modules
  name VARCHAR(100) NOT NULL,
  description TEXT,
  ui_component VARCHAR(80) NOT NULL,
  config_schema JSONB,
  creation_schema JSONB,                       -- fields the SPK creator fills for this module's step; NULL = none (REQ-WO-017)
  executor_roles role_t[] NOT NULL,
  scope_rules JSONB NOT NULL,
  completion_section JSONB NOT NULL,
  cost_kind VARCHAR(10) NOT NULL CHECK (cost_kind IN ('Parts','Labor','Document','None')),
  tracks_work_time BOOLEAN NOT NULL DEFAULT true, -- false: no Start, Pause or Resume and no work time; seeded false for Part_Replacement (DEC-95)
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE TABLE wo_presets (                     -- SD; saved step sequences, a starting point only (DEC-85)
  name VARCHAR(100) NOT NULL,
  category wo_category_t NOT NULL,
  requires_downtime BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,             -- Save as preset with an existing name adds a version (REQ-REG-003)
  created_by BIGINT NOT NULL REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (name, version)
);
CREATE TABLE wo_preset_steps (                -- one row per step per preset version
  preset_id BIGINT NOT NULL REFERENCES wo_presets(id),
  sequence_no INT NOT NULL CHECK (sequence_no > 0),
  module VARCHAR(40) NOT NULL REFERENCES assignment_modules(code),
  step_config JSONB NOT NULL DEFAULT '{}',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  executor_roles role_t[] NOT NULL,           -- one or more; a Stock step: Warehouse_Manager, Field_Coordinator, System_Admin
  verifier_role role_t NOT NULL CHECK (verifier_role IN ('Planner','System_Admin')),
  UNIQUE (preset_id, sequence_no)             -- the same module may repeat; step_config holds the saved step details
);
CREATE SEQUENCE wo_number_seq;                -- running part of SPK-yymmddNNNN, never reset, never reused (NFR-15, DEC-104)
CREATE TABLE work_orders (                    -- SD, OL
  wo_number VARCHAR(30) NOT NULL UNIQUE,      -- SPK-yymmddNNNN: WIB creation date + wo_number_seq, at least 4 digits
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  title VARCHAR(150) NOT NULL,                -- prefilled from the preset name, editable
  category wo_category_t NOT NULL,            -- lists, filters and reports
  requires_downtime BOOLEAN NOT NULL DEFAULT true,   -- Vehicle goes to the workshop (REQ-WO-009)
  preset_id BIGINT REFERENCES wo_presets(id), -- where the steps started from; NULL = built from blank; never followed later
  request_source wo_source_t NOT NULL,
  alert_id BIGINT REFERENCES maintenance_alerts(id),
  dvir_log_id BIGINT REFERENCES dvir_logs(id),
  breakdown_report_id BIGINT REFERENCES breakdown_reports(id),
  vehicle_document_id BIGINT REFERENCES vehicle_documents(id),   -- Document SPK
  source_assignment_id BIGINT,                -- the verified Part Check step this draft came from (REQ-CHK-003); FK added after work_order_assignments
  priority VARCHAR(10) NOT NULL DEFAULT 'Normal',
  description TEXT NOT NULL,
  finding_note TEXT,                          -- the originator's field-finding / breakdown narrative (Driver, Field Coordinator or Mechanic); set once at draft / send-for-review and never overwritten when the Planner edits description (DEC-91). Copied from breakdown_reports.description for Driver_Breakdown and from dvir_logs.notes for Driver_DVIR; typed by the FC or Mechanic and mandatory for Manual_Field_Coordinator and Manual_Mechanic (CHECK below)
  status wo_status_t NOT NULL DEFAULT 'Draft',
  sent_for_review_at TIMESTAMP,                -- a Mechanic or Field Coordinator sent the draft to the Planner (REQ-WO-016)
  status_before_amendment wo_status_t,
  amendment_no INT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),
  approved_at TIMESTAMP,
  activated_at TIMESTAMP,
  started_at TIMESTAMP,
  completion_requested_at TIMESTAMP,          -- only when every step is Verified or Skipped
  completion_approved_by BIGINT REFERENCES users(id),
  completed_at TIMESTAMP,
  cancelled_by BIGINT REFERENCES users(id),
  cancel_reason TEXT,
  labor_cost NUMERIC(14,2) NOT NULL DEFAULT 0,     -- cached sums of the line tables
  parts_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  document_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  stooring_cost NUMERIC(14,2) NOT NULL DEFAULT 0,   -- sum of the Mobilisasi steps' stooring fees (REQ-MBL-006)
  off_days INT NOT NULL DEFAULT 0 CHECK (off_days >= 0),   -- number of WIB days this SPK's vehicle has been OFF because this SPK ran past its scheduled day (SM-VEH OFF, REQ-SCH-003); billed as the Off_Unit invoice line = off_days × the OFF-unit daily rate (REQ-BIL-003, DEC-92)
  off_last_counted_date DATE,                       -- the last WIB day already counted into off_days; the idempotent daily job (00:30 WIB, NFR-14) increments off_days once per day only when off_last_counted_date < today, so a re-run never double-counts; cleared of effect once the SPK is Completed or Cancelled (counting stops)
  version INT NOT NULL DEFAULT 1,
  CHECK (status <> 'Cancelled' OR cancel_reason IS NOT NULL),
  CHECK (request_source NOT IN ('Manual_Field_Coordinator','Manual_Mechanic') OR finding_note IS NOT NULL)   -- a Field Coordinator or Mechanic draft must carry a field-finding note (DEC-91, REQ-WO-016)
);
-- one live SPK per source; the source finds its SPK through these keys (DEC-80)
CREATE UNIQUE INDEX uq_wo_alert     ON work_orders (alert_id)            WHERE alert_id IS NOT NULL AND status <> 'Cancelled';
CREATE UNIQUE INDEX uq_wo_dvir      ON work_orders (dvir_log_id)         WHERE dvir_log_id IS NOT NULL AND status <> 'Cancelled';
CREATE UNIQUE INDEX uq_wo_breakdown ON work_orders (breakdown_report_id) WHERE breakdown_report_id IS NOT NULL AND status <> 'Cancelled';
-- approver <> creator is a service-layer rule (BR-03) because the System Admin may self-approve
CREATE UNIQUE INDEX uq_open_document_wo ON work_orders (vehicle_document_id)
  WHERE vehicle_document_id IS NOT NULL AND status NOT IN ('Completed','Cancelled');
CREATE UNIQUE INDEX uq_wo_check ON work_orders (source_assignment_id) WHERE source_assignment_id IS NOT NULL;   -- one follow-up draft per Part Check step, kept even when discarded
CREATE TABLE work_order_assignments (         -- the SPK's steps, one row per step; edited in Create SPK while Draft or Rejected, frozen at approval (TX-02)
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  sequence_no INT NOT NULL,
  module VARCHAR(40) NOT NULL REFERENCES assignment_modules(code),
  step_config JSONB NOT NULL DEFAULT '{}',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  executor_roles role_t[] NOT NULL,           -- set per step in Create SPK
  verifier_role role_t NOT NULL,
  status asg_status_t NOT NULL DEFAULT 'Locked',
  team team_t,                                -- Mechanic_Action and Part_Check
  location_lat NUMERIC(9,6), location_lng NUMERIC(9,6),   -- Mobilisasi step: destination (from breakdown_reports) and arrival point at submit; the in-progress trail is in mobilisation_location_trail (REQ-MBL-005). No longer set by Mechanic Action (REQ-MEC-008 retired)
  location_accuracy_m INT,
  location_captured_at TIMESTAMP,
  location_capture location_capture_t,
  stooring_rate_id BIGINT REFERENCES stooring_rates(id),   -- Mobilisasi step: region of the destination; Workshop = fee 0 (REQ-MBL-006)
  stooring_fee NUMERIC(14,2) NOT NULL DEFAULT 0,   -- snapshot of the region price at the Mobilisasi step submit (BR-07, REQ-MBL-006)
  assigned_to BIGINT REFERENCES users(id),    -- REQ-ENG-011: named executor, set by Planner or System Admin or by the first claim
  claimed_at TIMESTAMP,
  opened_at TIMESTAMP,                        -- Locked to Open; waiting to start counts from here (DEC-87)
  executed_by BIGINT REFERENCES users(id),
  started_at TIMESTAMP,                       -- set only by Start (REQ-ENG-012), of the current attempt
  start_entered BOOLEAN NOT NULL DEFAULT false,   -- Start from an earlier time (REQ-ENG-014)
  attempt_no SMALLINT NOT NULL DEFAULT 1,     -- +1 after each return
  worked_seconds INT, paused_seconds INT,     -- cached from step_time_events at submit, all attempts
  submitted_at TIMESTAMP,
  verified_by BIGINT REFERENCES users(id),
  verified_at TIMESTAMP,
  self_verified BOOLEAN NOT NULL DEFAULT false,
  return_note TEXT,                           -- set when returned; shown as Returned
  skip_reason TEXT,
  UNIQUE (work_order_id, sequence_no)
);
-- verifier <> executor is a service-layer rule (BR-03)
CREATE TABLE step_time_events (               -- AO, every Open, Start, Pause, Resume, Submit, Return, Verify of a step (DEC-87)
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  attempt_no SMALLINT NOT NULL,
  event VARCHAR(8) NOT NULL CHECK (event IN ('Open','Start','Pause','Resume','Submit','Return','Verify','Skip')),
  at TIMESTAMP NOT NULL,                      -- when it happened; server time, or phone time for an offline phone
  recorded_at TIMESTAMP NOT NULL DEFAULT now(),   -- when the server received it
  pause_reason VARCHAR(22) CHECK (pause_reason IN ('Waiting_Parts','Waiting_Vehicle','Waiting_Vendor_Agency','Break_Shift_End','Change_Request','Other')),
  note TEXT,                                  -- required for Other and for an entered start
  entered_late BOOLEAN NOT NULL DEFAULT false,   -- Start from an earlier time, at most 2 h before recorded_at and never before Open
  clock_flag BOOLEAN NOT NULL DEFAULT false,  -- phone time more than 10 min off the server time
  actor_id BIGINT REFERENCES users(id),       -- NULL for System events
  on_behalf_of VARCHAR(150),                  -- external workshop name when a Field Coordinator or System Admin acts for it
  CHECK (event <> 'Pause' OR pause_reason IS NOT NULL),
  CHECK (pause_reason IS DISTINCT FROM 'Other' OR note IS NOT NULL)
);
CREATE TABLE step_time_corrections (          -- AO, System Admin only; the original event is never changed
  event_id BIGINT NOT NULL REFERENCES step_time_events(id),
  old_at TIMESTAMP NOT NULL,
  new_at TIMESTAMP NOT NULL,
  reason TEXT NOT NULL,
  corrected_by BIGINT NOT NULL REFERENCES users(id),
  corrected_at TIMESTAMP NOT NULL DEFAULT now()
);   -- reports and the SPK document use the latest correction of each event
CREATE TABLE mobilisation_location_trail (    -- AO; the mechanic's location trail while a Mobilisasi step is In_Progress (REQ-MBL-005, RSK-09)
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),   -- a Mobilisasi step
  attempt_no SMALLINT NOT NULL,
  lat NUMERIC(9,6) NOT NULL, lng NUMERIC(9,6) NOT NULL,
  accuracy_m INT,
  recorded_at TIMESTAMP NOT NULL,             -- only between Start and Submit of the step; recording stops at Submit
  received_at TIMESTAMP NOT NULL DEFAULT now()
);   -- visible to Planner and System Admin only; every read is written to an access log (RSK-09, NFR-04)
CREATE TABLE wo_change_requests (
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  requested_by BIGINT NOT NULL REFERENCES users(id),   -- executor of the open step
  reason TEXT NOT NULL,
  requested_change JSONB NOT NULL,
  revision JSONB,                             -- proposed content from the SPK creator
  revised_by BIGINT REFERENCES users(id),
  status cr_status_t NOT NULL DEFAULT 'Submitted',
  decided_by BIGINT REFERENCES users(id),     -- Supervisor, GM or System Admin
  decided_at TIMESTAMP,
  decision_note TEXT,
  amendment_no_applied INT
);
CREATE TABLE work_order_approvals (           -- AO, feeds the approval block
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  change_request_id BIGINT REFERENCES wo_change_requests(id),
  stage approval_stage_t NOT NULL,
  action approval_action_t NOT NULL,
  acted_by BIGINT NOT NULL REFERENCES users(id),
  approver_role role_t NOT NULL,
  acted_at TIMESTAMP NOT NULL DEFAULT now(),
  note TEXT,
  self_approved BOOLEAN NOT NULL DEFAULT false,
  CHECK (action NOT IN ('Approve','Reject') OR approver_role IN ('Supervisor','GM','System_Admin','Planner')),   -- Planner only while planner approval is on (REQ-IAM-008), service layer
  CHECK (action <> 'Reject' OR note IS NOT NULL)
);
ALTER TABLE work_orders ADD FOREIGN KEY (source_assignment_id) REFERENCES work_order_assignments(id);
CREATE TABLE work_order_check_items (         -- Part Check lines (DEC-88): requested by the SPK creator, or added by the executor
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  line_no INT NOT NULL,
  sku VARCHAR(40) REFERENCES parts_catalog(sku),
  part_item_type_id BIGINT REFERENCES part_item_types(id),
  tyre_position VARCHAR(10),                  -- for a tyre, the position on the chassis layout
  label VARCHAR(150) NOT NULL,                -- what the line shows, for example Air brake hose, axle 2
  what_to_check TEXT,                         -- from the SPK creator
  added_by_executor BOOLEAN NOT NULL DEFAULT false,
  condition_note TEXT,                        -- required at submit
  decision VARCHAR(7) CHECK (decision IN ('Good','Repair','Replace')),   -- required at submit
  unsafe_to_drive BOOLEAN NOT NULL DEFAULT false,
  decided_by BIGINT REFERENCES users(id),
  UNIQUE (assignment_id, line_no),
  CHECK (decision IS NOT NULL OR NOT unsafe_to_drive),
  CHECK (decision IS DISTINCT FROM 'Good' OR NOT unsafe_to_drive)
);   -- submit guard: every line has condition_note, decision and at least one Check_Photo
CREATE TABLE wo_attachments (
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  work_order_part_id BIGINT REFERENCES work_order_parts(id),
  work_order_service_id BIGINT REFERENCES work_order_services(id),
  check_item_id BIGINT REFERENCES work_order_check_items(id),   -- Check_Photo of one checked part (REQ-CHK-002)
  attachment_type attachment_t NOT NULL,
  label VARCHAR(10) CHECK (label IN ('Before','After')),   -- P1
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255), mime_type VARCHAR(100), size_bytes INT,
  uploaded_by BIGINT NOT NULL REFERENCES users(id)
);
CREATE TABLE work_order_part_requests (       -- parts named in a draft by a Field Coordinator or Mechanic (REQ-WO-016)
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  part_id BIGINT NOT NULL REFERENCES parts_catalog(id),
  requested_by BIGINT NOT NULL REFERENCES users(id),
  note TEXT
);
CREATE TABLE document_renewals (              -- written by the Document step
  vehicle_document_id BIGINT NOT NULL REFERENCES vehicle_documents(id),
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),   -- guard
  old_number VARCHAR(60), new_number VARCHAR(60) NOT NULL,
  old_expiry DATE NOT NULL, new_expiry DATE NOT NULL,
  issue_date DATE,
  cost NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  file_url VARCHAR(500) NOT NULL,             -- new scan
  receipt_url VARCHAR(500),                   -- required when document_types.receipt_required
  entered_by BIGINT NOT NULL REFERENCES users(id),
  CHECK (new_expiry > old_expiry)
);
```

## 9.7 SPK content: parts, tyres and services

```sql
CREATE TABLE service_catalog (                -- SD, Internal services
  service_code VARCHAR(30) NOT NULL UNIQUE,
  service_name VARCHAR(150) NOT NULL,
  standard_price NUMERIC(14,2) NOT NULL CHECK (standard_price >= 0),
  part_item_type_id BIGINT REFERENCES part_item_types(id),   -- [A] resets that part item when an SPK completes
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE work_order_parts (               -- planned lines (required list) and actual lines
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  assignment_id BIGINT REFERENCES work_order_assignments(id),   -- set when actual use is recorded
  sku VARCHAR(40) REFERENCES parts_catalog(sku),
  tyre_size VARCHAR(30),                      -- planned tyre line: size and quantity, for example 11R22.5 x 2
  tyre_id BIGINT REFERENCES tyres(id),        -- actual tyre line: one row per chosen tyre
  part_name VARCHAR(150) NOT NULL,
  for_step VARCHAR(13) NOT NULL DEFAULT 'Stock' CHECK (for_step IN ('Stock','Part_Purchase')),   -- Part_Purchase lines have no planned quantity (DEC-64)
  planned_qty INT NOT NULL DEFAULT 0 CHECK (planned_qty >= 0),
  qty INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
  unit_price NUMERIC(14,4) NOT NULL DEFAULT 0,   -- snapshot (BR-07)
  source part_source_t,
  goods_issue_item_id BIGINT REFERENCES goods_issue_items(id),
  reverses_line_id BIGINT REFERENCES work_order_parts(id),
  CHECK (sku IS NOT NULL OR tyre_size IS NOT NULL OR tyre_id IS NOT NULL),
  CHECK (source IS DISTINCT FROM 'Warehouse' OR qty = 0 OR goods_issue_item_id IS NOT NULL OR tyre_id IS NOT NULL)
);
CREATE TABLE work_order_purchases (          -- Part Purchase step header (REQ-PUR-004)
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  vendor_id BIGINT REFERENCES vendors(id),
  vendor_other VARCHAR(150),                  -- typed when the vendor is not in the master [A]
  receipt_number VARCHAR(60),
  receipt_date DATE NOT NULL,
  calculated_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  nothing_bought_reason TEXT,                 -- set when the step is submitted with no lines
  bought_by BIGINT NOT NULL REFERENCES users(id),
  CHECK (vendor_id IS NOT NULL OR vendor_other IS NOT NULL OR nothing_bought_reason IS NOT NULL)
);
CREATE TABLE work_order_purchase_lines (     -- part from the catalog, typed quantity and price (REQ-PUR-002)
  purchase_id BIGINT NOT NULL REFERENCES work_order_purchases(id),
  work_order_part_id BIGINT NOT NULL REFERENCES work_order_parts(id),   -- the planned line it buys (DEC-63)
  kind VARCHAR(5) NOT NULL DEFAULT 'Part' CHECK (kind IN ('Part','Tyre')),
  sku VARCHAR(40) REFERENCES parts_catalog(sku),   -- copied from the planned line; NULL only for a Tyre line
  item_name VARCHAR(150) NOT NULL,            -- snapshot of the catalog name
  quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
  unit VARCHAR(10) NOT NULL DEFAULT 'pcs',
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14,2) NOT NULL,          -- quantity x unit_price, shown live
  tyre_id BIGINT REFERENCES tyres(id),        -- Tyre lines create a tyre Issued to the SPK (REQ-PUR-005)
  CHECK (kind = 'Part' OR tyre_id IS NOT NULL),
  CHECK (kind = 'Tyre' OR sku IS NOT NULL)
);
CREATE TABLE stooring_rates (                 -- SD, master data of the System Admin (REQ-MEC-010)
  code VARCHAR(20) NOT NULL UNIQUE,
  region_name VARCHAR(100) NOT NULL,          -- Workshop Cikarang, Bekasi, Karawang, Jakarta, ...
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),   -- 0 for the workshop
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE work_order_services (
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  team team_t NOT NULL,
  service_id BIGINT REFERENCES service_catalog(id),
  vendor_name VARCHAR(150),
  description TEXT NOT NULL,
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),   -- catalog snapshot for Internal, free for External
  performed_by BIGINT NOT NULL REFERENCES users(id),
  CHECK ((team = 'Internal' AND service_id IS NOT NULL AND vendor_name IS NULL)
      OR (team = 'External' AND service_id IS NULL AND vendor_name IS NOT NULL))
);
-- Part_Check has cost_kind Labor and uses work_order_services for its check service; at least one line is required (REQ-CHK-007).
-- Evidence on submit: Internal needs at least one Repair_Photo (for Part_Check: a Check_Photo per checked part); External services and Part Purchase steps need at least one Invoice or receipt in wo_attachments.
```

## 9.8 Parts inventory and stock ledger

```sql
CREATE TABLE parts_catalog (                  -- SD, OL; parts only, never tyres
  sku VARCHAR(40) NOT NULL UNIQUE,
  part_name VARCHAR(150) NOT NULL,
  category VARCHAR(60),
  unit VARCHAR(10) NOT NULL DEFAULT 'pcs',    -- locked after the first movement
  brand VARCHAR(80),
  description TEXT,
  stock_qty INT NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  reorder_point INT NOT NULL DEFAULT 0,
  average_cost NUMERIC(14,4) NOT NULL DEFAULT 0,   -- moving average
  rack_location VARCHAR(30),
  part_item_type_id BIGINT REFERENCES part_item_types(id),
  last_movement_at TIMESTAMP,                 -- dead stock after 180 days (P1)
  is_active BOOLEAN NOT NULL DEFAULT true,    -- deactivate only when stock_qty = 0
  version INT NOT NULL DEFAULT 1
);
CREATE TABLE vendors (                        -- SD, REQ-INV-014; every vendor_name column below becomes vendor_id REFERENCES vendors(id)
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  vendor_type VARCHAR(10) NOT NULL CHECK (vendor_type IN ('Supplier','Workshop','Retread','Shop')),
  phone VARCHAR(30), address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE TABLE goods_receipts (                 -- SD; posted without approval (BR-12)
  gr_number VARCHAR(30) NOT NULL UNIQUE,      -- generated
  po_number VARCHAR(40),
  supplier_name VARCHAR(150) NOT NULL,          -- replaced by vendor_id (REQ-INV-014) in the build
  source_work_order_id BIGINT REFERENCES work_orders(id),   -- set for a receipt of parts bought for a cancelled SPK (REQ-WO-008)
  invoice_number VARCHAR(60) NOT NULL,        -- invoice or delivery note
  received_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Posted')),
  created_by BIGINT NOT NULL REFERENCES users(id),
  posted_by BIGINT REFERENCES users(id),
  posted_at TIMESTAMP,
  CHECK (status = 'Draft' OR posted_by IS NOT NULL)
);
CREATE TABLE goods_receipt_items (
  goods_receipt_id BIGINT NOT NULL REFERENCES goods_receipts(id),
  sku VARCHAR(40) NOT NULL REFERENCES parts_catalog(sku),
  qty INT NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(14,4) NOT NULL CHECK (unit_price >= 0),
  expiry_date DATE,
  rack_location VARCHAR(30)
);
CREATE TABLE gr_corrections (                 -- fixes a posted receipt line; no approval
  correction_number VARCHAR(30) NOT NULL UNIQUE,
  goods_receipt_id BIGINT NOT NULL REFERENCES goods_receipts(id),
  sku VARCHAR(40) NOT NULL REFERENCES parts_catalog(sku),
  qty_change INT NOT NULL DEFAULT 0,
  new_unit_price NUMERIC(14,4),
  reason TEXT NOT NULL,
  posted_by BIGINT NOT NULL REFERENCES users(id),
  posted_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE goods_issues (                   -- Warehouse source only
  gi_number VARCHAR(30) NOT NULL UNIQUE,
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),          -- guard (BR-01)
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),               -- guard: equals the SPK vehicle (BR-02)
  issued_date DATE NOT NULL,
  issued_by BIGINT NOT NULL REFERENCES users(id),
  reverses_gi_id BIGINT REFERENCES goods_issues(id),                -- a reversal
  reversal_reason TEXT,
  reversal_verified_by BIGINT REFERENCES users(id),                 -- stock returns only after verification
  CHECK (reverses_gi_id IS NULL OR reversal_reason IS NOT NULL)
);
CREATE TABLE goods_issue_items (
  goods_issue_id BIGINT NOT NULL REFERENCES goods_issues(id),
  sku VARCHAR(40) NOT NULL REFERENCES parts_catalog(sku),           -- guard: on the SPK part list
  qty INT NOT NULL CHECK (qty > 0),
  unit_cost NUMERIC(14,4) NOT NULL                                  -- average cost at issue time
);
CREATE TABLE stock_adjustments (              -- stock opname document, or the opening balance
  kind VARCHAR(8) NOT NULL DEFAULT 'Opname' CHECK (kind IN ('Opname','Opening')),   -- Opening: REQ-INV-013, Setup mode only, saved without approval
  sa_number VARCHAR(30) NOT NULL UNIQUE,
  adjustment_date DATE NOT NULL,
  rack_filter VARCHAR(30),
  status VARCHAR(16) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Pending_Approval','Approved')),
  returned_reason TEXT,                       -- set by a reject; shown as Returned
  counted_by BIGINT NOT NULL REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),    -- Supervisor, GM or System Admin; not counted_by unless System Admin
  self_approved BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE stock_adjustment_items (
  stock_adjustment_id BIGINT NOT NULL REFERENCES stock_adjustments(id),
  sku VARCHAR(40) NOT NULL REFERENCES parts_catalog(sku),
  system_qty INT NOT NULL,
  physical_qty INT NOT NULL CHECK (physical_qty >= 0),
  variance INT GENERATED ALWAYS AS (physical_qty - system_qty) STORED,
  reason_code reason_t,
  explanation TEXT,
  UNIQUE (stock_adjustment_id, sku),
  CHECK (physical_qty = system_qty OR (reason_code IS NOT NULL AND length(trim(explanation)) > 0))
);
CREATE TABLE stock_cards (                    -- AO ledger
  sku VARCHAR(40) NOT NULL REFERENCES parts_catalog(sku),
  transaction_type stock_tx_t NOT NULL,
  reference_doc_id VARCHAR(30) NOT NULL,      -- GR, GRC, GI or SA number: no movement without a document (BR-06)
  work_order_id BIGINT REFERENCES work_orders(id),
  vehicle_id BIGINT REFERENCES vehicles(id),  -- for GI and GIR
  qty_in INT NOT NULL DEFAULT 0 CHECK (qty_in >= 0),
  qty_out INT NOT NULL DEFAULT 0 CHECK (qty_out >= 0),
  balance_after INT NOT NULL CHECK (balance_after >= 0),
  user_id BIGINT NOT NULL REFERENCES users(id),
  tx_at TIMESTAMP NOT NULL DEFAULT now()
);
```

## 9.9 Tyres, tyre documents and retread

```sql
CREATE TABLE tyre_statuses (                  -- master data (REQ-TYR-003)
  code VARCHAR(20) NOT NULL UNIQUE,           -- seed: In_Stock, Issued, Mounted, Needs_Retread, Worn_Out, On_Retread, Scrapped, Lost
  name VARCHAR(60) NOT NULL,
  in_warehouse BOOLEAN NOT NULL DEFAULT false, -- true for In_Stock, Needs_Retread, Worn_Out (counted in a tyre count)
  is_final BOOLEAN NOT NULL DEFAULT false,     -- Scrapped, Lost
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);
CREATE SEQUENCE tyre_code_seq;                -- source of TY-0001, never reused
CREATE TABLE retread_orders (                 -- retread dispatch
  rd_number VARCHAR(30) NOT NULL UNIQUE,
  vendor_name VARCHAR(150) NOT NULL,
  delivery_note_number VARCHAR(60),
  dispatch_date DATE NOT NULL,
  expected_return_date DATE,
  status VARCHAR(12) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Partial','Closed')),
  created_by BIGINT NOT NULL REFERENCES users(id)
);
CREATE TABLE tyre_receipts (                  -- SD; Receive tyres, no approval
  receipt_number VARCHAR(30) NOT NULL UNIQUE, -- TR-0001
  receipt_type VARCHAR(15) NOT NULL CHECK (receipt_type IN ('New','Retread_Return')),
  source VARCHAR(20) CHECK (source IN ('Supplier','Existing')),   -- New only
  supplier_name VARCHAR(150),
  retread_order_id BIGINT REFERENCES retread_orders(id),          -- Retread_Return only
  invoice_number VARCHAR(60),
  received_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Confirmed')),
  received_by BIGINT NOT NULL REFERENCES users(id),
  CHECK ((receipt_type = 'New' AND source IS NOT NULL AND retread_order_id IS NULL)
      OR (receipt_type = 'Retread_Return' AND retread_order_id IS NOT NULL AND invoice_number IS NOT NULL)),
  CHECK (source IS DISTINCT FROM 'Supplier' OR invoice_number IS NOT NULL)
);
CREATE TABLE tyres (                          -- SD; individual assets, never in parts_catalog
  tyre_code VARCHAR(20) NOT NULL UNIQUE,      -- generated from tyre_code_seq
  serial_number VARCHAR(40) NOT NULL,         -- printed on the tyre
  brand VARCHAR(50) NOT NULL,
  model VARCHAR(50),
  size VARCHAR(30) NOT NULL,
  tyre_type tyre_type_t NOT NULL,
  status_id BIGINT NOT NULL REFERENCES tyre_statuses(id),
  source VARCHAR(20) NOT NULL CHECK (source IN ('Supplier','Existing','External_Workshop')),
  tyre_receipt_id BIGINT REFERENCES tyre_receipts(id),   -- the receipt that created it
  supplier_name VARCHAR(150),
  purchase_invoice_number VARCHAR(60),
  purchase_cost NUMERIC(14,2),
  received_date DATE,
  received_by BIGINT REFERENCES users(id),
  initial_tread_depth NUMERIC(4,1) NOT NULL,
  current_tread_depth NUMERIC(4,1),           -- cache of the latest tyre_inspections row, written in the same transaction (DEC-80)
  current_pressure_psi NUMERIC(5,1),          -- same cache
  rack_location VARCHAR(30),                  -- while in the warehouse
  retread_count INT NOT NULL DEFAULT 0,
  last_retread_vendor VARCHAR(150),
  issued_wo_id BIGINT REFERENCES work_orders(id),   -- set only while status is Issued
  UNIQUE (brand, serial_number)               -- [A] unique per brand
);
CREATE TABLE tyre_events (                    -- AO history
  tyre_id BIGINT NOT NULL REFERENCES tyres(id),
  event VARCHAR(30) NOT NULL,                 -- Received, Issued, Released, Mounted, Rotated, Demounted, Returned_To_Stock, Retread_Sent, Retread_Accepted, Retread_Rejected, Worn_Out, Scrapped, Missing, Lost
  from_status_id BIGINT REFERENCES tyre_statuses(id),
  to_status_id BIGINT REFERENCES tyre_statuses(id),
  document_ref VARCHAR(30) NOT NULL,          -- SPK, TR, RD or tyre count number; BASELINE for the parts baseline
  vehicle_id BIGINT REFERENCES vehicles(id),
  position_id BIGINT REFERENCES part_positions(id),
  odometer INT,
  reason TEXT,
  user_id BIGINT NOT NULL REFERENCES users(id),
  at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE tyre_attachments (
  tyre_id BIGINT NOT NULL REFERENCES tyres(id),
  attachment_type VARCHAR(15) NOT NULL CHECK (attachment_type IN ('Invoice')),
  file_url VARCHAR(500) NOT NULL,
  uploaded_by BIGINT NOT NULL REFERENCES users(id)
);
CREATE TABLE retread_order_items (
  retread_order_id BIGINT NOT NULL REFERENCES retread_orders(id),
  tyre_id BIGINT NOT NULL REFERENCES tyres(id),
  tyre_receipt_id BIGINT REFERENCES tyre_receipts(id),   -- the Retread_Return that settled it
  result VARCHAR(10) CHECK (result IN ('Accepted','Rejected')),   -- NULL = not returned yet
  cost NUMERIC(14,2) CHECK (cost >= 0),
  new_tread_depth NUMERIC(4,1),
  reject_reason TEXT,
  received_date DATE,
  UNIQUE (retread_order_id, tyre_id),
  CHECK (result IS DISTINCT FROM 'Rejected' OR reject_reason IS NOT NULL)
);
CREATE TABLE retread_attachments (
  retread_order_id BIGINT NOT NULL REFERENCES retread_orders(id),
  attachment_type VARCHAR(15) NOT NULL CHECK (attachment_type IN ('Delivery_Note','Invoice')),
  file_url VARCHAR(500) NOT NULL,
  uploaded_by BIGINT NOT NULL REFERENCES users(id)
);
CREATE TABLE tyre_counts (
  count_number VARCHAR(30) NOT NULL UNIQUE,
  count_date DATE NOT NULL,
  rack_filter VARCHAR(30),
  status VARCHAR(16) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Pending_Approval','Approved')),
  returned_reason TEXT,
  counted_by BIGINT NOT NULL REFERENCES users(id),
  approved_by BIGINT REFERENCES users(id),    -- Supervisor, GM or System Admin; not counted_by unless System Admin
  self_approved BOOLEAN NOT NULL DEFAULT false
);
CREATE TABLE tyre_count_items (
  tyre_count_id BIGINT NOT NULL REFERENCES tyre_counts(id),
  tyre_id BIGINT NOT NULL REFERENCES tyres(id),
  result VARCHAR(8) NOT NULL CHECK (result IN ('Found','Missing')),
  reason VARCHAR(20),
  note TEXT,
  UNIQUE (tyre_count_id, tyre_id),
  CHECK (result = 'Found' OR (reason IS NOT NULL AND note IS NOT NULL))
);
CREATE TABLE tyre_min_levels (                -- P1, low stock per size [A]
  size VARCHAR(30) NOT NULL UNIQUE,
  min_qty INT NOT NULL CHECK (min_qty >= 0)
);
CREATE TABLE tyre_inspections (               -- tread and pressure recorded in an SPK step
  tyre_id BIGINT NOT NULL REFERENCES tyres(id),
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),   -- guard
  assignment_id BIGINT NOT NULL REFERENCES work_order_assignments(id),
  tread_depth_mm NUMERIC(4,1) NOT NULL CHECK (tread_depth_mm >= 0),
  pressure_psi NUMERIC(5,1),
  odometer INT,
  inspected_by BIGINT NOT NULL REFERENCES users(id)
);
```

## 9.10 Placements and the map

```sql
CREATE TABLE part_placements (                -- OL; the current tyre at each position
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  position_id BIGINT NOT NULL REFERENCES part_positions(id),   -- must belong to the vehicle's chassis_layout_id (trigger)
  tyre_id BIGINT NOT NULL REFERENCES tyres(id),
  status VARCHAR(10) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Removed')),
  is_baseline BOOLEAN NOT NULL DEFAULT false,
  installed_wo_id BIGINT REFERENCES work_orders(id),
  installed_assignment_id BIGINT REFERENCES work_order_assignments(id),
  installed_odometer INT NOT NULL,
  installed_at TIMESTAMP NOT NULL,
  removed_wo_id BIGINT REFERENCES work_orders(id),
  removed_at TIMESTAMP,
  version INT NOT NULL DEFAULT 1,
  CHECK (is_baseline OR installed_wo_id IS NOT NULL)        -- BR-01
);
CREATE UNIQUE INDEX uq_active_slot ON part_placements (position_id, vehicle_id) WHERE status = 'Active';
CREATE UNIQUE INDEX uq_active_tyre ON part_placements (tyre_id) WHERE status = 'Active';
CREATE TABLE part_placement_logs (            -- AO
  work_order_id BIGINT REFERENCES work_orders(id),
  assignment_id BIGINT REFERENCES work_order_assignments(id),
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  action_type placement_act_t NOT NULL,
  tyre_id BIGINT NOT NULL REFERENCES tyres(id),
  old_position_id BIGINT REFERENCES part_positions(id),
  new_position_id BIGINT REFERENCES part_positions(id),
  odometer_at_action INT NOT NULL,
  accumulated_km INT NOT NULL DEFAULT 0,
  logged_by BIGINT NOT NULL REFERENCES users(id),
  CHECK (action_type = 'Baseline' OR work_order_id IS NOT NULL)   -- BR-01
);
CREATE TABLE placement_map_snapshots (        -- [A] saved when a Part Replacement step is submitted
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  assignment_id BIGINT NOT NULL UNIQUE REFERENCES work_order_assignments(id),
  snapshot JSONB NOT NULL
);
```

## 9.11 Maintenance schedule

```sql
CREATE TABLE wo_schedule (                    -- a plan only; never changes an SPK (BR-13)
  work_order_id BIGINT NOT NULL UNIQUE REFERENCES work_orders(id),
  planned_date DATE NOT NULL,                 -- the daily job rolls this forward to the next day each time the card is missed, with no limit, until the SPK is Completed or Cancelled (REQ-SCH-003, DEC-92)
  placed_by BIGINT NOT NULL REFERENCES users(id),
  is_missed BOOLEAN NOT NULL DEFAULT false,   -- set by the daily job
  is_rolled_over BOOLEAN NOT NULL DEFAULT false   -- the card has been auto-moved forward at least once (rolled-over / late); shown on the Planner card and the Mechanic mobile list (REQ-SCH-003, REQ-MOB-010, DEC-92)
);
CREATE TABLE wo_schedule_log (                -- AO
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  old_date DATE,
  new_date DATE,
  action VARCHAR(10) NOT NULL CHECK (action IN ('Placed','Moved','Removed','Missed')),
  user_id BIGINT REFERENCES users(id),
  at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE schedule_alerts (                -- shown to the Field Coordinator; also raises a notification
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  alert_type VARCHAR(10) NOT NULL CHECK (alert_type IN ('Placed','Moved','Missed','Today')),
  recipient_id BIGINT NOT NULL REFERENCES users(id),
  read_at TIMESTAMP
);
```

## 9.12 Platform: settings, notifications, preferences and AI

```sql
CREATE TABLE app_settings (
  setting_key VARCHAR(60) NOT NULL UNIQUE,   -- dead_stock_days = 180, odometer_jump_km_per_day = 1500, storage_budget_gb = 50, storage_alert_pct = 80, storage_ia_after_months = 12, planner_approval_until = null, planner_approval_kinds = [] (REQ-IAM-008, DEC-93), system_mode = 'Setup' then 'Live' (REQ-IAM-010), went_live_at, tyre_early_failure_pct = 80, numbering formats (NFR-15), invoice_tax_pct = 11, invoice_part_markup_pct = 50, off_unit_daily_rate = 0 (a single global daily rate for the Off_Unit invoice line, maintained by the System Admin in Settings like the other rates; global, not per vehicle_class, to match invoice_tax_pct / invoice_part_markup_pct, REQ-BIL-003, DEC-92), invoice_bank_details
  setting_value JSONB NOT NULL               -- triggers that draft SPKs are in alert_rules, document warning days on document_types (DEC-86)
);
CREATE TABLE stored_files (                   -- every uploaded file (8.1); file columns elsewhere hold its storage_key
  storage_key VARCHAR(300) NOT NULL UNIQUE,   -- {env}/{yyyy}/{mm}/{entity}/{uuid}.jpg or .pdf, private bucket
  thumb_key VARCHAR(300),                     -- 320 px JPEG
  profile VARCHAR(10) NOT NULL CHECK (profile IN ('Photo','Document','PDF')),
  mime_type VARCHAR(30) NOT NULL CHECK (mime_type IN ('image/jpeg','application/pdf')),   -- stored output type
  original_name VARCHAR(255),
  original_bytes INT,                         -- before compression
  stored_bytes INT,
  width INT, height INT, page_count INT,
  sha256 CHAR(64),                            -- set when Ready
  captured_at TIMESTAMP,                      -- from EXIF, the only EXIF field kept
  capture_source VARCHAR(8) CHECK (capture_source IN ('Camera','Gallery','File')),
  status VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Ready','Rejected','Expired')),
  reject_reason TEXT,
  uploaded_by BIGINT NOT NULL REFERENCES users(id),
  attached_at TIMESTAMP,                      -- set when a record references it; then never changed or deleted
  CHECK (status <> 'Ready' OR sha256 IS NOT NULL)
);
CREATE TABLE notifications (                  -- the only notifications table; in-app from release 1
  user_id BIGINT NOT NULL REFERENCES users(id),
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('Approval','Step','Alert','Schedule','Change_Request')),
  title VARCHAR(200) NOT NULL,
  body TEXT,
  link_record VARCHAR(60),                    -- the SPK, step, document or vehicle it opens
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  read_at TIMESTAMP
);
CREATE TABLE push_devices (                   -- P1: phones where a user is signed in
  user_id BIGINT NOT NULL REFERENCES users(id),
  push_token TEXT NOT NULL UNIQUE,
  platform VARCHAR(10) NOT NULL CHECK (platform IN ('Android','iOS')),
  last_seen_at TIMESTAMP
);
CREATE TABLE notification_deliveries (        -- one row per channel and device
  notification_id BIGINT NOT NULL REFERENCES notifications(id),
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('InApp','Push')),   -- Email, WhatsApp added in P2
  device_id BIGINT REFERENCES push_devices(id),
  status VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Sent','Failed')),
  sent_at TIMESTAMP
);
CREATE TABLE notification_mutes (             -- P1: push muted per kind; in-app stays
  user_id BIGINT NOT NULL REFERENCES users(id),
  kind VARCHAR(20) NOT NULL,
  UNIQUE (user_id, kind)
);
CREATE TABLE user_table_preferences (         -- column chooser and Parts or Tyres mode
  user_id BIGINT NOT NULL REFERENCES users(id),
  table_key VARCHAR(60) NOT NULL,             -- for example tyres_list, inventory_mode
  columns JSONB NOT NULL,
  PRIMARY KEY (user_id, table_key)
);
CREATE TABLE import_batches (                 -- REQ-IAM-011, Setup mode only
  entity VARCHAR(40) NOT NULL,                -- customers, vendors, services, stooring_rates, parts_catalog, vehicles, vehicle_documents, tyres, baseline, opening_balance
  file_key VARCHAR(300) NOT NULL,             -- the uploaded file in object storage
  rows_total INT NOT NULL,
  rows_failed INT NOT NULL DEFAULT 0,
  status VARCHAR(10) NOT NULL DEFAULT 'Validated' CHECK (status IN ('Validated','Imported','Discarded')),
  errors JSONB,                               -- row number and message per failed row
  imported_by BIGINT NOT NULL REFERENCES users(id),
  imported_at TIMESTAMP,
  CHECK (status <> 'Imported' OR rows_failed = 0)
);
CREATE TABLE export_logs (                    -- AO
  user_id BIGINT NOT NULL REFERENCES users(id),
  export_type VARCHAR(40) NOT NULL,           -- stock_card, report, audit_log
  parameters JSONB NOT NULL,
  file_format VARCHAR(5) NOT NULL CHECK (file_format IN ('xlsx','csv','pdf')),
  at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TABLE ai_configurations (              -- P1
  provider ai_provider_t NOT NULL UNIQUE,
  api_key_encrypted TEXT NOT NULL,
  active_model VARCHAR(60) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_by BIGINT NOT NULL REFERENCES users(id)
);
CREATE TABLE ai_query_logs (                  -- P1, AO
  user_id BIGINT NOT NULL REFERENCES users(id),
  raw_prompt TEXT NOT NULL,
  skill_used VARCHAR(40),
  executed_sql_context TEXT,
  tokens_used INT
);
```

## 9.13 Integrity rules and key transactions

| ID | Rule or transaction | Steps, all in one database transaction unless stated |
| --- | --- | --- |
| TX-01 | Creation order | Create enums, then tables in the order of 9.2 to 9.12, then 9.14 (customers before the foreign key vehicles.customer\_id). Add the circular foreign keys last: `vehicle_part_items` → `parts_catalog`, `work_orders`; `maintenance_alerts` → `tyres`, `work_orders`; `dvir_logs`, `breakdown_reports` → `work_orders`; `wo_attachments` → `work_order_parts`, `work_order_services`; `work_order_parts` → `tyres`, `goods_issue_items`; `tyres.issued_wo_id`. |
| TX-02 | Approve creation (T3) | Lock the SPK; check status Pending\_Approval, BR-03 and the step checks of REQ-REG-004; freeze the SPK's `work_order_assignments` (module, order, `step_config`, roles); set step 1 Open, the rest Locked; write `work_order_approvals` (`self_approved` when the System Admin approves its own SPK) and `audit_logs`; notify the executor of step 1. |
| TX-03 | Stock step submit | Lock the part rows (`SELECT … FOR UPDATE`); check the SPK is Active or In\_Progress, the step is Open or In\_Progress and each SKU and tyre size is on the SPK list; check stock; insert `goods_issues` and `goods_issue_items`; decrease `parts_catalog.stock_qty`; insert `stock_cards` (GI); write `work_order_parts` at the average cost; for each chosen tyre set Issued, `issued_wo_id`, write a `work_order_parts` row at its purchase cost and a `tyre_events` row (Issued); set the step Submitted and open the next one; write `audit_logs`. Any failure rolls back everything. |
| TX-05 | Issue reversal | On submit write the reversing `goods_issues` row with reason and no stock change; on verification increase `stock_qty` at the original `unit_cost`, insert `stock_cards` (GIR), write the reversing `work_order_parts` line, and set any Issued tyre back to In\_Stock (event Released). |
| TX-06 | Post a Goods Receipt | Set Posted; for each line increase `stock_qty`, recompute `average_cost = (old_qty × old_cost + qty × unit_price) / (old_qty + qty)`, insert `stock_cards` (GR). A GR correction does the same with its signed change and writes GRC. |
| TX-07 | Approve a stock opname | For each row set `stock_qty = physical_qty`, insert `stock_cards` (SA) for non-zero variance; set Approved, `approved_by`, `self_approved`; write `audit_logs`. |
| TX-08 | Confirm Receive tyres | New: one `tyres` row per tyre with `tyre_code` from `tyre_code_seq`, status In\_Stock, a `tyre_events` row (Received) and the invoice in `tyre_attachments`. Retread return: per tyre update `retread_order_items`, set In\_Stock (+1 `retread_count`, cost added, `last_retread_vendor`) or Scrapped, write `tyre_events`; set the dispatch Partial or Closed. Never writes `goods_receipts`, `parts_catalog` or `stock_cards`. |
| TX-09 | Mount, demount, rotate | Mount only a tyre with status Issued and `issued_wo_id` = this SPK, not Active in `part_placements`, at a position of the vehicle's layout; mount sets Mounted and clears `issued_wo_id`. Demount sets the chosen status. Each writes `part_placements`, `part_placement_logs` and `tyre_events`. |
| TX-10 | Approve a tyre count | For each Missing row write `tyre_events` (Missing, then Lost) and set status Lost; set Approved; write `audit_logs`. |
| TX-11 | Baseline save | Write `vehicle_part_items`, set the chosen tyres Mounted, write `part_placements` (`is_baseline = true`), `part_placement_logs` (Baseline), `tyre_events` (document\_ref BASELINE) and `audit_logs`; no SPK. |
| TX-12 | Change request decision | Approve: apply `revision` to the SPK content, increment `amendment_no`, restore `status_before_amendment`, write the previous content to `audit_logs`. Reject: discard `revision`, restore the status only. |
| TX-13 | Completion request and approval | `completion_requested_at` is set only if every step is Verified or Skipped. Approval sets Completed, writes the completion approval, recalculates the vehicle status, resets linked `vehicle_part_items` \[A\], and releases still-Issued tyres to In\_Stock (event Released). |
| TX-14 | Cancel | Reverse posted goods issues (TX-05 without verification \[A\]), release Issued tyres, set Cancelled with reason, remove the card from the open schedule lists, write `audit_logs`. |
| TX-15 | Document first entry and renewal | First entry inserts `vehicle_documents` and `audit_logs` with no SPK and no `document_renewals` row. Correct entry writes `document_corrections`, refused once a `document_renewals` row exists. A verified Document step writes `document_renewals` (with `work_order_id`), updates `vehicle_documents`, recalculates status and vehicle status, and adds the cost to `work_orders.document_cost`. A required type with no row counts as Missing and blocks trips. |
| TX-16 | Daily job (NFR-12) | Document statuses and one Document SPK per Warning document; PM, part item and tyre alerts (one pending per subject); schedule Missed marks, the roll-forward of each Missed card to the next day with `wo_schedule.is_rolled_over` and a Moved row in `wo_schedule_log` (REQ-SCH-003), late alerts (REQ-SCH-007) and Today alerts; `work_orders.off_days` +1 once per WIB day for each SPK whose vehicle is OFF, guarded by `off_last_counted_date` (DEC-92); vehicle status recalculation. Each part is idempotent (NFR-12). |
| TX-17 | Shared map data | The Vehicles tab and the Part Replacement step both read `part_positions` of the vehicle's layout and the Active `part_placements`; there is no second copy of a layout. |
| TX-18 | Soft delete | Unique indexes on soft-deleted tables ignore rows where `deleted_at` is set. |
| TX-19 | Bill a completed SPK | Inside TX-13: find the Draft invoice of the vehicle for the completion date or create it (customer from vehicles.customer\_id); insert an invoice\_wos row and one invoice\_lines row per part, tyre and service line of the SPK (parts and tyres at cost × (1 + invoice\_part\_markup\_pct), services at their price), never merged; recompute subtotal, tax and total. No customer: insert the invoice\_wos row with invoice\_id NULL (Not billable) and no lines until a customer is set. Write audit\_logs. |
| TX-20 | Planner approval switch | Set app\_settings.planner\_approval\_until (or null to switch off), write audit\_logs with the reason, notify Supervisors and GMs. Every approval by a Planner checks the switch and BR-03 at decision time. |
| TX-21 | Part Purchase step submit | Write work\_order\_purchases and its lines with the calculated total, create a tyres row (status Issued, issued\_wo\_id) for each Tyre line, attach the receipt photos, add the total to work\_orders.parts\_cost; never touch parts\_catalog, goods\_issues or stock\_cards (DEC-60). |

## 9.14 Customers and invoices

```sql
CREATE TABLE customers (                      -- SD, REQ-BIL-001
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  billing_address TEXT NOT NULL,
  tax_number VARCHAR(30),                     -- NPWP
  contact_name VARCHAR(100), phone VARCHAR(30), email VARCHAR(150),
  payment_terms_days SMALLINT NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE SEQUENCE invoice_no_seq;               -- running number, never reset (DEC-50)
CREATE TABLE invoices (                       -- OL, one per vehicle per day (DEC-43)
  invoice_no VARCHAR(30) UNIQUE,              -- {NNNN}/BMI/{dd-mm-yy of issue}, set on Issue, never reused (DEC-46)
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  service_date DATE NOT NULL,                 -- completion date of its SPKs
  status invoice_status_t NOT NULL DEFAULT 'Draft',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5,2) NOT NULL,              -- copied from app_settings.invoice_tax_pct (11)
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  issued_by BIGINT REFERENCES users(id), issued_at TIMESTAMP, due_date DATE,
  void_reason TEXT, voided_by BIGINT REFERENCES users(id), voided_at TIMESTAMP,
  version INT NOT NULL DEFAULT 1,
  CHECK (status IN ('Draft','Void') OR invoice_no IS NOT NULL),
  CHECK (status <> 'Void' OR void_reason IS NOT NULL)
);
CREATE UNIQUE INDEX uq_one_draft_per_vehicle_day ON invoices (vehicle_id, service_date) WHERE status = 'Draft';
CREATE TABLE invoice_wos (                    -- which completed SPKs an invoice bills (BR-15)
  invoice_id BIGINT REFERENCES invoices(id),  -- NULL = Not billable (vehicle without a customer)
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  is_void BOOLEAN NOT NULL DEFAULT false      -- set when its invoice is voided
);
CREATE UNIQUE INDEX uq_wo_billed_once ON invoice_wos (work_order_id) WHERE NOT is_void;   -- BR-15
CREATE TABLE invoice_lines (                  -- parts, tyres and services used, never one line per SPK (DEC-44)
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('Part','Tyre','Service','Document','Stooring','Off_Unit','Adjustment')),   -- Off_Unit = off_days × off_unit_daily_rate, at cost, no markup (REQ-BIL-003, DEC-92)
  description VARCHAR(200) NOT NULL,          -- printed; no cost, markup or SPK number on the PDF
  sku VARCHAR(40), service_id BIGINT REFERENCES service_catalog(id),
  qty NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_cost NUMERIC(14,4),                    -- internal: cost on the SPK line
  markup_pct NUMERIC(5,2) NOT NULL DEFAULT 0, -- 50 for Part and Tyre, 0 otherwise; internal only
  unit_price NUMERIC(14,2) NOT NULL,          -- printed; = unit_cost × (1 + markup_pct / 100), snapshot (BR-07)
  amount NUMERIC(14,2) NOT NULL,              -- qty × unit_price; negative for a discount
  adjustment_reason TEXT,
  CHECK (kind <> 'Adjustment' OR adjustment_reason IS NOT NULL)
);
CREATE TABLE invoice_line_sources (           -- traceability: which SPK lines make up an invoice line
  invoice_line_id BIGINT NOT NULL REFERENCES invoice_lines(id),
  work_order_id BIGINT NOT NULL REFERENCES work_orders(id),
  work_order_part_id BIGINT REFERENCES work_order_parts(id),
  work_order_service_id BIGINT REFERENCES work_order_services(id)
);
CREATE TABLE invoice_payments (               -- AO
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  paid_on DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),   -- equal to the total in R1 (DEC-50)
  method VARCHAR(20) NOT NULL,                -- Transfer, Cash, Giro
  reference VARCHAR(60),
  recorded_by BIGINT NOT NULL REFERENCES users(id)
);
```
