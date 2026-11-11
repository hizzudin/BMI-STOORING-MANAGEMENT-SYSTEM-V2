-- §9.6 and §9.7 SPK tables used in R1 step 1 (NFR-15, DEC-104, DEC-111, DEC-124).
-- DEC-124: a column that refers to a table a later task builds is a plain column; that task adds
-- the reference. assignment_modules starts empty: each module registers itself in its own task.

CREATE TABLE assignment_modules (             -- module registry (REQ-REG-002)
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  ui_component VARCHAR(80) NOT NULL,
  config_schema JSONB,
  creation_schema JSONB,
  executor_roles role_t[] NOT NULL,
  scope_rules JSONB NOT NULL,
  completion_section JSONB NOT NULL,
  cost_kind VARCHAR(10) NOT NULL CHECK (cost_kind IN ('Parts','Labor','Document','None')),
  tracks_work_time BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

-- NFR-15, DEC-104: the running part of SPK-yymmddNNNN, never reset and never reused.
CREATE SEQUENCE spk_number_seq;

CREATE TABLE spks (                           -- SD, OL
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  spk_number VARCHAR(30) NOT NULL,
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  title VARCHAR(150) NOT NULL,
  category spk_category_t NOT NULL,
  requires_downtime BOOLEAN NOT NULL DEFAULT true,
  preset_id BIGINT,                           -- reference added with spk_presets (TASK-201)
  request_source spk_source_t NOT NULL,
  alert_id BIGINT,                            -- reference added with maintenance_alerts (TASK-501)
  breakdown_report_id BIGINT,                 -- reference added with breakdown_reports (TASK-405)
  vehicle_document_id BIGINT,                 -- reference added with vehicle_documents (TASK-601)
  source_assignment_id BIGINT,                -- reference to spk_assignments below
  priority VARCHAR(10) NOT NULL DEFAULT 'Normal',
  description TEXT NOT NULL,
  finding_note TEXT,
  status spk_status_t NOT NULL DEFAULT 'Draft',
  status_before_amendment spk_status_t,
  amendment_no INT NOT NULL DEFAULT 0,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approved_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  approved_at TIMESTAMP,
  activated_at TIMESTAMP,
  started_at TIMESTAMP,
  completion_requested_at TIMESTAMP,
  completion_approved_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  completed_at TIMESTAMP,
  cancelled_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  cancel_reason TEXT,
  labor_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  parts_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  document_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  stooring_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  off_days INT NOT NULL DEFAULT 0 CHECK (off_days >= 0),
  off_last_counted_date DATE,
  version INT NOT NULL DEFAULT 1,
  CHECK (status <> 'Cancelled' OR cancel_reason IS NOT NULL),
  CHECK (request_source <> 'Breakdown_Report' OR (breakdown_report_id IS NOT NULL AND finding_note IS NOT NULL))
);

-- TX-18: unique among SPKs that are not soft-deleted; the sequence never issues a number twice.
CREATE UNIQUE INDEX ux_spks_spk_number ON spks (spk_number) WHERE deleted_at IS NULL;
-- DEC-80: one live SPK per source.
CREATE UNIQUE INDEX uq_spk_alert ON spks (alert_id)
  WHERE alert_id IS NOT NULL AND status <> 'Cancelled' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_spk_breakdown ON spks (breakdown_report_id)
  WHERE breakdown_report_id IS NOT NULL AND status <> 'Cancelled' AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_open_document_spk ON spks (vehicle_document_id)
  WHERE vehicle_document_id IS NOT NULL AND status NOT IN ('Completed','Cancelled') AND deleted_at IS NULL;
CREATE UNIQUE INDEX uq_spk_check ON spks (source_assignment_id)
  WHERE source_assignment_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX ix_spks_vehicle_status ON spks (vehicle_id, status);

CREATE TABLE spk_assignments (                -- the SPK's steps; frozen at approval (TX-02)
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  spk_id BIGINT NOT NULL REFERENCES spks(id) ON DELETE RESTRICT,
  sequence_no INT NOT NULL,
  module VARCHAR(40) NOT NULL REFERENCES assignment_modules(code) ON DELETE RESTRICT,
  step_config JSONB NOT NULL DEFAULT '{}',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  executor_roles role_t[] NOT NULL,
  verifier_role role_t NOT NULL,
  status asg_status_t NOT NULL DEFAULT 'Locked',
  team team_t,
  location_lat NUMERIC(9,6),
  location_lng NUMERIC(9,6),
  location_accuracy_m INT,
  location_captured_at TIMESTAMP,
  location_capture location_capture_t,
  stooring_rate_id BIGINT,                    -- reference added with stooring_rates (TASK-401)
  stooring_fee NUMERIC(14,2) NOT NULL DEFAULT 0,
  assigned_to BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  claimed_at TIMESTAMP,
  opened_at TIMESTAMP,
  executed_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  started_at TIMESTAMP,
  start_entered BOOLEAN NOT NULL DEFAULT false,
  attempt_no SMALLINT NOT NULL DEFAULT 1,
  worked_seconds INT,
  paused_seconds INT,
  submitted_at TIMESTAMP,
  verified_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  verified_at TIMESTAMP,
  self_verified BOOLEAN NOT NULL DEFAULT false,
  return_note TEXT,
  skip_reason TEXT,
  UNIQUE (spk_id, sequence_no)
);

ALTER TABLE spks ADD CONSTRAINT fk_spks_source_assignment
  FOREIGN KEY (source_assignment_id) REFERENCES spk_assignments(id) ON DELETE RESTRICT;

CREATE TABLE spk_approvals (                  -- AO, feeds the approval block
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  spk_id BIGINT NOT NULL REFERENCES spks(id) ON DELETE RESTRICT,
  change_request_id BIGINT,                   -- reference added with spk_change_requests (TASK-201)
  stage approval_stage_t NOT NULL,
  action approval_action_t NOT NULL,
  acted_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  approver_role role_t NOT NULL,
  acted_at TIMESTAMP NOT NULL DEFAULT now(),
  note TEXT,
  self_approved BOOLEAN NOT NULL DEFAULT false,
  CHECK (action NOT IN ('Approve','Reject') OR approver_role IN ('Supervisor','GM','System_Admin','Planner')),
  CHECK (action <> 'Reject' OR note IS NOT NULL)
);
CREATE INDEX ix_spk_approvals_spk ON spk_approvals (spk_id);
CREATE TRIGGER spk_approvals_append_only BEFORE UPDATE OR DELETE ON spk_approvals
  FOR EACH ROW EXECUTE FUNCTION refuse_change_of_append_only();

CREATE TABLE spk_parts (                      -- planned lines (required list) and actual lines
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  spk_id BIGINT NOT NULL REFERENCES spks(id) ON DELETE RESTRICT,
  assignment_id BIGINT REFERENCES spk_assignments(id) ON DELETE RESTRICT,
  sku VARCHAR(40),                            -- reference added with parts_catalog (TASK-301)
  tyre_size VARCHAR(30),
  tyre_id BIGINT,                             -- reference added with tyres (TASK-501)
  part_name VARCHAR(150) NOT NULL,
  for_step VARCHAR(13) NOT NULL DEFAULT 'Stock' CHECK (for_step IN ('Stock','Part_Purchase')),
  planned_qty INT NOT NULL DEFAULT 0 CHECK (planned_qty >= 0),
  qty INT NOT NULL DEFAULT 0 CHECK (qty >= 0),
  unit_price NUMERIC(14,4) NOT NULL DEFAULT 0,
  source part_source_t,
  goods_issue_item_id BIGINT,                 -- reference added with goods_issue_items (TASK-301)
  reverses_line_id BIGINT REFERENCES spk_parts(id) ON DELETE RESTRICT,
  CHECK (sku IS NOT NULL OR tyre_size IS NOT NULL OR tyre_id IS NOT NULL),
  CHECK (source IS DISTINCT FROM 'Warehouse' OR qty = 0 OR goods_issue_item_id IS NOT NULL OR tyre_id IS NOT NULL)
);
CREATE INDEX ix_spk_parts_spk ON spk_parts (spk_id);

CREATE TABLE spk_attachments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  spk_id BIGINT NOT NULL REFERENCES spks(id) ON DELETE RESTRICT,
  assignment_id BIGINT NOT NULL REFERENCES spk_assignments(id) ON DELETE RESTRICT,
  spk_part_id BIGINT REFERENCES spk_parts(id) ON DELETE RESTRICT,
  spk_service_id BIGINT,                      -- reference added with spk_services (TASK-402)
  check_item_id BIGINT,                       -- reference added with spk_check_items (TASK-201)
  attachment_type attachment_t NOT NULL,
  label VARCHAR(10) CHECK (label IN ('Before','After')),
  file_url VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  mime_type VARCHAR(100),
  size_bytes INT,
  uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX ix_spk_attachments_spk ON spk_attachments (spk_id);

-- NFR-15, DEC-111: the numbering formats, seeded with NUMBERING_CONFIG of @bmi/shared.
INSERT INTO app_settings (setting_key, setting_value) VALUES ('numbering_formats', '{
  "SPK": "SPK-{yymmdd}{NNNN}",
  "RB": "RB-{yymmdd}{NNNN}",
  "CR": "CR-{yymmdd}{NNNN}",
  "GR": "GR-{yymmdd}{NNNN}",
  "GRC": "GRC-{yymmdd}{NNNN}",
  "GI": "GI-{yymmdd}{NNNN}",
  "SA": "SA-{yymmdd}{NNNN}",
  "OB": "OB-{yymmdd}{NNNN}",
  "TR": "TR-{yymmdd}{NNNN}",
  "RD": "RD-{yymmdd}{NNNN}",
  "TC": "TC-{yymmdd}{NNNN}",
  "TY": "TY-{yymmdd}{NNNN}",
  "INVOICE": "{NNNN}/BMI/{dd-mm-yy}"
}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
