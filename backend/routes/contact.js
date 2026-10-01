import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { sendContactNotification } from '../lib/mail.js';
const router = Router();
const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many messages. Please try again later.' } });
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const messageSchema = z.object({ name: z.string().min(2).max(100).trim(), email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()), message: z.string().min(10).max(5000).trim() });
router.post('/', contactLimiter, asyncRoute(async (req, res) => {
  const message = messageSchema.parse(req.body);
  await query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [message.name, message.email, message.message]);
  const { rows } = await query('SELECT support_email AS "supportEmail" FROM store_settings WHERE id = 1');
  if (rows[0]?.supportEmail) {
    sendContactNotification({ to: rows[0].supportEmail, ...message })
      .catch((error) => console.error('Contact notification email failed:', error));
  }
  res.status(201).json({ ok: true });
}));
export default router;
