// The server-side admin gateway is the security boundary. sessionStorage only
// mirrors the safe display name/role for this UI; editing it grants nothing.
const API = window.NUVANTI_API_URL || (location.protocol === 'file:' ? 'http://localhost:4000' : `${location.protocol}//${location.hostname}:4000`);
const STORAGE_KEY = 'nuvanti_admin_display_session';

export function getAdminSession() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; } }
export async function mockAdminLogin(email, password) {
  try {
    const response = await fetch(`${API}/api/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const body = await response.json();
    if (!response.ok) return { ok: false, error: body.error || 'Unable to sign in.' };
    if (!['admin', 'super_admin'].includes(body.user.role)) { await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }); return { ok: false, error: 'This account is not authorized for the admin area.' }; }
    const session = { email: body.user.email, name: body.user.name, role: body.user.role };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return { ok: true, session };
  } catch { return { ok: false, error: 'Cannot reach the secure backend.' }; }
}
export async function requestAdminPasswordReset(email) {
  const response = await fetch(`${API}/api/auth/password-reset/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to request a password reset.');
  return body.message;
}
export async function confirmAdminPasswordReset(token, password) {
  const response = await fetch(`${API}/api/auth/password-reset/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to reset your password.');
}
export async function adminLogout() { sessionStorage.removeItem(STORAGE_KEY); await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {}); location.href = 'login.html'; }
export function requireAdminAuth() {
  const session = getAdminSession();
  if (!session) { location.href = 'login.html'; return null; }
  return session;
}
// Demo credentials were intentionally removed. Create an admin through seed:admin.
export const DEMO_ACCOUNTS = [];
