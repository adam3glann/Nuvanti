ALTER TABLE products ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS products_metadata_featured_idx ON products ((metadata->>'featured'));
