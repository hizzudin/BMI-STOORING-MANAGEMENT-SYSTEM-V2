-- §9.7 vendors (REQ-INV-014, DEC-134): the vendor master the System Admin keeps; Goods Receipts,
-- Part Purchase steps, External workshop services and retread dispatches pick from it.

CREATE TABLE vendors (                        -- SD
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  vendor_type VARCHAR(10) NOT NULL CHECK (vendor_type IN ('Supplier','Workshop','Retread','Shop')),
  phone VARCHAR(30),
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true
);
