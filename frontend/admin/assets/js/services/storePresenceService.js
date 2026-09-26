import { API_ORIGIN } from '../config.js';

const refreshIntervalMs = 15 * 1000;

export function watchStorePresence() {
  const badge = document.getElementById('storePresence');
  const label = document.getElementById('storePresenceCount');
  if (!badge || !label) return;

  let inFlight = false;
  const refresh = async () => {
    if (document.visibilityState !== 'visible' || inFlight) return;
    inFlight = true;
    try {
      const response = await fetch(`${API_ORIGIN}/api/admin/store-presence`, {
        credentials: 'include', cache: 'no-store', headers: { Accept: 'application/json' },
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !Number.isSafeInteger(body.activeVisitors)) throw new Error('Presence unavailable');
      label.textContent = `${body.activeVisitors} online`;
      badge.dataset.state = 'online';
      badge.title = `Active storefront sessions · refreshed ${new Date().toLocaleTimeString()}`;
    } catch {
      label.textContent = 'Online unavailable';
      badge.dataset.state = 'unavailable';
      badge.title = 'Could not refresh the live storefront count. It will retry automatically.';
    } finally {
      inFlight = false;
    }
  };

  refresh();
  const timer = window.setInterval(refresh, refreshIntervalMs);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('focus', refresh);
  return () => window.clearInterval(timer);
}
