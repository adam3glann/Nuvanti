import { API_ORIGIN } from "../config.js";

const DEFAULTS = Object.freeze({
  storeName: "Nuvanti",
  logoUrl: "assets/img/brand/NUVANTI Star Logo.png",
  sizeAdvisorFields: {
    height: { enabled: true, label: "Height (cm)", placeholder: "e.g. 168" },
    weight: { enabled: true, label: "Weight (kg)", placeholder: "e.g. 62" },
  },
  currency: "EGP",
  standardShippingCents: 7500,
  expressShippingCents: 15000,
  freeShippingThresholdCents: 300000,
  announcementEnabled: false,
  announcementText: "Welcome to Nuvanti",
  announcementBackgroundColor: "#17251e",
  announcementTextColor: "#ffffff",
  announcementPattern: "stripes",
  announcementTheme: "midnight",
  announcementSpeedSeconds: 26,
});
let settingsPromise;

function normalizeSizeAdvisorFields(value) {
  const saved = value || {};
  const defaults = DEFAULTS.sizeAdvisorFields;
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    const field = saved[key] || fallback;
    return [key, {
      enabled: field.enabled !== false,
      label: typeof field.label === "string" && field.label.trim() ? field.label : fallback.label,
      placeholder: typeof field.placeholder === "string" ? field.placeholder : fallback.placeholder,
    }];
  }));
}

export function loadStoreSettings() {
  if (!settingsPromise) {
    settingsPromise = fetch(`${API_ORIGIN}/api/storefront/settings`, {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Store settings are unavailable.");
        return response.json();
      })
      .then((settings) => ({
        ...settings,
        sizeAdvisorFields: normalizeSizeAdvisorFields(settings.sizeAdvisorFields),
      }))
      .catch((error) => {
        settingsPromise = null;
        if (
          ["localhost", "127.0.0.1"].includes(location.hostname) ||
          location.protocol === "file:"
        )
          return DEFAULTS;
        throw error;
      });
  }
  return settingsPromise;
}

export async function refreshStoreSettings() {
  settingsPromise = null;
  return loadStoreSettings();
}

export { DEFAULTS as DEFAULT_STORE_SETTINGS };
