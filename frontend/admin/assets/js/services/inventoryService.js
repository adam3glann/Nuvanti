import { getAllProducts, updateProduct } from '../../../../assets/js/data/productStore.js';

// Adjustment history isn't part of the shared product schema (it's an
// admin-only audit trail), so it's kept here, keyed by row id, and
// survives for the rest of this session. Stock itself always comes
// straight from the shared store, so it's never out of sync with what
// the storefront shows.
const historyLog = new Map();

function buildRows() {
  return getAllProducts().flatMap((p) =>
    Object.entries(p.inventory || {}).map(([size, stock]) => {
      const id = `${p.id}__${size}`;
      const history = historyLog.get(id) || [{ change: stock, reason: 'Initial stock', at: p.id + '-init' }];
      return {
        id, productId: p.id, productName: p.name, image: p.images?.[0],
        sku: `NV-${p.id.toUpperCase()}-${size}`, size, stock,
        reserved: Math.min(stock, Math.round(stock * 0.1)),
        lowStockThreshold: 5, history,
      };
    }));
}

function tick(ms = 150) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchInventory({ query, status, page = 1, perPage = 12 } = {}) {
  await tick();
  let list = buildRows();
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
  const [productId, size] = id.split('__');
  const product = getAllProducts().find((p) => p.id === productId);
  if (!product) return null;

  const newStock = Math.max(0, (product.inventory?.[size] ?? 0) + delta);
  updateProduct(productId, { inventory: { ...product.inventory, [size]: newStock } });

  const prevHistory = historyLog.get(id) || [];
  historyLog.set(id, [
    { change: delta, reason: reason || (delta >= 0 ? 'Manual increase' : 'Manual decrease'), at: new Date().toISOString() },
    ...prevHistory,
  ]);

  return buildRows().find((r) => r.id === id);
}

export function lowStockAlerts(limit = 5) {
  return buildRows().filter((r) => rowStatus(r) !== 'in').slice(0, limit);
}

export function inventoryStats() {
  const rows = buildRows();
  return {
    total: rows.length,
    low: rows.filter((r) => rowStatus(r) === 'low').length,
    out: rows.filter((r) => rowStatus(r) === 'out').length,
  };
}
