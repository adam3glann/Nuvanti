import { mockAdminLogin, getAdminSession } from '../services/adminAuthService.js';

(function () {
  if (localStorage.getItem('nuvanti_admin_theme') === 'dark') document.documentElement.dataset.theme = 'dark';
})();
if (getAdminSession()) location.href = 'index.html';

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const submitBtn = document.getElementById('loginSubmit');
const passwordInput = document.getElementById('password');
document.getElementById('togglePassword').addEventListener('click', () => {
  const hidden = passwordInput.type === 'password';
  passwordInput.type = hidden ? 'text' : 'password';
  document.getElementById('togglePassword').textContent = hidden ? 'Hide' : 'Show';
});
document.getElementById('forgotPassword').addEventListener('click', () => {
  const help = document.getElementById('passwordHelp');
  help.hidden = false;
  help.textContent = 'For security, admin passwords are reset by the store owner from the backend terminal: npm run reset:admin -- your-email@example.com a-new-strong-password. The new password must have 12 or more characters.';
});
form.addEventListener('submit', async (event) => {
  event.preventDefault(); errorBox.hidden = true;
  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  if (!email || !password) { errorBox.textContent = 'Enter your email and password.'; errorBox.hidden = false; return; }
  submitBtn.disabled = true; submitBtn.textContent = 'Signing in…';
  const result = await mockAdminLogin(email, password);
  if (!result.ok) { errorBox.textContent = result.error; errorBox.hidden = false; submitBtn.disabled = false; submitBtn.textContent = 'Sign In'; return; }
  location.href = 'index.html';
});
