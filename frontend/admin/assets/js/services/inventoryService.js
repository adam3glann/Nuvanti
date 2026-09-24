import { API_ORIGIN } from '../config.js';
import { fetchAdminProduct, fetchAdminProducts } from './productService.js';

async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}/api/admin${path}`, { credentials: 'include', ...options });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to update inventory.');
  return body;
}

async function buildRows() {
  const [{ items }, history] = await Promise.all([
    fetchAdminProducts({ perPage: 1000 }), request('/inventory/history'),
  ]);
  const historyById = new Map();
  history.forEach((entry) => {
    const key = `${entry.productId}__${entry.size}`;
    if (!historyById.has(key)) historyById.set(key, []);
    historyById.get(key).push({ change: Number(entry.change), reason: entry.reason, at: entry.createdAt, actor: entry.actorName });
  });
  return items.flatMap((product) => Object.entries(product.inventory || {}).map(([size, stock]) => {
    const id = `${product.id}__${size}`;
    return { id, productId: product.id, productName: product.name, image: product.images?.[0], sku: `${product.sku}-${size}`, size, stock: Number(stock), reserved: 0, lowStockThreshold: 5, history: historyById.get(id) || [] };
  }));
}

export async function fetchInventory({ query, status, page = 1, perPage = 12 } = {}) {
  let list = await buildRows();
  if (query) { const q = query.toLowerCase(); list = list.filter((row) => row.productName.toLowerCase().includes(q) || row.sku.toLowerCase().includes(q)); }
  if (status) list = list.filter((row) => rowStatus(row) === status);
  const total = list.length;
  return { items: list.slice((page - 1) * perPage, page * perPage), total, page, perPage };
}
export function rowStatus(row) { const available = row.stock - row.reserved; return available <= 0 ? 'out' : available <= row.lowStockThreshold ? 'low' : 'in'; }
export async function adjustStock(id, delta, reason) {
  const [productId, size] = id.split('__');
  const result = await request(`/inventory/${encodeURIComponent(productId)}/${encodeURIComponent(size)}/adjust`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ change: Number(delta), reason: reason || (delta >= 0 ? 'Manual increase' : 'Manual decrease') }),
  });
  const product = await fetchAdminProduct(productId);
  return { id, productId, productName: product?.name || 'Product', size, stock: result.stock, reserved: 0, lowStockThreshold: 5, history: [] };
}
export async function lowStockAlerts(limit = 5) { return (await buildRows()).filter((row) => rowStatus(row) !== 'in').slice(0, limit); }
export async function inventoryStats() { const rows = await buildRows(); return { total: rows.length, low: rows.filter((row) => rowStatus(row) === 'low').length, out: rows.filter((row) => rowStatus(row) === 'out').length }; }
