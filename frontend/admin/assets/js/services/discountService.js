import { discounts as sourceDiscounts } from '../data/discounts.js';

let store = [...sourceDiscounts];
function tick(ms = 120) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchDiscounts() { await tick(); return [...store]; }

export async function createDiscount(data) {
  await tick();
  const d = { id: `d-${Date.now()}`, used: 0, status: 'active', ...data };
  store = [d, ...store];
  return d;
}

export async function toggleDiscountStatus(id) {
  await tick();
  store = store.map((d) => (d.id === id ? { ...d, status: d.status === 'active' ? 'inactive' : 'active' } : d));
  return store;
}

export async function deleteDiscount(id) {
  await tick();
  store = store.filter((d) => d.id !== id);
  return store;
}
