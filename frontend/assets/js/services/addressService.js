import { API_ORIGIN } from '../config.js';

async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}/api/addresses${path}`, {
    credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options,
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to save this address.');
  return body;
}

export const fetchAddresses = () => request('');
export const createAddress = (address) => request('', { method: 'POST', body: JSON.stringify(address) });
export const deleteAddress = (id) => request(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
