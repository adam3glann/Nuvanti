// authService — MOCK ONLY. Stores a fake session in localStorage so the
// account UI has something to render. Real auth (tokens, password hashing,
// sessions) belongs entirely on the Node backend — this file is deleted or
// rewritten to call it, never extended in place.
const STORAGE_KEY = 'nuvanti_session_v1';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function mockLogin(email) {
  const session = { email, name: email.split('@')[0], loggedInAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function mockRegister(name, email) {
  const session = { email, name, loggedInAt: Date.now() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function isLoggedIn() {
  return !!getSession();
}
