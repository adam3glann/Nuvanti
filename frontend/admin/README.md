# Nuvanti Admin — Dashboard Frontend (Mock Data)

A separate, professional dashboard UI at `/admin`, distinct from the
storefront look. Plain HTML/CSS/JS (ES modules) — no build step, no
npm install. Open `admin/login.html` to start.

## Demo accounts (development only — not real credentials)

| Email | Password | Role |
|---|---|---|
| superadmin@nuvanti.test | demo1234 | Super Admin |
| admin@nuvanti.test | demo1234 | Admin |
| manager@nuvanti.test | demo1234 | Manager |
| staff@nuvanti.test | demo1234 | Staff |

The login screen also lists these as one-click buttons.

## What this is — and isn't

This is a **frontend only**. `adminAuthService.js` fakes a login by checking
against the table above and writing a session object to `localStorage`.
That is trivially editable by anyone with devtools open. **None of this is
a security boundary.** When the Node backend exists:

- Real authentication (password hashing, sessions/tokens, 2FA) replaces
  `adminAuthService.js` entirely.
- Every permission check in `components/permissions.js` is UI-only — it
  hides buttons a role shouldn't see, nothing more. The backend must
  independently re-verify role and permission on every request, because a
  manipulated frontend could claim to be any role.
- Nothing here should be trusted for pricing, inventory truth, or payment
  status — those all need server-side authority.

## Structure

```
admin/
├── login.html, index.html (dashboard), products.html, product-edit.html,
│   catalog.html (categories + collections), inventory.html, orders.html,
│   order-detail.html, customers.html, customer-detail.html, discounts.html,
│   content.html (homepage/hero/FAQ), analytics.html, users.html, roles.html,
│   audit-logs.html, security.html, settings.html
└── assets/
    ├── css/       tokens.css (separate design system), base.css, components.css
    └── js/
        ├── data/          mock admin users, orders, customers, categories,
        │                  collections, discounts, audit logs, notifications,
        │                  analytics — orders/customers are generated
        │                  deterministically from the storefront catalog
        ├── services/      adminAuthService, productService, orderService,
        │                  customerService, inventoryService, categoryService,
        │                  discountService, analyticsService, adminUserService,
        │                  auditLogService, settingsService, notificationService
        │                  — the only files to change when connecting Node
        ├── components/    sidebar, header, permissions (RBAC map), dataTable
        │                  helpers, confirmDialog/typedConfirmDialog, modal,
        │                  drawer, toast, statusBadge, charts (inline SVG),
        │                  shell (auth guard + layout bootstrap)
        └── pages/         one controller per page
```

## Roles implemented

Super Admin, Admin, Manager, Staff — permission matrix lives in
`components/permissions.js` and is rendered read-only on the Roles &
Permissions page. Editing roles is disabled until real role management
exists on the backend.

## Known simplifications (flagged, not hidden)

- Categories and Collections share one page (`catalog.html`) with tabs,
  rather than two separate pages.
- Settings sections (General/Checkout/Shipping/Payments/Notifications/
  Tax/Localization) are tabs on one page rather than separate routes.
- Charts are minimal dependency-free inline SVG (line/bar), not a full
  charting library — fine for this preview, worth swapping for something
  richer once real analytics data exists.
- 2FA, "log out all devices," and CSV export are UI-only placeholders that
  say so explicitly when clicked — no backend exists yet to back them.
- Notifications, audit logs, and analytics are static mock datasets, not
  live event streams.
- I have not opened this in a browser end-to-end — only checked every JS
  file for syntax errors and verified cross-file import paths resolve.
  A manual click-through pass is still worth doing before you rely on it.
