import { initAdminShell } from '../components/shell.js';
import { statusBadge } from '../components/statusBadge.js';
import { icon } from '../components/icons.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { createAdminModal } from '../components/modal.js';
import {
  fetchCategories, toggleCategoryStatus, deleteCategory, createCategory,
  fetchCollections, toggleCollectionStatus, deleteCollection, createCollection,
} from '../services/categoryService.js';

const params = new URLSearchParams(location.search);
let tab = params.get('tab') === 'collections' ? 'collections' : 'categories';

const session = initAdminShell({ page: 'categories', title: 'Categories & Collections' });
if (session) init();

function init() {
  renderTabs();
  document.getElementById('newBtn').addEventListener('click', () => (tab === 'categories' ? openNewCategory() : openNewCollection()));
  render();
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

  if (tab === 'categories') {
    headRow.innerHTML = '<th>Name</th><th>Slug</th><th>Products</th><th>Status</th><th></th>';
    const cats = await fetchCategories();
    body.innerHTML = cats.map((c) => `
      <tr>
        <td style="font-weight:600">${c.name}</td>
        <td class="mono">${c.slug}</td>
        <td>${c.productCount}</td>
        <td>${statusBadge(c.status === 'active' ? 'active' : 'disabled')}</td>
        <td style="text-align:right">
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
        <td style="font-weight:600">${c.name}</td>
        <td class="mono">${c.slug}</td>
        <td>${c.productCount}</td>
        <td>${statusBadge(c.status)}</td>
        <td style="text-align:right">
          <button class="btn btn-outline btn-sm" data-toggle="${c.id}">${c.status === 'published' ? 'Unpublish' : 'Publish'}</button>
          <button class="icon-btn" data-delete="${c.id}" aria-label="Delete">${icon('trash')}</button>
        </td>
      </tr>`).join('');
    bindRows('collection');
  }
}

function bindRows(kind) {
  document.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
    kind === 'category' ? await toggleCategoryStatus(btn.dataset.toggle) : await toggleCollectionStatus(btn.dataset.toggle);
    render();
  }));
  document.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `Delete this ${kind}?`, body: 'Products will remain, but this grouping will be removed from the storefront.', confirmLabel: 'Delete' });
    if (!ok) return;
    kind === 'category' ? await deleteCategory(btn.dataset.delete) : await deleteCollection(btn.dataset.delete);
    showAdminToast(`${kind === 'category' ? 'Category' : 'Collection'} deleted.`, 'success');
    render();
  }));
}

function openNewCategory() {
  const modal = createAdminModal({
    title: 'New Category',
    bodyHTML: `
      <div class="field"><label>Name</label><input id="mName" /></div>
      <div class="field"><label>Slug</label><input id="mSlug" /></div>
      <div class="field"><label>Description</label><textarea id="mDesc" rows="3"></textarea></div>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Create</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const name = modal.root.querySelector('#mName').value.trim();
    if (!name) return;
    await createCategory({ name, slug: modal.root.querySelector('#mSlug').value.trim() || name.toLowerCase().replace(/\s+/g, '-'), description: modal.root.querySelector('#mDesc').value });
    modal.close();
    showAdminToast('Category created.', 'success');
    render();
  });
  modal.open();
}

function openNewCollection() {
  const modal = createAdminModal({
    title: 'New Collection',
    bodyHTML: `
      <div class="field"><label>Name</label><input id="mName" /></div>
      <div class="field"><label>Slug</label><input id="mSlug" /></div>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Create</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const name = modal.root.querySelector('#mName').value.trim();
    if (!name) return;
    await createCollection({ name, slug: modal.root.querySelector('#mSlug').value.trim() || name.toLowerCase().replace(/\s+/g, '-') });
    modal.close();
    showAdminToast('Collection created.', 'success');
    render();
  });
  modal.open();
}
