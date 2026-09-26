# Nuvanti deployment: Railway + Supabase

Cloudflare Pages serves the storefront from the `frontend/` project root. Its `functions/api/[[path]].js` proxy sends `/api/*` requests to Railway under the storefront's own origin, avoiding third-party-cookie blocking on mobile. Railway runs the Node backend and protected admin portal. Supabase PostgreSQL remains the
only application database; the unused Cloudflare D1 database is not connected.

## Railway service

- Connect the GitHub repository and keep the service root at the repository
  root (`/`). The admin files live in the sibling `frontend` directory.
- `railway.json` configures the backend install, startup migrations, initial
  bootstrap, and `/api/health` deploy check.
- Set `PORT=4000` before the first boot if Railway cannot detect the listening
  port. The server uses `PORT` and otherwise falls back to `4000`.
- Generate a public Railway domain targeting port `4000`. The server uses
  Railway's `RAILWAY_PUBLIC_DOMAIN` as the admin and API origin when explicit
  origin variables are not set. After generating the domain, redeploy so the
  Railway-provided domain is available to the running process.

## Railway variables

Add these in the Railway service's **Variables** tab. Never commit credentials
or paste them into chat.

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Supabase PostgreSQL session-pooler URI, including the real database password |
| `DATABASE_SSL_CA` | Full Supabase root CA PEM from Database Settings → SSL Configuration |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Unique random secret, at least 32 characters |
| `TRUST_PROXY` | `1` |
| `STORE_ORIGIN` | `https://nuvanti-shop.pages.dev` (the server defaults to this if omitted and upgrades `http://` to `https://` in production). Set this to the exact storefront origin if using a custom domain. |
| `STORE_PREVIEW_ORIGIN` | Optional Cloudflare Pages preview origin, using `https://` |
| `ADMIN_ORIGIN` | Optional; otherwise derived from Railway's public domain after it is generated |
| `ADMIN_APP_URL` | Optional; defaults to `ADMIN_ORIGIN` |
| `API_PUBLIC_URL` | Optional; defaults to Railway's public domain when available |
| `MFA_ENCRYPTION_KEY` | Unique random value of at least 32 characters. Set before enrolling staff and never rotate after enrollment. |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | Your Gmail sending address |
| `SMTP_PASS` | The Gmail App Password, not the normal Gmail password |
| `MAIL_FROM` | `Nuvanti <your-sending-address@gmail.com>` |
| `RESEND_API_KEY` | Optional alternative to SMTP; use a verified sender/domain with `MAIL_FROM` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Dashboard → Product environment → Cloud name (the name only, not the full URL) |
| `CLOUDINARY_API_KEY` | Cloudinary Dashboard → API Keys |
| `CLOUDINARY_API_SECRET` | Cloudinary Dashboard → API Keys (keep private; backend service only) |
| `PAYMOB_SECRET_KEY` | Optional; Paymob server-side secret for hosted online checkout |
| `PAYMOB_PUBLIC_KEY` | Optional; Paymob public key for Unified Checkout |
| `PAYMOB_PAYMENT_METHODS` | Optional; comma-separated integration IDs matching the same Paymob test/live mode |
| `PAYMOB_HMAC_SECRET` | Optional; Paymob callback signature secret |

Initial administrator provisioning uses one-time private Railway variables only when no active super administrator exists. Follow the private owner setup process for their names and values. Remove all bootstrap variables from Railway as soon as initial setup is complete. The bootstrap command leaves the existing catalog and active super-admin unchanged on subsequent deploys.

In Cloudflare Pages, set the project root to `frontend/`. The proxy defaults to `https://nuvanti-production.up.railway.app`; if the Railway domain changes, set the Pages environment variable `NUVANTI_API_ORIGIN` to the new HTTPS origin and redeploy Pages. In Railway, set `STORE_ORIGIN` to the exact storefront origin and leave `COOKIE_DOMAIN` blank. The storefront uses same-origin API requests so session cookies remain first-party on phones.

In Admin → Settings → Email, check the provider status and use **Send test email** after configuring the variables. The test goes to the signed-in super administrator. Set the Customer Support Email in Settings → General to receive contact-form alerts.

Railway trial credits and limits can change. Check current workspace usage and
billing before adding a paid plan. Supabase remains a separate service with its
own plan limits.
