# Nuvanti storefront and admin

Nuvanti is a static HTML/CSS/JavaScript storefront backed by a Node.js API and PostgreSQL. The customer shop and administrator portal are separate applications with separate production hostnames. The admin portal is protected by the backend before its application files are served.

## Local setup

1. Install Node.js and PostgreSQL.
2. Configure `backend/.env` from `backend/.env.example` with a database URL and a unique JWT secret.
3. In `backend/`, run `npm install`, `npm run migrate`, `npm run seed:catalog`, and `npm run seed:admin -- owner@example.com 'your-long-password' 'Owner Name'`.
4. Start the API and protected admin server with `npm start` from `backend/`.
5. Serve `frontend/` from a local web server (for example `python -m http.server 8080 --directory frontend`). Open `http://localhost:8080` for the shop and `http://localhost:4001/login.html` for admin.

## Production host layout

- Cloudflare Pages serves the public storefront.
- Railway serves the API and the protected admin portal from one public service domain.
- Supabase PostgreSQL remains the application database.

Configure Railway using [DEPLOYMENT-POSTGRES.md](DEPLOYMENT-POSTGRES.md). Cloudflare Pages should use `frontend/` as its project root; the Pages Function there proxies `/api/*` to Railway so mobile browsers can store the login cookie as a first-party cookie. Never publish `frontend/admin/` as an unprotected static site.

Full database, mail, cloud image upload, and deployment details are in [backend/README.md](backend/README.md).

## Working features

The shop loads active products and categories from PostgreSQL. Account login and registration, email verification, address book, discounts, account recovery, order placement, confirmation/tracking, newsletter double opt-in, and contact messages use the API. The admin portal supports catalog and inventory management, order status, customers, contact messages, newsletter exports, discount management, homepage slideshow editing, transactional email status/test sending, settings, analytics, audit records, and administrator management. Admin role permissions are enforced server-side.

Cash on Delivery is the only connected payment method. Card payment, shipping-carrier booking/tracking integrations, general page editing beyond the homepage slideshow, two-factor authentication, and per-device sessions are not implemented. Product/editorial copy beyond the slideshow and site policies are maintained in source files, so update and review them before launch. See the backend README's production checklist for external setup requirements.
