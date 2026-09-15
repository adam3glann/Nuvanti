import { initAdminShell } from '../components/shell.js';
import { formatPrice, paginationHTML } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { icon } from '../components/icons.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { hasPermission } from '../components/permissions.js';
import {
  fetchAdminProducts, deleteAdminProduct, duplicateAdminProduct, updateAdminProduct,
  productStockStatus, productStockTotal,
} from '../services/productService.js';
import { fetchCategories } from '../services/categoryService.js';

const session = initAdminShell({ page: 'products', title: 'Products' });
if (session) init();

const canEdit = session && hasPermission(session.role, 'products.edit');
const canDelete = session && hasPermission(session.role, 'products.delete');

const params = new URLSearchParams(location.search);
const state = { query: params.get('q') || '', category: '', status: '', page: 1, perPage: 10, sort: '' };
let selected = new Set();

async function init() {
  const cats = await fetchCategories();
  document.getElementById('categoryFilter').innerHTML = `<option value="">All Categories</option>${cats.map((c) => `<option value="${c.slug}">${c.name}</option>`).join('')}`;
  document.getElementById('searchInput').value = state.query;

  if (!canEdit) document.getElementById('newProductBtn').style.display = 'none';

  document.getElementById('searchInput').addEventListener('input', debounce((e) => { state.query = e.target.value; state.page = 1; load(); }, 250));
  document.getElementById('categoryFilter').addEventListener('change', (e) => { state.category = e.target.value; state.page = 1; load(); });
  document.getElementById('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; state.page = 1; load(); });
  document.getElementById('sortSelect').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; load(); });
  document.getElementById('selectAll').addEventListener('change', (e) => toggleSelectAll(e.target.checked));
  document.getElementById('bulkPublish').addEventListener('click', () => bulkAction('active'));
  document.getElementById('bulkUnpublish').addEventListener('click', () => bulkAction('draft'));
  document.getElementById('bulkDelete').addEventListener('click', bulkDelete);

  load();
}

async function load() {
  const tbody = document.getElementById('productsBody');
  tbody.innerHTML = `<tr><td colspan="7"><div class="a-skeleton" style="height:40px"></div></td></tr>`.repeat(1);
  const { items, total } = await fetchAdminProducts(state);

  if (items.length === 0) {
    document.getElementById('productsCard').innerHTML = `
      <div class="admin-empty">
        <h3>No products match your filters</h3>
        <p>Try adjusting search or filters.</p>
      </div>`;
    return;
  }

  tbody.innerHTML = items.map((p) => {
    const stockStatus = productStockStatus(p);
    return `
    <tr data-row="${p.id}">
      <td class="row-checkbox-col"><input type="checkbox" class="row-check" data-id="${p.id}" ${selected.has(p.id) ? 'checked' : ''} /></td>
      <td>
        <div style="display:flex;align-items:center;gap:.6rem">
          <img src="../${p.images[0]}" alt="" width="36" height="45" style="object-fit:cover;border-radius:3px" />
          <div><a href="product-edit.html?id=${p.id}" style="font-weight:600;color:var(--a-text)">${p.name}</a><br /><span class="mono" style="color:var(--a-muted)">${p.sku}</span></div>
        </div>
      </td>
      <td style="text-transform:capitalize">${p.category.replace('-', ' ')}</td>
      <td>${formatPrice(p.price)}</td>
      <td>${statusBadge(stockStatus)} <span style="color:var(--a-muted);font-size:.76rem">(${productStockTotal(p)})</span></td>
      <td>${statusBadge(p.status)}</td>
      <td style="text-align:right">
        <div class="rel" style="display:inline-block">
          <button class="icon-btn" data-menu="${p.id}" aria-label="Row actions">${icon('more')}</button>
          <div class="popover" id="menu-${p.id}" style="right:0">
            <a class="popover-item" href="product-edit.html?id=${p.id}">${icon('edit')} Edit</a>
            <button class="popover-item" data-duplicate="${p.id}" style="width:100%;text-align:left">${icon('copy')} Duplicate</button>
            <button class="popover-item" data-toggle-status="${p.id}" style="width:100%;text-align:left">${p.status === 'active' ? 'Unpublish' : 'Publish'}</button>
            ${canDelete ? `<button class="popover-item" data-delete="${p.id}" style="width:100%;text-align:left;color:var(--a-danger)">${icon('trash')} Delete</button>` : ''}
          </div>
        </div>
      </td>
    </tr>`;
  }).join('');

  document.getElementById('paginationWrap').innerHTML = paginationHTML(state.page, state.perPage, total);
  document.querySelectorAll('#paginationWrap [data-page]').forEach((btn) => btn.addEventListener('click', () => { state.page = Number(btn.dataset.page); load(); }));

  bindRowEvents();
  updateBulkBar();
}

function bindRowEvents() {
  document.querySelectorAll('.row-check').forEach((cb) => cb.addEventListener('change', (e) => {
    const id = e.target.dataset.id;
    e.target.checked ? selected.add(id) : selected.delete(id);
    updateBulkBar();
  }));

  document.querySelectorAll('[data-menu]').forEach((btn) => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = document.getElementById(`menu-${btn.dataset.menu}`);
    const willOpen = pop.dataset.open !== 'true';
    document.querySelectorAll('.popover').forEach((p) => (p.dataset.open = 'false'));
    pop.dataset.open = String(willOpen);
  }));
  document.addEventListener('click', () => document.querySelectorAll('.popover').forEach((p) => (p.dataset.open = 'false')));

  document.querySelectorAll('[data-duplicate]').forEach((btn) => btn.addEventListener('click', async () => {
    await duplicateAdminProduct(btn.dataset.duplicate);
    showAdminToast('Product duplicated as draft.', 'success');
    load();
  }));

  document.querySelectorAll('[data-toggle-status]').forEach((btn) => btn.addEventListener('click', async () => {
    const { items } = await fetchAdminProducts({ ...state, perPage: 999 });
    const p = items.find((x) => x.id === btn.dataset.toggleStatus);
    await updateAdminProduct(p.id, { status: p.status === 'active' ? 'draft' : 'active' });
    showAdminToast(`Product ${p.status === 'active' ? 'unpublished' : 'published'}.`, 'success');
    load();
  }));

  document.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete Product?', body: 'This will permanently remove the product from your catalog. This action cannot be easily reversed.', confirmLabel: 'Delete Product' });
    if (!ok) return;
    await deleteAdminProduct(btn.dataset.delete);
    showAdminToast('Product deleted.', 'success');
    load();
  }));
}

function toggleSelectAll(checked) {
  document.querySelectorAll('.row-check').forEach((cb) => {
    cb.checked = checked;
    checked ? selected.add(cb.dataset.id) : selected.delete(cb.dataset.id);
  });
  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('bulkBar');
  bar.dataset.active = String(selected.size > 0);
  document.getElementById('bulkCount').textContent = `${selected.size} selected`;
}

async function bulkAction(status) {
  for (const id of selected) await updateAdminProduct(id, { status });
  showAdminToast(`${selected.size} product(s) updated.`, 'success');
  selected.clear();
  load();
}

async function bulkDelete() {
  const ok = await confirmDialog({ title: `Delete ${selected.size} Products?`, body: 'This will permanently remove the selected products. This action cannot be easily reversed.', confirmLabel: 'Delete Products' });
  if (!ok) return;
  for (const id of selected) await deleteAdminProduct(id);
  showAdminToast('Selected products deleted.', 'success');
  selected.clear();
  load();
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
