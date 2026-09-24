import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../lib/auth.js';
import { transaction, query } from '../lib/db.js';
import { sendOrderConfirmation } from '../lib/mail.js';
import { sendOrderWhatsApp } from '../lib/whatsapp.js';
import { storePublicOrigin } from '../lib/publicOrigins.js';

const router = Router();
const checkout = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(10),
    color: z.string().max(60).optional(),
    size: z.string().max(20).optional(),
    image: z.string().max(500).optional(),
  })).min(1).max(30),
  shipping: z.object({ name: z.string().min(2).max(100), phone: z.string().max(30).optional(), address1: z.string().min(3).max(150), city: z.string().min(2).max(80), country: z.literal('Egypt'), postalCode: z.string().min(1).max(20) }),
  delivery: z.enum(['standard', 'express']),
  discountCode: z.string().max(40).optional(),
});

// Public discount preview: lets the storefront show the discount amount in
// the cart/checkout summary before an order (and login) exist, without
// consuming the code's usage count — only order creation above does that,
// inside its own row-locked transaction.
const validateDiscountSchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.coerce.number().min(0),
});
const discountPreviewLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false });
router.post('/validate-discount', discountPreviewLimiter, async (req, res) => {
  const parsed = validateDiscountSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a discount code.' });
  const { code, subtotal } = parsed.data;
  const subtotalCents = Math.round(subtotal * 100);
  const { rows } = await query(`SELECT code, type, value, min_subtotal_cents AS "minSubtotalCents", usage_limit AS "usageLimit", used_count AS "usedCount", is_active AS "isActive", expires_at AS "expiresAt" FROM discounts WHERE code = $1`, [code.toUpperCase().trim()]);
  const discount = rows[0];
  if (!discount || !discount.isActive || (discount.expiresAt && new Date(discount.expiresAt) < new Date()) || (discount.usageLimit && discount.usedCount >= discount.usageLimit)) {
    return res.status(400).json({ error: 'This discount code is invalid or no longer available.' });
  }
  if (subtotalCents < discount.minSubtotalCents) {
    return res.status(400).json({ error: `Add more to your bag to use this code (minimum order of ${(discount.minSubtotalCents / 100).toFixed(2)}).` });
  }
  const discountCents = discount.type === 'percent' ? Math.round(subtotalCents * (discount.value / 100)) : Math.min(discount.value * 100, subtotalCents);
  res.json({ code: discount.code, type: discount.type, value: discount.value, discountCents });
});

router.post('/', requireAuth, async (req, res) => {
  const { items, shipping, delivery, discountCode } = checkout.parse(req.body);
  const trackingToken = crypto.randomBytes(24).toString('hex');
  const { order, itemSummaries } = await transaction(async (client) => {
    const ids = [...new Set(items.map((item) => item.productId))];
    const { rows: products } = await client.query('SELECT id, name, price_cents, inventory FROM products WHERE id = ANY($1) AND is_active = true FOR UPDATE', [ids]);
    if (products.length !== ids.length) { const error = new Error('One or more products are unavailable.'); error.status = 400; throw error; }
    const map = new Map(products.map((p) => [p.id, p]));
    const quantities = new Map();
    let subtotal = 0;
    for (const item of items) { quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity); subtotal += map.get(item.productId).price_cents * item.quantity; }
    for (const [productId, quantity] of quantities) { const product = map.get(productId); if (product.inventory < quantity) { const error = new Error(`${product.name} does not have enough stock.`); error.status = 409; throw error; } }

    const { rows: settingsRows } = await client.query('SELECT standard_shipping_cents AS "standard", express_shipping_cents AS "express", free_shipping_threshold_cents AS "freeThreshold" FROM store_settings WHERE id = 1');
    const settings = settingsRows[0] || { standard: 7500, express: 15000, freeThreshold: 300000 };
    const shippingCents = delivery === 'express' ? settings.express : (subtotal >= settings.freeThreshold ? 0 : settings.standard);

    let discountCents = 0;
    let appliedCode = null;
    if (discountCode) {
      const { rows: discountRows } = await client.query(`SELECT id, code, type, value, min_subtotal_cents AS "minSubtotalCents", usage_limit AS "usageLimit", used_count AS "usedCount", is_active AS "isActive", expires_at AS "expiresAt" FROM discounts WHERE code = $1 FOR UPDATE`, [discountCode.toUpperCase().trim()]);
      const discount = discountRows[0];
      if (!discount || !discount.isActive || (discount.expiresAt && new Date(discount.expiresAt) < new Date()) || (discount.usageLimit && discount.usedCount >= discount.usageLimit) || subtotal < discount.minSubtotalCents) {
        const error = new Error('This discount code is invalid or no longer available.'); error.status = 400; throw error;
      }
      discountCents = discount.type === 'percent' ? Math.round(subtotal * (discount.value / 100)) : Math.min(discount.value * 100, subtotal);
      appliedCode = discount.code;
      await client.query('UPDATE discounts SET used_count = used_count + 1 WHERE id = $1', [discount.id]);
    }

    const totalCents = Math.max(0, subtotal - discountCents) + shippingCents;
    const { rows } = await client.query('INSERT INTO orders (user_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address, delivery, payment_method, tracking_token, discount_code, discount_cents) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id, status, total_cents AS "totalCents", created_at AS "createdAt", discount_code AS "discountCode", discount_cents AS "discountCents"', [req.user.sub, 'pending', subtotal, shippingCents, totalCents, shipping, delivery, 'cod', trackingToken, appliedCode, discountCents]);
    for (const item of items) { const p = map.get(item.productId); await client.query('INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity, color, size, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [rows[0].id, p.id, p.name, p.price_cents, item.quantity, item.color || null, item.size || null, item.image || null]); }
    for (const [productId, quantity] of quantities) await client.query('UPDATE products SET inventory = inventory - $1, updated_at = NOW() WHERE id = $2', [quantity, productId]);
    return { order: rows[0], itemSummaries: items.map((item) => ({ name: map.get(item.productId).name, quantity: item.quantity })) };
  });

  const storeOrigin = storePublicOrigin();
  const trackingUrl = `${storeOrigin}/track.html?order=${order.id}&token=${trackingToken}`;
  res.status(201).json({ order: { ...order, trackingUrl } });

  // Confirmation notifications are best-effort: they run after the response
  // is already sent, and a failure here (bad SMTP config, WhatsApp down,
  // etc.) must never affect the order that was already placed.
  sendOrderConfirmation({ to: req.user.email, name: shipping.name, orderId: order.id, items: itemSummaries, totalCents: order.totalCents, trackingUrl })
    .catch((error) => console.error('Order confirmation email failed:', error));
  if (shipping.phone) {
    sendOrderWhatsApp({ phone: shipping.phone, message: `Hi ${shipping.name}, your Nuvanti order #${order.id} is confirmed! Track it here: ${trackingUrl}` })
      .catch((error) => console.error('Order confirmation WhatsApp failed:', error));
  }
});
router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT o.id, o.status, o.total_cents AS "totalCents", o.created_at AS "createdAt", o.tracking_token AS "trackingToken", coalesce(sum(i.quantity), 0)::int AS "itemCount" FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user.sub]);
  const storeOrigin = storePublicOrigin();
  res.json(rows.map(({ trackingToken, ...row }) => ({ ...row, trackingUrl: `${storeOrigin}/track.html?order=${row.id}&token=${trackingToken}` })));
});

// Public, token-guarded order lookup — this is what the tracking link in the
// confirmation email/WhatsApp message opens. No login required, and only
// non-sensitive fields are returned (no email/phone/full address).
const trackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
router.get('/track/:id', trackLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const token = String(req.query.token || '');
  if (!Number.isInteger(id) || !token) return res.status(400).json({ error: 'Invalid tracking link.' });
  const { rows } = await query('SELECT id, status, delivery, total_cents AS "totalCents", created_at AS "createdAt", shipping_address AS "shippingAddress", tracking_token AS "trackingToken" FROM orders WHERE id = $1', [id]);
  const order = rows[0];
  const tokenBuf = Buffer.from(token);
  const validLength = order && Buffer.byteLength(order.trackingToken || '') === tokenBuf.length;
  const matches = validLength && crypto.timingSafeEqual(Buffer.from(order.trackingToken), tokenBuf);
  if (!order || !matches) return res.status(404).json({ error: 'Order not found. Check the link and try again.' });
  const { rows: items } = await query('SELECT product_name AS "name", quantity, color, size, image_url AS "image" FROM order_items WHERE order_id = $1', [id]);
  res.json({
    id: order.id,
    status: order.status,
    delivery: order.delivery,
    total: Number(order.totalCents) / 100,
    createdAt: order.createdAt,
    city: order.shippingAddress?.city || null,
    country: order.shippingAddress?.country || null,
    items,
  });
});

export default router;
