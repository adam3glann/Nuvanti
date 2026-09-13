import { renderHeader, refreshHeaderCounts } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { mountCartDrawer, refreshCartDrawer } from './components/cartDrawer.js';
import { mountSearchOverlay } from './components/searchOverlay.js';
import { initScrollReveal } from './components/scrollReveal.js';
import { onCartChange } from './services/cartService.js';
import { onWishlistChange } from './services/wishlistService.js';

export function initShell({ transparentHeader = false, currentPage = '' } = {}) {
  renderHeader({ transparentOnHero: transparentHeader, currentPage });
  renderFooter();
  mountCartDrawer();
  mountSearchOverlay();

  onCartChange(() => { refreshCartDrawer(); });
  onWishlistChange(() => { refreshHeaderCounts(); });

  window.addEventListener('load', () => initScrollReveal());
  initScrollReveal();

  // year in any inline footers
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

export { initScrollReveal };
