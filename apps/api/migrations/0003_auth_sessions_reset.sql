-- §9.2 sign-in tables (NFR-05, DEC-102, DEC-114). Tokens are stored only as SHA-256 hashes.

CREATE TABLE auth_sessions (                  -- one signed-in device
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  client VARCHAR(10) NOT NULL CHECK (client IN ('web','mobile')),
  refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,   -- rotates on every refresh
  last_seen_at TIMESTAMP NOT NULL DEFAULT now(),    -- web: ends 30 minutes after this
  expires_at TIMESTAMP NOT NULL,              -- mobile: created_at + 30 days
  revoked_at TIMESTAMP                        -- sign out, password change, reset, deactivation
);
CREATE INDEX ix_auth_sessions_user ON auth_sessions (user_id) WHERE revoked_at IS NULL;

CREATE TABLE password_reset_tokens (          -- Forgot password? link
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,              -- created_at + 60 minutes
  used_at TIMESTAMP                           -- works once; a newer link or a password change voids the older ones
);
CREATE INDEX ix_password_reset_tokens_user ON password_reset_tokens (user_id) WHERE used_at IS NULL;
