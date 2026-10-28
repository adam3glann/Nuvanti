const isProduction = process.env.NODE_ENV === "production";
const deploymentOrigin = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.RENDER_EXTERNAL_URL ||
  (isProduction
    ? "https://nuvanti-production.up.railway.app"
    : "http://localhost:4000");

function originFrom(value, fallback) {
  const raw = String(value || "")
    .trim()
    .replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  if (!raw) return fallback;
  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `${isProduction ? "https" : "http"}://${raw}`;
    const parsed = new URL(candidate);
    if (isProduction && ["localhost", "127.0.0.1"].includes(parsed.hostname))
      return fallback;
    if (isProduction && parsed.protocol !== "https:")
      parsed.protocol = "https:";
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function storePublicOrigin() {
  return originFrom(
    process.env.STORE_ORIGIN,
    isProduction ? "https://nuvanti-shop.pages.dev" : "http://localhost:8080",
  );
}

export function adminPublicOrigin() {
  return originFrom(
    deploymentOrigin || process.env.ADMIN_APP_URL || process.env.ADMIN_ORIGIN,
    isProduction ? deploymentOrigin : "http://localhost:4001",
  );
}

export function apiPublicOrigin() {
  return originFrom(deploymentOrigin || process.env.API_PUBLIC_URL, deploymentOrigin);
}
