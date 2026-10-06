const DEFAULT_API_ORIGIN = 'https://nuvanti-production.up.railway.app';

function getPublicCatalogCacheKey(requestUrl, path, origin) {
  const cacheUrl = new URL(requestUrl.origin);
  cacheUrl.pathname = requestUrl.pathname;

  if (path === 'products') {
    const allowedParameters = ['category', 'collection', 'limit', 'offset'];
    for (const parameter of requestUrl.searchParams.keys()) {
      if (!allowedParameters.includes(parameter) || requestUrl.searchParams.getAll(parameter).length !== 1) {
        return null;
      }
    }
    for (const parameter of allowedParameters) {
      const value = requestUrl.searchParams.get(parameter);
      if (value !== null) cacheUrl.searchParams.set(parameter, value);
    }
  } else if (requestUrl.search) {
    return null;
  }

  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  return new Request(cacheUrl.toString(), { method: 'GET', headers });
}

export async function onRequest({ request, params, env, context }) {
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

  // These endpoints are public and return the same catalog data for every
  // visitor. Short edge caching reduces repeat database reads; credentials
  // are intentionally not forwarded on these public GET requests.
  const isPublicCatalogRead = request.method === 'GET'
    && (path === 'products'
      || /^products\/[^/]+$/.test(path)
      || path === 'categories'
      || path === 'navigation');
  const cacheKey = isPublicCatalogRead
    ? getPublicCatalogCacheKey(incoming, path, request.headers.get('Origin'))
    : null;
  const cache = cacheKey ? caches.default : null;

  if (cache && cacheKey) {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    } catch {
      // Keep the catalog available if the edge cache is temporarily unavailable.
    }
  }

  // Preserve browser credentials for private requests. The public catalog
  // requests below deliberately omit them so cache entries stay anonymous.
  const upstreamHeaders = new Headers(request.headers);
  if (isPublicCatalogRead) {
    upstreamHeaders.delete('Cookie');
    upstreamHeaders.delete('Authorization');
  }
  const upstreamRequest = isPublicCatalogRead
    ? new Request(upstream, { method: 'GET', headers: upstreamHeaders, redirect: 'manual' })
    : new Request(upstream, request);
  let response = await fetch(upstreamRequest, { cache: 'no-store', redirect: 'manual' });

  if (cache && cacheKey && response.status === 200
    && response.headers.get('content-type')?.includes('application/json')
    && !response.headers.has('set-cookie')) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=0, s-maxage=15');
    response = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    try {
      context.waitUntil(cache.put(cacheKey, response.clone()));
    } catch {
      // A cache write failure must not fail the customer request.
    }
  }

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
