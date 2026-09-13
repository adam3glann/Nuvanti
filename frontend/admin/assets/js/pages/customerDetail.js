import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate, formatDateTime } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { hasPermission } from '../components/permissions.js';
import { fetchAdminCustomer, toggleCustomerStatus, addCustomerNote } from '../services/customerService.js';
import { orders as allOrders } from '../data/orders.js';

const session = initAdminShell({ page: 'customers', title: 'Customer Details' });
if (session) init();

const params = new URLSearchParams(location.search);
const id = params.get('id');
const canEdit = session && hasPermission(session.role, 'customers.edit');
const canDisable = session && hasPermission(session.role, 'customers.disable');

async function init() {
  const customer = await fetchAdminCustomer(id);
  if (!customer) {
    document.getElementById('custRoot').innerHTML = `<div class="admin-empty"><h3>Customer not found</h3><a href="customers.html" class="btn btn-primary">Back to Customers</a></div>`;
    return;
  }
  render(customer);
}

function render(customer) {
  document.title = `${customer.name} — Nuvanti Admin`;
  document.getElementById('pageHeading').textContent = customer.name;

  const orders = allOrders.filter((o) => customer.orders.includes(o.id));

  document.getElementById('custRoot').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:1.25rem" class="cd-grid">
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Profile</h2>${statusBadge(customer.status)}</div>
          <div class="card-pad" style="display:flex;flex-direction:column;gap:.5rem;font-size:.85rem">
            <div><span style="color:var(--a-muted)">Email</span><br />${customer.email}</div>
            <div><span style="color:var(--a-muted)">Phone</span><br />${customer.phone}</div>
            <div><span style="color:var(--a-muted)">Total Spent</span><br /><strong>${formatPrice(customer.totalSpent)}</strong></div>
            <div><span style="color:var(--a-muted)">Orders</span><br />${customer.orderCount}</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Addresses</h2></div>
          <div class="card-pad" style="font-size:.85rem">
            ${customer.addresses.map((a) => `<p>${a.city}, ${a.country} ${a.isDefault ? '<span class="status-badge status-neutral">Default</span>' : ''}</p>`).join('')}
          </div>
        </div>

        ${canEdit ? `
        <div class="card">
          <div class="card-head"><h2>Account</h2></div>
          <div class="card-pad">
            ${canDisable ? `<button class="btn btn-outline" id="toggleStatusBtn" style="width:100%">${customer.status === 'active' ? 'Disable Account' : 'Enable Account'}</button>` : ''}
          </div>
        </div>` : ''}
      </div>

      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Order History</h2></div>
          <div class="table-wrap">
            <table class="admin-table">
              <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                ${orders.map((o) => `
                  <tr>
                    <td><a class="mono" href="order-detail.html?id=${o.id}" style="color:var(--a-primary);font-weight:600">${o.id}</a></td>
                    <td>${formatDate(o.createdAt)}</td>
                    <td>${o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td>${formatPrice(o.total)}</td>
                    <td>${statusBadge(o.status)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Internal Notes</h2></div>
          <div class="card-pad">
            <div style="display:flex;flex-direction:column;gap:.6rem;margin-bottom:1rem">
              ${customer.notes.length ? customer.notes.map((n) => `<div style="font-size:.82rem;border-bottom:1px solid var(--a-border);padding-bottom:.5rem"><p>${n.text}</p><p style="color:var(--a-muted);font-size:.72rem;margin-top:.2rem">${formatDateTime(n.at)}</p></div>`).join('') : '<p style="color:var(--a-muted);font-size:.82rem">No notes yet. Notes are internal and never visible to the customer.</p>'}
            </div>
            ${canEdit ? `
              <div class="field" style="margin-bottom:.6rem"><textarea id="noteInput" rows="2" placeholder="Add an internal note…"></textarea></div>
              <button class="btn btn-outline" id="addNoteBtn" style="width:100%">Add Note</button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('toggleStatusBtn')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: `${customer.status === 'active' ? 'Disable' : 'Enable'} this account?`, body: 'This changes whether the customer can sign in and place orders once account sync is connected.', confirmLabel: customer.status === 'active' ? 'Disable' : 'Enable', danger: customer.status === 'active' });
    if (!ok) return;
    const updated = await toggleCustomerStatus(customer.id);
    showAdminToast('Customer status updated.', 'success');
    render(updated);
  });

  document.getElementById('addNoteBtn')?.addEventListener('click', async () => {
    const text = document.getElementById('noteInput').value.trim();
    if (!text) return;
    const updated = await addCustomerNote(customer.id, text);
    showAdminToast('Note added.', 'success');
    render(updated);
  });
}
