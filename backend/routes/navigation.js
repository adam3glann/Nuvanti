import { Router } from 'express';
import { query } from '../lib/db.js';

const router = Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/', asyncRoute(async (req, res) => {
  const [categories, collections] = await Promise.all([
    query(`SELECT 'category' AS type, slug, name, menu_show AS "menuShow", menu_label AS "menuLabel", menu_style AS "menuStyle",
      menu_background_color AS "menuBackgroundColor", menu_background_end_color AS "menuBackgroundEndColor",
      menu_text_color AS "menuTextColor", menu_icon AS "menuIcon", menu_animation AS "menuAnimation",
      menu_desktop_appearance AS "menuDesktopAppearance", menu_mobile_appearance AS "menuMobileAppearance"
      FROM categories WHERE is_active = true ORDER BY name`),
    query(`SELECT 'collection' AS type, slug, name, menu_show AS "menuShow", menu_label AS "menuLabel", menu_style AS "menuStyle",
      menu_background_color AS "menuBackgroundColor", menu_background_end_color AS "menuBackgroundEndColor",
      menu_text_color AS "menuTextColor", menu_icon AS "menuIcon", menu_animation AS "menuAnimation",
      menu_desktop_appearance AS "menuDesktopAppearance", menu_mobile_appearance AS "menuMobileAppearance"
      FROM collections WHERE is_active = true ORDER BY name`),
  ]);
  res.set('Cache-Control', 'no-store').json([...collections.rows, ...categories.rows]);
}));

export default router;
