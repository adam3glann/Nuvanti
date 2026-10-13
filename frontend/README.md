# Storefront deployment (Cloudflare Pages)

Set the Pages project root directory to `frontend`. The `functions/api/[[path]].js` function proxies `/api/*` to Railway so the storefront session cookie is first-party on mobile browsers.

The proxy defaults to `https://nuvanti-production.up.railway.app`. If that public domain changes, set the Cloudflare Pages environment variable `NUVANTI_API_ORIGIN` to the new HTTPS origin and redeploy.

In Railway, set `STORE_ORIGIN` to the exact public storefront origin (including `https://`, without a path), and leave `COOKIE_DOMAIN` blank. The function removes any upstream cookie domain so the browser stores the session only for the storefront host.

Set `NUVANTI_PROXY_IP_SECRET` to the same unique random value (at least 32 characters) in the Railway backend service and Cloudflare Pages environment variables, then redeploy both. The Pages Function signs Cloudflare's client IP for API rate limiting; the backend ignores unsigned or stale client-IP headers. Without the shared secret, proxied search requests share Railway's upstream peer address for the search limit.
