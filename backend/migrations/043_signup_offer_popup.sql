ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS signup_offer_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS signup_offer_delay_seconds INTEGER NOT NULL DEFAULT 8
    CHECK (signup_offer_delay_seconds BETWEEN 1 AND 120),
  ADD COLUMN IF NOT EXISTS signup_offer_title TEXT NOT NULL DEFAULT 'Create an account and get free delivery',
  ADD COLUMN IF NOT EXISTS signup_offer_text TEXT NOT NULL DEFAULT 'Join Nuvanti for free delivery on your first order. Create an account or sign in to get started.';
