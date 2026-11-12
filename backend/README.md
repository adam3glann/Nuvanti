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
npm start
```

Public API: `http://localhost:4000` · protected admin: `http://localhost:4001/login.html`.

Administrator provisioning and password setup instructions are intentionally not included in this public guide. Use the private owner setup process; never place administrator credentials in shell commands, documentation, screenshots, or Git.

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

## Account recovery

Account recovery is handled through the relevant sign-in page. Do not publish recovery tokens, passwords, or private administrator onboarding details. Each staff member should use their own account, and MFA should be enabled for every staff account.

## Order confirmations & tracking

Placing an order (`POST /api/orders`) sends a best-effort receipt email after the order is saved; email delivery never fails checkout:

Checkout supports guests and registered customers. Guests provide an email for their receipt and secure tracking link, plus their shipping/contact details; creating an account is optional. Selecting account creation sets a password and sends an email-verification link, while allowing the current order to complete before verification. Guest orders use a nullable `user_id`; an order number alone never grants access, since public tracking requires its random per-order token. Guest order creation is rate limited. Production deployments run `npm run migrate` before starting the API.

- **Email** via the same SMTP config as password resets (`sendOrderConfirmation` in `lib/mail.js`).

Cash-on-delivery customers can tap **Confirm & open WhatsApp** on the order-success or tracking page. The server records their confirmation, then WhatsApp opens with a ready-to-send message to the store contact; the customer must tap Send. This is customer-initiated and does not use Twilio or send an automated WhatsApp message. The receipt email is deliberately neutral and never asks the customer to confirm, since the customer may already have done so.

Both messages include a tracking link: `GET /api/orders/track/:id?token=...`, a public (no-login) endpoint guarded by a random per-order token (not the order's numeric id — that alone proves nothing). It returns order status, items, delivery method, and city/country only — no email, phone, or full address. The storefront's `track.html` page renders it, and also offers a manual order-number + tracking-code lookup for someone who lost the link. Signed-in customers see the same link for every past order under **My Account → Orders**, which now lists real order history instead of only the most recent order in that browser.

For production deployment, configure mail through the service's environment variables. On Railway plans where outbound SMTP is unavailable, use an HTTPS API. SendGrid supports verifying a single sender address by email, but Gmail may defer those messages when the visible `From` domain does not align with the sending service's SPF or DKIM domain.

For a Gmail sender without a custom domain, the **Google Apps Script relay** avoids custom-domain authentication and OAuth consent-screen domain verification. Create a script under the sending Gmail account, copy `scripts/google-apps-script-mail-relay.gs` into it, save a long random value as the Script Property `MAIL_RELAY_SECRET`, run `authorizeMailer` once to grant mail-sending permission, and deploy it as a web app that executes as you and allows anyone to access it. Add the resulting `/exec` URL and the same random secret to Railway:

```env
GMAIL_APPS_SCRIPT_URL=https://script.google.com/macros/s/your-deployment-id/exec
GMAIL_APPS_SCRIPT_SECRET=your-long-random-shared-secret
MAIL_FROM="Nuvanti <the-authorized-sending-account@gmail.com>"
```

The shared secret protects the public endpoint; keep it private and redeploy the web app after changing its code. Consumer Gmail Apps Script mail is subject to Google's current daily recipient quota (currently 100 recipients/day). See Google's [Apps Script web app deployment guide](https://developers.google.com/apps-script/guides/web) and [quotas](https://developers.google.com/apps-script/guides/services/quotas).

The direct Gmail API is also supported. Enable Gmail API in a Google Cloud project, create OAuth credentials with the `https://www.googleapis.com/auth/gmail.send` scope, authorize the sending Gmail account, and set a refresh token in Railway:

```env
GMAIL_CLIENT_ID=your-oauth-client-id
GMAIL_CLIENT_SECRET=your-oauth-client-secret
GMAIL_REFRESH_TOKEN=your-oauth-refresh-token
MAIL_FROM="Nuvanti <the-authorized-sending-account@gmail.com>"
```

The Gmail API path uses HTTPS, refreshes its access token per send, and takes priority when these credentials are present. Keep all three OAuth values private. The address in `MAIL_FROM` must be the same Gmail account that authorized the app.

Alternatively, use SendGrid by creating a **Mail Send** API key and verifying the sender address, then set:

```env
SENDGRID_API_KEY=your-sendgrid-mail-send-api-key
MAIL_FROM="Nuvanti <your-verified-sender@gmail.com>"
```

For Render, add `SENDGRID_API_KEY` as a secret environment variable alongside `MAIL_FROM` in the service settings, then redeploy. The Render blueprint declares this variable so it can be configured there. The app submits each transactional email directly to SendGrid or Resend when the corresponding API key is configured; SMTP relay queues can delay delivery. A provider's acceptance response means the message was handed off, while final inbox arrival also depends on provider processing and the recipient's mail service.

Alternatively, Resend requires a verified domain. Gmail SMTP works only where the host permits outbound SMTP; enable two-step verification and create a Google **App Password**, never use the normal Gmail password. Keep API keys and app passwords private and never commit them:

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
- Client IPs in admin sign-in notifications and audit records come from a verified Cloudflare Pages signature or Railway's `X-Real-IP`. If a storefront request lacks a valid signature, its IP is marked unavailable rather than recording a proxy IP. Set the same `NUVANTI_PROXY_IP_SECRET` in backend and Cloudflare Pages.
- Helmet headers, request size limits, strict CORS, origin checks on writes, validation, and rate limits.
- Checkout re-prices products and locks inventory rows in a PostgreSQL transaction. A browser cannot choose prices or oversell stock.
- Parameterized SQL and Zod input validation everywhere, including admin mutations.
- Customer-supplied strings (name, email, shipping address) are HTML-escaped before the admin UI renders them, to prevent stored XSS via order/checkout data.

## Security boundaries

Authenticator MFA currently applies to staff accounts only. It requires an authenticator app (TOTP) and protects staff login; keep the recovery codes somewhere private. The encryption key must be a stable, unique deployment variable. **Do not rotate `MFA_ENCRYPTION_KEY` after enrolling staff**, because the server needs it to decrypt authenticator secrets. Generate a strong value locally, for example in PowerShell:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Add the result as `MFA_ENCRYPTION_KEY` in the backend hosting service's environment, then deploy. When moving the API, copy the existing key exactly so enrolled staff can still sign in. Never paste that key into chat, source files, or Git. Existing sessions created before session tracking was added will need to sign in once after deployment. Session labels use browser user-agent data, which is an approximate device description rather than a verified device identity. Customer registration sends an email-verification link and provides a resend action. **Checkout enforces verification in both the storefront and API**; the API returns `EMAIL_NOT_VERIFIED` for an unverified customer, so bypassing the browser UI does not bypass the check. General/shipping settings, basic sales analytics, inventory adjustment history, contact inbox, newsletter management, and homepage slideshow editing are backend-connected. Other page copy remains in the storefront source. Carrier booking/tracking is not connected and does not become real carrier tracking just because an order status changes.

### Paymob online payments (Egypt / EGP)

Hosted online checkout is implemented and stays off by default. After setting up Paymob, a super administrator can turn it on or off in Admin → Settings → Payments. The store still requires all four variables below on the Railway backend service before the switch can be enabled:

- `PAYMOB_SECRET_KEY`: server-side API secret; never expose it to the storefront.
- `PAYMOB_PUBLIC_KEY`: the public key used to open Paymob Unified Checkout.
- `PAYMOB_PAYMENT_METHODS`: comma-separated Paymob payment integration IDs (for example `123456` or `123456,234567`), all from the same test/live mode as the keys.
- `PAYMOB_HMAC_SECRET`: callback HMAC secret used to authenticate payment events.

Add all four values to the backend hosting service (never Cloudflare Pages or frontend code), deploy the migration, then reload Admin → Settings → Payments. The switch remains off until explicitly enabled. `API_PUBLIC_URL` must be the public HTTPS backend URL, and `STORE_ORIGIN` must be the storefront URL so Paymob returns customers to the right site. Each payment intention sends the webhook URL automatically for card integrations. Also set `https://<your-backend-domain>/api/payments/paymob/webhook` as the transaction processed callback on each Paymob integration you enable, especially for wallets and other methods that do not support per-intention notification URLs. Turning payments off hides the online option and rejects new online orders; payment links already created at Paymob may remain usable until they expire.

Keep test credentials and test integration IDs together first. Complete a test purchase from the storefront and confirm the signed callback updates that exact order in Admin → Orders before switching all keys and integration IDs together to live mode. A browser redirect never marks an order paid: only a valid HMAC callback with the expected Paymob integration, EGP currency, order amount, and provider order ID does. Paymob handles card details on its hosted checkout page. Confirm fees, settlement, refunds, enabled methods, and merchant approval with Paymob before accepting live payments.

Discounts now have a real backend: admin create/activate/deactivate/delete goes through `/api/admin/discounts`, and the storefront cart and checkout pages validate a code against `/api/orders/validate-discount` (a public, no-login preview) before it's applied at order time in `/api/orders`, where it's re-validated and its usage count incremented inside the same row-locked transaction as inventory. Codes support a percentage or fixed amount, an optional minimum order subtotal, an optional usage limit, and an optional expiry — there is no scheduled "starts on" date and no free-shipping discount type; both would need a schema change first.

## Production notes

The repository's `render.yaml` configures the backend as a Render web service in Frankfurt, with migrations, bootstrap, and the `/api/health` check. It reuses the existing Supabase PostgreSQL database; do not create an empty replacement database if production orders and accounts must be kept. Set `DATABASE_URL`, `DATABASE_SSL_CA`, `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, and `NUVANTI_PROXY_IP_SECRET` from the existing production setup. After the Render service is healthy, set Cloudflare Pages `NUVANTI_API_ORIGIN` to its HTTPS URL and set the same `NUVANTI_PROXY_IP_SECRET` there. Never publish `frontend/admin` as an unprotected static site. Only Egypt is accepted at checkout; configure actual rates and fulfillment with your courier before accepting orders. Online checkout remains unavailable until Paymob credentials and its HMAC callback are configured.

See the repository-level `DEPLOYMENT-POSTGRES.md` for Render and Supabase configuration. PostgreSQL remains the source of truth; the separate Cloudflare D1 database is not used by this backend.
