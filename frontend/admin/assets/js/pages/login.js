import { confirmAdminPasswordReset, getAdminSession, refreshAdminSession, loginAdmin, requestAdminPasswordReset } from '../services/adminAuthService.js';

const initialQuery = new URLSearchParams(location.search);
if (getAdminSession() && !initialQuery.has('reset') && initialQuery.get('forgot') !== '1') {
  refreshAdminSession().then((session) => { if (session) location.href = 'index.html'; }).catch(() => {});
}
const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const passwordInput = document.getElementById('password');
const params = new URLSearchParams(location.search);
const resetToken = params.get('reset');
const forgotMode = params.get('forgot') === '1';
const show = (message, isError = false) => { errorBox.hidden = false; errorBox.textContent = message; errorBox.className = isError ? 'form-error' : 'security-note'; };

document.getElementById('togglePassword').addEventListener('click', () => { const hidden = passwordInput.type === 'password'; passwordInput.type = hidden ? 'text' : 'password'; document.getElementById('togglePassword').textContent = hidden ? 'Hide' : 'Show'; });

if (resetToken) {
  document.querySelector('.h1').textContent = 'Choose a new password';
  document.querySelector('.admin-login-mark p').textContent = 'Use a new, strong password for your admin account.';
  form.innerHTML = `<div class="field"><label for="newPassword">New password</label><input type="password" id="newPassword" required minlength="12" autocomplete="new-password" /><span class="hint">At least 12 characters.</span></div><div class="field"><label for="confirmPassword">Confirm password</label><input type="password" id="confirmPassword" required minlength="12" autocomplete="new-password" /></div><button class="btn btn-primary" type="submit" id="loginSubmit" style="width:100%">Reset Password</button><p style="text-align:center;margin-top:1rem"><a href="login.html" class="btn-ghost">Back to sign in</a></p>`;
  document.getElementById('forgotPassword').closest('div').hidden = true;
  form.addEventListener('submit', async (event) => { event.preventDefault(); const password = document.getElementById('newPassword').value; if (password !== document.getElementById('confirmPassword').value) return show('Passwords do not match.', true); const button = document.getElementById('loginSubmit'); button.disabled = true; button.textContent = 'Saving…'; try { await confirmAdminPasswordReset(resetToken, password); show('Password updated. You can sign in now.'); form.reset(); button.textContent = 'Password Reset'; setTimeout(() => { location.href = 'login.html'; }, 1300); } catch (error) { show(error.message, true); button.disabled = false; button.textContent = 'Reset Password'; } });
} else if (forgotMode) {
  document.querySelector('.h1').textContent = 'Reset your password';
  document.querySelector('.admin-login-mark p').textContent = 'Enter your authorized admin email to receive a reset link.';
  form.innerHTML = `<div class="field"><label for="resetEmail">Admin email</label><input type="email" id="resetEmail" required autocomplete="email" /></div><button class="btn btn-primary" type="submit" id="loginSubmit" style="width:100%">Email Reset Link</button><p style="text-align:center;margin-top:1rem"><a href="login.html" class="btn-ghost">Back to sign in</a></p>`;
  document.getElementById('forgotPassword').closest('div').hidden = true;
  form.addEventListener('submit', async (event) => { event.preventDefault(); const button = document.getElementById('loginSubmit'); button.disabled = true; button.textContent = 'Sending…'; try { show(await requestAdminPasswordReset(document.getElementById('resetEmail').value)); button.textContent = 'Email Sent'; } catch (error) { show(error.message, true); button.disabled = false; button.textContent = 'Email Reset Link'; } });
} else {
  document.getElementById('forgotPassword').addEventListener('click', () => {
    location.href = 'login.html?forgot=1';
  });
  form.addEventListener('submit', async (event) => { event.preventDefault(); const button = document.getElementById('loginSubmit'); errorBox.hidden = true; button.disabled = true; button.textContent = 'Signing in…'; const result = await loginAdmin(document.getElementById('email').value.trim(), passwordInput.value); if (!result.ok) { show(result.error, true); button.disabled = false; button.textContent = 'Sign In'; return; } location.href = 'index.html'; });
}
