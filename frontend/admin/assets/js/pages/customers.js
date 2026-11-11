import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate, paginationHTML, escapeHtml } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { fetchAdminCustomers } from '../services/customerService.js?v=customers-autoload-skeleton-4';
import { startLiveRefresh } from '../services/liveRefresh.js';

const state = { query: '', status: '', page: 1, perPage: 50, sort: 'recent' };

const session = initAdminShell({ page: 'customers', title: 'Customers' });
if (session) init();

function init() {
  document.getElementById('searchInput').value = state.query;
  document.getElementById('statusFilter').value = state.status;
  document.getElementById('sortSelect').value = state.sort;
  document.getElementById('perPageSelect').value = String(state.perPage);
  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });
  document.getElementById('perPageSelect').addEventListener('change', (e) => { state.perPage = Number(e.target.value); state.page = 1; load(); });
  requestAnimationFrame(() => {
    load().finally(() => startLiveRefresh(() => load(true, true), 30000));
  });
  window.addEventListener('pageshow', (event) => { if (event.persisted) load(); });
}

let loadRequestId = 0;
let activeLoadCount = 0;
let initialLoadComplete = false;
let initialRetryCount = 0;
async function load(showLoading = true, background = false) {
  if (background && activeLoadCount > 0) return;
  const requestId = ++loadRequestId;
  const body = document.getElementById('custBody');
  body.setAttribute('aria-busy', 'true');
  if (showLoading && !body.querySelector('tr a')) body.innerHTML = tableSkeleton(7, 6);
  let result;
  activeLoadCount += 1;
  try { result = await fetchAdminCustomers(state); }
  catch (error) {
    if (requestId !== loadRequestId) return;
    const retryable = !error.status || error.status === 408 || error.status === 429 || error.status >= 500;
    if (!initialLoadComplete && retryable && initialRetryCount < 2) {
      const delay = 600 * (2 ** initialRetryCount++);
      window.setTimeout(() => load(), delay);
      return;
    }
    body.innerHTML = `<tr><td colspan="7"><div class="admin-empty"><h3>Customers could not be loaded</h3><p>${escapeHtml(error.message)}</p><button class="btn btn-outline" id="retryCustomers">Try Again</button></div></td></tr>`;
    body.setAttribute('aria-busy', 'false');
    document.getElementById('retryCustomers')?.addEventListener('click', () => load());
    return;
  }
  finally { activeLoadCount -= 1; }
  if (requestId !== loadRequestId) return;
  initialLoadComplete = true;
  const { items, total } = result;
  body.setAttribute('aria-busy', 'false');
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

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

function tableSkeleton(columns, rows) {
  return Array.from({ length: rows }, () => `<tr data-skeleton="true" aria-hidden="true">${Array.from({ length: columns }, (_, index) =>
    `<td><div class="a-skeleton" style="height:14px;width:${index === 0 ? '72%' : index === 1 ? '82%' : '58%'}"></div></td>`,
  ).join('')}</tr>`).join('');
}
