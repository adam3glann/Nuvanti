import { icon } from './icons.js';
import { formatPrice, escapeHtml } from './productCard.js';
import {
  getCart, updateQuantity, removeFromCart, cartSubtotal,
  amountToFreeShipping, freeShippingProgress, FREE_SHIPPING_THRESHOLD,
} from '../services/cartService.js';
import { refreshHeaderCounts } from './header.js';

let mounted = false;

export function mountCartDrawer() {
  if (mounted) return;
  mounted = true;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="scrim" id="cartScrim"></div>
    <aside class="cart-drawer" id="cartDrawer" aria-label="Shopping cart" data-open="false">
      <div class="cart-drawer__head">
        <h2 class="h3">Your Bag</h2>
        <button class="icon-btn" id="closeCart" aria-label="Close cart">${icon('close')}</button>
      </div>
      <div class="cart-drawer__progress" id="cartProgress"></div>
      <div class="cart-drawer__items" id="cartItems"></div>
      <div class="cart-drawer__foot" id="cartFoot"></div>
    </aside>
  `;
  document.body.appendChild(wrap);

  document.getElementById('closeCart').addEventListener('click', closeCartDrawer);
  document.getElementById('cartScrim').addEventListener('click', closeCartDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCartDrawer(); });

  document.getElementById('cartItems').addEventListener('click', (e) => {
    const dec = e.target.closest('[data-dec]');
    const inc = e.target.closest('[data-inc]');
    const rem = e.target.closest('[data-remove]');
    const lines = getCart();
    if (dec) {
      const line = lines.find((l) => l.lineId === dec.dataset.dec);
      if (!line) return;
      updateQuantity(line.lineId, line.quantity - 1);
      render();
    } else if (inc) {
      const line = lines.find((l) => l.lineId === inc.dataset.inc);
      if (!line) return;
      updateQuantity(line.lineId, line.quantity + 1);
      render();
    } else if (rem) {
      removeFromCart(rem.dataset.remove);
      render();
    }
  });

  render();
}

function render() {
  const lines = getCart();
  const itemsEl = document.getElementById('cartItems');
  const footEl = document.getElementById('cartFoot');
  const progressEl = document.getElementById('cartProgress');
  if (!itemsEl) return;

  const remaining = amountToFreeShipping();
  progressEl.innerHTML = `
    <p>${remaining > 0
      ? `You're <strong>${formatPrice(remaining)}</strong> away from free shipping.`
      : `<strong>You've unlocked free shipping.</strong>`}</p>
    <div class="progress-bar"><div class="progress-bar__fill" style="width:${freeShippingProgress()}%"></div></div>
  `;

  if (lines.length === 0) {
    itemsEl.innerHTML = `
      <div class="cart-empty">
        ${icon('bag')}
        <h3 class="h3">Your bag is empty</h3>
        <p class="text-muted">Items you add will show up here.</p>
        <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
      </div>`;
    footEl.innerHTML = '';
    refreshHeaderCounts();
    return;
  }

  itemsEl.innerHTML = lines.map((l) => `
    <div class="cart-line" data-line="${escapeHtml(l.lineId)}">
      <img src="${escapeHtml(l.image)}" alt="${escapeHtml(l.name)}" width="80" height="100" loading="lazy" />
      <div>
        <p class="cart-line__name">${escapeHtml(l.name)}</p>
        <p class="cart-line__meta">${escapeHtml(l.color)} · Size ${escapeHtml(l.size)}</p>
        <div class="cart-line__row">
          <div class="qty-stepper">
            <button data-dec="${escapeHtml(l.lineId)}" aria-label="Decrease quantity">${icon('minus')}</button>
            <span>${Number(l.quantity)}</span>
            <button data-inc="${escapeHtml(l.lineId)}" aria-label="Increase quantity" ${Number(l.quantity) >= 10 ? 'disabled' : ''}>${icon('plus')}</button>
          </div>
          <span>${formatPrice(l.price * l.quantity)}</span>
        </div>
        <button class="btn-text btn-sm" data-remove="${escapeHtml(l.lineId)}" style="margin-top:.5rem;font-size:.75rem;color:var(--color-muted)">Remove</button>
      </div>
    </div>
  `).join('');

  footEl.innerHTML = `
    <div class="cart-drawer__subtotal"><span>Subtotal</span><span>${formatPrice(cartSubtotal())}</span></div>
    <a href="checkout.html" class="btn btn-primary btn-block">Checkout</a>
    <a href="cart.html" class="btn btn-text" style="display:block;text-align:center;margin-top:1rem">View Bag</a>
  `;

  refreshHeaderCounts();
}

export function openCartDrawer() {
  mountCartDrawer();
  render();
  document.getElementById('cartDrawer').dataset.open = 'true';
  document.getElementById('cartScrim').dataset.open = 'true';
  document.body.style.overflow = 'hidden';
}

export function closeCartDrawer() {
  const drawer = document.getElementById('cartDrawer');
  const scrim = document.getElementById('cartScrim');
  if (!drawer) return;
  drawer.dataset.open = 'false';
  scrim.dataset.open = 'false';
  document.body.style.overflow = '';
}

export function refreshCartDrawer() {
  if (mounted) render();
  refreshHeaderCounts();
}
