-- Guests have no users row; their order access is protected by tracking_token.
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
