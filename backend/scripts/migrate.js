import 'dotenv/config';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../lib/db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try { await pool.query(await readFile(path.join(__dirname, '../migrations/001_init.sql'), 'utf8')); console.log('Migration complete.'); } finally { await pool.end(); }
