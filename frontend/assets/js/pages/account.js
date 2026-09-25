import { initShell } from '../main.js';
import { formatPrice } from '../components/productCard.js';
import { getSession, getCurrentUser, updateProfile, login, register, logout, requestPasswordReset, confirmPasswordReset, confirmEmailVerification, requestEmailVerification } from '../services/authService.js';
import { fetchMyOrders } from '../services/orderService.js';
import { fetchAddresses, createAddress, deleteAddress } from '../services/addressService.js';
import { showToast } from '../components/toast.js';

initShell({ currentPage: 'account' });

const root = document.getElementById('accountRoot');
const params = new URLSearchParams(location.search);
let authView = params.get('reset') ? 'reset' : 'login'; // login | register | forgot | reset

render();

async function render() {
  if (params.get('reset')) return renderAuth();
  if (params.get('verify')) return renderEmailVerification();
  root.innerHTML = '<div class="state-block"><h3>Loading your account</h3></div>';
  try {
    const user = await getCurrentUser();
    if (!user) return renderAuth();
    renderDashboard(user, params.get('tab') || 'profile');
  } catch {
    root.innerHTML = '<div class="state-block"><h3>Account temporarily unavailable</h3><p>Please try again shortly.</p><button class="btn btn-outline" id="retryAccount">Try Again</button></div>';
    document.getElementById('retryAccount')?.addEventListener('click', render);
  }
}

async function renderEmailVerification() {
  root.innerHTML = '<div class="state-block"><h1>Confirming your email</h1><p>Please wait a moment.</p></div>';
  try {
    await confirmEmailVerification(params.get('verify'));
    history.replaceState(null, '', 'account.html');
    root.innerHTML = '<div class="state-block"><h1>Email confirmed</h1><p>Your Nuvanti account email is verified.</p><a class="btn btn-primary" href="account.html">Continue to your account</a></div>';
  } catch (error) {
    root.innerHTML = `<div class="state-block"><h1>Link unavailable</h1><p>${escapeHtml(error.message)}</p><a class="btn btn-outline" href="account.html">Return to sign in</a></div>`;
  }
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
  return authView === 'login' ? 'Sign In' : authView === 'register' ? 'Create Account' : authView === 'reset' ? 'Set New Password' : 'Reset Password';
}

function renderAuthForm() {
  const wrap = document.getElementById('authFormWrap');
  const switchEl = document.getElementById('authSwitch');
  document.getElementById('accountRoot').querySelector('h1').textContent = label();

  if (authView === 'login') {
    wrap.innerHTML = `
      <form id="loginForm" novalidate>
        <div class="field"><label for="loginEmail">Email</label><input type="email" id="loginEmail" required /></div>
        <div class="field"><label for="loginPassword">Password</label><input type="password" id="loginPassword" required minlength="8" /></div>
        <button class="btn btn-primary btn-block" type="submit">Sign In</button>
      </form>
      <p style="text-align:center;margin-top:1rem"><button class="btn-text" id="toForgot" style="font-size:.85rem">Forgot password?</button></p>
    `;
    switchEl.innerHTML = `Don't have an account? <button class="btn-text" id="toRegister">Create one</button>`;
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkValid(e.target)) return;
      try { await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); continueAfterAuth(); }
      catch (error) { showAuthError(error.message); }
    });
    document.getElementById('toForgot').addEventListener('click', () => { authView = 'forgot'; renderAuthForm(); });
    document.getElementById('toRegister').addEventListener('click', () => { authView = 'register'; renderAuthForm(); });
  } else if (authView === 'register') {
    wrap.innerHTML = `
      <form id="registerForm" novalidate>
        <div class="field"><label for="regName">Full Name</label><input type="text" id="regName" autocomplete="name" minlength="2" maxlength="100" required /></div>
        <div class="field"><label for="regEmail">Email</label><input type="email" id="regEmail" autocomplete="email" maxlength="254" required /></div>
        <div class="field"><label for="regPassword">Password</label><input type="password" id="regPassword" autocomplete="new-password" required minlength="12" maxlength="128" /><span class="hint">At least 12 characters.</span></div>
        <div class="field"><label for="regPasswordConfirm">Confirm Password</label><input type="password" id="regPasswordConfirm" autocomplete="new-password" required minlength="12" maxlength="128" /></div>
        <button class="btn btn-primary btn-block" type="submit">Create Account</button>
      </form>
    `;
    switchEl.innerHTML = `Already have an account? <button class="btn-text" id="toLogin">Sign in</button>`;
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkValid(e.target)) return;
      const password = document.getElementById('regPassword').value;
      if (password !== document.getElementById('regPasswordConfirm').value) return showAuthError('Passwords do not match.');
      const button = e.target.querySelector('button[type="submit"]');
      button.disabled = true; button.textContent = 'Creating account…';
      try { await register(document.getElementById('regName').value.trim(), document.getElementById('regEmail').value, password); continueAfterAuth(); }
      catch (error) { showAuthError(error.message); button.disabled = false; button.textContent = 'Create Account'; }
    });
    document.getElementById('toLogin').addEventListener('click', () => { authView = 'login'; renderAuthForm(); });
  } else if (authView === 'forgot') {
    wrap.innerHTML = `
      <form id="forgotForm" novalidate>
        <p class="text-muted" style="margin-bottom:1rem;font-size:var(--fs-small)">Enter your account email and we'll send a link to reset your password.</p>
        <div class="field"><label for="forgotEmail">Email</label><input type="email" id="forgotEmail" required /></div>
        <button class="btn btn-primary btn-block" type="submit">Send Reset Link</button>
      </form>
    `;
    switchEl.innerHTML = `<button class="btn-text" id="toLogin">Back to sign in</button>`;
    document.getElementById('forgotForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkValid(e.target)) return;
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        await requestPasswordReset(document.getElementById('forgotEmail').value);
        wrap.innerHTML = `<div class="state-block"><h3>Check your email</h3><p>If an account exists for that address, a reset link is on its way. It expires in 30 minutes.</p></div>`;
      } catch (error) { showAuthError(error.message); btn.disabled = false; }
    });
    document.getElementById('toLogin').addEventListener('click', () => { authView = 'login'; renderAuthForm(); });
  } else {
    wrap.innerHTML = `
      <form id="resetForm" novalidate>
        <div class="field"><label for="resetPassword">New Password</label><input type="password" id="resetPassword" required minlength="12" /><span class="hint">At least 12 characters.</span></div>
        <div class="field"><label for="resetConfirm">Confirm New Password</label><input type="password" id="resetConfirm" required minlength="12" /></div>
        <button class="btn btn-primary btn-block" type="submit">Set New Password</button>
      </form>
    `;
    switchEl.innerHTML = `<button class="btn-text" id="toLogin">Back to sign in</button>`;
    document.getElementById('resetForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!checkValid(e.target)) return;
      const next = document.getElementById('resetPassword').value;
      if (next !== document.getElementById('resetConfirm').value) return showAuthError('Passwords do not match.');
      try {
        await confirmPasswordReset(params.get('reset'), next);
        history.replaceState(null, '', 'account.html');
        wrap.innerHTML = `<div class="state-block"><h3>Password updated</h3><p>You can now sign in with your new password.</p><a href="account.html" class="btn btn-primary">Sign In</a></div>`;
        switchEl.innerHTML = '';
      } catch (error) { showAuthError(error.message); }
    });
    document.getElementById('toLogin').addEventListener('click', () => { history.replaceState(null, '', 'account.html'); authView = 'login'; renderAuthForm(); });
  }
}

function checkValid(form) {
  const inputs = form.querySelectorAll('input[required]');
  for (const input of inputs) {
    if (!input.checkValidity()) { input.reportValidity(); return false; }
  }
  return true;
}

const STATUS_LABELS = { pending: 'Order Received', paid: 'Payment Received', processing: 'Being Prepared', shipped: 'Shipped', out_for_delivery: 'Out for Delivery', fulfilled: 'Delivered', cancelled: 'Cancelled' };

async function renderDashboard(session, tab) {
  root.innerHTML = `
    <div class="page-hero" style="border:none;padding-bottom:0"><h1>My Account</h1><p>Welcome back, ${escapeHtml(session.name)}.</p></div>
    ${session.emailVerifiedAt ? '' : `<div class="state-block account-verify-banner" role="status"><h3>Verify your email</h3><p>A confirmation link should arrive at ${escapeHtml(session.email)}. Check your Spam folder too. If it hasn't arrived, resend it below.</p><button class="btn btn-outline" type="button" id="resendVerification">Resend confirmation email</button></div>`}
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
  document.getElementById('resendVerification')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      const result = await requestEmailVerification();
      showToast(result.message || 'Verification email sent. Check your inbox and Spam.');
    } catch (error) {
      showToast(error.message, { icon: 'alertTriangle' });
    } finally {
      button.disabled = false;
      button.textContent = 'Resend confirmation email';
    }
  });
  if (tab === 'orders') {
    panel.innerHTML = `<div class="a-skeleton" style="height:120px;border-radius:12px"></div>`;
    try {
      const orders = await fetchMyOrders();
      panel.innerHTML = orders.length ? orders.map((o) => `
        <a class="order-row" href="${o.trackingUrl}" style="text-decoration:none;color:inherit">
          <div>
            <strong>NV-${o.id}</strong>
            <p class="text-muted" style="font-size:var(--fs-small)">${new Date(o.createdAt).toLocaleDateString()} · ${o.itemCount} item(s)</p>
          </div>
          <span>${formatPrice(o.totalCents / 100)}</span>
          <span class="badge badge--outline">${STATUS_LABELS[o.status] || o.status}</span>
        </a>
      `).join('') : `<div class="state-block"><h3>No orders yet</h3><p>Your order history will appear here once you place your first order.</p><a href="shop.html" class="btn btn-primary">Shop Now</a></div>`;
    } catch (error) {
      panel.innerHTML = `<div class="state-block"><h3>Couldn't load your orders</h3><p>${escapeHtml(error.message)}</p></div>`;
    }
  } else if (tab === 'addresses') {
    panel.innerHTML = '<div class="a-skeleton" style="height:120px;border-radius:12px"></div>';
    renderAddresses(panel);
  } else {
    panel.innerHTML = `
      <form id="profileForm">
        <div class="field"><label for="profileName">Full Name</label><input type="text" id="profileName" value="${escapeHtml(session.name)}" minlength="2" maxlength="100" required /></div>
        <div class="field"><label>Email</label><input type="email" value="${escapeHtml(session.email)}" disabled /></div>
        <button class="btn btn-primary" type="submit">Save Profile</button>
      </form>
    `;
    document.getElementById('profileForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button');
      button.disabled = true;
      try {
        await updateProfile(document.getElementById('profileName').value.trim());
        showToast('Profile saved.');
        render();
      } catch (error) { showToast(error.message, { icon: 'alertTriangle' }); button.disabled = false; }
    });
  }

  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    logout().finally(render);
  });
}

async function renderAddresses(panel) {
  try {
    const addresses = await fetchAddresses();
    panel.innerHTML = `
      <div id="addressList">${addresses.length ? addresses.map((address) => `
        <article class="card card-pad" style="margin-bottom:1rem">
          <div style="display:flex;justify-content:space-between;gap:1rem">
            <div><strong>${escapeHtml(address.label)}</strong>${address.isDefault ? ' <span class="badge badge--success">Default</span>' : ''}
              <p>${escapeHtml(address.name)} · ${escapeHtml(address.phone || '')}</p>
              <p class="text-muted">${escapeHtml(address.address1)}, ${escapeHtml(address.city)}, ${escapeHtml(address.country)} ${escapeHtml(address.postalCode)}</p>
            </div>
            <button class="btn btn-outline btn-sm" data-delete-address="${escapeAttr(address.id)}" type="button">Remove</button>
          </div>
        </article>`).join('') : '<div class="state-block"><h3>No saved addresses</h3><p>Save a delivery address below to speed up your next order.</p></div>'}</div>
      <form class="card card-pad" id="addressForm">
        <h2 class="h3" style="margin-bottom:1rem">Add an address</h2>
        <div class="field-row"><div class="field"><label for="addressLabel">Label</label><input id="addressLabel" value="Home" maxlength="40" required /></div><div class="field"><label for="addressName">Full Name</label><input id="addressName" value="${escapeAttr(session.name)}" maxlength="100" required /></div></div>
        <div class="field-row"><div class="field"><label for="addressPhone">Phone</label><input id="addressPhone" type="tel" maxlength="30" /></div><div class="field"><label for="addressPostal">Postal Code</label><input id="addressPostal" maxlength="20" required /></div></div>
        <div class="field"><label for="addressStreet">Street Address</label><input id="addressStreet" maxlength="150" required /></div>
        <div class="field-row"><div class="field"><label for="addressCity">City</label><input id="addressCity" maxlength="80" required /></div><div class="field"><label for="addressCountry">Country</label><select id="addressCountry"><option>Egypt</option><option>United Arab Emirates</option><option>Saudi Arabia</option></select></div></div>
        <label class="checkbox-row"><input id="addressDefault" type="checkbox" /> Set as default</label>
        <button class="btn btn-primary" type="submit">Save Address</button>
      </form>`;
    panel.querySelector('#addressForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;
      const value = (id) => document.getElementById(id).value.trim();
      try {
        await createAddress({
          label: value('addressLabel'), name: value('addressName'), phone: value('addressPhone'),
          postalCode: value('addressPostal'), address1: value('addressStreet'), city: value('addressCity'),
          country: value('addressCountry'), isDefault: document.getElementById('addressDefault').checked,
        });
        showToast('Address saved.');
        render();
      } catch (error) { showToast(error.message, { icon: 'alertTriangle' }); button.disabled = false; }
    });
    panel.querySelectorAll('[data-delete-address]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await deleteAddress(button.dataset.deleteAddress); showToast('Address removed.'); render(); }
      catch (error) { showToast(error.message, { icon: 'alertTriangle' }); button.disabled = false; }
    }));
  } catch (error) {
    panel.innerHTML = `<div class="state-block"><h3>Couldn't load your addresses</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function continueAfterAuth() {
  if (params.get('next') === 'checkout') location.href = 'checkout.html';
  else render();
}

function showAuthError(message) {
  const existing = document.getElementById('authError');
  if (existing) existing.remove();
  const error = document.createElement('p');
  error.id = 'authError'; error.className = 'form-error'; error.textContent = message;
  document.getElementById('authFormWrap').prepend(error);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function escapeAttr(value) { return escapeHtml(value); }
