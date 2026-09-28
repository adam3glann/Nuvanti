import { initAdminShell } from '../components/shell.js';
import { escapeHtml, formatBusinessAmount, formatDate } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { lineChart } from '../components/charts.js';
import { fetchRecentAdminOrders } from '../services/orderService.js';
import { fetchRevenueSeries, fetchFinancialSummary, clearAnalyticsCache } from '../services/analyticsService.js';
import { startLiveRefresh } from '../services/liveRefresh.js';
import { downloadStoreBackup, resetStoreData, restoreStoreBackup } from '../services/maintenanceService.js';
import { showAdminToast } from '../components/toast.js';

const session = initAdminShell({ page: 'dashboard', title: 'Dashboard' });
if (session) {
  document.getElementById('rangeSelect').addEventListener('change', (e) => renderChart(e.target.value));
  initStoreMaintenance(session);
  render();
  startLiveRefresh(() => { clearAnalyticsCache(); return render(); }, 10000);
}

function initStoreMaintenance(adminSession) {
  const panel = document.getElementById('storeMaintenance');
  if (!panel || !['admin', 'super_admin'].includes(adminSession.role)) return;
  panel.hidden = false;

  const backupButton = document.getElementById('downloadStoreBackup');
  const resetButton = document.getElementById('resetStoreData');
  const note = document.getElementById('maintenanceNote');
  const restoreFileInput = document.getElementById('restoreBackupFile');
  const restorePreview = document.getElementById('restoreBackupPreview');
  const restoreButton = document.getElementById('restoreStoreBackup');
  let backupDownloaded = false;
  let selectedRestoreFile = null;

  const updateActionButtons = () => {
    resetButton.disabled = !backupDownloaded;
    restoreButton.disabled = !backupDownloaded || !selectedRestoreFile;
  };

  backupButton.addEventListener('click', async () => {
    backupButton.disabled = true;
    try {
      await downloadStoreBackup();
      backupDownloaded = true;
      updateActionButtons();
      note.textContent = 'Backup downloaded. The reset button is unlocked; it will still ask you to confirm the destructive action.';
      showAdminToast('Store backup downloaded.', 'success');
    } catch (error) {
      showAdminToast(error.message, 'error');
    } finally {
      backupButton.disabled = false;
    }
  });

  restoreFileInput.addEventListener('change', async () => {
    selectedRestoreFile = null;
    updateActionButtons();
    const file = restoreFileInput.files?.[0];
    if (!file) {
      restorePreview.textContent = 'Select a backup file to preview its contents.';
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      restorePreview.textContent = 'This file is larger than the 25 MB restore limit.';
      return;
    }

    try {
      const backup = JSON.parse(await file.text());
      const sections = ['customers', 'products', 'categories', 'collections', 'homepageSlides', 'storeSettings', 'discounts', 'orders', 'orderItems', 'addresses', 'contactMessages', 'newsletterSubscribers', 'inventoryAdjustments', 'auditLogs'];
      if (backup?.format !== 'nuvanti-store-backup' || backup.version !== 1 || sections.some((key) => !Array.isArray(backup[key]))) {
        throw new Error('This is not a supported Nuvanti store backup.');
      }
      selectedRestoreFile = file;
      restorePreview.textContent = `Backup from ${backup.generatedAt || 'an unknown date'}: ${backup.customers.length} customers, ${backup.orders.length} orders, ${backup.products.length} products, and ${backup.homepageSlides.length} homepage slides. Admin accounts and login security data are not included.`;
      if (!backupDownloaded) restorePreview.textContent += ' Download a current backup before restoring to unlock the button.';
      updateActionButtons();
    } catch (error) {
      restorePreview.textContent = error.message || 'The selected file is not valid JSON.';
    }
  });

  restoreButton.addEventListener('click', async () => {
    if (!backupDownloaded || !selectedRestoreFile) return;
    const accepted = window.confirm('Restoring replaces the exported customer, order, catalog, content, settings, and dashboard data with the selected backup. Current admin accounts and their passwords and MFA are kept. Customer passwords and payment-provider transaction references are not in the backup. Continue?');
    if (!accepted) return;
    if (window.prompt('To confirm, type RESTORE STORE BACKUP exactly:') !== 'RESTORE STORE BACKUP') {
      showAdminToast('Restore cancelled. The confirmation text did not match.', 'info');
      return;
    }

    restoreButton.disabled = true;
    backupButton.disabled = true;
    resetButton.disabled = true;
    restoreButton.textContent = 'Restoring…';
    try {
      const result = await restoreStoreBackup(selectedRestoreFile);
      backupDownloaded = false;
      selectedRestoreFile = null;
      restoreFileInput.value = '';
      restorePreview.textContent = `Restore complete: ${result.customers} customers, ${result.orders} orders, and ${result.products} products restored. ${result.customersNeedingPasswordReset} restored customer accounts need password resets because passwords are not stored in backups.`;
      restoreButton.textContent = 'Restore selected backup';
      updateActionButtons();
      clearAnalyticsCache();
      await render();
      window.dispatchEvent(new Event('nuvanti:refresh-store-presence'));
      showAdminToast('Store data restored from backup.', 'success');
    } catch (error) {
      restoreButton.textContent = 'Restore selected backup';
      updateActionButtons();
      showAdminToast(error.message, 'error');
    } finally {
      backupButton.disabled = false;
    }
  });

  resetButton.addEventListener('click', async () => {
    if (!backupDownloaded) return;
    const accepted = window.confirm('This permanently deletes customer accounts, orders, messages, newsletter signups, inventory history and visitor analytics. Your admin accounts and shop catalog/design are kept. Continue?');
    if (!accepted) return;
    if (window.prompt('To confirm, type RESET STORE DATA exactly:') !== 'RESET STORE DATA') {
      showAdminToast('Reset cancelled. The confirmation text did not match.', 'info');
      return;
    }

    resetButton.disabled = true;
    backupButton.disabled = true;
    resetButton.textContent = 'Resetting…';
    try {
      const result = await resetStoreData();
      backupDownloaded = false;
      updateActionButtons();
      resetButton.textContent = 'Reset customer, order & dashboard data';
      note.textContent = `Cleanup complete: removed ${result.customers} customer accounts and ${result.orders} orders. Store products, photos and design were kept; stock was restored for prior non-cancelled orders. Download a fresh backup before another reset.`;
      clearAnalyticsCache();
      await render();
      window.dispatchEvent(new Event('nuvanti:refresh-store-presence'));
      showAdminToast('Test customer, order, and dashboard data cleared.', 'success');
    } catch (error) {
      resetButton.textContent = 'Reset customer, order & dashboard data';
      resetButton.disabled = false;
      showAdminToast(error.message, 'error');
    } finally {
      backupButton.disabled = false;
    }
  });
}

async function render() {
  const [financialResult, dashboardResult, recentResult] = await Promise.allSettled([
    fetchFinancialSummary(),
    loadDashboardSummary(),
    fetchRecentAdminOrders(6),
  ]);

  const financial = financialResult.status === 'fulfilled' ? financialResult.value : null;
  if (financial) {
    const averageOrder = financial.completedOrders ? financial.revenue / financial.completedOrders : 0;
    document.getElementById('businessGrid').innerHTML = `
      ${businessCard('Paid product sales', formatBusinessAmount(financial.revenue), `${financial.completedOrders} paid orders · discounts deducted · shipping excluded`, 'var(--a-primary)')}
      ${businessCard('Gross profit before expenses', financial.grossProfit == null ? 'Add unit costs' : formatBusinessAmount(financial.grossProfit), financial.grossProfit == null ? 'Record product costs to calculate this' : `Costed sales − product costs · ${formatBusinessAmount(financial.costedRevenue)} of sales costed`, 'var(--a-success)')}
      ${businessCard('Product costs', formatBusinessAmount(financial.costOfGoods), `Cost of goods for ${formatBusinessAmount(financial.costedRevenue)} in costed sales`, 'var(--a-text)')}
      ${businessCard('Gross margin', financial.grossMargin == null ? '—' : `${financial.grossMargin.toFixed(1)}%`, financial.grossMargin == null ? 'Available when product costs are recorded' : 'Gross profit ÷ costed sales · excludes expenses', 'var(--a-info)')}
      ${businessCard('Average paid order', formatBusinessAmount(averageOrder), 'Paid product sales ÷ paid orders', 'var(--a-primary)')}
      ${businessCard('Pieces sold', Number(financial.unitsSold || 0).toLocaleString('en-US'), 'Units in paid orders', 'var(--a-text)')}
      ${businessCard('Payments still due', formatBusinessAmount(financial.pendingOrderValue), `${financial.pendingOrderCount} active unpaid orders · includes shipping · not sales`, 'var(--a-warning)')}
    `;
    const coverage = financial.completedOrders ? Math.round((financial.costedOrders / financial.completedOrders) * 100) : 0;
    document.getElementById('financeNote').textContent = `How to read this: sales = paid product totals after discounts (shipping excluded). Gross profit and margin use only orders with a recorded unit cost for every item; they do not subtract delivery, advertising, rent, or other expenses. Cost data covers ${financial.costedOrders} of ${financial.completedOrders} paid orders (${coverage}%).`;
    if (financial.uncostedLines > 0) {
      document.getElementById('financeNote').textContent += ` ${financial.uncostedLines} sold item line(s) have no saved unit cost. Add Unit Cost to products so new orders are included in profit calculations.`;
    }
  } else {
    document.getElementById('businessGrid').innerHTML = '<div class="admin-empty"><p></p></div>';
    document.querySelector('#businessGrid p').textContent = `Business summary unavailable: ${financialResult.reason.message}`;
    document.getElementById('financeNote').textContent = 'Other dashboard sections may still load. Check the database connection and deployment logs.';
  }

  const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
  if (dashboard) {
    document.getElementById('statGrid').innerHTML = `
      <div class="stat-card"><p class="stat-card__label">Paid Sales Today</p><p class="stat-card__value">${formatBusinessAmount(dashboard.revenueToday)}</p><p class="stat-card__delta">After discounts · shipping excluded</p></div>
      <div class="stat-card"><p class="stat-card__label">Paid Sales This Month</p><p class="stat-card__value">${formatBusinessAmount(dashboard.revenueMonth)}</p><p class="stat-card__delta">After discounts · shipping excluded</p></div>
      <div class="stat-card"><p class="stat-card__label">All Orders</p><p class="stat-card__value">${dashboard.orders}</p><p class="stat-card__delta up">${dashboard.pendingOrders} still in progress</p></div>
      <div class="stat-card"><p class="stat-card__label">Total Customers</p><p class="stat-card__value">${dashboard.customers}</p><p class="stat-card__delta">${dashboard.newCustomersThisMonth} joined this month</p></div>
      <div class="stat-card"><p class="stat-card__label">Live Store Visitors</p><p class="stat-card__value" id="dashboardPresenceCount">Loading…</p><p class="stat-card__delta"><span id="dashboardStoreViews">Loading total views…</span> · updates every 2 seconds</p></div>
    `;
    window.dispatchEvent(new Event('nuvanti:refresh-store-presence'));
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

  renderChart(document.getElementById('rangeSelect').value || '30d').catch((error) => {
    document.getElementById('revenueChart').textContent = `Chart unavailable: ${error.message}`;
  });
}

async function loadDashboardSummary() {
  const response = await fetch(`${location.origin}/api/admin/dashboard`, { credentials: 'include', cache: 'no-store' });
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
