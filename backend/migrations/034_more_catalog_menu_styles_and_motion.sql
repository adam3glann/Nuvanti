ALTER TABLE categories
  DROP CONSTRAINT IF EXISTS categories_menu_style_check,
  ADD CONSTRAINT categories_menu_style_check
    CHECK (menu_style IN ('link', 'pill', 'card', 'outline', 'soft', 'glass', 'gradient', 'elevated', 'glow', 'cut', 'underline', 'double', 'sticker', 'gradient-outline', 'neon', 'dashed', 'tag', 'corner', 'inset')),
  DROP CONSTRAINT IF EXISTS categories_menu_icon_check,
  ADD CONSTRAINT categories_menu_icon_check
    CHECK (menu_icon IN ('none', 'sparkle', 'star', 'heart', 'arrow', 'leaf', 'diamond', 'bolt', 'flower', 'crown', 'dot', 'sun', 'moon', 'wave', 'check', 'smile', 'plus', 'ribbon', 'flame')),
  DROP CONSTRAINT IF EXISTS categories_menu_animation_check,
  ADD CONSTRAINT categories_menu_animation_check
    CHECK (menu_animation IN ('none', 'ice', 'pulse', 'float', 'glow', 'bounce', 'sweep', 'shine', 'tilt', 'orbit', 'twinkle', 'wave', 'pop'));

ALTER TABLE collections
  DROP CONSTRAINT IF EXISTS collections_menu_style_check,
  ADD CONSTRAINT collections_menu_style_check
    CHECK (menu_style IN ('link', 'pill', 'card', 'outline', 'soft', 'glass', 'gradient', 'elevated', 'glow', 'cut', 'underline', 'double', 'sticker', 'gradient-outline', 'neon', 'dashed', 'tag', 'corner', 'inset')),
  DROP CONSTRAINT IF EXISTS collections_menu_icon_check,
  ADD CONSTRAINT collections_menu_icon_check
    CHECK (menu_icon IN ('none', 'sparkle', 'star', 'heart', 'arrow', 'leaf', 'diamond', 'bolt', 'flower', 'crown', 'dot', 'sun', 'moon', 'wave', 'check', 'smile', 'plus', 'ribbon', 'flame')),
  DROP CONSTRAINT IF EXISTS collections_menu_animation_check,
  ADD CONSTRAINT collections_menu_animation_check
    CHECK (menu_animation IN ('none', 'ice', 'pulse', 'float', 'glow', 'bounce', 'sweep', 'shine', 'tilt', 'orbit', 'twinkle', 'wave', 'pop'));
