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
              ${mainNav.map((item) => `<li${item.href.includes('collection=') ? ' data-default-menu-link' : ''}><a class="primary-nav__link${item.label.includes('SUMMER') ? ' primary-nav__link--summer' : ''}" href="${item.href}" ${isCurrent(item, currentPage) ? 'aria-current="page"' : ''}>${item.label}</a></li>`).join('')}
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });

  const refreshMenuLinks = async () => {
    const items = await fetchMenuLinks();
    const signature = JSON.stringify(items);
    [
      [document.querySelector('.primary-nav__list'), 'desktop'],
      [document.querySelector('.mobile-nav__list'), 'mobile'],
    ].forEach(([list, target]) => {
      if (!list || list.dataset.menuItemsSignature === signature) return;
      if (Array.isArray(items)) list.querySelectorAll('[data-default-menu-link]').forEach((item) => item.remove());
      list.querySelectorAll('[data-configured-menu-item]').forEach((item) => item.remove());
      if (Array.isArray(items) && items.length) {
        list.insertAdjacentHTML('beforeend', items.map((item) => renderMenuItem(item, target)).join(''));
      }
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

function renderMenuItem(item, target = 'mobile') {
  if (!['category', 'collection'].includes(item.type) || !/^[a-z0-9-]{1,80}$/.test(item.slug || '')) return '';
  const label = escapeMenuText(item.menuLabel || item.name);
  const href = `shop.html?${item.type}=${encodeURIComponent(item.slug)}`;
  const style = ['link', 'pill', 'card'].includes(item.menuStyle) ? item.menuStyle : 'pill';
  const color = /^#[0-9a-fA-F]{6}$/.test(item.menuBackgroundColor || '') ? item.menuBackgroundColor : '#35604a';
  const textColor = /^#[0-9a-fA-F]{6}$/.test(item.menuTextColor || '') ? item.menuTextColor : '#ffffff';
  const customStyle = style === 'link' ? '' : ` style="--menu-bg:${color};--menu-text:${textColor}"`;
  if (target === 'desktop') {
    return `<li data-configured-menu-item><a class="primary-nav__link primary-nav__link--configured primary-nav__link--${style}" href="${href}"${customStyle}>${label}</a></li>`;
  }
  return `<li data-configured-menu-item><a class="mobile-nav__link mobile-nav__link--${style}" href="${href}"${customStyle}>${label}</a></li>`;
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
