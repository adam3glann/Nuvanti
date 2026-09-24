import { initAdminShell } from '../components/shell.js';
import { formatPrice } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { createAdminModal } from '../components/modal.js';
import { fetchDiscounts, createDiscount, toggleDiscountStatus, deleteDiscount } from '../services/discountService.js';

const session = initAdminShell({ page: 'discounts', title: 'Discounts' });
if (session) init();

function init() {
  document.getElementById('newDiscountBtn').addEventListener('click', openNewDiscount);
  load();
}

function discountStatus(d) {
  if (!d.isActive) return 'inactive';
  if (d.expiresAt && new Date(d.expiresAt) < new Date()) return 'expired';
  return 'active';
}

async function load() {
  const body = document.getElementById('discountsBody');
  let discounts;
  try {
    discounts = await fetchDiscounts();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="8"><div class="admin-empty"><h3>Couldn't load discounts</h3><p>${error.message}</p></div></td></tr>`;
    return;
  }

  body.innerHTML = discounts.length ? discounts.map((d) => {
    const status = discountStatus(d);
    return `
    <tr>
      <td class="mono" style="font-weight:700">${d.code}</td>
      <td style="text-transform:capitalize">${d.type}</td>
      <td>${d.type === 'percent' ? d.value + '%' : formatPrice(d.value)}</td>
      <td>${d.minSubtotalCents ? formatPrice(d.minSubtotalCents / 100) : '—'}</td>
      <td>${d.usedCount}${d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
      <td>${d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : 'No expiry'}</td>
      <td>${statusBadge(status)}</td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" data-toggle="${d.id}" data-active="${d.isActive}" ${status === 'expired' ? 'disabled' : ''}>${d.isActive ? 'Deactivate' : 'Activate'}</button>
        <button class="icon-btn" data-delete="${d.id}" aria-label="Delete">✕</button>
      </td>
    </tr>
  `;
  }).join('') : `<tr><td colspan="8"><div class="admin-empty"><h3>No discounts yet</h3><p>Create your first discount code.</p></div></td></tr>`;

  document.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await toggleDiscountStatus(btn.dataset.toggle, btn.dataset.active !== 'true');
      load();
    } catch (error) {
      showAdminToast(error.message, 'error');
      btn.disabled = false;
    }
  }));
  document.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete Discount?', body: 'This code will stop working immediately for any customer.', confirmLabel: 'Delete Discount' });
    if (!ok) return;
    try {
      await deleteDiscount(btn.dataset.delete);
      showAdminToast('Discount deleted.', 'success');
      load();
    } catch (error) {
      showAdminToast(error.message, 'error');
    }
  }));
}

function openNewDiscount() {
  const modal = createAdminModal({
    title: 'New Discount',
    bodyHTML: `
      <div class="field"><label>Code</label><input id="dCode" placeholder="e.g. WINTER20" style="text-transform:uppercase" /></div>
      <div class="field-row">
        <div class="field"><label>Type</label>
          <select id="dType">
            <option value="percent">Percentage</option>
            <option value="fixed">Fixed Amount</option>
          </select>
        </div>
        <div class="field"><label>Amount</label><input type="number" id="dAmount" placeholder="e.g. 20" min="1" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Minimum Order (EGP)</label><input type="number" id="dMin" value="0" min="0" /></div>
        <div class="field"><label>Usage Limit</label><input type="number" id="dLimit" placeholder="Leave blank for unlimited" min="1" /></div>
      </div>
      <div class="field"><label>Expires</label><input type="date" id="dEnd" /></div>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Create Discount</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const saveBtn = modal.root.querySelector('#mSave');
    const code = modal.root.querySelector('#dCode').value.trim().toUpperCase();
    const value = Number(modal.root.querySelector('#dAmount').value) || 0;
    if (!code || value <= 0) {
      showAdminToast('Enter a code and an amount greater than zero.', 'error');
      return;
    }
    saveBtn.disabled = true;
    try {
      await createDiscount({
        code,
        type: modal.root.querySelector('#dType').value,
        value,
        minSubtotal: Number(modal.root.querySelector('#dMin').value) || 0,
        usageLimit: modal.root.querySelector('#dLimit').value ? Number(modal.root.querySelector('#dLimit').value) : null,
        expiresAt: modal.root.querySelector('#dEnd').value || null,
      });
      modal.close();
      showAdminToast('Discount created.', 'success');
      load();
    } catch (error) {
      showAdminToast(error.message, 'error');
      saveBtn.disabled = false;
    }
  });
  modal.open();
}
