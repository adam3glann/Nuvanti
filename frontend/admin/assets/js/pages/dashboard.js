import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { lineChart } from '../components/charts.js';
import { orderStats, revenueStats, fetchAdminOrders } from '../services/orderService.js';
import { fetchAdminProducts, productStockStatus } from '../services/productService.js';
import { customerStats } from '../services/customerService.js';
import { lowStockAlerts } from '../services/inventoryService.js';
import { fetchRevenueSeries } from '../services/analyticsService.js';

const session = initAdminShell({ page: 'dashboard', title: 'Dashboard' });
if (session) render();

async function render() {
  const rev = await revenueStats();
  const ord = await orderStats();
  const cust = customerStats();
  const { total: totalProducts, items: sampleProducts } = await fetchAdminProducts({ perPage: 999 });
  const outOfStock = sampleProducts.filter((p) => productStockStatus(p) === 'out').length;
  const lowStock = sampleProducts.filter((p) => productStockStatus(p) === 'low').length;

  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><p class="stat-card__label">Revenue Today</p><p class="stat-card__value">${formatPrice(rev.today)}</p></div>
    <div class="stat-card"><p class="stat-card__label">Revenue This Month</p><p class="stat-card__value">${formatPrice(rev.month)}</p></div>
    <div class="stat-card"><p class="stat-card__label">Total Orders</p><p class="stat-card__value">${ord.total}</p><p class="stat-card__delta up">${ord.pending} pending</p></div>
    <div class="stat-card"><p class="stat-card__label">Total Customers</p><p class="stat-card__value">${cust.total}</p><p class="stat-card__delta up">${cust.returning} returning</p></div>
  `;

  document.getElementById('orderStatusGrid').innerHTML = `
    ${row('Pending', ord.pending, 'neutral')} ${row('Processing', ord.processing, 'info')}
    ${row('Shipped', ord.shipped, 'info')} ${row('Delivered', ord.delivered, 'success')}
    ${row('Cancelled', ord.cancelled, 'danger')} ${row('Returned', ord.returned, 'warning')}
  `;
  function row(label, val, tone) {
    return `<div class="stat-card"><p class="stat-card__label">${label}</p><p class="stat-card__value" style="font-size:1.25rem;color:var(--a-${tone === 'neutral' ? 'text' : tone})">${val}</p></div>`;
  }

  document.getElementById('productStatGrid').innerHTML = `
    <div class="stat-card"><p class="stat-card__label">Total Products</p><p class="stat-card__value">${totalProducts}</p></div>
    <div class="stat-card"><p class="stat-card__label">Low Stock</p><p class="stat-card__value" style="color:var(--a-warning)">${lowStock}</p></div>
    <div class="stat-card"><p class="stat-card__label">Out of Stock</p><p class="stat-card__value" style="color:var(--a-danger)">${outOfStock}</p></div>
  `;

  await renderChart('30d');
  document.getElementById('rangeSelect').addEventListener('change', (e) => renderChart(e.target.value));

  const recent = (await fetchAdminOrders({ perPage: 6, sort: 'newest' })).items;
  document.getElementById('recentOrdersBody').innerHTML = recent.map((o) => `
    <tr>
      <td><a class="mono" href="order-detail.html?id=${o.id}" style="color:var(--a-primary);font-weight:600">${o.id}</a></td>
      <td>${o.customer.name}</td>
      <td>${formatDate(o.createdAt)}</td>
      <td>${formatPrice(o.total)}</td>
      <td>${statusBadge(o.status)}</td>
    </tr>
  `).join('');

  const alerts = await lowStockAlerts(5);
  document.getElementById('lowStockList').innerHTML = alerts.length
    ? alerts.map((a) => `
      <div class="alert-list-item">
        <div><strong>${a.productName}</strong><br /><span style="color:var(--a-muted);font-size:.76rem">Size ${a.size} · ${a.stock - a.reserved} remaining</span></div>
        ${statusBadge(a.stock - a.reserved <= 0 ? 'out' : 'low')}
      </div>`).join('')
    : `<p style="color:var(--a-muted);font-size:.83rem">All products are well stocked.</p>`;
}

async function renderChart(range) {
  const series = await fetchRevenueSeries(range);
  document.getElementById('revenueChart').innerHTML = lineChart(series, { width: 900, height: 260 });
}
