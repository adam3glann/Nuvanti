import { requireAdminAuth } from '../services/adminAuthService.js';
import { renderSidebar } from './sidebar.js';
import { renderAdminHeader } from './header.js';

// Apply saved theme before paint to avoid a flash.
(function applyTheme() {
  const theme = localStorage.getItem('nuvanti_admin_theme');
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
})();

export function initAdminShell({ page, title }) {
  const session = requireAdminAuth();
  if (!session) return null; // requireAdminAuth already redirected to login

  renderSidebar({ currentPage: page, role: session.role });
  renderAdminHeader({ title, session });

  return session;
}
