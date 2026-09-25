import { initAdminShell } from '../components/shell.js';
import { createAdminModal } from '../components/modal.js';
import { showAdminToast } from '../components/toast.js';
import { escapeHtml } from '../components/utils.js';
import { changeAdminPassword } from '../services/adminAuthService.js';
import { beginMfaSetup, disableMfa, enableMfa, getActiveSessions, getMfaStatus, revokeOtherSessions, revokeSession } from '../services/securityService.js';

const session = initAdminShell({ page: 'security', title: 'Security' });
if (session) loadSecurity();

async function loadSecurity() {
  const root = document.getElementById('secRoot');
  root.innerHTML = '<div class="card card-pad"><p>Loading security settings…</p></div>';
  try {
    const [mfa, sessions] = await Promise.all([getMfaStatus(), getActiveSessions()]);
    render(mfa, sessions);
  } catch (error) {
    root.innerHTML = `<div class="admin-empty"><h2>Security settings unavailable</h2><p>${escapeHtml(error.message)}</p><button class="btn btn-outline" id="retrySecurity">Try Again</button></div>`;
    root.querySelector('#retrySecurity').addEventListener('click', loadSecurity);
  }
}

function render(mfa, sessions) {
  const root = document.getElementById('secRoot');
  const sessionRows = sessions.map((item) => `
    <div class="settings-row">
      <div><p class="settings-row__label">${item.isCurrent ? 'This device' : 'Signed-in device'}</p>
      <p class="settings-row__desc">${escapeHtml(deviceName(item.userAgent))} · Last active ${escapeHtml(formatDate(item.lastSeenAt))}</p></div>
      ${item.isCurrent ? '<span class="status-badge status-info">Current</span>' : `<button class="btn btn-outline btn-sm" data-revoke-session="${escapeHtml(item.id)}">Revoke</button>`}
    </div>`).join('');
  root.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.25rem" class="sec-grid">
      <div>
        <div class="card" style="margin-bottom:1.25rem">
          <div class="card-head"><h2>Account Security</h2></div>
          <div class="card-pad">
            <div class="settings-row"><div><p class="settings-row__label">Password</p><p class="settings-row__desc">Signed in as ${escapeHtml(session.email)}</p></div><button class="btn btn-outline btn-sm" id="changePwBtn">Change Password</button></div>
            <div class="settings-row"><div><p class="settings-row__label">Two-Factor Authentication</p><p class="settings-row__desc">Use an authenticator app and one-time recovery codes to protect admin sign-in.</p></div><span class="status-badge ${mfa.enabled ? 'status-success' : 'status-neutral'}">${mfa.enabled ? 'Enabled' : 'Not enabled'}</span></div>
            <div class="settings-row"><div><p class="settings-row__desc">${mfa.enabled ? `${Number(mfa.recoveryCodesRemaining)} recovery codes remain.` : 'Recommended for every administrator account.'}</p></div><button class="btn btn-outline btn-sm" id="mfaActionBtn">${mfa.enabled ? 'Manage 2FA' : 'Set Up 2FA'}</button></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-head" style="display:flex;justify-content:space-between;align-items:center"><h2>Active Sessions</h2><button class="btn btn-outline btn-sm" id="revokeOthersBtn" ${sessions.filter((item) => !item.isCurrent).length ? '' : 'disabled'}>Sign out other devices</button></div>
        <div class="card-pad">${sessionRows || '<p class="settings-row__desc">No active sessions were found. Sign in again to create a tracked session.</p>'}</div>
      </div>
    </div>`;
  root.querySelector('#changePwBtn').addEventListener('click', openChangePassword);
  root.querySelector('#mfaActionBtn').addEventListener('click', () => mfa.enabled ? openDisableMfa() : openEnableMfa());
  root.querySelector('#revokeOthersBtn').addEventListener('click', async () => {
    try { const result = await revokeOtherSessions(); showAdminToast(`Signed out ${result.revoked} other session${result.revoked === 1 ? '' : 's'}.`, 'success'); loadSecurity(); }
    catch (error) { showAdminToast(error.message, 'error'); }
  });
  root.querySelectorAll('[data-revoke-session]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try { await revokeSession(button.dataset.revokeSession); showAdminToast('Session revoked.', 'success'); loadSecurity(); }
    catch (error) { showAdminToast(error.message, 'error'); button.disabled = false; }
  }));
}

function openEnableMfa() {
  const modal = createAdminModal({
    title: 'Set up authenticator',
    bodyHTML: '<p class="hint">Enter your current password to start. The setup key will only be shown once.</p><div class="field"><label for="mfaCurrentPassword">Current password</label><input id="mfaCurrentPassword" type="password" autocomplete="current-password" /></div>',
    footHTML: '<button class="btn btn-outline" id="mfaCancel">Cancel</button><button class="btn btn-primary" id="mfaStart">Continue</button>',
  });
  modal.root.querySelector('#mfaCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mfaStart').addEventListener('click', async () => {
    const button = modal.root.querySelector('#mfaStart');
    button.disabled = true;
    try {
      const setup = await beginMfaSetup(modal.root.querySelector('#mfaCurrentPassword').value);
      modal.root.querySelector('.a-modal__body').innerHTML = `
        <p>In your authenticator app, choose <strong>Enter setup key</strong> and add this account:</p>
        <div class="field"><label>Account</label><input readonly value="${escapeHtml(session.email)}" /></div>
        <div class="field"><label>Setup key</label><input id="mfaSetupSecret" readonly value="${escapeHtml(setup.secret)}" /></div>
        <p class="hint">Use a time-based one-time password (TOTP). Keep the key private. It expires in 10 minutes.</p>
        <div class="field"><label for="mfaSetupCode">6-digit code from the app</label><input id="mfaSetupCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" /></div>`;
      modal.root.querySelector('.a-modal__foot').innerHTML = '<button class="btn btn-outline" id="mfaCopyKey">Copy setup key</button><button class="btn btn-primary" id="mfaVerifySetup">Verify and Enable</button>';
      modal.root.querySelector('#mfaCopyKey').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(setup.secret); showAdminToast('Setup key copied.', 'success'); }
        catch { const input = modal.root.querySelector('#mfaSetupSecret'); input.select(); showAdminToast('Copy the selected setup key.', 'info'); }
      });
      modal.root.querySelector('#mfaVerifySetup').addEventListener('click', async (event) => {
        const verifyButton = event.currentTarget;
        verifyButton.disabled = true;
        try {
          const result = await enableMfa(modal.root.querySelector('#mfaSetupCode').value.trim());
          const codes = result.recoveryCodes.map(escapeHtml).join('\n');
          modal.root.querySelector('.a-modal__body').innerHTML = `<p><strong>Two-factor authentication is enabled.</strong> Save these recovery codes somewhere private. Each works once; they cannot be shown again.</p><div class="field"><label for="recoveryCodes">Recovery codes</label><textarea id="recoveryCodes" readonly rows="10">${codes}</textarea></div>`;
          modal.root.querySelector('.a-modal__foot').innerHTML = '<button class="btn btn-outline" id="copyRecoveryCodes">Copy codes</button><button class="btn btn-primary" id="doneMfaSetup">Done</button>';
          modal.root.querySelector('#copyRecoveryCodes').addEventListener('click', async () => {
            const area = modal.root.querySelector('#recoveryCodes');
            try { await navigator.clipboard.writeText(area.value); showAdminToast('Recovery codes copied.', 'success'); }
            catch { area.select(); showAdminToast('Copy the selected recovery codes.', 'info'); }
          });
          modal.root.querySelector('#doneMfaSetup').addEventListener('click', () => { modal.close(); loadSecurity(); });
        } catch (error) { showAdminToast(error.message, 'error'); verifyButton.disabled = false; }
      });
    } catch (error) { showAdminToast(error.message, 'error'); button.disabled = false; }
  });
  modal.open();
}

function openDisableMfa() {
  const modal = createAdminModal({
    title: 'Disable two-factor authentication',
    bodyHTML: '<p class="hint">Confirm your password and a fresh authenticator code. This signs out your other sessions.</p><div class="field"><label for="mfaDisablePassword">Current password</label><input id="mfaDisablePassword" type="password" autocomplete="current-password" /></div><div class="field"><label for="mfaDisableCode">6-digit authenticator code</label><input id="mfaDisableCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" /></div>',
    footHTML: '<button class="btn btn-outline" id="mfaDisableCancel">Cancel</button><button class="btn btn-primary" id="mfaDisableConfirm">Disable 2FA</button>',
  });
  modal.root.querySelector('#mfaDisableCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mfaDisableConfirm').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try { await disableMfa(modal.root.querySelector('#mfaDisablePassword').value, modal.root.querySelector('#mfaDisableCode').value.trim()); modal.close(); showAdminToast('Two-factor authentication disabled.', 'success'); loadSecurity(); }
    catch (error) { showAdminToast(error.message, 'error'); button.disabled = false; }
  });
  modal.open();
}

function openChangePassword() {
  const modal = createAdminModal({
    title: 'Change Password',
    bodyHTML: '<div class="field"><label>Current Password</label><input type="password" id="curPw" autocomplete="current-password" /></div><div class="field"><label>New Password</label><input type="password" id="newPw" minlength="12" autocomplete="new-password" /><span class="hint">At least 12 characters.</span></div><div class="field"><label>Confirm New Password</label><input type="password" id="confirmPw" minlength="12" autocomplete="new-password" /></div>',
    footHTML: '<button class="btn btn-outline" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">Change Password</button>',
  });
  modal.root.querySelector('#mCancel').addEventListener('click', modal.close);
  modal.root.querySelector('#mSave').addEventListener('click', async () => {
    const current = modal.root.querySelector('#curPw').value;
    const next = modal.root.querySelector('#newPw').value;
    const confirm = modal.root.querySelector('#confirmPw').value;
    if (!current || !next) return showAdminToast('Enter your current and new password.', 'error');
    if (next !== confirm) return showAdminToast('New passwords do not match.', 'error');
    try { await changeAdminPassword(current, next); modal.close(); showAdminToast('Password changed. Other sessions were signed out.', 'success'); loadSecurity(); }
    catch (error) { showAdminToast(error.message, 'error'); }
  });
  modal.open();
}

function deviceName(userAgent) {
  const value = String(userAgent || 'Unknown browser');
  const browser = /Edg\//.test(value) ? 'Edge' : /Chrome\//.test(value) ? 'Chrome' : /Firefox\//.test(value) ? 'Firefox' : /Safari\//.test(value) ? 'Safari' : 'Browser';
  const device = /iPhone|iPad/.test(value) ? 'iPhone/iPad' : /Android/.test(value) ? 'Android device' : /Windows/.test(value) ? 'Windows' : /Mac OS/.test(value) ? 'Mac' : /Linux/.test(value) ? 'Linux' : 'Device';
  return `${browser} on ${device}`;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'unknown time' : date.toLocaleString();
}
