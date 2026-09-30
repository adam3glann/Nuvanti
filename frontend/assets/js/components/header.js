import { icon } from './icons.js';
import { mainNav } from '../data/navigation.js';
import { cartCount } from '../services/cartService.js';
import { getWishlist } from '../services/wishlistService.js';
import { openCartDrawer } from './cartDrawer.js';
import { openSearchOverlay } from './searchOverlay.js';
import { fetchMenuLinks } from '../services/productService.js';
import { startLiveRefresh } from '../services/liveRefresh.js';

export function renderHeader({ transparentOnHero = false, currentPage = '' } = {}) {
  const mount = document.getElementById('site-header');
  if (!mount) return;

  mount.innerHTML = `
    <header class="site-header ${transparentOnHero ? 'is-transparent' : ''}" id="siteHeader">
      <div class="container site-header__inner">
        <div class="site-header__side">
          <button class="icon-btn hamburger" id="openMobileNav" aria-label="Open menu" aria-expanded="false" aria-controls="mobileNav">
            ${icon('menu')}
          </button>
          <nav class="primary-nav" aria-label="Main">
            <ul class="primary-nav__list">
              ${mainNav.map((item) => `<li><a class="primary-nav__link${item.label.includes('SUMMER') ? ' primary-nav__link--summer' : ''}" href="${item.href}" ${isCurrent(item, currentPage) ? 'aria-current="page"' : ''}>${item.label}</a></li>`).join('')}
            </ul>
          </nav>
        </div>
        <a href="index.html" class="site-logo" aria-label="Nuvanti — Home"><img src="assets/img/brand/nuvanti-logo.png" alt="Nuvanti" class="site-logo__mark" id="headerLogoImg" /></a>
        <div class="site-header__side site-header__side--end">
          <button class="icon-btn" id="openSearch" aria-label="Search">${icon('search')}</button>
          <a class="icon-btn" href="account.html" aria-label="Account">${icon('user')}</a>
          <a class="icon-btn" href="wishlist.html" aria-label="Wishlist" style="position:relative">
            ${icon('heart')}
            <span class="cart-count" id="wishlistCount" style="display:none">0</span>
          </a>
          <button class="icon-btn" id="openCart" aria-label="Open cart" style="position:relative">
            ${icon('bag')}
            <span class="cart-count" id="cartCount" style="display:none">0</span>
          </button>
        </div>
      </div>
    </header>

    <div class="scrim" id="navScrim"></div>

    <nav class="mobile-nav" id="mobileNav" aria-label="Mobile" data-open="false">
      <div class="mobile-nav__top">
        <a href="index.html" class="site-logo" aria-label="Nuvanti — Home"><img src="assets/img/brand/nuvanti-logo.png" alt="Nuvanti" class="site-logo__mark" /></a>
        <button class="icon-btn" id="closeMobileNav" aria-label="Close menu">${icon('close')}</button>
      </div>
      <ul class="mobile-nav__list">
        ${mainNav.filter((item) => !item.href.includes('collection=')).map((item) => `<li><a class="mobile-nav__link" href="${item.href}">${item.label}</a></li>`).join('')}
        ${renderMenuGroup('collection', 'Collections')}
        ${renderMenuGroup('category', 'Categories')}
      </ul>
      <div class="mobile-nav__foot">
        <a href="account.html" class="btn btn-outline btn-block">Account</a>
        <a href="wishlist.html" class="btn btn-text">Wishlist</a>
      </div>
    </nav>
  `;

  const header = document.getElementById('siteHeader');
  const mobileNav = document.getElementById('mobileNav');
  const scrim = document.getElementById('navScrim');

  function openNav() {
    mobileNav.dataset.open = 'true';
    scrim.dataset.open = 'true';
    document.getElementById('openMobileNav').setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeNav() {
    mobileNav.dataset.open = 'false';
    scrim.dataset.open = 'false';
    document.getElementById('openMobileNav').setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
  document.getElementById('openMobileNav').addEventListener('click', openNav);
  document.getElementById('closeMobileNav').addEventListener('click', closeNav);
  scrim.addEventListener('click', closeNav);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeNav();
    document.querySelectorAll('[data-menu-group][data-open="true"]').forEach((group) => {
      group.dataset.open = 'false';
      group.querySelector('[data-menu-group-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-menu-group]')) return;
    document.querySelectorAll('[data-menu-group][data-open="true"]').forEach((group) => {
      group.dataset.open = 'false';
      group.querySelector('[data-menu-group-toggle]')?.setAttribute('aria-expanded', 'false');
    });
  });
  document.querySelectorAll('[data-menu-group-toggle]').forEach((button) => button.addEventListener('click', () => {
    const group = button.closest('[data-menu-group]');
    const isOpen = group.dataset.open === 'true';
    group.dataset.open = String(!isOpen);
    button.setAttribute('aria-expanded', String(!isOpen));
  }));

  const refreshMenuLinks = async () => {
    const items = await fetchMenuLinks();
    const signature = JSON.stringify(items);
    syncPrimaryCollectionStyles(items);
    [
      ['collection', 'mobile'], ['category', 'mobile'],
    ].forEach(([type, target]) => {
      const group = document.querySelector(`[data-menu-group="${type}"][data-menu-target="${target}"]`);
      const list = group?.querySelector('[data-menu-items]');
      if (!list || list.dataset.menuItemsSignature === signature) return;
      if (Array.isArray(items)) list.querySelectorAll('[data-default-menu-link]').forEach((item) => item.remove());
      list.querySelectorAll('[data-configured-menu-item]').forEach((item) => item.remove());
      const groupItems = Array.isArray(items) ? items.filter((item) => item.type === type) : [];
      if (groupItems.length) {
        list.insertAdjacentHTML('beforeend', groupItems.map(renderMenuItem).join(''));
      }
      group.hidden = Array.isArray(items) && groupItems.length === 0;
      list.dataset.menuItemsSignature = signature;
    });
  };
  refreshMenuLinks().catch((error) => console.warn('Store menu links unavailable:', error));
  startLiveRefresh(refreshMenuLinks, 15000);

  document.getElementById('openCart').addEventListener('click', () => openCartDrawer());
  document.getElementById('openSearch').addEventListener('click', () => openSearchOverlay());

  const logoImg = document.getElementById('headerLogoImg');
  if (transparentOnHero) {
    const onScroll = () => {
      const scrolled = window.scrollY > 40;
      header.classList.toggle('is-scrolled', scrolled);
      if (logoImg) logoImg.src = scrolled ? 'assets/img/brand/nuvanti-logo.png' : 'assets/img/brand/nuvanti-logo-white.png';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  } else {
    header.classList.add('is-scrolled');
  }

  refreshHeaderCounts();
}

function syncPrimaryCollectionStyles(items) {
  const collections = new Map((Array.isArray(items) ? items : [])
    .filter((item) => item.type === 'collection')
    .map((item) => [item.slug, item]));
  document.querySelectorAll('.primary-nav__link[href*="collection="]').forEach((link) => {
    const slug = new URL(link.href, window.location.href).searchParams.get('collection');
    const item = collections.get(slug);
    const label = link.dataset.baseMenuLabel || (link.dataset.baseMenuLabel = link.textContent.trim());
    const glyph = getMenuGlyph(item?.menuIcon);
    const animation = ['ice', 'pulse', 'float'].includes(item?.menuAnimation) ? item.menuAnimation : 'none';
    link.classList.remove('menu-effect--ice', 'menu-effect--pulse', 'menu-effect--float');
    link.classList.remove('menu-style--pill', 'menu-style--card', 'menu-style--outline', 'menu-style--soft', 'menu-style--glass');
    if (animation !== 'none') link.classList.add(`menu-effect--${animation}`);
    link.innerHTML = `<span class="menu-button__content">${glyph ? `<span class="menu-button__icon" aria-hidden="true">${glyph}</span>` : ''}<span class="menu-button__label">${escapeMenuText(label)}</span></span>`;
    ['background', 'color', 'border-radius', 'padding', '--menu-bg', '--menu-bg-start', '--menu-bg-end', '--menu-text'].forEach((property) => link.style.removeProperty(property));
    const style = ['pill', 'card', 'outline', 'soft', 'glass'].includes(item?.menuStyle) ? item.menuStyle : 'link';
    if (style === 'link') return;

    const start = /^#[0-9a-fA-F]{6}$/.test(item.menuBackgroundColor || '') ? item.menuBackgroundColor : '#35604a';
    const end = /^#[0-9a-fA-F]{6}$/.test(item.menuBackgroundEndColor || '') ? item.menuBackgroundEndColor : null;
    const background = end ? `linear-gradient(110deg,${start},${end})` : start;
    const text = /^#[0-9a-fA-F]{6}$/.test(item.menuTextColor || '') ? item.menuTextColor : '#ffffff';
    link.classList.add(`menu-style--${style}`);
    link.style.setProperty('--menu-bg', background);
    link.style.setProperty('--menu-bg-start', start);
    link.style.setProperty('--menu-bg-end', end || start);
    link.style.setProperty('--menu-text', text);
    link.style.setProperty('color', style === 'soft' ? start : text, 'important');
    link.style.borderRadius = style === 'card' ? '10px' : '999px';
    link.style.padding = '.45rem 1rem';
  });
}

function renderMenuGroup(type, label) {
  const staticCollections = type === 'collection'
    ? mainNav.filter((item) => item.href.includes('collection=')).map((item) => {
      const className = item.label.includes('SUMMER') ? ' mobile-nav__link--summer' : '';
      return `<li data-default-menu-link><a class="mobile-nav__link${className}" href="${item.href}">${item.label}</a></li>`;
    }).join('')
    : '';
  return `<li class="mobile-nav__group" data-menu-group="${type}" data-menu-target="mobile"${type === 'category' ? ' hidden' : ''}>
    <button type="button" class="mobile-nav__group-toggle" data-menu-group-toggle aria-controls="mobile-${type}-submenu" aria-expanded="false">${label}<span aria-hidden="true">⌄</span></button>
    <ul class="mobile-nav__submenu" id="mobile-${type}-submenu" data-menu-items>${staticCollections}</ul>
  </li>`;
}

function renderMenuItem(item) {
  if (!['category', 'collection'].includes(item.type) || !/^[a-z0-9-]{1,80}$/.test(item.slug || '')) return '';
  const label = escapeMenuText(item.menuLabel || item.name);
  const href = `shop.html?${item.type}=${encodeURIComponent(item.slug)}`;
  const style = ['link', 'pill', 'card', 'outline', 'soft', 'glass'].includes(item.menuStyle) ? item.menuStyle : 'pill';
  const color = /^#[0-9a-fA-F]{6}$/.test(item.menuBackgroundColor || '') ? item.menuBackgroundColor : '#35604a';
  const endColor = /^#[0-9a-fA-F]{6}$/.test(item.menuBackgroundEndColor || '') ? item.menuBackgroundEndColor : null;
  const textColor = /^#[0-9a-fA-F]{6}$/.test(item.menuTextColor || '') ? item.menuTextColor : '#ffffff';
  const background = endColor ? `linear-gradient(110deg,${color},${endColor})` : color;
  const customStyle = style === 'link' ? '' : ` style="--menu-bg:${background};--menu-bg-start:${color};--menu-bg-end:${endColor || color};--menu-text:${textColor}"`;
  const glyph = getMenuGlyph(item.menuIcon);
  const animation = ['ice', 'pulse', 'float'].includes(item.menuAnimation) ? ` menu-effect--${item.menuAnimation}` : '';
  const design = style === 'link' ? '' : ` menu-style--${style}`;
  return `<li data-configured-menu-item><a class="mobile-nav__link mobile-nav__link--${style}${design}${animation}" href="${href}"${customStyle}><span class="menu-button__content">${glyph ? `<span class="menu-button__icon" aria-hidden="true">${glyph}</span>` : ''}<span class="menu-button__label">${label}</span></span></a></li>`;
}

function getMenuGlyph(name) {
  return ({ sparkle: '✦', star: '★', heart: '♥', arrow: '→' })[name] || '';
}

function escapeMenuText(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function refreshHeaderCounts() {
  const cartEl = document.getElementById('cartCount');
  const wishEl = document.getElementById('wishlistCount');
  if (cartEl) {
    const n = cartCount();
    cartEl.textContent = String(n);
    cartEl.style.display = n > 0 ? 'flex' : 'none';
  }
  if (wishEl) {
    const n = getWishlist().length;
    wishEl.textContent = String(n);
    wishEl.style.display = n > 0 ? 'flex' : 'none';
  }
}

function isCurrent(item, currentPage) {
  return currentPage && item.href.startsWith(currentPage);
}
