# Nuvanti secure backend

This backend uses **PostgreSQL** and treats the admin area as a separate, protected application. It is not protected by a hidden URL or frontend localStorage: the admin server verifies a signed, HTTP-only session cookie and a staff-tier role (`staff`/`manager`/`admin`/`super_admin`) before it sends any admin HTML, JavaScript, or CSS. Within that, every `/api/admin/*` route independently checks a specific permission for the caller's role — see "Roles & permissions" below.

## Setup

1. Create a PostgreSQL database named `nuvanti` and a restricted database user.
2. Copy `.env.example` to `.env`; set `DATABASE_URL` and a unique 32+ character `JWT_SECRET`.
3. Install and initialize:

```bash
cd backend
npm install
npm run migrate
npm run seed:catalog
npm run seed:admin -- owner@example.com use-a-long-unique-password "Owner Name"
npm start
```

Public API: `http://localhost:4000` · protected admin: `http://localhost:4001/login.html`.

## Live catalog connection

The public storefront and admin catalog now share PostgreSQL. Run `npm run seed:catalog` once after migrating to import the supplied starting products and categories. After that, product creation, publishing, price changes, and inventory edits made in the Admin portal are reflected by the public shop through `/api/products` on its next load.

## Cloudinary product photos

The Admin product editor can securely upload JPEG, PNG, WebP, and GIF product images (maximum 10 MB) to Cloudinary. Add these private values to `backend/.env`, then restart the backend:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

Find them in Cloudinary's Dashboard → API Keys. Keep the API secret in `.env` only—never put it in frontend JavaScript or commit it to Git. Once configured, edit a product in Admin, select **Upload**, choose an image, then **Save Changes**. The returned HTTPS image URL is stored with that product in PostgreSQL and appears on the public store.

## Roles & permissions

There are five roles: `customer`, and four staff-tier roles — `staff`, `manager`, `admin`, `super_admin` — each with a fixed set of permissions enforced in `backend/lib/permissions.js` (mirrored in the admin UI's `components/permissions.js` for hiding controls, but the backend check is the real boundary). Only a `super_admin` can create, disable, or delete other administrator accounts, and the backend refuses to let the last active `super_admin` be disabled or deleted.

## Adding administrators

There is no "set a password for someone else" flow. From **Admin Users** (super_admin only), creating an account emails the person a setup link — the account starts with an unusable random password and can only be activated by setting a real one through that link (same delivery path as the password-reset email below; in development without SMTP configured, the link is printed to the backend terminal instead).

## Reset an admin password

The admin login page has a complete **Forgot password** flow. It accepts an authorized admin email, sends a one-time link, then lets the user choose a new password. Links expire after 30 minutes and are invalidated after use. Signed-in users can also change their own password directly from **Security** without going through email.

To deliver messages to Gmail (and therefore your Gmail app/phone), enable two-step verification on the sending Gmail account and create a Google **App Password**. Put these values in your private `.env` file—never in `.env.example` or Git:

```env
ADMIN_APP_URL=https://admin.yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sending-email@gmail.com
SMTP_PASS=your-16-character-google-app-password
MAIL_FROM="Nuvanti Security <your-sending-email@gmail.com>"
```

The reset email is sent to the account's email address and will appear on the recipient's phone through their email app. In development without SMTP values, the secure reset URL is printed in the backend terminal instead; production refuses to silently skip delivery.

## Security included

- HTTP-only, signed 8-hour session cookies; credentials never go in localStorage.
- `bcrypt` password hashing (work factor 12).
- Permission checks (not just a role check) on every `/api/admin/*` endpoint, backed by a real 4-tier role model — see "Roles & permissions" above.
- Brute-force lockout: an account locks for 15 minutes after 5 consecutive failed logins.
- Audit log of security-relevant events (logins, lockouts, password changes/resets, administrator account changes, and destructive catalog/order actions) — visible on the **Audit Logs** admin page to `admin`/`super_admin`.
- Helmet headers, request size limits, strict CORS, origin checks on writes, validation, and rate limits.
- Checkout re-prices products and locks inventory rows in a PostgreSQL transaction. A browser cannot choose prices or oversell stock.
- Parameterized SQL and Zod input validation everywhere, including admin mutations.
- Customer-supplied strings (name, email, shipping address) are HTML-escaped before the admin UI renders them, to prevent stored XSS via order/checkout data.

## Not yet implemented

Two-factor authentication, per-device session tracking/"log out all devices" (sessions are currently a single stateless JWT cookie per browser — rotate `JWT_SECRET` to invalidate all of them at once), and email verification on customer registration are not built. The admin **Security** page is explicit about which of its controls are real. Discounts, Settings, Analytics detail, and Contact Messages also have no backend yet and remain mock/local-only in the admin UI.

## Production notes

Deploy HTTPS with `NODE_ENV=production`, unique long secrets, and exact production `STORE_ORIGIN`/`ADMIN_ORIGIN` values. The chosen layout is `www.yourdomain.com` for the store, `admin.yourdomain.com` for the protected portal, and `api.yourdomain.com` for this backend. Set `COOKIE_DOMAIN=.yourdomain.com`, `ADMIN_APP_URL=https://admin.yourdomain.com`, and set `window.NUVANTI_API_URL` in the admin host to the API origin. Never expose `frontend/admin` through the public static host. Payments are not marked paid until a payment provider's signed webhook is implemented.
