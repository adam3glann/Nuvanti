import { initShell } from '../main.js?v=store-theme-1';
import { formatPrice, escapeHtml } from '../components/productCard.js';
import { createWhatsAppUrl } from '../services/whatsapp.js';

initShell({ currentPage: '' });

import { API_ORIGIN as API } from '../config.js';
const root = document.getElementById('trackRoot');
const params = new URLSearchParams(location.search);
const orderId = params.get('order');
const token = params.get('token');

const STATUS_STEPS = ['pending', 'processing', 'shipped', 'out_for_delivery', 'fulfilled'];
const STATUS_LABELS = { pending: 'Order Received', paid: 'Payment Received', processing: 'Being Prepared', shipped: 'Shipped', out_for_delivery: 'Out for Delivery', fulfilled: 'Delivered', cancelled: 'Cancelled' };

if (orderId && token) {
  loadOrder(orderId, token);
} else {
  renderLookupForm();
}

function renderLookupForm(error) {
  root.innerHTML = `
    <form id="lookupForm" novalidate style="max-width:420px;margin-inline:auto">
      ${error ? `<p class="form-error" style="margin-bottom:1rem">${escapeHtml(error)}</p>` : ''}
      <div class="field"><label for="lkOrder">Order Number</label><input id="lkOrder" placeholder="e.g. 1042" required /></div>
      <div class="field"><label for="lkToken">Tracking Code</label><input id="lkToken" required /><span class="hint">Both are in your confirmation email or WhatsApp message.</span></div>
      <button class="btn btn-primary btn-block" type="submit">Track Order</button>
    </form>
  `;
  document.getElementById('lookupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const orderVal = document.getElementById('lkOrder').value.trim().replace(/^NV-/i, '');
    const tokenVal = document.getElementById('lkToken').value.trim();
    if (!orderVal || !tokenVal) return;
    history.replaceState(null, '', `track.html?order=${encodeURIComponent(orderVal)}&token=${encodeURIComponent(tokenVal)}`);
    loadOrder(orderVal, tokenVal);
  });
}

async function loadOrder(id, token) {
  root.innerHTML = `<div class="a-skeleton" style="height:220px;border-radius:12px"></div>`;
  try {
    const response = await fetch(`${API}/api/orders/track/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Order not found.');
    renderOrder(body);
  } catch (error) {
    renderLookupForm(error.message);
  }
}

function renderOrder(order) {
  const cancelled = order.status === 'cancelled';
  const instaPending = order.paymentMethod === 'instapay' && order.paymentStatus === 'pending' && !cancelled;
  const hasInstaRecipient = Boolean(order.instapayRecipient);
  const instaMessage = hasInstaRecipient
    ? `Hello, I transferred EGP ${Number(order.total).toFixed(2)} via InstaPay for order NV-${order.id}. I am attaching the transfer screenshot.\n\nمرحباً، قمت بتحويل ${Number(order.total).toFixed(2)} جنيه عبر إنستاباي للطلب NV-${order.id}. أرفق صورة التحويل.`
    : `Hello, I have order NV-${order.id} and need the verified InstaPay transfer details before I pay.\n\nمرحباً، لدي الطلب NV-${order.id} وأحتاج بيانات تحويل إنستاباي المؤكدة قبل الدفع.`;
  const whatsappUrl = createWhatsAppUrl(order.instapayWhatsappPhone, instaMessage);
  const stepIndex = STATUS_STEPS.indexOf(order.status === 'paid' ? 'processing' : order.status);

  root.innerHTML = `
    <div class="order-detail-card">
      <div class="order-detail-row"><span>Order Number</span><strong>NV-${order.id}</strong></div>
      <div class="order-detail-row"><span>Placed</span><span>${new Date(order.createdAt).toLocaleDateString()}</span></div>
      ${order.city ? `<div class="order-detail-row"><span>Shipping To</span><span>${escapeHtml(order.city)}, ${escapeHtml(order.country)}</span></div>` : ''}
      <div class="order-detail-row"><span>Delivery</span><span>${order.delivery === 'express' ? 'Express (1–2 days)' : 'Standard (4–7 days)'}</span></div>
      ${order.paymentMethod === 'paymob' ? `<div class="order-detail-row"><span>Payment</span><span>${order.paymentStatus === 'paid' ? 'Paid online' : order.paymentStatus === 'failed' ? 'Payment not completed' : 'Awaiting payment confirmation'}</span></div>` : order.paymentMethod === 'instapay' ? `<div class="order-detail-row"><span>Payment</span><strong>${order.paymentStatus === 'paid' ? 'Paid' : cancelled ? 'Cancelled · unpaid' : 'Unpaid · transfer verification required'}</strong></div>` : ''}
    </div>

    ${instaPending ? `<section class="instapay-transfer-panel" aria-labelledby="trackInstaPayTitle">
      <p class="instapay-transfer-panel__eyebrow">InstaPay · Payment pending</p>
      <h2 id="trackInstaPayTitle">${hasInstaRecipient ? 'Complete your transfer to confirm' : 'Confirm transfer details for'} order NV-${escapeHtml(order.id)}</h2>
      ${hasInstaRecipient ? `<div class="instapay-transfer-panel__amount"><span>Transfer this exact total</span><strong>${formatPrice(order.total)}</strong></div>
      <div class="instapay-transfer-panel__recipient"><div><span>InstaPay recipient</span><strong>${renderInstapayRecipient(order.instapayRecipient)}</strong></div><button type="button" class="btn btn-outline btn-sm" id="copyTrackInstaPayRecipient" aria-label="Copy InstaPay recipient details">Copy details</button></div>
      <ol class="instapay-transfer-panel__steps"><li>Transfer the exact total above to the recipient shown.</li><li>After transferring, take a screenshot of the completed transfer.</li><li>Use the green WhatsApp button below to send the screenshot and your order number.</li></ol>
      <div class="instapay-transfer-panel__arabic" lang="ar" dir="rtl"><strong>الخطوات لإتمام الطلب</strong><ol><li>حوّل الإجمالي الموضح بالضبط إلى بيانات مستلم إنستاباي أعلاه.</li><li>بعد التحويل، التقط صورة شاشة تؤكد إتمام التحويل.</li><li>اضغط زر واتساب الأخضر لإرسال صورة التحويل ورقم الطلب NV-${escapeHtml(order.id)}.</li></ol></div>` : `<p role="alert">We can’t confirm the recipient details saved for this older order. Please contact the store before transferring. · لا يمكننا تأكيد بيانات المستلم المحفوظة لهذا الطلب، يرجى التواصل مع المتجر قبل التحويل.</p>`}
      <p class="instapay-transfer-panel__pending" role="status">Your order stays unpaid until we verify the transfer. <span lang="ar" dir="rtl">يظل الطلب غير مدفوع حتى نتحقق من التحويل.</span></p>
      ${whatsappUrl ? `<a class="btn instapay-whatsapp" href="${escapeHtml(whatsappUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open WhatsApp for InstaPay order NV-${escapeHtml(order.id)}. Opens in a new tab."><span aria-hidden="true">●</span> ${hasInstaRecipient ? 'Send screenshot + order number on WhatsApp' : 'Ask for transfer details on WhatsApp'} <span lang="ar" dir="rtl">${hasInstaRecipient ? 'إرسال الصورة ورقم الطلب عبر واتساب' : 'طلب بيانات التحويل عبر واتساب'}</span></a>` : '<p role="alert">WhatsApp contact is unavailable. Contact the store with your order number. · واتساب غير متاح، تواصل مع المتجر برقم الطلب.</p>'}
      <p id="trackInstaPayCopyStatus" class="instapay-copy-status" role="status" aria-live="polite"></p>
    </section>` : ''}

    ${cancelled
      ? `<div class="state-block" style="margin-block:1.5rem"><h3>This order was cancelled</h3><p>Contact us if you have questions about this order.</p></div>`
      : `<div class="order-tracker" style="display:flex;justify-content:space-between;margin-block:2rem;gap:.5rem">
          ${STATUS_STEPS.map((s, i) => `
            <div style="flex:1;text-align:center">
              <div style="width:14px;height:14px;border-radius:50%;margin:0 auto .5rem;background:${i <= stepIndex ? 'var(--color-accent, #111)' : 'var(--color-border, #ddd)'}"></div>
              <span style="font-size:.75rem;color:${i <= stepIndex ? 'inherit' : 'var(--color-muted, #999)'}">${STATUS_LABELS[s]}</span>
            </div>
          `).join('')}
        </div>`}

    <div class="order-detail-card">
      ${order.items.map((it) => `
        <div class="order-detail-row"><span>${escapeHtml(it.name)}${it.color || it.size ? ` (${escapeHtml([it.color, it.size].filter(Boolean).join(', '))})` : ''} × ${Number(it.quantity)}</span></div>
      `).join('')}
      <hr class="hr" style="margin-block:1rem" />
      <div class="order-detail-row" style="font-weight:700;font-size:1.05rem"><span>Total</span><span>${formatPrice(order.total)}</span></div>
    </div>

    <div style="text-align:center;margin-top:1.5rem">
      <a href="contact.html" class="btn-text">Questions about this order? Contact us</a>
    </div>
  `;
  document.getElementById('copyTrackInstaPayRecipient')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(order.instapayRecipient || '');
      document.getElementById('trackInstaPayCopyStatus').textContent = 'Recipient details copied. · تم نسخ بيانات المستلم.';
    } catch {
      document.getElementById('trackInstaPayCopyStatus').textContent = 'Copy unavailable. Select the recipient details above and copy them. · تعذّر النسخ. حدّد بيانات المستلم وانسخها.';
    }
  });
}

function renderInstapayRecipient(value) {
  const recipient = String(value ?? '');
  const match = recipient.match(/(^|[^\d])((?:\+?20[ -]?1[0125]|0?1[0125])(?:[ -]?\d){8})(?=$|[^\d])/);
  if (!match) return escapeHtml(recipient);
  const number = match[2];
  const telNumber = number.replace(/[^\d+]/g, '');
  const start = match.index + match[1].length;
  return `${escapeHtml(recipient.slice(0, start))}<a href="tel:${telNumber}" aria-label="Call InstaPay recipient phone number">${escapeHtml(number)}</a>${escapeHtml(recipient.slice(start + number.length))}`;
}
