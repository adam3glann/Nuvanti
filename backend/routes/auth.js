import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../lib/db.js';
import { clearSession, requireAuth, sessionCookie, signSession } from '../lib/auth.js';

const router = Router();
const credentials = z.object({ email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()), password: z.string().min(8).max(128) });

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

router.post('/logout', (req, res) => { clearSession(res); res.status(204).end(); });
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, email, name, role FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
  if (!rows[0]) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user: rows[0] });
});

export default router;
