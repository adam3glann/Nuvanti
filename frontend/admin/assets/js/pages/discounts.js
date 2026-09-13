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

async function load() {
  const discounts = await fetchDiscounts();
  document.getElementById('discountsBody').innerHTML = discounts.length ? discounts.map((d) => `
    <tr>
      <td class="mono" style="font-weight:700">${d.code}</td>
      <td style="text-transform:capitalize">${d.type.replace('_', ' ')}</td>
      <td>${d.type === 'percentage' ? d.amount + '%' : d.type === 'fixed' ? formatPrice(d.amount) : '—'}</td>
      <td>${d.minOrder ? formatPrice(d.minOrder) : '—'}</td>
      <td>${d.used}${d.usageLimit ? ` / ${d.usageLimit}` : ''}</td>
      <td>${d.endDate ? d.endDate : 'No expiry'}</td>
      <td>${statusBadge(d.status === 'active' ? 'active' : d.status === 'expired' ? 'expired' : d.status === 'scheduled' ? 'scheduled' : 'inactive')}</td>
      <td style="text-align:right">
        <button class="btn btn-outline btn-sm" data-toggle="${d.id}">${d.status === 'active' ? 'Deactivate' : 'Activate'}</button>
        <button class="icon-btn" data-delete="${d.id}" aria-label="Delete">✕</button>
      </td>
    </tr>
  `).join('') : `<tr><td colspan="8"><div class="admin-empty"><h3>No discounts yet</h3><p>Create your first discount code.</p></div></td></tr>`;

  document.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
    await toggleDiscountStatus(btn.dataset.toggle);
    load();
  }));
  document.querySelectorAll('[data-delete]').forEach((btn) => btn.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Delete Discount?', body: 'This code will stop working immediately for any customer.', confirmLabel: 'Delete Discount' });
    if (!ok) return;
    await deleteDiscount(btn.dataset.delete);
    showAdminToast('Discount deleted.', 'success');
    load();
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
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
            <option value="free_shipping">Free Shipping</option>
          </select>
        </div>
        <div class="field"><label>Amount</label><input type="number" id="dAmount" placeholder="e.g. 20" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Minimum Order (EGP)</label><input type="number" id="dMin" value="0" /></div>
        <div class="field"><label>Usage Limit</label><input type="number" id="dLimit" placeholder="Leave blank for unlimited" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Start Date</label><input type="date" id="dStart" /></div>
        <div class="field"><label>End Date</label><input type="date" id="dEnd" /></div>
      </div>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Create Discount</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const code = modal.root.querySelector('#dCode').value.trim().toUpperCase();
    if (!code) return;
    await createDiscount({
      code, type: modal.root.querySelector('#dType').value,
      amount: Number(modal.root.querySelector('#dAmount').value) || 0,
      minOrder: Number(modal.root.querySelector('#dMin').value) || 0,
      usageLimit: modal.root.querySelector('#dLimit').value ? Number(modal.root.querySelector('#dLimit').value) : null,
      startDate: modal.root.querySelector('#dStart').value || null,
      endDate: modal.root.querySelector('#dEnd').value || null,
    });
    modal.close();
    showAdminToast('Discount created.', 'success');
    load();
  });
  modal.open();
}
