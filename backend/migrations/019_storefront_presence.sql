-- Anonymous short-lived storefront presence. Each browser has an opaque,
-- rotating visitor UUID and each open tab has a transient UUID. No user,
-- email, IP address, or page URL is stored in this table.
CREATE TABLE IF NOT EXISTS storefront_presence (
  visitor_id UUID NOT NULL,
  tab_id UUID NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (visitor_id, tab_id)
);

CREATE INDEX IF NOT EXISTS storefront_presence_last_seen_idx
  ON storefront_presence (last_seen_at);
