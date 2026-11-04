-- §9.12, TX-22, DEC-108. The foreign key to users arrives with TASK-103, which creates users.
CREATE TABLE idempotency_keys (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  user_id BIGINT NOT NULL,
  idem_key VARCHAR(100) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status SMALLINT,
  response_body JSONB,
  UNIQUE (user_id, idem_key)
);
