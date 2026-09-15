import { Router } from 'express';
import { query } from '../lib/db.js';
const router = Router();
router.get('/', async (req, res) => { const { rows } = await query('SELECT id, slug, name, description, image_url AS "imageUrl" FROM categories WHERE is_active = true ORDER BY name'); res.json(rows); });
export default router;
