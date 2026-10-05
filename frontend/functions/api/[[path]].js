const DEFAULT_API_ORIGIN = 'https://nuvanti-production.up.railway.app';

export async function onRequest({ request, params, env }) {
  const incoming = new URL(request.url);
  let apiOrigin;
  try {
    const configured = new URL(env.NUVANTI_API_ORIGIN || DEFAULT_API_ORIGIN);
    if (configured.protocol !== 'https:' || configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) {
      return new Response('API proxy is not configured securely.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    apiOrigin = configured.origin;
  } catch {
    return new Response('API proxy is not configured securely.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  const segments = Array.isArray(params.path) ? params.path : [params.path || ''];
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return new Response('Invalid API path.', { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const path = segments.map((segment) => encodeURIComponent(String(segment))).join('/');
  const upstream = new URL(`/api/${path}`, apiOrigin);
  upstream.search = incoming.search;

  // Preserve the real browser Origin and cookies so Railway's origin checks run.
  const upstreamRequest = new Request(upstream, request);
  const response = await fetch(upstreamRequest, { cache: 'no-store', redirect: 'manual' });
  const headers = new Headers(response.headers);

  // Keep Railway's session cookies host-only on the storefront domain.
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) {
    headers.delete('Set-Cookie');
    for (const cookie of cookies) {
      headers.append('Set-Cookie', cookie.replace(/;\s*Domain=[^;]+/i, ''));
    }
  }

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
