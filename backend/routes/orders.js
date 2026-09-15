import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { transaction, query } from '../lib/db.js';

const router = Router();
const checkout = z.object({ items: z.array(z.object({ productId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().min(1).max(10) })).min(1).max(30), shipping: z.object({ name: z.string().min(2).max(100), address1: z.string().min(3).max(150), city: z.string().min(2).max(80), country: z.string().min(2).max(80), postalCode: z.string().min(1).max(20) }) });

router.post('/', requireAuth, async (req, res) => {
  const { items, shipping } = checkout.parse(req.body);
  const order = await transaction(async (client) => {
    const ids = [...new Set(items.map((item) => item.productId))];
    const { rows: products } = await client.query('SELECT id, name, price_cents, inventory FROM products WHERE id = ANY($1) AND is_active = true FOR UPDATE', [ids]);
    if (products.length !== ids.length) { const error = new Error('One or more products are unavailable.'); error.status = 400; throw error; }
    const map = new Map(products.map((p) => [p.id, p])); let subtotal = 0;
    for (const item of items) { const product = map.get(item.productId); if (product.inventory < item.quantity) { const error = new Error(`${product.name} is out of stock.`); error.status = 409; throw error; } subtotal += product.price_cents * item.quantity; }
    const shippingCents = subtotal >= 300000 ? 0 : 7500;
    const { rows } = await client.query('INSERT INTO orders (user_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status, total_cents AS "totalCents", created_at AS "createdAt"', [req.user.sub, 'pending', subtotal, shippingCents, subtotal + shippingCents, shipping]);
    for (const item of items) { const p = map.get(item.productId); await client.query('INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity) VALUES ($1, $2, $3, $4, $5)', [rows[0].id, p.id, p.name, p.price_cents, item.quantity]); await client.query('UPDATE products SET inventory = inventory - $1, updated_at = NOW() WHERE id = $2', [item.quantity, p.id]); }
    return rows[0];
  });
  res.status(201).json({ order });
});
router.get('/mine', requireAuth, async (req, res) => { const { rows } = await query('SELECT id, status, total_cents AS "totalCents", created_at AS "createdAt" FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.sub]); res.json(rows); });
export default router;
