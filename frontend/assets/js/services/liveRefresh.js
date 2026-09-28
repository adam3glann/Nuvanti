// Poll only while the page is visible and online; avoid overlapping requests.
export function startLiveRefresh(callback, intervalMs = 10000, { pauseWhileEditing = false } = {}) {
  let timer = null;
  let running = false;

  const editing = () => {
    if (!pauseWhileEditing) return false;
    const active = document.activeElement;
    return Boolean(active?.matches?.('input, textarea, select, [contenteditable="true"]'));
  };
  const schedule = () => {
    clearTimeout(timer);
    if (document.hidden || !navigator.onLine) return;
    timer = setTimeout(async () => {
      if (!running && !editing()) {
        running = true;
        try { await callback(); } catch (error) { console.warn('Automatic store refresh failed:', error); }
        finally { running = false; }
      }
      schedule();
    }, intervalMs);
  };

  const refreshNow = () => {
    clearTimeout(timer);
    if (document.hidden || !navigator.onLine) return;
    if (running || editing()) return schedule();
    running = true;
    Promise.resolve().then(callback)
      .catch((error) => console.warn('Automatic store refresh failed:', error))
      .finally(() => { running = false; schedule(); });
  };
  const handleVisibility = () => {
    if (document.hidden) clearTimeout(timer);
    else refreshNow();
  };
  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', refreshNow);
  window.addEventListener('online', refreshNow);
  schedule();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', refreshNow);
    window.removeEventListener('online', refreshNow);
  };
}
