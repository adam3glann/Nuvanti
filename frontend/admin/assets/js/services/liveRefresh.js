// Keep admin data current without reloading the page. Pause editable forms so
// a background refresh cannot replace a form while the administrator is typing.
export function startLiveRefresh(callback, intervalMs = 8000, { pauseWhileEditing = false } = {}) {
  let timer = null;
  let running = false;
  const editing = () => {
    if (!pauseWhileEditing) return false;
    if (document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return true;
    return [...document.querySelectorAll('input, textarea, select')].some((field) =>
      field.type === 'checkbox' || field.type === 'radio'
        ? field.checked !== field.defaultChecked
        : field.value !== field.defaultValue,
    );
  };
  const schedule = () => {
    clearTimeout(timer);
    if (document.hidden || !navigator.onLine) return;
    timer = setTimeout(async () => {
      if (!running && !editing()) {
        running = true;
        try { await callback(); } catch (error) { console.warn('Automatic admin refresh failed:', error); }
        finally { running = false; }
      }
      schedule();
    }, intervalMs);
  };
  document.addEventListener('visibilitychange', schedule);
  window.addEventListener('online', schedule);
  schedule();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', schedule);
    window.removeEventListener('online', schedule);
  };
}
