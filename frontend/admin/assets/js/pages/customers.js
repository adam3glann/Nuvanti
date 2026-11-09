import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate, paginationHTML, escapeHtml } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { fetchAdminCustomers } from '../services/customerService.js?v=orders-load-race-3';
import { startLiveRefresh } from '../services/liveRefresh.js';

const state = { query: '', status: '', page: 1, perPage: 'all', sort: 'recent' };

const session = initAdminShell({ page: 'customers', title: 'Customers' });
if (session) init();

function init() {
  document.getElementById('searchInput').value = state.query;
  document.getElementById('statusFilter').value = state.status;
  document.getElementById('sortSelect').value = state.sort;
  document.getElementById('perPageSelect').value = state.perPage;
  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });
  document.getElementById('perPageSelect').addEventListener('change', (e) => { state.perPage = e.target.value === 'all' ? 'all' : Number(e.target.value); state.page = 1; load(); });
  load().finally(() => startLiveRefresh(() => load(true, true), 30000));
  window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
}

let loadRequestId = 0;
let activeLoadCount = 0;
async function load(showLoading = true, background = false) {
  if (background && activeLoadCount > 0) return;
  const requestId = ++loadRequestId;
  const body = document.getElementById('custBody');
  if (showLoading && !body.children.length) body.innerHTML = '<tr><td colspan="7"><div class="a-skeleton" style="height:36px"></div></td></tr>';
  let result;
  activeLoadCount += 1;
  try { result = await fetchAdminCustomers(state); }
  catch (error) { if (requestId !== loadRequestId) return; document.getElementById('custBody').innerHTML = `<tr><td colspan="7"><div class="admin-empty"><h3>Customers could not be loaded</h3><p>${escapeHtml(error.message)}</p><button class="btn btn-outline" id="retryCustomers">Try Again</button></div></td></tr>`; document.getElementById('retryCustomers')?.addEventListener('click', () => load()); return; }
  finally { activeLoadCount -= 1; }
  if (requestId !== loadRequestId) return;
  const { items, total } = result;
  document.getElementById('custBody').innerHTML = items.length ? items.map((c) => `
    <tr>
      <td><a href="${c.isGuest ? `orders.html?q=${encodeURIComponent(c.email)}` : `customer-detail.html?id=${encodeURIComponent(c.id)}`}" style="font-weight:600;color:var(--a-text)">${escapeHtml(c.name)}</a></td>
      <td>${escapeHtml(c.email)}${Number(c.matchingEmailAccounts) > 1 ? '<br /><span class="status-badge status-warning" title="Another customer account uses this email address">Possible duplicate email</span>' : ''}</td>
      <td>${c.phone ? `<a href="tel:${encodeURIComponent(c.phone)}">${escapeHtml(c.phone)}</a>` : '—'}</td>
      <td>${c.orderCount}</td>
      <td>${formatPrice(c.totalSpent)}</td>
      <td>${c.lastOrder ? formatDate(c.lastOrder) : '—'}</td>
      <td>${statusBadge(c.status)}</td>
    </tr>
  `).join('') : `<tr><td colspan="7"><div class="admin-empty"><h3>No customers found</h3></div></td></tr>`;

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage === 'all' ? Math.max(total, 1) : state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
