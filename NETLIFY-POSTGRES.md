# Nuvanti on Cloudflare Pages + Netlify + Supabase

The public shop remains on Cloudflare Pages. Netlify runs the Express API and
serves the protected admin portal on `admin.nuvanti.com`. The API is available
under that same admin host at `/api/*`; the shop and admin remain on separate
domains. Supabase PostgreSQL remains the only application database. Do not
create a Netlify or Cloudflare database for this setup.

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
| `DATABASE_URL` | Supabase PostgreSQL **Transaction pooler** URI (port 6543), recommended for serverless functions. |
| `JWT_SECRET` | A unique random secret, at least 32 characters. |
| `NUVANTI_BOOTSTRAP_ADMIN_EMAIL` | The first owner/admin email. |
| `NUVANTI_BOOTSTRAP_ADMIN_PASSWORD` | A private password with at least 12 characters. |
| `NUVANTI_BOOTSTRAP_ADMIN_NAME` | `Nuvanti Owner` |
| `STORE_ORIGIN` | `https://nuvanti.com` |
| `STORE_PREVIEW_ORIGIN` | `https://nuvanti-shop.pages.dev` |
| `ADMIN_ORIGIN` | `https://admin.nuvanti.com` |
| `ADMIN_APP_URL` | `https://admin.nuvanti.com` |
| `API_PUBLIC_URL` | `https://admin.nuvanti.com` |
| `RESEND_API_KEY` | The private API key from Resend. |
| `MAIL_FROM` | A sender on the verified domain, e.g. `Nuvanti <orders@nuvanti.com>`. |

Leave `COOKIE_DOMAIN` unset so the secure session cookie is scoped to the admin
host. Do not add the bootstrap password to Git. Remove it from Netlify after the
first successful deployment.

## Domains

1. In Netlify **Domain management**, add `admin.nuvanti.com` to this project.
2. In Cloudflare DNS, add the exact record Netlify displays for that hostname
   and set it to **DNS only** while Netlify provisions HTTPS.
3. Keep `nuvanti.com` attached to the Cloudflare Pages shop. The shop calls the
   backend at `https://admin.nuvanti.com/api/...`.

Netlify's Free plan has a monthly usage limit and pauses projects after the
limit is reached. Review its current terms and limits before accepting live
orders. Cash on delivery remains the only configured checkout method until a
payment provider and signed webhook are implemented.
