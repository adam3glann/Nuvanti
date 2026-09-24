import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. For Railway, add it under your service Variables; locally, set it in backend/.env.');
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

  const rawCa = process.env.DATABASE_SSL_CA?.replace(/\\r?\\n/g, '\n').trim();
  // Environment-variable forms may flatten pasted PEM newlines. Rebuild the
  // standard PEM layout before passing it to Node's TLS implementation.
  const caMatch = rawCa?.match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/);
  const ca = caMatch
    ? `-----BEGIN CERTIFICATE-----\n${caMatch[1].replace(/\s+/g, '').match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----`
    : rawCa;
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

export const pool = new Pool({
  connectionString: process.env.NODE_ENV === 'production'
    ? getProductionConnectionString(process.env.DATABASE_URL)
    : process.env.DATABASE_URL,
  ssl: getSslConfig(),
  max: 10,
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
