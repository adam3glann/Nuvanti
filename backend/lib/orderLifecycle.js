import { transaction } from './db.js';

// Caller must lock and validate the order before releasing its stock reservation.
export async function restoreOrderInventory(client, orderId, reason, actorUserId = null) {
  const { rows: items } = await client.query(`SELECT product_id AS "productId",
      COALESCE(size, 'One Size') AS size, SUM(quantity)::int AS quantity
    FROM order_items WHERE order_id = $1
    GROUP BY product_id, COALESCE(size, 'One Size')
    ORDER BY product_id, COALESCE(size, 'One Size')`, [orderId]);
  for (const item of items) {
    const { rows: products } = await client.query(`SELECT inventory,
        CASE WHEN metadata->'inventory' IS NULL OR metadata->'inventory' = '{}'::jsonb
          THEN jsonb_build_object('One Size', inventory) ELSE metadata->'inventory' END AS "stockBySize"
      FROM products WHERE id = $1 FOR UPDATE`, [item.productId]);
    if (!products[0]) continue;
    const stockBySize = products[0].stockBySize || { 'One Size': products[0].inventory };
    stockBySize[item.size] = Math.max(0, Number(stockBySize[item.size]) || 0) + Number(item.quantity);
    const totalStock = Object.values(stockBySize).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    await client.query(`UPDATE products SET inventory = $2,
      metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{inventory}', $3::jsonb, true), updated_at = NOW()
      WHERE id = $1`, [item.productId, totalStock, JSON.stringify(stockBySize)]);
    await client.query(`INSERT INTO inventory_adjustments (product_id, size, change, reason, actor_user_id)
      VALUES ($1, $2, $3, $4, $5)`, [item.productId, item.size, item.quantity, reason, actorUserId]);
  }
}

// Paymob intentions expire after 30 minutes. A 15-minute callback grace period
// avoids releasing stock while a valid provider callback is still in flight.
export async function expireAbandonedPaymobOrders() {
  return transaction(async (client) => {
    const { rows: orders } = await client.query(`SELECT id, discount_code AS "discountCode"
      FROM orders
      WHERE status = 'pending' AND payment_method = 'paymob' AND payment_status = 'pending'
        AND payment_provider_order_id IS NOT NULL
        AND payment_updated_at < NOW() - INTERVAL '45 minutes'
      ORDER BY payment_updated_at
      LIMIT 25 FOR UPDATE SKIP LOCKED`);
    for (const order of orders) {
      await restoreOrderInventory(client, order.id, `Expired unpaid Paymob order NV-${order.id}`);
      if (order.discountCode) {
        await client.query('UPDATE discounts SET used_count = GREATEST(0, used_count - 1) WHERE code = $1', [order.discountCode]);
      }
      await client.query(`UPDATE orders SET status = 'cancelled', payment_status = 'failed', payment_updated_at = NOW()
        WHERE id = $1 AND status = 'pending' AND payment_status = 'pending'`, [order.id]);
    }
    return orders.length;
  });
}
