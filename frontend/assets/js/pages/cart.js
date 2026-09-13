import { initShell } from '../main.js';
import { icon } from '../components/icons.js';
import { formatPrice } from '../components/productCard.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';
import { getCart, updateQuantity, removeFromCart, cartSubtotal, FREE_SHIPPING_THRESHOLD } from '../services/cartService.js';

initShell({ currentPage: 'shop' });

let promoApplied = false;
const PROMO_CODE = 'NUVANTI10';
const PROMO_RATE = 0.1;
let listenerBound = false;

render();

function render() {
  const lines = getCart();
  const listEl = document.getElementById('cartList');
  const summaryEl = document.getElementById('cartSummary');

  if (lines.length === 0) {
    document.getElementById('cartRoot').innerHTML = `
      <div class="state-block">
        ${icon('bag')}
        <h3 style="margin-top:1rem">Your bag is empty</h3>
        <p>Looks like you haven't added anything yet.</p>
        <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
      </div>`;
    return;
  }

  listEl.innerHTML = lines.map((l) => `
    <div class="cart-page-line" data-line="${l.lineId}">
      <img src="${l.image}" alt="${l.name}" />
      <div>
        <div style="display:flex;justify-content:space-between;gap:1rem">
          <div>
            <p style="font-weight:600">${l.name}</p>
            <p class="text-muted" style="font-size:var(--fs-small);margin-top:.25rem">${l.color} · Size ${l.size}</p>
          </div>
          <p style="font-weight:600">${formatPrice(l.price * l.quantity)}</p>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem">
          <div class="qty-stepper">
            <button data-dec="${l.lineId}" aria-label="Decrease quantity">${icon('minus')}</button>
            <span>${l.quantity}</span>
            <button data-inc="${l.lineId}" aria-label="Increase quantity">${icon('plus')}</button>
          </div>
          <button class="icon-btn" data-remove="${l.lineId}" aria-label="Remove item">${icon('trash')}</button>
        </div>
      </div>
    </div>
  `).join('');

  const subtotal = cartSubtotal();
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : (subtotal > 0 ? 75 : 0);
  const discount = promoApplied ? subtotal * PROMO_RATE : 0;
  const total = subtotal - discount + shipping;

  summaryEl.innerHTML = `
    <h3 class="h3" style="margin-bottom:1.5rem">Order Summary</h3>
    <div class="promo-row">
      <label class="visually-hidden" for="promoInput">Discount code</label>
      <input type="text" id="promoInput" placeholder="Discount code" value="${promoApplied ? PROMO_CODE : ''}" ${promoApplied ? 'disabled' : ''} />
      <button class="btn btn-outline btn-sm" id="applyPromo" ${promoApplied ? 'disabled' : ''}>Apply</button>
    </div>
    <div id="promoMsg" style="font-size:var(--fs-micro);margin-bottom:1rem;color:${promoApplied ? 'var(--color-success)' : 'var(--color-error)'}"></div>
    <div class="summary-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
    ${promoApplied ? `<div class="summary-row"><span>Discount (10%)</span><span>-${formatPrice(discount)}</span></div>` : ''}
    <div class="summary-row"><span>Estimated Shipping</span><span>${shipping === 0 ? 'Free' : formatPrice(shipping)}</span></div>
    <div class="summary-row summary-row--total"><span>Estimated Total</span><span>${formatPrice(total)}</span></div>
    <a href="checkout.html" class="btn btn-primary btn-block" style="margin-top:1.5rem">Proceed to Checkout</a>
    <a href="shop.html" class="btn btn-text" style="display:block;text-align:center;margin-top:1rem">Continue Shopping</a>
  `;

  document.getElementById('applyPromo').addEventListener('click', () => {
    const val = document.getElementById('promoInput').value.trim().toUpperCase();
    const msg = document.getElementById('promoMsg');
    if (val === PROMO_CODE) {
      promoApplied = true;
      render();
    } else {
      msg.textContent = 'That code is not valid.';
    }
  });

  if (!listenerBound) {
    listEl.addEventListener('click', onLineClick);
    listenerBound = true;
  }
}

function onLineClick(e) {
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
  render();
}
