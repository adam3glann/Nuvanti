import { customers as sourceCustomers, getCustomerById as _byId } from '../data/customers.js';

let store = [...sourceCustomers];
function tick(ms = 150) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchAdminCustomers({ query, status, page = 1, perPage = 10, sort = 'recent' } = {}) {
  await tick();
  let list = [...store];
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }
  if (status) list = list.filter((c) => c.status === status);
  if (sort === 'spent-desc') list.sort((a, b) => b.totalSpent - a.totalSpent);
  if (sort === 'orders-desc') list.sort((a, b) => b.orderCount - a.orderCount);
  if (sort === 'recent') list.sort((a, b) => new Date(b.lastOrder || 0) - new Date(a.lastOrder || 0));
  const total = list.length;
  const start = (page - 1) * perPage;
  return { items: list.slice(start, start + perPage), total, page, perPage };
}

export async function fetchAdminCustomer(id) {
  await tick();
  return store.find((c) => c.id === id) || null;
}

export async function toggleCustomerStatus(id) {
  await tick();
  store = store.map((c) => (c.id === id ? { ...c, status: c.status === 'active' ? 'disabled' : 'active' } : c));
  return store.find((c) => c.id === id);
}

export async function addCustomerNote(id, note) {
  await tick();
  store = store.map((c) => (c.id === id ? { ...c, notes: [...c.notes, { text: note, at: new Date().toISOString() }] } : c));
  return store.find((c) => c.id === id);
}

export function customerStats() {
  return {
    total: store.length,
    newThisMonth: store.filter((c) => c.orderCount === 1).length,
    returning: store.filter((c) => c.orderCount > 1).length,
  };
}
