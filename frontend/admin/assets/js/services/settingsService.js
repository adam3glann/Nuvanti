// settingsService — MOCK ONLY. Persists to localStorage purely so toggles
// survive a page reload during a demo. Real settings must be read/written
// through an authenticated, authorized backend endpoint — never trust
// client-stored settings for anything security- or pricing-relevant.
const STORAGE_KEY = 'nuvanti_admin_settings_v1';

const DEFAULTS = {
  general: {
    storeName: 'Nuvanti', contactEmail: 'hello@nuvanti.com', phone: '+20 100 000 0000',
    currency: 'EGP', country: 'Egypt',
  },
  checkout: { guestCheckout: true, minimumOrder: 0 },
  shipping: { freeShippingThreshold: 3000, standardCost: 75, expressCost: 150 },
  payments: {
    providers: [
      { name: 'Visa / Mastercard', status: 'connected', key: 'sk_live_••••••••4471' },
      { name: 'Meeza', status: 'connected', key: 'sk_live_••••••••9902' },
      { name: 'Cash on Delivery', status: 'enabled', key: null },
      { name: 'PayPal', status: 'not_connected', key: null },
    ],
  },
  notifications: {
    orderEmails: true, shippingEmails: true, lowStockAlerts: true, adminNotifications: true,
  },
  tax: { taxEnabled: false, taxRate: 14 },
  localization: { language: 'English', timezone: 'Africa/Cairo' },
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettingsSection(section, data) {
  const current = getSettings();
  const next = { ...current, [section]: { ...current[section], ...data } };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
