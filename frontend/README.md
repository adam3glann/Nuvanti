# Storefront deployment (Cloudflare Pages)

Set the Pages project root directory to `frontend`. The `functions/api/[[path]].js` function proxies `/api/*` to Railway so the storefront session cookie is first-party on mobile browsers.

The proxy defaults to `https://nuvanti-production.up.railway.app`. If that public domain changes, set the Cloudflare Pages environment variable `NUVANTI_API_ORIGIN` to the new HTTPS origin and redeploy.

In Railway, set `STORE_ORIGIN` to the exact public storefront origin (including `https://`, without a path), and leave `COOKIE_DOMAIN` blank. The function removes any upstream cookie domain so the browser stores the session only for the storefront host.
