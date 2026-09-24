CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  consented_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmation_token_hash TEXT UNIQUE,
  confirmation_expires_at TIMESTAMPTZ,
  unsubscribe_token_hash TEXT NOT NULL UNIQUE,
  confirmed_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS newsletter_active_idx
  ON newsletter_subscribers (confirmed_at DESC)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;
