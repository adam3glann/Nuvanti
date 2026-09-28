ALTER TABLE homepage_slides
  ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;

CREATE TABLE IF NOT EXISTS storefront_metrics (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  total_views BIGINT NOT NULL DEFAULT 0 CHECK (total_views >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO storefront_metrics (id, total_views)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
