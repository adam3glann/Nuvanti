# Nuvanti pre-launch checklist

The project now has working storefront and protected admin applications with a PostgreSQL API. Complete these brand and infrastructure items before taking real orders:

- Choose the final shop, admin, and API hostnames. Configure DNS, HTTPS certificates, reverse-proxy routes, `STORE_ORIGIN`, `ADMIN_ORIGIN`, `ADMIN_APP_URL`, and `API_PUBLIC_URL`. Keep the admin host protected; never publish `frontend/admin` from the shop host. For three unrelated domains, use a same-origin `/api` reverse proxy for each app to avoid browser third-party-cookie blocking.
- Provision PostgreSQL, set a unique 32+ character production `JWT_SECRET`, apply migrations, and seed the starting catalog and first super-admin. Back up the database and test restoring it.
- Configure and test SMTP delivery for account recovery, admin setup, order confirmations, and newsletter confirmation. Optional WhatsApp and Cloudinary features need their own production credentials.
- Confirm every product name, description, price, SKU, size/color variant, stock quantity, image, and brand asset. Test a real device-size storefront and the admin workflows with production-shaped catalog data.
- Confirm shipping areas, courier rates, service levels, delivery estimates, returns/refunds, privacy, and terms with the actual operator and qualified local counsel. The checkout currently supports Egypt, flat standard/express rates, and Cash on Delivery. It does not book a courier or receive carrier scans.
- Connect a payment provider and signed webhooks before offering card payment. Card processing and refunds are not implemented; checkout currently accepts Cash on Delivery only.
- Replace or confirm social handles, customer support details, hero copy, campaign dates, and policies in the frontend source. Homepage editing is not provided in Admin.
- Place and fulfill an end-to-end test order; verify confirmation email, the private tracking link, the admin order status, stock changes, customer account history, contact inbox, newsletter confirmation/unsubscribe, and scheduled database backups.
