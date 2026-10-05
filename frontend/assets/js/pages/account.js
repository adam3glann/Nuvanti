import { initShell } from '../main.js?v=store-theme-1';
import { formatPrice } from '../components/productCard.js';
import { getSession, getCurrentUser, updateProfile, login, register, logout, requestPasswordReset, confirmPasswordReset, confirmEmailVerification, requestEmailVerification } from '../services/authService.js';
import { fetchMyOrders } from '../services/orderService.js';
import { fetchAddresses, createAddress, deleteAddress } from '../services/addressService.js';
import { showToast } from '../components/toast.js';
import { icon } from '../components/icons.js';
import { createWhatsAppUrl } from '../services/whatsapp.js';

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
        <div class="field"><label for="loginEmail">Email</label><input type="email" id="loginEmail" autocomplete="email" aria-describedby="loginEmailError" required /><span class="error auth-field-error" id="loginEmailError" data-field-error="loginEmail" role="alert" hidden></span></div>
        ${passwordField('loginPassword', 'Password', { autocomplete: 'current-password', minlength: 8 })}
        <button class="btn btn-primary btn-block" type="submit">Sign In</button>
        <p class="auth-form-error" data-form-error role="alert" hidden></p>
      </form>
      <p style="text-align:center;margin-top:1rem"><button class="btn-text" id="toForgot" style="font-size:.85rem">Forgot password?</button></p>
    `;
    switchEl.innerHTML = `Don't have an account? <button class="btn-text" id="toRegister">Create one</button>`;
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthErrors(e.target);
      if (!checkValid(e.target)) return;
      try { await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value); continueAfterAuth(); }
      catch (error) { showAuthError(error.message, /email/i.test(error.message) && !/password/i.test(error.message) ? 'loginEmail' : 'loginPassword'); }
    });
    bindAuthForm(document.getElementById('loginForm'));
    document.getElementById('toForgot').addEventListener('click', () => { authView = 'forgot'; renderAuthForm(); });
    document.getElementById('toRegister').addEventListener('click', () => { authView = 'register'; renderAuthForm(); });
  } else if (authView === 'register') {
    wrap.innerHTML = `
      <form id="registerForm" novalidate>
        <div class="field"><label for="regName">Full Name</label><input type="text" id="regName" autocomplete="name" minlength="2" maxlength="100" aria-describedby="regNameError" required /><span class="error auth-field-error" id="regNameError" data-field-error="regName" role="alert" hidden></span></div>
        <div class="field"><label for="regEmail">Email</label><input type="email" id="regEmail" autocomplete="email" maxlength="254" aria-describedby="regEmailError" required /><span class="error auth-field-error" id="regEmailError" data-field-error="regEmail" role="alert" hidden></span></div>
        ${passwordField('regPassword', 'Password', { autocomplete: 'new-password', minlength: 12, hint: 'At least 12 characters.' })}
        ${passwordField('regPasswordConfirm', 'Confirm Password', { autocomplete: 'new-password', minlength: 12 })}
        <button class="btn btn-primary btn-block" type="submit">Create Account</button>
        <p class="auth-form-error" data-form-error role="alert" hidden></p>
      </form>
    `;
    switchEl.innerHTML = `Already have an account? <button class="btn-text" id="toLogin">Sign in</button>`;
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthErrors(e.target);
      if (!checkValid(e.target)) return;
      const password = document.getElementById('regPassword').value;
      if (password !== document.getElementById('regPasswordConfirm').value) return showAuthError('Passwords do not match.', 'regPasswordConfirm');
      const button = e.target.querySelector('button[type="submit"]');
      button.disabled = true; button.textContent = 'Creating account…';
      try { await register(document.getElementById('regName').value.trim(), document.getElementById('regEmail').value, password); continueAfterAuth(); }
      catch (error) { showAuthError(error.message, /email|account already exists/i.test(error.message) ? 'regEmail' : /password/i.test(error.message) ? 'regPassword' : ''); button.disabled = false; button.textContent = 'Create Account'; }
    });
    bindAuthForm(document.getElementById('registerForm'));
    document.getElementById('toLogin').addEventListener('click', () => { authView = 'login'; renderAuthForm(); });
  } else if (authView === 'forgot') {
    wrap.innerHTML = `
      <form id="forgotForm" novalidate>
        <p class="text-muted" style="margin-bottom:1rem;font-size:var(--fs-small)">Enter your account email and we'll send a link to reset your password.</p>
        <div class="field"><label for="forgotEmail">Email</label><input type="email" id="forgotEmail" autocomplete="email" aria-describedby="forgotEmailError" required /><span class="error auth-field-error" id="forgotEmailError" data-field-error="forgotEmail" role="alert" hidden></span></div>
        <button class="btn btn-primary btn-block" type="submit">Send Reset Link</button>
        <p class="auth-form-error" data-form-error role="alert" hidden></p>
      </form>
    `;
    switchEl.innerHTML = `<button class="btn-text" id="toLogin">Back to sign in</button>`;
    document.getElementById('forgotForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthErrors(e.target);
      if (!checkValid(e.target)) return;
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        await requestPasswordReset(document.getElementById('forgotEmail').value);
        wrap.innerHTML = `<div class="state-block"><h3>Check your email</h3><p>If an account exists for that address, a reset link is on its way. It expires in 30 minutes.</p></div>`;
      } catch (error) { showAuthError(error.message, 'forgotEmail'); btn.disabled = false; }
    });
    bindAuthForm(document.getElementById('forgotForm'));
    document.getElementById('toLogin').addEventListener('click', () => { authView = 'login'; renderAuthForm(); });
  } else {
    wrap.innerHTML = `
      <form id="resetForm" novalidate>
        ${passwordField('resetPassword', 'New Password', { autocomplete: 'new-password', minlength: 12, hint: 'At least 12 characters.' })}
        ${passwordField('resetConfirm', 'Confirm New Password', { autocomplete: 'new-password', minlength: 12 })}
        <button class="btn btn-primary btn-block" type="submit">Set New Password</button>
        <p class="auth-form-error" data-form-error role="alert" hidden></p>
      </form>
    `;
    switchEl.innerHTML = `<button class="btn-text" id="toLogin">Back to sign in</button>`;
    document.getElementById('resetForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthErrors(e.target);
      if (!checkValid(e.target)) return;
      const next = document.getElementById('resetPassword').value;
      if (next !== document.getElementById('resetConfirm').value) return showAuthError('Passwords do not match.', 'resetConfirm');
      try {
        await confirmPasswordReset(params.get('reset'), next);
        history.replaceState(null, '', 'account.html');
        wrap.innerHTML = `<div class="state-block"><h3>Password updated</h3><p>You can now sign in with your new password.</p><a href="account.html" class="btn btn-primary">Sign In</a></div>`;
        switchEl.innerHTML = '';
      } catch (error) { showAuthError(error.message, /password/i.test(error.message) ? 'resetPassword' : ''); }
    });
    bindAuthForm(document.getElementById('resetForm'));
    document.getElementById('toLogin').addEventListener('click', () => { history.replaceState(null, '', 'account.html'); authView = 'login'; renderAuthForm(); });
  }
}

function checkValid(form) {
  const inputs = form.querySelectorAll('input[required]');
  for (const input of inputs) {
    if (!input.checkValidity()) {
      const message = input.validity.valueMissing ? 'Please fill out this field.'
        : input.validity.typeMismatch ? 'Enter a valid email address.'
          : input.validity.tooShort ? `Use at least ${input.minLength} characters.`
            : input.validationMessage;
      showFieldError(input, message);
      input.focus();
      return false;
    }
  }
  return true;
}

function passwordField(id, label, { autocomplete = 'new-password', minlength = 12, maxlength = 128, hint = '' } = {}) {
  const hintId = hint ? `${id}Hint` : '';
  const describedBy = [hintId, `${id}Error`].filter(Boolean).join(' ');
  return `<div class="field"><label for="${id}">${label}</label><div class="password-input-wrap"><input type="password" id="${id}" autocomplete="${autocomplete}" required minlength="${minlength}" maxlength="${maxlength}" aria-describedby="${describedBy}" /><button class="password-visibility" type="button" data-toggle-password="${id}" aria-label="Show password" aria-pressed="false">${icon('eye')}</button></div>${hint ? `<span class="hint" id="${hintId}">${hint}</span>` : ''}<span class="error auth-field-error" id="${id}Error" data-field-error="${id}" role="alert" hidden></span></div>`;
}

function bindAuthForm(form) {
  form.querySelectorAll('[data-toggle-password]').forEach((button) => button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.togglePassword);
    if (!input) return;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.innerHTML = icon(visible ? 'eyeOff' : 'eye');
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.setAttribute('aria-pressed', String(visible));
  }));
  form.querySelectorAll('input').forEach((input) => input.addEventListener('input', () => {
    clearFieldError(input);
    const formError = form.querySelector('[data-form-error]');
    if (formError) { formError.hidden = true; formError.textContent = ''; }
  }));
}

function clearAuthErrors(form) {
  form.querySelectorAll('input').forEach(clearFieldError);
  const formError = form.querySelector('[data-form-error]');
  if (formError) { formError.hidden = true; formError.textContent = ''; }
}

function clearFieldError(input) {
  input.removeAttribute('aria-invalid');
  input.closest('.field')?.classList.remove('is-invalid');
  const error = input.closest('.field')?.querySelector(`[data-field-error="${input.id}"]`);
  if (error) { error.hidden = true; error.textContent = ''; }
}

function showFieldError(input, message) {
  const field = input.closest('.field');
  const error = field?.querySelector(`[data-field-error="${input.id}"]`);
  if (!field || !error) return false;
  error.textContent = message;
  error.hidden = false;
  input.setAttribute('aria-invalid', 'true');
  error.id ||= `${input.id}Error`;
  const describedBy = new Set((input.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  describedBy.add(error.id);
  input.setAttribute('aria-describedby', [...describedBy].join(' '));
  field.classList.add('is-invalid');
  return true;
}

function showAuthError(message, fieldId = '') {
  const input = fieldId ? document.getElementById(fieldId) : null;
  if (input && showFieldError(input, message)) return;
  const form = document.querySelector('#authFormWrap form');
  if (!form) return;
  let error = form.querySelector('[data-form-error]');
  if (!error) {
    error = document.createElement('p');
    error.className = 'auth-form-error';
    error.dataset.formError = '';
    error.setAttribute('role', 'alert');
    form.append(error);
  }
  error.textContent = message;
  error.hidden = false;
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
      panel.innerHTML = orders.length ? orders.map((o) => {
        const instaPending = o.paymentMethod === 'instapay' && o.paymentStatus === 'pending' && o.status !== 'cancelled';
        const hasInstaRecipient = Boolean(o.instapayRecipient);
        const orderNumber = `NV-${o.id}`;
        const amount = Number(o.totalCents) / 100;
        const message = hasInstaRecipient
          ? `Hello, I transferred EGP ${amount.toFixed(2)} via InstaPay for order ${orderNumber}. I am attaching the transfer screenshot.\n\nمرحباً، قمت بتحويل ${amount.toFixed(2)} جنيه عبر إنستاباي للطلب ${orderNumber}. أرفق صورة التحويل.`
          : `Hello, I have order ${orderNumber} and need the verified InstaPay transfer details before I pay.\n\nمرحباً، لدي الطلب ${orderNumber} وأحتاج بيانات تحويل إنستاباي المؤكدة قبل الدفع.`;
        const whatsappUrl = createWhatsAppUrl(o.instapayWhatsappPhone, message);
        return `
          <article class="account-order-card">
            <a class="order-row account-order-card__summary" href="${escapeAttr(o.trackingUrl)}" style="text-decoration:none;color:inherit">
              <div>
                <strong>${orderNumber}</strong>
                <p class="text-muted" style="font-size:var(--fs-small)">${new Date(o.createdAt).toLocaleDateString()} · ${o.itemCount} item(s)</p>
              </div>
              <span>${formatPrice(amount)}</span>
              <span class="badge badge--outline">${o.paymentMethod === 'paymob' && o.paymentStatus === 'failed' ? 'Payment failed' : STATUS_LABELS[o.status] || o.status}</span>
            </a>
            ${instaPending ? `<section class="instapay-account-panel" aria-labelledby="instapayOrder${escapeAttr(o.id)}">
              <h3 id="instapayOrder${escapeAttr(o.id)}">InstaPay transfer needed <span lang="ar" dir="rtl">التحويل عبر إنستاباي مطلوب</span></h3>
              ${hasInstaRecipient ? `<div class="instapay-account-panel__amount"><span>Transfer this exact total <span lang="ar" dir="rtl">حوّل هذا الإجمالي بالضبط</span></span><strong>${formatPrice(amount)}</strong></div>
              <div class="instapay-account-panel__recipient"><div><span>Recipient <span lang="ar" dir="rtl">المستلم</span></span><strong>${renderInstapayRecipient(o.instapayRecipient)}</strong></div><button type="button" class="btn btn-outline btn-sm" data-copy-instapay="${escapeAttr(o.id)}" data-recipient="${escapeAttr(o.instapayRecipient)}">Copy · نسخ</button></div>
              <ol><li>Transfer the exact total to this recipient. <span lang="ar" dir="rtl">حوّل الإجمالي بالضبط إلى هذا المستلم.</span></li><li>Take a screenshot after the transfer. <span lang="ar" dir="rtl">التقط صورة شاشة بعد التحويل.</span></li><li>Send the screenshot and order number ${orderNumber} using the green WhatsApp button. <span lang="ar" dir="rtl">أرسل صورة التحويل ورقم الطلب ${orderNumber} عبر زر واتساب الأخضر.</span></li></ol>` : '<p role="alert">We can’t confirm the recipient details saved for this older order. Contact us before transferring so we can confirm the correct destination. · لا يمكننا تأكيد بيانات المستلم المحفوظة لهذا الطلب. تواصل معنا لتأكيد بيانات التحويل قبل الدفع.</p>'}
              ${whatsappUrl ? `<a class="btn instapay-whatsapp" href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open WhatsApp for help with InstaPay order ${escapeAttr(orderNumber)}. Opens in a new tab."><span aria-hidden="true">●</span> ${hasInstaRecipient ? 'Send screenshot + order number on WhatsApp' : 'Ask for transfer details on WhatsApp'} <span lang="ar" dir="rtl">${hasInstaRecipient ? 'إرسال الصورة ورقم الطلب عبر واتساب' : 'طلب بيانات التحويل عبر واتساب'}</span></a>` : '<p role="alert">WhatsApp is unavailable. Contact the store about this order before transferring. · واتساب غير متاح، تواصل مع المتجر قبل التحويل.</p>'}
              <p class="instapay-account-panel__pending" role="status">Unpaid until the transfer is verified. <span lang="ar" dir="rtl">يظل الطلب غير مدفوع حتى التحقق من التحويل.</span></p>
              <p class="instapay-copy-status" data-copy-status="${escapeAttr(o.id)}" role="status" aria-live="polite"></p>
            </section>` : ''}
          </article>`;
      }).join('') : `<div class="state-block"><h3>No orders yet</h3><p>Your order history will appear here once you place your first order.</p><a href="shop.html" class="btn btn-primary">Shop Now</a></div>`;
      panel.querySelectorAll('[data-copy-instapay]').forEach((button) => button.addEventListener('click', async () => {
        const status = panel.querySelector(`[data-copy-status="${button.dataset.copyInstapay}"]`);
        try {
          await navigator.clipboard.writeText(button.dataset.recipient || '');
          status.textContent = 'Recipient details copied. · تم نسخ بيانات المستلم.';
        } catch {
          status.textContent = 'Copy unavailable. Select the recipient details and copy them. · تعذّر النسخ. حدّد بيانات المستلم وانسخها.';
        }
      }));
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

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function escapeAttr(value) { return escapeHtml(value); }
function renderInstapayRecipient(value) {
  const recipient = String(value ?? '');
  const match = recipient.match(/(^|[^\d])((?:\+?20[ -]?1[0125]|0?1[0125])(?:[ -]?\d){8})(?=$|[^\d])/);
  if (!match) return escapeHtml(recipient);
  const number = match[2];
  const telNumber = number.replace(/[^\d+]/g, '');
  const start = match.index + match[1].length;
  return `${escapeHtml(recipient.slice(0, start))}<a href="tel:${telNumber}" aria-label="Call InstaPay recipient phone number">${escapeHtml(number)}</a>${escapeHtml(recipient.slice(start + number.length))}`;
}
