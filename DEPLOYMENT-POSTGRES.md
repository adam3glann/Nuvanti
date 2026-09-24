# Nuvanti deployment with PostgreSQL

PostgreSQL stays the application's only database. The Cloudflare D1 database created earlier is not connected to the app and can be left unused. Use a managed PostgreSQL provider with a dashboard/table browser (for example Supabase) so orders, customers, products, and admin accounts remain visible to you.

## Prepare the database

1. Create a PostgreSQL project with your chosen managed database provider. Save its database password privately.
2. Wait for Supabase to finish provisioning, then choose **Connect → Connection string → Session pooler**. Use its URI (port 5432), since it supports IPv4-only hosts such as Render. Never paste the URI into chat or commit it.

## Deploy the API and protected admin

1. Push the prepared project changes to the GitHub `main` branch connected to Render and Cloudflare Pages.
2. In Render, choose **New → Blueprint**, select the Nuvanti repository, and apply `render.yaml`.
3. Set the private `DATABASE_URL`, first-admin email, and a unique first-admin password (at least 12 characters) in Render. Use real SMTP credentials so password reset and order emails can be delivered. Render generates `JWT_SECRET` for the service. On its first start, the service applies the PostgreSQL migrations, inserts the starter catalog once, and creates the first super-admin. The bootstrap password is never displayed; remove the bootstrap password variable after the first successful deploy.
4. Wait for the health check at `/api/health` to pass.
5. In this Render service's **Settings → Custom Domains**, add both `api.nuvanti.com` and `admin.nuvanti.com`. Add the exact DNS records Render shows in Cloudflare.
6. In Cloudflare Pages for `nuvanti-shop`, add `nuvanti.com` as its custom domain. The storefront and admin use the API at `api.nuvanti.com`; the admin remains server-protected on its separate hostname.
7. Sign in at `https://admin.nuvanti.com/login.html` using the admin account created above. Check `https://api.nuvanti.com/api/health`, then verify catalog, admin login, order placement, and order visibility in the PostgreSQL dashboard.

## Free-plan limitation

`render.yaml` selects Render's free web service to allow a no-cost preview. Free web services sleep after inactivity, so the first request can be delayed. Do not use Render's free Postgres for real orders: it expires after 30 days and has no backups. For a real brand launch, use a durable managed PostgreSQL plan with backups and an always-on API plan. Supabase's free plan is useful for preview and has a dashboard, but its projects can pause after inactivity and downloadable backups are not available on that plan. Review the provider's current limits before accepting customer orders.

Cloudflare Pages can continue serving the static storefront at no charge. Card payments are not enabled by this setup; checkout is cash on delivery only until a payment provider and its verified webhook are configured.
