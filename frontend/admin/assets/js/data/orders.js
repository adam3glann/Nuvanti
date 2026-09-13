import { products } from '../../../../assets/js/data/products.js';

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
const PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'failed'];
const CUSTOMER_NAMES = [
  'Mariam Hassan', 'Youssef Nabil', 'Salma Adel', 'Ahmed Tarek', 'Nourhan Samir',
  'Ziad Mostafa', 'Farida Amr', 'Hazem Ali', 'Rana Fathy', 'Mohamed Elsayed',
  'Dina Ashraf', 'Kareem Fouad', 'Hana Wael', 'Amr Zaki', 'Laila Mansour',
];
const CITIES = ['Cairo', 'Giza', 'Alexandria', 'Mansoura', 'Tanta', 'Hurghada', '6th of October'];

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seededRandom(42);
function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function pad(n, len = 4) { return String(n).padStart(len, '0'); }

function buildOrder(i) {
  const itemCount = 1 + Math.floor(rand() * 3);
  const items = Array.from({ length: itemCount }, () => {
    const p = pick(products);
    const qty = 1 + Math.floor(rand() * 2);
    const size = pick(p.sizes);
    const color = pick(p.colors);
    return { productId: p.id, name: p.name, image: p.images[0], size, color, quantity: qty, price: p.price };
  });
  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const shipping = subtotal >= 3000 ? 0 : 75;
  const total = subtotal + shipping;
  const status = STATUSES[Math.floor(rand() * STATUSES.length)];
  const paymentStatus = status === 'cancelled' ? 'refunded' : status === 'returned' ? 'refunded' : pick(PAYMENT_STATUSES.slice(0, 2));
  const daysAgo = Math.floor(rand() * 60);
  const date = new Date(Date.now() - daysAgo * 86400000);
  const customer = pick(CUSTOMER_NAMES);
  return {
    id: `NV-${pad(100000 + i, 6)}`,
    customer: { name: customer, email: `${customer.split(' ')[0].toLowerCase()}@example.com`, phone: `+20 10${pad(Math.floor(rand() * 99999999), 8)}` },
    items, subtotal, shipping, total,
    status, paymentStatus,
    fulfillmentStatus: status === 'delivered' ? 'fulfilled' : status === 'shipped' ? 'in_transit' : status === 'cancelled' ? 'cancelled' : 'unfulfilled',
    shippingAddress: { city: pick(CITIES), country: 'Egypt', method: rand() > 0.7 ? 'Express' : 'Standard' },
    trackingNumber: status === 'shipped' || status === 'delivered' ? `EGX${pad(Math.floor(rand() * 999999), 6)}` : null,
    paymentMethod: rand() > 0.5 ? 'Card' : 'Cash on Delivery',
    transactionRef: paymentStatus === 'paid' ? `TXN-${pad(Math.floor(rand() * 999999), 6)}` : null,
    createdAt: date.toISOString(),
    notes: [],
  };
}

export const orders = Array.from({ length: 42 }, (_, i) => buildOrder(i)).sort(
  (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
);

export function getOrderById(id) {
  return orders.find((o) => o.id === id);
}

export const ORDER_STATUS_FLOW = ['pending', 'processing', 'shipped', 'delivered'];
