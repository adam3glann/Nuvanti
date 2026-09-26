// Read-only storefront load test. Point BASE_URL at a staging Pages URL whose
// /api proxy targets a staging Railway API and staging database.
// This deliberately does not hit checkout, payment, auth, or presence writes.
import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/+$/, '');
if (!baseUrl) throw new Error('Set BASE_URL to your staging storefront URL.');

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
  const home = http.get(`${baseUrl}/`);
  check(home, { 'storefront loads': (response) => response.status === 200 });

  const response = http.get(`${baseUrl}/api/products?limit=100`);
  check(response, { 'product list loads': (result) => result.status === 200 });

  if (response.status === 200) {
    const products = response.json();
    if (Array.isArray(products) && products.length) {
      const product = products[Math.floor(Math.random() * products.length)];
      http.get(`${baseUrl}/api/products/${encodeURIComponent(product.slug)}`);
    }
  }

  // Think time approximates shoppers browsing instead of hammering the API.
  sleep(5 + Math.random() * 5);
}
