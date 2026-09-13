import { adminCategories, adminCollections } from '../data/categories.js';

let categoryStore = [...adminCategories];
let collectionStore = [...adminCollections];
function tick(ms = 120) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchCategories() { await tick(); return [...categoryStore]; }
export async function toggleCategoryStatus(id) {
  await tick();
  categoryStore = categoryStore.map((c) => (c.id === id ? { ...c, status: c.status === 'active' ? 'disabled' : 'active' } : c));
  return categoryStore;
}
export async function deleteCategory(id) {
  await tick();
  categoryStore = categoryStore.filter((c) => c.id !== id);
  return categoryStore;
}
export async function createCategory(data) {
  await tick();
  const cat = { id: `c-${Date.now()}`, status: 'active', productCount: 0, order: categoryStore.length + 1, ...data };
  categoryStore = [...categoryStore, cat];
  return cat;
}

export async function fetchCollections() { await tick(); return [...collectionStore]; }
export async function toggleCollectionStatus(id) {
  await tick();
  collectionStore = collectionStore.map((c) => (c.id === id ? { ...c, status: c.status === 'published' ? 'draft' : 'published' } : c));
  return collectionStore;
}
export async function deleteCollection(id) {
  await tick();
  collectionStore = collectionStore.filter((c) => c.id !== id);
  return collectionStore;
}
export async function createCollection(data) {
  await tick();
  const col = { id: `col-${Date.now()}`, status: 'draft', productCount: 0, ...data };
  collectionStore = [...collectionStore, col];
  return col;
}
