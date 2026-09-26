import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, transaction } from '../lib/db.js';
import { productPayload, toAdminProduct, toPublicProduct } from '../lib/catalog.js';
import { hasPermission, requirePermission } from '../lib/permissions.js';
import { logAudit } from '../lib/audit.js';
import { emailDeliveryStatus, sendAdminWelcome, sendTestEmail, sendOrderStatusUpdate } from '../lib/mail.js';
import { adminPublicOrigin, storePublicOrigin } from '../lib/publicOrigins.js';
import { restoreOrderInventory } from '../lib/orderLifecycle.js';
const router = Router();
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const MANAGEABLE_ROLES = ['staff', 'manager', 'admin', 'super_admin'];
const productImage = z.string().trim().max(1000).refine((value) => {
  if (/^https:\/\//i.test(value)) { try { return new URL(value).protocol === 'https:'; } catch { return false; } }
  return /^\/?assets\/[\w./-]+(?:\?[\w%=&.-]*)?$/.test(value) && !value.includes('..');
}, 'Use an HTTPS image URL or an image path under assets/.');
const productFields = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).max(160), name: z.string().min(2).max(160), description: z.string().max(5000).optional(), price: z.coerce.number().min(0).max(21474836.47).optional(), priceCents: z.coerce.number().int().min(0).max(2147483647).optional(), cost: z.number().min(0).max(21474836.47).nullable().optional(), category: z.string().min(1).max(80), collection: z.string().max(80).nullable().optional(), images: z.array(z.string().max(1000)).max(12).optional(), colors: z.array(z.string().max(40)).max(20).optional(), colorImages: z.record(z.string().max(40), z.array(productImage).max(12)).optional(), colorSwatches: z.record(z.string().max(40), z.string().regex(/^#[0-9a-fA-F]{6}$/)).optional(), sizes: z.array(z.string().max(20)).max(20).optional(), inventory: z.union([z.coerce.number().int().min(0), z.record(z.coerce.number().int().min(0))]).optional(), status: z.enum(['active', 'draft']).optional(), isActive: z.boolean().optional(), badges: z.array(z.string().max(30)).optional(), featured: z.boolean().optional(), bestseller: z.boolean().optional(), newArrival: z.boolean().optional(), sku: z.string().max(100).optional(), compareAtPrice: z.coerce.number().min(0).max(21474836.47).nullable().optional() });
const productInput = productFields.refine((value) => value.price !== undefined || value.priceCents !== undefined, { message: 'Price is required.' });
const columns = 'id, slug, name, description, price_cents, category, collection, images, colors, sizes, inventory, is_active, metadata';
const categoryImage = z.string().trim().max(1000).refine((value) => {
  if (/^https:\/\//i.test(value)) {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }
  return /^\/?assets\/[\w./-]+(?:\?[\w%=&.-]*)?$/.test(value) && !value.includes('..');
}, 'Use an HTTPS image URL or an image path under assets.');
const categoryInput = z.object({ name: z.string().trim().min(2).max(80), slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(80), description: z.string().max(1000).optional(), imageUrl: categoryImage.nullable().optional() });
const collectionInput = z.object({ name: z.string().min(2).max(80), slug: z.string().regex(/^[a-z0-9-]+$/).max(80) });
const slideAsset = z.string().trim().min(1).max(1000).refine((value) => {
  if (/^https:\/\//i.test(value)) {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }
  return /^\/?assets\/[\w./-]+(?:\?[\w%=&.-]*)?$/.test(value) && !value.includes('..');
}, 'Use an HTTPS image URL or an image path under assets/.');
const slideLink = z.string().trim().min(1).max(500).refine((value) => {
  if (/^https:\/\//i.test(value)) {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }
  return /^(?!\/\/)[\w./?%&=+#-]+$/.test(value) && !value.toLowerCase().startsWith('javascript:');
}, 'Use an internal page link or an HTTPS URL.');
const slideColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const gradientPair = z.object({ start: slideColor.default('#83a88a'), end: slideColor.default('#f5f2eb') });
const slideTextGradients = z.object({
  all: gradientPair.extend({ enabled: z.boolean().default(true) }).default({}),
  eyebrow: gradientPair.extend({ mode: z.enum(['inherit', 'gradient', 'solid']).default('inherit') }).default({}),
  title: gradientPair.extend({ mode: z.enum(['inherit', 'gradient', 'solid']).default('inherit') }).default({}),
  description: gradientPair.extend({ mode: z.enum(['inherit', 'gradient', 'solid']).default('inherit') }).default({}),
  button: gradientPair.extend({ mode: z.enum(['inherit', 'gradient', 'solid']).default('inherit') }).default({}),
}).default({});
const slideFont = z.enum(['display', 'body', 'serif', 'system']);
const slideTextFonts = z.object({
  all: z.object({ enabled: z.boolean().default(false), font: slideFont.default('display') }).default({}),
  eyebrow: z.union([z.literal('inherit'), slideFont]).default('inherit'),
  title: z.union([z.literal('inherit'), slideFont]).default('inherit'),
  description: z.union([z.literal('inherit'), slideFont]).default('inherit'),
  button: z.union([z.literal('inherit'), slideFont]).default('inherit'),
}).default({});
const homepageSlideInput = z.object({
  imageUrl: slideAsset,
  eyebrow: z.string().trim().max(80).default(''),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(500).default(''),
  ctaLabel: z.string().trim().min(1).max(50),
  ctaHref: slideLink,
  secondaryLabel: z.string().trim().max(50).default(''),
  secondaryHref: z.string().trim().max(500).default(''),
  position: z.coerce.number().int().min(0).max(1000).default(0),
  durationSeconds: z.coerce.number().int().min(3).max(30).default(5),
  textColor: slideColor.default('#f5f2eb'),
  eyebrowColor: slideColor.nullable().default(null),
  titleColor: slideColor.nullable().default(null),
  descriptionColor: slideColor.nullable().default(null),
  buttonTextColor: slideColor.nullable().default(null),
  textGradients: slideTextGradients,
  textFonts: slideTextFonts,
  isActive: z.boolean().default(true),
}).refine((slide) => !slide.secondaryLabel || slide.secondaryHref, { message: 'Add a link for the secondary button.' });
const homepageSlideColumns = 'id::text, image_url AS "imageUrl", eyebrow, title, description, cta_label AS "ctaLabel", cta_href AS "ctaHref", secondary_label AS "secondaryLabel", secondary_href AS "secondaryHref", position, duration_seconds AS "durationSeconds", text_color AS "textColor", eyebrow_color AS "eyebrowColor", title_color AS "titleColor", description_color AS "descriptionColor", button_text_color AS "buttonTextColor", text_gradients AS "textGradients", text_fonts AS "textFonts", is_active AS "isActive"';
router.get('/store-presence', asyncRoute(async (req, res) => {
  const { rows } = await query(`SELECT count(DISTINCT visitor_id)::int AS "activeVisitors"
    FROM storefront_presence WHERE last_seen_at >= NOW() - INTERVAL '90 seconds'`);
  res.set('Cache-Control', 'no-store').json(rows[0] || { activeVisitors: 0 });
}));
router.get('/homepage-slides', requirePermission('content.manage'), async (req, res) => {
  const { rows } = await query(`SELECT ${homepageSlideColumns} FROM homepage_slides ORDER BY position, id`);
  res.json(rows);
});
router.patch('/homepage-slides/text-color', requirePermission('content.manage'), async (req, res) => {
  const { textColor } = z.object({ textColor: slideColor }).parse(req.body);
  const textGradients = slideTextGradients.parse({
    all: { enabled: false }, eyebrow: { mode: 'solid' }, title: { mode: 'solid' },
    description: { mode: 'solid' }, button: { mode: 'solid' },
  });
  const { rowCount } = await query(`UPDATE homepage_slides SET text_color = $1,
    eyebrow_color = NULL, title_color = NULL, description_color = NULL, button_text_color = NULL,
    text_gradients = $2::jsonb, updated_at = NOW()`, [textColor, JSON.stringify(textGradients)]);
  await logAudit({ req, action: 'homepage_slide.text_color_applied', targetType: 'homepage_slides', targetId: 'all', metadata: { textColor, count: rowCount } });
  res.json({ updated: rowCount, textColor });
});
router.post('/homepage-slides', requirePermission('content.manage'), async (req, res) => {
  const slide = homepageSlideInput.parse(req.body);
  const { rows } = await query(`INSERT INTO homepage_slides (image_url, eyebrow, title, description, cta_label, cta_href, secondary_label, secondary_href, position, duration_seconds, text_color, eyebrow_color, title_color, description_color, button_text_color, text_gradients, text_fonts, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb,$17::jsonb,$18) RETURNING ${homepageSlideColumns}`,
  [slide.imageUrl, slide.eyebrow, slide.title, slide.description, slide.ctaLabel, slide.ctaHref, slide.secondaryLabel, slide.secondaryHref, slide.position, slide.durationSeconds, slide.textColor, slide.eyebrowColor, slide.titleColor, slide.descriptionColor, slide.buttonTextColor, JSON.stringify(slide.textGradients), JSON.stringify(slide.textFonts), slide.isActive]);
  await logAudit({ req, action: 'homepage_slide.created', targetType: 'homepage_slide', targetId: rows[0].id, metadata: { title: slide.title } });
  res.status(201).json(rows[0]);
});
router.patch('/homepage-slides/:id', requirePermission('content.manage'), async (req, res) => {
  const current = await query(`SELECT ${homepageSlideColumns} FROM homepage_slides WHERE id = $1`, [req.params.id]);
  if (!current.rows[0]) return res.status(404).json({ error: 'Homepage slide not found.' });
  const slide = homepageSlideInput.parse({ ...current.rows[0], ...req.body });
  const { rows } = await query(`UPDATE homepage_slides SET image_url=$1, eyebrow=$2, title=$3, description=$4, cta_label=$5, cta_href=$6, secondary_label=$7, secondary_href=$8, position=$9, duration_seconds=$10, text_color=$11, eyebrow_color=$12, title_color=$13, description_color=$14, button_text_color=$15, text_gradients=$16::jsonb, text_fonts=$17::jsonb, is_active=$18, updated_at=NOW()
    WHERE id=$19 RETURNING ${homepageSlideColumns}`,
  [slide.imageUrl, slide.eyebrow, slide.title, slide.description, slide.ctaLabel, slide.ctaHref, slide.secondaryLabel, slide.secondaryHref, slide.position, slide.durationSeconds, slide.textColor, slide.eyebrowColor, slide.titleColor, slide.descriptionColor, slide.buttonTextColor, JSON.stringify(slide.textGradients), JSON.stringify(slide.textFonts), slide.isActive, req.params.id]);
  await logAudit({ req, action: 'homepage_slide.updated', targetType: 'homepage_slide', targetId: rows[0].id, metadata: { title: slide.title } });
  res.json(rows[0]);
});
router.delete('/homepage-slides/:id', requirePermission('content.manage'), async (req, res) => {
  const result = await query('DELETE FROM homepage_slides WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Homepage slide not found.' });
  await logAudit({ req, action: 'homepage_slide.deleted', targetType: 'homepage_slide', targetId: req.params.id });
  res.status(204).end();
});
router.get('/email/status', requirePermission('settings.view'), (req, res) => {
  res.json(emailDeliveryStatus());
});
router.post('/email/test', requirePermission('settings.edit'), async (req, res) => {
  const status = emailDeliveryStatus();
  if (!status.configured) {
    return res.status(503).json({ error: 'Email is not configured yet.', missing: status.missing });
  }
  try {
    await sendTestEmail({ to: req.user.email });
    await logAudit({ req, action: 'email.test_sent', targetType: 'email', targetId: 'self', metadata: { provider: status.provider } });
    res.json({ ok: true, message: `Test email accepted by ${status.provider} for ${req.user.email}.` });
  } catch (error) {
    console.error('Admin email test failed:', error);
    await logAudit({ req, action: 'email.test_failed', targetType: 'email', targetId: 'self', metadata: { provider: status.provider } });
    res.status(502).json({ error: 'The email provider rejected or could not send the test email. Check the provider credentials, sender verification, and server logs.' });
  }
});
router.get('/dashboard', requirePermission('analytics.view'), asyncRoute(async (req, res) => {
  const { rows } = await query(`WITH product_stock AS (
    SELECT p.id, p.name,
      CASE WHEN p.metadata->'inventory' IS NULL OR p.metadata->'inventory' = '{}'::jsonb
        THEN jsonb_build_object('One Size', p.inventory) ELSE p.metadata->'inventory' END AS stock_by_size
    FROM products p WHERE p.is_active = true
  ), stock_totals AS (
    SELECT p.id, sum(CASE WHEN kv.value #>> '{}' ~ '^-?[0-9]+$'
      THEN GREATEST((kv.value #>> '{}')::int, 0) ELSE 0 END)::int AS total_stock
    FROM product_stock p CROSS JOIN LATERAL jsonb_each(p.stock_by_size) kv GROUP BY p.id
  ), low_stock AS (
    SELECT p.name AS "productName", kv.key AS size,
      CASE WHEN kv.value #>> '{}' ~ '^-?[0-9]+$'
        THEN GREATEST((kv.value #>> '{}')::int, 0) ELSE 0 END AS stock
    FROM product_stock p CROSS JOIN LATERAL jsonb_each(p.stock_by_size) kv
    WHERE CASE WHEN kv.value #>> '{}' ~ '^-?[0-9]+$'
      THEN GREATEST((kv.value #>> '{}')::int, 0) ELSE 0 END <= 5
  )
  SELECT
    (SELECT count(*)::int FROM orders) AS "orders",
    (SELECT count(*)::int FROM orders WHERE status IN ('pending', 'paid', 'processing', 'shipped', 'out_for_delivery')) AS "pendingOrders",
    (SELECT count(*)::int FROM orders WHERE status = 'fulfilled') AS "fulfilledOrders",
    (SELECT count(*)::int FROM orders WHERE status = 'cancelled') AS "cancelledOrders",
    (SELECT count(*)::int FROM products WHERE is_active) AS "products",
    (SELECT count(*)::int FROM stock_totals WHERE total_stock = 0) AS "outOfStockProducts",
    (SELECT count(*)::int FROM stock_totals WHERE total_stock BETWEEN 1 AND 10) AS "lowStockProducts",
    (SELECT count(*)::int FROM users WHERE role = 'customer' AND is_active) AS "customers",
    (SELECT count(*)::int FROM users WHERE role = 'customer' AND is_active AND created_at >= date_trunc('month', NOW())) AS "newCustomersThisMonth",
    (SELECT coalesce(sum(GREATEST(subtotal_cents - COALESCE(discount_cents, 0), 0)), 0)::bigint
      FROM orders WHERE (status = 'fulfilled' OR (payment_status = 'paid' AND status <> 'cancelled')) AND payment_status <> 'refunded' AND COALESCE(payment_updated_at, created_at) >= CURRENT_DATE) AS "revenueTodayCents",
    (SELECT coalesce(sum(GREATEST(subtotal_cents - COALESCE(discount_cents, 0), 0)), 0)::bigint
      FROM orders WHERE (status = 'fulfilled' OR (payment_status = 'paid' AND status <> 'cancelled')) AND payment_status <> 'refunded' AND COALESCE(payment_updated_at, created_at) >= date_trunc('month', NOW())) AS "revenueMonthCents",
    (SELECT coalesce(json_agg(alert), '[]'::json) FROM (
      SELECT "productName", size, stock FROM low_stock ORDER BY stock, "productName" LIMIT 5
    ) alert) AS "lowStockAlerts"`);
  const row = rows[0];
  res.json({ ...row, revenueToday: Number(row.revenueTodayCents) / 100, revenueMonth: Number(row.revenueMonthCents) / 100 });
}));
router.get('/analytics', requirePermission('analytics.view'), asyncRoute(async (req, res) => {
  const days = ({ '7d': 7, '30d': 30, '90d': 90, '1y': 365 })[req.query.range] || 30;
  const { rows: series } = await query(`WITH days AS (
    SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day')::date AS day
  )
  SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
    coalesce(sum(GREATEST(o.subtotal_cents - COALESCE(o.discount_cents, 0), 0))
      FILTER (WHERE (o.status = 'fulfilled' OR (o.payment_status = 'paid' AND o.status <> 'cancelled')) AND o.payment_status <> 'refunded'), 0)::bigint AS "revenueCents",
    count(o.id)::int AS orders
  FROM days LEFT JOIN orders o ON COALESCE(o.payment_updated_at, o.created_at) >= days.day
    AND COALESCE(o.payment_updated_at, o.created_at) < days.day + interval '1 day'
    AND (o.status = 'fulfilled' OR (o.payment_status = 'paid' AND o.status <> 'cancelled')) AND o.payment_status <> 'refunded'
  GROUP BY days.day ORDER BY days.day`, [days]);
  const { rows: topProducts } = await query(`SELECT i.product_name AS name, sum(i.quantity)::int AS "unitsSold",
    coalesce(sum(i.unit_price_cents::numeric * i.quantity * GREATEST(o.subtotal_cents - COALESCE(o.discount_cents, 0), 0) / NULLIF(o.subtotal_cents, 0)), 0)::bigint AS "revenueCents"
    FROM orders o JOIN order_items i ON i.order_id = o.id
    WHERE (o.status = 'fulfilled' OR (o.payment_status = 'paid' AND o.status <> 'cancelled')) AND o.payment_status <> 'refunded' AND COALESCE(o.payment_updated_at, o.created_at) >= CURRENT_DATE - ($1::int - 1)
    GROUP BY i.product_id, i.product_name ORDER BY "revenueCents" DESC LIMIT 8`, [days]);
  const { rows: topCategories } = await query(`SELECT p.category AS name,
    coalesce(sum(i.unit_price_cents::numeric * i.quantity * GREATEST(o.subtotal_cents - COALESCE(o.discount_cents, 0), 0) / NULLIF(o.subtotal_cents, 0)), 0)::bigint AS "revenueCents"
    FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
    WHERE (o.status = 'fulfilled' OR (o.payment_status = 'paid' AND o.status <> 'cancelled')) AND o.payment_status <> 'refunded' AND COALESCE(o.payment_updated_at, o.created_at) >= CURRENT_DATE - ($1::int - 1)
    GROUP BY p.category ORDER BY "revenueCents" DESC LIMIT 8`, [days]);
  const { rows: counts } = await query(`SELECT count(*) FILTER (WHERE status IN ('pending', 'paid', 'processing', 'shipped', 'out_for_delivery'))::int AS "pendingOrders"
    FROM orders WHERE created_at >= CURRENT_DATE - ($1::int - 1)`, [days]);
  res.json({
    series: series.map((row) => ({ ...row, revenue: Number(row.revenueCents) / 100 })),
    topProducts: topProducts.map((row) => ({ ...row, revenue: Number(row.revenueCents) / 100 })),
    topCategories: topCategories.map((row) => ({ ...row, revenue: Number(row.revenueCents) / 100 })),
    pendingOrders: counts[0].pendingOrders,
  });
}));
router.get('/financial-summary', requirePermission('analytics.view'), asyncRoute(async (req, res) => {
  const { rows } = await query(`WITH completed_orders AS (
    SELECT o.id,
      GREATEST(o.subtotal_cents - COALESCE(o.discount_cents, 0), 0)::bigint AS net_revenue_cents,
      count(i.id)::int AS line_count,
      count(i.unit_cost_cents)::int AS costed_line_count,
      coalesce(sum(i.unit_cost_cents::bigint * i.quantity) FILTER (WHERE i.unit_cost_cents IS NOT NULL), 0)::bigint AS cost_cents
    FROM orders o
    JOIN order_items i ON i.order_id = o.id
    WHERE (o.status = 'fulfilled' OR (o.payment_status = 'paid' AND o.status <> 'cancelled')) AND o.payment_status <> 'refunded'
    GROUP BY o.id
  )
  SELECT coalesce(sum(net_revenue_cents), 0)::bigint AS "revenueCents",
    coalesce(sum(net_revenue_cents) FILTER (WHERE line_count = costed_line_count), 0)::bigint AS "costedRevenueCents",
    coalesce(sum(cost_cents) FILTER (WHERE line_count = costed_line_count), 0)::bigint AS "costCents",
    count(*)::int AS "completedOrders",
    count(*) FILTER (WHERE line_count = costed_line_count)::int AS "costedOrders",
    (SELECT coalesce(sum(total_cents), 0)::bigint FROM orders
      WHERE status IN ('pending', 'paid', 'processing', 'shipped', 'out_for_delivery') AND payment_status = 'pending') AS "pendingOrderValueCents",
    (SELECT count(*)::int FROM orders
      WHERE status IN ('pending', 'paid', 'processing', 'shipped', 'out_for_delivery') AND payment_status = 'pending') AS "pendingOrderCount",
    (SELECT count(*)::int FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE (o.status = 'fulfilled' OR (o.payment_status = 'paid' AND o.status <> 'cancelled')) AND o.payment_status <> 'refunded' AND i.unit_cost_cents IS NULL) AS "uncostedLines",
    coalesce((SELECT sum(i.quantity)::bigint FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE (o.status = 'fulfilled' OR (o.payment_status = 'paid' AND o.status <> 'cancelled')) AND o.payment_status <> 'refunded'), 0)::bigint AS "unitsSold"
  FROM completed_orders`);
  const row = rows[0];
  const costedRevenueCents = Number(row.costedRevenueCents);
  const grossProfitCents = costedRevenueCents - Number(row.costCents);
  res.json({
    revenue: Number(row.revenueCents) / 100,
    costedRevenue: costedRevenueCents / 100,
    costOfGoods: Number(row.costCents) / 100,
    pendingOrderValue: Number(row.pendingOrderValueCents) / 100,
    pendingOrderCount: row.pendingOrderCount,
    grossProfit: Number(row.costedOrders) ? grossProfitCents / 100 : null,
    grossMargin: costedRevenueCents > 0 ? (grossProfitCents / costedRevenueCents) * 100 : null,
    completedOrders: row.completedOrders,
    unitsSold: Number(row.unitsSold),
    costedOrders: row.costedOrders,
    uncostedLines: row.uncostedLines,
  });
}));
router.get('/products', requirePermission('products.view'), async (req, res) => { const { rows } = await query(`SELECT ${columns} FROM products ORDER BY updated_at DESC`); res.json(rows.map(toAdminProduct)); });
const PAYMENT_METHOD_LABELS = { cod: 'Cash on Delivery', paymob: 'Online payment (Paymob)' };
router.get('/orders', requirePermission('orders.view'), asyncRoute(async (req, res) => {
  const limit = req.query.limit === undefined ? 100 : z.coerce.number().int().min(1).max(100).parse(req.query.limit);
  const { rows } = await query(`SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.payment_transaction_id AS "paymentTransactionId", o.total_cents AS "totalCents", o.subtotal_cents AS "subtotalCents", o.shipping_cents AS "shippingCents", o.delivery, o.payment_method AS "paymentMethod", o.created_at AS "createdAt", o.shipping_address AS "shippingAddress", u.email, u.name,
    coalesce(json_agg(json_build_object('productId', i.product_id, 'name', i.product_name, 'price', i.unit_price_cents::numeric / 100, 'quantity', i.quantity, 'color', i.color, 'size', i.size, 'image', i.image_url)) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
    FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN order_items i ON i.order_id = o.id GROUP BY o.id, u.email, u.name ORDER BY o.created_at DESC LIMIT $1`, [limit]);
  res.json(rows.map((row) => ({
    id: `NV-${row.id}`, dbId: String(row.id), status: row.status, paymentStatus: row.paymentStatus || (['paid', 'fulfilled'].includes(row.status) ? 'paid' : 'pending'),
    total: Number(row.totalCents) / 100, totalCents: Number(row.totalCents),
    subtotal: Number(row.subtotalCents) / 100, shipping: Number(row.shippingCents) / 100,
    delivery: row.delivery, paymentMethod: PAYMENT_METHOD_LABELS[row.paymentMethod] || row.paymentMethod,
    createdAt: row.createdAt,
    customer: { name: row.name, email: row.email, phone: row.shippingAddress?.phone || '—' },
    shippingAddress: { ...row.shippingAddress, method: row.delivery === 'express' ? 'Express' : 'Standard' },
    trackingNumber: null, transactionRef: row.paymentTransactionId || null,
    items: row.items, notes: [],
  })));
}));
router.patch('/orders/:id', requirePermission('orders.edit'), async (req, res) => {
  const status = z.enum(['pending', 'paid', 'processing', 'shipped', 'out_for_delivery', 'fulfilled', 'cancelled']).parse(req.body?.status);
  if (status === 'cancelled' && !hasPermission(req.user.role, 'orders.cancel')) return res.status(403).json({ error: 'You do not have permission to cancel orders.' });
  const result = await transaction(async (client) => {
    const { rows } = await client.query('SELECT o.id, o.status, o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus", o.discount_code AS "discountCode", o.tracking_token AS "trackingToken", u.email, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1 FOR UPDATE OF o', [req.params.id]);
    const order = rows[0];
    if (!order) return { notFound: true };
    if (order.status === status) return { ...order, unchanged: true };
    if (order.status === 'cancelled') {
      return { conflict: 'Cancelled orders cannot be reopened. Create a new order if the customer still wants the items.' };
    }
    if (status === 'cancelled' && order.status !== 'pending') {
      return { conflict: 'Only pending orders can be cancelled. Correct the fulfillment status instead.' };
    }
    if (status === 'cancelled') {
      await restoreOrderInventory(client, order.id, `Cancelled order NV-${order.id}`, req.user.sub);
      if (order.discountCode) await client.query('UPDATE discounts SET used_count = GREATEST(0, used_count - 1) WHERE code = $1', [order.discountCode]);
      if (order.paymentMethod === 'paymob' && order.paymentStatus === 'pending') {
        await client.query("UPDATE orders SET payment_status = 'failed', payment_updated_at = NOW() WHERE id = $1", [order.id]);
      }
    }
    const paidCashOrder = order.paymentMethod === 'cod' && ['paid', 'fulfilled'].includes(status);
    const updated = await client.query(`UPDATE orders SET status = $1,
      payment_status = CASE WHEN $3::boolean THEN 'paid' ELSE payment_status END,
      payment_updated_at = CASE WHEN $3::boolean AND payment_status <> 'paid' THEN NOW() ELSE payment_updated_at END
      WHERE id = $2 RETURNING id, status`, [status, order.id, paidCashOrder]);
    return { ...updated.rows[0], email: order.email, name: order.name, trackingToken: order.trackingToken };
  });
  if (result.notFound) return res.status(404).json({ error: 'Order not found.' });
  if (result.conflict) return res.status(409).json({ error: result.conflict });
  await logAudit({ req, action: 'order.status_changed', targetType: 'order', targetId: result.id, metadata: { status } });
  res.json({ id: result.id, status: result.status });
  if (result.email && !result.unchanged) {
    const trackingUrl = `${storePublicOrigin()}/track.html?order=${result.id}&token=${encodeURIComponent(result.trackingToken)}`;
    sendOrderStatusUpdate({ to: result.email, name: result.name || 'Customer', orderId: result.id, status, trackingUrl })
      .catch((error) => console.error('Order status email failed:', error));
  }
});
router.get('/categories', requirePermission('products.view'), async (req, res) => { const { rows } = await query(`SELECT c.id::text, c.name, c.slug, c.description, c.image_url AS "imageUrl", c.is_active AS "isActive", count(p.id)::int AS "productCount" FROM categories c LEFT JOIN products p ON p.category = c.slug GROUP BY c.id ORDER BY c.name`); res.json(rows.map((c) => ({ ...c, status: c.isActive ? 'active' : 'disabled' }))); });
router.post('/categories', requirePermission('products.create'), async (req, res) => {
  const c = categoryInput.parse(req.body);
  try {
    const { rows } = await query('INSERT INTO categories (name, slug, description, image_url) VALUES ($1, $2, $3, $4) RETURNING id::text, name, slug, description, image_url AS "imageUrl", is_active AS "isActive"', [c.name, c.slug, c.description || '', c.imageUrl || null]);
    await logAudit({ req, action: 'category.created', targetType: 'category', targetId: rows[0].id, metadata: { name: c.name, slug: c.slug, hasImage: Boolean(c.imageUrl) } });
    res.status(201).json({ ...rows[0], productCount: 0, status: 'active' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A category with that slug already exists.' });
    throw error;
  }
});
router.patch('/categories/:id', requirePermission('products.edit'), async (req, res) => {
  const patch = categoryInput.partial().extend({ isActive: z.boolean().optional() }).parse(req.body);
  if (patch.slug !== undefined) {
    const current = await query('SELECT slug FROM categories WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Category not found.' });
    if (patch.slug !== current.rows[0].slug) return res.status(400).json({ error: 'A category slug cannot be changed because products are linked to it.' });
  }
  const columns = { name: 'name', slug: 'slug', description: 'description', imageUrl: 'image_url', isActive: 'is_active' };
  const values = [];
  const assignments = [];
  for (const [key, column] of Object.entries(columns)) {
    if (patch[key] !== undefined) {
      values.push(patch[key]);
      assignments.push(`${column} = $${values.length}`);
    }
  }
  if (!assignments.length) return res.status(400).json({ error: 'Provide a category field to update.' });
  values.push(req.params.id);
  const { rows } = await query(`UPDATE categories SET ${assignments.join(', ')} WHERE id = $${values.length}
    RETURNING id::text, name, slug, description, image_url AS "imageUrl", is_active AS "isActive"`, values);
  if (!rows[0]) return res.status(404).json({ error: 'Category not found.' });
  await logAudit({ req, action: 'category.updated', targetType: 'category', targetId: rows[0].id, metadata: { name: rows[0].name, hasImage: Boolean(rows[0].imageUrl) } });
  res.json({ ...rows[0], status: rows[0].isActive ? 'active' : 'disabled' });
});
router.delete('/categories/:id', requirePermission('products.delete'), async (req, res) => { const result = await query('DELETE FROM categories WHERE id = $1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Category not found.' }); await logAudit({ req, action: 'category.deleted', targetType: 'category', targetId: req.params.id }); res.status(204).end(); });
router.get('/collections', requirePermission('products.view'), async (req, res) => { const { rows } = await query(`SELECT c.id::text, c.name, c.slug, c.is_active AS "isActive", count(p.id)::int AS "productCount" FROM collections c LEFT JOIN products p ON p.collection = c.slug GROUP BY c.id ORDER BY c.name`); res.json(rows.map((c) => ({ ...c, status: c.isActive ? 'published' : 'draft' }))); });
router.post('/collections', requirePermission('products.create'), async (req, res) => { const c = collectionInput.parse(req.body); const { rows } = await query('INSERT INTO collections (name, slug) VALUES ($1, $2) RETURNING id::text, name, slug, is_active AS "isActive"', [c.name, c.slug]); await logAudit({ req, action: 'collection.created', targetType: 'collection', targetId: rows[0].id, metadata: { name: c.name, slug: c.slug } }); res.status(201).json({ ...rows[0], productCount: 0, status: 'published' }); });
router.patch('/collections/:id', requirePermission('products.edit'), async (req, res) => { const isActive = z.boolean().parse(req.body?.isActive); const { rows } = await query('UPDATE collections SET is_active = $1 WHERE id = $2 RETURNING id::text, is_active AS "isActive"', [isActive, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Collection not found.' }); res.json(rows[0]); });
router.delete('/collections/:id', requirePermission('products.delete'), async (req, res) => { const result = await query('DELETE FROM collections WHERE id = $1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Collection not found.' }); await logAudit({ req, action: 'collection.deleted', targetType: 'collection', targetId: req.params.id }); res.status(204).end(); });
router.post('/products', requirePermission('products.create'), async (req, res) => { const p = productPayload(productInput.parse(req.body)); try { const { rows } = await query(`INSERT INTO products (slug,name,description,price_cents,category,collection,images,colors,sizes,inventory,is_active,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb) RETURNING ${columns}`, [p.slug,p.name,p.description,p.priceCents,p.category,p.collection,JSON.stringify(p.images),JSON.stringify(p.colors),JSON.stringify(p.sizes),p.inventory,p.isActive,JSON.stringify(p.metadata)]); res.status(201).json(toAdminProduct(rows[0])); } catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'A product with that slug already exists.' }); throw error; } });
router.patch('/products/:id', requirePermission('products.edit'), async (req, res) => { const existing = await query(`SELECT ${columns} FROM products WHERE id = $1`, [req.params.id]); if (!existing.rows[0]) return res.status(404).json({ error: 'Product not found.' }); const current = toAdminProduct(existing.rows[0]); const patch = productFields.partial().parse(req.body); const merged = { ...current, ...patch }; // The public product includes both EGP and cents; drop the stale counterpart when either is explicitly changed.
  if (patch.priceCents !== undefined && patch.price === undefined) merged.price = undefined;
  else merged.priceCents = undefined;
  const p = productPayload(productInput.parse(merged)); const { rows } = await query(`UPDATE products SET slug=$1,name=$2,description=$3,price_cents=$4,category=$5,collection=$6,images=$7::jsonb,colors=$8::jsonb,sizes=$9::jsonb,inventory=$10,is_active=$11,metadata=$12::jsonb,updated_at=NOW() WHERE id=$13 RETURNING ${columns}`, [p.slug,p.name,p.description,p.priceCents,p.category,p.collection,JSON.stringify(p.images),JSON.stringify(p.colors),JSON.stringify(p.sizes),p.inventory,p.isActive,JSON.stringify(p.metadata),req.params.id]); res.json(toAdminProduct(rows[0])); });
router.get('/inventory/history', requirePermission('inventory.view'), async (req, res) => {
  const { rows } = await query(`SELECT a.product_id::text AS "productId", a.size, a.change, a.reason, a.created_at AS "createdAt", u.name AS "actorName" FROM inventory_adjustments a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 2000`);
  res.json(rows);
});
router.post('/inventory/:productId/:size/adjust', requirePermission('inventory.adjust'), async (req, res) => {
  const input = z.object({ change: z.number().int().min(-100000).max(100000).refine((value) => value !== 0), reason: z.string().trim().min(2).max(240) }).parse(req.body);
  const size = z.string().min(1).max(20).parse(req.params.size);
  const result = await transaction(async (client) => {
    const existing = await client.query(`SELECT CASE WHEN metadata->'inventory' IS NULL OR metadata->'inventory' = '{}'::jsonb
      THEN jsonb_build_object('One Size', inventory) ELSE metadata->'inventory' END AS "stockBySize"
      FROM products WHERE id = $1 FOR UPDATE`, [req.params.productId]);
    if (!existing.rows[0]) return null;
    const stockBySize = existing.rows[0].stockBySize || {};
    if (!(size in stockBySize)) return { error: 'This size does not exist for the product.' };
    const currentStock = Number(stockBySize[size]) || 0;
    const actualChange = input.change < 0 ? Math.max(input.change, -currentStock) : input.change;
    if (actualChange === 0) return { error: 'This size has no stock left to remove.' };
    const newStock = currentStock + actualChange;
    stockBySize[size] = newStock;
    const totalStock = Object.values(stockBySize).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    await client.query(`UPDATE products SET inventory = $2,
      metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{inventory}', $3::jsonb, true), updated_at = NOW()
      WHERE id = $1`, [req.params.productId, totalStock, JSON.stringify(stockBySize)]);
    await client.query('INSERT INTO inventory_adjustments (product_id, size, change, reason, actor_user_id) VALUES ($1, $2, $3, $4, $5)', [req.params.productId, size, actualChange, input.reason, req.user.sub]);
    return { stock: newStock, change: actualChange };
  });
  if (result === null) return res.status(404).json({ error: 'Product size was not found.' });
  if (result.error) return res.status(400).json(result);
  await logAudit({ req, action: 'inventory.adjusted', targetType: 'product', targetId: req.params.productId, metadata: { size, change: result.change, reason: input.reason } });
  res.json({ stock: result.stock, change: result.change });
});
router.delete('/products/:id', requirePermission('products.delete'), async (req, res) => { const result = await query('DELETE FROM products WHERE id = $1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Product not found.' }); await logAudit({ req, action: 'product.deleted', targetType: 'product', targetId: req.params.id }); res.status(204).end(); });

// --- Administrator accounts (staff/manager/admin/super_admin) ---
const adminUserCreateInput = z.object({ name: z.string().min(2).max(100), email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()), role: z.enum(['staff', 'manager', 'admin', 'super_admin']) });

async function countActiveSuperAdmins(excludeId) {
  const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE role = 'super_admin' AND is_active = true AND id <> $1`, [excludeId || -1]);
  return rows[0].n;
}

router.get('/admin-users', requirePermission('admins.view'), async (req, res) => {
  const { rows } = await query(`SELECT id::text, email, name, role, is_active AS "isActive", created_at AS "createdAt" FROM users WHERE role = ANY($1) ORDER BY created_at DESC`, [MANAGEABLE_ROLES]);
  res.json(rows);
});

router.post('/admin-users', requirePermission('admins.manage'), async (req, res) => {
  const input = adminUserCreateInput.parse(req.body);
  // The account starts with an unusable random password. The only way to
  // sign in is to set a real one via the emailed setup link — the same
  // token-based flow used for password resets.
  const randomPassword = crypto.randomBytes(24).toString('hex');
  const passwordHash = await bcrypt.hash(randomPassword, 12);
  try {
    const { rows } = await query('INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id::text, email, name, role, is_active AS "isActive", created_at AS "createdAt"', [input.email, input.name, passwordHash, input.role]);
    const token = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    await query(`INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '24 hours')`, [rows[0].id, hash]);
    const baseUrl = adminPublicOrigin();
    await sendAdminWelcome({ to: rows[0].email, name: rows[0].name, resetUrl: `${baseUrl}/login.html?reset=${token}` });
    await logAudit({ req, action: 'admin_user.created', targetType: 'user', targetId: rows[0].id, metadata: { email: input.email, role: input.role } });
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'An account already exists for this email.' });
    throw error;
  }
});

router.patch('/admin-users/:id', requirePermission('admins.manage'), async (req, res) => {
  const isActive = z.boolean().parse(req.body?.isActive);
  if (String(req.user.sub) === req.params.id) return res.status(400).json({ error: 'You cannot change your own account status.' });
  if (!isActive && (await countActiveSuperAdmins(req.params.id)) === 0) {
    const target = await query(`SELECT role FROM users WHERE id = $1`, [req.params.id]);
    if (target.rows[0]?.role === 'super_admin') return res.status(400).json({ error: 'At least one active Super Admin must remain.' });
  }
  const { rows } = await query(`UPDATE users SET is_active = $1, session_version = session_version + CASE WHEN is_active IS DISTINCT FROM $1 THEN 1 ELSE 0 END WHERE id = $2 AND role = ANY($3) RETURNING id::text, is_active AS "isActive"`, [isActive, req.params.id, MANAGEABLE_ROLES]);
  if (!rows[0]) return res.status(404).json({ error: 'Administrator not found.' });
  await logAudit({ req, action: isActive ? 'admin_user.enabled' : 'admin_user.disabled', targetType: 'user', targetId: req.params.id });
  res.json(rows[0]);
});

router.delete('/admin-users/:id', requirePermission('admins.manage'), async (req, res) => {
  if (String(req.user.sub) === req.params.id) return res.status(400).json({ error: 'You cannot delete your own account.' });
  const target = await query(`SELECT role FROM users WHERE id = $1`, [req.params.id]);
  if (target.rows[0]?.role === 'super_admin' && (await countActiveSuperAdmins(req.params.id)) === 0) return res.status(400).json({ error: 'At least one active Super Admin must remain.' });
  const result = await query(`DELETE FROM users WHERE id = $1 AND role = ANY($2)`, [req.params.id, MANAGEABLE_ROLES]);
  if (!result.rowCount) return res.status(404).json({ error: 'Administrator not found.' });
  await logAudit({ req, action: 'admin_user.deleted', targetType: 'user', targetId: req.params.id });
  res.status(204).end();
});

// --- Audit log ---
router.get('/audit-logs', requirePermission('audit.view'), async (req, res) => {
  const { rows } = await query(`SELECT a.id::text, a.actor_email AS "actorEmail", u.name AS "actorName", u.role AS "actorRole", a.action, a.target_type AS "targetType", a.target_id AS "targetId", a.metadata, a.ip, a.created_at AS "createdAt" FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_user_id ORDER BY a.created_at DESC LIMIT 200`);
  res.json(rows);
});
// --- Contact messages ---
router.get('/messages', requirePermission('customers.view'), async (req, res) => {
  const { rows } = await query(`SELECT id::text, name, email, message, is_read AS "isRead", created_at AS "createdAt" FROM contact_messages ORDER BY created_at DESC LIMIT 200`);
  res.json(rows);
});
router.get('/newsletter-subscribers', requirePermission('content.manage'), async (req, res) => {
  const { rows } = await query(`SELECT id::text, email, confirmed_at AS "confirmedAt", consented_at AS "consentedAt"
    FROM newsletter_subscribers WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL
    ORDER BY confirmed_at DESC LIMIT 5000`);
  res.json(rows);
});
router.patch('/messages/:id', requirePermission('customers.view'), async (req, res) => {
  const isRead = z.boolean().parse(req.body?.isRead);
  const { rows } = await query('UPDATE contact_messages SET is_read = $1 WHERE id = $2 RETURNING id::text, is_read AS "isRead"', [isRead, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Message not found.' });
  res.json(rows[0]);
});
router.delete('/messages/:id', requirePermission('customers.edit'), async (req, res) => {
  const result = await query('DELETE FROM contact_messages WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Message not found.' });
  res.status(204).end();
});

// --- Customers (real users with role = 'customer') ---
router.get('/customers', requirePermission('customers.view'), async (req, res) => {
  const { rows } = await query(`SELECT u.id::text, u.name, u.email, u.is_active AS "isActive", u.created_at AS "createdAt",
    coalesce(
      (SELECT nullif(btrim(o.shipping_address->>'phone'), '') FROM orders o WHERE o.user_id = u.id AND nullif(btrim(o.shipping_address->>'phone'), '') IS NOT NULL ORDER BY o.created_at DESC LIMIT 1),
      (SELECT nullif(btrim(a.phone), '') FROM addresses a WHERE a.user_id = u.id ORDER BY a.is_default DESC, a.created_at DESC LIMIT 1)
    ) AS phone,
    count(o.id) FILTER (WHERE o.status <> 'cancelled')::int AS "orderCount",
    max(o.created_at) FILTER (WHERE o.status <> 'cancelled') AS "lastOrder",
    coalesce(sum(o.total_cents) FILTER (WHERE o.payment_status = 'paid' AND o.status <> 'cancelled'), 0)::bigint AS "totalSpentCents",
    count(*) OVER (PARTITION BY lower(btrim(u.email)))::int AS "matchingEmailAccounts"
    FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer'
    GROUP BY u.id ORDER BY u.created_at DESC`);
  res.json(rows);
});
router.get('/customers/:id', requirePermission('customers.view'), async (req, res) => {
  const { rows } = await query(`SELECT id::text, name, email, is_active AS "isActive", created_at AS "createdAt" FROM users WHERE id = $1 AND role = 'customer'`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });
  const { rows: orders } = await query(`SELECT o.id::text, o.status, o.payment_status AS "paymentStatus", o.payment_method AS "paymentMethod", o.total_cents AS "totalCents", o.created_at AS "createdAt", o.shipping_address AS "shippingAddress",
    coalesce((SELECT sum(i.quantity)::int FROM order_items i WHERE i.order_id = o.id), 0) AS "itemCount"
    FROM orders o WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [req.params.id]);
  const { rows: addresses } = await query(`SELECT id::text, label, name, phone, address1, city, country, postal_code AS "postalCode", is_default AS "isDefault" FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`, [req.params.id]);
  res.json({ ...rows[0], orders, addresses });
});
router.patch('/customers/:id', requirePermission('customers.disable'), async (req, res) => {
  const isActive = z.boolean().parse(req.body?.isActive);
  const { rows } = await query(`UPDATE users SET is_active = $1, session_version = session_version + CASE WHEN is_active IS DISTINCT FROM $1 THEN 1 ELSE 0 END WHERE id = $2 AND role = 'customer' RETURNING id::text, is_active AS "isActive"`, [isActive, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });
  await logAudit({ req, action: isActive ? 'customer.enabled' : 'customer.disabled', targetType: 'user', targetId: req.params.id });
  res.json(rows[0]);
});

// --- Discounts ---
const discountInput = z.object({
  code: z.string().min(2).max(40).transform((v) => v.toUpperCase().trim()),
  type: z.enum(['percent', 'fixed']),
  value: z.coerce.number().int().positive(),
  minSubtotal: z.coerce.number().min(0).default(0),
  usageLimit: z.coerce.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional().or(z.literal('')),
});
router.get('/discounts', requirePermission('discounts.manage'), async (req, res) => {
  const { rows } = await query(`SELECT id::text, code, type, value, min_subtotal_cents AS "minSubtotalCents", usage_limit AS "usageLimit", used_count AS "usedCount", is_active AS "isActive", expires_at AS "expiresAt", created_at AS "createdAt" FROM discounts ORDER BY created_at DESC`);
  res.json(rows);
});
router.post('/discounts', requirePermission('discounts.manage'), async (req, res) => {
  const d = discountInput.parse(req.body);
  try {
    const { rows } = await query('INSERT INTO discounts (code, type, value, min_subtotal_cents, usage_limit, expires_at) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id::text, code, type, value, min_subtotal_cents AS "minSubtotalCents", usage_limit AS "usageLimit", used_count AS "usedCount", is_active AS "isActive", expires_at AS "expiresAt"', [d.code, d.type, d.value, Math.round(d.minSubtotal * 100), d.usageLimit || null, d.expiresAt || null]);
    await logAudit({ req, action: 'discount.created', targetType: 'discount', targetId: rows[0].id, metadata: { code: d.code } });
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'A discount code with that code already exists.' });
    throw error;
  }
});
router.patch('/discounts/:id', requirePermission('discounts.manage'), async (req, res) => {
  const isActive = z.boolean().parse(req.body?.isActive);
  const { rows } = await query('UPDATE discounts SET is_active = $1 WHERE id = $2 RETURNING id::text, is_active AS "isActive"', [isActive, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Discount not found.' });
  res.json(rows[0]);
});
router.delete('/discounts/:id', requirePermission('discounts.manage'), async (req, res) => {
  const result = await query('DELETE FROM discounts WHERE id = $1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Discount not found.' });
  await logAudit({ req, action: 'discount.deleted', targetType: 'discount', targetId: req.params.id });
  res.status(204).end();
});

// --- Store settings ---
const settingsInput = z.object({
  storeName: z.string().min(1).max(100).optional(),
  supportEmail: z.string().email().max(254).optional(),
  currency: z.string().min(2).max(10).optional(),
  standardShipping: z.coerce.number().min(0).optional(),
  expressShipping: z.coerce.number().min(0).optional(),
  freeShippingThreshold: z.coerce.number().min(0).optional(),
});
router.get('/settings', requirePermission('settings.view'), async (req, res) => {
  const { rows } = await query(`SELECT store_name AS "storeName", support_email AS "supportEmail", currency, standard_shipping_cents AS "standardShippingCents", express_shipping_cents AS "expressShippingCents", free_shipping_threshold_cents AS "freeShippingThresholdCents" FROM store_settings WHERE id = 1`);
  res.json(rows[0]);
});
router.patch('/settings', requirePermission('settings.edit'), async (req, res) => {
  const s = settingsInput.parse(req.body);
  const { rows } = await query(
    `UPDATE store_settings SET
      store_name = coalesce($1, store_name),
      support_email = coalesce($2, support_email),
      currency = coalesce($3, currency),
      standard_shipping_cents = coalesce($4, standard_shipping_cents),
      express_shipping_cents = coalesce($5, express_shipping_cents),
      free_shipping_threshold_cents = coalesce($6, free_shipping_threshold_cents),
      updated_at = NOW()
    WHERE id = 1
    RETURNING store_name AS "storeName", support_email AS "supportEmail", currency, standard_shipping_cents AS "standardShippingCents", express_shipping_cents AS "expressShippingCents", free_shipping_threshold_cents AS "freeShippingThresholdCents"`,
    [s.storeName ?? null, s.supportEmail ?? null, s.currency ?? null, s.standardShipping != null ? Math.round(s.standardShipping * 100) : null, s.expressShipping != null ? Math.round(s.expressShipping * 100) : null, s.freeShippingThreshold != null ? Math.round(s.freeShippingThreshold * 100) : null],
  );
  await logAudit({ req, action: 'settings.updated', targetType: 'settings', targetId: '1' });
  res.json(rows[0]);
});

export default router;
