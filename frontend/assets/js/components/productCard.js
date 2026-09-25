import { icon } from './icons.js';
import { colorHex, isInStock } from '../data/products.js';
import { toggleWishlist, isWishlisted } from '../services/wishlistService.js';
import { addToCart } from '../services/cartService.js';
import { showToast } from './toast.js';
import { initScrollReveal } from './scrollReveal.js';

export function productCardHTML(product, index = 0) {
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const colors = Array.isArray(product.colors) ? product.colors : [];
  const badges = Array.isArray(product.badges) ? product.badges : [];
  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const image = images[0] || 'assets/img/brand/nuvanti-logo.png';
  const alt = images[1] || image;
  const slug = encodeURIComponent(String(product.slug || ''));
  const name = escapeHtml(product.name || 'Nuvanti item');
  const wished = isWishlisted(product.id);
  const inStock = isInStock(product) && sizes.length > 0;
  return `
    <article class="product-card reveal" data-product-id="${escapeHtml(product.id)}" style="--card-order:${Math.min(Number(index) || 0, 7)}">
      <a href="product.html?slug=${slug}" class="product-card__media" aria-label="View ${name}">
        <img src="${escapeHtml(image)}" alt="${name}" loading="lazy" width="600" height="750" />
        <img src="${escapeHtml(alt)}" alt="" class="img-alt" loading="lazy" width="600" height="750" />
      </a>
      <div class="product-card__badges">
        ${badges.map((b) => `<span class="badge ${b === 'SALE' ? 'badge--sale' : ''}">${escapeHtml(b)}</span>`).join('')}
        ${!inStock ? '<span class="badge badge--outline">Sold out</span>' : ''}
      </div>
      <button class="product-card__wishlist icon-btn" data-wishlist-toggle="${escapeHtml(product.id)}" data-active="${wished}"
        aria-pressed="${wished}" aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}">
        ${icon('heart')}
      </button>
      <div class="product-card__quick">
        <button class="btn btn-sm" data-quick-add="${escapeHtml(product.id)}" ${!inStock ? 'disabled' : ''}>
          ${inStock ? 'Quick Add' : 'Sold Out'}
        </button>
      </div>
      <a href="product.html?slug=${slug}">
        <p class="product-card__name">${name}</p>
        <div class="product-card__meta">
          <span class="product-card__price">${formatPrice(product.price)}</span>
          ${product.compareAtPrice ? `<span class="product-card__compare">${formatPrice(product.compareAtPrice)}</span>` : ''}
        </div>
        <div class="product-card__swatches">
          ${colors.map((c) => `<span class="swatch" style="background:${colorHex(c, product.colorSwatches)}" title="${escapeHtml(c)}" aria-label="${escapeHtml(c)}"></span>`).join('')}
        </div>
      </a>
    </article>
  `;
}

export function formatPrice(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP` : 'Price unavailable';
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

// Delegated listeners — attach once per stable container and refresh the
// current product map as async filters/search results replace its contents.
const productCardBindings = new WeakMap();
export function bindProductCardEvents(container, { products, onCartChange } = {}) {
  initScrollReveal(container);
  const current = productCardBindings.get(container);
  if (current) {
    current.products = products || [];
    current.onCartChange = onCartChange;
    return;
  }
  const binding = { products: products || [], onCartChange };
  productCardBindings.set(container, binding);
  container.addEventListener('click', (e) => {
    const wishBtn = e.target.closest('[data-wishlist-toggle]');
    if (wishBtn) {
      e.preventDefault();
      const id = wishBtn.dataset.wishlistToggle;
      const active = toggleWishlist(id);
      const nowActive = active.includes(id);
      wishBtn.dataset.active = String(nowActive);
      wishBtn.setAttribute('aria-pressed', String(nowActive));
      showToast(nowActive ? 'Added to wishlist' : 'Removed from wishlist', { icon: 'heart' });
      return;
    }
    const quickAdd = e.target.closest('[data-quick-add]');
    if (quickAdd) {
      e.preventDefault();
      const id = quickAdd.dataset.quickAdd;
      const product = binding.products.find((p) => String(p.id) === String(id));
      if (!product) return;
      const size = product.sizes.find((s) => (product.inventory[s] || 0) > 0) || product.sizes[0];
      addToCart({ product, size, color: product.colors[0], quantity: 1 });
      showToast(`${product.name} added to bag`, { icon: 'bag' });
      binding.onCartChange?.();
    }
  });
}
