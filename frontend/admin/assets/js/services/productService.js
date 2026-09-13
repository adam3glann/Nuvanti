// productService (admin) — reads/writes the in-memory copy of the shared
// catalog. A real backend replaces every function body with a fetch() to
// /api/admin/products; call sites elsewhere never need to change.
import { products as sourceProducts } from '../../../../assets/js/data/products.js';

let store = sourceProducts.map((p) => ({ ...p, status: 'active', cost: Math.round(p.price * 0.42), sku: `NV-${p.id.toUpperCase()}` }));

function tick(ms = 150) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchAdminProducts({ query, category, status, page = 1, perPage = 10, sort } = {}) {
  await tick();
  let list = [...store];
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  }
  if (category) list = list.filter((p) => p.category === category);
  if (status) list = list.filter((p) => p.status === status);
  if (sort === 'price-asc') list.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') list.sort((a, b) => b.price - a.price);
  if (sort === 'name-asc') list.sort((a, b) => a.name.localeCompare(b.name));
  const total = list.length;
  const start = (page - 1) * perPage;
  return { items: list.slice(start, start + perPage), total, page, perPage };
}

export async function fetchAdminProduct(id) {
  await tick();
  return store.find((p) => p.id === id) || null;
}

export async function updateAdminProduct(id, patch) {
  await tick();
  store = store.map((p) => (p.id === id ? { ...p, ...patch } : p));
  return store.find((p) => p.id === id);
}

export async function deleteAdminProduct(id) {
  await tick();
  store = store.filter((p) => p.id !== id);
  return true;
}

export async function duplicateAdminProduct(id) {
  await tick();
  const original = store.find((p) => p.id === id);
  if (!original) return null;
  const copy = { ...original, id: `${original.id}-copy-${Date.now()}`, name: `${original.name} (Copy)`, status: 'draft' };
  store = [copy, ...store];
  return copy;
}

export function productStockTotal(product) {
  return Object.values(product.inventory || {}).reduce((a, b) => a + b, 0);
}
export function productStockStatus(product) {
  const total = productStockTotal(product);
  if (total === 0) return 'out';
  if (total <= 10) return 'low';
  return 'in';
}
