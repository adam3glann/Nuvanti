import crypto from 'crypto';
import { query } from './db.js';

const IP_FAILURE_LIMIT = 3;

function fingerprintIp(ip) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  return crypto.createHmac('sha256', secret).update(`nuvanti-admin-login-ip:${ip}`).digest('hex');
}

function requestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').trim();
}

export async function adminIpBlockStatus(req) {
  const ip = requestIp(req);
  if (!ip) return null;
  const { rows } = await query('SELECT blocked_until AS "blockedUntil" FROM admin_login_ip_blocks WHERE ip_hash = $1 AND blocked_until > NOW()', [fingerprintIp(ip)]);
  return rows[0]?.blockedUntil || null;
}

export async function rejectBlockedAdminIp(req, res) {
  const blockedUntil = await adminIpBlockStatus(req);
  if (!blockedUntil) return false;
  const seconds = Math.max(1, Math.ceil((new Date(blockedUntil).getTime() - Date.now()) / 1000));
  res.set('Retry-After', String(seconds)).status(423).json({ error: 'Sign-in from this network is temporarily blocked after repeated incorrect admin codes. Try again after the lockout expires.' });
  return true;
}

export async function recordAdminEmailCodeFailure(req) {
  const ip = requestIp(req);
  if (!ip) return { failedAttempts: IP_FAILURE_LIMIT, blockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) };
  const ipHash = fingerprintIp(ip);
  const { rows } = await query(`
    INSERT INTO admin_login_ip_blocks (ip_hash, failed_attempts, window_started_at, blocked_until, updated_at)
    VALUES ($1, 1, NOW(), NULL, NOW())
    ON CONFLICT (ip_hash) DO UPDATE SET
      failed_attempts = CASE
        WHEN admin_login_ip_blocks.window_started_at <= NOW() - INTERVAL '30 minutes' THEN 1
        ELSE LEAST(admin_login_ip_blocks.failed_attempts + 1, $2)
      END,
      window_started_at = CASE
        WHEN admin_login_ip_blocks.window_started_at <= NOW() - INTERVAL '30 minutes' THEN NOW()
        ELSE admin_login_ip_blocks.window_started_at
      END,
      blocked_until = CASE
        WHEN (CASE WHEN admin_login_ip_blocks.window_started_at <= NOW() - INTERVAL '30 minutes' THEN 1 ELSE admin_login_ip_blocks.failed_attempts + 1 END) >= $2
          THEN NOW() + INTERVAL '24 hours'
        WHEN admin_login_ip_blocks.blocked_until > NOW() THEN admin_login_ip_blocks.blocked_until
        ELSE NULL
      END,
      updated_at = NOW()
    RETURNING failed_attempts AS "failedAttempts", blocked_until AS "blockedUntil"`, [ipHash, IP_FAILURE_LIMIT]);
  return rows[0];
}

export async function clearAdminEmailCodeFailures(req) {
  const ip = requestIp(req);
  if (ip) await query('DELETE FROM admin_login_ip_blocks WHERE ip_hash = $1', [fingerprintIp(ip)]);
}

export function requireUnblockedAdminIp(req, res, next) {
  rejectBlockedAdminIp(req, res).then((blocked) => { if (!blocked) next(); }).catch(next);
}

export function hashAdminEmailCode(challengeId, code) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');
  return crypto.createHmac('sha256', secret).update(`nuvanti-admin-email-code:${challengeId}:${code}`).digest('hex');
}

export function safeHashEquals(left, right) {
  const a = Buffer.from(String(left || ''), 'hex');
  const b = Buffer.from(String(right || ''), 'hex');
  return a.length === 32 && b.length === 32 && crypto.timingSafeEqual(a, b);
}
