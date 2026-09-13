# Nuvanti Backend (starter API)

This is a small, working starter API — not the full backend for every admin
feature in `frontend/admin`. It gives you real endpoints for the parts of the
storefront that need a server (products, categories, checkout/orders, the
contact form), backed by JSON files in `data/` so there's nothing to install
or configure to try it locally. Swap `lib/store.js` for a real database
later — the routes don't need to change.

## Run it

```bash
cd backend
npm install
npm start        # http://localhost:4000
# or, for auto-restart on save:
npm run dev
```

## Endpoints

- `GET  /api/health`
- `GET  /api/products` — optional query params: `category`, `collection`, `search`
- `GET  /api/products/:slug`
- `GET  /api/products/:slug/related?limit=4`
- `GET  /api/categories`
- `GET  /api/orders`
- `GET  /api/orders/:id`
- `POST /api/orders` — body: `{ items: [...], customer: { email, name, ... }, shipping: {...} }`
- `POST /api/contact` — body: `{ name, email, message }`

## Connecting the frontend to it

Right now `frontend/assets/js/services/productService.js` (and the other
services) read straight from the local `data/products.js` file, so the site
works with zero setup. To point the site at this API instead, change the
`fetch`/data calls in those service files to call e.g.
`http://localhost:4000/api/products` — nothing else in the frontend needs to
change, since the page code already goes through that service layer.

## What's not built yet

Auth, the full admin panel (roles, discounts, inventory, analytics, audit
log) and payments are not implemented — that's a much bigger project on its
own. This starter covers the pieces the public storefront actually needs to
go live (catalog + checkout + contact), so you have something real to build
the rest on top of.
