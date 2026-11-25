ALTER TABLE admin_login_ip_blocks
  ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS admin_login_ip_blocks_user_idx
  ON admin_login_ip_blocks (user_id, blocked_until);
