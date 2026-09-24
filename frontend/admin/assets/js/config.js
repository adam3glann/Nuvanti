// The admin is hosted on admin.<domain>; its API is api.<domain> by default.
// Set window.NUVANTI_API_URL before the page module for a different domain.
const configuredApi = window.NUVANTI_API_URL
  || document.querySelector('meta[name="nuvanti-api-url"]')?.content;

function defaultApiOrigin() {
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
    // Route local admin requests through the admin origin to avoid browser
    // restrictions on cross-port API calls.
    return '';
  }
  const labels = location.hostname.split('.');
  if (labels.length < 2) return `${location.protocol}//${location.hostname}:4000`;
  if (['www', 'shop', 'admin', 'store', 'api'].includes(labels[0])) labels.shift();
  return `${location.protocol}//api.${labels.join('.')}`;
}

export const API_ORIGIN = (configuredApi || defaultApiOrigin()).replace(/\/$/, '');
