import { API_ORIGIN } from '../config.js';

async function post(path, body) {
  const response = await fetch(API_ORIGIN + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const result = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Please try again later.');
  return result;
}

export const subscribeToNewsletter = (email) => post('/api/newsletter', { email });
export const unsubscribeFromNewsletter = (token) => post('/api/newsletter/unsubscribe', { token });
