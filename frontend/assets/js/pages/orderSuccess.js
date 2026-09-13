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
      <p class="text-muted">A confirmation has been sent to ${order.customer.email}.</p>

      <div class="order-detail-card">
        <div class="order-detail-row"><span>Order Number</span><strong>${order.orderNumber}</strong></div>
        <div class="order-detail-row"><span>Estimated Delivery</span><span>${order.estimatedDelivery}</span></div>
        <div class="order-detail-row"><span>Shipping To</span><span>${order.shipping.city}, ${order.shipping.country}</span></div>
        <hr class="hr" style="margin-block:1rem" />
        ${order.lines.map((l) => `
          <div class="order-detail-row"><span>${l.name} (${l.color}, ${l.size}) × ${l.quantity}</span><span>${formatPrice(l.price * l.quantity)}</span></div>
        `).join('')}
        <hr class="hr" style="margin-block:1rem" />
        <div class="order-detail-row"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
        <div class="order-detail-row"><span>Shipping</span><span>${order.shippingCost === 0 ? 'Free' : formatPrice(order.shippingCost)}</span></div>
        <div class="order-detail-row" style="font-weight:700;font-size:1.05rem"><span>Total</span><span>${formatPrice(order.total)}</span></div>
      </div>

      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
        <a href="account.html?tab=orders" class="btn btn-outline">Track Order</a>
      </div>
    </div>
  `;
}
