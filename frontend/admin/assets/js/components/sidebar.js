import { icon } from './icons.js';
import { hasPermission } from './permissions.js';

const NAV = [
  { group: null, items: [{ href: 'index.html', label: 'Dashboard', icon: 'dashboard', page: 'dashboard' }] },
  {
    group: 'Store',
    items: [
      { href: 'products.html', label: 'Products', icon: 'box', page: 'products', perm: 'products.view' },
      { href: 'catalog.html?tab=categories', label: 'Categories', icon: 'tag', page: 'categories', perm: 'products.view' },
      { href: 'catalog.html?tab=collections', label: 'Collections', icon: 'layers', page: 'collections', perm: 'products.view' },
      { href: 'inventory.html', label: 'Inventory', icon: 'archive', page: 'inventory', perm: 'inventory.view' },
      { href: 'discounts.html', label: 'Discounts', icon: 'percent', page: 'discounts', perm: 'discounts.manage' },
    ],
  },
  {
    group: 'Orders',
    items: [{ href: 'orders.html', label: 'All Orders', icon: 'receipt', page: 'orders', perm: 'orders.view' }],
  },
  {
    group: 'Customers',
    items: [{ href: 'customers.html', label: 'All Customers', icon: 'users', page: 'customers', perm: 'customers.view' }],
  },
  {
    group: 'Content & Marketing',
    items: [
      { href: 'content.html', label: 'Homepage & CMS', icon: 'fileText', page: 'content', perm: 'content.manage' },
    ],
  },
  {
    group: 'Analytics',
    items: [{ href: 'analytics.html', label: 'Analytics', icon: 'chart', page: 'analytics', perm: 'analytics.view' }],
  },
  {
    group: 'Administration',
    items: [
      { href: 'users.html', label: 'Admin Users', icon: 'users', page: 'users', perm: 'admins.view' },
      { href: 'roles.html', label: 'Roles & Permissions', icon: 'shield', page: 'roles', perm: 'admins.view' },
      { href: 'audit-logs.html', label: 'Audit Logs', icon: 'clock', page: 'audit', perm: 'audit.view' },
      { href: 'security.html', label: 'Security', icon: 'key', page: 'security', perm: 'security.view' },
    ],
  },
  {
    group: 'Settings',
    items: [{ href: 'settings.html', label: 'Settings', icon: 'settings', page: 'settings', perm: 'settings.view' }],
  },
];

export function renderSidebar({ currentPage, role }) {
  const mount = document.getElementById('admin-sidebar-mount');
  if (!mount) return;

  const groupsHTML = NAV.map((g) => {
    const items = g.items.filter((it) => !it.perm || hasPermission(role, it.perm));
    if (items.length === 0) return '';
    return `
      <div class="nav-group">
        ${g.group ? `<div class="nav-group__title">${g.group}</div>` : ''}
        ${items.map((it) => `
          <a class="nav-link" href="${it.href}" ${it.page === currentPage ? 'aria-current="page"' : ''}>
            ${icon(it.icon)}<span>${it.label}</span>
          </a>`).join('')}
      </div>`;
  }).join('');

  mount.innerHTML = `
    <div class="sidebar-scrim" id="sidebarScrim"></div>
    <nav class="admin-sidebar" id="adminSidebar" aria-label="Admin navigation" data-mobile-open="false">
      <div class="admin-sidebar__brand">
        <div class="admin-sidebar__mark">N</div>
        <span>Nuvanti Admin</span>
      </div>
      <div class="admin-sidebar__nav">${groupsHTML}</div>
      <div class="admin-sidebar__foot">
        <button class="sidebar-collapse-btn" id="collapseSidebarBtn">
          ${icon('chevronLeft')}<span>Collapse</span>
        </button>
      </div>
    </nav>
  `;

  const shell = document.getElementById('adminShell');
  const collapseBtn = document.getElementById('collapseSidebarBtn');
  const collapsed = localStorage.getItem('nuvanti_admin_sidebar_collapsed') === 'true';
  if (collapsed) shell.dataset.sidebarCollapsed = 'true';

  collapseBtn.addEventListener('click', () => {
    const isCollapsed = shell.dataset.sidebarCollapsed === 'true';
    shell.dataset.sidebarCollapsed = String(!isCollapsed);
    localStorage.setItem('nuvanti_admin_sidebar_collapsed', String(!isCollapsed));
  });

  document.getElementById('sidebarScrim').addEventListener('click', closeMobileSidebar);
}

export function openMobileSidebar() {
  document.getElementById('adminSidebar')?.setAttribute('data-mobile-open', 'true');
  document.getElementById('sidebarScrim')?.setAttribute('data-open', 'true');
}
export function closeMobileSidebar() {
  document.getElementById('adminSidebar')?.setAttribute('data-mobile-open', 'false');
  document.getElementById('sidebarScrim')?.setAttribute('data-open', 'false');
}
