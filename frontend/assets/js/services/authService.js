// A short-lived UI mirror only. The HTTP-only API cookie remains the authority.
import { API_ORIGIN as API } from '../config.js';
const STORAGE_KEY = 'nuvanti_customer_display_session';
export function getSession() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function store(user) { const session = { email: user.email, name: user.name, role: user.role }; localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); return session; }
async function request(path, payload) { const response = await fetch(`${API}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Unable to complete this request.'); return body; }
export async function login(email, password) { return store((await request('/api/auth/login', { email, password })).user); }
export async function register(name, email, password) { return store((await request('/api/auth/register', { name, email, password })).user); }
export async function logout() { localStorage.removeItem(STORAGE_KEY); await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {}); }
export async function requestPasswordReset(email) { return request('/api/auth/password-reset/request', { email }); }
export async function confirmPasswordReset(token, password) { return request('/api/auth/password-reset/confirm', { token, password }); }
export async function confirmEmailVerification(token) { return request('/api/auth/verify-email/confirm', { token }); }
export function isLoggedIn() { return !!getSession(); }
export async function getCurrentUser() {
  const response = await fetch(`${API}/api/auth/me`, { credentials: 'include' });
  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to verify your account.');
  store(body.user);
  return body.user;
}
export async function updateProfile(name) {
  const response = await fetch(`${API}/api/auth/me`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to save your profile.');
  return store(body.user);
}
