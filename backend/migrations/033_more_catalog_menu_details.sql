ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_menu_icon_check,
  ADD CONSTRAINT categories_menu_icon_check
    CHECK (menu_icon IN ('none', 'sparkle', 'star', 'heart', 'arrow', 'leaf', 'diamond', 'bolt', 'flower', 'crown', 'dot')),
  DROP CONSTRAINT IF EXISTS categories_menu_animation_check,
  ADD CONSTRAINT categories_menu_animation_check
    CHECK (menu_animation IN ('none', 'ice', 'pulse', 'float', 'glow', 'bounce', 'sweep'));

ALTER TABLE collections
  DROP CONSTRAINT IF EXISTS collections_menu_icon_check,
  ADD CONSTRAINT collections_menu_icon_check
    CHECK (menu_icon IN ('none', 'sparkle', 'star', 'heart', 'arrow', 'leaf', 'diamond', 'bolt', 'flower', 'crown', 'dot')),
  DROP CONSTRAINT IF EXISTS collections_menu_animation_check,
  ADD CONSTRAINT collections_menu_animation_check
    CHECK (menu_animation IN ('none', 'ice', 'pulse', 'float', 'glow', 'bounce', 'sweep'));
