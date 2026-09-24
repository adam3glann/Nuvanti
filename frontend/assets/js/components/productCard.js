import { icon } from './icons.js';
import { colorHex, isInStock } from '../data/products.js';
import { toggleWishlist, isWishlisted } from '../services/wishlistService.js';
import { addToCart } from '../services/cartService.js';
import { showToast } from './toast.js';

export function productCardHTML(product) {
  const alt = product.images[1] || product.images[0];
  const wished = isWishlisted(product.id);
  const inStock = isInStock(product);
  return `
    <article class="product-card" data-product-id="${product.id}">
      <a href="product.html?slug=${product.slug}" class="product-card__media" aria-label="View ${product.name}">
        <img src="${product.images[0]}" alt="${product.name}" loading="lazy" width="600" height="750" />
        <img src="${alt}" alt="" class="img-alt" loading="lazy" width="600" height="750" />
      </a>
      <div class="product-card__badges">
        ${product.badges.map((b) => `<span class="badge ${b === 'SALE' ? 'badge--sale' : ''}">${b}</span>`).join('')}
        ${!inStock ? '<span class="badge badge--outline">Sold out</span>' : ''}
      </div>
      <button class="product-card__wishlist icon-btn" data-wishlist-toggle="${product.id}" data-active="${wished}"
        aria-pressed="${wished}" aria-label="${wished ? 'Remove from wishlist' : 'Add to wishlist'}">
        ${icon('heart')}
      </button>
      <div class="product-card__quick">
        <button class="btn btn-sm" data-quick-add="${product.id}" ${!inStock ? 'disabled' : ''}>
          ${inStock ? 'Quick Add' : 'Sold Out'}
        </button>
      </div>
      <a href="product.html?slug=${product.slug}">
        <p class="product-card__name">${product.name}</p>
        <div class="product-card__meta">
          <span class="product-card__price">${formatPrice(product.price)}</span>
          ${product.compareAtPrice ? `<span class="product-card__compare">${formatPrice(product.compareAtPrice)}</span>` : ''}
        </div>
        <div class="product-card__swatches">
          ${product.colors.map((c) => `<span class="swatch" style="background:${colorHex(c)}" title="${c}"></span>`).join('')}
        </div>
      </a>
    </article>
  `;
}

export function formatPrice(value) {
  return `${value.toLocaleString('en-US')} EGP`;
}

// Delegated listeners — attach once per stable container and refresh the
// current product map as async filters/search results replace its contents.
const productCardBindings = new WeakMap();
export function bindProductCardEvents(container, { products, onCartChange } = {}) {
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
