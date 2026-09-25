import { initShell } from '../main.js';
import { icon } from '../components/icons.js';
import { formatPrice } from '../components/productCard.js';
import { getLastOrder } from '../services/orderService.js';

initShell({ currentPage: 'shop' });

const order = getLastOrder();
const root = document.getElementById('orderSuccessRoot');

if (!order) {
  root.innerHTML = `
    <div class="state-block">
      <h3>No recent order found</h3>
      <p>Looks like there's nothing to confirm yet.</p>
      <a href="shop.html" class="btn btn-primary">Start Shopping</a>
    </div>`;
} else {
  root.innerHTML = `
    <div class="order-success">
      <div class="order-success__icon">${icon('check')}</div>
      <h1>Thank you for your order.</h1>
      <p class="text-muted">Your order is saved in My Account → Orders. We’ll send updates to ${escapeHtml(order.customer.email)} when email delivery is available.</p>

      <div class="order-detail-card">
        <div class="order-detail-row"><span>Order Number</span><strong>${escapeHtml(order.orderNumber)}</strong></div>
        <div class="order-detail-row"><span>Estimated Delivery</span><span>${escapeHtml(order.estimatedDelivery)}</span></div>
        <div class="order-detail-row"><span>Shipping To</span><span>${escapeHtml(order.shipping.city)}, ${escapeHtml(order.shipping.country)}</span></div>
        <hr class="hr" style="margin-block:1rem" />
        ${order.lines.map((l) => `
          <div class="order-detail-row"><span>${escapeHtml(l.name)} (${escapeHtml(l.color)}, ${escapeHtml(l.size)}) × ${Number(l.quantity)}</span><span>${formatPrice(Number(l.price) * Number(l.quantity))}</span></div>
        `).join('')}
        <hr class="hr" style="margin-block:1rem" />
        <div class="order-detail-row"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
        ${order.discountCode ? `<div class="order-detail-row"><span>Discount (${escapeHtml(order.discountCode)})</span><span>-${formatPrice(order.discountAmount)}</span></div>` : ''}
        <div class="order-detail-row"><span>Shipping</span><span>${order.shippingCost === 0 ? 'Free' : formatPrice(order.shippingCost)}</span></div>
        <div class="order-detail-row" style="font-weight:700;font-size:1.05rem"><span>Total</span><span>${formatPrice(order.total)}</span></div>
      </div>

      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
        <a href="${escapeHtml(getSafeTrackingUrl(order.trackingUrl))}" class="btn btn-outline">Track Order</a>
      </div>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function getSafeTrackingUrl(value) {
  const fallback = 'account.html?tab=orders';
  try {
    const url = new URL(value, window.location.origin);
    const trustedHosts = new Set([window.location.host, 'nuvanti-shop.pages.dev']);
    const sameOrigin = url.origin === window.location.origin;
    return (sameOrigin || (url.protocol === 'https:' && trustedHosts.has(url.host))) && url.pathname.endsWith('/track.html')
      ? `${url.origin}${url.pathname}${url.search}`
      : fallback;
  } catch {
    return fallback;
  }
}
