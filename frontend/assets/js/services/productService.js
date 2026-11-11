// Storefront catalog: PostgreSQL API is the source of truth. The local seed
// remains only as an offline-development fallback.
import {
  getPublishedProducts,
  getProductBySlug as localBySlug,
} from "../data/productStore.js";
import { categories as localCategories } from "../data/categories.js";
import { API_ORIGIN as API, LOCAL_DEVELOPMENT } from "../config.js";
const catalogCache = new Map();
const CATALOG_TTL_MS = 15000;
const MAX_CATALOG_CACHE_ENTRIES = 32;

function cachedCatalog(key, fetcher) {
  const now = Date.now();
  const cached = catalogCache.get(key);
  if (cached && (cached.promise || cached.expiresAt > now))
    return cached.promise || Promise.resolve(cached.value);

  const entry = { promise: null, value: null, expiresAt: 0 };
  entry.promise = fetcher()
    .then((value) => {
      entry.value = value;
      entry.expiresAt = Date.now() + CATALOG_TTL_MS;
      entry.promise = null;
      return value;
    })
    .catch((error) => {
      if (catalogCache.get(key) === entry) catalogCache.delete(key);
      throw error;
    });
  catalogCache.set(key, entry);
  while (catalogCache.size > MAX_CATALOG_CACHE_ENTRIES)
    catalogCache.delete(catalogCache.keys().next().value);
  return entry.promise;
}

export function clearProductCache() {
  catalogCache.clear();
}

async function api(path) {
  const response = await fetch(`${API}${path}`, { cache: "no-store" });
  if (!response.ok) {
    const error = new Error("Catalog service unavailable");
    error.status = response.status;
    throw error;
  }
  return response.json();
}
function filter(list, filters) {
  let out = [...list];
  if (filters.colors?.length)
    out = out.filter((p) => p.colors.some((c) => filters.colors.includes(c)));
  if (filters.sizes?.length)
    out = out.filter((p) => p.sizes.some((s) => filters.sizes.includes(s)));
  if (filters.minPrice != null)
    out = out.filter((p) => p.price >= filters.minPrice);
  if (filters.maxPrice != null)
    out = out.filter((p) => p.price <= filters.maxPrice);
  if (filters.availability === "in-stock")
    out = out.filter((p) => Object.values(p.inventory).some((n) => n > 0));
  if (filters.badge === "new") out = out.filter((p) => p.newArrival);
  if (filters.badge === "bestseller") out = out.filter((p) => p.bestseller);
  return out;
}
export async function fetchProducts(filters = {}) {
  const cacheKey = `list:${JSON.stringify({ category: filters.category || "", collection: filters.collection || "", query: filters.query || "", colors: filters.colors || [], sizes: filters.sizes || [], minPrice: filters.minPrice ?? null, maxPrice: filters.maxPrice ?? null, availability: filters.availability || "", badge: filters.badge || "", sort: filters.sort || "" })}`;
  return cachedCatalog(cacheKey, async () => {
    try {
      const pageSize = 100;
      const list = [];
      let offset = 0;
      let page;
      do {
        const q = new URLSearchParams({
          limit: String(pageSize),
          offset: String(offset),
        });
        if (filters.category) q.set("category", filters.category);
        if (filters.collection) q.set("collection", filters.collection);
        if (filters.query) q.set("search", filters.query);
        page = await api(`/api/products?${q}`);
        if (!Array.isArray(page))
          throw new Error("Catalog response was invalid.");
        list.push(...page);
        offset += page.length;
      } while (page.length === pageSize);
      const filtered = filter(list, filters);
      const sorts = {
        "price-asc": (a, b) => a.price - b.price,
        "price-desc": (a, b) => b.price - a.price,
        "name-asc": (a, b) => a.name.localeCompare(b.name),
        newest: (a, b) => Number(b.newArrival) - Number(a.newArrival),
      };
      return sorts[filters.sort]
        ? filtered.sort(sorts[filters.sort])
        : filtered;
    } catch (error) {
      if (!LOCAL_DEVELOPMENT) throw error;
      return filter(getPublishedProducts(), filters);
    }
  });
}
export async function fetchProductBySlug(slug) {
  return cachedCatalog(`product:${String(slug)}`, async () => {
    try {
      return await api(`/api/products/${encodeURIComponent(slug)}`);
    } catch (error) {
      if (error.status === 404) return null;
      if (!LOCAL_DEVELOPMENT) throw error;
      return localBySlug(slug) || null;
    }
  });
}
export async function fetchFeatured() {
  return (await fetchProducts()).filter((p) => p.featured);
}
export async function fetchBestsellers() {
  return (await fetchProducts()).filter((p) => p.bestseller);
}
export async function fetchNewArrivals() {
  return (await fetchProducts()).filter((p) => p.newArrival);
}
export async function fetchRelated(product, count = 4) {
  return (await fetchProducts({ category: product.category }))
    .filter((p) => p.id !== product.id)
    .slice(0, count);
}
export async function fetchCategories() {
  return cachedCatalog("categories", async () => {
    try {
      const remote = await api("/api/categories");
      return remote.map((category) => ({
        ...category,
        image:
          category.imageUrl ||
          localCategories.find((local) => local.slug === category.slug)
            ?.image ||
          "",
      }));
    } catch (error) {
      if (!LOCAL_DEVELOPMENT) throw error;
      return localCategories;
    }
  });
}
export async function fetchMenuLinks() {
  return api("/api/navigation");
}
export async function searchProducts(query) {
  return query ? (await fetchProducts({ query })).slice(0, 8) : [];
}
