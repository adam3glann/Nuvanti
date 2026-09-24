import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query, transaction } from '../lib/db.js';
import { clearSession, readSession, requireAuth, sessionCookie, signSession } from '../lib/auth.js';
import { sendPasswordReset, sendVerificationEmail } from '../lib/mail.js';
import { logAudit } from '../lib/audit.js';

const STAFF_ROLES = ['staff', 'manager', 'admin', 'super_admin'];
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

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
    await logAudit({ req, actor: rows[0], action: 'auth.register', targetType: 'user', targetId: rows[0].id });
    res.status(201).json({ user: rows[0] });
    sendVerificationLink(rows[0]).catch((error) => console.error('Verification email failed:', error));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account already exists for this email.' });
    throw error;
  }
});

async function sendVerificationLink(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM email_verification_tokens WHERE user_id = $1 OR expires_at < NOW()', [user.id]);
  await query(`INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`, [user.id, hash]);
  const storeOrigin = process.env.STORE_ORIGIN || 'http://localhost:8080';
  await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl: `${storeOrigin}/account.html?verify=${token}` });
}

router.post('/login', async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const { rows } = await query('SELECT id, email, name, role, password_hash, failed_login_count, locked_until FROM users WHERE email = $1 AND is_active = true', [email]);
  const user = rows[0];

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    await logAudit({ req, actor: user, action: 'auth.login_blocked', targetType: 'user', targetId: user.id, metadata: { reason: 'locked' } });
    return res.status(423).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
  }

  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) {
    if (user) {
      const nextCount = user.failed_login_count + 1;
      const lock = nextCount >= MAX_FAILED_ATTEMPTS;
      await query(
        `UPDATE users SET failed_login_count = $1, locked_until = ${lock ? `NOW() + INTERVAL '${LOCKOUT_MINUTES} minutes'` : 'locked_until'} WHERE id = $2`,
        [nextCount, user.id],
      );
      await logAudit({ req, actor: user, action: lock ? 'auth.account_locked' : 'auth.login_failed', targetType: 'user', targetId: user.id, metadata: { failedAttempts: nextCount } });
    } else {
      await logAudit({ req, action: 'auth.login_failed', metadata: { email } });
    }
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.failed_login_count > 0 || user.locked_until) {
    await query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [user.id]);
  }
  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role };
  sessionCookie(res, signSession(safeUser));
  await logAudit({ req, actor: safeUser, action: 'auth.login_success', targetType: 'user', targetId: safeUser.id });
  res.json({ user: safeUser });
});

// Always return the same response so people cannot discover which emails
// are registered. Works for every role — customers land back on the store,
// staff-tier accounts land on the admin login page.
router.post('/password-reset/request', async (req, res) => {
  const { email } = resetRequest.parse(req.body);
  const { rows } = await query(`SELECT id, email, role FROM users WHERE email = $1 AND is_active = true`, [email]);
  const user = rows[0];
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < NOW()', [user.id]);
    await query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`, [user.id, hash]);
    const isStaff = STAFF_ROLES.includes(user.role);
    const baseUrl = isStaff ? (process.env.ADMIN_APP_URL || process.env.ADMIN_ORIGIN || 'http://localhost:4001') : (process.env.STORE_ORIGIN || 'http://localhost:8080');
    const resetPage = isStaff ? 'login.html' : 'account.html';
    await sendPasswordReset({ to: user.email, resetUrl: `${baseUrl}/${resetPage}?reset=${token}` });
    await logAudit({ req, actor: user, action: 'auth.password_reset_requested', targetType: 'user', targetId: user.id });
  }
  res.status(202).json({ message: 'If an account exists for that email, a reset link has been sent.' });
});

router.post('/password-reset/confirm', async (req, res) => {
  const { token, password } = resetPassword.parse(req.body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const passwordHash = await bcrypt.hash(password, 12);
  const reset = await transaction(async (client) => {
    const { rows } = await client.query(`SELECT pr.id, pr.user_id, u.email FROM password_reset_tokens pr JOIN users u ON u.id = pr.user_id WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW() AND u.is_active = true FOR UPDATE OF pr`, [hash]);
    if (!rows[0]) return null;
    await client.query('UPDATE users SET password_hash = $1, failed_login_count = 0, locked_until = NULL, session_version = session_version + 1 WHERE id = $2', [passwordHash, rows[0].user_id]);
    await client.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [rows[0].user_id]);
    return rows[0];
  });
  if (!reset) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
  await logAudit({ req, actor: { id: reset.user_id, email: reset.email }, action: 'auth.password_reset_completed', targetType: 'user', targetId: reset.user_id });
  res.status(204).end();
});

router.post('/logout', async (req, res) => {
  const user = readSession(req);
  if (user) await logAudit({ req, actor: { id: user.sub, email: user.email }, action: 'auth.logout', targetType: 'user', targetId: user.sub });
  clearSession(res);
  res.status(204).end();
});
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, email, name, role, email_verified_at AS "emailVerifiedAt" FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
  if (!rows[0]) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user: rows[0] });
});

router.patch('/me', requireAuth, async (req, res) => {
  const name = z.string().min(2).max(100).parse(req.body?.name).trim();
  const { rows } = await query('UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name, role', [name, req.user.sub]);
  res.json({ user: rows[0] });
});

router.post('/verify-email/request', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, email, name, email_verified_at AS "emailVerifiedAt" FROM users WHERE id = $1', [req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  if (rows[0].emailVerifiedAt) return res.status(400).json({ error: 'Your email is already verified.' });
  await sendVerificationLink(rows[0]);
  res.status(202).json({ message: 'Verification email sent.' });
});

router.post('/verify-email/confirm', async (req, res) => {
  const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const { rows } = await query('SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW()', [hash]);
  if (!rows[0]) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
  await query('UPDATE users SET email_verified_at = NOW() WHERE id = $1', [rows[0].user_id]);
  await query('DELETE FROM email_verification_tokens WHERE user_id = $1', [rows[0].user_id]);
  res.status(204).end();
});

// Self-service password change for a logged-in user (distinct from the
// token-based reset flow above, which is for people who are locked out).
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }).parse(req.body);
  const { rows } = await query('SELECT id, email, password_hash FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(401).json({ error: 'Current password is incorrect.' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { rows: updated } = await query('UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING role, session_version AS "sessionVersion"', [passwordHash, user.id]);
  sessionCookie(res, signSession({ id: user.id, email: user.email, role: updated[0].role, sessionVersion: updated[0].sessionVersion }));
  await logAudit({ req, actor: user, action: 'auth.password_changed', targetType: 'user', targetId: user.id });
  res.status(204).end();
});

export default router;
