import { initShell } from '../main.js';
import { formatPrice } from '../components/productCard.js';
import { getCart, cartSubtotal, clearCart } from '../services/cartService.js';
import { createMockOrder } from '../services/orderService.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';

initShell({ currentPage: 'shop' });

let delivery = 'standard';
let payment = 'card';

const lines = getCart();
if (lines.length === 0) {
  window.location.href = 'cart.html';
} else {
  render();
}

function render() {
  const subtotal = cartSubtotal();

  document.getElementById('checkoutForm').innerHTML = `
    <section class="checkout-section">
      <h3 class="h3" style="margin-bottom:1.25rem">Customer Information</h3>
      <div class="field"><label for="fullName">Full Name</label><input type="text" id="fullName" required /></div>
      <div class="field-row">
        <div class="field"><label for="email">Email</label><input type="email" id="email" required /></div>
        <div class="field"><label for="phone">Phone</label><input type="tel" id="phone" required /></div>
      </div>
    </section>

    <section class="checkout-section">
      <h3 class="h3" style="margin-bottom:1.25rem">Shipping Address</h3>
      <div class="field"><label for="address">Street Address</label><input type="text" id="address" required /></div>
      <div class="field-row">
        <div class="field"><label for="city">City</label><input type="text" id="city" required /></div>
        <div class="field"><label for="postal">Postal Code</label><input type="text" id="postal" /></div>
      </div>
      <div class="field"><label for="country">Country</label>
        <select id="country" required>
          <option>Egypt</option><option>United Arab Emirates</option><option>Saudi Arabia</option><option>Other</option>
        </select>
      </div>
    </section>

    <section class="checkout-section">
      <h3 class="h3" style="margin-bottom:1.25rem">Delivery Method</h3>
      <label class="delivery-option" data-active="true" data-value="standard">
        <input type="radio" name="delivery" value="standard" checked style="margin-top:.2rem" />
        <div><strong>Standard Shipping</strong><p class="text-muted" style="font-size:var(--fs-small)">4–7 business days</p></div>
        <span class="delivery-option__price">${subtotal >= 3000 ? 'Free' : formatPrice(75)}</span>
      </label>
      <label class="delivery-option" data-value="express">
        <input type="radio" name="delivery" value="express" style="margin-top:.2rem" />
        <div><strong>Express Shipping</strong><p class="text-muted" style="font-size:var(--fs-small)">1–2 business days</p></div>
        <span class="delivery-option__price">${formatPrice(150)}</span>
      </label>
    </section>

    <section class="checkout-section" style="border-bottom:none">
      <h3 class="h3" style="margin-bottom:1.25rem">Payment</h3>
      <label class="payment-option" data-active="true" data-value="card">
        <input type="radio" name="payment" value="card" checked style="margin-top:.2rem" />
        <div><strong>Credit / Debit Card</strong><p class="text-muted" style="font-size:var(--fs-small)">Visa, Mastercard, Meeza</p></div>
      </label>
      <label class="payment-option" data-value="cod">
        <input type="radio" name="payment" value="cod" style="margin-top:.2rem" />
        <div><strong>Cash on Delivery</strong><p class="text-muted" style="font-size:var(--fs-small)">Pay when your order arrives</p></div>
      </label>
      <div id="cardFields" style="margin-top:1rem"></div>
    </section>

    <button class="btn btn-primary btn-block" id="placeOrderBtn" type="submit">Place Order</button>
    <p class="text-muted" style="font-size:var(--fs-micro);text-align:center;margin-top:1rem">
      This is a frontend preview — no payment is processed and no real card data is collected.
    </p>
  `;

  renderCardFields();

  document.querySelectorAll('input[name="delivery"]').forEach((r) => r.addEventListener('change', (e) => {
    delivery = e.target.value;
    document.querySelectorAll('.delivery-option').forEach((el) => (el.dataset.active = String(el.dataset.value === delivery)));
    renderSummary();
  }));
  document.querySelectorAll('input[name="payment"]').forEach((r) => r.addEventListener('change', (e) => {
    payment = e.target.value;
    document.querySelectorAll('.payment-option').forEach((el) => (el.dataset.active = String(el.dataset.value === payment)));
    renderCardFields();
  }));

  renderSummary();

  document.getElementById('checkoutForm').addEventListener('submit', onSubmit);
}

function renderCardFields() {
  const el = document.getElementById('cardFields');
  if (payment !== 'card') { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="card-placeholder">
      Payment gateway UI placeholder — card fields will render here once connected to a real payment provider.
    </div>
  `;
}

function renderSummary() {
  const subtotal = cartSubtotal();
  const shippingCost = delivery === 'express' ? 150 : (subtotal >= 3000 ? 0 : 75);
  const total = subtotal + shippingCost;

  document.getElementById('checkoutSummary').innerHTML = `
    <h3 class="h3" style="margin-bottom:1.25rem">Order Summary</h3>
    ${lines.map((l) => `
      <div class="mini-line">
        <img src="${l.image}" alt="${l.name}" />
        <div>
          <p style="font-weight:600;font-size:var(--fs-small)">${l.name}</p>
          <p class="mini-line__meta">${l.color} · ${l.size} · Qty ${l.quantity}</p>
          <p style="font-size:var(--fs-small);margin-top:.25rem">${formatPrice(l.price * l.quantity)}</p>
        </div>
      </div>
    `).join('')}
    <hr class="hr" style="margin-block:1rem" />
    <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
    <div class="summary-row"><span>Shipping</span><span>${shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span></div>
    <div class="summary-row summary-row--total"><span>Total</span><span>${formatPrice(total)}</span></div>
  `;
}

function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const requiredIds = ['fullName', 'email', 'phone', 'address', 'city', 'country'];
  let valid = true;
  requiredIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input.checkValidity()) { valid = false; input.reportValidity(); }
  });
  if (!valid) return;

  const customer = {
    name: document.getElementById('fullName').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
  };
  const shipping = {
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    postal: document.getElementById('postal').value,
    country: document.getElementById('country').value,
  };

  const order = createMockOrder({ lines, customer, shipping, delivery, subtotal: cartSubtotal() });
  clearCart();
  refreshCartDrawer();
  window.location.href = 'order-success.html';
}

