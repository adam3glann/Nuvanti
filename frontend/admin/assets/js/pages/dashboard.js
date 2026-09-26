import { initAdminShell } from '../components/shell.js';
import { escapeHtml, formatBusinessAmount, formatDate } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { lineChart } from '../components/charts.js';
import { fetchRecentAdminOrders } from '../services/orderService.js';
import { fetchRevenueSeries, fetchFinancialSummary } from '../services/analyticsService.js';

const session = initAdminShell({ page: 'dashboard', title: 'Dashboard' });
if (session) render();

async function render() {
  const [financialResult, dashboardResult, recentResult] = await Promise.allSettled([
    fetchFinancialSummary(),
    loadDashboardSummary(),
    fetchRecentAdminOrders(6),
  ]);

  const financial = financialResult.status === 'fulfilled' ? financialResult.value : null;
  if (financial) {
    document.getElementById('businessGrid').innerHTML = `
      ${businessCard('Total Revenue', formatBusinessAmount(financial.revenue), `${financial.completedOrders} paid or delivered orders`, 'var(--a-primary)')}
      ${businessCard('Pending COD', formatBusinessAmount(financial.pendingOrderValue), `${financial.pendingOrderCount} orders still in fulfillment`, 'var(--a-warning)')}
      ${businessCard('Estimated Gross Profit', financial.grossProfit == null ? 'Add unit costs' : formatBusinessAmount(financial.grossProfit), financial.grossProfit == null ? 'No completed orders have cost data yet' : `Based on ${financial.costedOrders} fully costed orders`, 'var(--a-success)')}
      ${businessCard('Gross Margin', financial.grossMargin == null ? '—' : `${financial.grossMargin.toFixed(1)}%`, financial.grossMargin == null ? 'Available after cost data is recorded' : 'On orders with complete cost data', 'var(--a-info)')}
      ${businessCard('Recorded Product Costs', formatBusinessAmount(financial.costOfGoods), `${financial.costedOrders} fully costed orders`, 'var(--a-text)')}
    `;
    if (financial.uncostedLines > 0) {
      document.getElementById('financeNote').textContent = `${financial.uncostedLines} completed order line(s) have no saved unit cost. Profit and margin only include fully costed orders. Add a Unit Cost to products for accurate reports on future orders.`;
    }
  } else {
    document.getElementById('businessGrid').innerHTML = '<div class="admin-empty"><p></p></div>';
    document.querySelector('#businessGrid p').textContent = `Business summary unavailable: ${financialResult.reason.message}`;
    document.getElementById('financeNote').textContent = 'Other dashboard sections may still load. Check the database connection and deployment logs.';
  }

  const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  if (dashboard) {
    document.getElementById('statGrid').innerHTML = `
      <div class="stat-card"><p class="stat-card__label">Revenue Today</p><p class="stat-card__value">${formatBusinessAmount(dashboard.revenueToday)}</p></div>
      <div class="stat-card"><p class="stat-card__label">Revenue This Month</p><p class="stat-card__value">${formatBusinessAmount(dashboard.revenueMonth)}</p></div>
      <div class="stat-card"><p class="stat-card__label">Total Orders</p><p class="stat-card__value">${dashboard.orders}</p><p class="stat-card__delta up">${dashboard.pendingOrders} open</p></div>
      <div class="stat-card"><p class="stat-card__label">Total Customers</p><p class="stat-card__value">${dashboard.customers}</p><p class="stat-card__delta">${dashboard.newCustomersThisMonth} joined this month</p></div>
    `;
    document.getElementById('orderStatusGrid').innerHTML = `
      ${row('Awaiting Fulfillment', dashboard.pendingOrders, 'neutral')} ${row('Fulfilled', dashboard.fulfilledOrders, 'success')}
      ${row('Cancelled', dashboard.cancelledOrders, 'danger')}
    `;
  } else {
    document.getElementById('statGrid').innerHTML = '<div class="admin-empty">Dashboard counts unavailable.</div>';
  }

  function row(label, val, tone) {
    return `<div class="stat-card"><p class="stat-card__label">${label}</p><p class="stat-card__value" style="font-size:1.25rem;color:var(--a-${tone === 'neutral' ? 'text' : tone})">${val}</p></div>`;
  }

  document.getElementById('productStatGrid').innerHTML = dashboard ? `
    <div class="stat-card"><p class="stat-card__label">Total Products</p><p class="stat-card__value">${dashboard.products}</p></div>
    <div class="stat-card"><p class="stat-card__label">Low Stock</p><p class="stat-card__value" style="color:var(--a-warning)">${dashboard.lowStockProducts}</p></div>
    <div class="stat-card"><p class="stat-card__label">Out of Stock</p><p class="stat-card__value" style="color:var(--a-danger)">${dashboard.outOfStockProducts}</p></div>
  ` : '<div class="admin-empty">Product counts unavailable.</div>';

  const recent = recentResult.status === 'fulfilled' ? recentResult.value : [];
  document.getElementById('recentOrdersBody').innerHTML = recent.map((o) => `
    <tr>
      <td><a class="mono" href="order-detail.html?id=${encodeURIComponent(o.id)}" style="color:var(--a-primary);font-weight:600">${escapeHtml(o.id)}</a></td>
      <td>${escapeHtml(o.customer.name)}</td>
      <td>${formatDate(o.createdAt)}</td>
      <td>${formatBusinessAmount(o.total)}</td>
      <td>${statusBadge(o.status)}</td>
    </tr>
  `).join('');

  const alerts = dashboard?.lowStockAlerts || [];
  document.getElementById('lowStockList').innerHTML = alerts.length
    ? alerts.map((a) => `
      <div class="alert-list-item">
        <div><strong>${escapeHtml(a.productName)}</strong><br /><span style="color:var(--a-muted);font-size:.76rem">Size ${escapeHtml(a.size)} · ${a.stock} remaining</span></div>
        ${statusBadge(a.stock <= 0 ? 'out' : 'low')}
      </div>`).join('')
    : `<p style="color:var(--a-muted);font-size:.83rem">All products are well stocked.</p>`;

  renderChart('30d').catch((error) => {
    document.getElementById('revenueChart').textContent = `Chart unavailable: ${error.message}`;
  });
  document.getElementById('rangeSelect').addEventListener('change', (e) => renderChart(e.target.value));
}

async function loadDashboardSummary() {
  const response = await fetch(`${location.origin}/api/admin/dashboard`, { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load dashboard statistics.');
  return body;
}

function businessCard(label, value, detail, color) {
  return `<div class="stat-card dash-finance-card"><p class="stat-card__label">${label}</p><p class="stat-card__value" style="color:${color}">${value}</p><p class="stat-card__delta">${detail}</p></div>`;
}

async function renderChart(range) {
  const series = await fetchRevenueSeries(range);
  document.getElementById('revenueChart').innerHTML = lineChart(series, { width: 900, height: 260 });
}
