# Nuvanti on Cloudflare Pages + Netlify + Supabase

The public shop remains on Cloudflare Pages at `nuvanti-shop.pages.dev`. Netlify
runs the Express API and serves the protected admin portal at
`nuvanti-admin.netlify.app`. The shop and admin use separate free hostnames.
Supabase PostgreSQL remains the only application database. Do not create a
Netlify or Cloudflare database for this setup.

## Connect the repository

1. In Netlify, choose **Add new project → Import an existing project → GitHub**.
2. Select the latest Nuvanti repository and the `main` branch. Leave the base
   directory blank. Netlify reads the repository's `netlify.toml` settings.
3. Before the first deploy, add the environment variables below. The build runs
   migrations and creates the starter catalog and first owner account once.
4. Deploy. A successful deployment should respond to
   `https://<your-netlify-site>.netlify.app/api/health` with `{"ok":true}`.
   The temporary Netlify hostname routes API calls; the admin portal is served
   only when its configured admin hostname is used.

## Netlify environment variables

Set these under **Project configuration → Environment variables**. Keep secret
values private and make `DATABASE_URL` available to both **Builds** and
**Functions**, because migrations run during deployment.

| Name | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NUVANTI_NETLIFY_FUNCTION` | `true` |
| `TRUST_PROXY` | `1` |
| `DATABASE_URL` | Supabase PostgreSQL **Transaction pooler** URI (port 6543). |
| `DATABASE_SSL_CA` | Supabase's root CA certificate from **Project Settings → Database → SSL Configuration**. Paste the complete PEM certificate, including the BEGIN/END lines. TLS verification stays enabled. |
| `JWT_SECRET` | A unique random secret, at least 32 characters. |
| `NUVANTI_BOOTSTRAP_ADMIN_EMAIL` | The first owner/admin email. |
| `NUVANTI_BOOTSTRAP_ADMIN_PASSWORD` | A private password with at least 12 characters. |
| `NUVANTI_BOOTSTRAP_ADMIN_NAME` | `Nuvanti Owner` |
| `STORE_ORIGIN` | `https://nuvanti-shop.pages.dev` |
| `STORE_PREVIEW_ORIGIN` | `https://nuvanti-shop.pages.dev` |
| `ADMIN_ORIGIN` | `https://nuvanti-admin.netlify.app` |
| `ADMIN_APP_URL` | `https://nuvanti-admin.netlify.app` |
| `API_PUBLIC_URL` | `https://nuvanti-admin.netlify.app` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | The Gmail address used to send store emails. |
| `SMTP_PASS` | A Google App Password for that Gmail account (not the normal Google password). |
| `MAIL_FROM` | For example, `Nuvanti <your-sending-email@gmail.com>`. |

Leave `COOKIE_DOMAIN` unset so the secure session cookie is scoped to the admin
host. Do not add the bootstrap password to Git. Remove it from Netlify after the
first successful deployment.

## Domains

The shop calls the backend at `https://nuvanti-admin.netlify.app/api/...`.
Custom domains are optional and require registering a domain name; the free
hostnames above work without buying one.

Netlify's Free plan has a monthly usage limit and pauses projects after the
limit is reached. Review its current terms and limits before accepting live
orders. Cash on delivery remains the only configured checkout method until a
payment provider and signed webhook are implemented.
