import { initAdminShell } from '../components/shell.js';
import { icon } from '../components/icons.js';
import { showAdminToast } from '../components/toast.js';
import { fetchAdminProduct, updateAdminProduct, createAdminProduct } from '../services/productService.js';
import { fetchCategories, fetchCollections } from '../services/categoryService.js';

const session = initAdminShell({ page: 'products', title: 'Edit Product' });
if (session) init();

const params = new URLSearchParams(location.search);
const id = params.get('id');
const isNew = !id;

async function init() {
  const cats = await fetchCategories();
  const cols = await fetchCollections();
  const product = isNew ? blankProduct() : await fetchAdminProduct(id);

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
    id: null, name: '', slug: '', description: '', price: 0, compareAtPrice: null, cost: 0,
    sku: '', category: '', collection: '', material: '', colors: [], sizes: [], images: [],
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
              <div class="field"><label for="fPrice">Price (EGP)</label><input type="number" id="fPrice" value="${product.price}" /></div>
              <div class="field"><label for="fCompare">Compare-at Price</label><input type="number" id="fCompare" value="${product.compareAtPrice ?? ''}" /></div>
              <div class="field"><label for="fCost">Cost Price</label><input type="number" id="fCost" value="${product.cost ?? ''}" /></div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Images</h2></div>
          <div class="card-pad">
            <div class="image-grid" id="imageGrid"></div>
            <p class="hint" style="margin-top:.75rem">Click a tile to set it as the primary image. Upload wiring will connect to real storage once the backend exists.</p>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Variants</h2></div>
          <div class="table-wrap">
            <table class="admin-table variant-table">
              <thead><tr><th>Color</th><th>Size</th><th>SKU</th><th>Stock</th></tr></thead>
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
                <option value="archived" ${product.status === 'archived' ? 'selected' : ''}>Archived</option>
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
          </div>
        </div>

        <button class="btn btn-primary" id="saveBtn" style="width:100%;margin-bottom:.6rem">${isNew ? 'Create Product' : 'Save Changes'}</button>
        <a href="products.html" class="btn btn-outline" style="width:100%;text-align:center;display:block">Cancel</a>
      </div>
    </div>
  `;

  renderImages(product.images || []);
  renderVariants(product);

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const patch = {
      name: val('fName'), slug: val('fSlug'), description: val('fDesc'),
      price: Number(val('fPrice')) || 0, compareAtPrice: val('fCompare') ? Number(val('fCompare')) : null,
      cost: Number(val('fCost')) || 0, sku: val('fSku'), category: val('fCategory'), collection: val('fCollection'),
      material: val('fMaterial'), status: val('fStatus'),
      featured: document.getElementById('fFeatured').checked,
      bestseller: document.getElementById('fBestseller').checked,
      newArrival: document.getElementById('fNewArrival').checked,
      seoTitle: val('fSeoTitle'), seoDescription: val('fSeoDesc'),
      images: product.images || [],
      colors: product.colors || [],
      sizes: product.sizes || [],
      inventory: readInventory(product),
    };
    if (isNew) {
      await createAdminProduct(patch);
    } else {
      await updateAdminProduct(product.id, patch);
    }
    showAdminToast(isNew ? 'Product created.' : 'Product saved — live in the store now.', 'success');
    setTimeout(() => { location.href = 'products.html'; }, 500);
  });
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
      <img src="../${img}" alt="" />
      <button class="image-tile__remove" data-remove-image="${i}" aria-label="Remove image">${icon('x')}</button>
    </div>
  `).join('') + `<button class="image-tile-add" id="addImageBtn">${icon('upload')}<span>Upload</span></button>`;

  document.getElementById('addImageBtn').addEventListener('click', () => {
    showAdminToast('Image upload connects once storage is wired to the backend.', 'info');
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
      <td><input type="number" min="0" value="${r.stock}" data-stock-size="${esc(r.size)}" style="width:80px" /></td>
    </tr>
  `).join('') + `<tr><td colspan="3" style="color:var(--a-muted)">Stock is tracked per size — editing one color's row updates that size for all colors.</td></tr>`
    : `<tr><td colspan="4" style="color:var(--a-muted)">No variants yet — add colors and sizes to generate variant rows.</td></tr>`;

  // Stock is stored per size (not per color), so keep every row for the
  // same size in sync as the admin types.
  document.getElementById('variantBody').querySelectorAll('[data-stock-size]').forEach((input) => {
    input.addEventListener('input', () => {
      const size = input.dataset.stockSize;
      document.querySelectorAll(`[data-stock-size="${cssEscape(size)}"]`).forEach((other) => {
        if (other !== input) other.value = input.value;
      });
    });
  });
}

function val(id) { return document.getElementById(id).value; }
function esc(s) { return (s || '').replace(/"/g, '&quot;'); }
