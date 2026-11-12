import { Router } from "express";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";

const router = Router();
const selection = z.object({ color: z.string().max(60), size: z.string().max(20) });
const line = z.object({
  productId: z.coerce.number().int().positive(),
  slug: z.string().max(160), name: z.string().max(160),
  image: z.string().max(500).optional().default(""),
  price: z.coerce.number().min(0), size: z.string().max(20),
  color: z.string().max(60), quantity: z.coerce.number().int().min(1).max(10),
  bundleSelection: z.object({ crewneck: selection, sweatpants: selection }).optional(),
});

router.get("/", requireAuth, async (req, res) => {
  const { rows } = await query("SELECT items, updated_at AS \"updatedAt\" FROM customer_carts WHERE user_id = $1", [req.user.sub]);
  res.set("Cache-Control", "no-store").json({ userId: String(req.user.sub), items: rows[0]?.items || [], updatedAt: rows[0]?.updatedAt || null });
});

router.put("/", requireAuth, async (req, res) => {
  const items = z.array(line).max(30).parse(req.body?.items);
  await query(
    `INSERT INTO customer_carts (user_id, items, updated_at, reminder_sent_at)
     VALUES ($1, $2::jsonb, NOW(), NULL)
     ON CONFLICT (user_id) DO UPDATE SET items = EXCLUDED.items, updated_at = NOW(), reminder_sent_at = NULL`,
    [req.user.sub, JSON.stringify(items)],
  );
  res.status(204).end();
});

export default router;
