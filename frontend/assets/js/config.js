// Public runtime settings. For domains that do not share a registrable
// domain, set window.NUVANTI_API_URL before the page module loads.
const configuredApi = window.NUVANTI_API_URL
  || document.querySelector('meta[name="nuvanti-api-url"]')?.content;

function defaultApiOrigin() {
  if (location.protocol === 'file:' || ['localhost', '127.0.0.1'].includes(location.hostname)) {
    return 'http://localhost:4000';
  }
  // Cloudflare Pages preview hostnames are not under nuvanti.com. Keep preview
  // and production storefronts pointed at the same API until an explicit URL
  // is provided through NUVANTI_API_URL or the API meta tag.
  if (location.hostname.endsWith('.pages.dev')) return 'https://api.nuvanti.com';
  const labels = location.hostname.split('.');
  if (labels.length < 2) return `${location.protocol}//${location.hostname}:4000`;
  if (['www', 'shop', 'admin', 'store', 'api'].includes(labels[0])) labels.shift();
  return `${location.protocol}//api.${labels.join('.')}`;
}

export const API_ORIGIN = (configuredApi || defaultApiOrigin()).replace(/\/$/, '');
export const LOCAL_DEVELOPMENT = location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(location.hostname);
