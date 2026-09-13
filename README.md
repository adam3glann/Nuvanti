# Nuvanti — Frontend (Phase 1: Frontend Only)

A production-quality, frontend-only e-commerce experience for Nuvanti, a
premium clothing brand. No build step required — but it **must** be served
by a local web server, not opened as a `file://` path.

## Running it

```bash
# from this folder
python3 -m http.server 8080
# or
npx serve .
```
Then visit `http://localhost:8080`.

> **Important:** every page loads its JavaScript as an ES module
> (`<script type="module">`). Browsers block ES modules from running over
> `file://` for security reasons, so double-clicking `index.html` to open it
> directly will load the page with none of its JavaScript running — no
> header/footer, no cart, no product gallery, nothing interactive. That's
> almost certainly why the site can look like "there's no JS" even though
> `assets/js/` is full of it. Always use one of the commands above (or any
> other static server / your editor's "Live Server") while working on this.

It's plain HTML/CSS/JS (ES modules) — no bundler, no npm install. This was
a deliberate choice for this phase: it removes the build step, works in
any static host, and still upgrades cleanly to a framework later.

## Structure

```
nuvanti/
├── index.html, shop.html, product.html, cart.html, checkout.html,
│   order-success.html, wishlist.html, account.html, about.html,
│   contact.html, faq.html, size-guide.html, 404.html
├── assets/
│   ├── css/        tokens.css (design system), base.css, components.css, pages.css
│   ├── img/        (empty — see "Imagery" below)
│   └── js/
│       ├── data/          products.js, categories.js, navigation.js — mock catalog
│       ├── services/      cartService, wishlistService, productService,
│       │                  authService, orderService — the only files that
│       │                  should change when a real backend exists
│       ├── components/    header, footer, cartDrawer, searchOverlay,
│       │                  productCard, modal, toast, icons, scrollReveal
│       ├── pages/         one controller per page (home.js, shop.js, ...)
│       └── main.js        shared shell bootstrap (header/footer/drawers)
```

## Backend

A starter Node/Express API now lives in `../backend` (products, categories,
orders/checkout, contact form — see `backend/README.md` for endpoints and
how to run it). It's a starting point, not the full admin backend.

## Connecting the real backend later

Everything that currently reads mock data goes through `assets/js/services/`.
To connect Node.js:

- `productService.js` — replace each function body with a `fetch('/api/...')`
  call returning the same shape. Nothing in `pages/` or `components/` needs
  to change.
- `cartService.js` / `wishlistService.js` — currently localStorage. Swap the
  `read()`/`write()` internals for API calls once carts are tied to a user.
- `authService.js` — **mock only**, clearly marked. Replace entirely with
  real session/token handling; don't extend it in place.
- `orderService.js` — **mock only**. Real order creation, pricing, and
  inventory checks must happen server-side.

Product objects already match a schema that maps directly onto a database
table (`id, slug, name, price, images, colors, sizes, inventory, badges…`).

## Imagery

All images currently come from `picsum.photos` as deterministic placeholders
(same seed = same image every time) so the layout can be fully reviewed.
Swap these for real product photography by replacing the URLs in
`assets/js/data/products.js` and `categories.js` — the `<img>` markup,
`srcset`-ready structure, and lazy-loading attributes are already in place.

## What's covered

Home (hero slider, featured, categories, new arrivals carousel, editorial
split, campaign banner, bestsellers, Instagram grid, newsletter), Shop
(filters, sort, search, grid/list, load more, mobile filter drawer), Product
detail (gallery, variants, size guide modal, stock states, related +
recently viewed), Cart drawer + full cart page (free shipping progress,
promo code, quantity controls), Wishlist, Checkout (info, shipping, delivery,
payment UI placeholder) → mock Order Success, Account (login / register /
forgot password / profile / orders / addresses / logout, consolidated into
one page that switches views based on mock session state), About, Contact,
FAQ (accordion), Size Guide, 404, empty/error/loading states throughout.

Reduced-motion, keyboard navigation, and focus states are handled globally
in `base.css` and respected by the hero slider, drawers, and modals.

## Known simplifications (flagged, not hidden)

- Login/Register/Forgot Password/Profile/Orders/Addresses live in one
  `account.html` with view-switching, instead of six separate files —
  same functionality, less duplication to maintain by hand without a
  templating layer.
- Images are neutral placeholders, not real product photography.
- Search, filters, and product listings run against the in-memory mock
  catalog (24 products) rather than a paginated API.
