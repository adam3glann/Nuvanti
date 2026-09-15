// Storefront catalog: PostgreSQL API is the source of truth. The local seed
// remains only as an offline-development fallback.
import { getPublishedProducts, getProductBySlug as localBySlug } from '../data/productStore.js';
import { categories as localCategories } from '../data/categories.js';
const API = window.NUVANTI_API_URL || `${location.protocol}//${location.hostname}:4000`;
async function api(path) { const response = await fetch(`${API}${path}`); if (!response.ok) throw new Error('Catalog service unavailable'); return response.json(); }
function filter(list, filters) { let out = [...list]; if (filters.colors?.length) out = out.filter((p) => p.colors.some((c) => filters.colors.includes(c))); if (filters.sizes?.length) out = out.filter((p) => p.sizes.some((s) => filters.sizes.includes(s))); if (filters.minPrice != null) out = out.filter((p) => p.price >= filters.minPrice); if (filters.maxPrice != null) out = out.filter((p) => p.price <= filters.maxPrice); if (filters.availability === 'in-stock') out = out.filter((p) => Object.values(p.inventory).some((n) => n > 0)); if (filters.badge === 'new') out = out.filter((p) => p.newArrival); if (filters.badge === 'bestseller') out = out.filter((p) => p.bestseller); return out; }
export async function fetchProducts(filters = {}) { try { const q = new URLSearchParams(); if (filters.category) q.set('category', filters.category); if (filters.collection) q.set('collection', filters.collection); if (filters.query) q.set('search', filters.query); const list = filter(await api(`/api/products?${q}`), filters); const sorts = { 'price-asc': (a,b) => a.price-b.price, 'price-desc': (a,b) => b.price-a.price, 'name-asc': (a,b) => a.name.localeCompare(b.name), newest: (a,b) => Number(b.newArrival)-Number(a.newArrival) }; return sorts[filters.sort] ? list.sort(sorts[filters.sort]) : list; } catch { return filter(getPublishedProducts(), filters); } }
export async function fetchProductBySlug(slug) { try { return await api(`/api/products/${encodeURIComponent(slug)}`); } catch { return localBySlug(slug) || null; } }
export async function fetchFeatured() { return (await fetchProducts()).filter((p) => p.featured); }
export async function fetchBestsellers() { return (await fetchProducts()).filter((p) => p.bestseller); }
export async function fetchNewArrivals() { return (await fetchProducts()).filter((p) => p.newArrival); }
export async function fetchRelated(product, count = 4) { return (await fetchProducts({ category: product.category })).filter((p) => p.id !== product.id).slice(0, count); }
export async function fetchCategories() { try { return await api('/api/categories'); } catch { return localCategories; } }
export async function searchProducts(query) { return query ? (await fetchProducts({ query })).slice(0, 8) : []; }
