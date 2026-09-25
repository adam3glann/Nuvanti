const DEFAULT_API_ORIGIN = 'https://nuvanti-production.up.railway.app';

export async function onRequest({ request, params, env }) {
  const incoming = new URL(request.url);
  const apiOrigin = String(env.NUVANTI_API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, '');
  const path = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const upstream = new URL(`${apiOrigin}/api/${path}`);
  upstream.search = incoming.search;

  // Preserve the real browser Origin and cookies so Railway's origin checks run.
  const upstreamRequest = new Request(upstream, request);
  const response = await fetch(upstreamRequest, { cache: 'no-store' });
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
