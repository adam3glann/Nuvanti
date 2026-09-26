import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query, transaction } from '../lib/db.js';
import { clearMfaChallengeCookie, clearSession, issueSession, readMfaChallenge, readSession, requireAuth, requireRole, setMfaChallengeCookie, setSessionCookie } from '../lib/auth.js';
import { sendPasswordReset, sendVerificationEmail } from '../lib/mail.js';
import { logAudit } from '../lib/audit.js';
import { adminPublicOrigin, storePublicOrigin } from '../lib/publicOrigins.js';
import { createOtpAuthUri, createRecoveryCodes, createTotpSecret, decryptTotpSecret, encryptTotpSecret, hashRecoveryCode, verifyTotp } from '../lib/totp.js';

const STAFF_ROLES = ['staff', 'manager', 'admin', 'super_admin'];
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

const router = Router();
// Express 4 does not forward rejected async route promises to error middleware.
// Wrap route handlers so DB/decryption failures become safe HTTP errors rather
// than unhandled rejections that can crash the Railway process.
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const credentials = z.object({ email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()), password: z.string().min(8).max(128) });
const registrationCredentials = z.object({ email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()), password: z.string().min(12).max(128) });
const resetRequest = z.object({ email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()) });
const resetPassword = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password: z.string().min(12).max(128) });

router.post('/register', asyncRoute(async (req, res) => {
  const { email, password } = registrationCredentials.parse(req.body);
  const name = z.string().trim().min(2).max(100).parse(req.body.name);
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await query('INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, session_version AS "sessionVersion"', [email, name, passwordHash, 'customer']);
    setSessionCookie(res, await issueSession(rows[0], req));
    await logAudit({ req, actor: rows[0], action: 'auth.register', targetType: 'user', targetId: rows[0].id });
    res.status(201).json({ user: rows[0] });
    sendVerificationLink(rows[0]).catch((error) => console.error('Verification email failed:', error));
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account already exists for this email.' });
    throw error;
  }
}));

async function sendVerificationLink(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await query('DELETE FROM email_verification_tokens WHERE user_id = $1 OR expires_at < NOW()', [user.id]);
  await query(`INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`, [user.id, hash]);
  const storeOrigin = storePublicOrigin();
  await sendVerificationEmail({ to: user.email, name: user.name, verifyUrl: `${storeOrigin}/account.html?verify=${token}` });
}

router.post('/login', asyncRoute(async (req, res) => {
  const { email, password } = credentials.parse(req.body);
  const { rows } = await query('SELECT id, email, name, role, password_hash, failed_login_count, locked_until, session_version AS "sessionVersion", totp_secret_enc AS "totpSecretEnc", totp_enabled_at AS "totpEnabledAt" FROM users WHERE email = $1 AND is_active = true', [email]);
  const user = rows[0];

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    await logAudit({ req, actor: user, action: 'auth.login_blocked', targetType: 'user', targetId: user.id, metadata: { reason: 'locked' } });
    return res.status(423).json({ error: 'Too many failed attempts. Try again in a few minutes.' });
  }

  const valid = user && (await bcrypt.compare(password, user.password_hash));
  if (!valid) {
    if (user) {
      const { rows: attempts } = await query(
        `UPDATE users SET failed_login_count = failed_login_count + 1,
          locked_until = CASE WHEN failed_login_count + 1 >= $1
            THEN NOW() + ($2::int * INTERVAL '1 minute') ELSE locked_until END
          WHERE id = $3 RETURNING failed_login_count`,
        [MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES, user.id],
      );
      const nextCount = Number(attempts[0]?.failed_login_count || MAX_FAILED_ATTEMPTS);
      const lock = nextCount >= MAX_FAILED_ATTEMPTS;
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
  clearSession(res);
  if (user.totpEnabledAt && user.totpSecretEnc) {
    setMfaChallengeCookie(res, user);
    await logAudit({ req, actor: safeUser, action: 'auth.mfa_challenge', targetType: 'user', targetId: safeUser.id });
    return res.json({ requiresTwoFactor: true });
  }
  setSessionCookie(res, await issueSession({ ...safeUser, sessionVersion: user.sessionVersion }, req));
  await logAudit({ req, actor: safeUser, action: 'auth.login_success', targetType: 'user', targetId: safeUser.id });
  res.json({ user: safeUser });
}));

const mfaCodeInput = z.object({ code: z.string().trim().min(6).max(32) });

router.post('/login/mfa', asyncRoute(async (req, res) => {
  const challenge = readMfaChallenge(req);
  const { code } = mfaCodeInput.parse(req.body);
  if (!challenge) {
    clearMfaChallengeCookie(res);
    return res.status(401).json({ error: 'Your sign-in challenge expired. Enter your password again.' });
  }
  const { rows } = await query(`SELECT id, email, name, role, session_version AS "sessionVersion", totp_secret_enc AS "totpSecretEnc", totp_last_step AS "totpLastStep", totp_recovery_codes AS "recoveryCodes"
    FROM users WHERE id = $1 AND is_active = true AND session_version = $2 AND totp_enabled_at IS NOT NULL`, [challenge.sub, challenge.ver]);
  const user = rows[0];
  if (!user) {
    clearMfaChallengeCookie(res);
    return res.status(401).json({ error: 'Your sign-in challenge expired. Enter your password again.' });
  }

  const step = verifyTotp(decryptTotpSecret(user.totpSecretEnc), code);
  let authenticated = false;
  if (step !== null) {
    const consumed = await query(`UPDATE users SET totp_last_step = $1 WHERE id = $2 AND totp_last_step < $1`, [step, user.id]);
    authenticated = consumed.rowCount === 1;
  } else {
    const recoveryHash = hashRecoveryCode(code);
    const index = recoveryHash ? (user.recoveryCodes || []).indexOf(recoveryHash) : -1;
    if (index >= 0) {
      const consumed = await query(`UPDATE users SET totp_recovery_codes = totp_recovery_codes - $1 WHERE id = $2 AND totp_recovery_codes @> $3::jsonb`, [index, user.id, JSON.stringify([recoveryHash])]);
      authenticated = consumed.rowCount === 1;
    }
  }
  if (!authenticated) return res.status(401).json({ error: 'That authenticator or recovery code is invalid or already used.' });

  const safeUser = { id: user.id, email: user.email, name: user.name, role: user.role, sessionVersion: user.sessionVersion };
  clearMfaChallengeCookie(res);
  setSessionCookie(res, await issueSession(safeUser, req));
  await logAudit({ req, actor: safeUser, action: 'auth.login_success_mfa', targetType: 'user', targetId: safeUser.id });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

// Always return the same response so people cannot discover which emails
// are registered. Works for every role — customers land back on the store,
// staff-tier accounts land on the admin login page.
router.post('/password-reset/request', asyncRoute(async (req, res) => {
  const { email } = resetRequest.parse(req.body);
  const { rows } = await query(`SELECT id, email, role FROM users WHERE email = $1 AND is_active = true`, [email]);
  const user = rows[0];
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < NOW()', [user.id]);
    await query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`, [user.id, hash]);
    const isStaff = STAFF_ROLES.includes(user.role);
    const baseUrl = isStaff ? adminPublicOrigin() : storePublicOrigin();
    const resetPage = isStaff ? 'login.html' : 'account.html';
    try {
      await sendPasswordReset({ to: user.email, resetUrl: `${baseUrl}/${resetPage}?reset=${token}` });
    } catch (error) {
      console.error('Password reset email failed:', error);
    }
    await logAudit({ req, actor: user, action: 'auth.password_reset_requested', targetType: 'user', targetId: user.id });
  }
  res.status(202).json({ message: 'If an account exists for that email, a reset link has been sent.' });
}));

router.post('/password-reset/confirm', asyncRoute(async (req, res) => {
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
}));

router.post('/logout', asyncRoute(async (req, res) => {
  const user = readSession(req);
  if (user) {
    await query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL', [user.jti, user.sub]);
    await logAudit({ req, actor: { id: user.sub, email: user.email }, action: 'auth.logout', targetType: 'user', targetId: user.sub });
  }
  clearSession(res);
  res.status(204).end();
}));

const requireStaff = requireRole(...STAFF_ROLES);

router.get('/sessions', requireAuth, requireStaff, asyncRoute(async (req, res) => {
  const { rows } = await query(`SELECT id, user_agent AS "userAgent", created_at AS "createdAt", last_seen_at AS "lastSeenAt", expires_at AS "expiresAt"
    FROM auth_sessions WHERE user_id = $1 AND session_version = (SELECT session_version FROM users WHERE id = $1)
      AND revoked_at IS NULL AND expires_at > NOW() ORDER BY last_seen_at DESC`, [req.user.sub]);
  res.json(rows.map((session) => ({ ...session, isCurrent: session.id === req.user.jti })));
}));

router.delete('/sessions/:id', requireAuth, requireStaff, asyncRoute(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { rows } = await query(`UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`, [id, req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error: 'Session not found or already revoked.' });
  const isCurrent = id === req.user.jti;
  if (isCurrent) clearSession(res);
  await logAudit({ req, actor: req.user, action: isCurrent ? 'auth.session_revoked_current' : 'auth.session_revoked', targetType: 'session', targetId: id });
  res.status(204).end();
}));

router.post('/sessions/revoke-others', requireAuth, requireStaff, asyncRoute(async (req, res) => {
  const { rowCount } = await query(`UPDATE auth_sessions SET revoked_at = NOW() WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL AND expires_at > NOW()`, [req.user.sub, req.user.jti]);
  await logAudit({ req, actor: req.user, action: 'auth.sessions_revoked_others', targetType: 'user', targetId: req.user.sub, metadata: { count: rowCount } });
  res.json({ revoked: rowCount });
}));

router.post('/mfa/setup', requireAuth, requireStaff, asyncRoute(async (req, res) => {
  const { currentPassword } = z.object({ currentPassword: z.string().min(1).max(128) }).parse(req.body);
  const { rows } = await query('SELECT id, email, password_hash, totp_enabled_at AS "totpEnabledAt" FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(401).json({ error: 'Current password is incorrect.' });
  if (user.totpEnabledAt) return res.status(409).json({ error: 'Two-factor authentication is already enabled.' });
  const secret = createTotpSecret();
  let encryptedSecret;
  try { encryptedSecret = encryptTotpSecret(secret); }
  catch (error) { return res.status(error.status || 500).json({ error: error.message }); }
  await query(`UPDATE users SET totp_pending_secret_enc = $1, totp_pending_expires_at = NOW() + INTERVAL '10 minutes' WHERE id = $2`, [encryptedSecret, user.id]);
  res.json({ secret, otpauthUri: createOtpAuthUri(secret, user.email), expiresInSeconds: 600 });
}));

router.get('/mfa/status', requireAuth, requireStaff, asyncRoute(async (req, res) => {
  const { rows } = await query(`SELECT totp_enabled_at IS NOT NULL AS enabled, jsonb_array_length(totp_recovery_codes) AS "recoveryCodesRemaining"
    FROM users WHERE id = $1`, [req.user.sub]);
  res.json(rows[0] || { enabled: false, recoveryCodesRemaining: 0 });
}));

router.post('/mfa/enable', requireAuth, requireStaff, asyncRoute(async (req, res) => {
  const { code } = z.object({ code: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const { rows } = await query(`SELECT id, email, role, session_version AS "sessionVersion", totp_pending_secret_enc AS "pendingSecret", totp_last_step AS "lastStep"
    FROM users WHERE id = $1 AND is_active = true AND totp_enabled_at IS NULL AND totp_pending_expires_at > NOW()`, [req.user.sub]);
  const user = rows[0];
  if (!user?.pendingSecret) return res.status(400).json({ error: 'Start authenticator setup again; the setup code expired.' });
  const step = verifyTotp(decryptTotpSecret(user.pendingSecret), code);
  if (step === null || step <= Number(user.lastStep)) return res.status(400).json({ error: 'The code is invalid or already used. Enter the current code from your authenticator app.' });
  const { codes, hashes } = createRecoveryCodes();
  const updated = await query(`UPDATE users SET totp_secret_enc = totp_pending_secret_enc, totp_pending_secret_enc = NULL, totp_pending_expires_at = NULL,
    totp_enabled_at = NOW(), totp_last_step = $1, totp_recovery_codes = $2::jsonb, session_version = session_version + 1
    WHERE id = $3 AND totp_enabled_at IS NULL AND totp_pending_expires_at > NOW() AND totp_last_step < $1 RETURNING session_version AS "sessionVersion"`, [step, JSON.stringify(hashes), user.id]);
  if (!updated.rows[0]) return res.status(409).json({ error: 'Authenticator setup expired. Start again.' });
  const currentUser = { id: user.id, email: user.email, role: user.role, sessionVersion: updated.rows[0].sessionVersion };
  setSessionCookie(res, await issueSession(currentUser, req));
  await logAudit({ req, actor: currentUser, action: 'auth.mfa_enabled', targetType: 'user', targetId: user.id });
  res.json({ recoveryCodes: codes });
}));

router.post('/mfa/disable', requireAuth, requireStaff, asyncRoute(async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1).max(128), code: z.string().regex(/^\d{6}$/) }).parse(req.body);
  const { rows } = await query(`SELECT id, email, role, password_hash, session_version AS "sessionVersion", totp_secret_enc AS "totpSecret", totp_last_step AS "lastStep", totp_enabled_at AS "totpEnabledAt"
    FROM users WHERE id = $1 AND is_active = true`, [req.user.sub]);
  const user = rows[0];
  if (!user?.totpEnabledAt || !(await bcrypt.compare(input.currentPassword, user.password_hash))) return res.status(401).json({ error: 'Current password is incorrect or two-factor authentication is not enabled.' });
  const step = verifyTotp(decryptTotpSecret(user.totpSecret), input.code);
  if (step === null || step <= Number(user.lastStep)) return res.status(401).json({ error: 'Authenticator code is invalid or already used.' });
  const { rows: updated } = await query(`UPDATE users SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_recovery_codes = '[]'::jsonb,
    totp_pending_secret_enc = NULL, totp_pending_expires_at = NULL, totp_last_step = $2, session_version = session_version + 1
    WHERE id = $1 AND totp_last_step < $2 RETURNING session_version AS "sessionVersion"`, [user.id, step]);
  if (!updated[0]) return res.status(401).json({ error: 'Authenticator code is invalid or already used.' });
  const currentUser = { id: user.id, email: user.email, role: user.role, sessionVersion: updated[0].sessionVersion };
  setSessionCookie(res, await issueSession(currentUser, req));
  await logAudit({ req, actor: currentUser, action: 'auth.mfa_disabled', targetType: 'user', targetId: user.id });
  res.status(204).end();
}));
router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await query('SELECT id, email, name, role, email_verified_at AS "emailVerifiedAt" FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
  if (!rows[0]) return res.status(401).json({ error: 'Authentication required.' });
  res.json({ user: rows[0] });
}));

router.patch('/me', requireAuth, asyncRoute(async (req, res) => {
  const name = z.string().min(2).max(100).parse(req.body?.name).trim();
  const { rows } = await query('UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name, role', [name, req.user.sub]);
  res.json({ user: rows[0] });
}));

router.post('/verify-email/request', requireAuth, asyncRoute(async (req, res) => {
  const { rows } = await query('SELECT id, email, name, email_verified_at AS "emailVerifiedAt" FROM users WHERE id = $1', [req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error: 'Account not found.' });
  if (rows[0].emailVerifiedAt) return res.status(400).json({ error: 'Your email is already verified.' });
  try {
    await sendVerificationLink(rows[0]);
  } catch (error) {
    console.error('Verification email resend failed:', error);
    return res.status(502).json({ error: 'The verification email could not be sent. Check the mail provider settings in Railway and try again.' });
  }
  res.status(202).json({ message: 'Verification email sent.' });
}));

router.post('/verify-email/confirm', asyncRoute(async (req, res) => {
  const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(req.body);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const userId = await transaction(async (client) => {
    const { rows } = await client.query('SELECT user_id FROM email_verification_tokens WHERE token_hash = $1 AND expires_at > NOW() FOR UPDATE', [hash]);
    if (!rows[0]) return null;
    await client.query('UPDATE users SET email_verified_at = coalesce(email_verified_at, NOW()) WHERE id = $1', [rows[0].user_id]);
    await client.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [rows[0].user_id]);
    return rows[0].user_id;
  });
  if (!userId) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
  res.status(204).end();
}));

// Self-service password change for a logged-in user (distinct from the
// token-based reset flow above, which is for people who are locked out).
router.post('/change-password', requireAuth, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }).parse(req.body);
  const { rows } = await query('SELECT id, email, password_hash FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) return res.status(401).json({ error: 'Current password is incorrect.' });
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { rows: updated } = await query('UPDATE users SET password_hash = $1, session_version = session_version + 1 WHERE id = $2 RETURNING role, session_version AS "sessionVersion"', [passwordHash, user.id]);
  const currentUser = { id: user.id, email: user.email, role: updated[0].role, sessionVersion: updated[0].sessionVersion };
  setSessionCookie(res, await issueSession(currentUser, req));
  await logAudit({ req, actor: user, action: 'auth.password_changed', targetType: 'user', targetId: user.id });
  res.status(204).end();
}));

export default router;
