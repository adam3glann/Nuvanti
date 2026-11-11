import { API_ORIGIN as API } from '../config.js';

async function requestOrders(path = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`${API}/api/admin/orders${path}`, { credentials: 'include', signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Loading orders took too long. Please try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Unable to load orders.');
    error.status = response.status;
    throw error;
  }
  return body;
}

async function all(limit) {
  const suffix = limit ? `?limit=${encodeURIComponent(limit)}` : '';
  return requestOrders(suffix);
}

function databaseId(id) {
  return String(id ?? '').replace(/^NV-/i, '');
}

export async function fetchRecentAdminOrders(limit = 6) {
  return all(limit);
}

export async function fetchAdminOrders({ query = '', status = '', payment = '', page = 1, perPage = 10, sort = 'newest' } = {}) {
  const params = new URLSearchParams({ search: query, status, payment, page: String(page), perPage: String(perPage), sort });
  const result = await requestOrders(`?${params}`);
  if (!Array.isArray(result)) {
    if (!Array.isArray(result?.items)) throw new Error('The orders service returned an invalid response. Please retry.');
    return result;
  }

  // Keep the UI usable during a rolling deploy where the API instance may
  // still serve the previous unpaginated response shape.
  const needle = String(query).trim().toLowerCase();
  let items = result.filter((order) => {
    const matchesSearch = !needle || [order.id, order.customer?.name, order.customer?.email]
      .some((value) => String(value || '').toLowerCase().includes(needle));
    const matchesStatus = !status || order.status === status;
    const matchesPayment = !payment || order.paymentStatus === payment;
    return matchesSearch && matchesStatus && matchesPayment;
  });
  const sorters = {
    newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
    'total-desc': (a, b) => b.total - a.total,
    'total-asc': (a, b) => a.total - b.total,
  };
  items.sort(sorters[sort] || sorters.newest);
  const total = items.length;
  if (perPage !== 'all') items = items.slice((page - 1) * perPage, page * perPage);
  return { items, total, page, perPage };
}

export async function fetchAdminOrder(id) {
  const order = await requestOrders(`/${encodeURIComponent(databaseId(id))}`);
  return order?.dbId ? order : null;
}

export async function updateOrderStatus(id, status) {
  const order = await fetchAdminOrder(id);
  if (!order) return null;
  const response = await fetch(`${API}/api/admin/orders/${encodeURIComponent(order.dbId)}`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to update order.');
  return { ...order, status: body.status };
}

export async function cancelOrder(id) {
  return updateOrderStatus(id, 'cancelled');
}

export async function markInstaPayPaid(id) {
  const order = await fetchAdminOrder(id);
  if (!order) throw new Error('Order not found.');
  const response = await fetch(`${API}/api/admin/orders/${encodeURIComponent(order.dbId)}/payment`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentStatus: 'paid' }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to verify transfer.');
  return { ...order, status: body.status, paymentStatus: body.paymentStatus };
}

export async function orderStats() {
  const list = await all();
  return { total: list.length, pending: list.filter((o) => o.status === 'pending').length, fulfilled: list.filter((o) => o.status === 'fulfilled').length, cancelled: list.filter((o) => o.status === 'cancelled').length };
}

export async function revenueStats() {
  const list = await all();
  const sum = (filter) => list.filter((o) => ['paid', 'fulfilled'].includes(o.status) && filter(o)).reduce((total, o) => total + o.total, 0);
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const month = new Date(now.getFullYear(), now.getMonth(), 1);
  return { today: sum((o) => new Date(o.createdAt) >= day), week: sum((o) => new Date(o.createdAt) >= new Date(day.getTime() - 7 * 86400000)), month: sum((o) => new Date(o.createdAt) >= month), year: sum((o) => new Date(o.createdAt).getFullYear() === now.getFullYear()) };
}
