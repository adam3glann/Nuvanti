import { notifications as source } from '../data/auditLogs.js';

let store = [...source];

export function getNotifications() {
  return [...store].sort((a, b) => new Date(b.time) - new Date(a.time));
}
export function unreadCount() {
  return store.filter((n) => n.unread).length;
}
export function markAllRead() {
  store = store.map((n) => ({ ...n, unread: false }));
  return store;
}
export function markRead(id) {
  store = store.map((n) => (n.id === id ? { ...n, unread: false } : n));
  return store;
}
