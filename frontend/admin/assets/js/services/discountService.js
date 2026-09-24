// Admin discounts now call the same PostgreSQL API the storefront checkout
// validates codes against (backend/routes/admin.js — /api/admin/discounts).
import { API_ORIGIN as API } from '../config.js';
async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  if (response.status === 204) return true;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Discount request failed.');
  return body;
}

export async function fetchDiscounts() {
  return request('/api/admin/discounts');
}

// data: { code, type: 'percent' | 'fixed', value, minSubtotal, usageLimit, expiresAt }
// expiresAt, if present, is a date-input value ("YYYY-MM-DD") and is
// normalized to an end-of-day ISO datetime, which is what the backend
// requires.
export async function createDiscount(data) {
  return request('/api/admin/discounts', {
    method: 'POST',
    body: JSON.stringify({
      code: data.code,
      type: data.type,
      value: data.value,
      minSubtotal: data.minSubtotal || 0,
      usageLimit: data.usageLimit || undefined,
      expiresAt: data.expiresAt ? new Date(`${data.expiresAt}T23:59:59`).toISOString() : undefined,
    }),
  });
}

export async function toggleDiscountStatus(id, isActive) {
  return request(`/api/admin/discounts/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
}

export async function deleteDiscount(id) {
  return request(`/api/admin/discounts/${id}`, { method: 'DELETE' });
}
