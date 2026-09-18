const API = window.NUVANTI_API_URL || `${location.protocol}//${location.hostname}:4000`;
async function request(path, options = {}) { const response = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options }); if (response.status === 204) return true; const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Unable to update the catalog.'); return body; }
export const fetchCategories = () => request('/api/admin/categories');
export const toggleCategoryStatus = async (id) => { const category = (await fetchCategories()).find((item) => item.id === String(id)); return request(`/api/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !category?.isActive }) }); };
export const deleteCategory = (id) => request(`/api/admin/categories/${id}`, { method: 'DELETE' });
export const createCategory = (data) => request('/api/admin/categories', { method: 'POST', body: JSON.stringify(data) });
export const fetchCollections = () => request('/api/admin/collections');
export const toggleCollectionStatus = async (id) => { const collection = (await fetchCollections()).find((item) => item.id === String(id)); return request(`/api/admin/collections/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !collection?.isActive }) }); };
export const deleteCollection = (id) => request(`/api/admin/collections/${id}`, { method: 'DELETE' });
export const createCollection = (data) => request('/api/admin/collections', { method: 'POST', body: JSON.stringify(data) });
