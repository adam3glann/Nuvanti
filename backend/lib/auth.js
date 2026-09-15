import jwt from 'jsonwebtoken';

const cookieName = 'nuvanti_session';

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  return value;
}

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, secret(), { expiresIn: '8h', issuer: 'nuvanti-api', audience: 'nuvanti-web' });
}

export function readSession(req) {
  const token = req.cookies?.[cookieName];
  if (!token) return null;
  try { return jwt.verify(token, secret(), { issuer: 'nuvanti-api', audience: 'nuvanti-web' }); }
  catch { return null; }
}

export function sessionCookie(res, token) {
  res.cookie(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000, path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) });
}

export function clearSession(res) {
  res.clearCookie(cookieName, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}) });
}

export function requireAuth(req, res, next) {
  const user = readSession(req);
  if (!user) return res.status(401).json({ error: 'Authentication required.' });
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission for this action.' });
    next();
  };
}
