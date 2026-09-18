import { initAdminShell } from '../components/shell.js';
import { formatDateTime, paginationHTML, escapeHtml } from '../components/utils.js';
import { hasPermission } from '../components/permissions.js';
import { fetchAuditLogs, uniqueUsers } from '../services/auditLogService.js';

const state = { query: '', user: '', page: 1, perPage: 15 };

const session = initAdminShell({ page: 'audit', title: 'Audit Logs' });

if (session && !hasPermission(session.role, 'audit.view')) {
  document.getElementById('auditRoot').innerHTML = `<div class="admin-empty"><h3>Restricted</h3><p>You don't have permission to view audit logs.</p></div>`;
} else if (session) {
  init();
}

async function init() {
  try {
    document.getElementById('userFilter').innerHTML = `<option value="">All Admins</option>${(await uniqueUsers()).map((u) => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('')}`;
  } catch { /* filter list is a nicety; load() below will surface the real error */ }
  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('userFilter').addEventListener('change', (e) => { state.user = e.target.value; state.page = 1; load(); });
  load();
}

async function load() {
  let items, total;
  try {
    ({ items, total } = await fetchAuditLogs(state));
  } catch (error) {
    document.getElementById('auditBody').innerHTML = `<tr><td colspan="5"><div class="admin-empty"><h3>Couldn't load audit logs</h3><p>${error.message}</p></div></td></tr>`;
    return;
  }
  document.getElementById('auditBody').innerHTML = items.length ? items.map((l) => `
    <tr>
      <td>${escapeHtml(l.user)}<br /><span style="color:var(--a-muted);font-size:.72rem;text-transform:capitalize">${escapeHtml(l.role.replace('_', ' '))}</span></td>
      <td>${escapeHtml(l.action)}</td>
      <td>${escapeHtml(l.resource)}</td>
      <td>${formatDateTime(l.timestamp)}</td>
      <td class="mono" style="color:var(--a-muted)">${escapeHtml(l.ip)}</td>
    </tr>
  `).join('') : `<tr><td colspan="5"><div class="admin-empty"><h3>No matching audit entries</h3></div></td></tr>`;

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
