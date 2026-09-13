import { initAdminShell } from '../components/shell.js';
import { showAdminToast } from '../components/toast.js';
import { hasPermission } from '../components/permissions.js';
import { getSettings, saveSettingsSection } from '../services/settingsService.js';
import { statusBadge } from '../components/statusBadge.js';

const session = initAdminShell({ page: 'settings', title: 'Settings' });
const canEdit = session && hasPermission(session.role, 'settings.edit');
if (session) init();

let tab = 'general';

function init() {
  if (!hasPermission(session.role, 'settings.view')) {
    document.getElementById('settingsRoot').innerHTML = `<div class="admin-empty"><h3>Restricted</h3><p>You don't have permission to view store settings.</p></div>`;
    return;
  }
  renderTabs();
  render();
}

const TABS = ['general', 'checkout', 'shipping', 'payments', 'notifications', 'tax', 'localization'];
const LABELS = { general: 'General', checkout: 'Checkout', shipping: 'Shipping', payments: 'Payments', notifications: 'Notifications', tax: 'Tax', localization: 'Localization' };

function renderTabs() {
  document.getElementById('tabs').innerHTML = TABS.map((t) => `<button class="admin-tab" data-tab="${t}" aria-selected="${tab === t}">${LABELS[t]}</button>`).join('');
  document.querySelectorAll('.admin-tab').forEach((btn) => btn.addEventListener('click', () => { tab = btn.dataset.tab; renderTabs(); render(); }));
}

function render() {
  const s = getSettings();
  const root = document.getElementById('settingsPanel');

  if (tab === 'general') {
    root.innerHTML = section(`
      <div class="field"><label>Store Name</label><input id="storeName" value="${s.general.storeName}" ${dis()} /></div>
      <div class="field-row">
        <div class="field"><label>Contact Email</label><input id="contactEmail" value="${s.general.contactEmail}" ${dis()} /></div>
        <div class="field"><label>Phone</label><input id="phone" value="${s.general.phone}" ${dis()} /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Currency</label><input id="currency" value="${s.general.currency}" ${dis()} /></div>
        <div class="field"><label>Country</label><input id="country" value="${s.general.country}" ${dis()} /></div>
      </div>
    `, () => saveSettingsSection('general', {
      storeName: val('storeName'), contactEmail: val('contactEmail'), phone: val('phone'), currency: val('currency'), country: val('country'),
    }));
  } else if (tab === 'checkout') {
    root.innerHTML = section(`
      ${toggleRow('guestCheckout', 'Guest Checkout', 'Allow customers to check out without creating an account.', s.checkout.guestCheckout)}
      <div class="field" style="margin-top:1rem"><label>Minimum Order Value (EGP)</label><input type="number" id="minimumOrder" value="${s.checkout.minimumOrder}" ${dis()} /></div>
    `, () => saveSettingsSection('checkout', { guestCheckout: checked('guestCheckout'), minimumOrder: Number(val('minimumOrder')) || 0 }));
  } else if (tab === 'shipping') {
    root.innerHTML = section(`
      <div class="field"><label>Free Shipping Threshold (EGP)</label><input type="number" id="freeShippingThreshold" value="${s.shipping.freeShippingThreshold}" ${dis()} /></div>
      <div class="field-row">
        <div class="field"><label>Standard Shipping Cost (EGP)</label><input type="number" id="standardCost" value="${s.shipping.standardCost}" ${dis()} /></div>
        <div class="field"><label>Express Shipping Cost (EGP)</label><input type="number" id="expressCost" value="${s.shipping.expressCost}" ${dis()} /></div>
      </div>
    `, () => saveSettingsSection('shipping', { freeShippingThreshold: Number(val('freeShippingThreshold')) || 0, standardCost: Number(val('standardCost')) || 0, expressCost: Number(val('expressCost')) || 0 }));
  } else if (tab === 'payments') {
    root.innerHTML = `
      <div class="card"><div class="card-pad">
        ${s.payments.providers.map((p) => `
          <div class="settings-row">
            <div><p class="settings-row__label">${p.name}</p>${p.key ? `<p class="settings-row__desc mono">${p.key}</p>` : ''}</div>
            ${statusBadge(p.status)}
          </div>
        `).join('')}
        <p class="hint" style="margin-top:1rem">API keys are masked and cannot be edited from this UI. Real payment credentials are configured directly on the backend and never touch the frontend.</p>
      </div></div>
    `;
  } else if (tab === 'notifications') {
    root.innerHTML = section(`
      ${toggleRow('orderEmails', 'Order Confirmation Emails', 'Send customers a receipt when they place an order.', s.notifications.orderEmails)}
      ${toggleRow('shippingEmails', 'Shipping Update Emails', 'Notify customers when their order ships.', s.notifications.shippingEmails)}
      ${toggleRow('lowStockAlerts', 'Low Stock Alerts', 'Notify admins when inventory runs low.', s.notifications.lowStockAlerts)}
      ${toggleRow('adminNotifications', 'Admin Notification Center', 'Show in-app notifications for new orders and alerts.', s.notifications.adminNotifications)}
    `, () => saveSettingsSection('notifications', {
      orderEmails: checked('orderEmails'), shippingEmails: checked('shippingEmails'),
      lowStockAlerts: checked('lowStockAlerts'), adminNotifications: checked('adminNotifications'),
    }));
  } else if (tab === 'tax') {
    root.innerHTML = section(`
      ${toggleRow('taxEnabled', 'Enable Tax Calculation', 'Apply tax to orders at checkout.', s.tax.taxEnabled)}
      <div class="field" style="margin-top:1rem"><label>Tax Rate (%)</label><input type="number" id="taxRate" value="${s.tax.taxRate}" ${dis()} /></div>
    `, () => saveSettingsSection('tax', { taxEnabled: checked('taxEnabled'), taxRate: Number(val('taxRate')) || 0 }));
  } else {
    root.innerHTML = section(`
      <div class="field"><label>Language</label><input id="language" value="${s.localization.language}" ${dis()} /></div>
      <div class="field"><label>Timezone</label><input id="timezone" value="${s.localization.timezone}" ${dis()} /></div>
    `, () => saveSettingsSection('localization', { language: val('language'), timezone: val('timezone') }));
  }
}

function section(bodyHTML, onSave) {
  const html = `
    <div class="card"><div class="card-pad">
      ${bodyHTML}
      ${canEdit ? `<button class="btn btn-primary" id="saveSectionBtn" style="margin-top:.5rem">Save Changes</button>` : `<p class="hint" style="margin-top:1rem">You have view-only access to settings.</p>`}
    </div></div>
  `;
  setTimeout(() => document.getElementById('saveSectionBtn')?.addEventListener('click', () => { onSave(); showAdminToast('Settings saved.', 'success'); }), 0);
  return html;
}

function toggleRow(id, label, desc, checkedVal) {
  return `
    <div class="settings-row">
      <div><p class="settings-row__label">${label}</p><p class="settings-row__desc">${desc}</p></div>
      <label class="a-switch"><input type="checkbox" id="${id}" ${checkedVal ? 'checked' : ''} ${dis()} /><span class="a-switch-track"></span></label>
    </div>`;
}

function dis() { return canEdit ? '' : 'disabled'; }
function val(id) { return document.getElementById(id).value; }
function checked(id) { return document.getElementById(id).checked; }
