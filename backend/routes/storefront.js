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

export default router;
