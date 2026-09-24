import { initAdminShell } from '../components/shell.js';
import { formatDate, escapeHtml } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { typedConfirmDialog } from '../components/confirmDialog.js';
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
  const tbody = document.getElementById('usersBody');
  let users;
  try {
    users = await fetchAdminUsers();
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="admin-empty"><h3>Couldn't load administrators</h3><p>${error.message}</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = users.map((u) => {
    const isSelf = u.email === session.email;
    return `
    <tr>
      <td style="font-weight:600">${escapeHtml(u.name)}${isSelf ? ' <span style="color:var(--a-muted);font-weight:400">(You)</span>' : ''}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${ROLE_LABELS[u.role] || u.role}</td>
      <td>${statusBadge(u.isActive ? 'active' : 'disabled')}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" data-toggle="${u.id}" ${isSelf ? 'disabled title="You cannot change your own account status"' : ''}>${u.isActive ? 'Disable' : 'Enable'}</button>
        <button class="icon-btn" data-delete="${u.id}" aria-label="Delete" ${isSelf ? 'disabled title="You cannot delete your own account"' : ''}>✕</button>
      </td>
    </tr>
  `;
  }).join('') || `<tr><td colspan="6"><div class="admin-empty"><h3>No administrators yet</h3></div></td></tr>`;

  document.querySelectorAll('[data-toggle]:not([disabled])').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      await toggleAdminUserStatus(btn.dataset.toggle);
      showAdminToast('Admin status updated.', 'success');
      load();
    } catch (error) { showAdminToast(error.message, 'error'); }
  }));
  document.querySelectorAll('[data-delete]:not([disabled])').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await typedConfirmDialog({ title: 'Delete Administrator?', body: 'This permanently removes their access to the admin dashboard. This cannot be undone.' });
    if (!ok) return;
    try {
      await deleteAdminUser(btn.dataset.delete);
      showAdminToast('Administrator deleted.', 'success');
      load();
    } catch (error) { showAdminToast(error.message, 'error'); }
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
      <p class="hint">A setup link will be emailed to this address. They'll use it to set their own password — never set one for them here.</p>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Create Administrator</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const name = modal.root.querySelector('#uName').value.trim();
    const email = modal.root.querySelector('#uEmail').value.trim();
    if (!name || !email) return;
    try {
      await createAdminUser({ name, email, role: modal.root.querySelector('#uRole').value });
      modal.close();
      showAdminToast('Administrator created — a setup email has been sent.', 'success');
      load();
    } catch (error) { showAdminToast(error.message, 'error'); }
  });
  modal.open();
}
