import { initAdminShell } from '../components/shell.js';
import { icon } from '../components/icons.js';
import { showAdminToast } from '../components/toast.js';
import { fetchAdminProduct, updateAdminProduct, createAdminProduct, uploadAdminProductImage } from '../services/productService.js';
import { fetchCategories, fetchCollections } from '../services/categoryService.js';

const session = initAdminShell({ page: 'products', title: 'Edit Product' });
if (session) init();

const params = new URLSearchParams(location.search);
const id = params.get('id');
const isNew = !id;

async function init() {
  let cats, cols, product;
  try {
    [cats, cols] = await Promise.all([fetchCategories(), fetchCollections()]);
    product = isNew ? blankProduct() : await fetchAdminProduct(id);
  } catch (error) {
    document.getElementById('editRoot').innerHTML = `<div class="admin-empty"><h3>Couldn't load the product form</h3><p>${esc(error.message)}</p><a href="products.html" class="btn btn-outline">Back to Products</a></div>`;
    return;
  }

  if (!product) {
    document.getElementById('editRoot').innerHTML = `<div class="admin-empty"><h3>Product not found</h3><a href="products.html" class="btn btn-primary">Back to Products</a></div>`;
    return;
  }

  document.title = `${isNew ? 'New Product' : product.name} — Nuvanti Admin`;
  document.getElementById('pageHeading').textContent = isNew ? 'New Product' : `Edit: ${product.name}`;

  renderForm(product, cats, cols);
}

function blankProduct() {
  return {
    id: null, name: '', slug: '', description: '', price: 0, compareAtPrice: null, cost: null,
    sku: '', category: '', collection: '', material: '', colors: [], sizes: [], images: [], colorImages: {},
    inventory: {}, badges: [], status: 'draft', featured: false, bestseller: false, newArrival: false,
    seoTitle: '', seoDescription: '',
  };
}

function renderForm(product, cats, cols) {
  document.getElementById('editRoot').innerHTML = `
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:1.25rem" class="pe-grid">
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>General</h2></div>
          <div class="card-pad">
            <div class="field"><label for="fName">Product Name</label><input id="fName" value="${esc(product.name)}" /></div>
            <div class="field"><label for="fSlug">Slug</label><input id="fSlug" value="${esc(product.slug)}" /></div>
            <div class="field"><label for="fDesc">Description</label><textarea id="fDesc" rows="4">${esc(product.description)}</textarea></div>
            <div class="field"><label for="fShort">Short Description</label><input id="fShort" placeholder="Shown in product cards / listings" /></div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Pricing</h2></div>
          <div class="card-pad">
            <div class="field-row3">
              <div class="field"><label for="fPrice">Price (EGP)</label><input type="text" inputmode="decimal" id="fPrice" value="${formatMoney(product.price)}" placeholder="12,345" /></div>
              <div class="field"><label for="fCompare">Compare-at Price</label><input type="text" inputmode="decimal" id="fCompare" value="${product.compareAtPrice == null ? '' : formatMoney(product.compareAtPrice)}" placeholder="12,345" /></div>
              <div class="field"><label for="fCost">Cost Price</label><input type="text" inputmode="decimal" id="fCost" value="${product.cost == null ? '' : formatMoney(product.cost)}" placeholder="12,345" /></div>
            </div>
            <small class="hint">Enter amounts up to 21,474,836.47 EGP. Thousands are grouped automatically, e.g. 12,345.</small>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Images</h2></div>
          <div class="card-pad">
            <div class="image-grid" id="imageGrid"></div>
            <p class="hint" style="margin-top:.75rem">Upload product photos to secure Cloudinary storage. The first image is the primary storefront image.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Photos by Color</h2></div>
          <div class="card-pad">
            <p class="hint" style="margin-bottom:.85rem">Add photos for each color. When a shopper selects that color, its photos appear in the product gallery. Colors without photos use the main Images gallery.</p>
            <div id="colorImageSets"></div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Variants</h2></div>
          <div class="table-wrap">
            <table class="admin-table variant-table">
              <thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock left</th></tr></thead>
              <tbody id="variantBody"></tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>SEO</h2></div>
          <div class="card-pad">
            <div class="field"><label for="fSeoTitle">SEO Title</label><input id="fSeoTitle" value="${esc(product.seoTitle || product.name)}" /></div>
            <div class="field"><label for="fSeoDesc">SEO Description</label><textarea id="fSeoDesc" rows="2">${esc(product.seoDescription || product.description?.slice(0, 140) || '')}</textarea></div>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Status</h2></div>
          <div class="card-pad">
            <div class="field"><label for="fStatus">Visibility</label>
              <select id="fStatus">
                <option value="draft" ${product.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="active" ${product.status === 'active' ? 'selected' : ''}>Published</option>
              </select>
            </div>
            <label class="checkbox-row" style="margin-bottom:.6rem"><input type="checkbox" id="fFeatured" ${product.featured ? 'checked' : ''}/> Featured</label><br/>
            <label class="checkbox-row" style="margin-bottom:.6rem"><input type="checkbox" id="fBestseller" ${product.bestseller ? 'checked' : ''}/> Bestseller</label><br/>
            <label class="checkbox-row"><input type="checkbox" id="fNewArrival" ${product.newArrival ? 'checked' : ''}/> New Arrival</label>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Organization</h2></div>
          <div class="card-pad">
            <div class="field"><label for="fSku">SKU</label><input id="fSku" class="mono" value="${esc(product.sku)}" /></div>
            <div class="field"><label for="fCategory">Category</label>
              <select id="fCategory">${cats.map((c) => `<option value="${c.slug}" ${c.slug === product.category ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            </div>
            <div class="field"><label for="fCollection">Collection</label>
              <select id="fCollection">
                <option value="">None</option>
                ${cols.map((c) => `<option value="${c.slug}" ${c.slug === product.collection ? 'selected' : ''}>${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label for="fMaterial">Material</label><input id="fMaterial" value="${esc(product.material || '')}" /></div>
            <div class="field"><label for="fColors">Colors</label><input id="fColors" value="${esc((product.colors || []).join(', '))}" placeholder="Black, White" /><small class="hint">Separate colors with commas.</small></div>
            <div id="colorPalette" class="field"></div>
            <div class="field"><label for="fSizes">Sizes</label><input id="fSizes" value="${esc((product.sizes || []).join(', '))}" placeholder="S, M, L, XL" /><small class="hint">Separate sizes with commas; stock is tracked per size.</small></div>
          </div>
        </div>

        <button class="btn btn-primary" id="saveBtn" style="width:100%;margin-bottom:.6rem">${isNew ? 'Create Product' : 'Save Changes'}</button>
        <a href="products.html" class="btn btn-outline" style="width:100%;text-align:center;display:block">Cancel</a>
      </div>
    </div>
  `;

  renderImages(product.images || []);
  renderVariants(product);
  const colorSwatches = { ...(product.colorSwatches || {}) };
  const colorImages = Object.fromEntries(Object.entries(product.colorImages || {}).map(([color, images]) => [color, Array.isArray(images) ? [...images] : []]));
  renderColorPalette(splitList(val('fColors')), colorSwatches);
  renderColorImageSets(splitList(val('fColors')), colorImages);

  for (const field of ['fPrice', 'fCompare', 'fCost']) {
    const input = document.getElementById(field);
    input.addEventListener('focus', () => { input.value = input.value.replace(/,/g, ''); });
    input.addEventListener('blur', () => { if (input.value.trim()) input.value = formatMoney(parseMoney(input.value)); });
    input.addEventListener('input', () => {
      const cleaned = input.value.replace(/[^\d.]/g, '');
      const [whole, ...fraction] = cleaned.split('.');
      input.value = whole + (fraction.length ? `.${fraction.join('').slice(0, 2)}` : '');
    });
  }

  let slugEdited = Boolean(product.slug);
  document.getElementById('fSlug').addEventListener('input', () => { slugEdited = true; });
  document.getElementById('fName').addEventListener('input', (event) => {
    if (!slugEdited) document.getElementById('fSlug').value = makeSlug(event.target.value);
  });
  for (const field of ['fColors', 'fSizes']) {
    document.getElementById(field).addEventListener('input', () => {
      const stock = { ...(product.inventory || {}) };
      document.querySelectorAll('[data-stock-size]').forEach((input) => { stock[input.dataset.stockSize] = Math.max(0, Number(input.value) || 0); });
      const colors = splitList(val('fColors'));
      renderVariants({ ...product, colors, sizes: splitList(val('fSizes')), inventory: stock });
      renderColorPalette(colors, colorSwatches);
      renderColorImageSets(colors, colorImages);
    });
  }

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const button = document.getElementById('saveBtn');
    const name = val('fName').trim();
    const slug = makeSlug(val('fSlug') || name);
    const category = val('fCategory');
    if (name.length < 2) return showAdminToast('Enter a product name with at least 2 characters.', 'error');
    if (!slug) return showAdminToast('Enter a product name so a product URL can be created.', 'error');
    if (!category) return showAdminToast('Create a category before adding products.', 'error');
    const price = parseMoney(val('fPrice'));
    const compareAt = val('fCompare') ? parseMoney(val('fCompare')) : null;
    const cost = val('fCost') ? parseMoney(val('fCost')) : null;
    if (!Number.isFinite(price) || price < 0 || price > 21474836.47) return showAdminToast('Price must be between 0 and 21,474,836.47 EGP.', 'error');
    if (compareAt !== null && (!Number.isFinite(compareAt) || compareAt < 0 || compareAt > 21474836.47)) return showAdminToast('Compare-at price must be between 0 and 21,474,836.47 EGP.', 'error');
    if (cost !== null && (!Number.isFinite(cost) || cost < 0 || cost > 21474836.47)) return showAdminToast('Cost price must be between 0 and 21,474,836.47 EGP.', 'error');
    const colors = splitList(val('fColors'));
    const sizes = splitList(val('fSizes'));
    const stockProduct = { ...product, colors, sizes };
    const patch = {
      name, slug, description: val('fDesc'),
      price, compareAtPrice: compareAt,
      cost, sku: val('fSku').trim(), category, collection: val('fCollection'),
      material: val('fMaterial'), status: val('fStatus'),
      featured: document.getElementById('fFeatured').checked,
      bestseller: document.getElementById('fBestseller').checked,
      newArrival: document.getElementById('fNewArrival').checked,
      seoTitle: val('fSeoTitle'), seoDescription: val('fSeoDesc'),
      images: product.images || [],
      colors,
      colorImages: Object.fromEntries(colors.filter((color) => colorImages[color]?.length).map((color) => [color, colorImages[color]])),
      colorSwatches: Object.fromEntries(colors.map((color) => [color, validHex(colorSwatches[color]) || defaultColorHex(color)])),
      sizes,
      inventory: readInventory(stockProduct),
    };
    button.disabled = true;
    button.textContent = isNew ? 'Creating…' : 'Saving…';
    try {
      if (isNew) await createAdminProduct(patch);
      else await updateAdminProduct(product.id, patch);
      showAdminToast(isNew ? 'Product created.' : 'Product saved — live in the store now.', 'success');
      setTimeout(() => { location.href = 'products.html'; }, 500);
    } catch (error) {
      showAdminToast(error.message || 'Could not save this product.', 'error');
      button.disabled = false;
      button.textContent = isNew ? 'Create Product' : 'Save Changes';
    }
  });
}

function renderColorImageSets(colors, colorImages) {
  const root = document.getElementById('colorImageSets');
  if (!colors.length) {
    root.innerHTML = '<small class="hint">Add color names above to create a photo set for each color.</small>';
    return;
  }
  root.innerHTML = colors.map((color, index) => {
    const images = colorImages[color] || [];
    return `<section style="padding:.75rem 0;border-bottom:1px solid var(--a-border,#e4e7ec)">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;margin-bottom:.6rem"><strong>${esc(color)}</strong><button class="btn btn-outline btn-sm" type="button" data-upload-color="${index}" ${images.length >= 12 ? 'disabled' : ''}>${icon('upload')} Add photos (${images.length}/12)</button></div>
      <div style="display:flex;gap:.5rem;overflow-x:auto">${images.map((img, imageIndex) => `<div style="position:relative;flex:0 0 76px;height:96px"><img src="${esc(imageSrc(img))}" alt="${esc(color)} product photo" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:6px" /><button type="button" data-remove-color-image="${index}" data-image-index="${imageIndex}" aria-label="Remove ${esc(color)} photo ${imageIndex + 1}" style="position:absolute;top:3px;right:3px">${icon('x')}</button></div>`).join('')}</div>
      ${images.length ? '' : '<small class="hint">No color-specific photos yet; the main gallery will be used.</small>'}
    </section>`;
  }).join('');

  root.querySelectorAll('[data-upload-color]').forEach((button) => button.addEventListener('click', () => {
    const color = colors[Number(button.dataset.uploadColor)];
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp,image/gif'; input.multiple = true;
    input.addEventListener('change', async () => {
      const files = [...(input.files || [])];
      if (!files.length) return;
      const remaining = 12 - (colorImages[color] || []).length;
      if (files.length > remaining) showAdminToast(`You can add ${remaining} more photo${remaining === 1 ? '' : 's'} for ${color}.`, 'error');
      for (const file of files.slice(0, remaining)) {
        try {
          showAdminToast(`Uploading ${color} photo…`, 'info');
          const image = await uploadAdminProductImage(file);
          colorImages[color] = [...(colorImages[color] || []), image.url];
        } catch (error) { showAdminToast(error.message || `Could not upload the ${color} photo.`, 'error'); break; }
      }
      renderColorImageSets(colors, colorImages);
      if (colorImages[color]?.length) showAdminToast(`${color} photos uploaded. Save the product to publish them.`, 'success');
    });
    input.click();
  }));
  root.querySelectorAll('[data-remove-color-image]').forEach((button) => button.addEventListener('click', () => {
    const color = colors[Number(button.dataset.removeColorImage)];
    colorImages[color]?.splice(Number(button.dataset.imageIndex), 1);
    renderColorImageSets(colors, colorImages);
  }));
}

function readInventory(product) {
  const inventory = {};
  (product.sizes || []).forEach((size) => {
    const input = document.querySelector(`[data-stock-size="${cssEscape(size)}"]`);
    inventory[size] = input ? Math.max(0, Number(input.value) || 0) : (product.inventory?.[size] ?? 0);
  });
  return inventory;
}

function cssEscape(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`);
}

function renderImages(images) {
  const el = document.getElementById('imageGrid');
  el.innerHTML = images.map((img, i) => `
    <div class="image-tile" data-primary="${i === 0}">
      ${i === 0 ? '<span class="image-tile__primary">Primary</span>' : ''}
      <img src="${esc(imageSrc(img))}" alt="" />
      <button class="image-tile__remove" data-remove-image="${i}" aria-label="Remove image">${icon('x')}</button>
    </div>
  `).join('') + `<button class="image-tile-add" id="addImageBtn">${icon('upload')}<span>Upload</span></button>`;

  document.getElementById('addImageBtn').addEventListener('click', () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp,image/gif';
    input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file) return;
      try { showAdminToast('Uploading image…', 'info'); const image = await uploadAdminProductImage(file); images.push(image.url); renderImages(images); showAdminToast('Image uploaded. Save the product to publish it.', 'success'); }
      catch (error) { showAdminToast(error.message, 'error'); }
    });
    input.click();
  });
  el.querySelectorAll('[data-remove-image]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    images.splice(Number(btn.dataset.removeImage), 1);
    renderImages(images);
  }));
}

function renderVariants(product) {
  const rows = [];
  (product.colors || []).forEach((color) => {
    (product.sizes || []).forEach((size) => {
      rows.push({ color, size, stock: product.inventory?.[size] ?? 0, sku: `${product.sku || 'NV'}-${color.slice(0, 3).toUpperCase()}-${size}` });
    });
  });
  document.getElementById('variantBody').innerHTML = rows.length ? rows.map((r) => `
    <tr>
      <td>${r.color}</td><td>${r.size}</td>
      <td class="mono">${r.sku}</td>
      <td><div class="variant-stock-control"><input class="variant-stock-input" type="number" min="0" step="1" value="${Math.max(0, Number(r.stock) || 0)}" data-stock-size="${esc(r.size)}" aria-label="Available stock in size ${esc(r.size)}" /><span class="variant-stock-count variant-stock-count--${stockState(r.stock)}" data-stock-label="${esc(r.size)}">${stockLabel(r.stock)}</span></div></td>
    </tr>
  `).join('') + `<tr><td colspan="4" class="variant-stock-note">Stock is tracked per size and shared across colors. Updating a size changes the count shown for every color in that size.</td></tr>`
    : `<tr><td colspan="4" style="color:var(--a-muted)">No variants yet — add colors and sizes to generate variant rows.</td></tr>`;

  // Stock is stored per size (not per color), so keep every row for the
  // same size in sync as the admin types.
  document.getElementById('variantBody').querySelectorAll('[data-stock-size]').forEach((input) => {
    input.addEventListener('input', () => {
      const size = input.dataset.stockSize;
      document.querySelectorAll(`[data-stock-size="${cssEscape(size)}"]`).forEach((other) => {
        if (other !== input) other.value = input.value;
      });
      const stock = Math.max(0, Number(input.value) || 0);
      document.querySelectorAll(`[data-stock-label="${cssEscape(size)}"]`).forEach((label) => {
        label.textContent = stockLabel(stock);
        label.className = `variant-stock-count variant-stock-count--${stockState(stock)}`;
      });
    });
  });
}

function stockState(value) {
  const stock = Math.max(0, Number(value) || 0);
  return stock === 0 ? 'out' : stock <= 4 ? 'low' : 'in';
}

function stockLabel(value) {
  const stock = Math.max(0, Number(value) || 0);
  return `${stock} ${stock === 1 ? 'piece' : 'pieces'} left`;
}

function renderColorPalette(colors, swatches) {
  const root = document.getElementById('colorPalette');
  if (!colors.length) {
    root.innerHTML = '<small class="hint">Add color names above to choose their swatch colors.</small>';
    return;
  }
  root.innerHTML = `<label>Color palette</label><div style="display:grid;gap:.5rem;margin-top:.35rem">${colors.map((color, index) => {
    const hex = validHex(swatches[color]) || defaultColorHex(color);
    return `<div style="display:flex;align-items:center;gap:.6rem"><input type="color" value="${hex}" data-palette-index="${index}" aria-label="Choose ${esc(color)} swatch color" style="width:42px;height:36px;padding:3px" /><span>${esc(color)}</span><code>${hex.toUpperCase()}</code></div>`;
  }).join('')}</div><small class="hint">Pick the swatch color customers will see for each option.</small>`;
  root.querySelectorAll('[data-palette-index]').forEach((input) => input.addEventListener('input', () => {
    const color = colors[Number(input.dataset.paletteIndex)];
    swatches[color] = input.value;
    input.nextElementSibling.nextElementSibling.textContent = input.value.toUpperCase();
  }));
}

function defaultColorHex(color) {
  const known = { black: '#121114', grey: '#9A9690', gray: '#9A9690', olive: '#5B5A42', navy: '#232B3B', 'off-white': '#EFEBE2', white: '#FFFFFF', red: '#D62828', blue: '#246BCE', green: '#2D8A52', beige: '#D9C8A9', brown: '#795548', pink: '#E98AB8' };
  return known[color.toLowerCase()] || '#808080';
}
function validHex(value) { return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null; }

function val(id) { return document.getElementById(id).value; }
function imageSrc(url) { return /^https?:\/\//i.test(url) ? url : `/store-assets/${String(url).replace(/^assets\//, '')}`; }
function splitList(value) { return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]; }
function makeSlug(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 160); }
function parseMoney(value) { const normalized = String(value ?? '').replace(/,/g, '').trim(); return normalized ? Number(normalized) : NaN; }
function formatMoney(value) { const amount = Number(value); return Number.isFinite(amount) ? amount.toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''; }
function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
