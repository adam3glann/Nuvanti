import { API_ORIGIN as API } from '../config.js';

// The server-side admin gateway is the security boundary. localStorage only
// mirrors the safe display name/role for this UI; editing it grants nothing.
// This file is served publicly (pre-login), so it deliberately does not
// import other admin modules — keep this role list in sync with
// components/permissions.js (ROLES) and backend/lib/permissions.js.
const STAFF_TIER_ROLES = ['super_admin', 'admin', 'manager', 'staff'];
const STORAGE_KEY = 'nuvanti_admin_display_session';

export function getAdminSession() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
export async function refreshAdminSession() {
  const response = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
  if (response.status === 401) { localStorage.removeItem(STORAGE_KEY); return null; }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to verify your session.');
  if (!STAFF_TIER_ROLES.includes(body.user?.role)) { localStorage.removeItem(STORAGE_KEY); return null; }
  const session = { email: body.user.email, name: body.user.name, role: body.user.role };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}
export async function loginAdmin(email, password) {
  try {
    const response = await fetch(`${API}/api/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const body = await response.json();
    if (!response.ok) return { ok: false, error: body.error || 'Unable to sign in.' };
    if (!STAFF_TIER_ROLES.includes(body.user.role)) { await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }); return { ok: false, error: 'This account is not authorized for the admin area.' }; }
    const session = { email: body.user.email, name: body.user.name, role: body.user.role };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
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
export async function changeAdminPassword(currentPassword, newPassword) {
  const response = await fetch(`${API}/api/auth/change-password`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword, newPassword }) });
  const body = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to change your password.');
}
export async function adminLogout() { localStorage.removeItem(STORAGE_KEY); await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {}); location.href = 'login.html'; }
export function requireAdminAuth() {
  const session = getAdminSession();
  if (!session) { location.href = 'login.html'; return null; }
  return session;
}
// Demo credentials were intentionally removed. Create an admin through seed:admin.
export const DEMO_ACCOUNTS = [];
