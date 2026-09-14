import { icon } from './icons.js';
import { productCardHTML, bindProductCardEvents } from './productCard.js';
import { searchProducts } from '../services/productService.js';
import { refreshCartDrawer } from './cartDrawer.js';

let mounted = false;
const RECENT_KEY = 'nuvanti_recent_searches_v1';
const POPULAR = ['Oversized Tee', 'Signature Hoodie', 'Cargo Pants', 'Denim Jacket', 'Accessories'];

export function mountSearchOverlay() {
  if (mounted) return;
  mounted = true;

  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="search-overlay" id="searchOverlay" data-open="false" role="dialog" aria-modal="true" aria-label="Search">
      <div class="search-overlay__bar container">
        <span>${icon('search')}</span>
        <input type="text" id="searchInput" class="search-overlay__input" placeholder="Search products…" autocomplete="off" />
        <button class="icon-btn" id="closeSearch" aria-label="Close search">${icon('close')}</button>
      </div>
      <div class="search-overlay__body container">
        <div id="searchDefault">
          <p class="label">Recent Searches</p>
          <div class="search-chip-group" id="recentChips"></div>
          <p class="label" style="margin-top:2rem">Popular Searches</p>
          <div class="search-chip-group" id="popularChips">
            ${POPULAR.map((p) => `<button class="search-chip" data-term="${p}">${p}</button>`).join('')}
          </div>
        </div>
        <div class="search-results" id="searchResults" hidden></div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const overlay = document.getElementById('searchOverlay');
  const input = document.getElementById('searchInput');
  const resultsWrap = document.getElementById('searchResults');
  const defaultWrap = document.getElementById('searchDefault');

  document.getElementById('closeSearch').addEventListener('click', closeSearchOverlay);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearchOverlay(); });

  let debounceTimer;
  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch(input.value.trim()), 200);
  });

  wrap.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-term]');
    if (chip) {
      input.value = chip.dataset.term;
      runSearch(chip.dataset.term);
    }
  });

  bindProductCardEvents(resultsWrap, { products: null, onCartChange: refreshCartDrawer });

  async function runSearch(term) {
    if (!term) {
      defaultWrap.hidden = false;
      resultsWrap.hidden = true;
      return;
    }
    defaultWrap.hidden = true;
    resultsWrap.hidden = false;
    resultsWrap.innerHTML = `<div class="product-grid">${'<div class="skeleton" style="aspect-ratio:4/5"></div>'.repeat(4)}</div>`;

    const results = await searchProducts(term);
    saveRecent(term);
    renderRecentChips();

    // rebind product list reference for quick-add
    const module = await import('../data/productStore.js');
    bindProductCardEvents(resultsWrap, { products: module.getPublishedProducts(), onCartChange: refreshCartDrawer });

    if (results.length === 0) {
      resultsWrap.innerHTML = `
        <div class="state-block">
          <h3>No results for "${term}"</h3>
          <p>Try a different term, or browse our best sellers below.</p>
          <a href="shop.html?filter=bestseller" class="btn btn-outline">Shop Best Sellers</a>
        </div>`;
      return;
    }
    resultsWrap.innerHTML = `
      <p class="label" style="margin-bottom:1.5rem">${results.length} Result${results.length > 1 ? 's' : ''}</p>
      <div class="product-grid">${results.map(productCardHTML).join('')}</div>
    `;
  }

  renderRecentChips();
}

function saveRecent(term) {
  let recent = getRecent().filter((t) => t.toLowerCase() !== term.toLowerCase());
  recent.unshift(term);
  recent = recent.slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}
function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; }
}
function renderRecentChips() {
  const el = document.getElementById('recentChips');
  if (!el) return;
  const recent = getRecent();
  el.innerHTML = recent.length
    ? recent.map((t) => `<button class="search-chip" data-term="${t}">${t}</button>`).join('')
    : `<span class="text-muted" style="font-size:.875rem">No recent searches yet.</span>`;
}

export function openSearchOverlay() {
  mountSearchOverlay();
  document.getElementById('searchOverlay').dataset.open = 'true';
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('searchInput')?.focus(), 350);
}
export function closeSearchOverlay() {
  const overlay = document.getElementById('searchOverlay');
  if (!overlay) return;
  overlay.dataset.open = 'false';
  document.body.style.overflow = '';
}
