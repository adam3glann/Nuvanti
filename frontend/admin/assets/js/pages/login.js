import { mockAdminLogin, getAdminSession, DEMO_ACCOUNTS } from '../services/adminAuthService.js';
import { icon } from '../components/icons.js';

// Apply saved theme before paint.
(function () {
  const theme = localStorage.getItem('nuvanti_admin_theme');
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark';
})();

if (getAdminSession()) {
  location.href = 'index.html';
}

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const submitBtn = document.getElementById('loginSubmit');
const passwordInput = document.getElementById('password');

document.getElementById('togglePassword').addEventListener('click', () => {
  const isPw = passwordInput.type === 'password';
  passwordInput.type = isPw ? 'text' : 'password';
  document.getElementById('togglePassword').textContent = isPw ? 'Hide' : 'Show';
});

document.getElementById('demoAccounts').innerHTML = DEMO_ACCOUNTS.map((a) => `
  <button type="button" class="demo-account-btn" data-email="${a.email}" data-role="${a.role}">
    <span>${a.email}</span><span style="color:var(--a-muted);text-transform:capitalize">${a.role.replace('_', ' ')}</span>
  </button>
`).join('');

document.getElementById('demoAccounts')?.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-email]');
  if (!btn) return;
  document.getElementById('email').value = btn.dataset.email;
  passwordInput.value = 'demo1234';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  const remember = document.getElementById('rememberDevice').checked;

  if (!email || !password) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Signing In…';

  const result = await mockAdminLogin(email, password, remember);

  if (!result.ok) {
    errorBox.hidden = false;
    errorBox.textContent = result.error;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
    return;
  }

  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  location.href = next && next !== 'login.html' ? next : 'index.html';
});
