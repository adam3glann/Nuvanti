import { initAdminShell } from '../components/shell.js';
import { hasPermission } from '../components/permissions.js';

const session = initAdminShell({ page: 'content', title: 'Content' });
if (session) {
  const root = document.getElementById('contentRoot');
  root.innerHTML = hasPermission(session.role, 'content.manage')
    ? '<div class="admin-empty"><h1>Homepage content editor unavailable</h1><p>Homepage campaigns and FAQs are currently managed in the storefront source. This page no longer saves misleading browser-only drafts.</p></div>'
    : '<div class="admin-empty"><h1>Restricted</h1><p>You do not have permission to manage store content.</p></div>';
}
