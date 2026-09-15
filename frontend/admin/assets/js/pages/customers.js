import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate, paginationHTML } from '../components/utils.js';
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
  const { items, total } = await fetchAdminCustomers(state);
  document.getElementById('custBody').innerHTML = items.length ? items.map((c) => `
    <tr>
      <td><a href="customer-detail.html?id=${c.id}" style="font-weight:600;color:var(--a-text)">${c.name}</a></td>
      <td>${c.email}</td>
      <td>${c.phone}</td>
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
