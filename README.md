<div align="center">

# Nuvanti

### A considered clothing store, built around a real catalog and a protected admin workspace.

**Nuvanti** is a full-stack commerce project with a customer storefront, a staff-only admin portal, a PostgreSQL API, and deployment paths for Cloudflare Pages and Railway.

[Storefront](https://nuvanti-shop.pages.dev) · [Deployment guide](DEPLOYMENT-POSTGRES.md) · [Backend guide](backend/README.md) · [Pre-launch checklist](PRE-LAUNCH.md)

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/) [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/) [![Cloudflare Pages](https://img.shields.io/badge/Cloudflare-Pages-F38020?logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/) [![Railway](https://img.shields.io/badge/Deploy-Railway-7B2EF3?logo=railway&logoColor=white)](https://railway.com/)

</div>

---

## At a glance

- **Storefront:** responsive, static HTML/CSS/JavaScript served by Cloudflare Pages.
- **Admin:** protected by the Node.js backend; the admin app is not published as a public static site.
- **API and database:** Node.js/Express with PostgreSQL. Supabase PostgreSQL is the production database.
- **Payments:** Cash on Delivery, plus optional Paymob hosted checkout when its server-side configuration is complete.
- **Media and email:** optional Cloudinary image uploads and SMTP or Resend email delivery.

## Architecture

```mermaid
flowchart LR
    Customer[Customer browser] --> Pages[Cloudflare Pages storefront]
    Pages -->|/api requests| Proxy[Pages Function proxy]
    Proxy --> Railway[Railway Node.js API]
    Staff[Staff browser] -->|authenticated session| Railway
    Railway --> Database[(Supabase PostgreSQL)]
    Railway -. optional uploads .-> Cloudinary[Cloudinary]
    Railway -. optional email .-> Mail[SMTP or Resend]
    Customer -. hosted checkout .-> Paymob[Paymob]
    Paymob -. signed webhook .-> Railway
```

The storefront calls the API through a same-origin Cloudflare Pages Function. This lets browsers keep the storefront session cookie first-party. Railway serves the API and the admin portal; it checks staff sessions and roles before serving admin files. Do not deploy `frontend/admin/` as a public Pages site.

## What’s included

### Customer storefront

- Product catalog, categories, collections, search, cart, wishlist, and homepage slides.
- Customer registration, sign-in, email verification (required by both the checkout UI and API), password reset, saved addresses, and account order history.
- Checkout with server-calculated prices, inventory reservation, shipping options, and discount validation.
- Cash on Delivery and optional Paymob hosted checkout.
- Order confirmation, customer tracking links, and transactional email hooks.
- Newsletter double opt-in and a contact form.

### Protected admin portal

- Product, category, collection, image, pricing, color, size, and inventory management.
- Order management, customer records, discount management, and order status updates.
- Dashboard analytics, sales and cost summaries, contact inbox, newsletter management, and exports.
- Live storefront visitor count in the admin header, refreshed automatically across admin pages.
- Homepage slideshow management, store settings, audit records, admin users, roles, and permissions.
- Staff authenticator-based two-factor authentication and session controls.

Some connected services require external credentials. Email, Cloudinary uploads, and Paymob checkout remain unavailable until their providers are configured. Carrier booking and live carrier scans are not integrated; order statuses are managed in Admin.

The live visitor count is an approximate count of active browser sessions: multiple open tabs in one browser count once; separate devices count separately. Sessions are anonymous, heartbeat while the storefront page is visible, and expire shortly after closing or losing connection. No name, email, or IP address is stored for this count.

## Technology

| Area | Technologies |
| --- | --- |
| Storefront and admin UI | HTML, CSS, JavaScript ES modules |
| API and protected admin gateway | Node.js, Express |
| Database | PostgreSQL, `pg`, SQL migrations |
| Input validation and security | Zod, Helmet, rate limits, signed HTTP-only cookies, role and permission checks |
| Production hosting | Cloudflare Pages, Railway, Supabase |
| Optional providers | Paymob, Cloudinary, SMTP/Resend |

## Run locally

### Requirements

- Node.js 20 or newer
- PostgreSQL
- Python 3 (to serve the static storefront) or another static file server

### 1. Create a local database

Create a PostgreSQL database and user for development. Then copy the example environment file:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set at least:

```env
DATABASE_URL=postgresql://<local-user>:<local-password>@localhost:5432/<database>
JWT_SECRET=<unique-local-secret>
STORE_ORIGIN=http://localhost:8080
ADMIN_ORIGIN=http://localhost:4001
ADMIN_APP_URL=http://localhost:4001
API_PUBLIC_URL=http://localhost:4000
```

The values above are for local development only. Use unique production secrets and HTTPS origins in Railway.

### 2. Install, migrate, and initialize

```bash
cd backend
npm ci
npm run migrate
npm run seed:catalog
```

`seed:catalog` imports the starter catalog. Run it only when you intend to seed or refresh the local catalog. Administrator provisioning instructions and credentials are intentionally omitted from this public README; use the private owner setup process. Never put an administrator password in a command, README, source file, screenshot, or Git history.

### 3. Start the backend

From `backend/`:

```bash
npm run dev
```

This starts the API on `http://localhost:4000` and the protected admin portal on `http://localhost:4001`.

### 4. Serve the storefront

In a second terminal, from the repository root:

```bash
python -m http.server 8080 --directory frontend
```

Open:

- Storefront: <http://localhost:8080>
- Admin sign-in: <http://localhost:4001/login.html>
- API health: <http://localhost:4000/api/health>

## Production deployment

The expected production layout is:

1. **Supabase:** provision PostgreSQL and keep the database URL and CA certificate private.
2. **Railway:** connect this repository with the repository root as the service root. `railway.json` installs the backend, applies migrations, runs the initial bootstrap, and checks `/api/health`.
3. **Cloudflare Pages:** set the project root to `frontend/`. Its Pages Function proxies `/api/*` requests to Railway.
4. **Domains and cookies:** set the exact storefront origin in Railway, keep `COOKIE_DOMAIN` blank, and configure `NUVANTI_API_ORIGIN` in Cloudflare Pages if the Railway domain differs from the default.

Follow [DEPLOYMENT-POSTGRES.md](DEPLOYMENT-POSTGRES.md) for the Railway, Supabase, and Cloudflare setup. Configure external credentials using the relevant provider sections in [backend/README.md](backend/README.md). Never place server secrets in frontend files, commit them, or paste them into issues or chat.

### Optional provider setup

- **Email:** configure either Resend or SMTP, plus `MAIL_FROM`. Verify delivery from Admin → Settings → Email.
- **Cloudinary:** configure `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` on the backend service.
- **Paymob:** configure all four backend variables—`PAYMOB_SECRET_KEY`, `PAYMOB_PUBLIC_KEY`, `PAYMOB_PAYMENT_METHODS`, and `PAYMOB_HMAC_SECRET`—then set Paymob’s processed-transaction callback to `https://<railway-domain>/api/payments/paymob/webhook`. Use matching test credentials and integration IDs first. The checkout option is hidden until Paymob is configured. See the Paymob section in [the backend guide](backend/README.md).

## Security notes

- Staff pages are served only after backend authentication and role checks. Admin API routes also enforce per-action permissions.
- Sessions use signed, HTTP-only cookies; passwords are hashed; login attempts are rate-limited and locked after repeated failures.
- Authenticator MFA uses TOTP and one-time recovery codes. Keep `MFA_ENCRYPTION_KEY` stable after enrollment; rotating it prevents the server from decrypting existing MFA secrets.
- Order totals, discount eligibility, and inventory are validated on the server in database transactions.
- Payment success is recorded only after the server verifies a signed Paymob callback. A browser redirect alone never marks an order paid.
- Do not publish the admin frontend separately or expose provider secrets to the browser.

For the full security model and operational boundaries, see [backend/README.md](backend/README.md).

### Administrator access handoff

Treat administrator credentials as private secrets. **Do not give a client your own super-admin login or reuse one password for multiple people.** Provision a separate named account for each client or staff member through the protected admin process and grant only the role they need. Require authenticator MFA for every staff account and store recovery codes somewhere private.

Never put a real password in this README, a Git commit, a source file, a screenshot, or a support message. Disable former staff accounts and revoke their sessions when access is no longer needed.

After the first production administrator is created, remove all one-time administrator bootstrap variables from Railway. Keep production credentials in Railway Variables or the relevant provider’s secret manager; `.env.example` is only a template. If a password, API key, database URL, MFA key, or SSH private key is exposed, replace/revoke it at its provider immediately. Removing it from the latest commit does not remove it from Git history.

Security controls reduce risk but cannot guarantee that a site is impossible to compromise. Keep dependencies and the runtime updated, use individual staff accounts and MFA, review audit logs, and follow the deployment checklist before accepting real orders.

## Repository layout

```text
backend/
  lib/                 Database, authentication, mail, payments, and provider helpers
  migrations/          Ordered PostgreSQL schema migrations
  routes/              API endpoints
  scripts/             Migration, catalog, and administrator commands
  README.md            Backend setup and operations
frontend/
  assets/              Storefront styles, scripts, and media
  admin/               Admin UI; served only by the authenticated backend
  functions/api/        Cloudflare Pages API proxy
DEPLOYMENT-POSTGRES.md  Railway, Supabase, and Cloudflare deployment details
PRE-LAUNCH.md           Production readiness checklist
railway.json            Railway build, startup, and health check configuration
```

## Operational references

- [Backend setup, security, email, images, and Paymob](backend/README.md)
- [Railway + Supabase deployment](DEPLOYMENT-POSTGRES.md)
- [Cloudflare Pages storefront setup](frontend/README.md)
- [Pre-launch checklist](PRE-LAUNCH.md)

## License

No license file is currently included. All rights are reserved unless the repository owner adds a license.
