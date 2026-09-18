const API = window.NUVANTI_API_URL || `${location.protocol}//${location.hostname}:4000`;
async function request(path) {
  const response = await fetch(`${API}${path}`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load audit logs.');
  return body;
}

// Human-readable label for each machine-readable action key the backend logs.
const ACTION_LABELS = {
  'auth.register': 'created an account',
  'auth.login_success': 'signed in',
  'auth.login_failed': 'failed sign-in attempt',
  'auth.login_blocked': 'blocked sign-in (account locked)',
  'auth.account_locked': 'account locked after failed attempts',
  'auth.logout': 'signed out',
  'auth.password_reset_requested': 'requested a password reset',
  'auth.password_reset_completed': 'completed a password reset',
  'auth.password_changed': 'changed their password',
  'admin_user.created': 'created administrator',
  'admin_user.enabled': 'enabled administrator',
  'admin_user.disabled': 'disabled administrator',
  'admin_user.deleted': 'deleted administrator',
  'product.deleted': 'deleted product',
  'category.created': 'created category',
  'category.deleted': 'deleted category',
  'collection.created': 'created collection',
  'collection.deleted': 'deleted collection',
  'order.status_changed': 'updated order status',
};

function describeResource(row) {
  const m = row.metadata || {};
  switch (row.action) {
    case 'admin_user.created':
      return `${m.email || ''} (${m.role || ''})`.trim();
    case 'category.created':
    case 'collection.created':
      return m.name ? `${m.name} (${m.slug || ''})` : `#${row.targetId || ''}`;
    case 'order.status_changed':
      return `Order #${row.targetId || ''} → ${m.status || ''}`;
    case 'auth.login_failed':
    case 'auth.login_blocked':
      return m.email || '—';
    default:
      return row.targetId ? `${row.targetType || ''} #${row.targetId}`.trim() : '—';
  }
}

function normalize(row) {
  return {
    id: row.id,
    user: row.actorName || row.actorEmail || 'Unknown',
    role: row.actorRole || 'unknown',
    action: ACTION_LABELS[row.action] || row.action,
    resource: describeResource(row),
    timestamp: row.createdAt,
    ip: row.ip || '—',
  };
}

let cache = null;
async function loadAll() {
  if (!cache) cache = (await request('/api/admin/audit-logs')).map(normalize);
  return cache;
}

export async function fetchAuditLogs({ query, user, page = 1, perPage = 15 } = {}) {
  let list = await loadAll();
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((l) => l.action.toLowerCase().includes(q) || l.resource.toLowerCase().includes(q) || l.user.toLowerCase().includes(q));
  }
  if (user) list = list.filter((l) => l.user === user);
  const total = list.length;
  const start = (page - 1) * perPage;
  return { items: list.slice(start, start + perPage), total, page, perPage };
}

export async function uniqueUsers() {
  return [...new Set((await loadAll()).map((l) => l.user))];
}
