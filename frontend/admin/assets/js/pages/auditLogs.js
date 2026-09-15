import { initAdminShell } from '../components/shell.js';
import { formatDateTime, paginationHTML } from '../components/utils.js';
import { hasPermission } from '../components/permissions.js';
import { fetchAuditLogs, uniqueUsers } from '../services/auditLogService.js';

const state = { query: '', user: '', page: 1, perPage: 15 };

const session = initAdminShell({ page: 'audit', title: 'Audit Logs' });

if (session && !hasPermission(session.role, 'audit.view')) {
  document.getElementById('auditRoot').innerHTML = `<div class="admin-empty"><h3>Restricted</h3><p>You don't have permission to view audit logs.</p></div>`;
} else if (session) {
  init();
}

function init() {
  document.getElementById('userFilter').innerHTML = `<option value="">All Admins</option>${uniqueUsers().map((u) => `<option value="${u}">${u}</option>`).join('')}`;
  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('userFilter').addEventListener('change', (e) => { state.user = e.target.value; state.page = 1; load(); });
  load();
}

async function load() {
  const { items, total } = await fetchAuditLogs(state);
  document.getElementById('auditBody').innerHTML = items.length ? items.map((l) => `
    <tr>
      <td>${l.user}<br /><span style="color:var(--a-muted);font-size:.72rem;text-transform:capitalize">${l.role.replace('_', ' ')}</span></td>
      <td>${l.action}</td>
      <td>${l.resource}</td>
      <td>${formatDateTime(l.timestamp)}</td>
      <td class="mono" style="color:var(--a-muted)">${l.ip}</td>
    </tr>
  `).join('') : `<tr><td colspan="5"><div class="admin-empty"><h3>No matching audit entries</h3></div></td></tr>`;

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
