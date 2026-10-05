const DEFAULT_ADMIN_ORIGIN = 'https://nuvanti-production.up.railway.app';

export async function onRequest({ request, env }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  try {
    const configured = new URL(env.NUVANTI_API_ORIGIN || DEFAULT_ADMIN_ORIGIN);
    if (configured.protocol !== 'https:' || configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) {
      return new Response('Admin gateway is not configured securely.', { status: 503 });
    }
    const target = new URL('/login.html', configured.origin);
    target.search = new URL(request.url).search;
    return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  } catch {
    return new Response('Admin gateway is not configured securely.', { status: 503 });
  }
}
