import { API_ORIGIN } from '../config.js';

const DEFAULTS = Object.freeze({
  storeName: 'Nuvanti', currency: 'EGP', standardShippingCents: 7500,
  expressShippingCents: 15000, freeShippingThresholdCents: 300000,
});
let settingsPromise;

export function loadStoreSettings() {
  if (!settingsPromise) {
    settingsPromise = fetch(`${API_ORIGIN}/api/storefront/settings`)
      .then((response) => {
        if (!response.ok) throw new Error('Store settings are unavailable.');
        return response.json();
      })
      .catch((error) => {
        settingsPromise = null;
        if (['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:') return DEFAULTS;
        throw error;
      });
  }
  return settingsPromise;
}

export { DEFAULTS as DEFAULT_STORE_SETTINGS };
