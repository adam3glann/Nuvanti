import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { query } from '../lib/db.js';

const router = Router();
const addressInput = z.object({
  label: z.string().min(1).max(40).default('Home'),
  name: z.string().min(2).max(100),
  phone: z.string().max(30).optional(),
  address1: z.string().min(3).max(150),
  city: z.string().min(2).max(80),
  country: z.string().min(2).max(80),
  postalCode: z.string().min(1).max(20),
  isDefault: z.boolean().optional(),
});
const columns = `id::text, label, name, phone, address1, city, country, postal_code AS "postalCode", is_default AS "isDefault"`;

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { rows } = await query(`SELECT ${columns} FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`, [req.user.sub]);
  res.json(rows);
});

router.post('/', async (req, res) => {
  const a = addressInput.parse(req.body);
  if (a.isDefault) await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.sub]);
  const { rows } = await query(`INSERT INTO addresses (user_id, label, name, phone, address1, city, country, postal_code, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${columns}`, [req.user.sub, a.label, a.name, a.phone || null, a.address1, a.city, a.country, a.postalCode, !!a.isDefault]);
  res.status(201).json(rows[0]);
});

router.patch('/:id', async (req, res) => {
  const a = addressInput.partial().parse(req.body);
  const existing = await query(`SELECT ${columns} FROM addresses WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.sub]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Address not found.' });
  const merged = { ...existing.rows[0], ...a };
  if (a.isDefault) await query('UPDATE addresses SET is_default = false WHERE user_id = $1', [req.user.sub]);
  const { rows } = await query(`UPDATE addresses SET label=$1, name=$2, phone=$3, address1=$4, city=$5, country=$6, postal_code=$7, is_default=$8 WHERE id=$9 AND user_id=$10 RETURNING ${columns}`, [merged.label, merged.name, merged.phone || null, merged.address1, merged.city, merged.country, merged.postalCode, !!merged.isDefault, req.params.id, req.user.sub]);
  res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const result = await query('DELETE FROM addresses WHERE id = $1 AND user_id = $2', [req.params.id, req.user.sub]);
  if (!result.rowCount) return res.status(404).json({ error: 'Address not found.' });
  res.status(204).end();
});

export default router;
