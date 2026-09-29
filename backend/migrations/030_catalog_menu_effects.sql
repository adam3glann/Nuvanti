ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS menu_icon TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS menu_animation TEXT NOT NULL DEFAULT 'none',
  ADD CONSTRAINT categories_menu_icon_check
    CHECK (menu_icon IN ('none', 'sparkle', 'star', 'heart', 'arrow')),
  ADD CONSTRAINT categories_menu_animation_check
    CHECK (menu_animation IN ('none', 'ice', 'pulse', 'float'));

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS menu_icon TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS menu_animation TEXT NOT NULL DEFAULT 'none',
  ADD CONSTRAINT collections_menu_icon_check
    CHECK (menu_icon IN ('none', 'sparkle', 'star', 'heart', 'arrow')),
  ADD CONSTRAINT collections_menu_animation_check
    CHECK (menu_animation IN ('none', 'ice', 'pulse', 'float'));

-- Give the existing SUMMER '26 menu pill a quiet sparkle and ice-shine entrance.
UPDATE collections
SET menu_icon = 'sparkle', menu_animation = 'ice'
WHERE slug = 'unisex'
  AND menu_icon = 'none'
  AND menu_animation = 'none';
