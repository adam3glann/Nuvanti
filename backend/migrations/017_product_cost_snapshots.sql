-- Snapshot each product's current cost onto new order lines so editing a
-- product's cost later cannot rewrite the historical gross-profit calculation.
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS unit_cost_cents INTEGER CHECK (unit_cost_cents IS NULL OR unit_cost_cents >= 0);
