import { initShell } from '../main.js';
import { formatPrice } from '../components/productCard.js';
import { getCart, cartSubtotal, clearCart, syncCartWithProducts } from '../services/cartService.js';
import { createOrder } from '../services/orderService.js';
import { getCurrentUser } from '../services/authService.js';
import { showToast } from '../components/toast.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';
import { checkDiscount, getSavedDiscountCode, saveDiscountCode, clearDiscountCode } from '../services/discountService.js';
import { loadStoreSettings } from '../services/storeSettingsService.js';
import { fetchProductBySlug } from '../services/productService.js';
import { fetchAddresses } from '../services/addressService.js';
import { API_ORIGIN } from '../config.js';

initShell({ currentPage: 'shop' });

let delivery = 'standard';
// A code applied on the cart page is carried over and re-validated here
// (subtotal may have changed, and delivery choice affects the total but
// never the discount itself, which only ever applies to the subtotal).
let discountInfo = null;
let storeSettings = null;
let currentUser = null;
let savedAddress = null;
let onlinePaymentEnabled = false;

let lines = getCart();
if (lines.length === 0) {
  window.location.href = 'cart.html';
} else {
  initializeCheckout();
}

async function initializeCheckout() {
  const form = document.getElementById('checkoutForm');
  const summary = document.getElementById('checkoutSummary');
  form.innerHTML = '<div class="state-block"><h3>Preparing secure checkout</h3><p>Loading your account and current delivery rates.</p></div>';
  try {
    const initialProducts = await Promise.all([...new Set(lines.map((line) => line.slug))].map(fetchProductBySlug));
    const cartChanges = syncCartWithProducts(initialProducts);
    lines = getCart();
    if (!lines.length) { window.location.href = 'cart.html'; return; }
    if (cartChanges.removed.length || cartChanges.adjusted.length) {
      sessionStorage.setItem('nuvanti_cart_notice', 'Your bag was updated because some items or quantities are no longer available. Review it before checkout.');
      window.location.href = 'cart.html';
      return;
    }
    if (cartChanges.priceChanged) showToast('Bag prices were updated to today’s catalog.');
    [currentUser, storeSettings] = await Promise.all([getCurrentUser(), loadStoreSettings()]);
    try {
      const paymentResponse = await fetch(`${API_ORIGIN}/api/payments/config`, { credentials: 'include' });
      onlinePaymentEnabled = paymentResponse.ok && (await paymentResponse.json()).onlinePaymentEnabled === true;
    } catch { onlinePaymentEnabled = false; }
  } catch {
    form.innerHTML = '<div class="state-block"><h3>Checkout is temporarily unavailable</h3><p>We could not verify your account or current delivery prices. Your bag is saved—please try again shortly.</p></div>';
    summary.innerHTML = '';
    return;
  }
  if (!currentUser) {
    form.innerHTML = '<div class="state-block"><h3>Sign in to continue</h3><p>Your bag will be waiting after you sign in or create an account.</p><a class="btn btn-primary" href="account.html?next=checkout">Sign In or Create Account</a></div>';
    summary.innerHTML = '';
    return;
  }
  if (!currentUser.emailVerifiedAt) {
    form.innerHTML = '<div class="state-block"><h3>Verify your email to order</h3><p>Confirm your email address before placing an order. Open the confirmation link from your inbox, then return here to finish checkout.</p><a class="btn btn-primary" href="account.html?tab=profile">Open account and resend email</a></div>';
    summary.innerHTML = '';
    return;
  }
  try { savedAddress = (await fetchAddresses()).find((address) => address.isDefault) || null; }
  catch { savedAddress = null; }
  render();
  await restoreSavedDiscount();
  renderSummary();
}

async function restoreSavedDiscount() {
  const saved = getSavedDiscountCode();
  if (!saved) return;
  try {
    const result = await checkDiscount(saved, cartSubtotal());
    discountInfo = { code: result.code, discountCents: result.discountCents };
  } catch {
    clearDiscountCode();
    discountInfo = null;
  }
}

function render() {
  const subtotal = cartSubtotal();

  document.getElementById('checkoutForm').innerHTML = `
    <section class="checkout-section">
      <h3 class="h3" style="margin-bottom:1.25rem">Customer Information</h3>
      <div class="field"><label for="fullName">Full Name</label><input type="text" id="fullName" value="${escapeAttr(savedAddress?.name || currentUser.name)}" autocomplete="name" required /></div>
      <div class="field-row">
        <div class="field"><label>Order email</label><p class="text-muted">${escapeHtml(currentUser.email)}</p><p class="text-muted" style="font-size:var(--fs-micro)">Your confirmation and tracking link will be sent here.</p></div>
        <div class="field"><label for="phone">Phone</label><input type="tel" id="phone" value="${escapeAttr(savedAddress?.phone || '')}" autocomplete="tel" required /></div>
      </div>
    </section>

    <section class="checkout-section">
      <h3 class="h3" style="margin-bottom:1.25rem">Shipping Address</h3>
      <div class="field"><label for="address">Street Address</label><input type="text" id="address" value="${escapeAttr(savedAddress?.address1 || '')}" autocomplete="street-address" required /></div>
      <div class="field-row">
        <div class="field"><label for="city">City</label><input type="text" id="city" value="${escapeAttr(savedAddress?.city || '')}" autocomplete="address-level2" required /></div>
        <div class="field"><label for="postal">Postal Code</label><input type="text" id="postal" value="${escapeAttr(savedAddress?.postalCode || '')}" autocomplete="postal-code" /></div>
      </div>
      <div class="field"><label for="country">Country</label>
        <select id="country" required>
          <option selected>Egypt</option>
        </select>
      </div>
    </section>

    <section class="checkout-section">
      <h3 class="h3" style="margin-bottom:1.25rem">Delivery Method</h3>
      <label class="delivery-option" data-active="true" data-value="standard">
        <input type="radio" name="delivery" value="standard" checked style="margin-top:.2rem" />
        <div><strong>Standard Shipping</strong><p class="text-muted" style="font-size:var(--fs-small)">4–7 business days</p></div>
        <span class="delivery-option__price">${subtotal >= storeSettings.freeShippingThresholdCents / 100 ? 'Free' : formatPrice(storeSettings.standardShippingCents / 100)}</span>
      </label>
      <label class="delivery-option" data-value="express">
        <input type="radio" name="delivery" value="express" style="margin-top:.2rem" />
        <div><strong>Express Shipping</strong><p class="text-muted" style="font-size:var(--fs-small)">1–2 business days</p></div>
        <span class="delivery-option__price">${formatPrice(storeSettings.expressShippingCents / 100)}</span>
      </label>
    </section>

    <section class="checkout-section" style="border-bottom:none">
      <h3 class="h3" style="margin-bottom:1.25rem">Payment</h3>
      <label class="payment-option" data-active="true" data-value="cod">
        <input type="radio" name="payment" value="cod" checked style="margin-top:.2rem" />
        <div><strong>Cash on Delivery</strong><p class="text-muted" style="font-size:var(--fs-small)">Pay when your order arrives</p></div>
      </label>
      ${onlinePaymentEnabled ? `<label class="payment-option" data-value="paymob" style="margin-top:.75rem">
        <input type="radio" name="payment" value="paymob" style="margin-top:.2rem" />
        <div><strong>Pay online securely</strong><p class="text-muted" style="font-size:var(--fs-small)">Card and other methods enabled by the payment provider</p></div>
      </label>` : `<p class="text-muted" style="font-size:var(--fs-small);margin-top:1rem">Online payment is being set up. Cash on Delivery is available.</p>`}
    </section>

    <button class="btn btn-primary btn-block" id="placeOrderBtn" type="submit">Place Cash on Delivery Order</button>
    <p class="text-muted" id="paymentNote" style="font-size:var(--fs-micro);text-align:center;margin-top:1rem">
      Payment is due to the delivery courier when your order arrives. No card details are collected.
    </p>
  `;

  document.querySelectorAll('input[name="delivery"]').forEach((r) => r.addEventListener('change', (e) => {
    delivery = e.target.value;
    document.querySelectorAll('.delivery-option').forEach((el) => (el.dataset.active = String(el.dataset.value === delivery)));
    renderSummary();
  }));
  document.querySelectorAll('input[name="payment"]').forEach((radio) => radio.addEventListener('change', (event) => {
    const online = event.target.value === 'paymob';
    document.querySelectorAll('.payment-option').forEach((element) => { element.dataset.active = String(element.dataset.value === event.target.value); });
    document.getElementById('placeOrderBtn').textContent = online ? 'Continue to Secure Payment' : 'Place Cash on Delivery Order';
    document.getElementById('paymentNote').textContent = online ? 'You will complete payment on the payment provider’s secure checkout. We never collect card details.' : 'Payment is due to the delivery courier when your order arrives. No card details are collected.';
  }));
  renderSummary();

  document.getElementById('checkoutForm').addEventListener('submit', onSubmit);
}

function renderSummary() {
  const subtotal = cartSubtotal();
  const shippingCost = delivery === 'express'
    ? storeSettings.expressShippingCents / 100
    : (subtotal >= storeSettings.freeShippingThresholdCents / 100 ? 0 : storeSettings.standardShippingCents / 100);
  const discount = discountInfo ? discountInfo.discountCents / 100 : 0;
  const total = Math.max(0, subtotal - discount) + shippingCost;

  document.getElementById('checkoutSummary').innerHTML = `
    <h3 class="h3" style="margin-bottom:1.25rem">Order Summary</h3>
    ${lines.map((l) => `
      <div class="mini-line">
        <img src="${escapeAttr(l.image)}" alt="${escapeAttr(l.name)}" loading="lazy" />
        <div>
          <p style="font-weight:600;font-size:var(--fs-small)">${escapeAttr(l.name)}</p>
          <p class="mini-line__meta">${escapeAttr(l.color)} · ${escapeAttr(l.size)} · Qty ${Number(l.quantity)}</p>
          <p style="font-size:var(--fs-small);margin-top:.25rem">${formatPrice(l.price * l.quantity)}</p>
        </div>
      </div>
    `).join('')}
    <hr class="hr" style="margin-block:1rem" />
    <div class="promo-row">
      <label class="visually-hidden" for="promoInput">Discount code</label>
      <input type="text" id="promoInput" placeholder="Discount code" value="${discountInfo ? discountInfo.code : ''}" ${discountInfo ? 'disabled' : ''} />
      <button type="button" class="btn btn-outline btn-sm" id="applyPromo" ${discountInfo ? 'disabled' : ''}>Apply</button>
    </div>
    ${discountInfo ? `<button type="button" class="btn btn-text" id="removePromo" style="display:block;margin:-.5rem 0 1rem;padding:0;font-size:var(--fs-micro)">Remove code</button>` : ''}
    <div id="promoMsg" style="font-size:var(--fs-micro);margin-bottom:1rem;color:var(--color-error)"></div>
    <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
    ${discountInfo ? `<div class="summary-row"><span>Discount (${discountInfo.code})</span><span>-${formatPrice(discount)}</span></div>` : ''}
    <div class="summary-row"><span>Shipping</span><span>${shippingCost === 0 ? 'Free' : formatPrice(shippingCost)}</span></div>
    <div class="summary-row summary-row--total"><span>Total</span><span>${formatPrice(total)}</span></div>
  `;

  document.getElementById('applyPromo').addEventListener('click', async () => {
    const btn = document.getElementById('applyPromo');
    const msg = document.getElementById('promoMsg');
    const val = document.getElementById('promoInput').value.trim().toUpperCase();
    if (!val) return;
    btn.disabled = true; btn.textContent = 'Checking…'; msg.textContent = '';
    try {
      const result = await checkDiscount(val, cartSubtotal());
      discountInfo = { code: result.code, discountCents: result.discountCents };
      saveDiscountCode(result.code);
      renderSummary();
    } catch (error) {
      discountInfo = null;
      msg.textContent = error.message;
      btn.disabled = false; btn.textContent = 'Apply';
    }
  });
  const removeBtn = document.getElementById('removePromo');
  if (removeBtn) removeBtn.addEventListener('click', () => {
    discountInfo = null;
    clearDiscountCode();
    renderSummary();
  });
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const requiredIds = ['fullName', 'phone', 'address', 'city', 'country'];
  let valid = true;
  requiredIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input.checkValidity()) { valid = false; input.reportValidity(); }
  });
  if (!valid) return;

  const customer = {
    name: document.getElementById('fullName').value,
    email: currentUser.email,
    phone: document.getElementById('phone').value,
  };
  const shipping = {
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    postal: document.getElementById('postal').value,
    country: document.getElementById('country').value,
  };

  const button = document.getElementById('placeOrderBtn');
  const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'cod';
  button.disabled = true; button.textContent = 'Placing order…';
  let placedOrder;
  try { placedOrder = await createOrder({ lines, customer, shipping, delivery, paymentMethod, discountCode: discountInfo?.code }); }
  catch (error) {
    if (error.status === 409) {
      try {
        const currentProducts = await Promise.all([...new Set(getCart().map((line) => line.slug))].map(fetchProductBySlug));
        const changes = syncCartWithProducts(currentProducts);
        if (changes.adjusted.length || changes.removed.length) {
          sessionStorage.setItem('nuvanti_cart_notice', 'Stock changed while you were checking out. Your bag was adjusted to the pieces still available; review it before placing the order.');
          window.location.href = 'cart.html';
          return;
        }
      } catch { /* Keep the server's stock message visible if refresh fails. */ }
    }
    showToast(error.message);
    button.disabled = false;
    button.textContent = paymentMethod === 'paymob' ? 'Continue to Secure Payment' : 'Place Cash on Delivery Order';
    return;
  }
  clearCart();
  clearDiscountCode();
  refreshCartDrawer();
  if (paymentMethod === 'paymob' && placedOrder.paymentUrl) { window.location.assign(placedOrder.paymentUrl); return; }
  window.location.href = 'order-success.html';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function escapeAttr(value) { return escapeHtml(value); }
