import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { clearSession, requireAuth, sessionCookie, signSession } from '../lib/auth.js';
import { sendPasswordReset } from '../lib/mail.js';

const router = Router();
const credentials = z.object({ email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()), password: z.string().min(8).max(128) });
const resetRequest = z.object({ email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()) });
const resetPassword = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(128) });

router.post('/register', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const name = z.string().min(2).max(100).parse(req.body.name).trim();
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await query('INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role', [email, name, passwordHash, 'customer']);
    sessionCookie(res, signSession(rows[0]));
    res.status(201).json({ user: rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account already exists for this email.' });
    throw error;
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const { rows } = await query('SELECT id, email, name, role, password_hash FROM users WHERE email = $1 AND is_active = true', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid email or password.' });
  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  sessionCookie(res, signSession(safeUser));
  res.json({ user: safeUser });
});

// Always return the same response so people cannot discover which emails
// are registered. Only staff accounts may use the admin reset flow.
router.post('/password-reset/request', async (req, res) => {
  const { email } = resetRequest.parse(req.body);
  const { rows } = await query(`SELECT id, email FROM users WHERE email = $1 AND is_active = true AND role IN ('admin', 'super_admin')`, [email]);
  const user = rows[0];
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < NOW()', [user.id]);
    await query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`, [user.id, hash]);
    const baseUrl = process.env.ADMIN_APP_URL || process.env.ADMIN_ORIGIN || 'http://localhost:4001';
    await sendPasswordReset({ to: user.email, resetUrl: `${baseUrl}/login.html?reset=${token}` });
  }
  res.status(202).json({ message: 'If an authorized account exists for that email, a reset link has been sent.' });
});

router.post('/password-reset/confirm', async (req, res) => {
  const { token, password } = resetPassword.parse(req.body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query(`SELECT pr.id, pr.user_id FROM password_reset_tokens pr JOIN users u ON u.id = pr.user_id WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW() AND u.is_active = true AND u.role IN ('admin', 'super_admin') FOR UPDATE`, [hash]);
  if (!rows[0]) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  const passwordHash = await bcrypt.hash(password, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, rows[0].user_id]);
  await query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [rows[0].user_id]);
  res.status(204).end();
});

router.post('/logout', (req, res) => { clearSession(res); res.status(204).end(); });
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, email, name, role FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
  if (!rows[0]) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user: rows[0] });
});

export default router;
