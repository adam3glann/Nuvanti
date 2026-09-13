import { icon } from './icons.js';

let region;
function ensureRegion() {
  if (!region) {
    region = document.createElement('div');
    region.className = 'a-toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  return region;
}

const ICONS = { success: 'checkCircle', error: 'alertTriangle', warning: 'alertTriangle', info: 'bell' };

export function showAdminToast(message, variant = 'info') {
  const el = document.createElement('div');
  el.className = 'a-toast';
  el.dataset.variant = variant;
  el.innerHTML = `${icon(ICONS[variant] || 'bell')}<span>${message}</span>`;
  ensureRegion().appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 200ms ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 220);
  }, 3200);
}
