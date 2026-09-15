import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../lib/db.js';

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 12) {
  throw new Error('Usage: npm run reset:admin -- admin@example.com a-new-strong-password (12+ characters)');
}
try {
  const passwordHash = await bcrypt.hash(password, 12);
  const { rowCount } = await pool.query(`UPDATE users SET password_hash = $1 WHERE email = $2 AND role IN ('admin', 'super_admin') AND is_active = true`, [passwordHash, email.toLowerCase().trim()]);
  if (!rowCount) throw new Error('No active admin account exists with that email. Use seed:admin to create one.');
  console.log('Admin password reset. You can sign in with the new password.');
} finally {
  await pool.end();
}
