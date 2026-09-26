# Nuvanti pre-launch checklist

Use this checklist before opening the store to real customers. Application code cannot verify that external provider accounts, DNS, payment credentials, merchant settlement, or backups are correctly configured; confirm those in their provider dashboards.

## Hosting and database

- [ ] Railway deploys from the repository root and passes `/api/health` after migrations and bootstrap.
- [ ] Cloudflare Pages uses `frontend/` as its project root and deploys the `/api/*` proxy. If the Railway domain changes, set `NUVANTI_API_ORIGIN` in Pages and redeploy.
- [ ] Railway `STORE_ORIGIN` exactly matches the live storefront origin; `COOKIE_DOMAIN` is blank. The `frontend/admin/` directory is not deployed as public static content.
- [ ] Production variables from [DEPLOYMENT-POSTGRES.md](DEPLOYMENT-POSTGRES.md) are set. `JWT_SECRET` and `MFA_ENCRYPTION_KEY` are unique, random, and private. Keep the MFA key stable after enrollment.
- [ ] Supabase PostgreSQL is reachable with TLS certificate verification enabled. Confirm migrations are applied and the initial active super-admin can sign in.
- [ ] Remove the one-time `NUVANTI_BOOTSTRAP_ADMIN_*` variables after the initial super-admin and catalog are set up.
- [ ] Database backup schedule and retention are enabled for the selected Supabase plan; complete and document a restore rehearsal before launch.

## Account security and email

- [ ] Enable 2FA for each staff account and store its recovery codes in a private password manager. Confirm that login requires a fresh authenticator code.
- [ ] Configure SMTP or Resend and a valid `MAIL_FROM`. In Admin → Settings → Email, send a test message and confirm it arrives.
- [ ] Create a fresh customer account and confirm the verification email arrives. Confirm the link verifies the account and checkout rejects unverified accounts through the API.
- [ ] Verify password reset, administrator setup, order confirmation, order status, and newsletter confirmation/unsubscribe emails. Check provider logs and spam folders if a message is missing.
- [ ] Optional: configure Cloudinary and upload a product image and a homepage/category image. Optional: configure Twilio WhatsApp and confirm the recipient number is eligible.

## Catalog, checkout, and fulfillment

- [ ] Review product names, descriptions, prices, costs, SKUs, images, colors, sizes, and per-size stock. Confirm slideshow imagery, customer support details, social links, and campaign dates.
- [ ] Confirm shipping areas, rates, delivery estimates, courier arrangements, exchange/refund rules, privacy policy, and terms with the actual operator and appropriate local professionals. Checkout currently supports Egypt and configured standard/express rates; it does not book a courier or receive carrier scans.
- [ ] Place a Cash on Delivery order and verify totals, inventory, email, account history, private tracking link, and admin status updates.
- [ ] If enabling Paymob, configure all four Paymob variables and the transaction callback URL. Complete a test payment, verify the signed webhook updates the correct order, and reconcile the result in Paymob before switching to live credentials. Refunds are not automated; document the manual refund and order reconciliation procedure.
- [ ] Test the customer storefront on desktop and mobile, including sign-in, email verification, cart, discounts, checkout, and order tracking. Test admin product editing, customer/order pages, exports, and image uploads.
- [ ] Confirm the admin header’s live online count changes as separate devices open/close the storefront. The count updates every 15 seconds and stale sessions expire automatically if a browser closes without sending its leave signal.
- [ ] Confirm contact messages appear in Admin → Customers → Contact Messages and that configured support notifications arrive.

## Policies and launch decision

- [ ] Ensure all public policy and checkout text matches the real operation, including the current exchange/refund process. Refunds and carrier integrations are not automated by this application.
- [ ] Confirm production Paymob merchant approval, accepted payment methods, fees, settlement timing, and support contacts before collecting live payments.
- [ ] Keep Cash on Delivery available while Paymob remains unconfigured; the online payment choice stays hidden until Paymob settings are complete.
- [ ] Review Railway, Cloudflare, Supabase, email, Cloudinary, and Paymob usage, billing, and alerting. Assign an owner to respond to failed deployments, mail, and payment callbacks.

Do not announce launch until the required items above are checked and the full customer order path has been completed successfully in production or a production-like environment.
