-- TASK-201: the engine tables of §9.6 and the references DEC-124 left open (DEC-95, DEC-144).
-- The dummy module of the engine is registered by the tests only, never here (DEC-144).

CREATE TABLE spk_presets (                     -- SD; saved step sequences, a starting point only (DEC-85)
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  name VARCHAR(100) NOT NULL,
  category spk_category_t NOT NULL,
  requires_downtime BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,             -- Save as preset with an existing name adds a version (REQ-REG-003)
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true
);
-- §9.0: the UNIQUE (name, version) of §9.6 ignores soft-deleted presets.
CREATE UNIQUE INDEX ux_spk_presets_name_version ON spk_presets (name, version) WHERE deleted_at IS NULL;

CREATE TABLE spk_preset_steps (                -- one row per step per preset version
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  preset_id BIGINT NOT NULL REFERENCES spk_presets(id) ON DELETE RESTRICT,
  sequence_no INT NOT NULL CHECK (sequence_no > 0),
  module VARCHAR(40) NOT NULL REFERENCES assignment_modules(code) ON DELETE RESTRICT,
  step_config JSONB NOT NULL DEFAULT '{}',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  executor_roles role_t[] NOT NULL,
  verifier_role role_t NOT NULL CHECK (verifier_role IN ('Planner','System_Admin')),
  UNIQUE (preset_id, sequence_no)             -- the same module may repeat; step_config holds the saved step details
);

CREATE TABLE step_time_events (               -- AO, every Open, Start, Pause, Resume, Submit, Return, Verify of a step (DEC-87)
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  assignment_id BIGINT NOT NULL REFERENCES spk_assignments(id) ON DELETE RESTRICT,
  attempt_no SMALLINT NOT NULL,
  event VARCHAR(8) NOT NULL CHECK (event IN ('Open','Start','Pause','Resume','Submit','Return','Verify','Skip')),
  at TIMESTAMP NOT NULL,                      -- server time, or phone time for an offline phone
  recorded_at TIMESTAMP NOT NULL DEFAULT now(),
  pause_reason VARCHAR(22) CHECK (pause_reason IN ('Waiting_Parts','Waiting_Vehicle','Waiting_Vendor_Agency','Break_Shift_End','Change_Request','Other')),
  note TEXT,                                  -- required for Other and for an entered start
  entered_late BOOLEAN NOT NULL DEFAULT false,
  clock_flag BOOLEAN NOT NULL DEFAULT false,  -- phone time more than 10 min off the server time
  actor_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,   -- NULL for System events
  on_behalf_of VARCHAR(150),                  -- external workshop name
  CHECK (event <> 'Pause' OR pause_reason IS NOT NULL),
  CHECK (pause_reason IS DISTINCT FROM 'Other' OR note IS NOT NULL)
);
CREATE INDEX ix_step_time_events_assignment ON step_time_events (assignment_id, attempt_no, at);
CREATE TRIGGER step_time_events_append_only BEFORE UPDATE OR DELETE ON step_time_events
  FOR EACH ROW EXECUTE FUNCTION refuse_change_of_append_only();

CREATE TABLE step_time_corrections (          -- AO, System Admin only; the original event is never changed
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  event_id BIGINT NOT NULL REFERENCES step_time_events(id) ON DELETE RESTRICT,
  old_at TIMESTAMP NOT NULL,
  new_at TIMESTAMP NOT NULL,
  reason TEXT NOT NULL,
  corrected_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  corrected_at TIMESTAMP NOT NULL DEFAULT now()
);   -- reports and the SPK document use the latest correction of each event
CREATE INDEX ix_step_time_corrections_event ON step_time_corrections (event_id, corrected_at);
CREATE TRIGGER step_time_corrections_append_only BEFORE UPDATE OR DELETE ON step_time_corrections
  FOR EACH ROW EXECUTE FUNCTION refuse_change_of_append_only();

CREATE TABLE mobilisation_location_trail (    -- AO; the location trail while a Mobilisasi step is In_Progress (REQ-MBL-005, RSK-09)
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  assignment_id BIGINT NOT NULL REFERENCES spk_assignments(id) ON DELETE RESTRICT,
  attempt_no SMALLINT NOT NULL,
  lat NUMERIC(9,6) NOT NULL,
  lng NUMERIC(9,6) NOT NULL,
  accuracy_m INT,
  recorded_at TIMESTAMP NOT NULL,             -- only between Start and Submit of the step
  received_at TIMESTAMP NOT NULL DEFAULT now()
);   -- visible to Planner and System Admin only; every read is written to an access log (TASK-708)
CREATE INDEX ix_mobilisation_trail_assignment ON mobilisation_location_trail (assignment_id, attempt_no, recorded_at);
CREATE TRIGGER mobilisation_location_trail_append_only BEFORE UPDATE OR DELETE ON mobilisation_location_trail
  FOR EACH ROW EXECUTE FUNCTION refuse_change_of_append_only();

CREATE SEQUENCE cr_number_seq;                 -- running part of CR-yymmddNNNN, never reset, never reused (NFR-15, DEC-110)
CREATE TABLE spk_change_requests (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  cr_number VARCHAR(30) NOT NULL UNIQUE,       -- CR-yymmddNNNN (DEC-111)
  spk_id BIGINT NOT NULL REFERENCES spks(id) ON DELETE RESTRICT,
  assignment_id BIGINT NOT NULL REFERENCES spk_assignments(id) ON DELETE RESTRICT,
  requested_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,   -- executor of the open step
  reason TEXT NOT NULL,
  requested_change JSONB NOT NULL,
  revision JSONB,                             -- proposed content from the SPK creator
  revised_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  status cr_status_t NOT NULL DEFAULT 'Submitted',
  decided_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,   -- Supervisor, GM or System Admin
  decided_at TIMESTAMP,
  decision_note TEXT,
  amendment_no_applied INT
);
CREATE INDEX ix_spk_change_requests_spk ON spk_change_requests (spk_id);

CREATE TABLE spk_check_items (                 -- Part Check lines (DEC-88)
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  assignment_id BIGINT NOT NULL REFERENCES spk_assignments(id) ON DELETE RESTRICT,
  line_no INT NOT NULL,
  sku VARCHAR(40),                            -- reference added with parts_catalog (TASK-301), DEC-124
  part_item_type_id BIGINT,                   -- reference added with part_item_types, DEC-124
  tyre_position VARCHAR(10),                  -- for a tyre, the position on the chassis layout
  label VARCHAR(150) NOT NULL,
  what_to_check TEXT,
  added_by_executor BOOLEAN NOT NULL DEFAULT false,
  condition_note TEXT,                        -- required at submit
  decision VARCHAR(7) CHECK (decision IN ('Good','Repair','Replace')),   -- required at submit
  unsafe_to_drive BOOLEAN NOT NULL DEFAULT false,
  decided_by BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  UNIQUE (assignment_id, line_no),
  CHECK (decision IS NOT NULL OR NOT unsafe_to_drive),
  CHECK (decision IS DISTINCT FROM 'Good' OR NOT unsafe_to_drive)
);   -- submit guard: every line has condition_note, decision and at least one Check_Photo

-- DEC-124: the references 0009 left as plain columns.
ALTER TABLE spks ADD CONSTRAINT fk_spks_preset
  FOREIGN KEY (preset_id) REFERENCES spk_presets(id) ON DELETE RESTRICT;
ALTER TABLE spk_attachments ADD CONSTRAINT fk_spk_attachments_check_item
  FOREIGN KEY (check_item_id) REFERENCES spk_check_items(id) ON DELETE RESTRICT;
ALTER TABLE spk_approvals ADD CONSTRAINT fk_spk_approvals_change_request
  FOREIGN KEY (change_request_id) REFERENCES spk_change_requests(id) ON DELETE RESTRICT;
