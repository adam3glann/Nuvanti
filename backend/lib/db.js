import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is missing. Add it to your hosting service's environment variables; locally, set it in backend/.env.",
  );
}

// Keep TLS certificate verification enabled in production. Supabase's
// PostgreSQL CA may not be present in the host's default trust store, so allow
// the deployment to provide Supabase's public CA certificate as an env var.
// Remove URL SSL parameters because node-postgres lets them override the
// explicit `ssl` object (including its CA certificate).
function getProductionConnectionString(connectionString) {
  const url = new URL(connectionString);
  for (const key of ["sslmode", "sslrootcert", "sslcert", "sslkey"]) {
    url.searchParams.delete(key);
  }
  return url.toString();
}

function getSslConfig() {
  if (process.env.NODE_ENV !== "production") return false;

  const rawCa = process.env.DATABASE_SSL_CA?.replace(/\\r?\\n/g, "\n").trim();
  // Environment-variable forms may flatten pasted PEM newlines. Rebuild the
  // standard PEM layout before passing it to Node's TLS implementation.
  const caMatch = rawCa?.match(
    /-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/,
  );
  const ca = caMatch
    ? `-----BEGIN CERTIFICATE-----\n${caMatch[1]
        .replace(/\s+/g, "")
        .match(/.{1,64}/g)
        .join("\n")}\n-----END CERTIFICATE-----`
    : rawCa;
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

export const pool = new Pool({
  connectionString:
    process.env.NODE_ENV === "production"
      ? getProductionConnectionString(process.env.DATABASE_URL)
      : process.env.DATABASE_URL,
  ssl: getSslConfig(),
  // Keep per-process usage configurable for small hosts and poolers such as
  // Supavisor/PgBouncer. This is a per-instance limit, so multiply it by the
  // maximum app instances when setting the database connection budget.
  max: Math.max(1, Math.min(50, Number(process.env.DB_POOL_MAX) || 10)),
  connectionTimeoutMillis: Math.max(
    1000,
    Math.min(30000, Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10000),
  ),
  idleTimeoutMillis: Math.max(
    1000,
    Math.min(300000, Number(process.env.DB_IDLE_TIMEOUT_MS) || 30000),
  ),
});

// PostgreSQL emits this when an idle pooled connection drops. Without a
// listener, Node treats the EventEmitter error as fatal and exits the process.
pool.on("error", (error) => {
  console.error("Idle database client error:", error.code || error.message);
});

export async function query(text, params) {
  const startedAt = performance.now();
  try {
    return await pool.query(text, params);
  } finally {
    const durationMs = performance.now() - startedAt;
    const threshold = Number(process.env.SLOW_QUERY_LOG_MS || 750);
    if (
      Number.isFinite(threshold) &&
      threshold > 0 &&
      durationMs >= threshold
    ) {
      // Log duration and operation only. Avoid query text and bind values,
      // which can contain private customer data.
      const operation =
        /^\s*(SELECT|INSERT|UPDATE|DELETE|WITH)\b/i
          .exec(text)?.[1]
          ?.toUpperCase() || "QUERY";
      console.warn("Slow database query", {
        operation,
        durationMs: Math.round(durationMs),
      });
    }
  }
}

export async function transaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
