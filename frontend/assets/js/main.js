import {
  renderHeader,
  refreshHeaderCounts,
} from "./components/header.js?v=store-theme-1";
import { renderFooter } from "./components/footer.js";
import { mountCartDrawer, refreshCartDrawer } from "./components/cartDrawer.js";
import { initScrollReveal } from "./components/scrollReveal.js";
import { onCartChange } from "./services/cartService.js";
import { onWishlistChange } from "./services/wishlistService.js";
import {
  loadStoreSettings,
  refreshStoreSettings,
} from "./services/storeSettingsService.js";
import { configureFreeShippingThreshold } from "./services/cartService.js";
import { startStorePresence } from "./services/presenceService.js";
import { startLiveRefresh } from "./services/liveRefresh.js";
import { applyStoreTheme } from "./services/storeThemeService.js";
import { renderAnnouncementStrip } from "./components/announcementStrip.js?v=announcement-strip-loop-2";
import { scheduleSignupOffer } from "./components/signupOffer.js?v=promo-strip-popup-1";

let currentStoreSettings = null;

function applyStoreSettings(settings) {
  const previous = currentStoreSettings;
  currentStoreSettings = settings;
  const shippingThresholdChanged =
    !previous ||
    previous.freeShippingThresholdCents !== settings.freeShippingThresholdCents;
  const signupOfferChanged =
    !previous ||
    previous.signupOfferEnabled !== settings.signupOfferEnabled ||
    previous.signupOfferDelaySeconds !== settings.signupOfferDelaySeconds ||
    previous.signupOfferTitle !== settings.signupOfferTitle ||
    previous.signupOfferText !== settings.signupOfferText;

  if (shippingThresholdChanged)
    configureFreeShippingThreshold(settings.freeShippingThresholdCents / 100);
  renderAnnouncementStrip(settings);
  if (signupOfferChanged) scheduleSignupOffer(settings);
  if (shippingThresholdChanged) refreshCartDrawer();
}

export function initShell({
  transparentHeader = false,
  currentPage = "",
} = {}) {
  applyStoreTheme();
  startStorePresence();
  renderHeader({ transparentOnHero: transparentHeader, currentPage });
  renderFooter();
  mountCartDrawer();

  onCartChange(() => {
    refreshCartDrawer();
  });
  onWishlistChange(() => {
    refreshHeaderCounts();
  });

  loadStoreSettings()
    .then((settings) => {
      applyStoreSettings(settings);
    })
    .catch((error) => console.error("Store settings unavailable:", error));
  startLiveRefresh(async () => {
    const settings = await refreshStoreSettings();
    applyStoreSettings(settings);
  }, 10000);

  window.addEventListener("load", () => initScrollReveal());
  initScrollReveal();

  // year in any inline footers
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = new Date().getFullYear();
  });
}

export { initScrollReveal };
