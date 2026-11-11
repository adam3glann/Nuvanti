import { initAdminShell } from '../components/shell.js';
import { formatPrice, escapeHtml } from '../components/utils.js';
import { lineChart, barChart } from '../components/charts.js';
import { fetchRevenueSeries, fetchTopProducts, fetchTopCategories, fetchPendingOrders, summarize, clearAnalyticsCache } from '../services/analyticsService.js?v=analytics-first-load-1';
import { startLiveRefresh } from '../services/liveRefresh.js';

const session = initAdminShell({ page: 'analytics', title: 'Analytics' });
if (session) init();

let activeRender = 0;
let activeRenderCount = 0;
let initialLoadComplete = false;
let initialRetryCount = 0;
function init() {
  const rangeSelect = document.getElementById('rangeSelect');
  const validRanges = new Set(['7d', '30d', '90d', '1y']);
  if (!validRanges.has(rangeSelect.value)) rangeSelect.value = '30d';
  rangeSelect.addEventListener('change', (e) => render(validRanges.has(e.target.value) ? e.target.value : '30d'));
  requestAnimationFrame(() => {
    render(rangeSelect.value).finally(() => {
      startLiveRefresh(() => {
        if (activeRenderCount) return;
        clearAnalyticsCache();
        return render(rangeSelect.value, true);
      }, 30000);
    });
  });
}

async function render(range, background = false) {
  if (background && activeRenderCount) return;
  const requestId = ++activeRender;
  activeRenderCount += 1;
  ['statGrid', 'revenueChart', 'ordersChart', 'topProductsBody', 'categoryChart'].forEach((id) => {
    document.getElementById(id)?.setAttribute('aria-busy', 'true');
  });
  try {
  const series = await fetchRevenueSeries(range);
  if (requestId !== activeRender) return;
  const summary = summarize(series);
  const orders = series.reduce((s, d) => s + d.orders, 0);
  const [topP, topC, pendingOrders] = await Promise.all([
    fetchTopProducts(range), fetchTopCategories(range), fetchPendingOrders(range),
  ]);
  if (requestId !== activeRender) return;
  initialLoadComplete = true;

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><p class="stat-card__label">Net Product Sales</p><p class="stat-card__value">${formatPrice(summary.revenue)}</p></div>
    <div class="stat-card"><p class="stat-card__label">Paid Orders</p><p class="stat-card__value">${orders}</p></div>
    <div class="stat-card"><p class="stat-card__label">Average Paid Order</p><p class="stat-card__value">${formatPrice(summary.aov)}</p></div>
    <div class="stat-card"><p class="stat-card__label">Orders in Progress</p><p class="stat-card__value">${pendingOrders}</p></div>
  `;
  document.getElementById('statGrid').setAttribute('aria-busy', 'false');

  document.getElementById('revenueChart').innerHTML = lineChart(series, { width: 900, height: 240 });
  document.getElementById('revenueChart').removeAttribute('aria-hidden');
  document.getElementById('revenueChart').setAttribute('aria-busy', 'false');
  document.getElementById('ordersChart').innerHTML = lineChart(series, { width: 900, height: 200, valueKey: 'orders', color: 'var(--a-info)' });
  document.getElementById('ordersChart').removeAttribute('aria-hidden');
  document.getElementById('ordersChart').setAttribute('aria-busy', 'false');

  document.getElementById('topProductsBody').innerHTML = topP.map((p) => `
    <tr><td>${escapeHtml(p.name)}</td><td>${p.unitsSold}</td><td>${formatPrice(p.revenue)}</td></tr>
  `).join('');
  document.getElementById('topProductsBody').removeAttribute('aria-hidden');
  document.getElementById('topProductsBody').setAttribute('aria-busy', 'false');

  document.getElementById('categoryChart').innerHTML = barChart(topC, { width: 900, height: 220, valueKey: 'revenue', color: 'var(--a-success)' });
  document.getElementById('categoryChart').removeAttribute('aria-hidden');
  document.getElementById('categoryChart').setAttribute('aria-busy', 'false');
  } catch (error) {
    if (requestId !== activeRender) return;
    const retryable = !error.status || error.status === 408 || error.status === 429 || error.status >= 500;
    if (!initialLoadComplete && retryable && initialRetryCount < 2) {
      const delay = 600 * (2 ** initialRetryCount++);
      window.setTimeout(() => render(document.getElementById('rangeSelect').value), delay);
      return;
    }
    document.getElementById('statGrid').innerHTML = `<div class="admin-empty"><h3>Analytics unavailable</h3><p>${escapeHtml(error.message)}</p><button class="btn btn-outline" id="retryAnalytics">Try Again</button></div>`;
    document.getElementById('retryAnalytics')?.addEventListener('click', () => render(range));
    document.getElementById('revenueChart').innerHTML = '';
    document.getElementById('ordersChart').innerHTML = '';
    document.getElementById('topProductsBody').innerHTML = '';
    document.getElementById('categoryChart').innerHTML = '';
    ['revenueChart', 'ordersChart', 'topProductsBody', 'categoryChart'].forEach((id) => {
      document.getElementById(id)?.removeAttribute('aria-hidden');
      document.getElementById(id)?.setAttribute('aria-busy', 'false');
    });
    document.getElementById('statGrid').setAttribute('aria-busy', 'false');
  } finally {
    activeRenderCount -= 1;
  }
}
