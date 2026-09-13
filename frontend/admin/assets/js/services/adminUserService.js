import { adminUsers as sourceUsers } from '../data/adminUsers.js';

let userStore = [...sourceUsers];
function tick(ms = 130) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchAdminUsers() { await tick(); return [...userStore]; }
export async function createAdminUser(data) {
  await tick();
  const u = { id: `au-${Date.now()}`, status: 'active', lastLogin: null, createdAt: new Date().toISOString(), ...data };
  userStore = [...userStore, u];
  return u;
}
export async function updateAdminUser(id, patch) {
  await tick();
  userStore = userStore.map((u) => (u.id === id ? { ...u, ...patch } : u));
  return userStore.find((u) => u.id === id);
}
export async function toggleAdminUserStatus(id) {
  await tick();
  userStore = userStore.map((u) => (u.id === id ? { ...u, status: u.status === 'active' ? 'disabled' : 'active' } : u));
  return userStore.find((u) => u.id === id);
}
export async function deleteAdminUser(id) {
  await tick();
  userStore = userStore.filter((u) => u.id !== id);
  return userStore;
}
