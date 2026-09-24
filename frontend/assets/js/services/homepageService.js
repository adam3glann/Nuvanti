import { API_ORIGIN } from '../config.js';

export async function fetchHomepageSlides() {
  const response = await fetch(`${API_ORIGIN}/api/storefront/homepage-slides`);
  const body = await response.json().catch(() => []);
  if (!response.ok) throw new Error(body.error || 'Could not load the home page slideshow.');
  return body;
}
