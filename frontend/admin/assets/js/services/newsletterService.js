import { API_ORIGIN } from '../config.js';

export async function fetchNewsletterSubscribers() {
  const response = await fetch(API_ORIGIN + '/api/admin/newsletter-subscribers', { credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to load newsletter subscribers.');
  return body;
}
