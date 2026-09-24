import { initAdminShell } from '../components/shell.js';
import { showAdminToast } from '../components/toast.js';
import { hasPermission } from '../components/permissions.js';
import { getEmailStatus, getSettings, saveSettingsSection, sendAdminTestEmail } from '../services/settingsService.js';
import { escapeHtml } from '../components/utils.js';

const session = initAdminShell({ page: 'settings', title: 'Settings' });
const canEdit = session && hasPermission(session.role, 'settings.edit');
if (session) init();

let tab = 'general';
let settings;
let emailStatus;
const TABS = ['general', 'shipping', 'payments', 'email'];
const LABELS = { general: 'General', shipping: 'Shipping', payments: 'Payments', email: 'Email' };

async function init() {
  if (!hasPermission(session.role, 'settings.view')) {
    document.getElementById('settingsRoot').innerHTML = '<div class="admin-empty"><h3>Restricted</h3><p>You do not have permission to view store settings.</p></div>';
    return;
  }
  try {
    [settings, emailStatus] = await Promise.all([
      getSettings(),
      getEmailStatus().catch((error) => ({ loadError: error.message })),
    ]);
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
  } else if (tab === 'payments') {
    root.innerHTML = `
      <div class="card"><div class="card-pad">
        <div class="settings-row"><div><p class="settings-row__label">Cash on Delivery</p><p class="settings-row__desc">Customers pay the courier when the order arrives.</p></div><span class="badge badge--success">Enabled</span></div>
        <div class="settings-row"><div><p class="settings-row__label">Online card payments</p><p class="settings-row__desc">Connect a payment provider and add signed webhooks before enabling cards.</p></div><span class="badge badge--neutral">Not connected</span></div>
      </div></div>`;
  } else {
    const ready = emailStatus?.configured;
    const statusLabel = emailStatus?.loadError ? 'Status unavailable' : ready ? `Ready · ${emailStatus.provider}` : 'Not configured';
    const details = emailStatus?.loadError
      ? `<p class="hint">${escapeHtml(emailStatus.loadError)}</p>`
      : ready
        ? '<p class="hint">A test message will be sent to your signed-in administrator email. Check Inbox and Spam. Provider acceptance confirms the connection; it does not guarantee inbox placement.</p>'
        : `<p class="hint">Add a mail provider in Railway → Nuvanti service → Variables, then redeploy. Missing variables: <span class="mono">${escapeHtml((emailStatus?.missing || []).join(', ') || 'unable to determine')}</span>.</p><p class="hint">Use either Resend with <span class="mono">RESEND_API_KEY</span> and <span class="mono">MAIL_FROM</span>, or SMTP with <span class="mono">SMTP_HOST</span>, <span class="mono">SMTP_PORT</span>, <span class="mono">SMTP_SECURE</span>, <span class="mono">SMTP_USER</span>, <span class="mono">SMTP_PASS</span>, and <span class="mono">MAIL_FROM</span>. Verify your sending domain/address with the provider first.</p>`;
    root.innerHTML = `<div class="card"><div class="card-pad">
      <div class="settings-row"><div><p class="settings-row__label">Transactional email</p><p class="settings-row__desc">Password resets, account verification, admin invitations, order confirmations, and newsletter confirmations.</p></div><span class="badge ${ready ? 'badge--success' : 'badge--neutral'}">${escapeHtml(statusLabel)}</span></div>
      ${details}
      ${canEdit ? `<button class="btn btn-primary" id="testEmailBtn" ${ready ? '' : 'disabled'}>Send test email to ${escapeHtml(session.email)}</button>` : '<p class="hint">Only a super administrator can send a test email.</p>'}
      <p class="hint">Contact form inquiries also appear in Customers → Contact Messages. Email alerts go to the Customer Support Email set in the General tab.</p>
    </div></div>`;
  }
}

function section(body) {
  return `<div class="card"><div class="card-pad">${body}${canEdit ? '<button class="btn btn-primary" id="saveSectionBtn">Save Changes</button>' : '<p class="hint">You have view-only access to settings.</p>'}</div></div>`;
}

document.getElementById('settingsRoot')?.addEventListener('click', async (event) => {
  const testEmailButton = event.target.closest('#testEmailBtn');
  if (testEmailButton && canEdit && emailStatus?.configured) {
    testEmailButton.disabled = true;
    testEmailButton.textContent = 'Sending…';
    try {
      const result = await sendAdminTestEmail();
      showAdminToast(result.message || 'Test email accepted by the provider. Check Inbox and Spam.', 'success');
    } catch (error) {
      showAdminToast(error.message, 'error');
      testEmailButton.disabled = false;
      testEmailButton.textContent = `Send test email to ${session.email}`;
    }
    return;
  }
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
