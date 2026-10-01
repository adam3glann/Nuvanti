import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const BACKUP_ARRAYS = [
  'customers', 'products', 'categories', 'collections', 'homepageSlides',
  'storeSettings', 'discounts', 'orders', 'orderItems', 'addresses',
  'contactMessages', 'newsletterSubscribers', 'inventoryAdjustments',
  'auditLogs',
];

const RESTORE_LIMITS = {
  customers: 10000, products: 5000, categories: 1000, collections: 1000,
  homepageSlides: 1000, storeSettings: 1, discounts: 10000, orders: 50000,
  orderItems: 250000, addresses: 50000, contactMessages: 50000,
  newsletterSubscribers: 100000, inventoryAdjustments: 250000, auditLogs: 250000,
};

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateStoreBackup(backup) {
  if (!isRecord(backup) || backup.format !== 'nuvanti-store-backup' || backup.version !== 1) {
    throw new Error('This is not a supported Nuvanti store backup file.');
  }
  for (const key of BACKUP_ARRAYS) {
    if (!Array.isArray(backup[key])) throw new Error(`The backup is missing its ${key} data.`);
    if (backup[key].length > RESTORE_LIMITS[key]) throw new Error(`The backup has too many ${key} records.`);
    if (!backup[key].every(isRecord)) throw new Error(`The ${key} section contains invalid data.`);
  }
  for (const [key, rows] of Object.entries(backup)) {
    if (Array.isArray(rows) && !BACKUP_ARRAYS.includes(key) && key !== 'administrators') {
      throw new Error(`The backup contains an unsupported section: ${key}.`);
    }
  }
  if (backup.storefrontMetrics !== null && !isRecord(backup.storefrontMetrics)) {
    throw new Error('The storefront metrics section is invalid.');
  }
  if (!Object.hasOwn(backup, 'storefrontMetrics')) {
    throw new Error('The backup is missing its storefront metrics section.');
  }
  if (backup.storeSettings.length !== 1 || Number(backup.storeSettings[0]?.id) !== 1) {
    throw new Error('The backup does not contain the store settings record.');
  }
  return backup;
}

function json(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

async function insertRows(client, table, columns, records, valuesForRow) {
  const batchSize = 100;
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize);
    const values = [];
    const tuples = batch.map((record) => {
      const rowValues = valuesForRow(record);
      const placeholders = rowValues.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${tuples.join(', ')}`,
      values,
    );
  }
}

async function advanceSequence(client, table, column = 'id') {
  await client.query(
    `SELECT setval(pg_get_serial_sequence($1, $2), COALESCE((SELECT MAX(${column}) FROM ${table}), 1), EXISTS (SELECT 1 FROM ${table}))`,
    [table, column],
  );
}

export async function restoreStoreBackup(client, backup) {
  validateStoreBackup(backup);

  // Preserve usable passwords for matching customers already on this database.
  const { rows: existingCustomers } = await client.query(
    "SELECT email, password_hash AS \"passwordHash\" FROM users WHERE role = 'customer'",
  );
  const hashesByEmail = new Map(existingCustomers.map((row) => [row.email.toLowerCase(), row.passwordHash]));
  const passwordlessCustomers = backup.customers.filter(
    (customer) => !hashesByEmail.has(String(customer.email || '').toLowerCase()),
  );
  const generatedPasswordHash = passwordlessCustomers.length
    ? await bcrypt.hash(crypto.randomBytes(48).toString('base64url'), 12)
    : null;

  // The file is a complete snapshot of exported store data. Existing staff
  // accounts and their authentication/MFA state are deliberately preserved.
  await client.query(`LOCK TABLE users, products, categories, collections, homepage_slides,
    store_settings, discounts, orders, order_items, addresses, contact_messages,
    newsletter_subscribers, inventory_adjustments, audit_logs, storefront_metrics
    IN SHARE ROW EXCLUSIVE MODE`);
  await client.query(`
    DELETE FROM orders;
    DELETE FROM addresses;
    DELETE FROM inventory_adjustments;
    DELETE FROM audit_logs;
    DELETE FROM contact_messages;
    DELETE FROM newsletter_subscribers;
    DELETE FROM discounts;
    DELETE FROM homepage_slides;
    DELETE FROM store_settings;
    DELETE FROM collections;
    DELETE FROM categories;
    DELETE FROM products;
    DELETE FROM users WHERE role = 'customer';
  `);

  await insertRows(client, 'users', [
    'id', 'email', 'name', 'password_hash', 'role', 'is_active', 'email_verified_at', 'created_at',
  ], backup.customers, (row) => [
    row.id, row.email, row.name,
    hashesByEmail.get(String(row.email || '').toLowerCase()) || generatedPasswordHash,
    'customer', row.isActive !== false, row.emailVerifiedAt || null, row.createdAt,
  ]);

  await insertRows(client, 'categories', [
    'id', 'slug', 'name', 'description', 'image_url', 'is_active', 'menu_show', 'menu_label',
    'menu_style', 'menu_background_color', 'menu_background_end_color', 'menu_text_color',
    'menu_icon', 'menu_animation', 'menu_desktop_appearance', 'menu_mobile_appearance', 'created_at',
  ], backup.categories, (row) => [
    row.id, row.slug, row.name, row.description || '', row.imageUrl || null,
    row.isActive !== false, row.menuShow === true, row.menuLabel || null, row.menuStyle || 'link',
    row.menuBackgroundColor || null, row.menuBackgroundEndColor || null, row.menuTextColor || null,
    row.menuIcon || 'none', row.menuAnimation || 'none',
    json(row.menuDesktopAppearance, {}), json(row.menuMobileAppearance, {}), row.createdAt,
  ]);

  await insertRows(client, 'collections', [
    'id', 'slug', 'name', 'is_active', 'menu_show', 'menu_label', 'menu_style',
    'menu_background_color', 'menu_background_end_color', 'menu_text_color', 'menu_icon',
    'menu_animation', 'menu_desktop_appearance', 'menu_mobile_appearance', 'created_at',
  ], backup.collections, (row) => [
    row.id, row.slug, row.name, row.isActive !== false, row.menuShow === true, row.menuLabel || null,
    row.menuStyle || 'link', row.menuBackgroundColor || null, row.menuBackgroundEndColor || null,
    row.menuTextColor || null, row.menuIcon || 'none', row.menuAnimation || 'none',
    json(row.menuDesktopAppearance, {}), json(row.menuMobileAppearance, {}), row.createdAt,
  ]);

  await insertRows(client, 'products', [
    'id', 'slug', 'name', 'description', 'price_cents', 'category', 'collection',
    'images', 'colors', 'sizes', 'inventory', 'is_active', 'metadata', 'created_at', 'updated_at',
  ], backup.products, (row) => [
    row.id, row.slug, row.name, row.description || '', row.priceCents, row.category,
    row.collection || null, json(row.images, []), json(row.colors, []), json(row.sizes, []),
    row.inventory || 0, row.isActive !== false, json(row.metadata, {}), row.createdAt, row.updatedAt,
  ]);

  await insertRows(client, 'homepage_slides', [
    'id', 'image_url', 'mobile_image_url', 'eyebrow', 'title', 'description', 'cta_label',
    'cta_href', 'secondary_label', 'secondary_href', 'position', 'duration_seconds',
    'text_color', 'eyebrow_color', 'title_color', 'description_color', 'button_text_color',
    'title_gradient_enabled', 'title_gradient_start', 'title_gradient_end', 'text_gradients',
    'text_fonts', 'is_active', 'created_at', 'updated_at',
  ], backup.homepageSlides, (row) => [
    row.id, row.image_url, row.mobile_image_url || null, row.eyebrow || '', row.title,
    row.description || '', row.cta_label, row.cta_href, row.secondary_label || '',
    row.secondary_href || '', row.position, row.duration_seconds || 5, row.text_color || '#f5f2eb',
    row.eyebrow_color || null, row.title_color || null, row.description_color || null,
    row.button_text_color || null, row.title_gradient_enabled !== false,
    row.title_gradient_start || '#83a88a', row.title_gradient_end || '#f5f2eb',
    json(row.text_gradients, {}), json(row.text_fonts, {}), row.is_active !== false,
    row.created_at, row.updated_at,
  ]);

  await insertRows(client, 'store_settings', [
    'id', 'store_name', 'support_email', 'currency', 'standard_shipping_cents',
    'express_shipping_cents', 'free_shipping_threshold_cents', 'updated_at',
  ], backup.storeSettings, (row) => [
    row.id, row.store_name, row.support_email, row.currency, row.standard_shipping_cents,
    row.express_shipping_cents, row.free_shipping_threshold_cents, row.updated_at,
  ]);

  await insertRows(client, 'discounts', [
    'id', 'code', 'type', 'value', 'min_subtotal_cents', 'usage_limit', 'used_count',
    'is_active', 'expires_at', 'created_at',
  ], backup.discounts, (row) => [
    row.id, row.code, row.type, row.value, row.minSubtotalCents || 0, row.usageLimit ?? null,
    row.usedCount || 0, row.isActive !== false, row.expiresAt || null, row.createdAt,
  ]);

  await insertRows(client, 'orders', [
    'id', 'user_id', 'status', 'subtotal_cents', 'shipping_cents', 'total_cents',
    'shipping_address', 'created_at', 'discount_code', 'discount_cents', 'delivery',
    'payment_method', 'payment_status', 'payment_provider', 'payment_updated_at',
  ], backup.orders, (row) => [
    row.id, row.userId, row.status, row.subtotalCents, row.shippingCents, row.totalCents,
    json(row.shippingAddress, {}), row.createdAt, row.discountCode || null, row.discountCents || 0,
    row.delivery || 'standard', row.paymentMethod || 'cod', row.paymentStatus || 'pending',
    row.paymentProvider || null, row.paymentUpdatedAt || null,
  ]);

  await insertRows(client, 'order_items', [
    'id', 'order_id', 'product_id', 'product_name', 'unit_price_cents', 'unit_cost_cents',
    'quantity', 'color', 'size', 'image_url',
  ], backup.orderItems, (row) => [
    row.id, row.orderId, row.productId, row.productName, row.unitPriceCents,
    row.unitCostCents ?? null, row.quantity, row.color || null, row.size || null, row.imageUrl || null,
  ]);

  await insertRows(client, 'addresses', [
    'id', 'user_id', 'label', 'name', 'phone', 'address1', 'city', 'country',
    'postal_code', 'is_default', 'created_at',
  ], backup.addresses, (row) => [
    row.id, row.userId, row.label, row.name, row.phone || null, row.address1,
    row.city, row.country, row.postalCode, row.isDefault === true, row.createdAt,
  ]);

  await insertRows(client, 'contact_messages', [
    'id', 'name', 'email', 'message', 'is_read', 'created_at',
  ], backup.contactMessages, (row) => [row.id, row.name, row.email, row.message, row.isRead === true, row.createdAt]);

  const subscribers = backup.newsletterSubscribers.map((row) => ({ ...row, restoreUnsubscribeHash: crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex') }));
  await insertRows(client, 'newsletter_subscribers', [
    'id', 'email', 'consented_at', 'confirmation_token_hash', 'confirmation_expires_at',
    'unsubscribe_token_hash', 'confirmed_at', 'unsubscribed_at', 'created_at',
  ], subscribers, (row) => [
    row.id, row.email, row.consentedAt, null, null, row.restoreUnsubscribeHash,
    row.confirmedAt || null, row.unsubscribedAt || null, row.createdAt,
  ]);

  await insertRows(client, 'inventory_adjustments', [
    'id', 'product_id', 'size', 'change', 'reason', 'actor_user_id', 'created_at',
  ], backup.inventoryAdjustments, (row) => [
    row.id, row.productId, row.size, row.change, row.reason, null, row.createdAt,
  ]);

  await insertRows(client, 'audit_logs', [
    'id', 'actor_user_id', 'actor_email', 'action', 'target_type', 'target_id', 'metadata', 'ip', 'created_at',
  ], backup.auditLogs, (row) => [
    row.id, null, row.actorEmail || null, row.action, row.targetType || null,
    row.targetId || null, json(row.metadata, {}), null, row.createdAt,
  ]);

  if (backup.storefrontMetrics) {
    await client.query(
      `INSERT INTO storefront_metrics (id, total_views, updated_at) VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET total_views = EXCLUDED.total_views, updated_at = EXCLUDED.updated_at`,
      [backup.storefrontMetrics.totalViews || 0, backup.storefrontMetrics.updatedAt || new Date().toISOString()],
    );
  } else {
    await client.query('UPDATE storefront_metrics SET total_views = 0, updated_at = NOW() WHERE id = 1');
  }

  for (const table of ['users', 'categories', 'collections', 'products', 'homepage_slides', 'discounts', 'orders', 'order_items', 'addresses', 'contact_messages', 'newsletter_subscribers', 'inventory_adjustments', 'audit_logs']) {
    await advanceSequence(client, table);
  }

  return {
    customers: backup.customers.length,
    customersNeedingPasswordReset: passwordlessCustomers.length,
    products: backup.products.length,
    orders: backup.orders.length,
    orderItems: backup.orderItems.length,
    messages: backup.contactMessages.length,
    subscribers: backup.newsletterSubscribers.length,
  };
}
