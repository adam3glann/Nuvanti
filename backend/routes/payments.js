import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query, transaction } from '../lib/db.js';
import { isConfiguredPaymobIntegration, paymobReady, verifyPaymobCallback } from '../lib/paymob.js';
import { requireAuth } from '../lib/auth.js';
import { sendOrderConfirmation } from '../lib/mail.js';
import { storePublicOrigin } from '../lib/publicOrigins.js';

const router = Router();
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false });
router.get('/config', (req, res) => res.json({ onlinePaymentEnabled: paymobReady() }));

// Paymob must reach this endpoint directly, so it is mounted before the
// browser same-origin/CSRF middleware. HMAC is mandatory before any DB write.
router.post('/paymob/webhook', webhookLimiter, async (req, res) => {
  const obj = req.body?.obj;
  const signature = req.query.hmac || req.body?.hmac;
  if (req.body?.type !== 'TRANSACTION' || !verifyPaymobCallback(obj, signature)) {
    return res.status(401).json({ error: 'Invalid payment callback.' });
  }
  const providerOrderId = String(obj.order?.id || '');
  const transactionId = String(obj.id);
  const callbackAmount = Number(obj.amount_cents);
  if (!providerOrderId || !Number.isSafeInteger(callbackAmount) || obj.currency !== 'EGP' || !isConfiguredPaymobIntegration(obj.integration_id)) {
    return res.status(400).json({ error: 'Invalid payment data.' });
  }

  const result = await transaction(async (client) => {
    const { rows } = await client.query(`SELECT o.id, o.status, o.payment_status AS "paymentStatus", o.total_cents AS "totalCents",
      o.subtotal_cents AS "subtotalCents", o.shipping_cents AS "shippingCents", o.discount_cents AS "discountCents",
      o.discount_code AS "discountCode", o.delivery, o.shipping_address AS shipping, u.email, u.name,
      o.tracking_token AS "trackingToken"
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE o.payment_provider = 'paymob' AND o.payment_provider_order_id = $1 FOR UPDATE OF o`, [providerOrderId]);
    const order = rows[0];
    if (!order || Number(order.totalCents) !== callbackAmount) return { invalid: true };
    if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') return { duplicate: true };
    const paid = obj.success === true && obj.pending === false && obj.is_voided !== true && obj.is_refunded !== true;
    const refunded = obj.is_refunded === true || obj.is_voided === true;
    if (paid) {
      await client.query(`UPDATE orders SET payment_status = 'paid', payment_transaction_id = $1,
        payment_updated_at = NOW(), status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END WHERE id = $2`, [transactionId, order.id]);
      const { rows: items } = await client.query(`SELECT product_name AS name, unit_price_cents AS "priceCents", quantity, color, size
        FROM order_items WHERE order_id = $1 ORDER BY id`, [order.id]);
      return { paid: true, order, items };
    }
    if (refunded) {
      await client.query("UPDATE orders SET payment_status = 'refunded', payment_transaction_id = $1, payment_updated_at = NOW() WHERE id = $2", [transactionId, order.id]);
      return { refunded: true, order };
    }
    if (order.paymentStatus === 'pending') {
      await client.query("UPDATE orders SET payment_status = 'failed', payment_transaction_id = $1, payment_updated_at = NOW() WHERE id = $2", [transactionId, order.id]);
    }
    return { failed: true };
  });
  if (result.invalid) return res.status(400).json({ error: 'Payment does not match an order.' });
  if (result.paid) {
    const order = result.order;
    const trackingUrl = `${storePublicOrigin()}/track.html?order=${order.id}&token=${encodeURIComponent(order.trackingToken)}`;
    sendOrderConfirmation({ to: order.email, name: order.shipping?.name || order.name || 'Customer', orderId: order.id,
      items: result.items, totalCents: order.totalCents, subtotalCents: order.subtotalCents, discountCents: order.discountCents,
      discountCode: order.discountCode, shippingCents: order.shippingCents, delivery: order.delivery,
      shippingAddress: order.shipping, trackingUrl }).catch((error) => console.error(`Paid order email failed for NV-${order.id}:`, error));
  }
  res.status(200).json({ received: true });
});

router.get('/:id/status', requireAuth, async (req, res) => {
  const id = String(req.params.id);
  if (!/^\d{1,18}$/.test(id)) return res.status(400).json({ error: 'Invalid order.' });
  const { rows } = await query(`SELECT id, status, payment_status AS "paymentStatus", payment_method AS "paymentMethod"
    FROM orders WHERE id = $1 AND user_id = $2`, [id, req.user.sub]);
  if (!rows[0]) return res.status(404).json({ error: 'Order not found.' });
  res.json(rows[0]);
});

export default router;
