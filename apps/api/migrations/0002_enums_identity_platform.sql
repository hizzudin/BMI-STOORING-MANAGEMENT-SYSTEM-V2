-- TX-01: the enums of §9.1 first, then §9.2 and the platform tables of §9.12 used in R1 step 1.
CREATE TYPE role_t            AS ENUM ('Planner','Mechanic','Warehouse_Manager','Supervisor','GM','System_Admin','Access_Manager','Driver','Field_Coordinator','Accounting');
CREATE TYPE vehicle_status_t  AS ENUM ('Active','Repair','Blocked','OFF','Inactive');
CREATE TYPE doc_status_t      AS ENUM ('Valid','Warning','Expired','Missing');
CREATE TYPE odo_source_t      AS ENUM ('Admin','Driver','Mechanic','GPS');
CREATE TYPE trigger_t         AS ENUM ('Mileage','Time');
CREATE TYPE alert_type_t      AS ENUM ('PM','Part_Item','Tyre','Document');
CREATE TYPE alert_status_t    AS ENUM ('Pending','Converted_To_SPK','Dismissed');
CREATE TYPE spk_status_t      AS ENUM ('Draft','Pending_Approval','Rejected','Active','In_Progress','Pending_Verification','Pending_Amendment','Completed','Cancelled');
CREATE TYPE spk_source_t      AS ENUM ('System_PM','Tyre_Alert','Part_Item_Alert','Document_Alert','Breakdown_Report','Part_Check','Manual_Planner','Manual_Admin');
CREATE TYPE report_kind_t     AS ENUM ('Breakdown','Inspection_Fail');
CREATE TYPE report_status_t   AS ENUM ('New','Converted','Rejected');
CREATE TYPE spk_category_t    AS ENUM ('PM','Corrective','Tyre','Document','Other');
CREATE TYPE asg_status_t      AS ENUM ('Locked','Open','In_Progress','Submitted','Verified','Skipped');
CREATE TYPE approval_stage_t  AS ENUM ('Creation','Completion','Amendment');
CREATE TYPE approval_action_t AS ENUM ('Submit','Approve','Reject','Cancel','Request_Completion');
CREATE TYPE cr_status_t       AS ENUM ('Submitted','In_Revision','Pending_Approval','Approved','Rejected');
CREATE TYPE part_source_t     AS ENUM ('Warehouse');
CREATE TYPE invoice_status_t  AS ENUM ('Draft','Issued','Paid','Void');
CREATE TYPE location_capture_t AS ENUM ('Captured','Denied','Unavailable');
CREATE TYPE team_t            AS ENUM ('Internal','External');
CREATE TYPE attachment_t      AS ENUM ('Invoice','Repair_Photo','Document_Scan','Receipt','DVIR_Photo','Check_Photo');
CREATE TYPE tyre_type_t       AS ENUM ('Tube','Tubeless');
CREATE TYPE placement_act_t   AS ENUM ('Baseline','Mount','Rotate','Demount','Scrap');
CREATE TYPE stock_tx_t        AS ENUM ('OB','GR','GRC','GI','GIR','SA');
CREATE TYPE reason_t          AS ENUM ('Damaged','Entry_Error','Lost','Found');
CREATE TYPE ai_provider_t     AS ENUM ('OpenAI','Anthropic');

-- §9.0 AO: append-only tables refuse UPDATE and DELETE (BR-10). The monthly audit archive (NFR-17) comes with TASK-110.
CREATE FUNCTION refuse_change_of_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only: % is not allowed (BR-10)', TG_TABLE_NAME, TG_OP;
END;
$$;

-- §9.2 Identity, access and audit
CREATE TABLE users (                          -- SD
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failed_logins SMALLINT NOT NULL DEFAULT 0,
  must_change_password BOOLEAN NOT NULL DEFAULT true,   -- REQ-IAM-009
  locked_until TIMESTAMP                      -- 5 failed sign-ins lock 15 minutes [A]
);
CREATE UNIQUE INDEX uq_users_email ON users (email) WHERE deleted_at IS NULL;   -- TX-18

-- The composite primary keys below are the ones §9.2 and §9.12 state; such a table has no id column.
CREATE TABLE user_roles (
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role role_t NOT NULL,
  PRIMARY KEY (user_id, role)
);
CREATE UNIQUE INDEX uq_one_role_per_user ON user_roles (user_id);                            -- BR-14
CREATE UNIQUE INDEX uq_one_system_admin  ON user_roles (role) WHERE role = 'System_Admin';   -- BR-14

CREATE TABLE role_permissions (               -- [A] permission matrix of 2.2, edited by the Access Manager
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  role role_t NOT NULL,
  permission_code VARCHAR(60) NOT NULL,
  allowed BOOLEAN NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (role, permission_code)
);

CREATE TABLE audit_logs (                     -- AO
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  entity VARCHAR(60) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(40) NOT NULL,
  before JSONB,
  after JSONB,
  reason TEXT,
  user_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
  user_role role_t,
  self_decision BOOLEAN NOT NULL DEFAULT false,
  at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_entity ON audit_logs (entity, entity_id);
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION refuse_change_of_append_only();

-- §9.12 Platform tables used in R1 step 1
CREATE TABLE app_settings (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  setting_key VARCHAR(60) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL
);

CREATE TABLE stored_files (                   -- every uploaded file (8.1)
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  storage_key VARCHAR(300) NOT NULL UNIQUE,
  thumb_key VARCHAR(300),
  profile VARCHAR(10) NOT NULL CHECK (profile IN ('Photo','Document','PDF')),
  mime_type VARCHAR(30) NOT NULL CHECK (mime_type IN ('image/jpeg','application/pdf')),
  original_name VARCHAR(255),
  original_bytes INT,
  stored_bytes INT,
  width INT, height INT, page_count INT,
  sha256 CHAR(64),
  captured_at TIMESTAMP,
  capture_source VARCHAR(8) CHECK (capture_source IN ('Camera','Gallery','File')),
  status VARCHAR(10) NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Ready','Rejected','Expired')),
  reject_reason TEXT,
  uploaded_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  attached_at TIMESTAMP,
  CHECK (status <> 'Ready' OR sha256 IS NOT NULL)
);

CREATE TABLE user_table_preferences (         -- column chooser and Parts or Tyres mode
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  table_key VARCHAR(60) NOT NULL,
  columns JSONB NOT NULL,
  PRIMARY KEY (user_id, table_key)
);

-- TASK-009 created idempotency_keys before users existed (DEC-108).
ALTER TABLE idempotency_keys
  ADD CONSTRAINT idempotency_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;
