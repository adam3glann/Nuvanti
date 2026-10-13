import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../lib/auth.js";
import { query, transaction } from "../lib/db.js";

const router = Router();
const addressInput = z.object({
  label: z.string().min(1).max(40).default("Home"),
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

router.get("/", async (req, res) => {
  const { rows } = await query(
    `SELECT ${columns} FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [req.user.sub],
  );
  res.json(rows);
});

router.post("/", async (req, res) => {
  const a = addressInput.parse(req.body);
  const created = await transaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [req.user.sub]);
    const { rows: existing } = await client.query(
      "SELECT 1 FROM addresses WHERE user_id = $1 LIMIT 1", [req.user.sub],
    );
    const isDefault = a.isDefault === true || existing.length === 0;
    if (isDefault) await client.query(
      "UPDATE addresses SET is_default = false WHERE user_id = $1", [req.user.sub],
    );
    const { rows } = await client.query(
      `INSERT INTO addresses (user_id, label, name, phone, address1, city, country, postal_code, is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${columns}`,
      [req.user.sub, a.label, a.name, a.phone || null, a.address1, a.city, a.country, a.postalCode, isDefault],
    );
    return rows[0];
  });
  res.status(201).json(created);
});

router.patch("/:id", async (req, res) => {
  const a = addressInput.partial().parse(req.body);
  const updated = await transaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [req.user.sub]);
    const existing = await client.query(
      `SELECT ${columns} FROM addresses WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [req.params.id, req.user.sub],
    );
    if (!existing.rows[0]) return null;
    const merged = { ...existing.rows[0], ...a };
    let promoteId = null;
    if (existing.rows[0].isDefault && a.isDefault === false) {
      const { rows: otherAddresses } = await client.query(
        "SELECT id FROM addresses WHERE user_id = $1 AND id <> $2 ORDER BY created_at DESC, id DESC LIMIT 1",
        [req.user.sub, req.params.id],
      );
      if (otherAddresses[0]) promoteId = otherAddresses[0].id;
      else merged.isDefault = true;
    }
    if (a.isDefault === true || (existing.rows[0].isDefault && a.isDefault === false)) await client.query(
      "UPDATE addresses SET is_default = false WHERE user_id = $1", [req.user.sub],
    );
    const { rows } = await client.query(
      `UPDATE addresses SET label=$1, name=$2, phone=$3, address1=$4, city=$5, country=$6, postal_code=$7, is_default=$8 WHERE id=$9 AND user_id=$10 RETURNING ${columns}`,
      [merged.label, merged.name, merged.phone || null, merged.address1, merged.city, merged.country, merged.postalCode, !!merged.isDefault, req.params.id, req.user.sub],
    );
    if (promoteId) await client.query(
      "UPDATE addresses SET is_default = TRUE WHERE id = $1", [promoteId],
    );
    return rows[0];
  });
  if (!updated) return res.status(404).json({ error: "Address not found." });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const deleted = await transaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [req.user.sub]);
    const result = await client.query(
      "DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id, is_default",
      [req.params.id, req.user.sub],
    );
    if (!result.rowCount) return false;
    if (result.rows[0].is_default) await client.query(
      `UPDATE addresses SET is_default = TRUE WHERE id = (
        SELECT id FROM addresses WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1
      )`, [req.user.sub],
    );
    return true;
  });
  if (!deleted)
    return res.status(404).json({ error: "Address not found." });
  res.status(204).end();
});

export default router;
