import { initAdminShell } from '../components/shell.js';
import { statusBadge } from '../components/statusBadge.js';
import { icon } from '../components/icons.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { createAdminModal } from '../components/modal.js';
import { escapeHtml, storeAssetSrc } from '../components/utils.js';
import {
  fetchCategories, toggleCategoryStatus, deleteCategory, createCategory, editCategory, uploadCategoryImage,
  fetchCollections, toggleCollectionStatus, deleteCollection, createCollection, editCollection,
  syncCollectionProducts,
} from '../services/categoryService.js';
import { startLiveRefresh } from '../services/liveRefresh.js';
import { fetchAdminProducts } from '../services/productService.js';

const params = new URLSearchParams(location.search);
let tab = params.get('tab') === 'collections' ? 'collections' : 'categories';

// Matches the backend's slug validation (^[a-z0-9-]+$): lowercase, strip
// anything that isn't a letter/number, collapse separators to single dashes.
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const session = initAdminShell({ page: 'categories', title: 'Categories & Collections' });
if (session) init();

function init() {
  renderTabs();
  document.getElementById('newBtn').addEventListener('click', () => (tab === 'categories' ? openCategoryEditor() : openCollectionEditor()));
  render();
  startLiveRefresh(render, 15000, { pauseWhileEditing: true });
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = `
    <button class="admin-tab" data-tab="categories" role="tab" aria-selected="${tab === 'categories'}">Categories</button>
    <button class="admin-tab" data-tab="collections" role="tab" aria-selected="${tab === 'collections'}">Collections</button>
  `;
  document.querySelectorAll('.admin-tab').forEach((t) => t.addEventListener('click', () => {
    tab = t.dataset.tab;
    history.replaceState(null, '', `catalog.html?tab=${tab}`);
    renderTabs();
    render();
  }));
}

async function render() {
  document.getElementById('newBtn').textContent = tab === 'categories' ? '+ New Category' : '+ New Collection';
  const body = document.getElementById('tableBody');
  const headRow = document.getElementById('headRow');

  try {
    await renderTable(body, headRow);
  } catch (error) {
    body.innerHTML = `<tr><td colspan="${tab === 'categories' ? 6 : 5}"><div class="admin-empty"><h3>Couldn't load this data</h3><p>${escapeHtml(error.message)}</p></div></td></tr>`;
  }
}

async function renderTable(body, headRow) {
  if (tab === 'categories') {
    headRow.innerHTML = '<th>Cover</th><th>Name</th><th>Slug</th><th>Products</th><th>Status</th><th></th>';
    const cats = await fetchCategories();
    body.innerHTML = cats.map((c) => `
      <tr>
        <td>${c.imageUrl ? `<img src="${escapeHtml(storeAssetSrc(c.imageUrl))}" alt="" width="48" height="48" style="object-fit:cover;border-radius:6px" />` : '<span style="color:var(--a-muted)">No cover</span>'}</td>
        <td style="font-weight:600">${escapeHtml(c.name)}</td>
        <td class="mono">${escapeHtml(c.slug)}</td>
        <td>${c.productCount}</td>
        <td>${statusBadge(c.status === 'active' ? 'active' : 'disabled')}</td>
        <td style="text-align:right">
          <button class="btn btn-outline btn-sm" data-edit="${escapeHtml(c.id)}">Edit</button>
          <button class="btn btn-outline btn-sm" data-toggle="${c.id}">${c.status === 'active' ? 'Disable' : 'Enable'}</button>
          <button class="icon-btn" data-delete="${c.id}" aria-label="Delete">${icon('trash')}</button>
        </td>
      </tr>`).join('');
    bindRows('category');
  } else {
    headRow.innerHTML = '<th>Name</th><th>Slug</th><th>Products</th><th>Status</th><th></th>';
    const cols = await fetchCollections();
    body.innerHTML = cols.map((c) => `
      <tr>
        <td style="font-weight:600">${escapeHtml(c.name)}</td>
        <td class="mono">${escapeHtml(c.slug)}</td>
        <td>${c.productCount}</td>
        <td>${statusBadge(c.status)}</td>
        <td style="text-align:right">
          <button class="btn btn-outline btn-sm" data-edit-collection="${escapeHtml(c.id)}">Edit</button>
          <button class="btn btn-outline btn-sm" data-toggle="${c.id}">${c.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button class="icon-btn" data-delete="${c.id}" aria-label="Delete">${icon('trash')}</button>
        </td>
      </tr>`).join('');
    bindRows('collection');
  }
}

function bindRows(kind) {
  if (kind === 'category') document.querySelectorAll('[data-edit]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      const category = (await fetchCategories()).find((item) => item.id === btn.dataset.edit);
      if (!category) return showAdminToast('Category not found. Refresh the page and try again.', 'error');
      openCategoryEditor(category);
    } catch (error) { showAdminToast(error.message, 'error'); }
  }));
  if (kind === 'collection') document.querySelectorAll('[data-edit-collection]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      const collection = (await fetchCollections()).find((item) => item.id === btn.dataset.editCollection);
      if (!collection) return showAdminToast('Collection not found. Refresh the page and try again.', 'error');
      openCollectionEditor(collection);
    } catch (error) { showAdminToast(error.message, 'error'); }
  }));
  document.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
    try {
      kind === 'category' ? await toggleCategoryStatus(btn.dataset.toggle) : await toggleCollectionStatus(btn.dataset.toggle);
      render();
    } catch (error) { showAdminToast(error.message, 'error'); }
  }));
  document.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `Delete this ${kind}?`, body: 'Products will remain, but this grouping will be removed from the storefront.', confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      kind === 'category' ? await deleteCategory(btn.dataset.delete) : await deleteCollection(btn.dataset.delete);
      showAdminToast(`${kind === 'category' ? 'Category' : 'Collection'} deleted.`, 'success');
      render();
    } catch (error) { showAdminToast(error.message, 'error'); }
  }));
}

function openCategoryEditor(category = null) {
  const editing = Boolean(category);
  const modal = createAdminModal({
    title: editing ? 'Edit Category' : 'New Category',
    bodyHTML: `
      <div class="field"><label for="mName">Name</label><input id="mName" maxlength="80" value="${escapeHtml(category?.name || '')}" /></div>
      <div class="field"><label for="mSlug">Slug</label><input id="mSlug" maxlength="80" value="${escapeHtml(category?.slug || '')}" ${editing ? 'readonly' : ''} /></div>
      <div class="field"><label for="mDesc">Description</label><textarea id="mDesc" rows="3" maxlength="1000">${escapeHtml(category?.description || '')}</textarea></div>
      <div class="field"><label for="mCoverFile">Cover photo</label><input id="mCoverFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-describedby="mUploadHint mUploadStatus" /><span class="hint" id="mUploadHint">JPEG, PNG, WebP, or GIF up to 5 MB. Uploaded securely to Cloudinary.</span><span class="hint" id="mUploadStatus" role="status" aria-live="polite"></span></div>
      <div class="field"><label for="mImageUrl">Image URL</label><input id="mImageUrl" type="url" maxlength="1000" placeholder="Upload a cover or paste an HTTPS image URL" value="${escapeHtml(category?.imageUrl || '')}" /></div>
      <span id="mPreviewStatus" class="hint" role="status" hidden>Image preview could not be loaded. Check the image URL or upload a new image.</span><img id="mCoverPreview" src="${category?.imageUrl ? escapeHtml(storeAssetSrc(category.imageUrl)) : ''}" alt="Cover preview" ${category?.imageUrl ? '' : 'hidden'} style="max-width:100%;max-height:220px;object-fit:cover;border-radius:8px" />
      ${menuAppearanceFields(category)}
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">${editing ? 'Save Changes' : 'Create Category'}</button>`,
  });
  bindMenuAppearancePreview(modal.root);
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  const imageUrl = modal.root.querySelector('#mImageUrl');
  const preview = modal.root.querySelector('#mCoverPreview');
  const fileInput = modal.root.querySelector('#mCoverFile');
  const saveButton = modal.root.querySelector('#mSave');
  const initialSaveLabel = saveButton.textContent;
  const uploadStatus = modal.root.querySelector('#mUploadStatus');
  const previewStatus = modal.root.querySelector('#mPreviewStatus');
  let uploading = false;
  const previewImage = (url) => {
    const value = url.trim();
    previewStatus.hidden = true;
    preview.hidden = !value;
    preview.src = value ? storeAssetSrc(value) : '';
  };
  preview.addEventListener('error', () => { preview.hidden = true; previewStatus.hidden = false; });
  preview.addEventListener('load', () => { previewStatus.hidden = true; });
  imageUrl.addEventListener('input', () => previewImage(imageUrl.value));
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      fileInput.value = '';
      uploadStatus.textContent = 'Choose a JPEG, PNG, WebP, or GIF image up to 5 MB.';
      return;
    }
    uploading = true;
    saveButton.disabled = true;
    fileInput.disabled = true;
    imageUrl.disabled = true;
    uploadStatus.textContent = 'Preparing image…';
    try {
      const uploaded = await uploadCategoryImage(file, { onProgress: ({ phase, percent }) => {
        uploadStatus.textContent = phase === 'optimizing' ? 'Optimizing image for a faster upload…' : `Uploading image securely to Cloudinary… ${percent}%`;
      } });
      imageUrl.value = uploaded.url;
      previewImage(uploaded.url);
      uploadStatus.textContent = 'Upload complete. Save Changes to publish this cover.';
      showAdminToast('Category cover uploaded. Save the category to publish it.', 'success');
    } catch (error) {
      uploadStatus.textContent = `${error.message} You can retry the upload or paste an HTTPS image URL.`;
      showAdminToast(error.message, 'error');
    } finally {
      uploading = false;
      fileInput.disabled = false;
      imageUrl.disabled = false;
      saveButton.disabled = false;
    }
  });
  saveButton.addEventListener('click', async () => {
    if (uploading) return showAdminToast('Wait for the cover upload to finish.', 'info');
    const name = modal.root.querySelector('#mName').value.trim();
    if (name.length < 2) return showAdminToast('Category name must have at least 2 characters.', 'error');
    const rawSlug = modal.root.querySelector('#mSlug').value.trim();
    const slug = slugify(rawSlug || name);
    if (!slug) return showAdminToast('Enter a name or slug using letters and numbers.', 'error');
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    try {
      const data = { name, slug, description: modal.root.querySelector('#mDesc').value.trim(), imageUrl: imageUrl.value.trim() || null, ...readMenuAppearance(modal.root) };
      if (editing) await editCategory(category.id, data);
      else await createCategory(data);
      modal.close();
      showAdminToast(editing ? 'Category updated.' : 'Category created.', 'success');
      render();
    } catch (error) {
      saveButton.disabled = false;
      saveButton.textContent = initialSaveLabel;
      showAdminToast(error.message, 'error');
    }
  });
  modal.open();
}

async function openCollectionEditor(collection = null) {
  const editing = Boolean(collection);
  let products;
  try {
    const result = await fetchAdminProducts({ perPage: 1000000 });
    products = result.items;
  } catch (error) {
    showAdminToast(`Could not load products for this collection: ${error.message}`, 'error');
    return;
  }
  const initiallyAssigned = new Set(products.filter((product) => product.collection === collection?.slug).map((product) => String(product.id)));
  const modal = createAdminModal({
    title: editing ? 'Edit Collection' : 'New Collection',
    bodyHTML: `
      <div class="field"><label for="mName">Name</label><input id="mName" maxlength="80" value="${escapeHtml(collection?.name || '')}" /></div>
      <div class="field"><label for="mSlug">Slug</label><input id="mSlug" maxlength="80" value="${escapeHtml(collection?.slug || '')}" ${editing ? 'readonly' : ''} /></div>
      ${menuAppearanceFields(collection)}
      <fieldset style="border:1px solid var(--a-border);border-radius:10px;padding:1rem;margin:1rem 0">
        <legend style="padding:0 .35rem;font-weight:600">Products in this collection</legend>
        <p class="hint">Select as many products as you want. Selected products will appear on this collection’s shop page. A product can belong to one collection at a time.</p>
        <div class="field"><label for="mProductSearch">Find products</label><input id="mProductSearch" type="search" placeholder="Search by product name" /></div>
        <div id="mProductCount" class="hint" aria-live="polite"></div>
        <div id="mCollectionProducts" style="max-height:260px;overflow:auto;border:1px solid var(--a-border);border-radius:8px;padding:.4rem .75rem">
          ${products.map((product) => `<label data-collection-product-row data-search-name="${escapeHtml(product.name.toLowerCase())}" style="display:flex;align-items:center;gap:.65rem;padding:.65rem 0;border-bottom:1px solid var(--a-border)"><input type="checkbox" data-collection-product="${escapeHtml(product.id)}" ${initiallyAssigned.has(String(product.id)) ? 'checked' : ''} /><span>${escapeHtml(product.name)}</span><small class="hint" style="margin-left:auto">${product.status === 'active' ? 'Published' : 'Draft'}</small></label>`).join('') || '<p class="hint">No products yet. Create products first, then add them here.</p>'}
        </div>
      </fieldset>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">${editing ? 'Save Changes' : 'Create'}</button>`,
  });
  bindMenuAppearancePreview(modal.root);
  const updateProductCount = () => {
    const selectedCount = modal.root.querySelectorAll('[data-collection-product]:checked').length;
    modal.root.querySelector('#mProductCount').textContent = `${selectedCount} product${selectedCount === 1 ? '' : 's'} selected`;
  };
  modal.root.querySelector('#mProductSearch').addEventListener('input', (event) => {
    const search = event.target.value.trim().toLowerCase();
    modal.root.querySelectorAll('[data-collection-product-row]').forEach((row) => {
      row.hidden = search && !row.dataset.searchName.includes(search);
    });
  });
  modal.root.querySelector('#mCollectionProducts').addEventListener('change', updateProductCount);
  updateProductCount();
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  const saveButton = modal.root.querySelector('#mSave');
  const initialSaveLabel = saveButton.textContent;
  saveButton.addEventListener('click', async () => {
    const name = modal.root.querySelector('#mName').value.trim();
    if (name.length < 2) return showAdminToast('Collection name must have at least 2 characters.', 'error');
    const rawSlug = modal.root.querySelector('#mSlug').value.trim();
    const slug = slugify(rawSlug || name);
    if (!slug) return showAdminToast('Enter a name or slug using letters and numbers.', 'error');
    if (saveButton.disabled) return;
    saveButton.disabled = true;
    saveButton.textContent = 'Saving…';
    try {
      const data = { name, slug, ...readMenuAppearance(modal.root) };
      let savedCollection;
      if (editing) savedCollection = await editCollection(collection.id, data);
      else savedCollection = await createCollection(data);
      const selectedIds = [...modal.root.querySelectorAll('[data-collection-product]:checked')].map((input) => input.dataset.collectionProduct);
      await syncCollectionProducts(savedCollection.id, selectedIds);
      modal.close();
      showAdminToast(`${editing ? 'Collection updated' : 'Collection created'}; ${selectedIds.length} product${selectedIds.length === 1 ? '' : 's'} assigned.`, 'success');
      render();
    } catch (error) {
      saveButton.disabled = false;
      saveButton.textContent = initialSaveLabel;
      showAdminToast(error.message, 'error');
    }
  });
  modal.open();
}

function menuAppearanceFields(item = null) {
  const profile = (device) => {
    const saved = item?.[device === 'desktop' ? 'menuDesktopAppearance' : 'menuMobileAppearance'] || {};
    const fallback = { style: item?.menuStyle || 'pill', shape: 'design', fill: true, backgroundColor: item?.menuBackgroundColor || '#35604a', backgroundEndColor: item?.menuBackgroundEndColor || '', gradientDirection: '110deg', textColor: item?.menuTextColor || '#ffffff', icon: item?.menuIcon || 'none', iconPosition: 'left', animation: item?.menuAnimation || 'none' };
    const value = { ...fallback, ...saved };
    const id = (field) => `mMenu-${device}-${field}`;
    const styles = [['link','Simple link'],['pill','Classic pill'],['card','Featured card'],['outline','Outlined'],['soft','Soft color'],['glass','Frosted glass'],['gradient','Gradient blend'],['elevated','Raised button'],['glow','Glow edge'],['cut','Cut corner'],['underline','Underline'],['double','Double border'],['sticker','Sticker'],['gradient-outline','Gradient outline'],['neon','Neon edge'],['dashed','Dashed outline'],['tag','Tag'],['corner','Folded corner'],['inset','Inset'],['bevel','Bevel'],['bubble','Bubble'],['ribbon','Ribbon'],['hollow','Hollow'],['gloss','Gloss'],['aurora','Aurora glass'],['frost','Ice crystal'],['chrome','Liquid chrome'],['rainbow-edge','Rainbow edge'],['satin','Satin ribbon'],['ticket','Ticket stub'],['pixel','Pixel frame'],['mesh','Color mesh'],['halo','Halo ring'],['stamp','Wax stamp'],['arch','Arch top'],['notched','Notched'],['pearl','Pearl shine'],['slime','Liquid gel'],['starlight','Starlight'],['ice-glass','Ice glass'],['ice-border','Ice border'],['prism','Prism'],['foil','Metal foil'],['split','Split color'],['frost-corner','Frost corner'],['badge','Badge'],['orbit','Orbit ring'],['paper','Paper label']];
    const shapes = [['design','Use design shape'],['pill','Pill'],['rounded','Rounded box'],['square','Square box'],['cut','Cut corner'],['arch','Arch'],['capsule','Capsule'],['organic','Organic']];
    const directions = [['110deg','Diagonal'],['135deg','Diagonal (reverse)'],['to bottom','Vertical'],['circle','Radial']];
    const icons = [['none','No detail'],['sparkle','Sparkle'],['star','Star'],['heart','Heart'],['arrow','Arrow'],['leaf','Leaf'],['diamond','Diamond'],['bolt','Bolt'],['flower','Flower'],['crown','Crown'],['dot','Dot'],['sun','Sun'],['moon','Moon'],['wave','Wave'],['check','Check'],['smile','Smile'],['plus','Plus'],['ribbon','Ribbon'],['flame','Flame'],['music','Music note'],['infinity','Infinity'],['clover','Clover'],['flag','Flag'],['snowflake','Snowflake'],['ice-crystal','Ice crystal'],['comet','Comet'],['planet','Planet'],['butterfly','Butterfly'],['lightning','Lightning'],['sparkles','Double sparkle'],['flower-star','Flower star'],['eye','Eye'],['mountain','Mountain'],['sunrise','Sunrise'],['cloud','Cloud'],['drop','Water drop'],['circular-arrow','Refresh'],['check-circle','Check badge'],['cross','Plus cross'],['crown-small','Mini crown'],['peace','Peace'],['diamond-ring','Diamond ring'],['crescent','Crescent'],['snowman','Snowman'],['asterisk','Asterisk'],['ice-cube','Ice cube'],['icicle','Icicle'],['frost-star','Frost star'],['snowfall','Snowfall'],['iceberg','Iceberg'],['mittens','Mittens'],['mountain-snow','Snowy mountain'],['evergreen','Evergreen'],['north-star','North star']];
    const animations = [['none','None'],['ice','Ice shine'],['ice-rain','Ice rain'],['icicle-drop','Dropping icicles'],['ice-drip','Ice drip'],['snowfall','Falling snow'],['snowstorm','Snowstorm'],['blizzard','Blizzard'],['sleet','Sleet'],['snowflake-spin','Spinning snowflakes'],['ice-crack','Ice crackle'],['frost','Frost pulse'],['glacier-glow','Glacier glow'],['polar-lights','Polar lights'],['frozen','Freeze shimmer'],['aurora','Aurora drift'],['comet-trail','Comet trail'],['confetti','Confetti pop'],['spark-rain','Spark rain'],['pulse','Soft pulse'],['float','Gentle float'],['glow','Glow breathe'],['bounce','Soft bounce'],['sweep','Light sweep'],['shine','Quick shimmer'],['tilt','Tiny tilt'],['orbit','Orbiting detail'],['twinkle','Twinkle'],['wave','Wave motion'],['pop','Pop'],['wiggle','Wiggle'],['heartbeat','Heartbeat'],['spin','Spinning detail'],['jelly','Jelly bounce'],['ripple','Ripple ring'],['neon-flicker','Neon flicker'],['flame','Flame flicker'],['shimmer','Prism shimmer'],['drift','Slow drift'],['march','Dashed march'],['breathe','Soft breathe'],['sparkle-burst','Sparkle burst'],['swing','Swing'],['flip','Tiny flip'],['magnet','Magnetic pull'],['glitch','Glitch flash'],['rainbow','Rainbow shift']];
    const select = (field, label, options) => `<div class="field"><label for="${id(field)}">${label}</label><select id="${id(field)}">${options.map(([v, text]) => `<option value="${v}" ${value[field] === v ? 'selected' : ''}>${text}</option>`).join('')}</select></div>`;
    return `<section class="menu-device-panel" data-menu-device="${device}" ${device === 'mobile' ? 'hidden' : ''}>
      <div class="menu-device-grid">${select('shape','Button shape',shapes)}${select('style','Surface design',styles)}${select('icon','Inside detail',icons)}${select('iconPosition','Detail position', [['left','Left of text'],['right','Right of text'],['top','Above text']])}${select('animation','Inside animation',animations)}</div>
      <label class="menu-gradient-toggle"><input id="${id('fill')}" type="checkbox" ${value.fill !== false ? 'checked' : ''}> Fill the box with the selected colors</label>
      <label class="menu-gradient-toggle"><input id="${id('gradient')}" type="checkbox" ${value.backgroundEndColor ? 'checked' : ''}> Blend two background colors</label>
      <div class="menu-device-grid menu-device-colors"><div class="field"><label for="${id('backgroundColor')}">First color</label><input id="${id('backgroundColor')}" type="color" value="${escapeHtml(value.backgroundColor)}"></div><div class="field"><label for="${id('backgroundEndColor')}">Second color</label><input id="${id('backgroundEndColor')}" type="color" value="${escapeHtml(value.backgroundEndColor || value.backgroundColor)}" ${value.backgroundEndColor ? '' : 'disabled'}></div>${select('gradientDirection','Color blend direction', directions)}<div class="field"><label for="${id('textColor')}">Text color</label><input id="${id('textColor')}" type="color" value="${escapeHtml(value.textColor)}"></div></div>
      <div class="menu-preview-row"><span class="hint">${device === 'desktop' ? 'Desktop' : 'Mobile'} preview</span><span id="${id('preview')}" class="menu-button-preview" data-profile="${device}"><span class="menu-button-preview__icon" aria-hidden="true"></span><span class="menu-button-preview__label"></span></span></div>
    </section>`;
  };
  return `<fieldset class="menu-appearance-editor"><legend>${tab === 'categories' ? 'Categories menu' : 'Collections menu'}</legend>
    <label class="menu-gradient-toggle"><input id="mMenuShow" type="checkbox" ${item?.menuShow ? 'checked' : ''}> Show under ${tab === 'categories' ? 'Categories' : 'Collections'}</label>
    <div class="field"><label for="mMenuLabel">Menu label <span class="hint">(optional)</span></label><input id="mMenuLabel" maxlength="80" placeholder="Use the ${tab === 'categories' ? 'category' : 'collection'} name" value="${escapeHtml(item?.menuLabel || '')}"></div>
    <div class="menu-device-tabs" role="tablist" aria-label="Menu device appearance"><button type="button" class="is-active" role="tab" aria-selected="true" data-menu-device-tab="desktop">Desktop</button><button type="button" role="tab" aria-selected="false" data-menu-device-tab="mobile">Mobile</button></div>
    ${profile('desktop')}${profile('mobile')}
    <p class="hint">${tab === 'collections' ? 'Choose separate desktop and mobile designs. Select any number of products below.' : 'Choose separate desktop and mobile designs for this category button.'}</p>
  </fieldset>`;
}

function bindMenuAppearancePreview(root) {
  const glyphs = { sparkle: '✦', star: '★', heart: '♥', arrow: '→', leaf: '❧', diamond: '◆', bolt: 'ϟ', flower: '✿', crown: '♛', dot: '•', sun: '☼', moon: '☾', wave: '〰', check: '✓', smile: '☺', plus: '+', ribbon: '♧', flame: '♨', music: '♫', infinity: '∞', clover: '☘', flag: '⚑', snowflake: '❄', 'ice-crystal': '❈', comet: '☄', planet: '♄', butterfly: '🦋', lightning: 'ϟ', sparkles: '✨', 'flower-star': '❋', eye: '◉', mountain: '▲', sunrise: '☀', cloud: '☁', drop: '◆', 'circular-arrow': '⟳', 'check-circle': '●✓', cross: '✚', 'crown-small': '♕', peace: '☮', 'diamond-ring': '◇', crescent: '☽', snowman: '☃', asterisk: '✳', 'ice-cube': '🧊', icicle: '❅', 'frost-star': '❉', snowfall: '❆', iceberg: '◢', mittens: '🧤', 'mountain-snow': '♧', evergreen: '♣', 'north-star': '✧' };
  const update = (device) => {
    const get = (field) => root.querySelector(`#mMenu-${device}-${field}`);
    const preview = get('preview');
    const style = get('style').value;
    const shape = get('shape').value;
    const iconPosition = get('iconPosition').value;
    const start = get('backgroundColor').value;
    const end = get('gradient').checked ? get('backgroundEndColor').value : start;
    const text = get('textColor').value;
    const direction = get('gradientDirection').value;
    const fill = get('gradient').checked ? (direction === 'circle' ? `radial-gradient(circle,${start},${end})` : `linear-gradient(${direction},${start},${end})`) : start;
    const label = root.querySelector('#mMenuLabel').value.trim() || root.querySelector('#mName').value.trim() || 'SUMMER \'26';
    get('backgroundEndColor').disabled = !get('gradient').checked;
    get('gradientDirection').disabled = !get('gradient').checked;
    preview.dataset.style = style;
    preview.dataset.shape = shape;
    preview.dataset.fill = String(get('fill').checked);
    preview.dataset.iconPosition = iconPosition;
    preview.dataset.animation = get('animation').value;
    preview.querySelector('.menu-button-preview__label').textContent = label;
    preview.querySelector('.menu-button-preview__icon').textContent = glyphs[get('icon').value] || '';
    preview.style.setProperty('--preview-fill', fill);
    preview.style.setProperty('--preview-start', start);
    preview.style.setProperty('--preview-end', end);
    preview.style.setProperty('--preview-text', text);
    const naturallyTransparent = ['link','outline','underline','dashed','double','hollow','gradient-outline'].includes(style);
    preview.style.background = naturallyTransparent && !get('fill').checked ? 'transparent' : fill;
    if (style === 'soft') preview.style.background = `color-mix(in srgb,${start} 18%,var(--a-surface))`;
    if (style === 'glass') preview.style.background = `color-mix(in srgb,${start} 28%,transparent)`;
    if (style === 'inset') preview.style.background = `color-mix(in srgb,${start} 12%,var(--a-surface))`;
    if (style === 'gradient-outline') preview.style.background = `linear-gradient(var(--a-surface),var(--a-surface)) padding-box,${fill} border-box`;
    // Every profile exposes its own text color, including link and outline styles.
    preview.style.color = text;
    preview.style.border = ['outline','glow','glass','neon','inset','bevel','hollow'].includes(style) ? `1px solid ${start}` : style === 'double' ? `3px double ${start}` : style === 'dashed' ? `2px dashed ${start}` : style === 'gradient-outline' ? '2px solid transparent' : '1px solid transparent';
    preview.style.borderRadius = ['card','ribbon'].includes(style) ? '8px' : ['cut','corner','bevel'].includes(style) ? '4px' : style === 'tag' ? '6px 999px 999px 6px' : style === 'bubble' ? '16px 16px 16px 4px' : style === 'underline' ? '0' : '999px';
    preview.style.padding = ['link','underline'].includes(style) ? '.35rem .15rem' : '.45rem 1rem';
    preview.style.boxShadow = ['glow','neon'].includes(style) ? `0 0 0 1px ${start},0 0 14px ${start}99` : style === 'elevated' ? `0 5px 0 ${start}88,0 8px 16px #0003` : ['inset','bevel'].includes(style) ? `inset 0 2px 6px ${start}55` : style === 'sticker' ? `3px 4px 0 ${start}77` : style === 'gloss' ? 'inset 0 1px 1px #fff9,0 4px 12px #0003' : 'none';
    preview.style.backdropFilter = style === 'glass' ? 'blur(8px)' : 'none';
    preview.style.clipPath = ['cut','corner'].includes(style) ? 'polygon(0 0,calc(100% - 10px) 0,100% 10px,100% 100%,10px 100%,0 calc(100% - 10px))' : 'none';
    preview.style.transform = style === 'sticker' ? 'rotate(-3deg)' : 'none';
  };
  ['desktop','mobile'].forEach((device) => {
      ['shape','style','fill','icon','iconPosition','animation','gradient','gradientDirection','backgroundColor','backgroundEndColor','textColor'].forEach((field) => {
      const node = root.querySelector(`#mMenu-${device}-${field}`);
      node.addEventListener(node.type === 'select-one' || node.type === 'checkbox' ? 'change' : 'input', () => update(device));
    });
    update(device);
  });
  root.querySelectorAll('[data-menu-device-tab]').forEach((button) => button.addEventListener('click', () => {
    const device = button.dataset.menuDeviceTab;
    root.querySelectorAll('[data-menu-device-tab]').forEach((tabButton) => { const active = tabButton === button; tabButton.classList.toggle('is-active', active); tabButton.setAttribute('aria-selected', String(active)); });
    root.querySelectorAll('[data-menu-device]').forEach((panel) => { panel.hidden = panel.dataset.menuDevice !== device; });
  }));
  ['#mName','#mMenuLabel'].forEach((selector) => root.querySelector(selector).addEventListener('input', () => ['desktop','mobile'].forEach(update)));
}

function readMenuAppearance(root) {
  const readProfile = (device) => {
    const get = (field) => root.querySelector(`#mMenu-${device}-${field}`);
    return { style: get('style').value, shape: get('shape').value, fill: get('fill').checked, backgroundColor: get('backgroundColor').value, backgroundEndColor: get('gradient').checked ? get('backgroundEndColor').value : null, gradientDirection: get('gradientDirection').value, textColor: get('textColor').value, icon: get('icon').value, iconPosition: get('iconPosition').value, animation: get('animation').value };
  };
  return {
    menuShow: root.querySelector('#mMenuShow').checked,
    menuLabel: root.querySelector('#mMenuLabel').value.trim() || null,
    menuDesktopAppearance: readProfile('desktop'),
    menuMobileAppearance: readProfile('mobile'),
  };
}
