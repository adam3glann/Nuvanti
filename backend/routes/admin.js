import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../lib/db.js';
import { productPayload, toPublicProduct } from '../lib/catalog.js';
import { requirePermission } from '../lib/permissions.js';
import { logAudit } from '../lib/audit.js';
import { sendAdminWelcome } from '../lib/mail.js';
const router = Router();
const MANAGEABLE_ROLES = ['staff', 'manager', 'admin', 'super_admin'];
const productFields = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).max(160), name: z.string().min(2).max(160), description: z.string().max(5000).optional(), price: z.coerce.number().min(0).optional(), priceCents: z.coerce.number().int().min(0).optional(), category: z.string().min(1).max(80), collection: z.string().max(80).nullable().optional(), images: z.array(z.string()).max(12).optional(), colors: z.array(z.string().max(40)).max(20).optional(), sizes: z.array(z.string().max(20)).max(20).optional(), inventory: z.union([z.coerce.number().int().min(0), z.record(z.coerce.number().int().min(0))]).optional(), status: z.enum(['active', 'draft']).optional(), isActive: z.boolean().optional(), badges: z.array(z.string().max(30)).optional(), featured: z.boolean().optional(), bestseller: z.boolean().optional(), newArrival: z.boolean().optional(), sku: z.string().max(100).optional(), compareAtPrice: z.coerce.number().min(0).nullable().optional() });
const productInput = productFields.refine((value) => value.price !== undefined || value.priceCents !== undefined, { message: 'Price is required.' });
const columns = 'id, slug, name, description, price_cents, category, collection, images, colors, sizes, inventory, is_active, metadata';
const categoryInput = z.object({ name: z.string().min(2).max(80), slug: z.string().regex(/^[a-z0-9-]+$/).max(80), description: z.string().max(1000).optional() });
const collectionInput = z.object({ name: z.string().min(2).max(80), slug: z.string().regex(/^[a-z0-9-]+$/).max(80) });
router.get('/dashboard', requirePermission('analytics.view'), async (req, res) => { const { rows } = await query(`SELECT (SELECT count(*)::int FROM orders) AS "orders", (SELECT count(*)::int FROM products WHERE is_active) AS "products", (SELECT count(*)::int FROM users WHERE role = 'customer') AS "customers", (SELECT coalesce(sum(total_cents), 0)::bigint FROM orders WHERE status <> 'cancelled') AS "revenueCents"`); res.json(rows[0]); });
router.get('/products', requirePermission('products.view'), async (req, res) => { const { rows } = await query(`SELECT ${columns} FROM products ORDER BY updated_at DESC`); res.json(rows.map(toPublicProduct)); });
const PAYMENT_METHOD_LABELS = { cod: 'Cash on Delivery' };
router.get('/orders', requirePermission('orders.view'), async (req, res) => {
  const { rows } = await query(`SELECT o.id, o.status, o.total_cents AS "totalCents", o.subtotal_cents AS "subtotalCents", o.shipping_cents AS "shippingCents", o.delivery, o.payment_method AS "paymentMethod", o.created_at AS "createdAt", o.shipping_address AS "shippingAddress", u.email, u.name,
    coalesce(json_agg(json_build_object('productId', i.product_id, 'name', i.product_name, 'price', i.unit_price_cents::numeric / 100, 'quantity', i.quantity, 'color', i.color, 'size', i.size, 'image', i.image_url)) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
    FROM orders o JOIN users u ON u.id = o.user_id LEFT JOIN order_items i ON i.order_id = o.id GROUP BY o.id, u.email, u.name ORDER BY o.created_at DESC LIMIT 100`);
  res.json(rows.map((row) => ({
    id: `NV-${row.id}`, dbId: String(row.id), status: row.status, paymentStatus: row.status === 'paid' ? 'paid' : 'pending',
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
router.patch('/orders/:id', requirePermission('orders.edit'), async (req, res) => { const status = z.enum(['pending', 'paid', 'fulfilled', 'cancelled']).parse(req.body?.status); const { rows } = await query('UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status', [status, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Order not found.' }); await logAudit({ req, action: 'order.status_changed', targetType: 'order', targetId: rows[0].id, metadata: { status } }); res.json(rows[0]); });
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
    const baseUrl = process.env.ADMIN_APP_URL || process.env.ADMIN_ORIGIN || 'http://localhost:4001';
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
  const { rows } = await query(`UPDATE users SET is_active = $1 WHERE id = $2 AND role = ANY($3) RETURNING id::text, is_active AS "isActive"`, [isActive, req.params.id, MANAGEABLE_ROLES]);
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
export default router;
