import { API_ORIGIN as API } from '../config.js';
const STORAGE_KEY = 'nuvanti_last_order_v1';
export async function createOrder({ lines, customer, shipping, delivery, discountCode }) {
  const response = await fetch(`${API}/api/orders`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lines.map((line) => ({ productId: Number(line.productId), quantity: line.quantity, color: line.color, size: line.size, image: line.image })), shipping: { name: customer.name, phone: customer.phone, address1: shipping.address, city: shipping.city, country: shipping.country, postalCode: shipping.postal || 'N/A' }, delivery, discountCode: discountCode || undefined }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to place this order. Please sign in and try again.');
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const discountAmount = (body.order.discountCents || 0) / 100;
  const shippingCost = body.order.totalCents / 100 - subtotal + discountAmount;
  const order = { orderNumber: `NV-${body.order.id}`, createdAt: body.order.createdAt, trackingUrl: body.order.trackingUrl, lines, customer, shipping, delivery, subtotal, shippingCost, discountCode: body.order.discountCode || null, discountAmount, total: body.order.totalCents / 100, estimatedDelivery: delivery === 'express' ? '1–2 business days' : '4–7 business days' };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  return order;
}
export function getLastOrder() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; } }

export async function fetchMyOrders() {
  const response = await fetch(`${API}/api/orders/mine`, { credentials: 'include' });
  if (!response.ok) throw new Error('Unable to load your orders.');
  return response.json();
}
