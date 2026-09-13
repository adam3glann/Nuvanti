import { initShell } from '../main.js';
import { icon } from '../components/icons.js';
import { productCardHTML, bindProductCardEvents, formatPrice } from '../components/productCard.js';
import { refreshCartDrawer, openCartDrawer } from '../components/cartDrawer.js';
import { createModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { fetchProductBySlug, fetchRelated } from '../services/productService.js';
import { colorHex, products as allProducts, stockFor, isInStock } from '../data/products.js';
import { addToCart } from '../services/cartService.js';
import { toggleWishlist, isWishlisted } from '../services/wishlistService.js';

initShell({ currentPage: 'shop' });

const RECENT_KEY = 'nuvanti_recently_viewed_v1';
const params = new URLSearchParams(location.search);
const slug = params.get('slug');

let product, selectedColor, selectedSize;

init();

async function init() {
  if (!slug) return renderNotFound();
  product = await fetchProductBySlug(slug);
  if (!product) return renderNotFound();

  selectedColor = product.colors[0];
  selectedSize = null;

  document.title = `${product.name} — Nuvanti`;
  renderBreadcrumb();
  renderGallery();
  renderInfo();
  renderAccordion();
  saveRecentlyViewed();
  loadRelated();
  loadRecentlyViewed();
}

function renderNotFound() {
  document.getElementById('productRoot').innerHTML = `
    <div class="state-block">
      <h3>Product not found</h3>
      <p>The item you're looking for may have sold out or moved.</p>
      <a href="shop.html" class="btn btn-primary">Back to Shop</a>
    </div>`;
}

function renderBreadcrumb() {
  document.getElementById('breadcrumb').innerHTML = `
    <a href="index.html">Home</a><span class="breadcrumb-sep">›</span>
    <a href="shop.html?category=${product.category}">${capitalize(product.category)}</a><span class="breadcrumb-sep">›</span>
    <span>${product.name}</span>
  `;
}

function renderGallery() {
  const el = document.getElementById('gallery');
  el.innerHTML = `
    <div class="gallery__main" id="galleryMain">
      <img src="${product.images[0]}" alt="${product.name}" id="galleryMainImg" />
    </div>
    <div class="gallery__thumbs" role="tablist" aria-label="Product images">
      ${product.images.map((img, i) => `
        <button class="gallery__thumb" role="tab" data-active="${i === 0}" data-src="${img}" aria-label="View image ${i + 1}">
          <img src="${img}" alt="" />
        </button>`).join('')}
    </div>
  `;
  el.querySelectorAll('.gallery__thumb').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.gallery__thumb').forEach((b) => (b.dataset.active = 'false'));
      btn.dataset.active = 'true';
      document.getElementById('galleryMainImg').src = btn.dataset.src;
    });
  });
  const main = document.getElementById('galleryMain');
  main.addEventListener('click', () => main.classList.toggle('is-zoomed'));
}

function renderInfo() {
  const wished = isWishlisted(product.id);
  const productInStock = isInStock(product);
  document.getElementById('productInfo').innerHTML = `
    <p class="label product-info__eyebrow">${capitalize(product.category)}${product.badges.length ? ' · ' + product.badges.join(', ') : ''}</p>
    <h1 class="product-info__name">${product.name}</h1>
    <div class="product-info__price">
      <span>${formatPrice(product.price)}</span>
      ${product.compareAtPrice ? `<span class="product-info__compare">${formatPrice(product.compareAtPrice)}</span>` : ''}
    </div>
    <p class="product-info__desc">${product.description}</p>

    <div class="option-group">
      <div class="option-group__head"><span class="label">Color — ${selectedColor}</span></div>
      <div class="color-options" id="colorOptions">
        ${product.colors.map((c) => `<button class="color-option" data-color="${c}" data-active="${c === selectedColor}" style="background:${colorHex(c)}" aria-label="${c}" title="${c}"></button>`).join('')}
      </div>
    </div>

    <div class="option-group">
      <div class="option-group__head">
        <span class="label">Size</span>
        <button class="btn-text" id="openSizeGuide" style="font-size:.8rem">Size Guide</button>
      </div>
      <div class="size-options" id="sizeOptions">
        ${product.sizes.map((s) => {
          const stock = stockFor(product, s);
          return `<button class="size-option" data-size="${s}" data-active="false" ${stock === 0 ? 'disabled' : ''}>${s}</button>`;
        }).join('')}
      </div>
    </div>

    <div class="option-group">
      <div class="option-group__head"><span class="label">Quantity</span></div>
      <div class="qty-stepper" id="qtyStepper" style="width:fit-content">
        <button id="qtyDec" aria-label="Decrease quantity">${icon('minus')}</button>
        <span id="qtyValue">1</span>
        <button id="qtyInc" aria-label="Increase quantity">${icon('plus')}</button>
      </div>
    </div>

    <p class="stock-line" id="stockLine">${productInStock
      ? '<span class="stock-dot"></span> Select a size to check availability'
      : '<span class="stock-dot stock-dot--out"></span> Currently sold out — check back soon'}</p>

    <div class="purchase-row">
      <button class="btn btn-primary" id="addToCartBtn" ${productInStock ? '' : 'disabled'}>${productInStock ? 'Add to Cart' : 'Sold Out'}</button>
      <button class="btn btn-outline" id="buyNowBtn" ${productInStock ? '' : 'disabled'}>Buy Now</button>
      <button class="icon-btn" style="border:1px solid var(--color-border)" id="wishlistBtn" data-active="${wished}" aria-pressed="${wished}" aria-label="Toggle wishlist">
        ${icon('heart')}
      </button>
    </div>

    <div style="font-size:var(--fs-small);color:var(--color-muted);display:flex;flex-direction:column;gap:.5rem">
      <span>Free shipping on orders over ${formatPrice(3000)}.</span>
      <span>Free returns within 30 days.</span>
      <span>Material: ${product.material}</span>
    </div>
  `;

  document.getElementById('colorOptions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    selectedColor = btn.dataset.color;
    renderInfo();
    reattachAccordionOpen();
  });

  document.getElementById('sizeOptions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-size]');
    if (!btn || btn.disabled) return;
    document.querySelectorAll('#sizeOptions [data-size]').forEach((b) => (b.dataset.active = 'false'));
    btn.dataset.active = 'true';
    selectedSize = btn.dataset.size;
    updateStockLine();
  });

  let qty = 1;
  document.getElementById('qtyDec').addEventListener('click', () => { qty = Math.max(1, qty - 1); document.getElementById('qtyValue').textContent = qty; });
  document.getElementById('qtyInc').addEventListener('click', () => { qty = Math.min(10, qty + 1); document.getElementById('qtyValue').textContent = qty; });

  document.getElementById('addToCartBtn').addEventListener('click', (e) => {
    if (!selectedSize) {
      showToast('Please select a size', { icon: 'alertTriangle' });
      const sizeGroup = document.getElementById('sizeOptions');
      sizeGroup.classList.add('shake');
      setTimeout(() => sizeGroup.classList.remove('shake'), 400);
      return;
    }
    const btn = e.currentTarget;
    const originalLabel = 'Add to Cart';
    btn.disabled = true;
    btn.textContent = 'Adding…';
    setTimeout(() => {
      addToCart({ product, size: selectedSize, color: selectedColor, quantity: qty });
      btn.textContent = 'Added ✓';
      btn.classList.add('btn-success');
      refreshCartDrawer();
      setTimeout(() => {
        btn.textContent = originalLabel;
        btn.classList.remove('btn-success');
        btn.disabled = false;
        openCartDrawer();
      }, 700);
    }, 300);
  });

  document.getElementById('buyNowBtn').addEventListener('click', () => {
    if (!selectedSize) {
      showToast('Please select a size', { icon: 'alertTriangle' });
      const sizeGroup = document.getElementById('sizeOptions');
      sizeGroup.classList.add('shake');
      setTimeout(() => sizeGroup.classList.remove('shake'), 400);
      return;
    }
    addToCart({ product, size: selectedSize, color: selectedColor, quantity: qty });
    location.href = 'checkout.html';
  });

  document.getElementById('wishlistBtn').addEventListener('click', (e) => {
    const active = toggleWishlist(product.id);
    const now = active.includes(product.id);
    e.currentTarget.dataset.active = String(now);
    e.currentTarget.setAttribute('aria-pressed', String(now));
    showToast(now ? 'Added to wishlist' : 'Removed from wishlist', { icon: 'heart' });
  });

  document.getElementById('openSizeGuide').addEventListener('click', () => {
    const modal = createModal({
      title: 'Size Guide',
      bodyHTML: `
        <table class="size-table">
          <thead><tr><th>Size</th><th>Chest (cm)</th><th>Length (cm)</th><th>Sleeve (cm)</th></tr></thead>
          <tbody>
            <tr><td>XS</td><td>92</td><td>66</td><td>58</td></tr>
            <tr><td>S</td><td>98</td><td>68</td><td>60</td></tr>
            <tr><td>M</td><td>104</td><td>70</td><td>62</td></tr>
            <tr><td>L</td><td>110</td><td>72</td><td>64</td></tr>
            <tr><td>XL</td><td>116</td><td>74</td><td>66</td></tr>
            <tr><td>XXL</td><td>122</td><td>76</td><td>68</td></tr>
          </tbody>
        </table>
        <p class="text-muted" style="font-size:.85rem">Measurements are of the garment, laid flat. <a href="size-guide.html" class="btn-text">Full size guide →</a></p>
      `,
    });
    modal.open();
  });
}

function updateStockLine() {
  const stock = stockFor(product, selectedSize);
  const el = document.getElementById('stockLine');
  if (stock === 0) {
    el.innerHTML = `<span class="stock-dot stock-dot--out"></span> Out of stock in this size`;
  } else if (stock <= 4) {
    el.innerHTML = `<span class="stock-dot stock-dot--low"></span> Only ${stock} left in size ${selectedSize}`;
  } else {
    el.innerHTML = `<span class="stock-dot"></span> In stock — ships within 2 business days`;
  }
}

function renderAccordion() {
  const items = [
    { title: 'Shipping', body: 'Standard shipping (4–7 business days) is free on orders over 3,000 EGP, otherwise a flat 75 EGP. Express shipping (1–2 business days) is available at checkout for 150 EGP.' },
    { title: 'Returns', body: 'Unworn items with tags attached can be returned within 30 days of delivery for a full refund. Start a return from your account or contact us.' },
    { title: 'Product Details', body: `${product.material}. Designed in-house. Model is 183cm and wears size M.` },
  ];
  document.getElementById('infoAccordion').innerHTML = items.map((item, i) => `
    <div class="accordion-item">
      <button class="accordion-trigger" aria-expanded="false" aria-controls="acc-${i}" id="acc-trigger-${i}">
        ${item.title} <span class="plus">${icon('plus')}</span>
      </button>
      <div class="accordion-panel" id="acc-${i}" role="region" aria-labelledby="acc-trigger-${i}">
        <div class="accordion-panel__inner">${item.body}</div>
      </div>
    </div>
  `).join('');
  reattachAccordionOpen();
}

function reattachAccordionOpen() {
  document.querySelectorAll('.accordion-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!isOpen));
      panel.style.maxHeight = isOpen ? '0px' : `${panel.scrollHeight}px`;
    });
  });
}

async function loadRelated() {
  const list = await fetchRelated(product, 4);
  const el = document.getElementById('relatedGrid');
  if (list.length === 0) { document.getElementById('relatedSection').hidden = true; return; }
  el.innerHTML = list.map(productCardHTML).join('');
  bindProductCardEvents(el, { products: allProducts, onCartChange: refreshCartDrawer });
}

function saveRecentlyViewed() {
  let recent = getRecent().filter((s) => s !== product.slug);
  recent.unshift(product.slug);
  recent = recent.slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}
function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function loadRecentlyViewed() {
  const recent = getRecent().filter((s) => s !== product.slug);
  const el = document.getElementById('recentlyViewedGrid');
  if (!el || recent.length === 0) { document.getElementById('recentlyViewedSection').hidden = true; return; }
  const list = recent.map((s) => allProducts.find((p) => p.slug === s)).filter(Boolean).slice(0, 4);
  if (list.length === 0) { document.getElementById('recentlyViewedSection').hidden = true; return; }
  el.innerHTML = list.map(productCardHTML).join('');
  bindProductCardEvents(el, { products: allProducts, onCartChange: refreshCartDrawer });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
