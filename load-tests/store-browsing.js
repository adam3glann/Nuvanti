// Staging storefront load test. Point BASE_URL at a staging Pages URL whose
// /api proxy targets a staging Railway API and staging database. This models
// storefront entry, catalog browsing, and visitor presence. It does not place
// orders, initiate payments, or exercise sign-in.
import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/+$/, '');
if (!baseUrl) throw new Error('Set BASE_URL to your staging storefront URL.');
const apiBaseUrl = (__ENV.API_BASE_URL || baseUrl).replace(/\/+$/, '');
const includePresenceWrites = __ENV.INCLUDE_PRESENCE_WRITES !== 'false';
// Use the synthetic forwarding IPs only for a local server configured with
// TRUST_PROXY=1; never send them to a public environment.
const apiRequestOptions = {
  headers: {
    ...(__ENV.API_BASE_URL ? { Origin: baseUrl } : {}),
    ...(__ENV.SIMULATE_CLIENT_IPS === 'true'
      ? { 'X-Forwarded-For': `198.51.100.${__VU}` }
      : {}),
  },
};

export const options = {
  scenarios: {
    browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '5m', target: 200 },
        { duration: '1m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const visitorId = `00000000-0000-4000-8000-${String(__VU).padStart(12, '0')}`;
  const tabId = `00000000-0001-4000-8000-${String(__VU).padStart(12, '0')}`;

  if (__ITER === 0) {
    const home = http.get(`${baseUrl}/`);
    check(home, { 'storefront loads': (response) => response.status === 200 });

    if (includePresenceWrites) {
      const pageView = http.post(`${apiBaseUrl}/api/storefront/page-view`, null, apiRequestOptions);
      check(pageView, { 'page view is recorded': (response) => response.status === 204 });
    }
  }

  const response = http.get(`${apiBaseUrl}/api/products?limit=100`, apiRequestOptions);
  check(response, { 'product list loads': (result) => result.status === 200 });

  if (response.status === 200) {
    const products = response.json();
    if (Array.isArray(products) && products.length) {
      const product = products[Math.floor(Math.random() * products.length)];
      http.get(`${apiBaseUrl}/api/products/${encodeURIComponent(product.slug)}`, apiRequestOptions);
    }
  }

  if (includePresenceWrites) {
    const presence = http.post(
      `${apiBaseUrl}/api/storefront/presence`,
      JSON.stringify({ action: 'heartbeat', visitorId, tabId }),
      { ...apiRequestOptions, headers: { ...apiRequestOptions.headers, 'Content-Type': 'application/json' } },
    );
    check(presence, { 'visitor presence is recorded': (result) => result.status === 204 });
  }

  // Think time approximates shoppers browsing instead of hammering the API.
  sleep(5 + Math.random() * 5);
}
