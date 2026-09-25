import { initShell } from '../main.js';
import { icon } from '../components/icons.js';
import { formatPrice, escapeHtml } from '../components/productCard.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';
import { getWishlist, removeFromWishlist } from '../services/wishlistService.js';
import { fetchProducts } from '../services/productService.js';
import { isInStock } from '../data/products.js';

import { addToCart } from '../services/cartService.js';
import { showToast } from '../components/toast.js';

initShell({ currentPage: 'shop' });

let bound = false;
let products = [];
loadProducts();

async function loadProducts() {
  const root = document.getElementById('wishlistRoot');
  root.innerHTML = '<div class="state-block"><h2>Loading your wishlist…</h2></div>';
  try {
    products = await fetchProducts();
    render();
  } catch {
    root.innerHTML = '<div class="state-block"><h2>Your wishlist is temporarily unavailable</h2><p>Please try again in a moment.</p><button class="btn btn-outline" id="retryWishlist" type="button">Try again</button></div>';
    root.querySelector('#retryWishlist')?.addEventListener('click', loadProducts);
  }
}

function render() {
  const ids = getWishlist();
  const items = ids.map((id) => products.find((p) => String(p.id) === String(id))).filter(Boolean);
  const root = document.getElementById('wishlistRoot');

  if (items.length === 0) {
    root.innerHTML = `
      <div class="state-block">
        ${icon('heart')}
        <h3 style="margin-top:1rem">Your wishlist is empty</h3>
        <p>Save the pieces you're thinking about — they'll show up here.</p>
        <a href="shop.html" class="btn btn-primary">Discover Products</a>
      </div>`;
    return;
  }

  root.innerHTML = `
    <div class="product-grid">
      ${items.map((p) => `
        <article class="product-card">
          <a href="product.html?slug=${encodeURIComponent(p.slug)}" class="product-card__media">
            <img src="${escapeHtml(p.images?.[0] || 'assets/img/brand/nuvanti-logo.png')}" alt="${escapeHtml(p.name)}" loading="lazy" />
          </a>
          <a href="product.html?slug=${encodeURIComponent(p.slug)}"><p class="product-card__name">${escapeHtml(p.name)}</p></a>
          <p class="product-card__price" style="margin-bottom:.75rem">${formatPrice(p.price)}</p>
          <div style="display:flex;gap:.5rem">
            <button class="btn btn-primary btn-sm" style="flex:1" data-move="${escapeHtml(p.id)}" ${isInStock(p) ? '' : 'disabled'}>${isInStock(p) ? 'Move to Bag' : 'Sold Out'}</button>
            <button class="icon-btn" style="border:1px solid var(--color-border)" data-remove="${escapeHtml(p.id)}" aria-label="Remove ${escapeHtml(p.name)}">${icon('close')}</button>
          </div>
        </article>
      `).join('')}
    </div>
  `;

  if (!bound) {
    root.addEventListener('click', onClick);
    bound = true;
  }
}

function onClick(e) {
  const move = e.target.closest('[data-move]');
  const remove = e.target.closest('[data-remove]');
  if (move) {
    const product = products.find((p) => String(p.id) === String(move.dataset.move));
    if (!product || !isInStock(product)) return;
    const size = product.sizes?.find((s) => (product.inventory[s] || 0) > 0) || product.sizes?.[0] || 'One Size';
    addToCart({ product, size, color: product.colors?.[0] || 'Default', quantity: 1 });
    removeFromWishlist(product.id);
    showToast('Moved to bag', { icon: 'bag' });
    refreshCartDrawer();
    render();
  } else if (remove) {
    removeFromWishlist(remove.dataset.remove);
    render();
  }
}
