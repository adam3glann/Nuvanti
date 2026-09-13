// orderService — MOCK ONLY. Generates a fake order number and stores the
// last order in sessionStorage purely so the order-success page has data
// to render after checkout. Real order creation, pricing, and inventory
// checks must happen server-side — never trust these numbers from the client.
const STORAGE_KEY = 'nuvanti_last_order_v1';

export function createMockOrder({ lines, customer, shipping, delivery, subtotal }) {
  const shippingCost = delivery === 'express' ? 150 : subtotal >= 3000 ? 0 : 75;
  const order = {
    orderNumber: `NV-${Math.floor(100000 + Math.random() * 900000)}`,
    createdAt: new Date().toISOString(),
    lines, customer, shipping, delivery,
    subtotal, shippingCost, total: subtotal + shippingCost,
    estimatedDelivery: delivery === 'express' ? '1–2 business days' : '4–7 business days',
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  return order;
}

export function getLastOrder() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
