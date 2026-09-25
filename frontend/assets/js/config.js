// Same-origin API calls keep the authentication cookie first-party on mobile.
const LOCAL_DEVELOPMENT = location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(location.hostname);
const configuredLocalApi = window.NUVANTI_API_URL
  || document.querySelector('meta[name="nuvanti-api-url"]')?.content;

export const API_ORIGIN = (LOCAL_DEVELOPMENT
  ? (configuredLocalApi || 'http://localhost:4000')
  : location.origin).replace(/\/$/, '');
export { LOCAL_DEVELOPMENT };
