import { API_ORIGIN as API } from '../config.js';

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: 'include', ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load customers.');
  return body;
}

export async function fetchAdminCustomers({ query, status, page = 1, perPage = 50, sort = 'recent' } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const params = new URLSearchParams({
    search: query || '', status: status || '', page: String(page),
    perPage: String(perPage), sort: sort || 'recent',
  });
  let result;
  try { result = await request(`/api/admin/customers?${params}`, { signal: controller.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw new Error('Loading customers took too long. Please try again.');
    throw error;
  } finally { clearTimeout(timeout); }
  const items = (Array.isArray(result.items) ? result.items : []).map((row) => ({
    ...row,
    status: row.isGuest ? 'guest' : (row.isActive ? 'active' : 'disabled'),
    totalSpent: Number(row.totalSpentCents || 0) / 100,
    lastOrder: row.lastOrder || null,
  }));
  return { items, total: Number(result.total) || 0, page: result.page, perPage: result.perPage };
}

export async function fetchAdminCustomer(id) {
  try {
    const row = await request(`/api/admin/customers/${encodeURIComponent(id)}`);
    const paidOrders = row.orders.filter((order) => order.status !== 'cancelled' && order.paymentStatus === 'paid');
    const totalCents = paidOrders.reduce((sum, order) => sum + Number(order.totalCents), 0);
    return { ...row, status: row.isActive ? 'active' : 'disabled', orders: row.orders, addresses: row.addresses, orderCount: row.orders.filter((order) => order.status !== 'cancelled').length, totalSpent: totalCents / 100 };
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
