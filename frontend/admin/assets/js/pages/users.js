import { initAdminShell } from '../components/shell.js';
import { formatDate, formatDateTime } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog, typedConfirmDialog } from '../components/confirmDialog.js';
import { createAdminModal } from '../components/modal.js';
import { hasPermission, ROLES, ROLE_LABELS } from '../components/permissions.js';
import { fetchAdminUsers, createAdminUser, toggleAdminUserStatus, deleteAdminUser } from '../services/adminUserService.js';

const session = initAdminShell({ page: 'users', title: 'Admin Users' });

if (session && !hasPermission(session.role, 'admins.view')) {
  document.getElementById('adminUsersRoot').innerHTML = `<div class="admin-empty"><h3>Restricted</h3><p>Only Super Admins can manage administrator accounts.</p></div>`;
} else if (session) {
  init();
}

function init() {
  document.getElementById('newAdminBtn').addEventListener('click', openNewAdmin);
  load();
}

async function load() {
  const users = await fetchAdminUsers();
  document.getElementById('usersBody').innerHTML = users.map((u) => `
    <tr>
      <td style="font-weight:600">${u.name}${u.email === session.email ? ' <span style="color:var(--a-muted);font-weight:400">(You)</span>' : ''}</td>
      <td>${u.email}</td>
      <td>${ROLE_LABELS[u.role]}</td>
      <td>${statusBadge(u.status)}</td>
      <td>${u.lastLogin ? formatDateTime(u.lastLogin) : 'Never'}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" data-toggle="${u.id}" ${u.role === 'super_admin' ? 'disabled title="Cannot disable the primary Super Admin"' : ''}>${u.status === 'active' ? 'Disable' : 'Enable'}</button>
        <button class="icon-btn" data-delete="${u.id}" aria-label="Delete" ${u.role === 'super_admin' ? 'disabled' : ''}>✕</button>
      </td>
    </tr>
  `).join('');

  document.querySelectorAll('[data-toggle]:not([disabled])').forEach((btn) => btn.addEventListener('click', async () => {
    await toggleAdminUserStatus(btn.dataset.toggle);
    showAdminToast('Admin status updated.', 'success');
    load();
  }));
  document.querySelectorAll('[data-delete]:not([disabled])').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await typedConfirmDialog({ title: 'Delete Administrator?', body: 'This permanently removes their access to the admin dashboard. This cannot be undone.' });
    if (!ok) return;
    await deleteAdminUser(btn.dataset.delete);
    showAdminToast('Administrator deleted.', 'success');
    load();
  }));
}

function openNewAdmin() {
  const modal = createAdminModal({
    title: 'Create Administrator',
    bodyHTML: `
      <div class="field"><label>Full Name</label><input id="uName" /></div>
      <div class="field"><label>Email</label><input type="email" id="uEmail" /></div>
      <div class="field"><label>Role</label>
        <select id="uRole">${ROLES.filter((r) => r !== 'super_admin').map((r) => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join('')}</select>
      </div>
      <p class="hint">A temporary password and setup link will be emailed once this connects to a real backend. Never set passwords directly from this UI.</p>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Create Administrator</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const name = modal.root.querySelector('#uName').value.trim();
    const email = modal.root.querySelector('#uEmail').value.trim();
    if (!name || !email) return;
    await createAdminUser({ name, email, role: modal.root.querySelector('#uRole').value });
    modal.close();
    showAdminToast('Administrator created.', 'success');
    load();
  });
  modal.open();
}
