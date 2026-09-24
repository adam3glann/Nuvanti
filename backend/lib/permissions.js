// Server-side mirror of frontend/admin/assets/js/components/permissions.js.
// That file is explicit that it is UI-only and the backend must
// independently re-check every permission — this is that check. Keep the
// two matrices in sync if either changes.

export const ROLES = ['super_admin', 'admin', 'manager', 'staff'];

const MATRIX = {
  'products.view': [1, 1, 1, 1],
  'products.create': [1, 1, 1, 0],
  'products.edit': [1, 1, 1, 0],
  'products.delete': [1, 1, 0, 0],
  'orders.view': [1, 1, 1, 1],
  'orders.edit': [1, 1, 1, 1],
  'orders.cancel': [1, 1, 1, 0],
  'orders.refund': [1, 1, 0, 0],
  'customers.view': [1, 1, 1, 1],
  'customers.edit': [1, 1, 0, 0],
  'customers.disable': [1, 1, 0, 0],
  'inventory.view': [1, 1, 1, 1],
  'inventory.adjust': [1, 1, 1, 0],
  'inventory.export': [1, 1, 1, 0],
  'discounts.manage': [1, 1, 0, 0],
  'content.manage': [1, 1, 0, 0],
  'analytics.view': [1, 1, 1, 0],
  'admins.view': [1, 0, 0, 0],
  'admins.manage': [1, 0, 0, 0],
  'settings.view': [1, 1, 0, 0],
  'settings.edit': [1, 0, 0, 0],
  'audit.view': [1, 1, 0, 0],
  'security.view': [1, 1, 0, 0],
};

export function hasPermission(role, key) {
  const idx = ROLES.indexOf(role);
  if (idx === -1 || !MATRIX[key]) return false;
  return !!MATRIX[key][idx];
}

// Express middleware. Must run after requireAuth (needs req.user.role).
export function requirePermission(key) {
  return (req, res, next) => {
    if (!req.user || !hasPermission(req.user.role, key)) {
      return res.status(403).json({ error: 'You do not have permission for this action.' });
    }
    next();
  };
}
