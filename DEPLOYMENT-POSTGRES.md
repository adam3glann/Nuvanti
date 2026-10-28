# Nuvanti deployment: Render, Supabase, and Cloudflare Pages

The storefront stays on Cloudflare Pages. Render hosts the existing Express API and protected admin portal. Supabase PostgreSQL remains the source of truth; the separate Cloudflare D1 database is not used by this backend.

## Create the backend service

The repository includes `render.yaml`. In Render, create a Blueprint from this GitHub repository and select that file. It configures the `backend` root, Node runtime, Frankfurt region, `npm ci`, database migrations, initial bootstrap, and `/api/health` health checks. The service uses Render's `0.5c-512mb` plan (currently listed at $7/month). Do not switch the storefront to the new host until its health check passes.

The Blueprint prompts for secrets. Never paste them into chat or commit them. Set:

| Variable | Source |
| --- | --- |
| `DATABASE_URL` | The existing Supabase PostgreSQL session-pooler URL |
| `DATABASE_SSL_CA` | Supabase Database Settings → SSL Configuration root CA |
| `JWT_SECRET` | Existing production value, so existing signed sessions remain valid |
| `MFA_ENCRYPTION_KEY` | Existing production value; do not rotate after staff MFA enrollment |
| `NUVANTI_PROXY_IP_SECRET` | Existing production value, or create a new random value and also set it in Cloudflare Pages |
| Email, Cloudinary, Paymob, and Twilio variables | Existing values for the features you use |

Do **not** enter `localhost` for `DATABASE_URL` and do not create a fresh database if you need existing customers, orders, products, and settings. The `DATABASE_URL` in a local `.env` can be a development value; use the production Supabase connection string. The startup bootstrap preserves existing catalog data and super-admin accounts when pointed to the existing database.

## Connect Cloudflare Pages

After the Render service is healthy:

1. Copy its HTTPS service URL, such as `https://nuvanti-api.onrender.com`.
2. In Cloudflare Pages, set `NUVANTI_API_ORIGIN` to that URL for **Production** and **Preview**.
3. Set `NUVANTI_PROXY_IP_SECRET` to the exact same value as the Render backend.
4. Redeploy the Pages project.

The Pages Functions proxy `/api/*` through the storefront origin and send `/admin` visitors to the protected admin portal on the backend. This keeps storefront session cookies first-party.

## Payment callbacks

Update the Paymob transaction-processed callback to:

`https://<render-service-host>/api/payments/paymob/webhook`

The API uses its public Render URL when constructing payment and email links. Confirm a test order and its signed webhook callback before re-enabling live online payments.

## Keep these safeguards

- Keep `COOKIE_DOMAIN` blank. The storefront proxy strips the upstream cookie domain so the browser scopes its session cookie to the storefront.
- Keep `STORE_ORIGIN` set to the exact public storefront origin (default: `https://nuvanti-shop.pages.dev`).
- Do not publish `frontend/admin` as an unprotected static site.
- Render Free services sleep after 15 minutes idle and can take about a minute to wake, so the Blueprint selects a paid service plan for production.
- Vercel's Hobby plan is restricted to personal, noncommercial use; this store needs an eligible plan if you choose Vercel instead.
