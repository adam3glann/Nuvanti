import crypto from 'node:crypto';
import { storePublicOrigin } from './publicOrigins.js';

const PAYMOB_API = 'https://accept.paymob.com/v1/intention/';

export function paymobReady() {
  if (!process.env.PAYMOB_SECRET_KEY || !process.env.PAYMOB_PUBLIC_KEY || !process.env.PAYMOB_HMAC_SECRET) return false;
  try { return paymentMethods().length > 0; } catch { return false; }
}

function paymentMethods() {
  const ids = String(process.env.PAYMOB_PAYMENT_METHODS || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!ids.length || ids.some((id) => !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) < 1)) throw new Error('PAYMOB_PAYMENT_METHODS must contain comma-separated integration IDs.');
  return ids.map(Number);
}

export async function createPaymobCheckout({ order, customer, shipping }) {
  if (!paymobReady()) throw new Error('Online payment is not configured yet.');
  const fullName = String(shipping.name || customer.name || 'Customer').trim().split(/\s+/);
  const firstName = fullName.shift() || 'Customer';
  const lastName = fullName.join(' ') || 'Customer';
  const response = await fetch(PAYMOB_API, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      amount: Number(order.totalCents),
      currency: 'EGP',
      payment_methods: paymentMethods(),
      billing_data: {
        apartment: 'NA', floor: 'NA', first_name: firstName.slice(0, 50), last_name: lastName.slice(0, 50),
        street: shipping.address1.slice(0, 100), building: 'NA', phone_number: String(shipping.phone || 'NA').slice(0, 30),
        city: shipping.city.slice(0, 50), country: 'EG', state: shipping.city.slice(0, 50),
        email: customer.email, postal_code: String(shipping.postalCode || 'NA').slice(0, 20),
      },
      special_reference: `NV-${order.id}`,
      expiration: 1800,
      redirection_url: `${storePublicOrigin()}/order-success.html?payment=return&order=${encodeURIComponent(order.id)}`,
      extras: { local_order_id: String(order.id) },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.client_secret || !payload.intention_order_id) {
    console.error('Paymob intention request failed:', response.status, payload.detail || payload.message || 'invalid response');
    throw new Error('The payment provider could not start checkout. Your order is saved as unpaid; contact support before trying again.');
  }
  const checkoutUrl = new URL('https://accept.paymob.com/unifiedcheckout/');
  checkoutUrl.searchParams.set('publicKey', process.env.PAYMOB_PUBLIC_KEY);
  checkoutUrl.searchParams.set('clientSecret', payload.client_secret);
  return { url: checkoutUrl.toString(), providerOrderId: String(payload.intention_order_id) };
}

const transactionFields = (obj) => [
  obj.amount_cents, obj.created_at, obj.currency, obj.error_occured, obj.has_parent_transaction,
  obj.id, obj.integration_id, obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded,
  obj.is_standalone_payment, obj.is_voided, obj.order?.id, obj.owner, obj.pending,
  obj.source_data?.pan, obj.source_data?.sub_type, obj.source_data?.type, obj.success,
];

export function verifyPaymobCallback(obj, receivedHmac) {
  const secret = process.env.PAYMOB_HMAC_SECRET;
  if (!secret || !obj || !receivedHmac || transactionFields(obj).some((value) => value === undefined || value === null)) return false;
  const actual = Buffer.from(String(receivedHmac), 'hex');
  const expected = crypto.createHmac('sha512', secret).update(transactionFields(obj).map(String).join('')).digest();
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function isConfiguredPaymobIntegration(id) {
  try { return paymentMethods().includes(Number(id)); } catch { return false; }
}
