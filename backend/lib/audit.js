import { query } from './db.js';

// Records a security-relevant event. Never throws — a logging failure must
// never break the request that triggered it — but always reports the
// failure to the server console so it isn't silently lost.
export async function logAudit({ req, actor, action, targetType, targetId, metadata }) {
  const actorUserId = actor?.id ?? req?.user?.sub ?? null;
  const actorEmail = actor?.email ?? req?.user?.email ?? null;
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
  try {
    await query(
      'INSERT INTO audit_logs (actor_user_id, actor_email, action, target_type, target_id, metadata, ip) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)',
      [actorUserId, actorEmail, action, targetType || null, targetId != null ? String(targetId) : null, JSON.stringify(metadata || {}), ip],
    );
  } catch (error) {
    console.error('Failed to write audit log:', action, error);
  }
}
