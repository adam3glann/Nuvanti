import { initShell } from '../main.js';
import { formatPrice } from '../components/productCard.js';
import { getSession, mockLogin, mockRegister, logout } from '../services/authService.js';
import { getLastOrder } from '../services/orderService.js';

initShell({ currentPage: 'account' });

const root = document.getElementById('accountRoot');
const params = new URLSearchParams(location.search);
let authView = 'login'; // login | register | forgot

render();

function render() {
  const session = getSession();
  if (!session) return renderAuth();
  renderDashboard(session, params.get('tab') || 'profile');
}

function renderAuth() {
  root.innerHTML = `
    <div class="auth-shell">
      <h1 class="h2" style="text-align:center;margin-bottom:1.75rem">${label()}</h1>
      <div id="authFormWrap"></div>
      <p class="auth-switch" id="authSwitch"></p>
    </div>
  `;
  renderAuthForm();
}

function label() {
  return authView === 'login' ? 'Sign In' : authView === 'register' ? 'Create Account' : 'Reset Password';
}

function renderAuthForm() {
  const wrap = document.getElementById('authFormWrap');
  const switchEl = document.getElementById('authSwitch');
  document.getElementById('accountRoot').querySelector('h1').textContent = label();

  if (authView === 'login') {
    wrap.innerHTML = `
      <form id="loginForm" novalidate>
        <div class="field"><label for="loginEmail">Email</label><input type="email" id="loginEmail" required /></div>
        <div class="field"><label for="loginPassword">Password</label><input type="password" id="loginPassword" required minlength="6" /></div>
        <button class="btn btn-primary btn-block" type="submit">Sign In</button>
      </form>
      <p style="text-align:center;margin-top:1rem"><button class="btn-text" id="toForgot" style="font-size:.85rem">Forgot password?</button></p>
    `;
    switchEl.innerHTML = `Don't have an account? <button class="btn-text" id="toRegister">Create one</button>`;
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkValid(e.target)) return;
      try { await mockLogin(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); render(); }
      catch (error) { showAuthError(error.message); }
    });
    document.getElementById('toForgot').addEventListener('click', () => { authView = 'forgot'; renderAuthForm(); });
    document.getElementById('toRegister').addEventListener('click', () => { authView = 'register'; renderAuthForm(); });
  } else if (authView === 'register') {
    wrap.innerHTML = `
      <form id="registerForm" novalidate>
        <div class="field"><label for="regName">Full Name</label><input type="text" id="regName" required /></div>
        <div class="field"><label for="regEmail">Email</label><input type="email" id="regEmail" required /></div>
        <div class="field"><label for="regPassword">Password</label><input type="password" id="regPassword" required minlength="8" /><span class="hint">At least 8 characters.</span></div>
        <button class="btn btn-primary btn-block" type="submit">Create Account</button>
      </form>
    `;
    switchEl.innerHTML = `Already have an account? <button class="btn-text" id="toLogin">Sign in</button>`;
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkValid(e.target)) return;
      try { await mockRegister(document.getElementById('regName').value, document.getElementById('regEmail').value, document.getElementById('regPassword').value); render(); }
      catch (error) { showAuthError(error.message); }
    });
    document.getElementById('toLogin').addEventListener('click', () => { authView = 'login'; renderAuthForm(); });
  } else {
    wrap.innerHTML = `
      <form id="forgotForm" novalidate>
        <p class="text-muted" style="margin-bottom:1rem;font-size:var(--fs-small)">Enter your email and we'll send a reset link.</p>
        <div class="field"><label for="forgotEmail">Email</label><input type="email" id="forgotEmail" required /></div>
        <button class="btn btn-primary btn-block" type="submit">Send Reset Link</button>
        <p class="text-muted" id="forgotSuccess" style="margin-top:1rem;font-size:var(--fs-small)" hidden>Password-reset emails are not enabled yet. Contact the store administrator for help.</p>
      </form>
    `;
    switchEl.innerHTML = `<button class="btn-text" id="toLogin">Back to sign in</button>`;
    document.getElementById('forgotForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!checkValid(e.target)) return;
      document.getElementById('forgotSuccess').hidden = false;
      e.target.querySelector('button[type="submit"]').disabled = true;
    });
    document.getElementById('toLogin').addEventListener('click', () => { authView = 'login'; renderAuthForm(); });
  }
}

function checkValid(form) {
  const inputs = form.querySelectorAll('input[required]');
  for (const input of inputs) {
    if (!input.checkValidity()) { input.reportValidity(); return false; }
  }
  return true;
}

function renderDashboard(session, tab) {
  const lastOrder = getLastOrder();
  root.innerHTML = `
    <div class="page-hero" style="border:none;padding-bottom:0"><h1>My Account</h1><p>Welcome back, ${session.name}.</p></div>
    <div class="account-layout">
      <nav class="account-nav" aria-label="Account">
        <a href="account.html?tab=profile" ${tab === 'profile' ? 'aria-current="page"' : ''}>Profile</a>
        <a href="account.html?tab=orders" ${tab === 'orders' ? 'aria-current="page"' : ''}>Orders</a>
        <a href="wishlist.html">Wishlist</a>
        <a href="account.html?tab=addresses" ${tab === 'addresses' ? 'aria-current="page"' : ''}>Addresses</a>
        <a href="#" id="logoutLink">Log Out</a>
      </nav>
      <div id="accountPanel"></div>
    </div>
  `;

  const panel = document.getElementById('accountPanel');
  if (tab === 'orders') {
    panel.innerHTML = lastOrder ? `
      <div class="order-row">
        <div>
          <strong>${lastOrder.orderNumber}</strong>
          <p class="text-muted" style="font-size:var(--fs-small)">${new Date(lastOrder.createdAt).toLocaleDateString()} · ${lastOrder.lines.length} item(s)</p>
        </div>
        <span>${formatPrice(lastOrder.total)}</span>
        <span class="badge badge--outline">Processing</span>
      </div>
    ` : `<div class="state-block"><h3>No orders yet</h3><p>Your order history will appear here once you place your first order.</p><a href="shop.html" class="btn btn-primary">Shop Now</a></div>`;
  } else if (tab === 'addresses') {
    panel.innerHTML = `
      <div class="state-block">
        <h3>No saved addresses</h3>
        <p>Add an address at checkout and it will be saved here for next time.</p>
      </div>`;
  } else {
    panel.innerHTML = `
      <div class="field"><label>Full Name</label><input type="text" value="${session.name}" disabled /></div>
      <div class="field"><label>Email</label><input type="email" value="${session.email}" disabled /></div>
      <p class="text-muted" style="font-size:var(--fs-small)">Profile editing will be available once account syncing is connected.</p>
    `;
  }

  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    logout().finally(render);
  });
}

function showAuthError(message) {
  const existing = document.getElementById('authError');
  if (existing) existing.remove();
  const error = document.createElement('p');
  error.id = 'authError'; error.className = 'form-error'; error.textContent = message;
  document.getElementById('authFormWrap').prepend(error);
}
