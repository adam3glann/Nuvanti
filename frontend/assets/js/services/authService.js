// A short-lived UI mirror only. The HTTP-only API cookie remains the authority.
const API = window.NUVANTI_API_URL || (location.protocol === 'file:' ? 'http://localhost:4000' : `${location.protocol}//${location.hostname}:4000`);
const STORAGE_KEY = 'nuvanti_customer_display_session';
export function getSession() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)); } catch { return null; } }
function store(user) { const session = { email: user.email, name: user.name, role: user.role }; sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session)); return session; }
async function request(path, payload) { const response = await fetch(`${API}${path}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Unable to complete this request.'); return body; }
export async function mockLogin(email, password) { return store((await request('/api/auth/login', { email, password })).user); }
export async function mockRegister(name, email, password) { return store((await request('/api/auth/register', { name, email, password })).user); }
export async function logout() { sessionStorage.removeItem(STORAGE_KEY); await fetch(`${API}/api/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => {}); }
export function isLoggedIn() { return !!getSession(); }
