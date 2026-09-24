import 'dotenv/config';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../lib/db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const migrations = (await readdir(path.join(__dirname, '../migrations'))).filter((name) => name.endsWith('.sql')).sort();
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  let applied = 0;
  for (const migration of migrations) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock($1)', [724061]);
      const prior = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [migration]);
      if (prior.rowCount) {
        await client.query('COMMIT');
        continue;
      }
      await client.query(await readFile(path.join(__dirname, '../migrations', migration), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration]);
      await client.query('COMMIT');
      applied += 1;
      console.log(`Applied ${migration}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  console.log(`Migration complete (${applied} new, ${migrations.length - applied} already applied).`);
} finally { await pool.end(); }
