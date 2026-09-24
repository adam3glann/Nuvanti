import { Router } from 'express';
import { query } from '../lib/db.js';

const router = Router();

router.get('/settings', async (req, res) => {
  const { rows } = await query(`SELECT store_name AS "storeName", currency,
    standard_shipping_cents AS "standardShippingCents",
    express_shipping_cents AS "expressShippingCents",
    free_shipping_threshold_cents AS "freeShippingThresholdCents"
    FROM store_settings WHERE id = 1`);
  res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  res.json(rows[0] || {
    storeName: 'Nuvanti', currency: 'EGP', standardShippingCents: 7500,
    expressShippingCents: 15000, freeShippingThresholdCents: 300000,
  });
});

router.get('/homepage-slides', async (req, res) => {
  const { rows } = await query(`SELECT image_url AS "imageUrl", eyebrow, title, description,
    cta_label AS "ctaLabel", cta_href AS "ctaHref", secondary_label AS "secondaryLabel",
    secondary_href AS "secondaryHref", position
    FROM homepage_slides WHERE is_active = true ORDER BY position, id`);
  res.set('Cache-Control', 'no-store');
  res.json(rows);
});

export default router;
