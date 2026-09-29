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
} from '../services/categoryService.js';
import { startLiveRefresh } from '../services/liveRefresh.js';

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
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  const imageUrl = modal.root.querySelector('#mImageUrl');
  const preview = modal.root.querySelector('#mCoverPreview');
  const fileInput = modal.root.querySelector('#mCoverFile');
  const saveButton = modal.root.querySelector('#mSave');
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
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    if (uploading) return showAdminToast('Wait for the cover upload to finish.', 'info');
    const name = modal.root.querySelector('#mName').value.trim();
    if (name.length < 2) return showAdminToast('Category name must have at least 2 characters.', 'error');
    const rawSlug = modal.root.querySelector('#mSlug').value.trim();
    const slug = slugify(rawSlug || name);
    if (!slug) return showAdminToast('Enter a name or slug using letters and numbers.', 'error');
    try {
      const data = { name, slug, description: modal.root.querySelector('#mDesc').value.trim(), imageUrl: imageUrl.value.trim() || null, ...readMenuAppearance(modal.root) };
      if (editing) await editCategory(category.id, data);
      else await createCategory(data);
      modal.close();
      showAdminToast(editing ? 'Category updated.' : 'Category created.', 'success');
      render();
    } catch (error) { showAdminToast(error.message, 'error'); }
  });
  modal.open();
}

function openCollectionEditor(collection = null) {
  const editing = Boolean(collection);
  const modal = createAdminModal({
    title: editing ? 'Edit Collection' : 'New Collection',
    bodyHTML: `
      <div class="field"><label for="mName">Name</label><input id="mName" maxlength="80" value="${escapeHtml(collection?.name || '')}" /></div>
      <div class="field"><label for="mSlug">Slug</label><input id="mSlug" maxlength="80" value="${escapeHtml(collection?.slug || '')}" ${editing ? 'readonly' : ''} /></div>
      ${menuAppearanceFields(collection)}
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">${editing ? 'Save Changes' : 'Create'}</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const name = modal.root.querySelector('#mName').value.trim();
    if (name.length < 2) return showAdminToast('Collection name must have at least 2 characters.', 'error');
    const rawSlug = modal.root.querySelector('#mSlug').value.trim();
    const slug = slugify(rawSlug || name);
    if (!slug) return showAdminToast('Enter a name or slug using letters and numbers.', 'error');
    try {
      const data = { name, slug, ...readMenuAppearance(modal.root) };
      if (editing) await editCollection(collection.id, data);
      else await createCollection(data);
      modal.close();
      showAdminToast(editing ? 'Collection updated.' : 'Collection created.', 'success');
      render();
    } catch (error) { showAdminToast(error.message, 'error'); }
  });
  modal.open();
}

function menuAppearanceFields(item = null) {
  return `
    <fieldset style="border:1px solid var(--a-border);border-radius:10px;padding:1rem;margin:1rem 0">
      <legend style="padding:0 .35rem;font-weight:600">Store header menu</legend>
      <label style="display:flex;align-items:center;gap:.6rem;margin-bottom:.85rem"><input id="mMenuShow" type="checkbox" ${item?.menuShow ? 'checked' : ''} /> Show this ${tab === 'categories' ? 'category' : 'collection'} in the store menu</label>
      <div class="field"><label for="mMenuLabel">Menu label <span class="hint">(optional)</span></label><input id="mMenuLabel" maxlength="80" placeholder="Use the ${tab === 'categories' ? 'category' : 'collection'} name" value="${escapeHtml(item?.menuLabel || '')}" /></div>
      <div class="field"><label for="mMenuStyle">Button style</label><select id="mMenuStyle"><option value="link" ${item?.menuStyle === 'link' || !item?.menuStyle ? 'selected' : ''}>Simple link</option><option value="pill" ${item?.menuStyle === 'pill' ? 'selected' : ''}>Pill button</option><option value="card" ${item?.menuStyle === 'card' ? 'selected' : ''}>Featured button</option></select></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem"><div class="field"><label for="mMenuBackground">Button color</label><input id="mMenuBackground" type="color" value="${escapeHtml(item?.menuBackgroundColor || '#285c43')}" /></div><div class="field"><label for="mMenuText">Text color</label><input id="mMenuText" type="color" value="${escapeHtml(item?.menuTextColor || '#ffffff')}" /></div></div>
      <p class="hint">Choose which links appear in the desktop header and mobile burger menu. Colors apply to Pill and Featured styles; updates appear in the store automatically.</p>
    </fieldset>`;
}

function readMenuAppearance(root) {
  return {
    menuShow: root.querySelector('#mMenuShow').checked,
    menuLabel: root.querySelector('#mMenuLabel').value.trim() || null,
    menuStyle: root.querySelector('#mMenuStyle').value,
    menuBackgroundColor: root.querySelector('#mMenuBackground').value,
    menuTextColor: root.querySelector('#mMenuText').value,
  };
}
