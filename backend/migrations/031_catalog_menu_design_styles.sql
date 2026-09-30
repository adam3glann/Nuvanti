ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_menu_style_check,
  ADD CONSTRAINT categories_menu_style_check
    CHECK (menu_style IN ('link', 'pill', 'card', 'outline', 'soft', 'glass'));

ALTER TABLE collections
  DROP CONSTRAINT IF EXISTS collections_menu_style_check,
  ADD CONSTRAINT collections_menu_style_check
    CHECK (menu_style IN ('link', 'pill', 'card', 'outline', 'soft', 'glass'));
