import { initAdminShell } from '../components/shell.js';
import { showAdminToast } from '../components/toast.js';
import { createAdminModal } from '../components/modal.js';
import { changeAdminPassword } from '../services/adminAuthService.js';

const session = initAdminShell({ page: 'security', title: 'Security' });
if (session) render(session);

function render(session) {
  document.getElementById('secRoot').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem" class="sec-grid">
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Account Security</h2></div>
          <div class="card-pad">
            <div class="settings-row"><div><p class="settings-row__label">Password</p><p class="settings-row__desc">Signed in as ${session.email}</p></div><button class="btn btn-outline btn-sm" id="changePwBtn">Change Password</button></div>
            <div class="settings-row"><div><p class="settings-row__label">Two-Factor Authentication</p><p class="settings-row__desc">Not enabled</p></div><button class="btn btn-outline btn-sm" id="enable2faBtn">Enable 2FA</button></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Active Sessions</h2></div>
        <div class="card-pad">
          <p style="color:var(--a-muted);font-size:.85rem">Per-device session tracking isn't available yet — sessions are currently a single signed-in cookie per browser, valid for 8 hours. If you need to force a sign-out everywhere, rotate <span class="mono">JWT_SECRET</span> on the server, which invalidates every existing session at once.</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('changePwBtn').addEventListener('click', openChangePassword);
  document.getElementById('enable2faBtn').addEventListener('click', open2FAModal);
}

function openChangePassword() {
  const modal = createAdminModal({
    title: 'Change Password',
    bodyHTML: `
      <div class="field"><label>Current Password</label><input type="password" id="curPw" autocomplete="current-password" /></div>
      <div class="field"><label>New Password</label><input type="password" id="newPw" minlength="12" autocomplete="new-password" /><span class="hint">At least 12 characters.</span></div>
      <div class="field"><label>Confirm New Password</label><input type="password" id="confirmPw" minlength="12" autocomplete="new-password" /></div>
    `,
    footHTML: `<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Change Password</button>`,
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const current = modal.root.querySelector('#curPw').value;
    const next = modal.root.querySelector('#newPw').value;
    const confirm = modal.root.querySelector('#confirmPw').value;
    if (!current || !next) return showAdminToast('Enter your current and new password.', 'error');
    if (next !== confirm) return showAdminToast('New passwords do not match.', 'error');
    try {
      await changeAdminPassword(current, next);
      modal.close();
      showAdminToast('Password changed.', 'success');
    } catch (error) { showAdminToast(error.message, 'error'); }
  });
  modal.open();
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
