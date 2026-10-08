import { API_ORIGIN as API } from '../config.js';
const STORAGE_KEY = 'nuvanti_last_order_v1';
export async function createOrder({ lines, customer, shipping, delivery, discountCode, paymentMethod = 'cod', createAccount }) {
  let response;
  try {
    response = await fetch(`${API}/api/orders`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lines.map((line) => ({ productId: Number(line.productId), quantity: line.quantity, color: line.color, size: line.size, image: line.image })), shipping: { name: customer.name, email: customer.email, phone: customer.phone, address1: shipping.address, city: shipping.city, locationId: shipping.locationId, country: shipping.country, postalCode: shipping.postal || 'N/A' }, delivery, paymentMethod, discountCode: discountCode || undefined, createAccount }) });
  } catch {
    throw new Error('We could not confirm whether your order was placed. Check My Orders before retrying so you do not create a duplicate.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'Unable to place this order. Please review your details and try again.');
    error.status = response.status;
    throw error;
  }
  // Use the prices and totals calculated inside the server transaction. Cart
  // data is local to this browser and may be stale after an admin price edit.
  const orderLines = (body.items || []).map((item) => ({ ...item, price: Number(item.priceCents) / 100 }));
  const subtotal = Number(body.order.subtotalCents) / 100;
  const discountAmount = (body.order.discountCents || 0) / 100;
  const shippingCost = Number(body.order.shippingCents) / 100;
  const order = { id: String(body.order.id), paymentMethod: body.order.paymentMethod || paymentMethod, paymentStatus: 'pending', paymentUrl: body.order.paymentUrl || null, transferDetails: body.order.transferDetails || null, emailDelivery: body.order.emailDelivery || { sent: false, configured: false }, isGuest: body.order.guest === true, accountCreated: body.order.accountCreated === true, orderNumber: `NV-${body.order.id}`, createdAt: body.order.createdAt, trackingUrl: body.order.trackingUrl, lines: orderLines, customer, shipping, delivery, subtotal, shippingCost, discountCode: body.order.discountCode || null, discountAmount, total: Number(body.order.totalCents) / 100, estimatedDelivery: delivery === 'express' ? '1–2 business days' : '4–7 business days' };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  return order;
}
export function getLastOrder() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; } }

export async function fetchOrderPaymentStatus(orderId, trackingUrl = null) {
  let statusUrl = `${API}/api/payments/${encodeURIComponent(orderId)}/status`;
  if (trackingUrl) {
    try {
      const url = new URL(trackingUrl, location.origin);
      const token = url.searchParams.get('token');
      if (!token || url.searchParams.get('order') !== String(orderId) || !url.pathname.endsWith('/track.html')) throw new Error('Invalid secure tracking link.');
      statusUrl = `${API}/api/orders/track/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`;
    } catch { throw new Error('Unable to check payment status securely.'); }
  }
  const response = await fetch(statusUrl, { credentials: 'include', cache: 'no-store' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to check payment status.');
  return body;
}

export async function fetchMyOrders() {
  const response = await fetch(`${API}/api/orders/mine`, { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load your orders.');
  return response.json();
}
