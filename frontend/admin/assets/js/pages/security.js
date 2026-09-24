import { initAdminShell } from '../components/shell.js';
import { showAdminToast } from '../components/toast.js';
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
            <div class="settings-row"><div><p class="settings-row__label">Two-Factor Authentication</p><p class="settings-row__desc">Unavailable until server-side two-factor verification is implemented.</p></div><span class="badge badge--neutral">Unavailable</span></div>
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

