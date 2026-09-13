import { products as sourceProducts } from '../../../../assets/js/data/products.js';

// Flatten product+size into inventory rows.
let rows = sourceProducts.flatMap((p) =>
  Object.entries(p.inventory).map(([size, stock]) => ({
    id: `${p.id}__${size}`, productId: p.id, productName: p.name, image: p.images[0],
    sku: `NV-${p.id.toUpperCase()}-${size}`, size, stock, reserved: Math.min(stock, Math.round(stock * 0.1)),
    lowStockThreshold: 5, history: [{ change: stock, reason: 'Initial stock', at: p.id + '-init' }],
  }))
);

function tick(ms = 150) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchInventory({ query, status, page = 1, perPage = 12 } = {}) {
  await tick();
  let list = [...rows];
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((r) => r.productName.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  }
  if (status) list = list.filter((r) => rowStatus(r) === status);
  const total = list.length;
  const start = (page - 1) * perPage;
  return { items: list.slice(start, start + perPage), total, page, perPage };
}

export function rowStatus(row) {
  const available = row.stock - row.reserved;
  if (available <= 0) return 'out';
  if (available <= row.lowStockThreshold) return 'low';
  return 'in';
}

export async function adjustStock(id, delta, reason) {
  await tick();
  rows = rows.map((r) => (r.id === id
    ? { ...r, stock: Math.max(0, r.stock + delta), history: [{ change: delta, reason: reason || (delta >= 0 ? 'Manual increase' : 'Manual decrease'), at: new Date().toISOString() }, ...r.history] }
    : r));
  return rows.find((r) => r.id === id);
}

export function lowStockAlerts(limit = 5) {
  return rows.filter((r) => rowStatus(r) !== 'in').slice(0, limit);
}

export function inventoryStats() {
  return {
    total: rows.length,
    low: rows.filter((r) => rowStatus(r) === 'low').length,
    out: rows.filter((r) => rowStatus(r) === 'out').length,
  };
}
