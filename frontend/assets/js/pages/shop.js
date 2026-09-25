import { initShell } from '../main.js';
import { icon } from '../components/icons.js';
import { productCardHTML, bindProductCardEvents, escapeHtml } from '../components/productCard.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';
import { fetchCategories, fetchProducts } from '../services/productService.js';
import { categories as localCategories } from '../data/categories.js';
import { colorHex } from '../data/products.js';
import { getPublishedProducts } from '../data/productStore.js';
import { LOCAL_DEVELOPMENT } from '../config.js';

let allProducts = getPublishedProducts();
let categories = [...localCategories];

initShell({ currentPage: 'shop' });

let allSizes = [...new Set(allProducts.flatMap((p) => p.sizes || []))];
let allColors = [...new Set(allProducts.flatMap((p) => p.colors || []))];
let allColorSwatches = Object.assign({}, ...allProducts.map((p) => p.colorSwatches || {}));

const params = new URLSearchParams(location.search);
const state = {
  category: params.get('category') || '',
  badge: params.get('filter') || '',
  collection: params.get('collection') || '',
  query: params.get('q') || '',
  colors: [],
  sizes: [],
  availability: '',
  sort: 'featured',
  page: 1,
  perPage: 12,
  view: 'grid',
};

async function initShop() {
  const [productsResult, categoriesResult] = await Promise.allSettled([fetchProducts(), fetchCategories()]);
  if (productsResult.status === 'fulfilled') allProducts = productsResult.value;
  else if (!LOCAL_DEVELOPMENT) allProducts = [];
  if (categoriesResult.status === 'fulfilled') categories = categoriesResult.value;
  else if (!LOCAL_DEVELOPMENT) categories = [];
  allSizes = [...new Set(allProducts.flatMap((p) => p.sizes || []))];
  allColors = [...new Set(allProducts.flatMap((p) => p.colors || []))];
  allColorSwatches = Object.assign({}, ...allProducts.map((p) => p.colorSwatches || {}));
  renderFilters();
  renderToolbar();
  initViewToggle();
  bindLayoutEvents();
  document.getElementById('shopSearch').value = state.query;
  syncFilterUI();
  // Start after the mobile browser has completed its initial layout. This avoids
  // an iOS Safari race where the skeleton state can remain painted indefinitely.
  requestAnimationFrame(() => runFilter());
}

function renderFilters() {
  const html = `
    <div class="filter-group">
      <div class="filter-group__title">Category</div>
      ${categories.map((c) => `
        <label class="filter-option">
          <input type="radio" name="category" value="${escapeHtml(c.slug)}" ${state.category === c.slug ? 'checked' : ''} />
          ${escapeHtml(c.name)}
        </label>
      `).join('')}
      <label class="filter-option">
        <input type="radio" name="category" value="" ${state.category === '' ? 'checked' : ''} />
        All Categories
      </label>
    </div>
    <div class="filter-group">
      <div class="filter-group__title">Price</div>
      <label class="filter-option"><input type="radio" name="price" value="" checked /> Any price</label>
      <label class="filter-option"><input type="radio" name="price" value="0-250" /> Under 250 EGP</label>
      <label class="filter-option"><input type="radio" name="price" value="250-500" /> 250 – 500 EGP</label>
      <label class="filter-option"><input type="radio" name="price" value="500-99999" /> 500 EGP & up</label>
    </div>
    <div class="filter-group">
      <div class="filter-group__title">Size</div>
      <div class="size-filter-grid">
        ${allSizes.map((s) => `<button type="button" class="size-filter" data-size="${escapeHtml(s)}" data-active="false">${escapeHtml(s)}</button>`).join('')}
      </div>
    </div>
    <div class="filter-group">
      <div class="filter-group__title">Color</div>
      <div class="color-filter-grid">
        ${allColors.map((c) => `<button type="button" class="color-filter" data-color="${escapeHtml(c)}" data-active="false" style="background:${colorHex(c, allColorSwatches)}" aria-label="${escapeHtml(c)}" title="${escapeHtml(c)}"></button>`).join('')}
      </div>
    </div>
    <div class="filter-group" style="border-bottom:none">
      <div class="filter-group__title">Availability</div>
      <label class="filter-option"><input type="checkbox" data-in-stock-only ${state.availability === 'in-stock' ? 'checked' : ''} /> In stock only</label>
    </div>
  `;
  document.getElementById('filters').innerHTML = html;
  document.getElementById('filterDrawerBody').innerHTML = html;
}

function renderToolbar() {
  // handled statically in HTML; just wire sort + count updates dynamically
}

function bindLayoutEvents() {
  [document.getElementById('filters'), document.getElementById('filterDrawerBody')].forEach((container) => {
    container.addEventListener('change', (e) => {
      if (e.target.name === 'category') { state.category = e.target.value; syncFilterUI(); }
      if (e.target.name === 'price') {
        if (!e.target.value) { state.minPrice = undefined; state.maxPrice = undefined; }
        else { const [min, max] = e.target.value.split('-').map(Number); state.minPrice = min; state.maxPrice = max; }
        syncFilterUI();
      }
      if (e.target.matches('[data-in-stock-only]')) { state.availability = e.target.checked ? 'in-stock' : ''; syncFilterUI(); }
      state.page = 1;
      runFilter();
    });
    container.addEventListener('click', (e) => {
      const sizeBtn = e.target.closest('[data-size]');
      const colorBtn = e.target.closest('[data-color]');
      if (sizeBtn) {
        const v = sizeBtn.dataset.size;
        state.sizes = state.sizes.includes(v) ? state.sizes.filter((s) => s !== v) : [...state.sizes, v];
        syncFilterUI();
        state.page = 1;
        runFilter();
      }
      if (colorBtn) {
        const v = colorBtn.dataset.color;
        state.colors = state.colors.includes(v) ? state.colors.filter((c) => c !== v) : [...state.colors, v];
        syncFilterUI();
        state.page = 1;
        runFilter();
      }
    });
  });

  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value; state.page = 1; runFilter();
  });

  document.getElementById('shopSearch').addEventListener('input', debounce((e) => {
    state.query = e.target.value; state.page = 1; runFilter();
  }, 250));

  document.getElementById('viewGrid').addEventListener('click', () => setView('grid'));
  document.getElementById('viewList').addEventListener('click', () => setView('list'));

  document.getElementById('loadMore').addEventListener('click', () => { state.page += 1; runFilter(true); });

  document.getElementById('openFilterDrawer').addEventListener('click', openFilterDrawer);
  document.getElementById('closeFilterDrawer').addEventListener('click', closeFilterDrawer);
  document.getElementById('filterDrawerScrim').addEventListener('click', closeFilterDrawer);
  document.getElementById('applyFilters').addEventListener('click', closeFilterDrawer);
  document.getElementById('clearFilters').addEventListener('click', () => {
    state.category = ''; state.colors = []; state.sizes = []; state.availability = '';
    state.minPrice = undefined; state.maxPrice = undefined; state.page = 1;
    document.querySelectorAll('input[name="price"]').forEach((input) => { input.checked = input.value === ''; });
    document.querySelectorAll('input[name="category"]').forEach((r) => { r.checked = r.value === ''; });
    document.querySelectorAll('[data-in-stock-only]').forEach((input) => { input.checked = false; });
    syncFilterUI();
    runFilter();
  });
}

function syncFilterUI() {
  document.querySelectorAll('[data-size]').forEach((btn) => { btn.dataset.active = String(state.sizes.includes(btn.dataset.size)); });
  document.querySelectorAll('[data-color]').forEach((btn) => { btn.dataset.active = String(state.colors.includes(btn.dataset.color)); });
  document.querySelectorAll('input[name="category"]').forEach((r) => { r.checked = r.value === state.category; });
  document.querySelectorAll('[data-in-stock-only]').forEach((input) => { input.checked = state.availability === 'in-stock'; });
  const selectedPrice = state.minPrice == null ? '' : `${state.minPrice}-${state.maxPrice}`;
  document.querySelectorAll('input[name="price"]').forEach((input) => { input.checked = input.value === selectedPrice; });
}

function setView(view) {
  state.view = view;
  document.getElementById('productResults').classList.toggle('product-grid--list', view === 'list');
  document.getElementById('viewGrid').setAttribute('aria-pressed', String(view === 'grid'));
  document.getElementById('viewList').setAttribute('aria-pressed', String(view === 'list'));
}

function initViewToggle() {
  document.getElementById('viewGrid').innerHTML = icon('gridView');
  document.getElementById('viewList').innerHTML = icon('listView');
}

let cache = [];
let activeRequest = 0;
async function runFilter(append = false) {
  const requestId = ++activeRequest;
  const resultsEl = document.getElementById('productResults');
  if (!append) {
    resultsEl.innerHTML = Array.from({ length: 8 }).map(() => '<div class="skeleton" style="aspect-ratio:4/5"></div>').join('');
  }
  try {
    cache = await fetchProducts({
      category: state.category || undefined,
      collection: state.collection || undefined,
      colors: state.colors.length ? state.colors : undefined,
      sizes: state.sizes.length ? state.sizes : undefined,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      availability: state.availability || undefined,
      badge: state.badge || undefined,
      query: state.query || undefined,
      sort: state.sort === 'featured' ? undefined : state.sort,
    });
  } catch (error) {
    if (LOCAL_DEVELOPMENT) cache = [...allProducts];
    else {
      if (requestId !== activeRequest) return;
      resultsEl.innerHTML = `<div class="state-block" style="grid-column:1/-1"><h3>Shop is temporarily unavailable</h3><p>We couldn't load the live catalog. Please try again shortly.</p><button class="btn btn-outline" id="retryCatalog">Try Again</button></div>`;
      document.getElementById('retryCatalog')?.addEventListener('click', () => runFilter());
      document.getElementById('resultCount').textContent = '—';
      document.getElementById('loadMoreWrap').hidden = true;
      return;
    }
  }

  // Ignore a delayed result if the shopper changed sort/filter while it loaded.
  if (requestId !== activeRequest) return;

  const visibleCount = state.page * state.perPage;
  const visible = cache.slice(0, visibleCount);
  const previousVisibleCount = append ? (state.page - 1) * state.perPage : 0;

  document.getElementById('resultCount').textContent = `${cache.length} Product${cache.length === 1 ? '' : 's'}`;

  if (cache.length === 0) {
    resultsEl.innerHTML = `
      <div class="state-block" style="grid-column:1/-1">
        <h3>No products match your filters</h3>
        <p>Try removing a filter or searching for something else.</p>
        <button class="btn btn-outline" id="resetFromEmpty">Clear Filters</button>
      </div>`;
    document.getElementById('resetFromEmpty')?.addEventListener('click', () => document.getElementById('clearFilters').click());
    document.getElementById('loadMoreWrap').hidden = true;
    return;
  }

  const cardsToRender = append ? visible.slice(previousVisibleCount) : visible;
  if (append) resultsEl.insertAdjacentHTML('beforeend', cardsToRender.map((product, index) => productCardHTML(product, previousVisibleCount + index)).join(''));
  else resultsEl.innerHTML = visible.map(productCardHTML).join('');
  bindProductCardEvents(resultsEl, { products: cache, onCartChange: refreshCartDrawer });
  document.getElementById('loadMoreWrap').hidden = visible.length >= cache.length;
}

function openFilterDrawer() {
  document.getElementById('filterDrawer').dataset.open = 'true';
  document.getElementById('filterDrawerScrim').dataset.open = 'true';
  document.body.style.overflow = 'hidden';
}
function closeFilterDrawer() {
  document.getElementById('filterDrawer').dataset.open = 'false';
  document.getElementById('filterDrawerScrim').dataset.open = 'false';
  document.body.style.overflow = '';
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initShop, { once: true });
} else {
  initShop();
}
