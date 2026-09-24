# Nuvanti deployment: Railway + Supabase

The Cloudflare Pages storefront stays at `nuvanti-shop.pages.dev`. Railway runs
the Node backend and protected admin portal. Supabase PostgreSQL remains the
only application database; the unused Cloudflare D1 database is not connected.

## Railway service

- Connect the GitHub repository and keep the service root at the repository
  root (`/`). The admin files live in the sibling `frontend` directory.
- `railway.json` configures the backend install, startup migrations, initial
  bootstrap, and `/api/health` deploy check.
- Generate a public Railway domain. Use that same URL for `ADMIN_ORIGIN`,
  `ADMIN_APP_URL`, and `API_PUBLIC_URL`.

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
| `STORE_ORIGIN` | `https://nuvanti-shop.pages.dev` |
| `STORE_PREVIEW_ORIGIN` | `https://nuvanti-shop.pages.dev` |
| `ADMIN_ORIGIN` | The generated Railway domain, including `https://` |
| `ADMIN_APP_URL` | The same generated Railway domain |
| `API_PUBLIC_URL` | The same generated Railway domain |
| `NUVANTI_BOOTSTRAP_ADMIN_EMAIL` | Your administrator email |
| `NUVANTI_BOOTSTRAP_ADMIN_PASSWORD` | A private password of at least 12 characters |
| `NUVANTI_BOOTSTRAP_ADMIN_NAME` | Your administrator display name |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | Your Gmail sending address |
| `SMTP_PASS` | The Gmail App Password, not the normal Gmail password |
| `MAIL_FROM` | `Nuvanti <your-sending-address@gmail.com>` |

Keep the storefront's API origin pointed at the Railway domain.

Railway trial credits and limits can change. Check current workspace usage and
billing before adding a paid plan. Supabase remains a separate service with its
own plan limits.
