import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate, paginationHTML, escapeHtml } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { fetchAdminCustomers } from '../services/customerService.js';

const state = { query: '', status: '', page: 1, perPage: 10, sort: 'recent' };

const session = initAdminShell({ page: 'customers', title: 'Customers' });
if (session) init();

function init() {
  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });
  load();
}

async function load() {
  let result;
  try { result = await fetchAdminCustomers(state); }
  catch (error) { document.getElementById('custBody').innerHTML = `<tr><td colspan="7"><div class="admin-empty"><h3>Customers could not be loaded</h3><p>${escapeHtml(error.message)}</p></div></td></tr>`; return; }
  const { items, total } = result;
  document.getElementById('custBody').innerHTML = items.length ? items.map((c) => `
    <tr>
      <td><a href="customer-detail.html?id=${encodeURIComponent(c.id)}" style="font-weight:600;color:var(--a-text)">${escapeHtml(c.name)}</a></td>
      <td>${escapeHtml(c.email)}</td>
      <td>—</td>
      <td>${c.orderCount}</td>
      <td>${formatPrice(c.totalSpent)}</td>
      <td>${c.lastOrder ? formatDate(c.lastOrder) : '—'}</td>
      <td>${statusBadge(c.status)}</td>
    </tr>
  `).join('') : `<tr><td colspan="7"><div class="admin-empty"><h3>No customers found</h3></div></td></tr>`;

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
