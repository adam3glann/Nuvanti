import { initAdminShell } from '../components/shell.js';
import { formatPrice } from '../components/utils.js';
import { lineChart, barChart } from '../components/charts.js';
import { fetchRevenueSeries, fetchTopProducts, fetchTopCategories, summarize } from '../services/analyticsService.js';

const session = initAdminShell({ page: 'analytics', title: 'Analytics' });
if (session) init();

function init() {
  document.getElementById('rangeSelect').addEventListener('change', (e) => render(e.target.value));
  render('30d');
}

async function render(range) {
  const series = await fetchRevenueSeries(range);
  const summary = summarize(series);
  const orders = series.reduce((s, d) => s + d.orders, 0);
  const conversionRate = 2.8; // mock — needs traffic data from a real analytics pipeline

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><p class="stat-card__label">Revenue</p><p class="stat-card__value">${formatPrice(summary.revenue)}</p></div>
    <div class="stat-card"><p class="stat-card__label">Orders</p><p class="stat-card__value">${orders}</p></div>
    <div class="stat-card"><p class="stat-card__label">Average Order Value</p><p class="stat-card__value">${formatPrice(summary.aov)}</p></div>
    <div class="stat-card"><p class="stat-card__label">Conversion Rate</p><p class="stat-card__value">${conversionRate}%</p><p class="hint" style="margin-top:.3rem;color:var(--a-muted);font-size:.7rem">Requires traffic analytics — placeholder</p></div>
  `;

  document.getElementById('revenueChart').innerHTML = lineChart(series, { width: 900, height: 240 });
  document.getElementById('ordersChart').innerHTML = lineChart(series, { width: 900, height: 200, valueKey: 'orders', color: 'var(--a-info)' });

  const topP = await fetchTopProducts();
  document.getElementById('topProductsBody').innerHTML = topP.map((p) => `
    <tr><td>${p.name}</td><td>${p.unitsSold}</td><td>${formatPrice(p.revenue)}</td></tr>
  `).join('');

  const topC = await fetchTopCategories();
  document.getElementById('categoryChart').innerHTML = barChart(topC, { width: 900, height: 220, valueKey: 'revenue', color: 'var(--a-success)' });
}
