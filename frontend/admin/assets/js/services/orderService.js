import { orders as sourceOrders, getOrderById as _byId } from '../data/orders.js';

let store = [...sourceOrders];
function tick(ms = 150) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchAdminOrders({ query, status, payment, page = 1, perPage = 10, sort = 'newest' } = {}) {
  await tick();
  let list = [...store];
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((o) => o.id.toLowerCase().includes(q) || o.customer.name.toLowerCase().includes(q) || o.customer.email.toLowerCase().includes(q));
  }
  if (status) list = list.filter((o) => o.status === status);
  if (payment) list = list.filter((o) => o.paymentStatus === payment);
  if (sort === 'newest') list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (sort === 'oldest') list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  if (sort === 'total-desc') list.sort((a, b) => b.total - a.total);
  if (sort === 'total-asc') list.sort((a, b) => a.total - b.total);
  const total = list.length;
  const start = (page - 1) * perPage;
  return { items: list.slice(start, start + perPage), total, page, perPage };
}

export async function fetchAdminOrder(id) {
  await tick();
  return store.find((o) => o.id === id) || null;
}

export async function updateOrderStatus(id, status) {
  await tick();
  store = store.map((o) => (o.id === id ? { ...o, status } : o));
  return store.find((o) => o.id === id);
}

export async function cancelOrder(id) {
  return updateOrderStatus(id, 'cancelled');
}

export async function refundOrder(id) {
  await tick();
  store = store.map((o) => (o.id === id ? { ...o, paymentStatus: 'refunded' } : o));
  return store.find((o) => o.id === id);
}

export async function addOrderNote(id, note) {
  await tick();
  store = store.map((o) => (o.id === id ? { ...o, notes: [...o.notes, { text: note, at: new Date().toISOString() }] } : o));
  return store.find((o) => o.id === id);
}

export function orderStats() {
  return {
    total: store.length,
    pending: store.filter((o) => o.status === 'pending').length,
    processing: store.filter((o) => o.status === 'processing').length,
    shipped: store.filter((o) => o.status === 'shipped').length,
    delivered: store.filter((o) => o.status === 'delivered').length,
    cancelled: store.filter((o) => o.status === 'cancelled').length,
    returned: store.filter((o) => o.status === 'returned').length,
  };
}

export function revenueStats() {
  const now = new Date();
  const sum = (filterFn) => store.filter(filterFn).reduce((s, o) => s + (o.status === 'cancelled' ? 0 : o.total), 0);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  return {
    today: sum((o) => new Date(o.createdAt) >= startOfDay),
    week: sum((o) => new Date(o.createdAt) >= startOfWeek),
    month: sum((o) => new Date(o.createdAt) >= startOfMonth),
    year: sum((o) => new Date(o.createdAt) >= startOfYear),
  };
}
