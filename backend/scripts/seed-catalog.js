import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../lib/db.js';
import { productPayload } from '../lib/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const products = JSON.parse(await readFile(path.join(__dirname, '../data/products.json'), 'utf8'));
const categoryData = JSON.parse(await readFile(path.join(__dirname, '../data/categories.json'), 'utf8')).categories;
try {
  for (const category of categoryData) {
    await pool.query('INSERT INTO categories (slug, name, image_url) VALUES ($1, $2, $3) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, image_url = EXCLUDED.image_url', [category.slug, category.name, category.image]);
  }
  for (const item of products) {
    const p = productPayload(item);
    await pool.query(`INSERT INTO products (slug, name, description, price_cents, category, collection, images, colors, sizes, inventory, is_active, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, price_cents=EXCLUDED.price_cents, category=EXCLUDED.category, collection=EXCLUDED.collection, images=EXCLUDED.images, colors=EXCLUDED.colors, sizes=EXCLUDED.sizes, inventory=EXCLUDED.inventory, is_active=EXCLUDED.is_active, metadata=EXCLUDED.metadata, updated_at=NOW()`, [p.slug,p.name,p.description,p.priceCents,p.category,p.collection,JSON.stringify(p.images),JSON.stringify(p.colors),JSON.stringify(p.sizes),p.inventory,p.isActive,JSON.stringify(p.metadata)]);
  }
  console.log(`Catalog seeded (${products.length} products).`);
} finally { await pool.end(); }
