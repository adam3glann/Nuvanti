import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, transaction } from '../lib/db.js';
import { productPayload, toPublicProduct } from '../lib/catalog.js';
import { hasPermission, requirePermission } from '../lib/permissions.js';
import { logAudit } from '../lib/audit.js';
import { emailDeliveryStatus, sendAdminWelcome, sendTestEmail, sendOrderStatusUpdate } from '../lib/mail.js';
import { adminPublicOrigin, storePublicOrigin } from '../lib/publicOrigins.js';
const router = Router();
const MANAGEABLE_ROLES = ['staff', 'manager', 'admin', 'super_admin'];
const productFields = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).max(160), name: z.string().min(2).max(160), description: z.string().max(5000).optional(), price: z.coerce.number().min(0).max(99999.99).optional(), priceCents: z.coerce.number().int().min(0).max(9999999).optional(), category: z.string().min(1).max(80), collection: z.string().max(80).nullable().optional(), images: z.array(z.string()).max(12).optional(), colors: z.array(z.string().max(40)).max(20).optional(), sizes: z.array(z.string().max(20)).max(20).optional(), inventory: z.union([z.coerce.number().int().min(0), z.record(z.coerce.number().int().min(0))]).optional(), status: z.enum(['active', 'draft']).optional(), isActive: z.boolean().optional(), badges: z.array(z.string().max(30)).optional(), featured: z.boolean().optional(), bestseller: z.boolean().optional(), newArrival: z.boolean().optional(), sku: z.string().max(100).optional(), compareAtPrice: z.coerce.number().min(0).max(99999.99).nullable().optional() });
const productInput = productFields.refine((value) => value.price !== undefined || value.priceCents !== undefined, { message: 'Price is required.' });
const columns = 'id, slug, name, description, price_cents, category, collection, images, colors, sizes, inventory, is_active, metadata';
const categoryInput = z.object({ name: z.string().min(2).max(80), slug: z.string().regex(/^[a-z0-9-]+$/).max(80), description: z.string().max(1000).optional() });
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
  isActive: z.boolean().default(true),
}).refine((slide) => !slide.secondaryLabel || slide.secondaryHref, { message: 'Add a link for the secondary button.' });
const homepageSlideColumns = 'id::text, image_url AS "imageUrl", eyebrow, title, description, cta_label AS "ctaLabel", cta_href AS "ctaHref", secondary_label AS "secondaryLabel", secondary_href AS "secondaryHref", position, is_active AS "isActive"';
router.get('/homepage-slides', requirePermission('content.manage'), async (req, res) => {
  const { rows } = await query(`SELECT ${homepageSlideColumns} FROM homepage_slides ORDER BY position, id`);
  res.json(rows);
});
router.post('/homepage-slides', requirePermission('content.manage'), async (req, res) => {
  const slide = homepageSlideInput.parse(req.body);
  const { rows } = await query(`INSERT INTO homepage_slides (image_url, eyebrow, title, description, cta_label, cta_href, secondary_label, secondary_href, position, is_active)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${homepageSlideColumns}`,
  [slide.imageUrl, slide.eyebrow, slide.title, slide.description, slide.ctaLabel, slide.ctaHref, slide.secondaryLabel, slide.secondaryHref, slide.position, slide.isActive]);
  await logAudit({ req, action: 'homepage_slide.created', targetType: 'homepage_slide', targetId: rows[0].id, metadata: { title: slide.title } });
  res.status(201).json(rows[0]);
});
router.patch('/homepage-slides/:id', requirePermission('content.manage'), async (req, res) => {
  const current = await query(`SELECT ${homepageSlideColumns} FROM homepage_slides WHERE id = $1`, [req.params.id]);
  if (!current.rows[0]) return res.status(404).json({ error: 'Homepage slide not found.' });
  const slide = homepageSlideInput.parse({ ...current.rows[0], ...req.body });
  const { rows } = await query(`UPDATE homepage_slides SET image_url=$1, eyebrow=$2, title=$3, description=$4, cta_label=$5, cta_href=$6, secondary_label=$7, secondary_href=$8, position=$9, is_active=$10, updated_at=NOW()
    WHERE id=$11 RETURNING ${homepageSlideColumns}`,
  [slide.imageUrl, slide.eyebrow, slide.title, slide.description, slide.ctaLabel, slide.ctaHref, slide.secondaryLabel, slide.secondaryHref, slide.position, slide.isActive, req.params.id]);
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
router.get('/dashboard', requirePermission('analytics.view'), async (req, res) => { const { rows } = await query(`SELECT (SELECT count(*)::int FROM orders) AS "orders", (SELECT count(*)::int FROM products WHERE is_active) AS "products", (SELECT count(*)::int FROM users WHERE role = 'customer') AS "customers", (SELECT coalesce(sum(total_cents), 0)::bigint FROM orders WHERE status <> 'cancelled') AS "revenueCents"`); res.json(rows[0]); });
router.get('/analytics', requirePermission('analytics.view'), async (req, res) => {
  const days = ({ '7d': 7, '30d': 30, '90d': 90, '1y': 365 })[req.query.range] || 30;
  const { rows: series } = await query(`WITH days AS (
    SELECT generate_series(CURRENT_DATE - ($1::int - 1), CURRENT_DATE, interval '1 day')::date AS day
  )
  SELECT to_char(days.day, 'YYYY-MM-DD') AS date,
    coalesce(sum(o.total_cents) FILTER (WHERE o.status IN ('paid', 'fulfilled')), 0)::bigint AS "revenueCents",
    count(o.id)::int AS orders
  FROM days LEFT JOIN orders o ON o.created_at >= days.day
    AND o.created_at < days.day + interval '1 day' AND o.status IN ('paid', 'fulfilled')
  GROUP BY days.day ORDER BY days.day`, [days]);
  const { rows: topProducts } = await query(`SELECT i.product_name AS name, sum(i.quantity)::int AS "unitsSold",
    sum(i.unit_price_cents * i.quantity)::bigint AS "revenueCents"
    FROM orders o JOIN order_items i ON i.order_id = o.id
    WHERE o.status IN ('paid', 'fulfilled') AND o.created_at >= CURRENT_DATE - ($1::int - 1)
    GROUP BY i.product_id, i.product_name ORDER BY sum(i.unit_price_cents * i.quantity) DESC LIMIT 8`, [days]);
  const { rows: topCategories } = await query(`SELECT p.category AS name,
    sum(i.unit_price_cents * i.quantity)::bigint AS "revenueCents"
    FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id
    WHERE o.status IN ('paid', 'fulfilled') AND o.created_at >= CURRENT_DATE - ($1::int - 1)
    GROUP BY p.category ORDER BY sum(i.unit_price_cents * i.quantity) DESC LIMIT 8`, [days]);
  const { rows: counts } = await query(`SELECT count(*) FILTER (WHERE status = 'pending')::int AS "pendingOrders"
    FROM orders WHERE created_at >= CURRENT_DATE - ($1::int - 1)`, [days]);
  res.json({
    series: series.map((row) => ({ ...row, revenue: Number(row.revenueCents) / 100 })),
    topProducts: topProducts.map((row) => ({ ...row, revenue: Number(row.revenueCents) / 100 })),
    topCategories: topCategories.map((row) => ({ ...row, revenue: Number(row.revenueCents) / 100 })),
    pendingOrders: counts[0].pendingOrders,
  });
});
router.get('/products', requirePermission('products.view'), async (req, res) => { const { rows } = await query(`SELECT ${columns} FROM products ORDER BY updated_at DESC`); res.json(rows.map(toPublicProduct)); });
const PAYMENT_METHOD_LABELS = { cod: 'Cash on Delivery' };
router.get('/orders', requirePermission('orders.view'), async (req, res) => {
  const { rows } = await query(`SELECT o.id, o.status, o.total_cents AS "totalCents", o.subtotal_cents AS "subtotalCents", o.shipping_cents AS "shippingCents", o.delivery, o.payment_method AS "paymentMethod", o.created_at AS "createdAt", o.shipping_address AS "shippingAddress", u.email, u.name,
    coalesce(json_agg(json_build_object('productId', i.product_id, 'name', i.product_name, 'price', i.unit_price_cents::numeric / 100, 'quantity', i.quantity, 'color', i.color, 'size', i.size, 'image', i.image_url)) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
    FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN order_items i ON i.order_id = o.id GROUP BY o.id, u.email, u.name ORDER BY o.created_at DESC LIMIT 100`);
  res.json(rows.map((row) => ({
    id: `NV-${row.id}`, dbId: String(row.id), status: row.status, paymentStatus: ['paid', 'fulfilled'].includes(row.status) ? 'paid' : 'pending',
    total: Number(row.totalCents) / 100, totalCents: Number(row.totalCents),
    subtotal: Number(row.subtotalCents) / 100, shipping: Number(row.shippingCents) / 100,
    delivery: row.delivery, paymentMethod: PAYMENT_METHOD_LABELS[row.paymentMethod] || row.paymentMethod,
    createdAt: row.createdAt,
    customer: { name: row.name, email: row.email, phone: row.shippingAddress?.phone || '—' },
    shippingAddress: { ...row.shippingAddress, method: row.delivery === 'express' ? 'Express' : 'Standard' },
    trackingNumber: null, transactionRef: null,
    items: row.items, notes: [],
  })));
});
router.patch('/orders/:id', requirePermission('orders.edit'), async (req, res) => {
  const status = z.enum(['pending', 'paid', 'processing', 'shipped', 'out_for_delivery', 'fulfilled', 'cancelled']).parse(req.body?.status);
  if (status === 'cancelled' && !hasPermission(req.user.role, 'orders.cancel')) return res.status(403).json({ error: 'You do not have permission to cancel orders.' });
  const result = await transaction(async (client) => {
    const { rows } = await client.query('SELECT o.id, o.status, o.tracking_token AS "trackingToken", u.email, u.name FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1 FOR UPDATE OF o', [req.params.id]);
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
      const { rows: items } = await client.query(`SELECT product_id AS "productId", COALESCE(size, 'One Size') AS size, SUM(quantity)::int AS quantity
        FROM order_items WHERE order_id = $1 GROUP BY product_id, COALESCE(size, 'One Size')`, [order.id]);
      for (const item of items) {
        const { rows: products } = await client.query(`SELECT inventory, CASE WHEN metadata->'inventory' IS NULL OR metadata->'inventory' = '{}'::jsonb
          THEN jsonb_build_object('One Size', inventory) ELSE metadata->'inventory' END AS "stockBySize"
          FROM products WHERE id = $1 FOR UPDATE`, [item.productId]);
        if (!products[0]) continue;
        const stockBySize = products[0].stockBySize || { 'One Size': products[0].inventory };
        stockBySize[item.size] = Math.max(0, Number(stockBySize[item.size]) || 0) + item.quantity;
        const totalStock = Object.values(stockBySize).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
        await client.query(`UPDATE products SET inventory = $2,
          metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{inventory}', $3::jsonb, true), updated_at = NOW()
          WHERE id = $1`, [item.productId, totalStock, JSON.stringify(stockBySize)]);
        await client.query(`INSERT INTO inventory_adjustments (product_id, size, change, reason, actor_user_id)
          VALUES ($1, $2, $3, $4, $5)`, [item.productId, item.size, item.quantity, `Cancelled order NV-${order.id}`, req.user.sub]);
      }
    }
    const updated = await client.query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status', [status, order.id]);
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
router.get('/categories', requirePermission('products.view'), async (req, res) => { const { rows } = await query(`SELECT c.id::text, c.name, c.slug, c.description, c.is_active AS "isActive", count(p.id)::int AS "productCount" FROM categories c LEFT JOIN products p ON p.category = c.slug GROUP BY c.id ORDER BY c.name`); res.json(rows.map((c) => ({ ...c, status: c.isActive ? 'active' : 'disabled' }))); });
router.post('/categories', requirePermission('products.create'), async (req, res) => { const c = categoryInput.parse(req.body); const { rows } = await query('INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING id::text, name, slug, description, is_active AS "isActive"', [c.name, c.slug, c.description || '']); await logAudit({ req, action: 'category.created', targetType: 'category', targetId: rows[0].id, metadata: { name: c.name, slug: c.slug } }); res.status(201).json({ ...rows[0], productCount: 0, status: 'active' }); });
router.patch('/categories/:id', requirePermission('products.edit'), async (req, res) => { const isActive = z.boolean().parse(req.body?.isActive); const { rows } = await query('UPDATE categories SET is_active = $1 WHERE id = $2 RETURNING id::text, is_active AS "isActive"', [isActive, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Category not found.' }); res.json(rows[0]); });
router.delete('/categories/:id', requirePermission('products.delete'), async (req, res) => { const result = await query('DELETE FROM categories WHERE id = $1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Category not found.' }); await logAudit({ req, action: 'category.deleted', targetType: 'category', targetId: req.params.id }); res.status(204).end(); });
router.get('/collections', requirePermission('products.view'), async (req, res) => { const { rows } = await query(`SELECT c.id::text, c.name, c.slug, c.is_active AS "isActive", count(p.id)::int AS "productCount" FROM collections c LEFT JOIN products p ON p.collection = c.slug GROUP BY c.id ORDER BY c.name`); res.json(rows.map((c) => ({ ...c, status: c.isActive ? 'published' : 'draft' }))); });
router.post('/collections', requirePermission('products.create'), async (req, res) => { const c = collectionInput.parse(req.body); const { rows } = await query('INSERT INTO collections (name, slug) VALUES ($1, $2) RETURNING id::text, name, slug, is_active AS "isActive"', [c.name, c.slug]); await logAudit({ req, action: 'collection.created', targetType: 'collection', targetId: rows[0].id, metadata: { name: c.name, slug: c.slug } }); res.status(201).json({ ...rows[0], productCount: 0, status: 'published' }); });
router.patch('/collections/:id', requirePermission('products.edit'), async (req, res) => { const isActive = z.boolean().parse(req.body?.isActive); const { rows } = await query('UPDATE collections SET is_active = $1 WHERE id = $2 RETURNING id::text, is_active AS "isActive"', [isActive, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Collection not found.' }); res.json(rows[0]); });
router.delete('/collections/:id', requirePermission('products.delete'), async (req, res) => { const result = await query('DELETE FROM collections WHERE id = $1', [req.params.id]); if (!result.rowCount) return res.status(404).json({ error: 'Collection not found.' }); await logAudit({ req, action: 'collection.deleted', targetType: 'collection', targetId: req.params.id }); res.status(204).end(); });
router.post('/products', requirePermission('products.create'), async (req, res) => { const p = productPayload(productInput.parse(req.body)); try { const { rows } = await query(`INSERT INTO products (slug,name,description,price_cents,category,collection,images,colors,sizes,inventory,is_active,metadata) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb) RETURNING ${columns}`, [p.slug,p.name,p.description,p.priceCents,p.category,p.collection,JSON.stringify(p.images),JSON.stringify(p.colors),JSON.stringify(p.sizes),p.inventory,p.isActive,JSON.stringify(p.metadata)]); res.status(201).json(toPublicProduct(rows[0])); } catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'A product with that slug already exists.' }); throw error; } });
router.patch('/products/:id', requirePermission('products.edit'), async (req, res) => { const existing = await query(`SELECT ${columns} FROM products WHERE id = $1`, [req.params.id]); if (!existing.rows[0]) return res.status(404).json({ error: 'Product not found.' }); const current = toPublicProduct(existing.rows[0]); const p = productPayload(productInput.parse({ ...current, ...productFields.partial().parse(req.body) })); const { rows } = await query(`UPDATE products SET slug=$1,name=$2,description=$3,price_cents=$4,category=$5,collection=$6,images=$7::jsonb,colors=$8::jsonb,sizes=$9::jsonb,inventory=$10,is_active=$11,metadata=$12::jsonb,updated_at=NOW() WHERE id=$13 RETURNING ${columns}`, [p.slug,p.name,p.description,p.priceCents,p.category,p.collection,JSON.stringify(p.images),JSON.stringify(p.colors),JSON.stringify(p.sizes),p.inventory,p.isActive,JSON.stringify(p.metadata),req.params.id]); res.json(toPublicProduct(rows[0])); });
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
  const { rows } = await query(`SELECT u.id::text, u.name, u.email, u.is_active AS "isActive", u.created_at AS "createdAt", count(o.id)::int AS "orderCount", max(o.created_at) AS "lastOrder", coalesce(sum(o.total_cents) FILTER (WHERE o.status <> 'cancelled'), 0)::bigint AS "totalSpentCents" FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE u.role = 'customer' GROUP BY u.id ORDER BY u.created_at DESC`);
  res.json(rows);
});
router.get('/customers/:id', requirePermission('customers.view'), async (req, res) => {
  const { rows } = await query(`SELECT id::text, name, email, is_active AS "isActive", created_at AS "createdAt" FROM users WHERE id = $1 AND role = 'customer'`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Customer not found.' });
  const { rows: orders } = await query(`SELECT id::text, status, total_cents AS "totalCents", created_at AS "createdAt" FROM orders WHERE user_id = $1 ORDER BY created_at DESC`, [req.params.id]);
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
