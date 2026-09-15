import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';

const router = Router();
const productSchema = z.object({ slug: z.string().regex(/^[a-z0-9-]+$/).max(160), name: z.string().min(2).max(160), description: z.string().max(5000).default(''), priceCents: z.coerce.number().int().min(0), category: z.string().min(1).max(80), collection: z.string().max(80).nullable().optional(), images: z.array(z.string().url()).max(12).default([]), colors: z.array(z.string().max(40)).max(20).default([]), sizes: z.array(z.string().max(20)).max(20).default([]), inventory: z.coerce.number().int().min(0).max(100000), isActive: z.boolean().default(true) });

router.get('/dashboard', async (req, res) => {
  const { rows } = await query(`SELECT (SELECT count(*)::int FROM orders) AS "orders", (SELECT count(*)::int FROM products WHERE is_active) AS "products", (SELECT count(*)::int FROM users WHERE role = 'customer') AS "customers", (SELECT coalesce(sum(total_cents), 0)::bigint FROM orders WHERE status <> 'cancelled') AS "revenueCents"`);
  res.json(rows[0]);
});
router.get('/orders', async (req, res) => { const { rows } = await query('SELECT o.id, o.status, o.total_cents AS "totalCents", o.created_at AS "createdAt", u.email, u.name FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created_at DESC LIMIT 100'); res.json(rows); });
router.post('/products', async (req, res) => { const p = productSchema.parse(req.body); try { const { rows } = await query('INSERT INTO products (slug, name, description, price_cents, category, collection, images, colors, sizes, inventory, is_active) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id, slug', [p.slug,p.name,p.description,p.priceCents,p.category,p.collection ?? null,p.images,p.colors,p.sizes,p.inventory,p.isActive]); res.status(201).json(rows[0]); } catch (error) { if (error.code === '23505') return res.status(409).json({ error: 'A product with that slug already exists.' }); throw error; } });
router.patch('/products/:id', async (req, res) => { const p = productSchema.partial().parse(req.body); const keys = Object.keys(p); if (!keys.length) return res.status(400).json({ error: 'No fields supplied.' }); const columns = { priceCents: 'price_cents', isActive: 'is_active' }; const values = keys.map((key) => p[key]); const sets = keys.map((key, i) => `${columns[key] || key} = $${i + 1}`).join(', '); const { rows } = await query(`UPDATE products SET ${sets}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING id, slug`, [...values, req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Product not found.' }); res.json(rows[0]); });
export default router;
