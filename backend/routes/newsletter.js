import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { sendNewsletterConfirmation } from '../lib/mail.js';
import { apiPublicOrigin, storePublicOrigin } from '../lib/publicOrigins.js';

const router = Router();
const subscriptionLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false });
const emailSchema = z.object({ email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) });
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

router.post('/', subscriptionLimiter, async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });
  const { email } = parsed.data;
  const { rows: existing } = await query('SELECT confirmed_at AS "confirmedAt", unsubscribed_at AS "unsubscribedAt" FROM newsletter_subscribers WHERE email = $1', [email]);
  if (existing[0]?.confirmedAt && !existing[0].unsubscribedAt) {
    return res.status(202).json({ message: 'If needed, check your inbox to confirm your subscription.' });
  }

  const confirmationToken = crypto.randomBytes(32).toString('hex');
  const unsubscribeToken = crypto.randomBytes(32).toString('hex');
  await query(`INSERT INTO newsletter_subscribers (email, consented_at, confirmation_token_hash, confirmation_expires_at, unsubscribe_token_hash, confirmed_at, unsubscribed_at)
    VALUES ($1, NOW(), $2, NOW() + INTERVAL '24 hours', $3, NULL, NULL)
    ON CONFLICT (email) DO UPDATE SET consented_at = NOW(), confirmation_token_hash = EXCLUDED.confirmation_token_hash,
      confirmation_expires_at = EXCLUDED.confirmation_expires_at, unsubscribe_token_hash = EXCLUDED.unsubscribe_token_hash,
      confirmed_at = NULL, unsubscribed_at = NULL`, [email, digest(confirmationToken), digest(unsubscribeToken)]);
  const storeOrigin = storePublicOrigin();
  const apiOrigin = apiPublicOrigin();
  try {
    await sendNewsletterConfirmation({
      to: email,
      confirmUrl: `${apiOrigin}/api/newsletter/confirm/${confirmationToken}`,
      unsubscribeUrl: `${storeOrigin}/?newsletter=unsubscribe&token=${unsubscribeToken}`,
    });
  } catch (error) {
    await query('UPDATE newsletter_subscribers SET confirmation_token_hash = NULL, confirmation_expires_at = NULL WHERE email = $1 AND confirmation_token_hash = $2', [email, digest(confirmationToken)]);
    throw error;
  }
  res.status(202).json({ message: 'Check your inbox for a confirmation link. Your subscription starts after you confirm.' });
});

router.get('/confirm/:token', async (req, res) => {
  const storeOrigin = storePublicOrigin();
  if (!/^[a-f0-9]{64}$/.test(req.params.token)) return res.redirect(`${storeOrigin}/?newsletter=invalid`);
  const result = await query(`UPDATE newsletter_subscribers SET confirmed_at = NOW(), confirmation_token_hash = NULL, confirmation_expires_at = NULL
    WHERE confirmation_token_hash = $1 AND confirmation_expires_at > NOW() AND unsubscribed_at IS NULL`, [digest(req.params.token)]);
  res.redirect(`${storeOrigin}/?newsletter=${result.rowCount ? 'confirmed' : 'invalid'}`);
});

router.post('/unsubscribe', async (req, res) => {
  const parsed = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'This unsubscribe link is invalid.' });
  const result = await query('UPDATE newsletter_subscribers SET unsubscribed_at = NOW(), confirmation_token_hash = NULL, confirmation_expires_at = NULL WHERE unsubscribe_token_hash = $1 AND unsubscribed_at IS NULL', [digest(parsed.data.token)]);
  if (!result.rowCount) return res.status(404).json({ error: 'This link has already been used or is invalid.' });
  res.status(204).end();
});

export default router;
