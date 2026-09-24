import { API_ORIGIN } from '../config.js';

async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    credentials: 'include',
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
    },
  };
}

export async function getSettings() {
  return fromApi(await request('/api/admin/settings'));
}

export async function saveSettingsSection(section, data) {
  const payload = section === 'general'
    ? { storeName: data.storeName, supportEmail: data.contactEmail }
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
