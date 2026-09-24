import jwt from 'jsonwebtoken';
import { query } from './db.js';

const cookieName = 'nuvanti_session';
const cookieSameSite = process.env.NODE_ENV === 'production' ? 'none' : 'lax';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  return value;
}

export function signSession(user) {
  return jwt.sign({ sub: String(user.id), role: user.role, email: user.email, ver: user.sessionVersion ?? 0 }, secret(), { expiresIn: '8h', issuer: 'nuvanti-api', audience: 'nuvanti-web' });
}

export function readSession(req) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;
  try { return jwt.verify(token, secret(), { issuer: 'nuvanti-api', audience: 'nuvanti-web' }); }
  catch { return null; }
}

export function sessionCookie(res, token) {
  res.cookie(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: cookieSameSite, maxAge: 8 * 60 * 60 * 1000, path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) });
}

export function clearSession(res) {
  res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: cookieSameSite, path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) });
}

export async function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const { rows } = await query('SELECT id, email, role, session_version AS "sessionVersion" FROM users WHERE id = $1 AND is_active = true', [session.sub]);
    const user = rows[0];
    if (!user || Number(session.ver || 0) !== user.sessionVersion) return res.status(401).json({ error: 'Authentication required.' });
    req.user = { ...session, sub: String(user.id), email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdminPage(req, res, next) {
  const session = readSession(req);
  if (!session) return res.redirect('/login.html');
  try {
    const { rows } = await query('SELECT id, email, role, session_version AS "sessionVersion" FROM users WHERE id = $1 AND is_active = true', [session.sub]);
    const user = rows[0];
    if (!user || Number(session.ver || 0) !== user.sessionVersion) return res.redirect('/login.html');
    req.user = { ...session, sub: String(user.id), email: user.email, role: user.role };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  };
}
