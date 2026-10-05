const DEFAULT_ADMIN_ORIGIN = 'https://nuvanti-production.up.railway.app';

export async function onRequest({ request, env, params }) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed.', { status: 405, headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  let origin;
  try {
    const configured = new URL(env.NUVANTI_API_ORIGIN || DEFAULT_ADMIN_ORIGIN);
    if (configured.protocol !== 'https:' || configured.username || configured.password || configured.pathname !== '/' || configured.search || configured.hash) {
      return new Response('Admin gateway is not configured securely.', { status: 503 });
    }
    origin = configured.origin;
  } catch {
    return new Response('Admin gateway is not configured securely.', { status: 503 });
  }

  const incoming = new URL(request.url);
  const requestedPath = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  const safePath = requestedPath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  const path = safePath && safePath !== 'index.html' ? `/${safePath}` : '/login.html';
  const target = new URL(path, origin);
  target.search = incoming.search;
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
