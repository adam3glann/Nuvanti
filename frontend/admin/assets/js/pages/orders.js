import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate, paginationHTML } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { fetchAdminOrders } from '../services/orderService.js';

const session = initAdminShell({ page: 'orders', title: 'Orders' });
if (session) init();

const params = new URLSearchParams(location.search);
const state = { query: params.get('q') || '', status: params.get('status') || '', payment: '', page: 1, perPage: 10, sort: 'newest' };

function init() {
  document.getElementById('searchInput').value = state.query;
  document.getElementById('statusFilter').value = state.status;

  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById('paymentFilter').addEventListener('change', (e) => { state.payment = e.target.value; state.page = 1; load(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });
  load();
}

async function load() {
  const tbody = document.getElementById('ordersBody');
  tbody.innerHTML = `<tr><td colspan="7"><div class="a-skeleton" style="height:36px"></div></td></tr>`;
  const { items, total } = await fetchAdminOrders(state);

  tbody.innerHTML = items.length ? items.map((o) => `
    <tr>
      <td><a class="mono" href="order-detail.html?id=${o.id}" style="color:var(--a-primary);font-weight:600">${o.id}</a></td>
      <td>${o.customer.name}<br /><span style="color:var(--a-muted);font-size:.76rem">${o.customer.email}</span></td>
      <td>${formatDate(o.createdAt)}</td>
      <td>${o.items.reduce((s, i) => s + i.quantity, 0)} items</td>
      <td>${formatPrice(o.total)}</td>
      <td>${statusBadge(o.paymentStatus)}</td>
      <td>${statusBadge(o.status)}</td>
    </tr>
  `).join('') : `<tr><td colspan="7"><div class="admin-empty"><h3>No orders found</h3><p>Try a different search or filter.</p></div></td></tr>`;

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
