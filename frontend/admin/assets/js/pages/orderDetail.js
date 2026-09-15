import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDateTime } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { hasPermission } from '../components/permissions.js';
import { fetchAdminOrder, updateOrderStatus, cancelOrder, refundOrder, addOrderNote } from '../services/orderService.js';
import { ORDER_STATUS_FLOW } from '../data/orders.js';

const session = initAdminShell({ page: 'orders', title: 'Order Details' });
if (session) init();

const params = new URLSearchParams(location.search);
const id = params.get('id');
const canEdit = session && hasPermission(session.role, 'orders.edit');
const canCancel = session && hasPermission(session.role, 'orders.cancel');
const canRefund = session && hasPermission(session.role, 'orders.refund');

async function init() {
  const order = await fetchAdminOrder(id);
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
                    <td><div style="display:flex;align-items:center;gap:.6rem"><img src="../${it.image}" width="34" height="42" style="object-fit:cover;border-radius:3px" alt="" /><span>${it.name}</span></div></td>
                    <td>${it.color} / ${it.size}</td><td>${it.quantity}</td>
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
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Address</span><span>${order.shippingAddress.city}, ${order.shippingAddress.country}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Method</span><span>${order.shippingAddress.method}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--a-muted)">Tracking</span><span class="mono">${order.trackingNumber || '—'}</span></div>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Customer</h2></div>
          <div class="card-pad" style="font-size:.85rem;display:flex;flex-direction:column;gap:.4rem">
            <strong>${order.customer.name}</strong>
            <span style="color:var(--a-muted)">${order.customer.email}</span>
            <span style="color:var(--a-muted)">${order.customer.phone}</span>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Status</h2></div>
          <div class="card-pad">
            <div class="o-timeline" id="orderTimeline"></div>
            ${canEdit ? `
              <div class="field" style="margin-top:1rem"><label for="statusSelect">Update Status</label>
                <select id="statusSelect">
                  ${['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'].map((s) => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${cap(s)}</option>`).join('')}
                </select>
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
            ${canRefund && order.paymentStatus === 'paid' ? `<button class="btn btn-danger" id="refundBtn">Refund Order</button>` : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Notes</h2></div>
          <div class="card-pad">
            <div id="notesList" style="display:flex;flex-direction:column;gap:.6rem;margin-bottom:1rem">
              ${order.notes.length ? order.notes.map((n) => `<div style="font-size:.82rem;border-bottom:1px solid var(--a-border);padding-bottom:.5rem"><p>${n.text}</p><p style="color:var(--a-muted);font-size:.72rem;margin-top:.2rem">${formatDateTime(n.at)}</p></div>`).join('') : '<p style="color:var(--a-muted);font-size:.82rem">No internal notes yet.</p>'}
            </div>
            <div class="field" style="margin-bottom:.6rem"><textarea id="noteInput" rows="2" placeholder="Add an internal note…"></textarea></div>
            <button class="btn btn-outline" id="addNoteBtn" style="width:100%">Add Note</button>
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
    const updated = await updateOrderStatus(order.id, status);
    showAdminToast('Order status updated.', 'success');
    render(updated);
  });

  document.getElementById('cancelBtn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Cancel Order?', body: 'This action cannot be easily reversed. The customer will be notified once this connects to a real notification system.', confirmLabel: 'Cancel Order' });
    if (!ok) return;
    const updated = await cancelOrder(order.id);
    showAdminToast('Order cancelled.', 'success');
    render(updated);
  });

  document.getElementById('refundBtn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Refund Order?', body: `This will mark the order as refunded. Real refunds must be processed through the payment provider once connected.`, confirmLabel: 'Refund Order' });
    if (!ok) return;
    const updated = await refundOrder(order.id);
    showAdminToast('Order marked as refunded.', 'success');
    render(updated);
  });

  document.getElementById('addNoteBtn').addEventListener('click', async () => {
    const text = document.getElementById('noteInput').value.trim();
    if (!text) return;
    const updated = await addOrderNote(order.id, text);
    showAdminToast('Note added.', 'success');
    render(updated);
  });
}

function renderTimeline(order) {
  const steps = ['Order created', 'Payment confirmed', 'Processing', 'Packed', 'Shipped', 'Delivered'];
  const statusIndex = { pending: 1, processing: 2, shipped: 4, delivered: 5, cancelled: -1, returned: -1 };
  const currentIdx = statusIndex[order.status] ?? 0;
  document.getElementById('orderTimeline').innerHTML = steps.map((s, i) => `
    <div class="o-timeline__item" data-done="${i <= currentIdx}">
      <p class="o-timeline__title">${s}</p>
      ${i === 0 ? `<p class="o-timeline__time">${formatDateTime(order.createdAt)}</p>` : ''}
    </div>
  `).join('');
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
