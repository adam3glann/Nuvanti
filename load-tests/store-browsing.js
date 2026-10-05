// Storefront load test. Prefer staging. This models storefront entry, catalog
// browsing, and visitor presence. It does not place orders, initiate payments,
// or exercise sign-in.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const rateLimitedResponses = new Counter('rate_limited_responses');
const serverErrorResponses = new Counter('server_error_responses');

function recordResponse(response) {
  if (response.status === 429) rateLimitedResponses.add(1);
  if (response.status >= 500) serverErrorResponses.add(1);
}

const baseUrl = (__ENV.BASE_URL || '').replace(/\/+$/, '');
if (!baseUrl) throw new Error('Set BASE_URL to your staging storefront URL.');
const apiBaseUrl = (__ENV.API_BASE_URL || baseUrl).replace(/\/+$/, '');
const includePresenceWrites = __ENV.INCLUDE_PRESENCE_WRITES !== 'false';
const presenceOnly = __ENV.PRESENCE_ONLY === 'true';
// Use the synthetic forwarding IPs only for a local server configured with
// TRUST_PROXY=1; never send them to a public environment.
const apiRequestOptions = {
  headers: {
    // k6 is not a browser and does not add Origin automatically. The API
    // requires it on POSTs, so send the storefront origin for every write.
    Origin: baseUrl,
    ...(__ENV.SIMULATE_CLIENT_IPS === 'true'
      ? { 'X-Forwarded-For': `198.51.100.${__VU}` }
      : {}),
  },
};

export const options = {
  // Used by `k6 cloud run`; local `k6 run` keeps the same script runnable
  // without cloud credentials. The Grafana Free plan allows one load zone.
  cloud: {
    name: 'Nuvanti storefront 100-user capacity check',
    distribution: {
      frankfurt: { loadZone: 'amazon:de:frankfurt', percent: 100 },
    },
  },
  scenarios: {
    browsing: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: presenceOnly
        ? [
            // Quick admin counter demo. Each synthetic session sends a small
            // number of heartbeats and fits under the shared-IP write limit.
            { duration: '10s', target: 100 },
            { duration: '20s', target: 100 },
            { duration: '1s', target: 0 },
          ]
        : [
            { duration: '1m', target: 50 },
            { duration: '1m', target: 100 },
            { duration: '2m', target: 100 },
            { duration: '5m', target: 100 },
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
    recordResponse(home);
    check(home, { 'storefront loads': (response) => response.status === 200 });

    if (includePresenceWrites && !presenceOnly) {
      const pageView = http.post(`${apiBaseUrl}/api/storefront/page-view`, null, apiRequestOptions);
      recordResponse(pageView);
      check(pageView, { 'page view is recorded': (response) => response.status === 204 });
    }
  }

  if (!presenceOnly) {
    const response = http.get(`${apiBaseUrl}/api/products?limit=100`, apiRequestOptions);
    recordResponse(response);
    check(response, { 'product list loads': (result) => result.status === 200 });

    if (response.status === 200) {
      const products = response.json();
      if (Array.isArray(products) && products.length) {
        const product = products[Math.floor(Math.random() * products.length)];
        const details = http.get(`${apiBaseUrl}/api/products/${encodeURIComponent(product.slug)}`, apiRequestOptions);
        recordResponse(details);
      }
    }
  }

  if (includePresenceWrites) {
    const presence = http.post(
      `${apiBaseUrl}/api/storefront/presence`,
      JSON.stringify({ action: 'heartbeat', visitorId, tabId }),
      { ...apiRequestOptions, headers: { ...apiRequestOptions.headers, 'Content-Type': 'application/json' } },
    );
    recordResponse(presence);
    check(presence, { 'visitor presence is recorded': (result) => result.status === 204 });
  }

  // Think time approximates shoppers browsing instead of hammering the API.
  sleep(5 + Math.random() * 5);
}
