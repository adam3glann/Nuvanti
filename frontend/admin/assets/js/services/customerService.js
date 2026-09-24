import { API_ORIGIN as API } from '../config.js';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: 'include', ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load customers.');
  return body;
}

export async function fetchAdminCustomers({ query, status, page = 1, perPage = 10, sort = 'recent' } = {}) {
  const rows = await request('/api/admin/customers');
  let items = rows.map((row) => ({
    ...row,
    status: row.isActive ? 'active' : 'disabled',
    totalSpent: Number(row.totalSpentCents || 0) / 100,
    lastOrder: row.lastOrder || null,
  }));
  if (query) {
    const q = query.toLowerCase();
    items = items.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }
  if (status) items = items.filter((c) => c.status === status);
  if (sort === 'spent-desc') items.sort((a, b) => b.totalSpent - a.totalSpent);
  if (sort === 'orders-desc') items.sort((a, b) => b.orderCount - a.orderCount);
  if (sort === 'recent') items.sort((a, b) => new Date(b.lastOrder || b.createdAt) - new Date(a.lastOrder || a.createdAt));
  const total = items.length;
  return { items: items.slice((page - 1) * perPage, page * perPage), total, page, perPage };
}

export async function fetchAdminCustomer(id) {
  try {
    const row = await request(`/api/admin/customers/${encodeURIComponent(id)}`);
    const totalCents = row.orders.reduce((sum, order) => sum + (order.status === 'cancelled' ? 0 : Number(order.totalCents)), 0);
    return { ...row, status: row.isActive ? 'active' : 'disabled', orders: row.orders, addresses: row.addresses, orderCount: row.orders.length, totalSpent: totalCents / 100 };
  } catch (error) {
    if (/not found/i.test(error.message)) return null;
    throw error;
  }
}

export async function toggleCustomerStatus(id) {
  const current = await fetchAdminCustomer(id);
  if (!current) throw new Error('Customer not found.');
  const body = await request(`/api/admin/customers/${encodeURIComponent(id)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive: current.status !== 'active' }),
  });
  return { ...current, isActive: body.isActive, status: body.isActive ? 'active' : 'disabled' };
}

export async function customerStats() {
  const rows = await request('/api/admin/customers');
  return {
    total: rows.length,
    newThisMonth: rows.filter((c) => new Date(c.createdAt) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length,
    returning: rows.filter((c) => c.orderCount > 1).length,
  };
}
