import { API_ORIGIN } from '../config.js';

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
export const deleteHomepageSlide = (id) => request(`/api/admin/homepage-slides/${encodeURIComponent(id)}`, { method: 'DELETE' });

export async function uploadHomepageSlideImage(file) {
  const form = new FormData();
  form.append('image', file);
  const response = await fetch(`${API_ORIGIN}/api/admin/uploads/product-image`, { method: 'POST', credentials: 'include', body: form });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Image upload failed. Configure Cloudinary or use an existing assets/ image path.');
  return body;
}
