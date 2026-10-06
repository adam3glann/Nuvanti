import { initShell } from '../main.js?v=store-theme-1';
import { formatPrice } from '../components/productCard.js';
import { getCart, cartSubtotal, clearCart, syncCartWithProducts } from '../services/cartService.js';
import { createOrder } from '../services/orderService.js';
import { getCurrentUser } from '../services/authService.js';
import { showToast } from '../components/toast.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';
import { checkDiscount, getSavedDiscountCode, saveDiscountCode, clearDiscountCode } from '../services/discountService.js';
import { loadStoreSettings, refreshStoreSettings } from '../services/storeSettingsService.js';
import { startLiveRefresh } from '../services/liveRefresh.js';
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
let instapayEnabled = false;
let instapayDetails = null;

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
    if (storeSettings.emergencyLockdown === true) {
      form.innerHTML = '<div class="state-block"><h3>Ordering is temporarily paused</h3><p>The store has paused checkout while a security issue is reviewed. Your bag is saved; please try again later.</p></div>';
      summary.innerHTML = '';
      return;
    }
    try {
      const paymentResponse = await fetch(`${API_ORIGIN}/api/payments/config`, { credentials: 'include' });
      onlinePaymentEnabled = paymentResponse.ok && (await paymentResponse.json()).onlinePaymentEnabled === true;
    } catch { onlinePaymentEnabled = false; }
    instapayEnabled = storeSettings.instapayEnabled === true && Boolean(storeSettings.instapayRecipient && storeSettings.instapayWhatsappPhone);
    instapayDetails = instapayEnabled ? storeSettings : null;
  } catch {
    form.innerHTML = '<div class="state-block"><h3>Checkout is temporarily unavailable</h3><p>We could not verify your account or current delivery prices. Your bag is saved—please try again shortly.</p></div>';
    summary.innerHTML = '';
    return;
  }
  if (currentUser && !currentUser.emailVerifiedAt) {
    form.innerHTML = '<div class="state-block"><h3>Verify your email to order</h3><p>Confirm your email address before placing an order. Open the confirmation link from your inbox, then return here to finish checkout.</p><a class="btn btn-primary" href="account.html?tab=profile">Open account and resend email</a></div>';
    summary.innerHTML = '';
    return;
  }
  if (currentUser) {
    try { savedAddress = (await fetchAddresses()).find((address) => address.isDefault) || null; }
    catch { savedAddress = null; }
  }
  render();
  await restoreSavedDiscount();
  renderSummary();
  startLiveRefresh(async () => {
    const latestProducts = await Promise.all([...new Set(lines.map((line) => line.slug))].map(fetchProductBySlug));
    const stockChanges = syncCartWithProducts(latestProducts);
    lines = getCart();
    if (!lines.length) {
      showToast('The items in your bag are no longer available.');
      window.location.href = 'cart.html';
      return;
    }
    if (stockChanges.removed.length || stockChanges.adjusted.length || stockChanges.priceChanged) {
      await restoreSavedDiscount();
      renderSummary();
      showToast('Your bag was updated to match current stock and prices. Please review the order summary.');
    }
    const latest = await refreshStoreSettings();
    if (latest.emergencyLockdown === true) {
      storeSettings = latest;
      render();
      return;
    }
    if (JSON.stringify(latest) !== JSON.stringify(storeSettings)) {
      storeSettings = latest;
      const subtotal = cartSubtotal();
      const standard = document.querySelector('.delivery-option[data-value="standard"] .delivery-option__price');
      const express = document.querySelector('.delivery-option[data-value="express"] .delivery-option__price');
      if (standard) standard.textContent = subtotal >= storeSettings.freeShippingThresholdCents / 100 ? 'Free' : formatPrice(storeSettings.standardShippingCents / 100);
      if (express) express.textContent = formatPrice(storeSettings.expressShippingCents / 100);
      renderSummary();
    }
      await refreshPaymentAvailability();
  }, 15000);
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
  if (storeSettings?.emergencyLockdown === true) {
    document.getElementById('checkoutForm').innerHTML = '<div class="state-block"><h3>Ordering is temporarily paused</h3><p>The store has paused checkout while a security issue is reviewed. Your bag is saved; please try again later.</p></div>';
    document.getElementById('checkoutSummary').innerHTML = '';
    return;
  }
  const subtotal = cartSubtotal();

  document.getElementById('checkoutForm').innerHTML = `
    <section class="checkout-section">
      <h3 class="h3" style="margin-bottom:1.25rem">Customer Information</h3>
      <div class="field"><label for="fullName">Full Name</label><input type="text" id="fullName" value="${escapeAttr(savedAddress?.name || currentUser?.name || '')}" autocomplete="name" required /></div>
      <div class="field-row">
        ${currentUser ? `<div class="field"><label>Order email</label><p class="text-muted">${escapeHtml(currentUser.email)}</p><p class="text-muted" style="font-size:var(--fs-micro)">Your confirmation and tracking link will be sent here.</p></div>` : `<div class="field"><label for="email">Email for receipt and tracking link <span lang="ar" dir="rtl">البريد الإلكتروني للإيصال ورابط التتبع</span></label><input type="email" id="email" autocomplete="email" maxlength="254" required /></div>`}
        <div class="field"><label for="phone">Phone</label><input type="tel" id="phone" value="${escapeAttr(savedAddress?.phone || '')}" autocomplete="tel" required /></div>
      </div>
      ${!currentUser ? `<div class="guest-account-choice">
        <p><strong>Continue as a guest</strong> — no account is needed to place your order. <span lang="ar" dir="rtl">يمكنك إتمام الطلب كضيف دون إنشاء حساب.</span></p>
        <label class="guest-account-choice__toggle"><input type="checkbox" id="createGuestAccount" /><span>Create an account for future orders <span lang="ar" dir="rtl">إنشاء حساب للطلبات القادمة</span></span></label>
        <div id="guestAccountFields" hidden>
          <div class="field"><label for="guestPassword">Choose a password <span lang="ar" dir="rtl">اختر كلمة مرور</span></label><input type="password" id="guestPassword" autocomplete="new-password" minlength="12" maxlength="128" /><p class="text-muted" style="font-size:var(--fs-micro)">At least 12 characters. We’ll send an email verification link. <span lang="ar" dir="rtl">12 حرفاً على الأقل. سنرسل رابطاً لتأكيد البريد الإلكتروني.</span></p></div>
          <div class="field"><label for="guestPasswordConfirm">Confirm password <span lang="ar" dir="rtl">تأكيد كلمة المرور</span></label><input type="password" id="guestPasswordConfirm" autocomplete="new-password" minlength="12" maxlength="128" /></div>
        </div>
      </div>` : ''}
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

    <section class="checkout-section" id="paymentSection" style="border-bottom:none">
      <h3 class="h3" style="margin-bottom:1.25rem">Payment</h3>
      <label class="payment-option" data-active="true" data-value="cod">
        <input type="radio" name="payment" value="cod" checked style="margin-top:.2rem" />
        <div><strong>Cash on Delivery</strong><p class="text-muted" style="font-size:var(--fs-small)">Pay when your order arrives</p></div>
      </label>
      ${paymentOptionsMarkup()}
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
  bindPaymentOptions();
  renderSummary();

  document.getElementById('createGuestAccount')?.addEventListener('change', (event) => {
    const fields = document.getElementById('guestAccountFields');
    fields.hidden = !event.target.checked;
    document.getElementById('guestPassword').required = event.target.checked;
    document.getElementById('guestPasswordConfirm').required = event.target.checked;
  });

  document.getElementById('checkoutForm').addEventListener('submit', onSubmit);
}

function paymentOptionsMarkup() {
  return `${onlinePaymentEnabled ? `<label class="payment-option" data-value="paymob" style="margin-top:.75rem">
    <input type="radio" name="payment" value="paymob" style="margin-top:.2rem" />
    <div><strong>Pay online securely</strong><p class="text-muted" style="font-size:var(--fs-small)">Card and other methods enabled by the payment provider</p></div>
  </label>` : ''}${instapayEnabled ? `<label class="payment-option" data-value="instapay" style="margin-top:.75rem">
    <input type="radio" name="payment" value="instapay" style="margin-top:.2rem" />
    <div><strong>InstaPay transfer</strong><p class="text-muted" style="font-size:var(--fs-small)">Transfer after placing your order, then send a screenshot on WhatsApp</p></div>
  </label>` : ''}`;
}

function bindPaymentOptions() {
  document.querySelectorAll('input[name="payment"]').forEach((radio) => radio.addEventListener('change', (event) => applyPaymentSelection(event.target.value)));
  applyPaymentSelection(document.querySelector('input[name="payment"]:checked')?.value || 'cod');
}

function applyPaymentSelection(method) {
  const online = method === 'paymob';
  document.querySelectorAll('.payment-option').forEach((element) => { element.dataset.active = String(element.dataset.value === method); });
  const button = document.getElementById('placeOrderBtn');
  const note = document.getElementById('paymentNote');
  if (button) button.textContent = online ? 'Continue to Secure Payment' : method === 'instapay' ? 'Place InstaPay Order' : 'Place Cash on Delivery Order';
  if (note) note.textContent = online ? 'You will complete payment on the payment provider’s secure checkout. We never collect card details.' : method === 'instapay' ? 'Your order stays unpaid until we verify your transfer.' : 'Payment is due to the delivery courier when your order arrives. No card details are collected.';
  renderSummary();
}

async function refreshPaymentAvailability() {
  try {
    const response = await fetch(`${API_ORIGIN}/api/payments/config`, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) return;
    const enabled = (await response.json()).onlinePaymentEnabled === true;
    const latestSettings = await refreshStoreSettings();
    const newInstaEnabled = latestSettings.instapayEnabled === true && Boolean(latestSettings.instapayRecipient && latestSettings.instapayWhatsappPhone);
    if (enabled === onlinePaymentEnabled && newInstaEnabled === instapayEnabled && JSON.stringify(latestSettings) === JSON.stringify(storeSettings)) return;
    onlinePaymentEnabled = enabled;
    instapayEnabled = newInstaEnabled;
    instapayDetails = newInstaEnabled ? latestSettings : null;
    const selected = document.querySelector('input[name="payment"]:checked')?.value || 'cod';
    const safeSelection = (enabled || selected !== 'paymob') && (newInstaEnabled || selected !== 'instapay') ? selected : 'cod';
    const section = document.getElementById('paymentSection');
    if (!section) return;
    section.innerHTML = `<h3 class="h3" style="margin-bottom:1.25rem">Payment</h3>
      <label class="payment-option" data-active="${safeSelection === 'cod'}" data-value="cod">
        <input type="radio" name="payment" value="cod" ${safeSelection === 'cod' ? 'checked' : ''} style="margin-top:.2rem" />
        <div><strong>Cash on Delivery</strong><p class="text-muted" style="font-size:var(--fs-small)">Pay when your order arrives</p></div>
      </label>${paymentOptionsMarkup()}`;
    section.querySelector(`input[value="${safeSelection}"]`)?.setAttribute('checked', 'checked');
    bindPaymentOptions();
  } catch { /* Keep the last verified payment choices if refresh is unavailable. */ }
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
    ${instapayDetails && document.querySelector('input[name="payment"]:checked')?.value === 'instapay' ? `<div class="card" style="margin-top:1rem;padding:1rem"><strong>InstaPay transfer details</strong><p class="text-muted" style="font-size:var(--fs-small);margin:.5rem 0">Transfer exactly ${formatPrice(total)}. Your order remains unpaid until we verify it.</p><div class="summary-row"><span>Recipient</span><span>${escapeHtml(instapayDetails.instapayRecipient)}</span></div><button type="button" class="btn btn-outline btn-sm" id="copyInstaPayDetails">Copy InstaPay details</button></div>` : ''}
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
  document.getElementById('copyInstaPayDetails')?.addEventListener('click', async (event) => {
    try { await navigator.clipboard.writeText(instapayDetails.instapayRecipient); event.currentTarget.textContent = 'Copied'; }
    catch { showToast('Copy is unavailable. Select and copy the recipient details.'); }
  });
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const createAccount = document.getElementById('createGuestAccount')?.checked === true;
  const requiredIds = ['fullName', 'phone', 'address', 'city', 'country', ...(!currentUser ? ['email'] : []), ...(createAccount ? ['guestPassword', 'guestPasswordConfirm'] : [])];
  let valid = true;
  requiredIds.forEach((id) => {
    const input = document.getElementById(id);
    if (!input.checkValidity()) { valid = false; input.reportValidity(); }
  });
  if (!valid) return;

  const guestPassword = value('guestPassword');
  if (createAccount && guestPassword !== value('guestPasswordConfirm')) {
    showToast('The passwords do not match. · كلمتا المرور غير متطابقتين.');
    return;
  }

  const customer = {
    name: document.getElementById('fullName').value,
    email: currentUser?.email || value('email').trim(),
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
  try { placedOrder = await createOrder({ lines, customer, shipping, delivery, paymentMethod, discountCode: discountInfo?.code, createAccount: createAccount ? { password: guestPassword } : undefined }); }
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
    button.textContent = paymentMethod === 'paymob' ? 'Continue to Secure Payment' : paymentMethod === 'instapay' ? 'Place InstaPay Order' : 'Place Cash on Delivery Order';
    return;
  }
  if (placedOrder.accountCreated) {
    currentUser = await getCurrentUser().catch(() => null);
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
function value(id) { return document.getElementById(id)?.value ?? ''; }
function escapeAttr(value) { return escapeHtml(value); }
