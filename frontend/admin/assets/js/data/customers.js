import { orders } from './orders.js';

function buildCustomers() {
  const map = new Map();
  orders.forEach((o) => {
    const key = o.customer.email;
    if (!map.has(key)) {
      map.set(key, {
        id: `cu-${map.size + 1}`,
        name: o.customer.name, email: o.customer.email, phone: o.customer.phone,
        orders: [], totalSpent: 0, status: 'active',
        addresses: [{ city: o.shippingAddress.city, country: o.shippingAddress.country, isDefault: true }],
        notes: [],
      });
    }
    const c = map.get(key);
    c.orders.push(o.id);
    if (o.status !== 'cancelled') c.totalSpent += o.total;
  });
  return [...map.values()].map((c) => ({
    ...c,
    orderCount: c.orders.length,
    lastOrder: orders.find((o) => c.orders.includes(o.id))?.createdAt,
  }));
}

export const customers = buildCustomers();

export function getCustomerById(id) {
  return customers.find((c) => c.id === id);
}
