import { API_ORIGIN } from '../config.js';

async function maintenanceRequest(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}/api/admin/maintenance/${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'The store maintenance request failed.');
  return body;
}

export async function downloadStoreBackup() {
  const response = await fetch(`${API_ORIGIN}/api/admin/maintenance/backup`, {
    credentials: 'include',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Unable to download the store backup.');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `nuvanti-store-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function resetStoreData() {
  return maintenanceRequest('reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation: 'RESET STORE DATA' }),
  });
}

export function activateEmergencyLockdown() {
  return maintenanceRequest('emergency', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmation: 'LOCK DOWN STORE' }),
  });
}

export async function restoreStoreBackup(file) {
  const form = new FormData();
  form.set('backupFile', file);
  form.set('confirmation', 'RESTORE STORE BACKUP');
  return maintenanceRequest('restore', { method: 'POST', body: form });
}
