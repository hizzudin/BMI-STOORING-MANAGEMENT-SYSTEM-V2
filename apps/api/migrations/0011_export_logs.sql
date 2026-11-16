-- §9.12 export_logs (REQ-IAM-007, DEC-74, DEC-131): every file export is written here; the Audit log
-- export is the first (export_type audit_log), the stock card export follows (REQ-INV-008).

CREATE TABLE export_logs (                    -- AO
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  export_type VARCHAR(40) NOT NULL,           -- stock_card, report, audit_log
  parameters JSONB NOT NULL,
  file_format VARCHAR(5) NOT NULL CHECK (file_format IN ('xlsx','csv','pdf')),
  at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE TRIGGER export_logs_append_only BEFORE UPDATE OR DELETE ON export_logs
  FOR EACH ROW EXECUTE FUNCTION refuse_change_of_append_only();
