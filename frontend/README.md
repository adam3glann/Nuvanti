# Storefront deployment (Cloudflare Pages)

Set the Pages project root directory to `frontend`. The `functions/api/[[path]].js` function proxies `/api/*` to the backend so the storefront session cookie stays first-party on mobile browsers.

Set the Cloudflare Pages environment variable `NUVANTI_API_ORIGIN` to the backend's public HTTPS origin (no trailing path), in both Production and Preview, then redeploy Pages. The admin gateway uses the same variable.

Set `STORE_ORIGIN` on the backend to the exact public storefront origin (including `https://`, without a path), and leave `COOKIE_DOMAIN` blank. The function removes any upstream cookie domain so the browser stores the session only for the storefront host.

Set `NUVANTI_PROXY_IP_SECRET` to the same unique random value (at least 32 characters) in the backend and Cloudflare Pages environment variables, then redeploy both. The Pages Function signs Cloudflare's client IP for API rate limiting; the backend ignores unsigned or stale client-IP headers.
