import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../lib/db.js';
import { productPayload } from '../lib/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const products = JSON.parse(await readFile(path.join(__dirname, '../data/products.json'), 'utf8'));
const categories = JSON.parse(await readFile(path.join(__dirname, '../data/categories.json'), 'utf8')).categories;
const email = process.env.NUVANTI_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.NUVANTI_BOOTSTRAP_ADMIN_PASSWORD;
const name = process.env.NUVANTI_BOOTSTRAP_ADMIN_NAME?.trim() || 'Nuvanti Owner';

try {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [724062]);

    const { rows: setup } = await client.query("SELECT setup_key FROM deployment_setup WHERE setup_key = 'initial_catalog'");
    if (!setup.length) {
      for (const category of categories) {
        await client.query(
          'INSERT INTO categories (slug, name, image_url) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
          [category.slug, category.name, category.image],
        );
      }
      for (const item of products) {
        const p = productPayload(item);
        await client.query(
          `INSERT INTO products (slug,name,description,price_cents,category,collection,images,colors,sizes,inventory,is_active,metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12::jsonb)
           ON CONFLICT (slug) DO NOTHING`,
          [p.slug,p.name,p.description,p.priceCents,p.category,p.collection,JSON.stringify(p.images),JSON.stringify(p.colors),JSON.stringify(p.sizes),p.inventory,p.isActive,JSON.stringify(p.metadata)],
        );
      }
      await client.query("INSERT INTO deployment_setup (setup_key) VALUES ('initial_catalog')");
      console.log(`Initial catalog created (${products.length} products).`);
    } else {
      console.log('Initial catalog already set up; leaving live catalog and inventory unchanged.');
    }

    const { rows: admins } = await client.query("SELECT id FROM users WHERE role = 'super_admin' AND is_active = true LIMIT 1");
    if (!admins.length) {
      if (!email || !password || password.length < 12) {
        throw new Error('Set NUVANTI_BOOTSTRAP_ADMIN_EMAIL and a private NUVANTI_BOOTSTRAP_ADMIN_PASSWORD of at least 12 characters for the first deployment.');
      }
      const { rows: emailMatch } = await client.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
      if (emailMatch.length) throw new Error('The bootstrap email already belongs to an account. Choose a unique administrator email.');
      const passwordHash = await bcrypt.hash(password, 12);
      await client.query(
        "INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, 'super_admin')",
        [email, name, passwordHash],
      );
      console.log(`Initial administrator created for ${email}.`);
    } else {
      console.log('Active super administrator already exists; bootstrap credentials were not used.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
