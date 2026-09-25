import { API_ORIGIN } from '../config.js';

async function request(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}/api/auth${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Security settings request failed.');
  return body;
}

export const getMfaStatus = () => request('/mfa/status');
export const beginMfaSetup = (currentPassword) => request('/mfa/setup', { method: 'POST', body: JSON.stringify({ currentPassword }) });
export const enableMfa = (code) => request('/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) });
export const disableMfa = (currentPassword, code) => request('/mfa/disable', { method: 'POST', body: JSON.stringify({ currentPassword, code }) });
export const getActiveSessions = () => request('/sessions');
export const revokeSession = (id) => request(`/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const revokeOtherSessions = () => request('/sessions/revoke-others', { method: 'POST', body: '{}' });
