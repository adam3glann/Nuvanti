import { initAdminShell } from '../components/shell.js';
import { showAdminToast } from '../components/toast.js';
import { hasPermission } from '../components/permissions.js';
import { getEmailStatus, getSettings, saveSettingsSection, sendAdminTestEmail } from '../services/settingsService.js';
import { escapeHtml } from '../components/utils.js';
import { startLiveRefresh } from '../services/liveRefresh.js';

const session = initAdminShell({ page: 'settings', title: 'Settings' });
const canEdit = session && hasPermission(session.role, 'settings.edit');
if (session) { init(); startLiveRefresh(init, 20000, { pauseWhileEditing: true }); }

let tab = 'general';
let settings;
let emailStatus;
const TABS = ['general', 'announcement', 'shipping', 'payments', 'email'];
const LABELS = { general: 'General', announcement: 'Announcement Strip', shipping: 'Shipping', payments: 'Payments', email: 'Email' };

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
  } else if (tab === 'announcement') {
    const announcement = settings.announcement;
    root.innerHTML = `<div class="card"><div class="card-pad">
      <div class="settings-row"><div><p class="settings-row__label" id="announcementEnabledLabel">Show announcement strip</p><p class="settings-row__desc">A scrolling message shown above the store navigation.</p></div><label class="a-switch"><input type="checkbox" id="announcementEnabled" aria-labelledby="announcementEnabledLabel" ${announcement.enabled ? 'checked' : ''} ${disabled()}><span class="a-switch-track"></span></label></div>
      <div class="field"><label for="announcementText">Strip message</label><input id="announcementText" maxlength="240" value="${escapeHtml(announcement.text)}" placeholder="Free shipping over EGP 3,000" ${disabled()}><p class="hint">Keep it short so customers can read it as it scrolls.</p></div>
      <div class="field-row">
        <div class="field"><label for="announcementTheme">Theme</label><select id="announcementTheme" ${disabled()}><option value="midnight" ${announcement.theme === 'midnight' ? 'selected' : ''}>Midnight</option><option value="cream" ${announcement.theme === 'cream' ? 'selected' : ''}>Soft Cream</option><option value="citrus" ${announcement.theme === 'citrus' ? 'selected' : ''}>Citrus</option><option value="rose" ${announcement.theme === 'rose' ? 'selected' : ''}>Rose</option><option value="custom" ${announcement.theme === 'custom' ? 'selected' : ''}>Custom</option></select><p class="hint">Choose a preset, then adjust its colors and pattern.</p></div>
        <div class="field"><label for="announcementPattern">Pattern</label><select id="announcementPattern" ${disabled()}><option value="solid" ${announcement.pattern === 'solid' ? 'selected' : ''}>Solid</option><option value="stripes" ${announcement.pattern === 'stripes' ? 'selected' : ''}>Diagonal stripes</option><option value="dots" ${announcement.pattern === 'dots' ? 'selected' : ''}>Dots</option><option value="checker" ${announcement.pattern === 'checker' ? 'selected' : ''}>Checker</option><option value="waves" ${announcement.pattern === 'waves' ? 'selected' : ''}>Waves</option></select></div>
      </div>
      <div class="field-row">
        <div class="field"><label for="announcementBackgroundColor">Strip color</label><div class="announcement-color-field"><input type="color" id="announcementBackgroundColor" value="${announcement.backgroundColor}" ${disabled()}><input type="text" data-color-text="announcementBackgroundColor" value="${announcement.backgroundColor}" maxlength="7" pattern="#[0-9a-fA-F]{6}" aria-label="Strip color hex value" ${disabled()}></div></div>
        <div class="field"><label for="announcementTextColor">Text color</label><div class="announcement-color-field"><input type="color" id="announcementTextColor" value="${announcement.textColor}" ${disabled()}><input type="text" data-color-text="announcementTextColor" value="${announcement.textColor}" maxlength="7" pattern="#[0-9a-fA-F]{6}" aria-label="Text color hex value" ${disabled()}></div></div>
      </div>
      <div class="announcement-preview-wrap"><p class="settings-row__label">Preview</p><div id="announcementPreview" class="store-announcement" data-pattern="${announcement.pattern}" style="--announcement-bg:${announcement.backgroundColor};--announcement-fg:${announcement.textColor}"><div class="store-announcement__track"><span class="store-announcement__group"><span>${escapeHtml(announcement.text)}</span><span class="store-announcement__separator" aria-hidden="true">✦</span><span aria-hidden="true">${escapeHtml(announcement.text)}</span></span></div></div></div>
      ${canEdit ? '<button class="btn btn-primary" id="saveSectionBtn">Save Changes</button>' : '<p class="hint">You have view-only access to store settings.</p>'}
    </div></div>`;
  } else if (tab === 'shipping') {
    root.innerHTML = section(`
      <div class="field"><label for="freeShippingThreshold">Free Shipping Threshold (EGP)</label><input type="number" min="0" step="0.01" id="freeShippingThreshold" value="${settings.shipping.freeShippingThreshold}" ${disabled()} /></div>
      <div class="field-row">
        <div class="field"><label for="standardCost">Standard Shipping Cost (EGP)</label><input type="number" min="0" step="0.01" id="standardCost" value="${settings.shipping.standardCost}" ${disabled()} /></div>
        <div class="field"><label for="expressCost">Express Shipping Cost (EGP)</label><input type="number" min="0" step="0.01" id="expressCost" value="${settings.shipping.expressCost}" ${disabled()} /></div>
      </div>
      <div class="field"><label for="shippingLocations">Delivery locations and prices</label><textarea id="shippingLocations" rows="8" placeholder="Cairo | 75 | 150">${escapeHtml(settings.shipping.locations.map((item) => `${item.name} | ${item.standard} | ${item.express}`).join('\n'))}</textarea><small class="hint">One location per line: Location name | Standard price (EGP) | Express price (EGP). Customers must choose one of these at checkout.</small></div>
      <p class="hint">The server recalculates the location price when an order is placed.</p>
    `);
  } else if (tab === 'payments') {
    const configured = settings.payments.onlinePaymentConfigured;
    const enabled = settings.payments.onlinePaymentEnabled;
    root.innerHTML = `
      <div class="card"><div class="card-pad">
        <div class="settings-row"><div><p class="settings-row__label">Cash on Delivery</p><p class="settings-row__desc">Customers pay the courier when the order arrives.</p></div><span class="badge badge--success">Enabled</span></div>
        <div class="settings-row"><div><p class="settings-row__label">Online card payments</p><p class="settings-row__desc">${configured ? 'Choose whether customers can select online payment at checkout.' : 'Add valid Paymob keys, payment method IDs, and webhook secret in Railway before enabling cards.'}</p></div><span class="badge ${enabled && configured ? 'badge--success' : 'badge--neutral'}">${enabled && configured ? 'Enabled' : configured ? 'Off' : 'Not configured'}</span></div>
        <div class="settings-row"><div><p class="settings-row__label" id="onlinePaymentsLabel">Accept online payments</p><p class="settings-row__desc">When off, new customers can only choose Cash on Delivery. Existing Paymob payment links may still work until they expire.</p></div><label class="a-switch"><input type="checkbox" id="onlinePaymentEnabled" aria-labelledby="onlinePaymentsLabel" ${enabled ? 'checked' : ''} ${!canEdit || !configured ? 'disabled' : ''}><span class="a-switch-track"></span></label></div>
        ${!configured ? '<p class="hint">Payments stay off until Paymob is fully configured. This switch starts off by default.</p>' : ''}
        <hr class="hr" style="margin-block:1.25rem" />
        <h3>InstaPay manual transfer</h3>
        <p class="hint">Customers transfer the order total and send a screenshot through WhatsApp. Transfers remain unpaid until an admin verifies them.</p>
        <div class="field"><label for="instapayRecipient">Receiving InstaPay details</label><textarea id="instapayRecipient" maxlength="200" rows="3" ${disabled()}>${escapeHtml(settings.payments.instapayRecipient)}</textarea></div>
        <div class="field"><label for="instapayWhatsappPhone">WhatsApp number (country code)</label><input id="instapayWhatsappPhone" type="tel" inputmode="tel" placeholder="+201012345678 or 201012345678" value="${escapeHtml(settings.payments.instapayWhatsappPhone)}" maxlength="30" aria-describedby="instapayPhoneHelp" ${disabled()} /><p class="hint" id="instapayPhoneHelp">Use the international country code, for example +20… or 20… for Egypt. Local Egyptian 01… numbers are also accepted and converted for WhatsApp.</p></div>
        <div class="settings-row"><div><p class="settings-row__label" id="instapayLabel">Accept InstaPay transfers</p><p class="settings-row__desc">Starts disabled. Set receiving details and WhatsApp number before enabling.</p></div><label class="a-switch"><input type="checkbox" id="instapayEnabled" aria-labelledby="instapayLabel" ${settings.payments.instapayEnabled ? 'checked' : ''} ${disabled()}><span class="a-switch-track"></span></label></div>
        ${canEdit ? '<button class="btn btn-primary" id="saveSectionBtn">Save Changes</button>' : '<p class="hint">You have view-only access to settings.</p>'}
      </div></div>`;
  } else {
    const ready = emailStatus?.configured;
    const statusLabel = emailStatus?.loadError ? 'Status unavailable' : ready ? `Ready · ${emailStatus.provider}` : 'Not configured';
    const details = emailStatus?.loadError
      ? `<p class="hint">${escapeHtml(emailStatus.loadError)}</p>`
      : ready
        ? '<p class="hint">A test message will be sent to your signed-in administrator email. Check Inbox and Spam. Provider acceptance confirms the connection; it does not guarantee inbox placement.</p>'
        : `<p class="hint">Add a mail provider in Railway → Nuvanti service → Variables, then redeploy. Missing variables: <span class="mono">${escapeHtml((emailStatus?.missing || []).join(', ') || 'unable to determine')}</span>.</p><p class="hint">Use SendGrid with <span class="mono">SENDGRID_API_KEY</span> and <span class="mono">MAIL_FROM</span> (verify the sender address in SendGrid), Resend with <span class="mono">RESEND_API_KEY</span> and a verified-domain <span class="mono">MAIL_FROM</span>, or SMTP with <span class="mono">SMTP_HOST</span>, <span class="mono">SMTP_PORT</span>, <span class="mono">SMTP_SECURE</span>, <span class="mono">SMTP_USER</span>, <span class="mono">SMTP_PASS</span>, and <span class="mono">MAIL_FROM</span>.</p>`;
    root.innerHTML = `<div class="card"><div class="card-pad">
      <div class="settings-row"><div><p class="settings-row__label">Transactional email</p><p class="settings-row__desc">Password resets, account verification, admin invitations, order confirmations, and newsletter confirmations.</p></div><span class="badge ${ready ? 'badge--success' : 'badge--neutral'}">${escapeHtml(statusLabel)}</span></div>
      ${details}
      ${canEdit ? `<button class="btn btn-primary" id="testEmailBtn" ${ready ? '' : 'disabled'}>Send test email to ${escapeHtml(session.email)}</button>` : '<p class="hint">Only a super administrator can send a test email.</p>'}
      <p class="hint">Contact form inquiries also appear in Customers → Contact Messages. Email alerts go to the Customer Support Email and active super administrators.</p>
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
    : sectionName === 'announcement'
      ? { enabled: document.getElementById('announcementEnabled').checked, text: value('announcementText').trim(), backgroundColor: colorValue('announcementBackgroundColor'), textColor: colorValue('announcementTextColor'), pattern: value('announcementPattern'), theme: value('announcementTheme') }
    : sectionName === 'payments'
      ? { onlinePaymentEnabled: document.getElementById('onlinePaymentEnabled')?.checked === true, instapayEnabled: document.getElementById('instapayEnabled')?.checked === true, instapayRecipient: value('instapayRecipient').trim(), instapayWhatsappPhone: value('instapayWhatsappPhone').trim() }
      : {
        freeShippingThreshold: numberValue('freeShippingThreshold'),
        standardCost: numberValue('standardCost'),
        expressCost: numberValue('expressCost'),
        locations: value('shippingLocations').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
          const [name, standard, express] = line.split('|').map((part) => part.trim());
          return { id: slugifyLocation(name || ''), name: name || '', standard: Number(standard), express: Number(express) };
        }),
      };
  if (sectionName === 'payments' && data.onlinePaymentEnabled && !settings.payments.onlinePaymentEnabled) {
    const accepted = window.confirm('Enable online card payments for customers? Confirm that your Paymob account is ready for live payments. You can turn this off here at any time.');
    if (!accepted) return;
  }
  if (sectionName === 'payments' && data.instapayEnabled && (!data.instapayRecipient || !/^(?:\+?[1-9]\d{7,14}|00[1-9]\d{7,14}|01[0125]\d{8})$/.test(data.instapayWhatsappPhone.replace(/[\s().-]/g, '')))) {
    showAdminToast('Enter receiving InstaPay details and a valid WhatsApp number with country code. Egyptian 01… numbers are also accepted.', 'error');
    return;
  }
  if (sectionName === 'general' && (!data.storeName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail))) {
    showAdminToast('Enter a store name and a valid support email.', 'error');
    return;
  }
  if (sectionName === 'announcement' && (!data.text || data.text.length > 240 || !/^#[0-9a-fA-F]{6}$/.test(data.backgroundColor) || !/^#[0-9a-fA-F]{6}$/.test(data.textColor))) {
    showAdminToast('Enter a message and valid six-digit hex colors.', 'error');
    return;
  }
  if (sectionName === 'shipping' && [data.freeShippingThreshold, data.standardCost, data.expressCost].some((amount) => !Number.isFinite(amount) || amount < 0)) {
    showAdminToast('Shipping amounts must be zero or greater.', 'error');
    return;
  }
  if (sectionName === 'shipping' && (data.locations.some((location) => location.name.length < 2 || !Number.isFinite(location.standard) || !Number.isFinite(location.express)) || new Set(data.locations.map((location) => location.id)).size !== data.locations.length)) {
    showAdminToast('Enter each location as Name | standard price | express price, using unique location names.', 'error');
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

const announcementThemes = {
  midnight: { background: '#17251e', text: '#ffffff', pattern: 'stripes' },
  cream: { background: '#f2eadb', text: '#27352b', pattern: 'dots' },
  citrus: { background: '#e5bc45', text: '#263021', pattern: 'checker' },
  rose: { background: '#9e5363', text: '#fff8f0', pattern: 'waves' },
};

document.getElementById('settingsPanel')?.addEventListener('change', (event) => {
  if (event.target.id === 'announcementTheme' && announcementThemes[event.target.value]) {
    const theme = announcementThemes[event.target.value];
    setColor('announcementBackgroundColor', theme.background);
    setColor('announcementTextColor', theme.text);
    document.getElementById('announcementPattern').value = theme.pattern;
  }
  if (event.target.matches('[data-color-text]')) {
    const colorInput = document.getElementById(event.target.dataset.colorText);
    if (/^#[0-9a-fA-F]{6}$/.test(event.target.value)) colorInput.value = event.target.value;
  }
  if (event.target.id === 'announcementPattern' || event.target.matches('[data-color-text]')) {
    const theme = document.getElementById('announcementTheme');
    if (theme) theme.value = 'custom';
  }
  updateAnnouncementPreview();
});
document.getElementById('settingsPanel')?.addEventListener('input', (event) => {
  if (event.target.matches('input[type="color"]')) {
    const textInput = document.querySelector(`[data-color-text="${event.target.id}"]`);
    if (textInput) textInput.value = event.target.value;
  }
  if (event.target.matches('[data-color-text]') && /^#[0-9a-fA-F]{6}$/.test(event.target.value)) {
    document.getElementById(event.target.dataset.colorText).value = event.target.value;
    const theme = document.getElementById('announcementTheme');
    if (theme) theme.value = 'custom';
  }
  updateAnnouncementPreview();
});

function setColor(id, color) {
  document.getElementById(id).value = color;
  document.querySelector(`[data-color-text="${id}"]`).value = color;
}
function updateAnnouncementPreview() {
  const preview = document.getElementById('announcementPreview');
  if (!preview) return;
  const background = value('announcementBackgroundColor');
  const foreground = value('announcementTextColor');
  if (/^#[0-9a-fA-F]{6}$/.test(background)) preview.style.setProperty('--announcement-bg', background);
  if (/^#[0-9a-fA-F]{6}$/.test(foreground)) preview.style.setProperty('--announcement-fg', foreground);
  preview.dataset.pattern = value('announcementPattern');
  const message = value('announcementText').trim() || 'Your announcement preview';
  preview.querySelectorAll('.store-announcement__group > span:not(.store-announcement__separator)').forEach((span) => { span.textContent = message; });
}

function disabled() { return canEdit ? '' : 'disabled'; }
function value(id) { return document.getElementById(id)?.value ?? ''; }
function colorValue(id) { return document.querySelector(`[data-color-text="${id}"]`)?.value ?? value(id); }
function numberValue(id) { return Number(value(id)); }
function slugifyLocation(name) {
  const base = name.normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 48) || 'location';
  return `${base}-${Array.from(name.normalize('NFKC').trim()).reduce((hash, char) => ((hash * 31) + char.codePointAt(0)) >>> 0, 7).toString(36)}`;
}
