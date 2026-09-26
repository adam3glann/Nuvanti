import { initAdminShell } from '../components/shell.js';
import { formatPrice, formatDate, escapeHtml } from '../components/utils.js';
import { statusBadge } from '../components/statusBadge.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { hasPermission } from '../components/permissions.js';
import { fetchAdminCustomer, toggleCustomerStatus } from '../services/customerService.js';

const id = new URLSearchParams(location.search).get('id');
const session = initAdminShell({ page: 'customers', title: 'Customer Details' });
const canDisable = session && hasPermission(session.role, 'customers.disable');
if (session) init();

async function init() {
  if (!id) {
    document.getElementById('custRoot').innerHTML = '<div class="admin-empty"><h3>No customer selected</h3><p>Return to the customer list and open a customer again.</p><a href="customers.html" class="btn btn-primary">Back to Customers</a></div>';
    return;
  }
  try {
    const customer = await fetchAdminCustomer(id);
    if (!customer) {
      document.getElementById('custRoot').innerHTML = '<div class="admin-empty"><h3>Customer not found</h3><a href="customers.html" class="btn btn-primary">Back to Customers</a></div>';
      return;
    }
    render(customer);
  } catch (error) {
    document.getElementById('custRoot').innerHTML = `<div class="admin-empty"><h3>Customer could not be loaded</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function render(customer) {
  document.title = `${customer.name} — Nuvanti Admin`;
  document.getElementById('pageHeading').textContent = customer.name;
  const recentShipping = customer.orders.find((order) => order.shippingAddress && typeof order.shippingAddress === 'object')?.shippingAddress;
  const phone = recentShipping?.phone || customer.addresses.find((address) => address.phone)?.phone;
  const savedAddresses = customer.addresses.length ? customer.addresses.map((a) => `
    <div style="padding:.65rem 0;border-bottom:1px solid var(--a-border)">
      <strong>${escapeHtml(a.label || a.name || 'Saved address')}</strong>${a.isDefault ? ' <span class="status-badge status-neutral">Default</span>' : ''}
      <div>${escapeHtml([a.name, a.address1, a.city, a.country, a.postalCode].filter(Boolean).join(', '))}</div>
      ${a.phone ? `<div>Phone: ${escapeHtml(a.phone)}</div>` : ''}
    </div>
  `).join('') : '<p style="color:var(--a-muted)">No saved address-book entries.</p>';
  const deliveryAddresses = customer.orders.filter((order) => order.shippingAddress && typeof order.shippingAddress === 'object').map((order) => {
    const a = order.shippingAddress;
    return `<div style="padding:.65rem 0;border-bottom:1px solid var(--a-border)">
      <strong>Order NV-${escapeHtml(order.id)}</strong>
      <div>${escapeHtml([a.name, a.address1, a.city, a.country, a.postalCode].filter(Boolean).join(', ') || 'Address not provided')}</div>
      ${a.phone ? `<div>Phone: <a href="tel:${encodeURIComponent(a.phone)}">${escapeHtml(a.phone)}</a></div>` : ''}
    </div>`;
  }).join('') || '<p style="color:var(--a-muted)">No delivery details recorded on orders yet.</p>';
  const orders = customer.orders.length ? customer.orders.map((o) => `
    <tr><td><a class="mono" href="order-detail.html?id=NV-${encodeURIComponent(o.id)}" style="color:var(--a-primary);font-weight:600">NV-${escapeHtml(o.id)}</a></td>
    <td>${formatDate(o.createdAt)}</td><td>${Number(o.itemCount) || 0}</td><td>${escapeHtml([o.shippingAddress?.city, o.shippingAddress?.country].filter(Boolean).join(', ') || '—')}</td><td>${formatPrice(Number(o.totalCents) / 100)}</td><td>${statusBadge(o.status)}</td></tr>
  `).join('') : '<tr><td colspan="6"><div class="admin-empty"><p>No orders yet.</p></div></td></tr>';
  document.getElementById('custRoot').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 2fr;gap:1.25rem" class="cd-grid">
      <div>
        <div class="card" style="margin-bottom:1.25rem"><div class="card-head"><h2>Profile</h2>${statusBadge(customer.status)}</div>
          <div class="card-pad" style="display:flex;flex-direction:column;gap:.5rem;font-size:.85rem">
            <div><span style="color:var(--a-muted)">Email</span><br />${escapeHtml(customer.email)}</div>
            <div><span style="color:var(--a-muted)">Phone (most recent order)</span><br />${phone ? `<a href="tel:${encodeURIComponent(phone)}">${escapeHtml(phone)}</a>` : 'Not provided'}</div>
            <div><span style="color:var(--a-muted)">Total spent</span><br /><strong>${formatPrice(customer.totalSpent)}</strong></div>
            <div><span style="color:var(--a-muted)">Orders</span><br />${customer.orderCount}</div>
            <div><span style="color:var(--a-muted)">Customer since</span><br />${formatDate(customer.createdAt)}</div>
          </div>
        </div>
        <div class="card" style="margin-bottom:1.25rem"><div class="card-head"><h2>Saved addresses</h2></div><div class="card-pad" style="font-size:.85rem">${savedAddresses}</div></div>
        <div class="card" style="margin-bottom:1.25rem"><div class="card-head"><h2>Delivery details from orders</h2></div><div class="card-pad" style="font-size:.85rem">${deliveryAddresses}</div></div>
        ${canDisable ? `<div class="card"><div class="card-head"><h2>Account access</h2></div><div class="card-pad"><button class="btn btn-outline" id="toggleStatusBtn" style="width:100%">${customer.status === 'active' ? 'Disable account' : 'Enable account'}</button></div></div>` : ''}
      </div>
      <div class="card"><div class="card-head"><h2>Order history</h2></div><div class="table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Units</th><th>Delivery location</th><th>Total</th><th>Status</th></tr></thead><tbody>${orders}</tbody></table></div></div>
    </div>`;

  document.getElementById('toggleStatusBtn')?.addEventListener('click', async () => {
    const disabling = customer.status === 'active';
    const ok = await confirmDialog({ title: `${disabling ? 'Disable' : 'Enable'} this account?`, body: disabling ? 'The customer will be signed out and will not be able to sign in until access is restored.' : 'The customer will be able to sign in again.', confirmLabel: disabling ? 'Disable account' : 'Enable account', danger: disabling });
    if (!ok) return;
    try { render(await toggleCustomerStatus(customer.id)); showAdminToast('Customer access updated.', 'success'); }
    catch (error) { showAdminToast(error.message, 'error'); }
  });
}
