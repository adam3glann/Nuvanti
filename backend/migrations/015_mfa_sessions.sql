ALTER TABLE users
  ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS totp_pending_secret_enc TEXT,
  ADD COLUMN IF NOT EXISTS totp_pending_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS totp_last_step BIGINT NOT NULL DEFAULT -1,
  ADD COLUMN IF NOT EXISTS totp_recovery_codes JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_version INTEGER NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_active_idx
  ON auth_sessions (user_id, created_at DESC)
  WHERE revoked_at IS NULL;
