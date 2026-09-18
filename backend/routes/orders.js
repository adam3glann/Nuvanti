import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { transaction, query } from '../lib/db.js';

const router = Router();
const checkout = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(10),
    color: z.string().max(60).optional(),
    size: z.string().max(20).optional(),
    image: z.string().max(500).optional(),
  })).min(1).max(30),
  shipping: z.object({ name: z.string().min(2).max(100), phone: z.string().max(30).optional(), address1: z.string().min(3).max(150), city: z.string().min(2).max(80), country: z.string().min(2).max(80), postalCode: z.string().min(1).max(20) }),
  delivery: z.enum(['standard', 'express']),
});

router.post('/', requireAuth, async (req, res) => {
  const { items, shipping, delivery } = checkout.parse(req.body);
  const order = await transaction(async (client) => {
    const ids = [...new Set(items.map((item) => item.productId))];
    const { rows: products } = await client.query('SELECT id, name, price_cents, inventory FROM products WHERE id = ANY($1) AND is_active = true FOR UPDATE', [ids]);
    if (products.length !== ids.length) { const error = new Error('One or more products are unavailable.'); error.status = 400; throw error; }
    const map = new Map(products.map((p) => [p.id, p]));
    const quantities = new Map();
    let subtotal = 0;
    for (const item of items) { quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity); subtotal += map.get(item.productId).price_cents * item.quantity; }
    for (const [productId, quantity] of quantities) { const product = map.get(productId); if (product.inventory < quantity) { const error = new Error(`${product.name} does not have enough stock.`); error.status = 409; throw error; } }
    const shippingCents = delivery === 'express' ? 15000 : (subtotal >= 300000 ? 0 : 7500);
    const { rows } = await client.query('INSERT INTO orders (user_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address, delivery, payment_method) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, status, total_cents AS "totalCents", created_at AS "createdAt"', [req.user.sub, 'pending', subtotal, shippingCents, subtotal + shippingCents, shipping, delivery, 'cod']);
    for (const item of items) { const p = map.get(item.productId); await client.query('INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, color, size, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [rows[0].id, p.id, p.name, p.price_cents, item.quantity, item.color || null, item.size || null, item.image || null]); }
    for (const [productId, quantity] of quantities) await client.query('UPDATE products SET inventory = inventory - $1, updated_at = NOW() WHERE id = $2', [quantity, productId]);
    return rows[0];
  });
  res.status(201).json({ order });
});
router.get('/mine', requireAuth, async (req, res) => { const { rows } = await query('SELECT id, status, total_cents AS "totalCents", created_at AS "createdAt" FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.user.sub]); res.json(rows); });
export default router;
