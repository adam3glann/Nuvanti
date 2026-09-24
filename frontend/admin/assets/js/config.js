// The protected staff portal and API share admin.<domain>; the public shop is
// hosted separately at the root domain.
const configuredApi = window.NUVANTI_API_URL
  || document.querySelector('meta[name="nuvanti-api-url"]')?.content;

function defaultApiOrigin() {
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
    return 'http://localhost:4000';
  }
  return 'https://admin.nuvanti.com';
}

export const API_ORIGIN = (configuredApi || defaultApiOrigin()).replace(/\/$/, '');
