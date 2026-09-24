import { API_ORIGIN } from '../config.js';

async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}/api/admin${path}`, { credentials: 'include', ...options });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Unable to process messages.');
  return body;
}
export const fetchMessages = () => request('/messages');
export const setMessageRead = (id, isRead) => request(`/messages/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isRead }) });
