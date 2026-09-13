import { revenueSeries, topProducts, topCategories } from '../data/analytics.js';

function tick(ms = 150) { return new Promise((r) => setTimeout(r, ms)); }

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

export async function fetchRevenueSeries(range = '30d') {
  await tick();
  return revenueSeries(RANGE_DAYS[range] || 30);
}
export async function fetchTopProducts() { await tick(); return topProducts(); }
export async function fetchTopCategories() { await tick(); return topCategories(); }

export function summarize(series) {
  const revenue = series.reduce((s, d) => s + d.revenue, 0);
  const orders = series.reduce((s, d) => s + d.orders, 0);
  const aov = orders ? Math.round(revenue / orders) : 0;
  return { revenue, orders, aov };
}
