import { transaction } from "./db.js";
import { sendAbandonedCartReminder } from "./mail.js";
import { storePublicOrigin } from "./publicOrigins.js";

export async function sendAbandonedCartReminders() {
  const claimed = await transaction(async client => {
    const { rows } = await client.query(
      `WITH candidates AS (
         SELECT c.user_id, c.items, c.updated_at, u.email, u.name
         FROM customer_carts c JOIN users u ON u.id = c.user_id
         WHERE c.reminder_sent_at IS NULL AND c.updated_at < NOW() - INTERVAL '2 hours'
           AND jsonb_typeof(c.items) = 'array' AND jsonb_array_length(c.items) > 0
           AND u.is_active = true AND u.role = 'customer' AND u.email_verified_at IS NOT NULL
         ORDER BY c.updated_at ASC LIMIT 50 FOR UPDATE OF c SKIP LOCKED
       )
       UPDATE customer_carts c SET reminder_sent_at = NOW()
       FROM candidates x WHERE c.user_id = x.user_id
       RETURNING x.user_id, x.items, x.updated_at AS cart_updated_at, x.email, x.name`,
    );
    return rows;
  });
  for (const cart of claimed) {
    try {
      await sendAbandonedCartReminder({
        to: cart.email,
        name: cart.name,
        items: cart.items,
        cartUrl: `${storePublicOrigin()}/cart.html`,
      });
    } catch (error) {
      await transaction(client => client.query(
        "UPDATE customer_carts SET reminder_sent_at = NULL WHERE user_id = $1 AND updated_at = $2",
        [cart.user_id, cart.cart_updated_at],
      ));
      console.error(`Abandoned cart reminder failed for account ${cart.user_id}:`, error);
    }
  }
  return claimed.length;
}
