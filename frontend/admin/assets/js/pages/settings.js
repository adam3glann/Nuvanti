import { initAdminShell } from '../components/shell.js';
import { showAdminToast } from '../components/toast.js';
import { hasPermission } from '../components/permissions.js';
import { getSettings, saveSettingsSection } from '../services/settingsService.js';
import { escapeHtml } from '../components/utils.js';

const session = initAdminShell({ page: 'settings', title: 'Settings' });
const canEdit = session && hasPermission(session.role, 'settings.edit');
if (session) init();

let tab = 'general';
let settings;
const TABS = ['general', 'shipping', 'payments'];
const LABELS = { general: 'General', shipping: 'Shipping', payments: 'Payments' };

async function init() {
  if (!hasPermission(session.role, 'settings.view')) {
    document.getElementById('settingsRoot').innerHTML = '<div class="admin-empty"><h3>Restricted</h3><p>You do not have permission to view store settings.</p></div>';
    return;
  }
  try {
    settings = await getSettings();
    render();
  } catch (error) {
    document.getElementById('settingsPanel').innerHTML = `<div class="admin-empty"><h3>Settings unavailable</h3><p>${escapeHtml(error.message)}</p><button class="btn btn-outline" id="retrySettings">Try Again</button></div>`;
    document.getElementById('retrySettings')?.addEventListener('click', init);
  }
}

function render() {
  document.getElementById('tabs').innerHTML = TABS.map((name) => `<button class="admin-tab" data-tab="${name}" aria-selected="${tab === name}">${LABELS[name]}</button>`).join('');
  document.querySelectorAll('.admin-tab').forEach((button) => button.addEventListener('click', () => {
    tab = button.dataset.tab;
    render();
  }));

  const root = document.getElementById('settingsPanel');
  if (tab === 'general') {
    root.innerHTML = section(`
      <div class="field"><label for="storeName">Store Name</label><input id="storeName" value="${escapeHtml(settings.general.storeName)}" maxlength="100" ${disabled()} /></div>
      <div class="field"><label for="contactEmail">Customer Support Email</label><input id="contactEmail" type="email" value="${escapeHtml(settings.general.contactEmail)}" maxlength="254" ${disabled()} /></div>
      <p class="hint">Prices are displayed in ${escapeHtml(settings.general.currency)}. Change your customer-facing support details here.</p>
    `);
  } else if (tab === 'shipping') {
    root.innerHTML = section(`
      <div class="field"><label for="freeShippingThreshold">Free Shipping Threshold (EGP)</label><input type="number" min="0" step="0.01" id="freeShippingThreshold" value="${settings.shipping.freeShippingThreshold}" ${disabled()} /></div>
      <div class="field-row">
        <div class="field"><label for="standardCost">Standard Shipping Cost (EGP)</label><input type="number" min="0" step="0.01" id="standardCost" value="${settings.shipping.standardCost}" ${disabled()} /></div>
        <div class="field"><label for="expressCost">Express Shipping Cost (EGP)</label><input type="number" min="0" step="0.01" id="expressCost" value="${settings.shipping.expressCost}" ${disabled()} /></div>
      </div>
      <p class="hint">These amounts update the checkout total immediately. The server recalculates the final amount when an order is placed.</p>
    `);
  } else {
    root.innerHTML = `
      <div class="card"><div class="card-pad">
        <div class="settings-row"><div><p class="settings-row__label">Cash on Delivery</p><p class="settings-row__desc">Customers pay the courier when the order arrives.</p></div><span class="badge badge--success">Enabled</span></div>
        <div class="settings-row"><div><p class="settings-row__label">Online card payments</p><p class="settings-row__desc">Connect a payment provider and add signed webhooks before enabling cards.</p></div><span class="badge badge--neutral">Not connected</span></div>
      </div></div>`;
  }
}

function section(body) {
  return `<div class="card"><div class="card-pad">${body}${canEdit ? '<button class="btn btn-primary" id="saveSectionBtn">Save Changes</button>' : '<p class="hint">You have view-only access to settings.</p>'}</div></div>`;
}

document.getElementById('settingsRoot')?.addEventListener('click', async (event) => {
  const button = event.target.closest('#saveSectionBtn');
  if (!button || !canEdit || !settings) return;
  const sectionName = tab;
  const data = sectionName === 'general'
    ? { storeName: value('storeName').trim(), contactEmail: value('contactEmail').trim() }
    : {
        freeShippingThreshold: numberValue('freeShippingThreshold'),
        standardCost: numberValue('standardCost'),
        expressCost: numberValue('expressCost'),
      };
  if (sectionName === 'general' && (!data.storeName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail))) {
    showAdminToast('Enter a store name and a valid support email.', 'error');
    return;
  }
  if (sectionName === 'shipping' && Object.values(data).some((amount) => !Number.isFinite(amount) || amount < 0)) {
    showAdminToast('Shipping amounts must be zero or greater.', 'error');
    return;
  }
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    settings = await saveSettingsSection(sectionName, data);
    showAdminToast('Settings saved.', 'success');
    render();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Save Changes';
    showAdminToast(error.message, 'error');
  }
});

function disabled() { return canEdit ? '' : 'disabled'; }
function value(id) { return document.getElementById(id)?.value ?? ''; }
function numberValue(id) { return Number(value(id)); }
