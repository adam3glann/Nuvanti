import { icon } from './icons.js';
import { ROLE_LABELS } from './permissions.js';
import { getNotifications, unreadCount, markAllRead } from '../services/notificationService.js';
import { adminLogout } from '../services/adminAuthService.js';
import { openMobileSidebar } from './sidebar.js';

export function renderAdminHeader({ title, session }) {
  const mount = document.getElementById('admin-header-mount');
  if (!mount) return;

  const initials = session.name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  mount.innerHTML = `
    <header class="admin-header">
      <div class="admin-header__left">
        <button class="icon-btn admin-hamburger" id="adminHamburger" aria-label="Open menu">${icon('menu')}</button>
        <div class="admin-breadcrumbs"><strong>${title}</strong></div>
      </div>
      <div class="admin-search">
        ${icon('search')}
        <input type="search" id="globalSearch" placeholder="Search orders, products, customers, SKUs…" />
      </div>
      <div class="admin-header__right">
        <button class="icon-btn" id="themeToggle" aria-label="Toggle dark mode">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
        <div class="rel">
          <button class="icon-btn" id="notifBtn" aria-label="Notifications" aria-haspopup="true">
            ${icon('bell')}
            ${unreadCount() > 0 ? '<span class="notif-dot"></span>' : ''}
          </button>
          <div class="popover popover-wide" id="notifPopover">
            <div class="popover-head" style="display:flex;justify-content:space-between;align-items:center">
              <span>Notifications</span>
              <button class="btn-ghost" id="markAllReadBtn" style="font-size:.72rem;font-weight:600">Mark all read</button>
            </div>
            <div id="notifList"></div>
          </div>
        </div>
        <div class="rel">
          <button class="user-menu-btn" id="userMenuBtn" aria-haspopup="true">
            <span class="avatar">${initials}</span>
            ${icon('chevronDown')}
          </button>
          <div class="popover" id="userPopover">
            <div class="popover-head">${session.name}<br /><span style="font-weight:400;color:var(--a-muted);font-size:.75rem">${ROLE_LABELS[session.role]}</span></div>
            <a class="popover-item" href="security.html">Security</a>
            <a class="popover-item" href="settings.html">Settings</a>
            <button class="popover-item" id="logoutBtn" style="width:100%;text-align:left;color:var(--a-danger)">Log Out</button>
          </div>
        </div>
      </div>
    </header>
  `;

  renderNotifList();

  document.getElementById('adminHamburger')?.addEventListener('click', openMobileSidebar);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  bindPopover('notifBtn', 'notifPopover');
  bindPopover('userMenuBtn', 'userPopover');

  document.getElementById('markAllReadBtn').addEventListener('click', () => { markAllRead(); renderNotifList(); document.getElementById('notifBtn').querySelector('.notif-dot')?.remove(); });
  document.getElementById('logoutBtn').addEventListener('click', () => { adminLogout(); location.href = 'login.html'; });

  document.getElementById('globalSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      location.href = `products.html?q=${encodeURIComponent(e.target.value.trim())}`;
    }
  });
}

function renderNotifList() {
  const el = document.getElementById('notifList');
  const notifs = getNotifications();
  el.innerHTML = notifs.length
    ? notifs.map((n) => `
      <a class="notif-item" href="${n.link}" data-unread="${n.unread}">
        <span class="notif-dot-inline" style="${n.unread ? '' : 'visibility:hidden'}"></span>
        <div><p class="notif-item__title">${n.title}</p><p class="notif-item__time">${timeAgo(n.time)}</p></div>
      </a>`).join('')
    : `<p style="padding:1rem;color:var(--a-muted);font-size:.82rem">You're all caught up.</p>`;
}

function bindPopover(btnId, popId) {
  const btn = document.getElementById(btnId);
  const pop = document.getElementById(popId);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = pop.dataset.open !== 'true';
    document.querySelectorAll('.popover').forEach((p) => (p.dataset.open = 'false'));
    pop.dataset.open = String(willOpen);
  });
  document.addEventListener('click', () => { pop.dataset.open = 'false'; });
  pop.addEventListener('click', (e) => e.stopPropagation());
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.dataset.theme === 'dark' ? 'light' : 'dark';
  if (next === 'dark') html.dataset.theme = 'dark'; else delete html.dataset.theme;
  localStorage.setItem('nuvanti_admin_theme', next);
  const btn = document.getElementById('themeToggle');
  btn.innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
