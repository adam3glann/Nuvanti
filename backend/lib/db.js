import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.');
}

// Keep TLS certificate verification enabled in production. Supabase's
// PostgreSQL CA may not be present in the host's default trust store, so allow
// the deployment to provide Supabase's public CA certificate as an env var.
// Remove URL SSL parameters because node-postgres lets them override the
// explicit `ssl` object (including its CA certificate).
function getProductionConnectionString(connectionString) {
  const url = new URL(connectionString);
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) {
    url.searchParams.delete(key);
  }
  return url.toString();
}

function getSslConfig() {
  if (process.env.NODE_ENV !== 'production') return false;

  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim();
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

export const pool = new Pool({
  connectionString: process.env.NODE_ENV === 'production'
    ? getProductionConnectionString(process.env.DATABASE_URL)
    : process.env.DATABASE_URL,
  ssl: getSslConfig(),
  max: process.env.NUVANTI_NETLIFY_FUNCTION === 'true' ? 2 : 10,
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
