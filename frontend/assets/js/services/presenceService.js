import { API_ORIGIN } from '../config.js';

const visitorStorageKey = 'nuvanti_store_presence_v1';
const visitorIdleMs = 30 * 60 * 1000;
const heartbeatMs = 10 * 1000;
const endpoint = `${API_ORIGIN}/api/storefront/presence`;
const pageViewEndpoint = `${API_ORIGIN}/api/storefront/page-view`;

export function startStorePresence() {
  const visitorId = getVisitorId();
  const tabId = createUuid();
  let present = false;

  // Count one page load. This endpoint stores only an aggregate total, without
  // recording a URL, account, IP address, or visitor identifier.
  fetch(pageViewEndpoint, { method: 'POST', cache: 'no-store', keepalive: true }).catch(() => {});

  const post = (action, keepalive = false) => {
    touchVisitor(visitorId);
    fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, visitorId, tabId }),
      keepalive,
    }).catch(() => {});
  };

  const heartbeat = () => {
    present = true;
    post('heartbeat');
  };

  const leave = () => {
    if (!present) return;
    present = false;
    const query = new URLSearchParams({ action: 'leave', visitorId, tabId });
    if (navigator.sendBeacon?.(`${endpoint}?${query}`, new Blob([], { type: 'text/plain' }))) return;
    post('leave', true);
  };

  heartbeat();
  const timer = window.setInterval(heartbeat, heartbeatMs);
  // Keep active background tabs counted. A close event removes the tab
  // immediately; a 12-second server expiry handles crashes and skipped pagehide.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') heartbeat();
  });
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', heartbeat);
  return () => {
    window.clearInterval(timer);
    leave();
  };
}

function getVisitorId() {
  try {
    const saved = JSON.parse(localStorage.getItem(visitorStorageKey) || 'null');
    if (saved?.id && Date.now() - Number(saved.lastSeenAt) < visitorIdleMs) return saved.id;
  } catch {}
  return createUuid();
}

function touchVisitor(id) {
  try { localStorage.setItem(visitorStorageKey, JSON.stringify({ id, lastSeenAt: Date.now() })); }
  catch {}
}

function createUuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
