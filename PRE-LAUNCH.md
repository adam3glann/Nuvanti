# Nuvanti pre-launch checklist

The project now has working storefront and protected admin applications with a PostgreSQL API. Complete these brand and infrastructure items before taking real orders:

- Deploy the backend and protected admin portal to Railway and keep the repository root as the service root. Set all Railway variables listed in [DEPLOYMENT-POSTGRES.md](DEPLOYMENT-POSTGRES.md), including `DATABASE_URL` and `DATABASE_SSL_CA`, before startup.
- Set the storefront's API URL to the Railway public domain and redeploy Cloudflare Pages. Never publish `frontend/admin` from the shop host.
- Provision PostgreSQL, set a unique 32+ character production `JWT_SECRET`, apply migrations, and seed the starting catalog and first super-admin. Back up the database and test restoring it.
- Configure and test SMTP or Resend delivery for account verification, account recovery, admin setup, order confirmations, and newsletter confirmation in Admin → Settings → Email. Contact messages remain saved in Admin → Customers → Contact Messages; email alerts use the support address in Settings. Optional WhatsApp and Cloudinary features need their own production credentials.
- Confirm every product name, description, price, SKU, size/color variant, stock quantity, image, and brand asset. Test a real device-size storefront and the admin workflows with production-shaped catalog data.
- Confirm shipping areas, courier rates, service levels, delivery estimates, returns/refunds, privacy, and terms with the actual operator and qualified local counsel. The checkout currently supports Egypt, flat standard/express rates, and Cash on Delivery. It does not book a courier or receive carrier scans.
- Connect a payment provider and signed webhooks before offering card payment. Card processing and refunds are not implemented; checkout currently accepts Cash on Delivery only.
- Replace or confirm social handles, customer support details, campaign dates, and policies in the frontend source. Homepage slideshow images and copy can be managed in Admin → Content & Marketing → Homepage Slides.
- Place and fulfill an end-to-end test order; verify confirmation email, the private tracking link, the admin order status, stock changes, customer account history, contact inbox, newsletter confirmation/unsubscribe, and scheduled database backups.
