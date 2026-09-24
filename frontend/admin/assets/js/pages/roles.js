import { initAdminShell } from '../components/shell.js';
import { hasPermission, permissionGroups, ROLES, ROLE_LABELS } from '../components/permissions.js';

const session = initAdminShell({ page: 'roles', title: 'Roles & Permissions' });

if (session && !hasPermission(session.role, 'admins.view')) {
  document.getElementById('rolesRoot').innerHTML = `<div class="admin-empty"><h3>Restricted</h3><p>Only Super Admins can view role configuration.</p></div>`;
} else if (session) {
  render();
}

function render() {
  const groups = permissionGroups();
  const root = document.getElementById('rolesRoot');
  root.innerHTML = Object.entries(groups).map(([group, perms]) => `
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-head"><h2>${group}</h2></div>
      <div class="table-wrap">
        <table class="perm-matrix">
          <thead><tr><th>Permission</th>${ROLES.map((r) => `<th>${ROLE_LABELS[r]}</th>`).join('')}</tr></thead>
          <tbody>
            ${perms.map((p) => `
              <tr>
                <td>${p.split('.')[1][0].toUpperCase() + p.split('.')[1].slice(1)}</td>
                ${ROLES.map((r) => `<td><input type="checkbox" class="perm-check" ${hasPermission(r, p) ? 'checked' : ''} disabled /></td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `).join('') + `
    <p style="color:var(--a-muted);font-size:.8rem">Permissions are a fixed server policy and cannot be edited here. Each permission shown is enforced by the API whenever a protected action is requested.</p>
  `;
}
