import { query } from "../lib/db.js";

export async function isEmergencyLockdownActive() {
  const { rows } = await query(
    "SELECT is_active FROM emergency_lockdown WHERE id = 1",
  );
  return rows[0]?.is_active === true;
}

export async function requireEmergencyLockdownInactive(req, res, next) {
  try {
    if (await isEmergencyLockdownActive()) {
      // Keep a recovery path for an already-authenticated super administrator.
      // The downstream API route still enforces session, role, and MFA checks;
      // the protected Security page is the only admin document/assets exposed
      // while locked down so the owner can reach that control.
      const emergencyControl =
        req.method === "POST" && req.path === "/maintenance/emergency";
      const securityRecoveryPage =
        req.method === "GET" &&
        (req.path === "/security.html" || req.path.startsWith("/assets/"));
      if (emergencyControl || securityRecoveryPage) return next();
      res.set("Cache-Control", "no-store");
      return res.status(503).json({
        error: "The store is temporarily locked down. Contact the store owner.",
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireCheckoutAvailable(req, res, next) {
  try {
    if (await isEmergencyLockdownActive()) {
      res.set("Cache-Control", "no-store");
      return res.status(503).json({
        error: "Checkout is temporarily paused for a security review.",
      });
    }
    next();
  } catch (error) {
    next(error);
  }
}
