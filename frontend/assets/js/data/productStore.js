// productStore — the single live copy of the catalog, shared by the
// storefront and the admin panel through localStorage (same browser,
// same origin — admin and shop are just different pages of one site).
//
// This is the seam a real backend replaces: swap `load()`/`persist()`
// for `fetch('/api/products')` calls and nothing that imports from
// here needs to change, since everything goes through the functions
// below rather than touching a static array.
//
// Until then: whichever page loads first seeds localStorage from the
// static catalog in `products.js`. Every admin create/update/delete
// writes straight back to that same localStorage entry, so the next
// time a customer loads (or an already-open storefront tab re-reads)
// the catalog, they see the admin's changes. A `storage` event listener
// also keeps any other open tab (e.g. the storefront open next to the
// admin) in sync without a page reload.

import { products as seedProducts } from './products.js';

const STORAGE_KEY = 'nuvanti:products:v1';

function seed() {
  // Match the shape admin screens expect (status/cost/sku) so a product
  // created here looks the same whether it started as seed data or was
  // added later through the admin.
  return seedProducts.map((p) => ({
    status: 'active',
    cost: Math.round(p.price * 0.42),
    ...p,
    sku: p.sku || `NV-${p.id.toUpperCase()}`,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    // corrupt or inaccessible storage — fall back to the seed catalog
  }
  const initial = seed();
  persistRaw(initial);
  return initial;
}

function persistRaw(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // storage unavailable (private browsing, quota) — edits still work
    // for the rest of this tab's session, just won't survive a reload
  }
}

let store = load();
const listeners = new Set();

function persist() {
  persistRaw(store);
  listeners.forEach((fn) => { try { fn(store); } catch (e) { /* listener error shouldn't break others */ } });
}

// Keep other open tabs in sync (e.g. admin editing in one tab while the
// storefront sits open in another).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (Array.isArray(parsed)) {
          store = parsed;
          listeners.forEach((fn) => { try { fn(store); } catch (err) { /* ignore */ } });
        }
      } catch (err) { /* ignore malformed write from another tab */ }
    }
  });
}

/** Every product, including drafts/archived — used by the admin. */
export function getAllProducts() {
  return store;
}

/** Only products a customer should be able to see. */
export function getPublishedProducts() {
  // Products created before `status` existed have no field at all —
  // treat those as published so nothing already live disappears.
  return store.filter((p) => !p.status || p.status === 'active');
}

export function getProductById(id) {
  return store.find((p) => p.id === id) || null;
}

export function getProductBySlug(slug) {
  return store.find((p) => p.slug === slug) || null;
}

export function addProduct(data) {
  const id = data.id || `p-${Date.now()}`;
  const product = {
    status: 'draft', featured: false, bestseller: false, newArrival: false,
    colors: [], sizes: [], images: [], inventory: {}, badges: [],
    ...data,
    id,
    sku: data.sku || `NV-${id.toUpperCase()}`,
  };
  store = [product, ...store];
  persist();
  return product;
}

export function updateProduct(id, patch) {
  store = store.map((p) => (p.id === id ? { ...p, ...patch } : p));
  persist();
  return getProductById(id);
}

export function deleteProduct(id) {
  store = store.filter((p) => p.id !== id);
  persist();
  return true;
}

export function replaceAll(list) {
  store = list;
  persist();
}

/** Called with the full product list every time it changes. */
export function onProductsChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetToSeedCatalog() {
  store = seed();
  persist();
  return store;
}
