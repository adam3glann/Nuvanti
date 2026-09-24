-- Extend the role model to match the 4-tier permission matrix the admin UI
-- already ships (super_admin/admin/manager/staff) but the database never
-- allowed. Without this, the backend can only ever grant all-or-nothing
-- admin access, regardless of what the Roles & Permissions screen shows.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'staff', 'manager', 'admin', 'super_admin'));
  END IF;
END $$;

-- Brute-force login protection: track consecutive failed attempts and a
-- temporary lockout window per account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- Security-relevant admin actions (logins, account changes, destructive
-- catalog/order actions) so the Audit Log screen shows real activity.
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);
