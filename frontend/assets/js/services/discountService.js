// discountService — validates a discount code against the real PostgreSQL
// backend (see backend/routes/orders.js: POST /api/orders/validate-discount).
// The code itself is remembered in sessionStorage so it survives the
// cart.html -> checkout.html hop, but the amount is always re-checked
// against the live cart subtotal rather than cached, since it can change
// between pages (and usage limits/expiry can change on the backend too).
import { API_ORIGIN as API } from '../config.js';
const STORAGE_KEY = 'nuvanti_discount_code_v1';

export async function checkDiscount(code, subtotal) {
  const response = await fetch(`${API}/api/orders/validate-discount`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'That code is not valid.');
  return body; // { code, type, value, discountCents }
}

export function getSavedDiscountCode() {
  return sessionStorage.getItem(STORAGE_KEY) || null;
}
export function saveDiscountCode(code) {
  sessionStorage.setItem(STORAGE_KEY, code);
}
export function clearDiscountCode() {
  sessionStorage.removeItem(STORAGE_KEY);
}
