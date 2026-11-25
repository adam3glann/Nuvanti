-- Older network lockouts stored only an opaque IP/account hash, so they
-- cannot be reliably assigned to an admin. Clear those legacy rows once;
-- new lockouts include user_id and can be unblocked individually.
DELETE FROM admin_login_ip_blocks WHERE user_id IS NULL;
