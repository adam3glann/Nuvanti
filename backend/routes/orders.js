import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireVerifiedEmail } from '../lib/auth.js';
import { transaction, query } from '../lib/db.js';
import { emailDeliveryStatus, sendOrderConfirmation } from '../lib/mail.js';
import { sendOrderWhatsApp } from '../lib/whatsapp.js';
import { storePublicOrigin } from '../lib/publicOrigins.js';
import { createPaymobCheckout, paymobReady } from '../lib/paymob.js';

const router = Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
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
  paymentMethod: z.enum(['cod', 'paymob']).default('cod'),
  discountCode: z.string().max(40).optional(),
});

// Public discount preview: lets the storefront show the discount amount in
// the cart/checkout summary before an order (and login) exist, without
// consuming the code's usage count â€” only order creation above does that,
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

router.post('/', requireAuth, requireVerifiedEmail, asyncRoute(async (req, res) => {
  const { items, shipping, delivery, discountCode, paymentMethod } = checkout.parse(req.body);
  if (paymentMethod === 'paymob' && !paymobReady()) return res.status(503).json({ error: 'Online payment is not configured yet. Choose Cash on Delivery or contact the store.' });
  const trackingToken = crypto.randomBytes(24).toString('hex');
  const { order, itemSummaries } = await transaction(async (client) => {
    const ids = [...new Set(items.map((item) => item.productId))];
    const { rows: products } = await client.query(`SELECT id, name, price_cents, inventory, sizes, colors, metadata,
      CASE WHEN metadata->'inventory' IS NULL OR metadata->'inventory' = '{}'::jsonb
        THEN jsonb_build_object('One Size', inventory) ELSE metadata->'inventory' END AS "stockBySize"
      FROM products WHERE id = ANY($1) AND is_active = true FOR UPDATE`, [ids]);
    if (products.length !== ids.length) { const error = new Error('One or more products are unavailable.'); error.status = 400; throw error; }
    // PostgreSQL BIGSERIAL (`int8`) values are returned as strings by node-pg,
    // while validated productId values from the request are numbers. Normalize
    // the keys so valid cart lines resolve instead of throwing during checkout.
    const map = new Map(products.map((product) => [Number(product.id), {
      ...product,
      unitCostCents: product.metadata?.costCents == null ? null : Number(product.metadata.costCents),
    }]));
    const variantQuantities = new Map();
    const productQuantities = new Map();
    let subtotal = 0;
    for (const item of items) {
      const product = map.get(item.productId);
      const size = item.size || 'One Size';
      if (product.sizes?.length && !product.sizes.includes(size)) { const error = new Error(`${product.name} is no longer available in size ${size}.`); error.status = 409; throw error; }
      if (item.color && product.colors?.length && !product.colors.includes(item.color)) { const error = new Error(`${product.name} is no longer available in ${item.color}.`); error.status = 409; throw error; }
      const variantKey = `${item.productId}:${size}`;
      variantQuantities.set(variantKey, { productId: item.productId, size, quantity: (variantQuantities.get(variantKey)?.quantity || 0) + item.quantity });
      productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + item.quantity);
      subtotal += product.price_cents * item.quantity;
    }
    for (const variant of variantQuantities.values()) {
      const product = map.get(variant.productId);
      const available = Number(product.stockBySize?.[variant.size] || 0);
      if (available < variant.quantity) { const error = new Error(`${product.name} does not have enough stock in size ${variant.size}.`); error.status = 409; throw error; }
    }

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
    const { rows } = await client.query('INSERT INTO orders (user_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address, delivery, payment_method, payment_status, payment_provider, tracking_token, discount_code, discount_cents) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id, status, subtotal_cents AS "subtotalCents", shipping_cents AS "shippingCents", total_cents AS "totalCents", created_at AS "createdAt", discount_code AS "discountCode", discount_cents AS "discountCents"', [req.user.sub, 'pending', subtotal, shippingCents, totalCents, shipping, delivery, paymentMethod, 'pending', paymentMethod === 'paymob' ? 'paymob' : null, trackingToken, appliedCode, discountCents]);
    for (const item of items) { const p = map.get(item.productId); await client.query('INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, unit_cost_cents, quantity, color, size, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [rows[0].id, p.id, p.name, p.price_cents, p.unitCostCents, item.quantity, item.color || null, item.size || null, item.image || null]); }
    for (const [productId, quantity] of productQuantities) {
      const product = map.get(productId);
      const nextStock = { ...product.stockBySize };
      for (const variant of variantQuantities.values()) {
        if (variant.productId === productId) nextStock[variant.size] -= variant.quantity;
      }
      const totalStock = Object.values(nextStock).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
      await client.query(`UPDATE products SET inventory = $2,
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{inventory}', $3::jsonb, true), updated_at = NOW()
        WHERE id = $1`, [productId, totalStock, JSON.stringify(nextStock)]);
    }
    return {
      order: rows[0],
      itemSummaries: items.map((item) => ({
        name: map.get(item.productId).name,
        priceCents: map.get(item.productId).price_cents,
        quantity: item.quantity,
        color: item.color || '',
        size: item.size || '',
      })),
    };
  });

  const storeOrigin = storePublicOrigin();
  const trackingUrl = `${storeOrigin}/track.html?order=${order.id}&token=${trackingToken}`;
  let paymentUrl = null;
  if (paymentMethod === 'paymob') {
    try {
      const payment = await createPaymobCheckout({ order, customer: req.user, shipping });
      await query('UPDATE orders SET payment_provider_order_id = $1, payment_updated_at = NOW() WHERE id = $2 AND payment_status = $3', [payment.providerOrderId, order.id, 'pending']);
      paymentUrl = payment.url;
    } catch (error) {
      console.error(`Paymob checkout could not start for order #${order.id}:`, error);
      await cancelUnpaidOrder(order.id);
      return res.status(502).json({ error: 'Online payment could not start. Your order was not placed; please try again or choose Cash on Delivery.' });
    }
  }
  // Keep checkout successful if email fails, but wait for the provider result so
  // the customer can see whether the receipt was accepted for delivery.
  let emailDelivery = { sent: false, configured: emailDeliveryStatus().configured };
  try {
    if (paymentMethod === 'cod') {
      await sendOrderConfirmation({
      to: req.user.email,
      name: shipping.name,
      orderId: order.id,
      items: itemSummaries,
      totalCents: order.totalCents,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      discountCode: order.discountCode,
      shippingCents: order.shippingCents,
      delivery,
      shippingAddress: shipping,
      trackingUrl,
      });
      emailDelivery = { sent: emailDeliveryStatus().configured, configured: emailDeliveryStatus().configured };
    }
  } catch (error) {
    console.error(`Order confirmation email failed for order #${order.id} to ${req.user.email}:`, error);
  }

  res.status(201).json({ order: { ...order, trackingUrl, emailDelivery, paymentMethod, paymentUrl }, items: itemSummaries });
  if (paymentMethod === 'cod' && shipping.phone) {
    sendOrderWhatsApp({ phone: shipping.phone, message: `Hi ${shipping.name}, your Nuvanti order #${order.id} is confirmed! Track it here: ${trackingUrl}` })
      .catch((error) => console.error('Order confirmation WhatsApp failed:', error));
  }
}));

async function cancelUnpaidOrder(orderId) {
  await transaction(async (client) => {
    const { rows: orderRows } = await client.query('SELECT id, status, discount_code FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    const order = orderRows[0];
    if (!order || order.status !== 'pending') return;
    const { rows: items } = await client.query(`SELECT product_id AS "productId", COALESCE(size, 'One Size') AS size, SUM(quantity)::int AS quantity
      FROM order_items WHERE order_id = $1 GROUP BY product_id, COALESCE(size, 'One Size')`, [orderId]);
    for (const item of items) {
      const { rows: products } = await client.query(`SELECT inventory, CASE WHEN metadata->'inventory' IS NULL OR metadata->'inventory' = '{}'::jsonb
        THEN jsonb_build_object('One Size', inventory) ELSE metadata->'inventory' END AS "stockBySize" FROM products WHERE id = $1 FOR UPDATE`, [item.productId]);
      if (!products[0]) continue;
      const stockBySize = products[0].stockBySize || { 'One Size': products[0].inventory };
      stockBySize[item.size] = Math.max(0, Number(stockBySize[item.size]) || 0) + item.quantity;
      const totalStock = Object.values(stockBySize).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
      await client.query(`UPDATE products SET inventory = $2, metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{inventory}', $3::jsonb, true), updated_at = NOW() WHERE id = $1`, [item.productId, totalStock, JSON.stringify(stockBySize)]);
      await client.query(`INSERT INTO inventory_adjustments (product_id, size, change, reason) VALUES ($1, $2, $3, $4)`, [item.productId, item.size, item.quantity, `Payment setup failed for order NV-${orderId}`]);
    }
    if (order.discount_code) await client.query('UPDATE discounts SET used_count = GREATEST(0, used_count - 1) WHERE code = $1', [order.discount_code]);
    await client.query("UPDATE orders SET status = 'cancelled', payment_status = 'failed', payment_updated_at = NOW() WHERE id = $1", [orderId]);
  });
}
router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod", o.total_cents AS "totalCents", o.created_at AS "createdAt", o.tracking_token AS "trackingToken", coalesce(sum(i.quantity), 0)::int AS "itemCount" FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user.sub]);
  const storeOrigin = storePublicOrigin();
  res.json(rows.map(({ trackingToken, ...row }) => ({ ...row, trackingUrl: `${storeOrigin}/track.html?order=${row.id}&token=${trackingToken}` })));
});

// Public, token-guarded order lookup â€” this is what the tracking link in the
// confirmation email/WhatsApp message opens. No login required, and only
// non-sensitive fields are returned (no email/phone/full address).
const trackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
router.get('/track/:id', trackLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const token = String(req.query.token || '');
  if (!Number.isInteger(id) || !token) return res.status(400).json({ error: 'Invalid tracking link.' });
  const { rows } = await query('SELECT id, status, payment_status AS "paymentStatus", payment_method AS "paymentMethod", delivery, total_cents AS "totalCents", created_at AS "createdAt", shipping_address AS "shippingAddress", tracking_token AS "trackingToken" FROM orders WHERE id = $1', [id]);
  const order = rows[0];
  const tokenBuf = Buffer.from(token);
  const validLength = order && Buffer.byteLength(order.trackingToken || '') === tokenBuf.length;
  const matches = validLength && crypto.timingSafeEqual(Buffer.from(order.trackingToken), tokenBuf);
  if (!order || !matches) return res.status(404).json({ error: 'Order not found. Check the link and try again.' });
  const { rows: items } = await query('SELECT product_name AS "name", quantity, color, size, image_url AS "image" FROM order_items WHERE order_id = $1', [id]);
  res.json({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    delivery: order.delivery,
    total: Number(order.totalCents) / 100,
    createdAt: order.createdAt,
    city: order.shippingAddress?.city || null,
    country: order.shippingAddress?.country || null,
    items,
  });
});

export default router;
