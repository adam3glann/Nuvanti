ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS menu_show BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_label TEXT,
  ADD COLUMN IF NOT EXISTS menu_style TEXT NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS menu_background_color TEXT,
  ADD COLUMN IF NOT EXISTS menu_text_color TEXT;

ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS menu_show BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS menu_label TEXT,
  ADD COLUMN IF NOT EXISTS menu_style TEXT NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS menu_background_color TEXT,
  ADD COLUMN IF NOT EXISTS menu_text_color TEXT;

ALTER TABLE categories
  ADD CONSTRAINT categories_menu_style_check CHECK (menu_style IN ('link', 'pill', 'card')),
  ADD CONSTRAINT categories_menu_background_color_check CHECK (menu_background_color IS NULL OR menu_background_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT categories_menu_text_color_check CHECK (menu_text_color IS NULL OR menu_text_color ~ '^#[0-9a-fA-F]{6}$');

ALTER TABLE collections
  ADD CONSTRAINT collections_menu_style_check CHECK (menu_style IN ('link', 'pill', 'card')),
  ADD CONSTRAINT collections_menu_background_color_check CHECK (menu_background_color IS NULL OR menu_background_color ~ '^#[0-9a-fA-F]{6}$'),
  ADD CONSTRAINT collections_menu_text_color_check CHECK (menu_text_color IS NULL OR menu_text_color ~ '^#[0-9a-fA-F]{6}$');
