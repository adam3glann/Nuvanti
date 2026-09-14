// productService (admin) — reads/writes the same shared catalog the
// storefront reads from (see assets/js/data/productStore.js), so any
// change made here is what customers see in the shop. A real backend
// replaces every function body with a fetch() to /api/admin/products;
// call sites elsewhere never need to change.
import {
  getAllProducts, getProductById, addProduct, updateProduct, deleteProduct,
} from '../../../../assets/js/data/productStore.js';

function tick(ms = 150) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchAdminProducts({ query, category, status, page = 1, perPage = 10, sort } = {}) {
  await tick();
  let list = [...getAllProducts()];
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
  return getProductById(id);
}

export async function createAdminProduct(data) {
  await tick();
  return addProduct(data);
}

export async function updateAdminProduct(id, patch) {
  await tick();
  return updateProduct(id, patch);
}

export async function deleteAdminProduct(id) {
  await tick();
  deleteProduct(id);
  return true;
}

export async function duplicateAdminProduct(id) {
  await tick();
  const original = getProductById(id);
  if (!original) return null;
  const { id: _oldId, ...rest } = original;
  return addProduct({ ...rest, name: `${original.name} (Copy)`, status: 'draft', sku: undefined });
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
