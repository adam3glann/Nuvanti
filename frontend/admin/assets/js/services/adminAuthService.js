// adminAuthService — MOCK ONLY, frontend demonstration.
// A real backend must independently perform authentication, session
// issuance, and authorization on every request. Nothing here is a
// security boundary; localStorage is trivially editable by the user.
const STORAGE_KEY = 'nuvanti_admin_session_v1';

// Development/demo accounts only — never real credentials.
export const DEMO_ACCOUNTS = [
  { email: 'superadmin@nuvanti.test', password: 'demo1234', role: 'super_admin', name: 'Laila Farouk' },
  { email: 'admin@nuvanti.test', password: 'demo1234', role: 'admin', name: 'Omar Sabry' },
  { email: 'manager@nuvanti.test', password: 'demo1234', role: 'manager', name: 'Yara Khaled' },
  { email: 'staff@nuvanti.test', password: 'demo1234', role: 'staff', name: 'Karim Adel' },
];

export function getAdminSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

// Simulates a network round trip + credential check. Always resolves,
// never throws — callers check `.ok`.
export function mockAdminLogin(email, password, rememberDevice) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const account = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
      if (!account || account.password !== password) {
        resolve({ ok: false, error: 'Invalid email or password.' });
        return;
      }
      const session = {
        email: account.email, name: account.name, role: account.role,
        loginAt: Date.now(), rememberDevice: !!rememberDevice,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      resolve({ ok: true, session });
    }, 700);
  });
}

export function adminLogout() {
  localStorage.removeItem(STORAGE_KEY);
}

// Call at the top of every protected admin page.
export function requireAdminAuth() {
  const session = getAdminSession();
  if (!session) {
    const next = encodeURIComponent(location.pathname.split('/').pop());
    location.href = `login.html?next=${next}`;
    return null;
  }
  return session;
}
