import { API_ORIGIN } from '../config.js';

const cache = new Map();

async function load(range) {
  if (!cache.has(range)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    cache.set(range, fetch(`${API_ORIGIN}/api/admin/analytics?range=${encodeURIComponent(range)}`, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(body.error || 'Unable to load analytics.');
        error.status = response.status;
        throw error;
      }
      return body;
    }).catch((error) => {
      if (error.name === 'AbortError') throw new Error('Loading analytics took too long. Please try again.');
      throw error;
    }).catch((error) => {
      cache.delete(range);
      throw error;
    }).finally(() => {
      clearTimeout(timeout);
    }));
  }
  return cache.get(range);
}

export function clearAnalyticsCache() { cache.clear(); }

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
  const revenueCents = series.reduce((sum, day) => sum + Math.round(Number(day.revenue || 0) * 100), 0);
  const revenue = revenueCents / 100;
  const orders = series.reduce((sum, day) => sum + day.orders, 0);
  return { revenue, orders, aov: orders ? Math.round(revenueCents / orders) / 100 : 0 };
}
