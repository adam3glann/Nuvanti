const API = window.NUVANTI_API_URL || `${location.protocol}//${location.hostname}:4000`;
const STORAGE_KEY = 'nuvanti_last_order_v1';
export async function createOrder({ lines, customer, shipping, delivery }) {
  const response = await fetch(`${API}/api/orders`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: lines.map((line) => ({ productId: Number(line.productId), quantity: line.quantity })), shipping: { name: customer.name, address1: shipping.address, city: shipping.city, country: shipping.country, postalCode: shipping.postal || 'N/A' } }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to place this order. Please sign in and try again.');
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const shippingCost = body.order.totalCents / 100 - subtotal;
  const order = { orderNumber: `NV-${body.order.id}`, createdAt: body.order.createdAt, lines, customer, shipping, delivery, subtotal, shippingCost, total: body.order.totalCents / 100, estimatedDelivery: delivery === 'express' ? '1–2 business days' : '4–7 business days' };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  return order;
}
export function getLastOrder() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; } }
