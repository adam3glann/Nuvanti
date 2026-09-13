import { auditLogs } from '../data/auditLogs.js';

function tick(ms = 130) { return new Promise((r) => setTimeout(r, ms)); }

export async function fetchAuditLogs({ query, user, action, page = 1, perPage = 15 } = {}) {
  await tick();
  let list = [...auditLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((l) => l.action.toLowerCase().includes(q) || l.resource.toLowerCase().includes(q) || l.user.toLowerCase().includes(q));
  }
  if (user) list = list.filter((l) => l.user === user);
  const total = list.length;
  const start = (page - 1) * perPage;
  return { items: list.slice(start, start + perPage), total, page, perPage };
}

export function uniqueUsers() {
  return [...new Set(auditLogs.map((l) => l.user))];
}
