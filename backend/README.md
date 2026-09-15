# Nuvanti secure backend

This backend uses **PostgreSQL** and treats the admin area as a separate, protected application. It is not protected by a hidden URL or frontend localStorage: the admin server verifies a signed, HTTP-only session cookie and an `admin`/`super_admin` role before it sends any admin HTML, JavaScript, or CSS.

## Setup

1. Create a PostgreSQL database named `nuvanti` and a restricted database user.
2. Copy `.env.example` to `.env`; set `DATABASE_URL` and a unique 32+ character `JWT_SECRET`.
3. Install and initialize:

```bash
cd backend
npm install
npm run migrate
npm run seed:admin -- owner@example.com use-a-long-unique-password "Owner Name"
npm start
```

Public API: `http://localhost:4000` · protected admin: `http://localhost:4001/login.html`.

## Security included

- HTTP-only, signed 8-hour session cookies; credentials never go in localStorage.
- `bcrypt` password hashing (work factor 12).
- Role checks on every `/api/admin/*` endpoint and every admin asset.
- Helmet headers, request size limits, strict CORS, origin checks on writes, validation, and rate limits.
- Checkout re-prices products and locks inventory rows in a PostgreSQL transaction. A browser cannot choose prices or oversell stock.
- Parameterized SQL and Zod input validation.

## Production notes

Deploy HTTPS with `NODE_ENV=production`, unique long secrets, and exact production `STORE_ORIGIN`/`ADMIN_ORIGIN` values. For `www.example.com`, `admin.example.com`, and `api.example.com`, set `COOKIE_DOMAIN=.example.com` and set `window.NUVANTI_API_URL` in the admin login host to the API origin. Never expose `frontend/admin` through the public static host. Payments are not marked paid until a payment provider's signed webhook is implemented.
