// productService — currently reads from local mock data.
// Later: replace bodies with `fetch('/api/products...')` calls.
// Every function stays async so call sites never need to change.
import { products, getProductBySlug as _bySlug } from '../data/products.js';
import { categories as categoryList } from '../data/categories.js';

export async function fetchProducts(filters = {}) {
  await tick();
  let list = [...products];

  if (filters.category) list = list.filter((p) => p.category === filters.category);
  if (filters.collection) list = list.filter((p) => p.collection === filters.collection);
  if (filters.colors?.length) list = list.filter((p) => p.colors.some((c) => filters.colors.includes(c)));
  if (filters.sizes?.length) list = list.filter((p) => p.sizes.some((s) => filters.sizes.includes(s)));
  if (filters.minPrice != null) list = list.filter((p) => p.price >= filters.minPrice);
  if (filters.maxPrice != null) list = list.filter((p) => p.price <= filters.maxPrice);
  if (filters.availability === 'in-stock') {
    list = list.filter((p) => Object.values(p.inventory).some((n) => n > 0));
  }
  if (filters.badge === 'new') list = list.filter((p) => p.newArrival);
  if (filters.badge === 'bestseller') list = list.filter((p) => p.bestseller);
  if (filters.query) {
    const q = filters.query.toLowerCase();
    list = list.filter((p) => p.name.toLowerCase().includes(q) || p.category.includes(q));
  }

  switch (filters.sort) {
    case 'price-asc': list.sort((a, b) => a.price - b.price); break;
    case 'price-desc': list.sort((a, b) => b.price - a.price); break;
    case 'name-asc': list.sort((a, b) => a.name.localeCompare(b.name)); break;
    case 'newest': list.sort((a, b) => Number(b.newArrival) - Number(a.newArrival)); break;
    default: break;
  }

  return list;
}

export async function fetchProductBySlug(slug) {
  await tick();
  return _bySlug(slug) || null;
}

export async function fetchFeatured() {
  await tick();
  return products.filter((p) => p.featured);
}

export async function fetchBestsellers() {
  await tick();
  return products.filter((p) => p.bestseller);
}

export async function fetchNewArrivals() {
  await tick();
  return products.filter((p) => p.newArrival);
}

export async function fetchRelated(product, count = 4) {
  await tick();
  return products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, count);
}

export async function fetchCategories() {
  await tick();
  return categoryList;
}

export async function searchProducts(query) {
  await tick();
  if (!query) return [];
  const q = query.toLowerCase();
  return products.filter((p) => p.name.toLowerCase().includes(q) || p.category.includes(q)).slice(0, 8);
}

function tick(ms = 120) {
  return new Promise((res) => setTimeout(res, ms));
}
