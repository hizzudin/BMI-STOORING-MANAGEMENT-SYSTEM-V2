-- §9.3 vehicles (REQ-VEH-001 to REQ-VEH-004, REQ-PLC-018, DEC-17, DEC-122).
-- customer_id has no reference yet: customers come in TASK-701, which adds it (DEC-122).
CREATE TABLE vehicles (                       -- SD, OL
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  license_plate VARCHAR(20) NOT NULL,
  vin VARCHAR(30),
  engine_number VARCHAR(30),
  vehicle_class_id BIGINT NOT NULL REFERENCES vehicle_classes(id) ON DELETE RESTRICT,
  chassis_layout_id BIGINT NOT NULL REFERENCES chassis_layouts(id) ON DELETE RESTRICT,
  brand VARCHAR(50),
  model VARCHAR(50),
  year SMALLINT,
  fuel_type VARCHAR(20),
  customer_id BIGINT,
  current_odometer INT NOT NULL DEFAULT 0 CHECK (current_odometer >= 0),
  status vehicle_status_t NOT NULL DEFAULT 'Active',
  deactivated_at TIMESTAMP,
  deactivate_reason TEXT,
  version INT NOT NULL DEFAULT 1
);

-- TX-18: unique among vehicles that are not soft-deleted.
CREATE UNIQUE INDEX ux_vehicles_license_plate ON vehicles (license_plate) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_vehicles_vin ON vehicles (vin) WHERE deleted_at IS NULL AND vin IS NOT NULL;
CREATE INDEX ix_vehicles_class ON vehicles (vehicle_class_id);
CREATE INDEX ix_vehicles_layout ON vehicles (chassis_layout_id);
