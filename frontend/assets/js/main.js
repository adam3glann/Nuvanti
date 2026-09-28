import { renderHeader, refreshHeaderCounts } from './components/header.js';
import { renderFooter } from './components/footer.js';
import { mountCartDrawer, refreshCartDrawer } from './components/cartDrawer.js';
import { mountSearchOverlay } from './components/searchOverlay.js';
import { initScrollReveal } from './components/scrollReveal.js';
import { onCartChange } from './services/cartService.js';
import { onWishlistChange } from './services/wishlistService.js';
import { loadStoreSettings, refreshStoreSettings } from './services/storeSettingsService.js';
import { configureFreeShippingThreshold } from './services/cartService.js';
import { startStorePresence } from './services/presenceService.js';
import { startLiveRefresh } from './services/liveRefresh.js';

export function initShell({ transparentHeader = false, currentPage = '' } = {}) {
  startStorePresence();
  renderHeader({ transparentOnHero: transparentHeader, currentPage });
  renderFooter();
  mountCartDrawer();
  mountSearchOverlay();

  onCartChange(() => { refreshCartDrawer(); });
  onWishlistChange(() => { refreshHeaderCounts(); });

  loadStoreSettings().then((settings) => {
    configureFreeShippingThreshold(settings.freeShippingThresholdCents / 100);
    refreshCartDrawer();
  }).catch((error) => console.error('Store settings unavailable:', error));
  startLiveRefresh(async () => {
    const settings = await refreshStoreSettings();
    configureFreeShippingThreshold(settings.freeShippingThresholdCents / 100);
    refreshCartDrawer();
  }, 10000);

  window.addEventListener('load', () => initScrollReveal());
  initScrollReveal();

  // year in any inline footers
  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
}

export { initScrollReveal };
