import { API_ORIGIN } from '../config.js';
import { uploadAdminImage } from './imageUploadService.js';

async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Homepage slide request failed.');
  return body;
}

export const fetchHomepageSlides = () => request('/api/admin/homepage-slides');
export const createHomepageSlide = (slide) => request('/api/admin/homepage-slides', { method: 'POST', body: JSON.stringify(slide) });
export const updateHomepageSlide = (id, slide) => request(`/api/admin/homepage-slides/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(slide) });
export const applyHomepageTextColor = (textColor) => request('/api/admin/homepage-slides/text-color', { method: 'PATCH', body: JSON.stringify({ textColor }) });
export const deleteHomepageSlide = (id) => request(`/api/admin/homepage-slides/${encodeURIComponent(id)}`, { method: 'DELETE' });

export async function uploadHomepageSlideImage(file, options = {}) {
  return uploadAdminImage(file, { endpoint: '/api/admin/uploads/product-image', ...options });
}
