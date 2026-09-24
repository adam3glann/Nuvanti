# Nuvanti deployment with PostgreSQL

PostgreSQL stays the application's only database. The Cloudflare D1 database created earlier is not connected to the app and can be left unused. Use a managed PostgreSQL provider with a dashboard/table browser (for example Supabase) so orders, customers, products, and admin accounts remain visible to you.

## Prepare and deploy

The step-by-step deployment for the current no-card host is in
[`NETLIFY-POSTGRES.md`](NETLIFY-POSTGRES.md). The shop stays on Cloudflare Pages,
Netlify serves the API and protected admin portal at `admin.nuvanti.com`, and
Supabase PostgreSQL remains the primary database. Do not paste database
connection strings or secrets into chat or commit them to Git.

## Free-plan limitation

The Netlify Free plan has a monthly usage limit and can pause projects when
that limit is reached. Supabase's free plan is useful for preview and has a
dashboard, but projects can pause after inactivity and downloadable backups
are not available on that plan. Review the current provider limits and enable
durable backups/always-on service before treating the deployment as a
production store.

Cloudflare Pages can continue serving the static storefront at no charge. Card payments are not enabled by this setup; checkout is cash on delivery only until a payment provider and its verified webhook are configured.
