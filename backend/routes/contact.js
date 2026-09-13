import { Router } from 'express';
import { readJSON, writeJSON } from '../lib/store.js';

const router = Router();

// POST /api/contact — stores contact-form submissions to data/messages.json.
// Wire up a real email service (e.g. Resend, SendGrid, Nodemailer + SMTP) here later.
router.post('/', async (req, res) => {
  const { name, email, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email and message are required' });
  }
  let messages = [];
  try { messages = await readJSON('messages'); } catch { messages = []; }
  messages.push({ id: `MSG-${Date.now()}`, name, email, message, createdAt: new Date().toISOString() });
  await writeJSON('messages', messages);
  res.status(201).json({ ok: true });
});

export default router;
