import { initShell } from '../main.js';
import { icon } from '../components/icons.js';
import { formatPrice, escapeHtml } from '../components/productCard.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';
import { getCart, updateQuantity, removeFromCart, cartSubtotal, configureFreeShippingThreshold, syncCartWithProducts } from '../services/cartService.js';
import { loadStoreSettings } from '../services/storeSettingsService.js';
import { fetchProductBySlug } from '../services/productService.js';
import { checkDiscount, getSavedDiscountCode, saveDiscountCode, clearDiscountCode } from '../services/discountService.js';

initShell({ currentPage: 'shop' });

// { code, discountCents } once a real code has been validated against the
// backend, otherwise null.
let discountInfo = null;
let listenerBound = false;
let storeSettings = null;
let catalogNotice = sessionStorage.getItem('nuvanti_cart_notice') || '';
sessionStorage.removeItem('nuvanti_cart_notice');

initializeCart();

async function initializeCart() {
  try {
    const initialLines = getCart();
    const currentProducts = await Promise.all([...new Set(initialLines.map((line) => line.slug))].map(fetchProductBySlug));
    const changes = syncCartWithProducts(currentProducts);
    if (!catalogNotice && changes.removed.length) catalogNotice = 'Some bag items are no longer available and were removed. Please review your bag.';
    else if (!catalogNotice && changes.adjusted.length) catalogNotice = 'Your bag quantities were adjusted to match current stock.';
    else if (!catalogNotice && changes.priceChanged) catalogNotice = 'Prices were updated to the current catalog.';
    storeSettings = await loadStoreSettings();
    configureFreeShippingThreshold(storeSettings.freeShippingThresholdCents / 100);
    await restoreSavedDiscount();
    render();
  } catch {
    document.getElementById('cartList').innerHTML = '<div class="state-block"><h3>Bag pricing is temporarily unavailable</h3><p>Your items are saved. Please try again shortly before checkout.</p></div>';
    document.getElementById('cartSummary').innerHTML = '';
  }
}

// If a code was applied earlier in this session, re-validate it against the
// current subtotal (quantities may have changed, or the code may have
// expired/hit its usage limit since) rather than trusting a stale amount.
// Does not render itself — callers render once this settles.
async function restoreSavedDiscount() {
  const saved = getSavedDiscountCode();
  if (!saved || getCart().length === 0) return;
  try {
    const result = await checkDiscount(saved, cartSubtotal());
    discountInfo = { code: result.code, discountCents: result.discountCents };
  } catch {
    clearDiscountCode();
    discountInfo = null;
  }
}

function render() {
  const lines = getCart();
  const listEl = document.getElementById('cartList');
  const summaryEl = document.getElementById('cartSummary');

  if (lines.length === 0) {
    document.getElementById('cartRoot').innerHTML = `
      <div class="state-block">
        ${icon('bag')}
        <h3 style="margin-top:1rem">Your bag is empty</h3>
        ${catalogNotice ? `<p role="status">${escapeHtml(catalogNotice)}</p>` : ''}
        <p>Looks like you haven't added anything yet.</p>
        <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
      </div>`;
    return;
  }

  listEl.innerHTML = lines.map((l) => `
    <div class="cart-page-line" data-line="${escapeHtml(l.lineId)}">
      <img src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" loading="lazy" />
      <div>
        <div style="display:flex;justify-content:space-between;gap:1rem">
          <div>
            <p style="font-weight:600">${escapeHtml(l.name)}</p>
            <p class="text-muted" style="font-size:var(--fs-small);margin-top:.25rem">${escapeHtml(l.color)} · Size ${escapeHtml(l.size)}</p>
          </div>
          <p style="font-weight:600">${formatPrice(l.price * l.quantity)}</p>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem">
          <div class="qty-stepper">
            <button data-dec="${escapeHtml(l.lineId)}" aria-label="Decrease quantity">${icon('minus')}</button>
            <span>${Number(l.quantity)}</span>
            <button data-inc="${escapeHtml(l.lineId)}" aria-label="Increase quantity">${icon('plus')}</button>
          </div>
          <button class="icon-btn" data-remove="${escapeHtml(l.lineId)}" aria-label="Remove item">${icon('trash')}</button>
        </div>
      </div>
    </div>
  `).join('');

  const subtotal = cartSubtotal();
  const shipping = subtotal >= storeSettings.freeShippingThresholdCents / 100 ? 0 : (subtotal > 0 ? storeSettings.standardShippingCents / 100 : 0);
  const discount = discountInfo ? discountInfo.discountCents / 100 : 0;
  const total = Math.max(0, subtotal - discount) + shipping;

  summaryEl.innerHTML = `
    ${catalogNotice ? `<p class="state-note" role="status">${escapeHtml(catalogNotice)}</p>` : ''}
    <h3 class="h3" style="margin-bottom:1.5rem">Order Summary</h3>
    <div class="promo-row">
      <label class="visually-hidden" for="promoInput">Discount code</label>
      <input type="text" id="promoInput" placeholder="Discount code" value="${discountInfo ? discountInfo.code : ''}" ${discountInfo ? 'disabled' : ''} />
      <button class="btn btn-outline btn-sm" id="applyPromo" ${discountInfo ? 'disabled' : ''}>Apply</button>
    </div>
    ${discountInfo ? `<button type="button" class="btn btn-text" id="removePromo" style="display:block;margin:-.5rem 0 1rem;padding:0;font-size:var(--fs-micro)">Remove code</button>` : ''}
    <div id="promoMsg" style="font-size:var(--fs-micro);margin-bottom:1rem;color:var(--color-error)"></div>
    <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
    ${discountInfo ? `<div class="summary-row"><span>Discount (${discountInfo.code})</span><span>-${formatPrice(discount)}</span></div>` : ''}
    <div class="summary-row"><span>Estimated Shipping</span><span>${shipping === 0 ? 'Free' : formatPrice(shipping)}</span></div>
    <div class="summary-row summary-row--total"><span>Estimated Total</span><span>${formatPrice(total)}</span></div>
    <a href="checkout.html" class="btn btn-primary btn-block" style="margin-top:1.5rem">Proceed to Checkout</a>
    <a href="shop.html" class="btn btn-text" style="display:block;text-align:center;margin-top:1rem">Continue Shopping</a>
  `;

  document.getElementById('applyPromo').addEventListener('click', async () => {
    const input = document.getElementById('promoInput');
    const btn = document.getElementById('applyPromo');
    const msg = document.getElementById('promoMsg');
    const val = input.value.trim().toUpperCase();
    if (!val) return;
    btn.disabled = true; btn.textContent = 'Checking…'; msg.textContent = '';
    try {
      const result = await checkDiscount(val, cartSubtotal());
      discountInfo = { code: result.code, discountCents: result.discountCents };
      saveDiscountCode(result.code);
      render();
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
    render();
  });

  if (!listenerBound) {
    listEl.addEventListener('click', onLineClick);
    listenerBound = true;
  }
}

async function onLineClick(e) {
  const dec = e.target.closest('[data-dec]');
  const inc = e.target.closest('[data-inc]');
  const rem = e.target.closest('[data-remove]');
  const lines = getCart();
  if (dec) {
    const line = lines.find((l) => l.lineId === dec.dataset.dec);
    updateQuantity(line.lineId, line.quantity - 1);
  } else if (inc) {
    const line = lines.find((l) => l.lineId === inc.dataset.inc);
    updateQuantity(line.lineId, line.quantity + 1);
  } else if (rem) {
    removeFromCart(rem.dataset.remove);
  } else {
    return;
  }
  refreshCartDrawer();
  // Quantities changed, so a percentage discount's amount (and a
  // minimum-order code's validity) may no longer be accurate — re-check
  // against the backend rather than displaying a stale figure.
  if (discountInfo) await restoreSavedDiscount();
  render();
}
