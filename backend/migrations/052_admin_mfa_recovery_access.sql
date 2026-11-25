ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_mfa_exempt BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve the explicit recovery resets made before this access flag existed.
UPDATE users u
SET admin_mfa_exempt = TRUE
WHERE u.totp_enabled_at IS NULL
  AND EXISTS (
    SELECT 1 FROM audit_logs a
    WHERE a.target_type = 'user'
      AND a.target_id = u.id::text
      AND a.action = 'admin_user.mfa_disabled_by_admin'
  );
