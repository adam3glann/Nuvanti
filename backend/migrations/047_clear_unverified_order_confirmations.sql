-- Previous storefront behavior marked COD orders confirmed before WhatsApp
-- opened. That click did not prove the customer had sent the message.
UPDATE orders
SET customer_confirmed_at = NULL
WHERE customer_confirmed_at IS NOT NULL;
