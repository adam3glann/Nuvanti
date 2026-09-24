// Public runtime settings. For domains that do not share a registrable
// domain, set window.NUVANTI_API_URL before the page module loads.
const configuredApi = window.NUVANTI_API_URL
  || document.querySelector('meta[name="nuvanti-api-url"]')?.content;

function defaultApiOrigin() {
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
    return 'http://localhost:4000';
  }
  // The protected admin/API gateway is hosted on Railway, separately from
  // the Cloudflare Pages storefront. Keep this fallback in sync with the
  // current Railway service domain.
  return 'https://nuvanti-production.up.railway.app';
}

export const API_ORIGIN = (configuredApi || defaultApiOrigin()).replace(/\/$/, '');
export const LOCAL_DEVELOPMENT = location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(location.hostname);
