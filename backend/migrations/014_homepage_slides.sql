CREATE TABLE IF NOT EXISTS homepage_slides (
  id BIGSERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  eyebrow TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT 'Shop Now',
  cta_href TEXT NOT NULL DEFAULT 'shop.html',
  secondary_label TEXT NOT NULL DEFAULT '',
  secondary_href TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO homepage_slides (image_url, eyebrow, title, description, cta_label, cta_href, secondary_label, secondary_href, position)
SELECT seed.image_url, seed.eyebrow, seed.title, seed.description, seed.cta_label, seed.cta_href,
  seed.secondary_label, seed.secondary_href, seed.position
FROM (VALUES
  ('assets/img/lifestyle/campaign-tanktop.webp', 'SUMMER ''26', 'Embroidered details, made to be noticed.', 'Ribbed tanks finished with hand-drawn embroidery — the Cup motif or the Nuvanti Star, both in soft cream cotton.', 'Shop Tank Tops', 'shop.html?category=tank-tops', 'Explore the Shop', 'shop.html', 0),
  ('assets/img/lifestyle/hero-polo-couple.webp', 'Bestseller', 'The knitted polo everyone asks about.', 'Contrast tipping, chest embroidery, and a star crest on the back — in Navy, Off-White, and Olive.', 'Shop the Polo', 'product.html?slug=knitted-embroidered-polo', '', '', 1),
  ('assets/img/lifestyle/hero-sweatpants-group.webp', 'Nuv Sweatpants', 'Wide-leg comfort, built to move.', 'Premium cotton fleece with a graffiti-style back patch. Currently sold out — join the list for restock news.', 'View Sweatpants', 'product.html?slug=nuv-sweatpants', '', '', 2)
) AS seed(image_url, eyebrow, title, description, cta_label, cta_href, secondary_label, secondary_href, position)
WHERE NOT EXISTS (SELECT 1 FROM homepage_slides);

CREATE INDEX IF NOT EXISTS homepage_slides_active_position_idx ON homepage_slides (is_active, position, id);
