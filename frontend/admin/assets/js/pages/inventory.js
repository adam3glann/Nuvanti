import { initAdminShell } from '../components/shell.js';
import { paginationHTML, storeAssetSrc } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { createAdminDrawer } from '../components/modal.js';
import { fetchInventory, rowStatus, adjustStock, inventoryStats } from '../services/inventoryService.js';

const state = { query: '', status: '', page: 1, perPage: 12 };

const session = initAdminShell({ page: 'inventory', title: 'Inventory' });
if (session) init();

async function init() {
  const stats = await inventoryStats();
  document.getElementById('statGrid').innerHTML = `
    <div class="stat-card"><p class="stat-card__label">Tracked SKUs</p><p class="stat-card__value">${stats.total}</p></div>
    <div class="stat-card"><p class="stat-card__label">Low Stock</p><p class="stat-card__value" style="color:var(--a-warning)">${stats.low}</p></div>
    <div class="stat-card"><p class="stat-card__label">Out of Stock</p><p class="stat-card__value" style="color:var(--a-danger)">${stats.out}</p></div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById('exportBtn').addEventListener('click', exportInventory);

  load();
}

async function load() {
  const tbody = document.getElementById('invBody');
  let items, total;
  try {
    ({ items, total } = await fetchInventory(state));
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="admin-empty"><h3>Couldn't load inventory</h3><p>${error.message}</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((r) => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:.6rem"><img src="${storeAssetSrc(r.image)}" width="32" height="40" style="object-fit:cover;border-radius:3px" alt="" /><span>${r.productName}</span></div></td>
      <td>${r.size}</td>
      <td class="mono">${r.sku}</td>
      <td>${r.stock}</td>
      <td>${r.reserved}</td>
      <td>${r.stock - r.reserved}</td>
      <td>${statusBadge(rowStatus(r))}</td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" data-adjust="${r.id}">Adjust</button>
        <button class="btn btn-ghost btn-sm" data-history="${r.id}">History</button>
      </td>
    </tr>
  `).join('');

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));

  document.querySelectorAll('[data-adjust]').forEach((btn) => btn.addEventListener('click', () => openAdjust(btn.dataset.adjust, items)));
  document.querySelectorAll('[data-history]').forEach((btn) => btn.addEventListener('click', () => openHistory(btn.dataset.history, items)));
}

function openAdjust(id, items) {
  const row = items.find((r) => r.id === id);
  const drawer = createAdminDrawer({
    title: `Adjust Stock — ${row.productName} (${row.size})`,
    bodyHTML: `
      <p style="color:var(--a-muted);font-size:.85rem;margin-bottom:1rem">Current stock: <strong>${row.stock}</strong></p>
      <div class="field"><label>Adjustment</label><input type="number" id="adjAmount" placeholder="e.g. 20 or -5" /></div>
      <div class="field"><label>Reason</label><input id="adjReason" placeholder="e.g. Restock, damaged goods, correction" /></div>
      <button class="btn btn-primary" id="adjSave" style="width:100%">Apply Adjustment</button>
    `,
  });
  drawer.root.querySelector('#adjSave').addEventListener('click', async () => {
    const amount = Number(drawer.root.querySelector('#adjAmount').value);
    if (!amount) return;
    try {
      await adjustStock(id, amount, drawer.root.querySelector('#adjReason').value);
      showAdminToast('Stock adjusted.', 'success');
      drawer.close();
      load();
    } catch (error) { showAdminToast(error.message, 'error'); }
  });
  drawer.open();
}

function openHistory(id, items) {
  const row = items.find((r) => r.id === id);
  const drawer = createAdminDrawer({
    title: `Stock History — ${row.productName} (${row.size})`,
    bodyHTML: `
      <div style="display:flex;flex-direction:column;gap:.6rem">
        ${row.history.map((h) => `
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--a-border);padding-bottom:.6rem">
            <span>${h.reason}</span>
            <strong style="color:${h.change >= 0 ? 'var(--a-success)' : 'var(--a-danger)'}">${h.change >= 0 ? '+' : ''}${h.change}</strong>
          </div>`).join('')}
      </div>
    `,
  });
  drawer.open();
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function exportInventory() {
  const button = document.getElementById('exportBtn');
  button.disabled = true;
  button.textContent = 'Preparing CSV…';
  try {
    const { items } = await fetchInventory({ query: state.query, status: state.status, page: 1, perPage: 100000 });
    const columns = ['Product', 'Size', 'SKU', 'Stock', 'Reserved', 'Available', 'Status'];
    const rows = items.map((row) => [row.productName, row.size, row.sku, row.stock, row.reserved, row.stock - row.reserved, rowStatus(row)]);
    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    downloadCsv(csv, 'nuvanti-inventory.csv');
    showAdminToast(`Exported ${items.length} inventory row(s).`, 'success');
  } catch (error) {
    showAdminToast(`Inventory export failed: ${error.message}`, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Export CSV';
  }
}

function csvCell(value) {
  let text = String(value ?? '');
  // Prevent spreadsheet formula execution for untrusted text columns.
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(csv, filename) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
