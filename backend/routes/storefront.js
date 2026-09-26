import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../lib/db.js';

const router = Router();
const presenceLimiter = rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false });
const presenceInput = z.object({
  action: z.enum(['heartbeat', 'leave']),
  visitorId: z.string().uuid(),
  tabId: z.string().uuid(),
});
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.post('/presence', presenceLimiter, asyncRoute(async (req, res) => {
  const parsed = presenceInput.safeParse({ ...req.query, ...req.body });
  if (!parsed.success) return res.status(400).json({ error: 'Invalid presence session.' });
  const { action, visitorId, tabId } = parsed.data;
  if (action === 'leave') {
    await query('DELETE FROM storefront_presence WHERE visitor_id = $1 AND tab_id = $2', [visitorId, tabId]);
  } else {
    await query(`DELETE FROM storefront_presence WHERE last_seen_at < NOW() - INTERVAL '90 seconds'`);
    await query(`INSERT INTO storefront_presence (visitor_id, tab_id, last_seen_at) VALUES ($1, $2, NOW())
      ON CONFLICT (visitor_id, tab_id) DO UPDATE SET last_seen_at = NOW()`, [visitorId, tabId]);
  }
  res.set('Cache-Control', 'no-store').status(204).end();
}));

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
    secondary_href AS "secondaryHref", position, duration_seconds AS "durationSeconds",
    text_color AS "textColor", eyebrow_color AS "eyebrowColor", title_color AS "titleColor",
    description_color AS "descriptionColor", button_text_color AS "buttonTextColor"
    FROM homepage_slides WHERE is_active = true ORDER BY position, id`);
  res.set('Cache-Control', 'no-store');
  res.json(rows);
});

export default router;
