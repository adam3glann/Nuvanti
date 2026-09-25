import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDateTime, storeAssetSrc, escapeHtml } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { hasPermission } from '../components/permissions.js';
import { fetchAdminOrder, updateOrderStatus, cancelOrder } from '../services/orderService.js';

const session = initAdminShell({ page: 'orders', title: 'Order Details' });
if (session) init();

const params = new URLSearchParams(location.search);
const id = params.get('id');
const canEdit = session && hasPermission(session.role, 'orders.edit');
const canCancel = session && hasPermission(session.role, 'orders.cancel');

async function init() {
  let order;
  try {
    order = await fetchAdminOrder(id);
  } catch (error) {
    document.getElementById('orderRoot').innerHTML = `<div class="admin-empty"><h3>Couldn't load this order</h3><p>${error.message}</p></div>`;
    return;
  }
  if (!order) {
    document.getElementById('orderRoot').innerHTML = `<div class="admin-empty"><h3>Order not found</h3><a href="orders.html" class="btn btn-primary">Back to Orders</a></div>`;
    return;
  }
  render(order);
}

function render(order) {
  document.title = `${order.id} — Nuvanti Admin`;
  document.getElementById('pageHeading').textContent = order.id;

  document.getElementById('orderRoot').innerHTML = `
    <div style="display:grid;grid-template-columns:1.6fr 1fr;gap:1.25rem" class="od-grid">
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Items</h2></div>
          <div class="table-wrap">
            <table class="admin-table">
              <thead><tr><th>Product</th><th>Variant</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                ${order.items.map((it) => `
                  <tr>
                    <td><div style="display:flex;align-items:center;gap:.6rem"><img src="${storeAssetSrc(it.image)}" width="34" height="42" style="object-fit:cover;border-radius:3px" alt="" /><span>${escapeHtml(it.name)}</span></div></td>
                    <td>${[it.color, it.size].filter(Boolean).join(' / ') || '—'}</td><td>${it.quantity}</td>
                    <td>${formatPrice(it.price)}</td><td>${formatPrice(it.price * it.quantity)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
          <div class="card-pad" style="border-top:1px solid var(--a-border)">
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;margin-bottom:.4rem"><span>Shipping</span><span>${order.shipping === 0 ? 'Free' : formatPrice(order.shipping)}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:700"><span>Total</span><span>${formatPrice(order.total)}</span></div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Payment</h2></div>
          <div class="card-pad" style="font-size:.85rem;display:flex;flex-direction:column;gap:.5rem">
            <div style="display:flex;justify-content:space-between"><span class="text-muted" style="color:var(--a-muted)">Method</span><span>${order.paymentMethod}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Status</span>${statusBadge(order.paymentStatus)}</div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Transaction Ref</span><span class="mono">${order.transactionRef || '—'}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Shipping</h2></div>
          <div class="card-pad" style="font-size:.85rem;display:flex;flex-direction:column;gap:.5rem">
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Address</span><span>${escapeHtml(order.shippingAddress.city)}, ${escapeHtml(order.shippingAddress.country)}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Method</span><span>${order.shippingAddress.method}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Tracking</span><span class="mono">${order.trackingNumber || '—'}</span></div>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Customer</h2></div>
          <div class="card-pad" style="font-size:.85rem;display:flex;flex-direction:column;gap:.4rem">
            <strong>${escapeHtml(order.customer.name)}</strong>
            <span style="color:var(--a-muted)">${escapeHtml(order.customer.email)}</span>
            <span style="color:var(--a-muted)">${escapeHtml(order.customer.phone)}</span>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Status</h2></div>
          <div class="card-pad">
            <div class="o-timeline" id="orderTimeline"></div>
            ${canEdit ? `
              <div class="field" style="margin-top:1rem"><label for="statusSelect">Update Status</label>
                <select id="statusSelect">${statusChoices(order.status)}</select>
              </div>
              <button class="btn btn-primary" id="updateStatusBtn" style="width:100%">Update Status</button>
            ` : ''}
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Actions</h2></div>
          <div class="card-pad" style="display:flex;flex-direction:column;gap:.6rem">
            <button class="btn btn-outline" id="printInvoiceBtn">Print Invoice</button>
            <button class="btn btn-outline" id="printSlipBtn">Print Packing Slip</button>
            <button class="btn btn-outline" id="contactBtn">Contact Customer</button>
            ${canCancel && order.status !== 'cancelled' ? `<button class="btn btn-outline" style="color:var(--a-danger);border-color:var(--a-danger)" id="cancelBtn">Cancel Order</button>` : ''}
          </div>
        </div>

      </div>
    </div>
  `;

  renderTimeline(order);

  document.getElementById('printInvoiceBtn')?.addEventListener('click', () => window.print());
  document.getElementById('printSlipBtn')?.addEventListener('click', () => window.print());
  document.getElementById('contactBtn')?.addEventListener('click', () => { window.location.href = `mailto:${order.customer.email}`; });

  document.getElementById('updateStatusBtn')?.addEventListener('click', async () => {
    const status = document.getElementById('statusSelect').value;
    try {
      const updated = await updateOrderStatus(order.id, status);
      showAdminToast('Order status updated.', 'success');
      render(updated);
    } catch (error) { showAdminToast(error.message, 'error'); }
  });

  document.getElementById('cancelBtn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Cancel Order?', body: 'This action cannot be easily reversed. The customer will receive an email if store email delivery is configured.', confirmLabel: 'Cancel Order' });
    if (!ok) return;
    try {
      const updated = await cancelOrder(order.id);
      showAdminToast('Order cancelled.', 'success');
      render(updated);
    } catch (error) { showAdminToast(error.message, 'error'); }
  });

}

function renderTimeline(order) {
  const labels = { pending: 'Order received', paid: 'Payment received', processing: 'Being prepared', shipped: 'Shipped', out_for_delivery: 'Out for delivery', fulfilled: 'Delivered', cancelled: 'Cancelled' };
  document.getElementById('orderTimeline').innerHTML = `
    <div class="o-timeline__item" data-done="true"><p class="o-timeline__title">Order placed</p><p class="o-timeline__time">${formatDateTime(order.createdAt)}</p></div>
    <div class="o-timeline__item" data-done="${order.status !== 'pending'}"><p class="o-timeline__title">${labels[order.status] || escapeHtml(order.status)}</p></div>`;
}

function statusChoices(current) {
  const labels = { pending: 'Pending', paid: 'Payment Received (legacy)', processing: 'Processing', shipped: 'Shipped', out_for_delivery: 'Out for Delivery', fulfilled: 'Delivered', cancelled: 'Cancelled' };
  const rank = { pending: 0, paid: 1, processing: 1, shipped: 2, out_for_delivery: 3, fulfilled: 4 };
  const options = Object.entries(labels).filter(([value]) => value === current || (value === 'cancelled' && current === 'pending') || (rank[value] !== undefined && rank[value] > (rank[current] ?? -1)));
  return options.map(([value, label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`).join('');
}
