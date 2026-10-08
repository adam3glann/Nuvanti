import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { issueSession, readSession, requireAuth, resolveSession, setSessionCookie } from '../lib/auth.js';
import { transaction, query } from '../lib/db.js';
import { emailDeliveryStatus, sendNewOrderNotification, sendOrderConfirmation } from '../lib/mail.js';
import { sendOrderWhatsApp } from '../lib/whatsapp.js';
import { storePublicOrigin } from '../lib/publicOrigins.js';
import { createPaymobCheckout, paymobReady } from '../lib/paymob.js';
import { restoreOrderInventory } from '../lib/orderLifecycle.js';
import { sendVerificationLink } from './auth.js';
import { requireCheckoutAvailable } from '../middleware/emergencyLockdown.js';

const router = Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

async function notifySuperAdminsOfOrder({ orderId, totalCents, paymentMethod, itemCount }) {
  const { rows } = await query(`SELECT email FROM users
    WHERE role = 'super_admin' AND is_active = true ORDER BY id`);
  const recipients = [...new Set(rows.map(({ email }) => String(email || '').trim().toLowerCase()).filter(Boolean))];
  const results = await Promise.allSettled(recipients.map((to) => sendNewOrderNotification({
    to, orderId, totalCents, paymentMethod, itemCount,
  })));
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(`New order notification email failed for order NV-${orderId}:`, result.reason);
    }
  }
}

const checkout = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(10),
    color: z.string().max(60).optional(),
    size: z.string().max(20).optional(),
    image: z.string().max(500).optional(),
  })).min(1).max(30),
  shipping: z.object({ name: z.string().min(2).max(100), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional(), phone: z.string().max(30).optional(), address1: z.string().min(3).max(150), city: z.string().min(2).max(100), locationId: z.string().min(1).max(60), country: z.literal('Egypt'), postalCode: z.string().min(1).max(20) }),
  delivery: z.enum(['standard', 'express']),
  paymentMethod: z.enum(['cod', 'paymob', 'instapay']).default('cod'),
  discountCode: z.string().max(40).optional(),
  createAccount: z.object({ password: z.string().min(12).max(128) }).optional(),
});

function selectedCatalogImage(product, requestedImage) {
  const images = Array.isArray(product?.images) ? product.images : [];
  return typeof requestedImage === 'string' && images.includes(requestedImage)
    ? requestedImage
    : images[0] || null;
}

// Public discount preview: lets the storefront show the discount amount in
// the cart/checkout summary before an order (and login) exist, without
// consuming the code's usage count â€” only order creation above does that,
// inside its own row-locked transaction.
const validateDiscountSchema = z.object({
  code: z.string().min(1).max(40),
  subtotal: z.coerce.number().min(0),
});
const discountPreviewLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false });
const guestOrderLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many guest checkout attempts. Please wait a few minutes and try again.' }, skip: (req) => Boolean(req.user) });
function optionalAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return next();
  resolveSession(session).then((user) => {
    if (user) req.user = { ...session, sub: String(user.id), email: user.email, role: user.role, emailVerifiedAt: user.emailVerifiedAt };
    next();
  }).catch(next);
}
router.post('/validate-discount', requireCheckoutAvailable, discountPreviewLimiter, async (req, res) => {
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

router.post('/', requireCheckoutAvailable, optionalAuth, guestOrderLimiter, asyncRoute(async (req, res) => {
  const { items, shipping, delivery, discountCode, paymentMethod, createAccount } = checkout.parse(req.body);
  if (req.user && !req.user.emailVerifiedAt) return res.status(403).json({ code: 'EMAIL_NOT_VERIFIED', error: 'Confirm your email before placing an order.' });
  if (req.user && createAccount) return res.status(400).json({ error: 'You are already signed in.' });
  const customerEmail = req.user?.email || shipping.email;
  if (!customerEmail) return res.status(400).json({ error: 'Enter an email address for your order receipt and secure tracking link.' });
  shipping.email = customerEmail;
  if (paymentMethod === 'paymob' && !paymobReady()) return res.status(503).json({ error: 'Online payment is not configured yet. Choose Cash on Delivery or contact the store.' });
  const accountPasswordHash = !req.user && createAccount ? await bcrypt.hash(createAccount.password, 12) : null;
  const trackingToken = crypto.randomBytes(24).toString('hex');
  let transactionResult;
  try {
    transactionResult = await transaction(async (client) => {
    let orderUserId = req.user?.sub || null;
    let registeredUser = null;
    if (!req.user && accountPasswordHash) {
      const { rows: users } = await client.query(`INSERT INTO users (email, name, password_hash, role)
        VALUES ($1, $2, $3, 'customer')
        RETURNING id, email, name, role, session_version AS "sessionVersion"`, [customerEmail, shipping.name, accountPasswordHash]);
      registeredUser = users[0];
      orderUserId = registeredUser.id;
    }
    const ids = [...new Set(items.map((item) => item.productId))];
    const { rows: products } = await client.query(`SELECT id, name, price_cents, inventory, sizes, colors, images, metadata,
      CASE WHEN metadata->'inventory' IS NULL OR metadata->'inventory' = '{}'::jsonb
        THEN jsonb_build_object('One Size', inventory) ELSE metadata->'inventory' END AS "stockBySize"
      FROM products WHERE id = ANY($1) AND is_active = true FOR UPDATE`, [ids]);
    if (products.length !== ids.length) { const error = new Error('One or more products are unavailable.'); error.status = 400; throw error; }
    // PostgreSQL BIGSERIAL (`int8`) values are returned as strings by node-pg,
    // while validated productId values from the request are numbers. Normalize
    // the keys so valid cart lines resolve instead of throwing during checkout.
    const map = new Map(products.map((product) => [Number(product.id), {
      ...product,
      stockByVariant: product.metadata?.inventoryByVariant || Object.fromEntries(
        ((product.colors || []).length ? product.colors : ['Default']).flatMap((color, index) => (product.sizes || []).map((size) => [
          `${color}::${size}`, index === 0 ? Number(product.stockBySize?.[size] || 0) : 0,
        ])),
      ),
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
      const color = item.color || product.colors?.[0] || 'Default';
      const variantKey = `${item.productId}:${color}:${size}`;
      variantQuantities.set(variantKey, { productId: item.productId, color, size, quantity: (variantQuantities.get(variantKey)?.quantity || 0) + item.quantity });
      productQuantities.set(item.productId, (productQuantities.get(item.productId) || 0) + item.quantity);
      subtotal += product.price_cents * item.quantity;
    }
    for (const variant of variantQuantities.values()) {
      const product = map.get(variant.productId);
      const available = Number(product.stockByVariant?.[`${variant.color}::${variant.size}`] ?? product.stockBySize?.[variant.size] ?? 0);
      if (available < variant.quantity) { const error = new Error(`${product.name} does not have enough stock in ${variant.color}, size ${variant.size}.`); error.status = 409; throw error; }
    }

    const { rows: settingsRows } = await client.query('SELECT standard_shipping_cents AS "standard", express_shipping_cents AS "express", free_shipping_threshold_cents AS "freeThreshold", shipping_locations AS "shippingLocations", online_payment_enabled AS "onlinePaymentEnabled", instapay_enabled AS "instapayEnabled", instapay_recipient AS "instapayRecipient", instapay_whatsapp_phone AS "instapayWhatsappPhone" FROM store_settings WHERE id = 1 FOR SHARE');
    const settings = settingsRows[0] || { standard: 7500, express: 15000, freeThreshold: 300000 };
    if (paymentMethod === 'paymob' && settings.onlinePaymentEnabled !== true) {
      const error = new Error('Online payments are currently turned off. Choose Cash on Delivery.'); error.status = 409; throw error;
    }
    if (paymentMethod === 'instapay' && (settings.instapayEnabled !== true || !settings.instapayRecipient?.trim() || !settings.instapayWhatsappPhone?.trim())) {
      const error = new Error('InstaPay transfer is currently unavailable. Choose Cash on Delivery.'); error.status = 409; throw error;
    }
    const location = (settings.shippingLocations || []).find((entry) => entry.id === shipping.locationId);
    if (!location) { const error = new Error('Choose a valid delivery location.'); error.status = 400; throw error; }
    shipping.city = location.name;
    const shippingCents = Math.round((delivery === 'express' ? location.express : (subtotal >= settings.freeThreshold ? 0 : location.standard)) * 100);

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
    const { rows } = await client.query('INSERT INTO orders (user_id, status, subtotal_cents, shipping_cents, total_cents, shipping_address, delivery, payment_method, payment_status, payment_provider, tracking_token, discount_code, discount_cents, instapay_recipient_snapshot, instapay_whatsapp_phone_snapshot) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING id, status, subtotal_cents AS "subtotalCents", shipping_cents AS "shippingCents", total_cents AS "totalCents", created_at AS "createdAt", discount_code AS "discountCode", discount_cents AS "discountCents"', [orderUserId, 'pending', subtotal, shippingCents, totalCents, shipping, delivery, paymentMethod, 'pending', paymentMethod === 'paymob' ? 'paymob' : null, trackingToken, appliedCode, discountCents, paymentMethod === 'instapay' ? settings.instapayRecipient : null, paymentMethod === 'instapay' ? settings.instapayWhatsappPhone : null]);
    for (const item of items) { const p = map.get(item.productId); await client.query('INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, unit_cost_cents, quantity, color, size, image_url) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [rows[0].id, p.id, p.name, p.price_cents, p.unitCostCents, item.quantity, item.color || null, item.size || null, selectedCatalogImage(p, item.image)]); }
    for (const [productId, quantity] of productQuantities) {
      const product = map.get(productId);
      const nextStock = { ...product.stockBySize };
      const nextVariantStock = { ...product.stockByVariant };
      for (const variant of variantQuantities.values()) {
        if (variant.productId === productId) {
          nextVariantStock[`${variant.color}::${variant.size}`] -= variant.quantity;
          nextStock[variant.size] = Math.max(0, Number(nextStock[variant.size] || 0) - variant.quantity);
        }
      }
      const totalStock = Object.values(nextVariantStock).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
      await client.query(`UPDATE products SET inventory = $2,
        metadata = jsonb_set(jsonb_set(COALESCE(metadata, '{}'::jsonb), '{inventory}', $3::jsonb, true), '{inventoryByVariant}', $4::jsonb, true), updated_at = NOW()
        WHERE id = $1`, [productId, totalStock, JSON.stringify(nextStock), JSON.stringify(nextVariantStock)]);
    }
    return {
      order: rows[0],
      registeredUser,
      transferDetails: paymentMethod === 'instapay' ? { recipient: settings.instapayRecipient, whatsappPhone: settings.instapayWhatsappPhone } : null,
      itemSummaries: items.map((item) => ({
        name: map.get(item.productId).name,
        priceCents: map.get(item.productId).price_cents,
        quantity: item.quantity,
        color: item.color || '',
        size: item.size || '',
        image: selectedCatalogImage(map.get(item.productId), item.image),
      })),
    };
    });
  } catch (error) {
    if (createAccount && error.code === '23505' && error.constraint === 'users_email_key') return res.status(409).json({ code: 'ACCOUNT_EXISTS', error: 'An account already exists for this email. Sign in, or continue as a guest without creating an account.' });
    throw error;
  }
  const { order, itemSummaries, transferDetails, registeredUser } = transactionResult;
  const storeOrigin = storePublicOrigin();
  const trackingUrl = `${storeOrigin}/track.html?order=${order.id}&token=${trackingToken}`;
  let paymentUrl = null;
  if (paymentMethod === 'paymob') {
    try {
      const payment = await createPaymobCheckout({ order, customer: { email: customerEmail, name: shipping.name }, shipping });
      await query('UPDATE orders SET payment_provider_order_id = $1, payment_updated_at = NOW() WHERE id = $2 AND payment_status = $3', [payment.providerOrderId, order.id, 'pending']);
      paymentUrl = payment.url;
    } catch (error) {
      console.error(`Paymob checkout could not start for order #${order.id}:`, error);
      await cancelUnpaidOrder(order.id);
      return res.status(502).json({ error: 'Online payment could not start. Your order was not placed; please try again or choose Cash on Delivery.' });
    }
  }
  if (registeredUser) {
    try { setSessionCookie(res, await issueSession(registeredUser, req)); }
    catch (error) { console.error(`Checkout account session could not be started for NV-${order.id}:`, error); }
    sendVerificationLink(registeredUser).catch((error) => console.error(`Checkout account verification email failed for NV-${order.id}:`, error));
  }
  // Notify every active super admin without making order placement depend on email delivery.
  notifySuperAdminsOfOrder({
    orderId: order.id,
    totalCents: order.totalCents,
    paymentMethod,
    itemCount: itemSummaries.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  }).catch((error) => console.error(`Unable to notify super admins about order NV-${order.id}:`, error));
  // Keep checkout successful if email fails, but wait for the provider result so
  // the customer can see whether the receipt was accepted for delivery.
  let emailDelivery = { sent: false, configured: emailDeliveryStatus().configured };
  try {
    if (paymentMethod === 'cod' || !req.user) {
      await sendOrderConfirmation({
      to: customerEmail,
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
    console.error(`Order confirmation email failed for order #${order.id} to ${customerEmail}:`, error);
  }

  res.status(201).json({ order: { ...order, trackingUrl, emailDelivery, paymentMethod, paymentUrl, transferDetails, guest: !req.user && !registeredUser, accountCreated: Boolean(registeredUser) }, items: itemSummaries });
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
    await restoreOrderInventory(client, order.id, `Payment setup failed for order NV-${orderId}`);
    if (order.discount_code) await client.query('UPDATE discounts SET used_count = GREATEST(0, used_count - 1) WHERE code = $1', [order.discount_code]);
    await client.query("UPDATE orders SET status = 'cancelled', payment_status = 'failed', payment_updated_at = NOW() WHERE id = $1", [orderId]);
  });
}
router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await query(`SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod", o.total_cents AS "totalCents", o.created_at AS "createdAt", o.tracking_token AS "trackingToken",
    CASE WHEN o.payment_method = 'instapay' THEN coalesce(o.instapay_recipient_snapshot, (SELECT CASE WHEN s.instapay_enabled AND s.updated_at <= o.created_at THEN s.instapay_recipient END FROM store_settings s WHERE s.id = 1)) END AS "instapayRecipient",
    CASE WHEN o.payment_method = 'instapay' THEN coalesce(o.instapay_whatsapp_phone_snapshot, (SELECT NULLIF(s.instapay_whatsapp_phone, '') FROM store_settings s WHERE s.id = 1)) END AS "instapayWhatsappPhone",
    coalesce(sum(i.quantity), 0)::int AS "itemCount"
    FROM orders o LEFT JOIN order_items i ON i.order_id = o.id WHERE o.user_id = $1 GROUP BY o.id ORDER BY o.created_at DESC`, [req.user.sub]);
  const storeOrigin = storePublicOrigin();
  res.set('Cache-Control', 'no-store').json(rows.map(({ trackingToken, ...row }) => ({ ...row, trackingUrl: `${storeOrigin}/track.html?order=${row.id}&token=${trackingToken}` })));
});

// Public, token-guarded order lookup â€” this is what the tracking link in the
// confirmation email/WhatsApp message opens. No login required, and only
// non-sensitive fields are returned (no email/phone/full address).
const trackLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });
router.get('/track/:id', trackLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const token = String(req.query.token || '');
  if (!Number.isInteger(id) || !token) return res.status(400).json({ error: 'Invalid tracking link.' });
  const { rows } = await query(`SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod", o.delivery, o.total_cents AS "totalCents", o.created_at AS "createdAt", o.shipping_address AS "shippingAddress", o.tracking_token AS "trackingToken",
    CASE WHEN o.payment_method = 'instapay' THEN coalesce(o.instapay_recipient_snapshot, (SELECT CASE WHEN s.instapay_enabled AND s.updated_at <= o.created_at THEN s.instapay_recipient END FROM store_settings s WHERE s.id = 1)) END AS "instapayRecipient",
    CASE WHEN o.payment_method = 'instapay' THEN coalesce(o.instapay_whatsapp_phone_snapshot, (SELECT NULLIF(s.instapay_whatsapp_phone, '') FROM store_settings s WHERE s.id = 1)) END AS "instapayWhatsappPhone"
    FROM orders o WHERE o.id = $1`, [id]);
  const order = rows[0];
  const tokenBuf = Buffer.from(token);
  const validLength = order && Buffer.byteLength(order.trackingToken || '') === tokenBuf.length;
  const matches = validLength && crypto.timingSafeEqual(Buffer.from(order.trackingToken), tokenBuf);
  if (!order || !matches) return res.status(404).json({ error: 'Order not found. Check the link and try again.' });
  const { rows: items } = await query('SELECT product_name AS "name", quantity, color, size, image_url AS "image" FROM order_items WHERE order_id = $1', [id]);
  res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }).json({
    id: order.id,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    instapayRecipient: order.instapayRecipient,
    instapayWhatsappPhone: order.instapayWhatsappPhone,
    delivery: order.delivery,
    total: Number(order.totalCents) / 100,
    createdAt: order.createdAt,
    city: order.shippingAddress?.city || null,
    country: order.shippingAddress?.country || null,
    items,
  });
});

export default router;
