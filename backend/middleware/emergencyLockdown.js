import { query } from '../lib/db.js';

export async function isEmergencyLockdownActive() {
  const { rows } = await query('SELECT is_active FROM emergency_lockdown WHERE id = 1');
  return rows[0]?.is_active === true;
}

export async function requireEmergencyLockdownInactive(req, res, next) {
  try {
    if (await isEmergencyLockdownActive()) {
      res.set('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'The store is temporarily locked down. Contact the store owner.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireCheckoutAvailable(req, res, next) {
  try {
    if (await isEmergencyLockdownActive()) {
      res.set('Cache-Control', 'no-store');
      return res.status(503).json({ error: 'Checkout is temporarily paused for a security review.' });
    }
    next();
  } catch (error) {
    next(error);
  }
}
