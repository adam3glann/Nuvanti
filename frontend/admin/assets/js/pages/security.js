import { initAdminShell } from '../components/shell.js';
import { hasPermission } from '../components/permissions.js';
import { showAdminToast } from '../components/toast.js';
import { confirmDialog } from '../components/confirmDialog.js';
import { createAdminModal } from '../components/modal.js';

const session = initAdminShell({ page: 'security', title: 'Security' });
if (session) render(session);

const MOCK_SESSIONS = [
  { device: 'Chrome on macOS', location: 'Cairo, Egypt', lastActive: 'Active now', current: true },
  { device: 'Safari on iPhone', location: 'Cairo, Egypt', lastActive: '2 hours ago', current: false },
  { device: 'Chrome on Windows', location: 'Alexandria, Egypt', lastActive: '3 days ago', current: false },
];

const MOCK_ALERTS = [
  { text: 'Successful login from a new device (Chrome on Windows)', time: '3 days ago' },
  { text: 'Password changed', time: '2 weeks ago' },
  { text: '2 failed login attempts', time: '1 month ago' },
];

function render(session) {
  document.getElementById('secRoot').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem" class="sec-grid">
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Account Security</h2></div>
          <div class="card-pad">
            <div class="settings-row"><div><p class="settings-row__label">Password</p><p class="settings-row__desc">Last changed 2 weeks ago</p></div><button class="btn btn-outline btn-sm" id="changePwBtn">Change Password</button></div>
            <div class="settings-row"><div><p class="settings-row__label">Two-Factor Authentication</p><p class="settings-row__desc">Not enabled</p></div><button class="btn btn-outline btn-sm" id="enable2faBtn">Enable 2FA</button></div>
            <div class="settings-row"><div><p class="settings-row__label">Last Login</p><p class="settings-row__desc">Today from Cairo, Egypt</p></div></div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Security Alerts</h2></div>
          <div class="card-pad">
            ${MOCK_ALERTS.map((a) => `<div class="alert-list-item"><span>${a.text}</span><span style="color:var(--a-muted);font-size:.76rem">${a.time}</span></div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Active Sessions</h2></div>
        <div class="card-pad" id="sessionsList"></div>
        <div class="card-pad" style="border-top:1px solid var(--a-border)">
          <button class="btn btn-outline" id="logoutAllBtn" style="width:100%;color:var(--a-danger);border-color:var(--a-danger)">Log Out All Other Devices</button>
        </div>
      </div>
    </div>
  `;

  renderSessions();

  document.getElementById('changePwBtn').addEventListener('click', () => showAdminToast('Password changes will be handled by the backend once connected.', 'info'));
  document.getElementById('enable2faBtn').addEventListener('click', open2FAModal);
  document.getElementById('logoutAllBtn').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'Log Out All Other Devices?', body: 'This will end every active session except this one.', confirmLabel: 'Log Out All' });
    if (ok) showAdminToast('All other sessions ended.', 'success');
  });
}

function renderSessions() {
  document.getElementById('sessionsList').innerHTML = MOCK_SESSIONS.map((s) => `
    <div class="settings-row">
      <div>
        <p class="settings-row__label">${s.device} ${s.current ? '<span class="status-badge status-success">This device</span>' : ''}</p>
        <p class="settings-row__desc">${s.location} · ${s.lastActive}</p>
      </div>
      ${!s.current ? `<button class="btn btn-outline btn-sm" data-logout="${s.device}">Log Out</button>` : ''}
    </div>
  `).join('');
  document.querySelectorAll('[data-logout]').forEach((btn) => btn.addEventListener('click', () => {
    btn.closest('.settings-row').remove();
    showAdminToast('Device logged out.', 'success');
  }));
}

function open2FAModal() {
  const modal = createAdminModal({
    title: 'Enable Two-Factor Authentication',
    bodyHTML: `
      <p style="color:var(--a-muted);font-size:.85rem;margin-bottom:1rem">Scan this code with an authenticator app, then enter the 6-digit code to confirm.</p>
      <div style="width:160px;height:160px;background:var(--a-bg);border:1px dashed var(--a-border-strong);display:flex;align-items:center;justify-content:center;margin:0 auto 1.25rem;border-radius:8px;color:var(--a-muted);font-size:.75rem;text-align:center">QR Code<br/>Placeholder</div>
      <div class="field"><label>Verification Code</label><input id="totpCode" placeholder="123456" maxlength="6" /></div>
      <p class="hint">Backup codes will be generated once 2FA is connected to the backend. This screen is a UI placeholder — no real two-factor verification is performed yet.</p>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mConfirm">Verify & Enable</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mConfirm').addEventListener('click', () => {
    modal.close();
    showAdminToast('2FA setup will complete once connected to the backend.', 'info');
  });
  modal.open();
}
