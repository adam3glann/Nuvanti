// Public runtime settings. For domains that do not share a registrable
// domain, set window.NUVANTI_API_URL before the page module loads.
const configuredApi = window.NUVANTI_API_URL
  || document.querySelector('meta[name="nuvanti-api-url"]')?.content;

function defaultApiOrigin() {
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
    return 'http://localhost:4000';
  }
  // The protected admin/API gateway has its own domain, separate from the
  // public storefront. Cloudflare Pages previews use that same production API.
  return 'https://admin.nuvanti.com';
}

export const API_ORIGIN = (configuredApi || defaultApiOrigin()).replace(/\/$/, '');
export const LOCAL_DEVELOPMENT = location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(location.hostname);
