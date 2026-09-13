// permissions.js — role → permission map used only to shape the UI
// (hide/disable controls a role shouldn't see). This is NOT a security
// boundary: the future Node backend must independently re-check every
// one of these on every request, regardless of what the frontend sends.

export const ROLES = ['super_admin', 'admin', 'manager', 'staff'];

export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
};

// permission key: [super_admin, admin, manager, staff]
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

export function permissionMatrix() {
  return MATRIX;
}

export function permissionGroups() {
  return {
    Products: ['products.view', 'products.create', 'products.edit', 'products.delete'],
    Orders: ['orders.view', 'orders.edit', 'orders.cancel', 'orders.refund'],
    Customers: ['customers.view', 'customers.edit', 'customers.disable'],
    Inventory: ['inventory.view', 'inventory.adjust', 'inventory.export'],
    Marketing: ['discounts.manage', 'content.manage'],
    Analytics: ['analytics.view'],
    Administrators: ['admins.view', 'admins.manage'],
    Settings: ['settings.view', 'settings.edit'],
    Security: ['audit.view', 'security.view'],
  };
}
