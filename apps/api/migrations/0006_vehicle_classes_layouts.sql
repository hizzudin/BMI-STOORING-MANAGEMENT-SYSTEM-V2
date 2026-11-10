-- §9.3 vehicle classes and chassis layouts (REQ-PLC-013, REQ-PLC-017, REQ-PLC-019, DEC-68, DEC-120).
CREATE TABLE chassis_layouts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(100) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  definition JSONB NOT NULL,                  -- axles in order: role, tyres per side, spacing; front drawing; spare_count
  axle_count SMALLINT NOT NULL CHECK (axle_count > 0),
  tyre_count SMALLINT NOT NULL CHECK (tyre_count > 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (code, version)
);

CREATE TABLE vehicle_classes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  code VARCHAR(30) NOT NULL UNIQUE,
  unit_kind VARCHAR(7) NOT NULL DEFAULT 'Powered' CHECK (unit_kind IN ('Powered', 'Towed')),
  name VARCHAR(100) NOT NULL,
  default_chassis_layout_id BIGINT NOT NULL REFERENCES chassis_layouts(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE part_positions (                 -- generated from a layout's definition when the layout is saved
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  chassis_layout_id BIGINT NOT NULL REFERENCES chassis_layouts(id) ON DELETE RESTRICT,
  code VARCHAR(40) NOT NULL,
  position_kind VARCHAR(5) NOT NULL DEFAULT 'Wheel' CHECK (position_kind IN ('Wheel', 'Spare')),
  axle_index SMALLINT,
  side VARCHAR(5) CHECK (side IN ('Left', 'Right')),
  CHECK (position_kind = 'Spare' OR (axle_index IS NOT NULL AND side IS NOT NULL)),
  ordinal SMALLINT NOT NULL,
  label VARCHAR(80) NOT NULL,
  UNIQUE (chassis_layout_id, code)
);
