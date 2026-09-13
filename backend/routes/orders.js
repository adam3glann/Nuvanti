import { Router } from 'express';
import { readJSON, writeJSON } from '../lib/store.js';

const router = Router();

// GET /api/orders — list all orders (an admin dashboard would call this)
router.get('/', async (req, res) => {
  const orders = await readJSON('orders');
  res.json(orders);
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const orders = await readJSON('orders');
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

// POST /api/orders — create an order from a cart payload
// Body: { items: [{ productId, slug, name, price, size, color, quantity }], customer: {...}, shipping: {...} }
router.post('/', async (req, res) => {
  const { items, customer, shipping } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Order must include at least one item' });
  }
  if (!customer || !customer.email) {
    return res.status(400).json({ error: 'customer.email is required' });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const orders = await readJSON('orders');
  const order = {
    id: `ORD-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'pending',
    items,
    customer,
    shipping: shipping || null,
    subtotal,
  };
  orders.push(order);
  await writeJSON('orders', orders);
  res.status(201).json(order);
});

export default router;
