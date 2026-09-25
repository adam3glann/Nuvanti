import { API_ORIGIN } from '../config.js';

const cache = new Map();

async function load(range) {
  if (!cache.has(range)) {
    cache.set(range, fetch(`${API_ORIGIN}/api/admin/analytics?range=${encodeURIComponent(range)}`, {
      credentials: 'include',
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Unable to load analytics.');
      return body;
    }).catch((error) => {
      cache.delete(range);
      throw error;
    }));
  }
  return cache.get(range);
}

export async function fetchRevenueSeries(range = '30d') { return (await load(range)).series; }
export async function fetchTopProducts(range = '30d') { return (await load(range)).topProducts; }
export async function fetchTopCategories(range = '30d') { return (await load(range)).topCategories; }
export async function fetchPendingOrders(range = '30d') { return (await load(range)).pendingOrders; }
export async function fetchFinancialSummary() {
  const response = await fetch(`${API_ORIGIN}/api/admin/financial-summary`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load financial summary.');
  return body;
}
export function summarize(series) {
  const revenue = series.reduce((sum, day) => sum + day.revenue, 0);
  const orders = series.reduce((sum, day) => sum + day.orders, 0);
  return { revenue, orders, aov: orders ? Math.round(revenue / orders) : 0 };
}
