import { API_ORIGIN } from '../config.js';

async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Unable to load store settings.');
  return body;
}

function fromApi(value) {
  return {
    general: {
      storeName: value.storeName,
      contactEmail: value.supportEmail,
      currency: value.currency,
    },
    shipping: {
      freeShippingThreshold: value.freeShippingThresholdCents / 100,
      standardCost: value.standardShippingCents / 100,
      expressCost: value.expressShippingCents / 100,
      locations: Array.isArray(value.shippingLocations) ? value.shippingLocations : [],
    },
    payments: {
      onlinePaymentEnabled: value.onlinePaymentEnabled === true,
      onlinePaymentConfigured: value.onlinePaymentConfigured === true,
      instapayEnabled: value.instapayEnabled === true,
      instapayRecipient: value.instapayRecipient || '',
      instapayWhatsappPhone: value.instapayWhatsappPhone || '',
    },
    announcement: {
      enabled: value.announcementEnabled === true,
      text: value.announcementText || 'Welcome to Nuvanti',
      backgroundColor: /^#[0-9a-f]{6}$/i.test(value.announcementBackgroundColor || '') ? value.announcementBackgroundColor : '#17251e',
      textColor: /^#[0-9a-f]{6}$/i.test(value.announcementTextColor || '') ? value.announcementTextColor : '#ffffff',
      pattern: ['solid', 'stripes', 'dots', 'checker', 'waves', 'diagonal', 'grid', 'bars', 'confetti', 'glow'].includes(value.announcementPattern) ? value.announcementPattern : 'stripes',
      theme: ['midnight', 'cream', 'citrus', 'rose', 'ocean', 'lavender', 'forest', 'mono', 'custom'].includes(value.announcementTheme) ? value.announcementTheme : 'midnight',
      speedSeconds: Number.isInteger(value.announcementSpeedSeconds) && value.announcementSpeedSeconds >= 6 && value.announcementSpeedSeconds <= 60 ? value.announcementSpeedSeconds : 26,
    },
    signupOffer: {
      enabled: value.signupOfferEnabled !== false,
      delaySeconds: Number.isInteger(value.signupOfferDelaySeconds) && value.signupOfferDelaySeconds >= 1 && value.signupOfferDelaySeconds <= 120 ? value.signupOfferDelaySeconds : 8,
      title: value.signupOfferTitle || 'Create an account and get free delivery',
      text: value.signupOfferText || 'Join Nuvanti for free delivery on your first order. Create an account or sign in to get started.',
    },
  };
}

export async function getSettings() {
  return fromApi(await request('/api/admin/settings'));
}

export async function getEmailStatus() {
  return request('/api/admin/email/status');
}

export async function sendAdminTestEmail() {
  return request('/api/admin/email/test', { method: 'POST', body: '{}' });
}

export async function saveSettingsSection(section, data) {
  const payload = section === 'general'
    ? { storeName: data.storeName, supportEmail: data.contactEmail }
    : section === 'announcement'
      ? { announcementEnabled: data.enabled, announcementText: data.text, announcementBackgroundColor: data.backgroundColor, announcementTextColor: data.textColor, announcementPattern: data.pattern, announcementTheme: data.theme, announcementSpeedSeconds: data.speedSeconds }
      : section === 'signupOffer'
        ? { signupOfferEnabled: data.enabled, signupOfferDelaySeconds: data.delaySeconds, signupOfferTitle: data.title, signupOfferText: data.text }
    : section === 'payments'
      ? { onlinePaymentEnabled: data.onlinePaymentEnabled, instapayEnabled: data.instapayEnabled, instapayRecipient: data.instapayRecipient, instapayWhatsappPhone: data.instapayWhatsappPhone }
      : section === 'shipping'
        ? { freeShippingThreshold: data.freeShippingThreshold, standardShipping: data.standardCost, expressShipping: data.expressCost, shippingLocations: data.locations }
      : {
        freeShippingThreshold: data.freeShippingThreshold,
        standardShipping: data.standardCost,
        expressShipping: data.expressCost,
      };
  return fromApi(await request('/api/admin/settings', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  }));
}
