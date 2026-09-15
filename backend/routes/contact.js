import { Router } from 'express';
import { z } from 'zod';
import { query } from '../lib/db.js';
const router = Router();
const messageSchema = z.object({ name: z.string().min(2).max(100).trim(), email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()), message: z.string().min(10).max(5000).trim() });
router.post('/', async (req, res) => { const message = messageSchema.parse(req.body); await query('INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3)', [message.name, message.email, message.message]); res.status(201).json({ ok: true }); });
export default router;
