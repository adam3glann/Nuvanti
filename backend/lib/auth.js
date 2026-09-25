import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const cookieName = 'nuvanti_session';
const challengeCookieName = 'nuvanti_mfa_challenge';
const cookieSameSite = process.env.NODE_ENV === 'production' ? 'none' : 'lax';
const staffRoles = ['staff', 'manager', 'admin', 'super_admin'];

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  return value;
}

export async function issueSession(user, req) {
  const id = crypto.randomUUID();
  const sessionVersion = Number(user.sessionVersion ?? 0);
  // Keep the session table bounded without deleting recent audit context.
  await query(`DELETE FROM auth_sessions WHERE expires_at < NOW() - INTERVAL '7 days'
    OR revoked_at < NOW() - INTERVAL '7 days'`);
  await query(
    `INSERT INTO auth_sessions (id, user_id, session_version, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '8 hours')`,
    [id, user.id, sessionVersion, String(req.get('user-agent') || '').slice(0, 500)],
  );
  const token = jwt.sign(
    { sub: String(user.id), role: user.role, email: user.email, ver: sessionVersion, jti: id },
    secret(),
    { expiresIn: '8h', issuer: 'nuvanti-api', audience: 'nuvanti-web' },
  );
  return token;
}

export function readSession(req) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;
  try {
    const session = jwt.verify(token, secret(), { issuer: 'nuvanti-api', audience: 'nuvanti-web' });
    return typeof session.jti === 'string' ? session : null;
  } catch { return null; }
}

export function setSessionCookie(res, token) {
  res.cookie(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: cookieSameSite, maxAge: 8 * 60 * 60 * 1000, path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) });
}

export function setMfaChallengeCookie(res, user) {
  const token = jwt.sign(
    { sub: String(user.id), ver: Number(user.sessionVersion ?? 0), purpose: 'mfa' },
    secret(),
    { expiresIn: '5m', issuer: 'nuvanti-api', audience: 'nuvanti-mfa' },
  );
  res.cookie(challengeCookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: cookieSameSite, maxAge: 5 * 60 * 1000, path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) });
}

export function clearMfaChallengeCookie(res) {
  res.clearCookie(challengeCookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: cookieSameSite, path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) });
}

export function readMfaChallenge(req) {
  try {
    const token = req.cookies?.[challengeCookieName];
    if (!token) return null;
    const challenge = jwt.verify(token, secret(), { issuer: 'nuvanti-api', audience: 'nuvanti-mfa' });
    return challenge.purpose === 'mfa' ? challenge : null;
  } catch { return null; }
}

export function clearSession(res) {
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: cookieSameSite, path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) };
  res.clearCookie(cookieName, options);
  res.clearCookie(challengeCookieName, options);
}

async function resolveSession(session) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.role, u.session_version AS "sessionVersion", s.id AS "sessionId"
     FROM auth_sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > NOW()
       AND s.session_version = u.session_version AND u.is_active = true`,
    [session.jti, session.sub],
  );
  return rows[0] || null;
}

async function updateLastSeen(sessionId) {
  await query(`UPDATE auth_sessions SET last_seen_at = NOW() WHERE id = $1 AND last_seen_at < NOW() - INTERVAL '5 minutes'`, [sessionId]);
}

export async function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const user = await resolveSession(session);
    if (!user) return res.status(401).json({ error: 'Authentication required.' });
    await updateLastSeen(user.sessionId);
    req.user = { ...session, sub: String(user.id), email: user.email, role: user.role };
    next();
  } catch (error) { next(error); }
}

export async function requireVerifiedEmail(req, res, next) {
  try {
    const { rows } = await query('SELECT email_verified_at FROM users WHERE id = $1 AND is_active = true', [req.user.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'Authentication required.' });
    if (!rows[0].email_verified_at) return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', error: 'Confirm your email before placing an order.' });
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdminPage(req, res, next) {
  const session = readSession(req);
  if (!session) return res.redirect('/login.html');
  try {
    const user = await resolveSession(session);
    if (!user || !staffRoles.includes(user.role)) return res.redirect('/login.html');
    await updateLastSeen(user.sessionId);
    req.user = { ...session, sub: String(user.id), email: user.email, role: user.role };
    next();
  } catch (error) { next(error); }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  };
}
