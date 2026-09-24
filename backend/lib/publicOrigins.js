const isProduction = process.env.NODE_ENV === 'production';
const railwayOrigin = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : (isProduction ? 'https://nuvanti-production.up.railway.app' : 'http://localhost:4000');

function originFrom(value, fallback) {
  const raw = String(value || '').trim().replace(/^(?:"(.*)"|'(.*)')$/, '$1$2');
  if (!raw) return fallback;
  try {
    const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(raw)
      ? raw
      : `${isProduction ? 'https' : 'http'}://${raw}`;
    const parsed = new URL(candidate);
    if (isProduction && ['localhost', '127.0.0.1'].includes(parsed.hostname)) return fallback;
    if (isProduction && parsed.protocol !== 'https:') parsed.protocol = 'https:';
    return parsed.origin;
  } catch {
    return fallback;
  }
}

export function storePublicOrigin() {
  return originFrom(process.env.STORE_ORIGIN, isProduction ? 'https://nuvanti-shop.pages.dev' : 'http://localhost:8080');
}

export function adminPublicOrigin() {
  return originFrom(process.env.ADMIN_APP_URL || process.env.ADMIN_ORIGIN || railwayOrigin, isProduction ? railwayOrigin : 'http://localhost:4001');
}

export function apiPublicOrigin() {
  return originFrom(process.env.API_PUBLIC_URL || railwayOrigin, railwayOrigin);
}
