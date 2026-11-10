-- §9.4 document types and the classes that must have them (REQ-DOC-001, REQ-DOC-002, DEC-121).
-- preset_id (DEC-86) comes with the SPK presets in TASK-208.
CREATE TABLE document_types (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  usual_validity_months SMALLINT CHECK (usual_validity_months > 0),
  warning_days SMALLINT NOT NULL DEFAULT 30 CHECK (warning_days > 0),
  receipt_required BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE document_type_classes (
  document_type_id BIGINT NOT NULL REFERENCES document_types(id) ON DELETE RESTRICT,
  vehicle_class_id BIGINT NOT NULL REFERENCES vehicle_classes(id) ON DELETE RESTRICT,
  PRIMARY KEY (document_type_id, vehicle_class_id)
);

-- DEC-121: the four launch types; the System Admin ticks the classes that need them.
INSERT INTO document_types (code, name, usual_validity_months, warning_days, receipt_required) VALUES
  ('STNK_Annual', 'STNK annual', 12, 30, true),
  ('STNK_5Year', 'STNK five-year', 60, 30, true),
  ('KIR', 'KIR', 6, 30, true),
  ('Insurance', 'Insurance', 12, 30, true);
