import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db.js';
const [email, password, name = 'Nuvanti Administrator'] = process.argv.slice(2);
if (!email || !password || password.length < 12) throw new Error('Usage: npm run seed:admin -- admin@example.com a-strong-password [name]. Password needs 12+ chars.');
try { const hash = await bcrypt.hash(password, 12); await pool.query(`INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,'super_admin') ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = 'super_admin', is_active = true, session_version = users.session_version + 1`, [email.toLowerCase(), name, hash]); console.log(`Admin ready: ${email}`); } finally { await pool.end(); }
