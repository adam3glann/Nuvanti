# Nuvanti deployment: Railway + Supabase

The Cloudflare Pages storefront stays at `nuvanti-shop.pages.dev`. Railway runs
the Node backend and protected admin portal. Supabase PostgreSQL remains the
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
| `STORE_ORIGIN` | `https://nuvanti-shop.pages.dev` (the server defaults to this if omitted and upgrades `http://` to `https://` in production) |
| `STORE_PREVIEW_ORIGIN` | Optional Cloudflare Pages preview origin, using `https://` |
| `ADMIN_ORIGIN` | Optional; otherwise derived from Railway's public domain after it is generated |
| `ADMIN_APP_URL` | Optional; defaults to `ADMIN_ORIGIN` |
| `API_PUBLIC_URL` | Optional; defaults to Railway's public domain when available |
| `NUVANTI_BOOTSTRAP_ADMIN_EMAIL` | Your administrator email |
| `NUVANTI_BOOTSTRAP_ADMIN_PASSWORD` | A private password of at least 12 characters |
| `NUVANTI_BOOTSTRAP_ADMIN_NAME` | Your administrator display name |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | Your Gmail sending address |
| `SMTP_PASS` | The Gmail App Password, not the normal Gmail password |
| `MAIL_FROM` | `Nuvanti <your-sending-address@gmail.com>` |

The storefront's production fallback API origin is `https://nuvanti-production.up.railway.app` in `frontend/assets/js/config.js`. If your Railway service domain changes, update that fallback (or inject `window.NUVANTI_API_URL` before the storefront modules load) and redeploy Cloudflare Pages.
In Admin → Settings → Email, check the provider status and use **Send test email** after configuring the variables. The test goes to the signed-in super administrator. Set the Customer Support Email in Settings → General to receive contact-form alerts. Production session cookies are secure and allow cross-origin storefront API calls; keep the API origin and `STORE_ORIGIN` aligned.

Railway trial credits and limits can change. Check current workspace usage and
billing before adding a paid plan. Supabase remains a separate service with its
own plan limits.
