
# Nuvanti

<p align="center">
  <img src="frontend/assets/img/brand/nuvanti-logo.png" alt="Nuvanti Logo" width="180">
</p>

<h3 align="center">Premium Essentials. Timeless Style.</h3>

<p align="center">
  A modern fashion e-commerce experience built for Nuvanti — a premium clothing brand focused on effortless style, quality, and everyday essentials.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Structure</a> •
  <a href="#backend-api">Backend API</a> •
  <a href="#roadmap">Roadmap</a>
</p>

---

## Overview

**Nuvanti** is a premium clothing e-commerce platform designed to deliver a clean, elegant, and seamless shopping experience.

The project combines a carefully designed storefront with a Node.js REST API foundation, providing a strong starting point for a complete fashion commerce platform.

From discovering products to exploring collections, managing a cart, and going through checkout, Nuvanti is designed around a smooth and modern shopping journey.

### Project Status

![Status](https://img.shields.io/badge/status-in%20development-orange)
![Frontend](https://img.shields.io/badge/frontend-HTML%20%7C%20CSS%20%7C%20JavaScript-blue)
![Backend](https://img.shields.io/badge/backend-Node.js%20%7C%20Express-green)

> **Current phase:** Frontend-focused e-commerce experience with a starter Node.js backend API.

---

## Features

### Storefront

- Modern, responsive fashion e-commerce design
- Premium brand landing page
- Hero section and promotional campaigns
- Featured products and new arrivals
- Product categories and collections
- Product search
- Product filtering and sorting
- Grid and list product views
- Product detail pages
- Product image galleries
- Product color and size selection
- Stock availability states
- Related products
- Recently viewed products
- Wishlist functionality
- Shopping cart drawer
- Full shopping cart page
- Quantity controls
- Free shipping progress indicator
- Promotional code interface
- Checkout flow
- Order success page
- Account and profile pages
- Login, registration, and password recovery interfaces
- Orders and address views
- Contact page
- FAQ accordion
- Size guide
- Shipping, refund, privacy, and terms pages
- Custom 404 page

### User Experience

- Responsive layouts
- Reusable UI components
- Custom design system
- Consistent typography and spacing
- Smooth scroll-reveal animations
- Keyboard navigation
- Focus states
- Reduced-motion support
- Loading, empty, and error states
- Mobile-friendly shopping experience

### Admin Dashboard

The project also includes an admin dashboard interface with pages for:

- Dashboard
- Analytics
- Products
- Catalog
- Inventory
- Orders
- Customers
- Discounts
- Content
- Users
- Roles
- Security
- Settings
- Audit logs

The admin interface is currently a frontend prototype and is not yet connected to a complete production backend.

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| HTML5 | Page structure |
| CSS3 | Styling and responsive layouts |
| JavaScript (ES Modules) | Application logic and interactivity |
| LocalStorage | Local cart, wishlist, and mock session persistence |
| Custom CSS Design System | Tokens, components, and page styles |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express.js | REST API framework |
| CORS | Cross-origin request support |
| JSON Files | Lightweight data storage |

### Architecture

- Multi-page frontend architecture
- Modular JavaScript services
- Reusable UI components
- Separate page controllers
- Service layer for data access
- JSON-backed starter API
- No frontend bundler required

---

## Project Structure

```text
Nuvanti/
│
├── frontend/
│   │
│   ├── index.html
│   ├── shop.html
│   ├── product.html
│   ├── cart.html
│   ├── checkout.html
│   ├── order-success.html
│   ├── wishlist.html
│   ├── account.html
│   ├── about.html
│   ├── contact.html
│   ├── faq.html
│   ├── size-guide.html
│   ├── 404.html
│   │
│   ├── admin/
│   │   ├── index.html
│   │   ├── analytics.html
│   │   ├── products.html
│   │   ├── orders.html
│   │   ├── customers.html
│   │   ├── inventory.html
│   │   ├── discounts.html
│   │   ├── users.html
│   │   ├── roles.html
│   │   ├── settings.html
│   │   └── ...
│   │
│   ├── assets/
│   │   ├── css/
│   │   │   ├── tokens.css
│   │   │   ├── base.css
│   │   │   ├── components.css
│   │   │   └── pages.css
│   │   │
│   │   ├── img/
│   │   │   ├── brand/
│   │   │   ├── lifestyle/
│   │   │   └── products/
│   │   │
│   │   └── js/
│   │       ├── data/
│   │       ├── services/
│   │       ├── components/
│   │       ├── pages/
│   │       └── main.js
│   │
│   └── ...
│
├── backend/
│   ├── server.js
│   ├── package.json
│   │
│   ├── routes/
│   │   ├── products.js
│   │   ├── categories.js
│   │   ├── orders.js
│   │   └── contact.js
│   │
│   ├── lib/
│   │   └── store.js
│   │
│   └── data/
│       ├── products.json
│       ├── categories.json
│       ├── orders.json
│       └── messages.json
│
├── .gitignore
├── package-lock.json
└── README.md
```

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) — required for the backend
- A modern web browser

The frontend does not require npm installation or a build tool.

---

## Running the Frontend

The frontend is built with plain HTML, CSS, and JavaScript ES modules.

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/nuvanti.git
```

Replace `YOUR_USERNAME/nuvanti` with your actual GitHub repository URL.

### 2. Navigate to the frontend

```bash
cd nuvanti/frontend
```

### 3. Start a local web server

Using Python:

```bash
python3 -m http.server 8080
```

Or using Node.js:

```bash
npx serve .
```

### 4. Open the website

Visit:

```text
http://localhost:8080
```

> **Important:** Do not open `index.html` directly using `file://`.
>
> The website uses JavaScript ES modules, which require a local web server to work correctly.

---

## Running the Backend

The backend provides a starter REST API for products, categories, orders, and contact messages.

### 1. Open the backend directory

From the project root:

```bash
cd backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the server

```bash
npm start
```

The API will run at:

```text
http://localhost:4000
```

### Development mode

To automatically restart the server when files change:

```bash
npm run dev
```

### Health check

Open:

```text
http://localhost:4000/api/health
```

---

## Backend API

### Base URL

```text
http://localhost:4000/api
```

### Products

| Method | Endpoint | Description |
|---|---|---|
| GET | `/products` | Get all products |
| GET | `/products/:slug` | Get a product by slug |
| GET | `/products/:slug/related?limit=4` | Get related products |

Supported product query parameters:

```text
/api/products?category=polos
/api/products?collection=new-arrivals
/api/products?search=navy
```

### Categories

```http
GET /api/categories
```

Returns available product categories.

### Orders

```http
GET /api/orders
```

Returns orders from the backend data store.

```http
GET /api/orders/:id
```

Returns a specific order.

```http
POST /api/orders
```

Creates a new order.

Example request body:

```json
{
  "items": [
    {
      "productId": "product-id",
      "quantity": 1
    }
  ],
  "customer": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "shipping": {
    "address": "123 Example Street",
    "city": "Cairo",
    "country": "Egypt"
  }
}
```

### Contact

```http
POST /api/contact
```

Example request body:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "message": "Hello Nuvanti!"
}
```

> The backend is a starter API. Authentication, secure payment processing, and complete server-side order validation are not implemented yet.

---

## Frontend Architecture

Nuvanti uses a modular frontend structure to keep the code maintainable and easy to extend.

### Components

Reusable interface components are located in:

```text
frontend/assets/js/components/
```

Examples:

- Header
- Footer
- Product cards
- Cart drawer
- Search overlay
- Modal
- Toast notifications
- Icons
- Scroll reveal

### Page Controllers

Each page has its own JavaScript controller:

```text
frontend/assets/js/pages/
```

Examples:

- `home.js`
- `shop.js`
- `product.js`
- `cart.js`
- `checkout.js`
- `account.js`
- `wishlist.js`

### Services

Application data and business logic are organized into service modules:

```text
frontend/assets/js/services/
```

Examples:

- `productService.js`
- `cartService.js`
- `wishlistService.js`
- `authService.js`
- `orderService.js`

This makes it easier to replace mock data with a real backend without rewriting the page controllers and UI components.

---

## Data & Storage

### Frontend

The current storefront uses local mock data for its catalog.

LocalStorage is used for client-side features such as:

- Cart
- Wishlist
- Mock account/session state

### Backend

The starter API stores data in JSON files:

```text
backend/data/
```

This makes the project easy to run locally without configuring a database.

For production, the JSON storage layer should be replaced with a proper database.

---

## Design System

Nuvanti follows a custom design system built around a premium fashion aesthetic.

The design system includes:

- Color tokens
- Typography
- Spacing
- Layout rules
- Buttons
- Cards
- Forms
- Navigation
- Modals
- Toasts
- Responsive behavior

Main design tokens:

```text
frontend/assets/css/tokens.css
```

Shared styles:

```text
frontend/assets/css/base.css
frontend/assets/css/components.css
frontend/assets/css/pages.css
```

---

## Screens & Pages

### Customer Storefront

- Home
- Shop
- Product Details
- Cart
- Checkout
- Order Success
- Wishlist
- Account
- About
- Contact
- FAQ
- Size Guide
- Policies

### Admin Dashboard

- Dashboard
- Analytics
- Catalog
- Products
- Product Editor
- Inventory
- Orders
- Order Details
- Customers
- Customer Details
- Discounts
- Content
- Users
- Roles
- Security
- Settings
- Audit Logs

---

## Current Limitations

This project is actively being developed. The following features are not yet production-ready:

- Real authentication and user sessions
- Complete admin backend
- Role-based access control
- Production database
- Secure payment processing
- Server-side inventory management
- Real-time order management
- Production-grade order validation
- Complete analytics backend
- Production email notifications
- Real product photography integration

The current checkout and account flows include mock or frontend-only functionality where applicable.

---

## Roadmap

### Phase 1 — Frontend Experience

- [x] Build the Nuvanti storefront
- [x] Create responsive layouts
- [x] Implement product catalog
- [x] Implement cart and wishlist
- [x] Create checkout UI
- [x] Build account interface
- [x] Create admin dashboard prototype
- [x] Add starter backend API

### Phase 2 — Backend Integration

- [ ] Connect storefront products to the API
- [ ] Replace mock catalog data
- [ ] Connect checkout to real order creation
- [ ] Add database support
- [ ] Implement server-side validation
- [ ] Add inventory management
- [ ] Add real authentication

### Phase 3 — Production Commerce

- [ ] Implement secure payments
- [ ] Add complete admin permissions
- [ ] Add order status management
- [ ] Add customer management
- [ ] Add discounts and promotions
- [ ] Add analytics
- [ ] Add email notifications
- [ ] Optimize performance and SEO
- [ ] Deploy the production storefront

---

## Contributing

Contributions, suggestions, and improvements are welcome.

### How to contribute

1. Fork the repository.
2. Create a feature branch:

   ```bash
   git checkout -b feature/your-feature
   ```

3. Make your changes.
4. Commit your work:

   ```bash
   git commit -m "feat: add your feature"
   ```

5. Push the branch:

   ```bash
   git push origin feature/your-feature
   ```

6. Open a Pull Request.

Please keep the existing design system and modular architecture consistent when adding new features.

---

## Security

Before deploying Nuvanti to production:

- Add secure authentication.
- Validate all requests on the server.
- Never trust client-side prices or inventory.
- Protect admin routes.
- Use environment variables for secrets.
- Configure secure CORS policies.
- Use HTTPS.
- Integrate a secure payment provider.
- Replace JSON storage with a production database.
- Add proper error handling and logging.

---

## License

This project is currently intended for development and portfolio purposes.

Add your preferred license before distributing the project publicly.

---

## Author

**Nuvanti**

Premium fashion. Everyday essentials.

<p align="center">
  Built with passion, creativity, and modern web technologies.
</p>
