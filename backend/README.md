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

## Reset a password (any account)

Both the storefront (**My Account → Forgot password**) and the admin login page have a complete **Forgot password** flow. Either accepts an email, sends a one-time link (customers land back on the store, staff-tier accounts land on the admin login page), then lets the user choose a new password. Links expire after 30 minutes and are invalidated after use. Signed-in staff-tier users can also change their own password directly from **Security** without going through email.

## Order confirmations & tracking

Placing an order (`POST /api/orders`) fires two best-effort notifications after the order is saved — neither can fail the checkout itself:

- **Email** via the same SMTP config as password resets (`sendOrderConfirmation` in `lib/mail.js`).
- **WhatsApp** via Twilio's WhatsApp API (`lib/whatsapp.js`), only if `TWILIO_*` is configured and the shipping phone number is in a recognizable international format (a leading `+`). If not configured, or the number can't be normalized, it's skipped silently — checkout is unaffected either way.

Both messages include a tracking link: `GET /api/orders/track/:id?token=...`, a public (no-login) endpoint guarded by a random per-order token (not the order's numeric id — that alone proves nothing). It returns order status, items, delivery method, and city/country only — no email, phone, or full address. The storefront's `track.html` page renders it, and also offers a manual order-number + tracking-code lookup for someone who lost the link. Signed-in customers see the same link for every past order under **My Account → Orders**, which now lists real order history instead of only the most recent order in that browser.

For Railway deployment, configure mail through the service's environment variables. Gmail SMTP works without owning a custom domain: enable two-step verification and create a Google **App Password**, never use the normal Gmail password. Keep the app password private and never commit it:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-sending-email@gmail.com
SMTP_PASS=your-16-character-google-app-password
MAIL_FROM="Nuvanti Security <your-sending-email@gmail.com>"
```

The reset email is sent to the account's email address and will appear on the recipient's phone through their email app. In development without mail credentials, the secure reset URL is printed in the backend terminal instead; production refuses to silently skip delivery.

## Security included

- HTTP-only, signed 8-hour session cookies; credentials never go in localStorage.
- Staff can enroll authenticator-app TOTP with one-time recovery codes. MFA challenges are short-lived and separate from authenticated sessions; TOTP steps and recovery codes cannot be reused.
- Staff sessions are stored in PostgreSQL, expire after 8 hours, and can be revoked from **Security**. Password changes and MFA changes invalidate prior sessions.
- The admin header shows an anonymous live storefront visitor count. A random browser identifier is used only for presence; it rotates after 30 minutes of inactivity. Presence rows expire after about 90 seconds without a heartbeat. Names, emails, and IP addresses are not stored in the presence table.
- `bcrypt` password hashing (work factor 12).
- Permission checks (not just a role check) on every `/api/admin/*` endpoint, backed by a real 4-tier role model — see "Roles & permissions" above.
- Brute-force lockout: an account locks for 15 minutes after 5 consecutive failed logins.
- Audit log of security-relevant events (logins, lockouts, password changes/resets, administrator account changes, stock adjustments, and catalog/order actions) — visible on the **Audit Logs** admin page to `admin`/`super_admin`.
- Helmet headers, request size limits, strict CORS, origin checks on writes, validation, and rate limits.
- Checkout re-prices products and locks inventory rows in a PostgreSQL transaction. A browser cannot choose prices or oversell stock.
- Parameterized SQL and Zod input validation everywhere, including admin mutations.
- Customer-supplied strings (name, email, shipping address) are HTML-escaped before the admin UI renders them, to prevent stored XSS via order/checkout data.

## Security boundaries

Authenticator MFA currently applies to staff accounts only. It requires an authenticator app (TOTP) and protects staff login; keep the recovery codes somewhere private. The encryption key must be a stable, unique Railway variable. **Do not rotate `MFA_ENCRYPTION_KEY` after enrolling staff**, because the server needs it to decrypt authenticator secrets. Generate a strong value locally, for example in PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Add the result as `MFA_ENCRYPTION_KEY` in the Railway backend service Variables, then deploy. Never paste that key into chat, source files, or Git. Existing sessions created before session tracking was added will need to sign in once after deployment. Session labels use browser user-agent data, which is an approximate device description rather than a verified device identity. Customer registration sends an email-verification link and provides a resend action. **Checkout enforces verification in both the storefront and API**; the API returns `EMAIL_NOT_VERIFIED` for an unverified customer, so bypassing the browser UI does not bypass the check. General/shipping settings, basic sales analytics, inventory adjustment history, contact inbox, newsletter management, and homepage slideshow editing are backend-connected. Other page copy remains in the storefront source. Carrier booking/tracking is not connected and does not become real carrier tracking just because an order status changes.

### Paymob online payments (Egypt / EGP)

Hosted online checkout is implemented, but stays hidden until all four variables below are set on the Railway backend service:

- `PAYMOB_SECRET_KEY`: server-side API secret; never expose it to the storefront.
- `PAYMOB_PUBLIC_KEY`: the public key used to open Paymob Unified Checkout.
- `PAYMOB_PAYMENT_METHODS`: comma-separated Paymob payment integration IDs (for example `123456` or `123456,234567`), all from the same test/live mode as the keys.
- `PAYMOB_HMAC_SECRET`: callback HMAC secret used to authenticate payment events.

In Paymob, set the transaction processed callback URL to `https://<your-railway-domain>/api/payments/paymob/webhook` for the relevant payment integrations. Keep test credentials and test integrations together first; after a successful test transaction and verified callback, switch all credentials/integration IDs together to Paymob live mode. A browser return page never marks an order paid: only a valid HMAC callback with the expected Paymob integration, EGP currency, order amount, and order ID does. Paymob handles card details on its hosted checkout page. Configure the callback/HMAC in Paymob before enabling real payments, and confirm fees, settlement, refunds, and merchant approval with Paymob.

Discounts now have a real backend: admin create/activate/deactivate/delete goes through `/api/admin/discounts`, and the storefront cart and checkout pages validate a code against `/api/orders/validate-discount` (a public, no-login preview) before it's applied at order time in `/api/orders`, where it's re-validated and its usage count incremented inside the same row-locked transaction as inventory. Codes support a percentage or fixed amount, an optional minimum order subtotal, an optional usage limit, and an optional expiry — there is no scheduled "starts on" date and no free-shipping discount type; both would need a schema change first.

## Production notes

For the current Railway layout, keep the repository root as the service root so the backend can serve the protected admin files from `frontend/admin`. Use the Cloudflare Pages storefront URL for `STORE_ORIGIN`; use the generated Railway HTTPS domain for `ADMIN_ORIGIN`, `ADMIN_APP_URL`, and `API_PUBLIC_URL`. Set `TRUST_PROXY=1`, leave `COOKIE_DOMAIN` blank so the session cookie remains scoped to the admin host, and set the Supabase CA in `DATABASE_SSL_CA`. Never publish `frontend/admin` as an unprotected static site. Only Egypt is accepted at checkout; configure actual rates and fulfillment with your courier before accepting orders. Online checkout remains unavailable until Paymob credentials and its HMAC callback are configured.

See the repository-level `DEPLOYMENT-POSTGRES.md` for Railway and Supabase configuration. PostgreSQL remains the source of truth; the separate Cloudflare D1 database is not used by this backend.
