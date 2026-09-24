import { initShell } from '../main.js';
import { formatPrice } from '../components/productCard.js';

initShell({ currentPage: '' });

import { API_ORIGIN as API } from '../config.js';
const root = document.getElementById('trackRoot');
const params = new URLSearchParams(location.search);
const orderId = params.get('order');
const token = params.get('token');

const STATUS_STEPS = ['pending', 'paid', 'fulfilled'];
const STATUS_LABELS = { pending: 'Order Received', paid: 'Payment Received', fulfilled: 'Fulfilled', cancelled: 'Cancelled' };

if (orderId && token) {
  loadOrder(orderId, token);
} else {
  renderLookupForm();
}

function renderLookupForm(error) {
  root.innerHTML = `
    <form id="lookupForm" novalidate style="max-width:420px;margin-inline:auto">
      ${error ? `<p class="form-error" style="margin-bottom:1rem">${error}</p>` : ''}
      <div class="field"><label for="lkOrder">Order Number</label><input id="lkOrder" placeholder="e.g. 1042" required /></div>
      <div class="field"><label for="lkToken">Tracking Code</label><input id="lkToken" required /><span class="hint">Both are in your confirmation email or WhatsApp message.</span></div>
      <button class="btn btn-primary btn-block" type="submit">Track Order</button>
    </form>
  `;
  document.getElementById('lookupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const orderVal = document.getElementById('lkOrder').value.trim().replace(/^NV-/i, '');
    const tokenVal = document.getElementById('lkToken').value.trim();
    if (!orderVal || !tokenVal) return;
    history.replaceState(null, '', `track.html?order=${encodeURIComponent(orderVal)}&token=${encodeURIComponent(tokenVal)}`);
    loadOrder(orderVal, tokenVal);
  });
}

async function loadOrder(id, token) {
  root.innerHTML = `<div class="a-skeleton" style="height:220px;border-radius:12px"></div>`;
  try {
    const response = await fetch(`${API}/api/orders/track/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Order not found.');
    renderOrder(body);
  } catch (error) {
    renderLookupForm(error.message);
  }
}

function renderOrder(order) {
  const cancelled = order.status === 'cancelled';
  const stepIndex = STATUS_STEPS.indexOf(order.status);

  root.innerHTML = `
    <div class="order-detail-card">
      <div class="order-detail-row"><span>Order Number</span><strong>NV-${order.id}</strong></div>
      <div class="order-detail-row"><span>Placed</span><span>${new Date(order.createdAt).toLocaleDateString()}</span></div>
      ${order.city ? `<div class="order-detail-row"><span>Shipping To</span><span>${order.city}, ${order.country}</span></div>` : ''}
      <div class="order-detail-row"><span>Delivery</span><span>${order.delivery === 'express' ? 'Express (1–2 days)' : 'Standard (4–7 days)'}</span></div>
    </div>

    ${cancelled
      ? `<div class="state-block" style="margin-block:1.5rem"><h3>This order was cancelled</h3><p>Contact us if you have questions about this order.</p></div>`
      : `<div class="order-tracker" style="display:flex;justify-content:space-between;margin-block:2rem;gap:.5rem">
          ${STATUS_STEPS.map((s, i) => `
            <div style="flex:1;text-align:center">
              <div style="width:14px;height:14px;border-radius:50%;margin:0 auto .5rem;background:${i <= stepIndex ? 'var(--color-accent, #111)' : 'var(--color-border, #ddd)'}"></div>
              <span style="font-size:.75rem;color:${i <= stepIndex ? 'inherit' : 'var(--color-muted, #999)'}">${STATUS_LABELS[s]}</span>
            </div>
          `).join('')}
        </div>`}

    <div class="order-detail-card">
      ${order.items.map((it) => `
        <div class="order-detail-row"><span>${it.name}${it.color || it.size ? ` (${[it.color, it.size].filter(Boolean).join(', ')})` : ''} × ${it.quantity}</span></div>
      `).join('')}
      <hr class="hr" style="margin-block:1rem" />
      <div class="order-detail-row" style="font-weight:700;font-size:1.05rem"><span>Total</span><span>${formatPrice(order.total)}</span></div>
    </div>

    <div style="text-align:center;margin-top:1.5rem">
      <a href="contact.html" class="btn-text">Questions about this order? Contact us</a>
    </div>
  `;
}
