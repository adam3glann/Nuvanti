import 'dotenv/config';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../lib/db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  const migrations = (await readdir(path.join(__dirname, '../migrations'))).filter((name) => name.endsWith('.sql')).sort();
  for (const migration of migrations) await pool.query(await readFile(path.join(__dirname, '../migrations', migration), 'utf8'));
  console.log(`Migration complete (${migrations.length} files).`);
} finally { await pool.end(); }
