import { initShell } from '../main.js?v=store-theme-1';
import { icon } from '../components/icons.js';
import { formatPrice } from '../components/productCard.js';
import { fetchOrderPaymentStatus, getLastOrder } from '../services/orderService.js';
import { createWhatsAppUrl } from '../services/whatsapp.js';

initShell({ currentPage: 'shop' });

const order = getLastOrder();
const root = document.getElementById('orderSuccessRoot');

if (!order) {
  root.innerHTML = `
    <div class="state-block">
      <h3>No recent order found</h3>
      <p>Looks like there's nothing to confirm yet.</p>
      <a href="shop.html" class="btn btn-primary">Start Shopping</a>
    </div>`;
} else {
  const onlinePending = order.paymentMethod === 'paymob' && order.paymentStatus !== 'paid';
  const instaPending = order.paymentMethod === 'instapay' && order.paymentStatus === 'pending' && order.status !== 'cancelled';
  const hasInstaRecipient = Boolean(order.transferDetails?.recipient);
  const instaMessage = hasInstaRecipient
    ? `Hello, I transferred EGP ${Number(order.total).toFixed(2)} via InstaPay for order ${order.orderNumber}. I am attaching the transfer screenshot.\n\nمرحباً، قمت بتحويل ${Number(order.total).toFixed(2)} جنيه عبر إنستاباي للطلب ${order.orderNumber}. أرفق صورة التحويل.`
    : `Hello, I have order ${order.orderNumber} and need the verified InstaPay transfer details before I pay.\n\nمرحباً، لدي الطلب ${order.orderNumber} وأحتاج بيانات تحويل إنستاباي المؤكدة قبل الدفع.`;
  const instaWhatsAppUrl = createWhatsAppUrl(order.transferDetails?.whatsappPhone, instaMessage);
  root.innerHTML = `
    <div class="order-success">
      <div class="order-success__icon">${icon('check')}</div>
      <h1>${onlinePending ? 'Checking your payment' : instaPending ? 'Transfer needed to confirm your order' : 'Thank you for your order.'}</h1>
      <p class="text-muted" id="paymentResultMessage">${onlinePending ? 'Your order is saved. We are waiting for the payment provider to confirm your payment. This page will update shortly.' : instaPending ? 'Your order is saved and remains unpaid until we verify your InstaPay transfer. Send the transfer screenshot through WhatsApp.' : order.accountCreated ? `Your optional account was created. Check ${escapeHtml(order.customer.email)} for the email verification link. ${order.emailDelivery?.sent ? 'Your order receipt and secure tracking link were emailed too.' : 'Keep the secure tracking link below; the receipt email could not be delivered.'}` : order.isGuest ? `${order.emailDelivery?.sent ? `The receipt and secure tracking link were emailed to ${escapeHtml(order.customer.email)}.` : `The receipt email could not be delivered to ${escapeHtml(order.customer.email)}. Keep the secure tracking link below to check your order.`}` : `Your order is saved in My Account → Orders. ${order.emailDelivery?.sent ? `Confirmation accepted by the email provider for ${escapeHtml(order.customer.email)}. Shipping updates will go to the same address.` : `Order placed, but the confirmation email could not be sent to ${escapeHtml(order.customer.email)}. Check Admin Settings → Email and Railway mail variables.`}`}</p>

      <div class="order-detail-card">
        <div class="order-detail-row"><span>Order Number</span><strong>${escapeHtml(order.orderNumber)}</strong></div>
        <div class="order-detail-row"><span>Estimated Delivery</span><span>${escapeHtml(order.estimatedDelivery)}</span></div>
        <div class="order-detail-row"><span>Shipping To</span><span>${escapeHtml(order.shipping.city)}, ${escapeHtml(order.shipping.country)}</span></div>
        <hr class="hr" style="margin-block:1rem" />
        ${order.lines.map((l) => `
          <div class="order-detail-row"><span>${escapeHtml(l.name)} (${escapeHtml(l.color)}, ${escapeHtml(l.size)}) × ${Number(l.quantity)}</span><span>${formatPrice(Number(l.price) * Number(l.quantity))}</span></div>
        `).join('')}
        <hr class="hr" style="margin-block:1rem" />
        <div class="order-detail-row"><span>Subtotal</span><span>${formatPrice(order.subtotal)}</span></div>
        ${order.discountCode ? `<div class="order-detail-row"><span>Discount (${escapeHtml(order.discountCode)})</span><span>-${formatPrice(order.discountAmount)}</span></div>` : ''}
        <div class="order-detail-row"><span>Shipping</span><span>${order.shippingCost === 0 ? 'Free' : formatPrice(order.shippingCost)}</span></div>
        <div class="order-detail-row" style="font-weight:700;font-size:1.05rem"><span>Total</span><span>${formatPrice(order.total)}</span></div>
        ${instaPending ? '<div class="order-detail-row"><span>Payment status</span><strong>Unpaid · awaiting transfer verification</strong></div>' : ''}
      </div>

      ${instaPending ? `<section class="instapay-transfer-panel" aria-labelledby="instapayTransferTitle">
        <p class="instapay-transfer-panel__eyebrow">InstaPay · Payment pending</p>
        <h2 id="instapayTransferTitle">${hasInstaRecipient ? 'Complete your transfer to confirm your order' : 'Confirm transfer details for this order'}</h2>
        ${hasInstaRecipient ? `<div class="instapay-transfer-panel__amount"><span>Transfer this exact total</span><strong>${formatPrice(order.total)}</strong></div>
        <div class="instapay-transfer-panel__recipient"><div><span>InstaPay recipient</span><strong id="instapayRecipientValue">${renderInstapayRecipient(order.transferDetails.recipient)}</strong></div><button type="button" class="btn btn-outline btn-sm" id="copyInstaPayRecipient" aria-label="Copy InstaPay recipient details">Copy details</button></div>
        <ol class="instapay-transfer-panel__steps"><li>Transfer the exact total above to the recipient shown.</li><li>After transferring, take a screenshot of the completed transfer.</li><li>Use the green WhatsApp button below to send the screenshot and your order number.</li></ol>
        <div class="instapay-transfer-panel__arabic" lang="ar" dir="rtl"><strong>الخطوات لإتمام الطلب</strong><ol><li>حوّل الإجمالي الموضح بالضبط إلى بيانات مستلم إنستاباي أعلاه.</li><li>بعد التحويل، التقط صورة شاشة تؤكد إتمام التحويل.</li><li>اضغط زر واتساب الأخضر لإرسال صورة التحويل ورقم الطلب.</li></ol></div>` : '<p role="alert">We can’t confirm the recipient details saved for this older order. Please contact the store before transferring. · لا يمكننا تأكيد بيانات المستلم المحفوظة لهذا الطلب، يرجى التواصل مع المتجر قبل التحويل.</p>'}
        <p class="instapay-transfer-panel__pending" role="status">Your order stays unpaid until we verify the transfer. <span lang="ar" dir="rtl">يظل الطلب غير مدفوع حتى نتحقق من التحويل.</span></p>
        ${instaWhatsAppUrl ? `<a href="${escapeHtml(instaWhatsAppUrl)}" class="btn instapay-whatsapp" target="_blank" rel="noopener noreferrer" aria-label="Open WhatsApp for InstaPay order ${escapeHtml(order.orderNumber)}. Opens in a new tab."><span aria-hidden="true">●</span> ${hasInstaRecipient ? 'Send screenshot + order number on WhatsApp' : 'Ask for transfer details on WhatsApp'} <span lang="ar" dir="rtl">${hasInstaRecipient ? 'إرسال الصورة ورقم الطلب عبر واتساب' : 'طلب بيانات التحويل عبر واتساب'}</span></a>` : '<p role="alert">WhatsApp is unavailable. Please contact the store before transferring.</p>'}
        <p id="instapayCopyStatus" class="instapay-copy-status" role="status" aria-live="polite"></p>
      </section>` : ''}

      <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <a href="shop.html" class="btn btn-primary">Continue Shopping</a>
        <a href="${escapeHtml(getSafeTrackingUrl(order.trackingUrl))}" class="btn btn-outline">Track Order</a>
      </div>
    </div>
  `;
  document.getElementById('copyInstaPayRecipient')?.addEventListener('click', async () => {
    const recipient = order.transferDetails?.recipient || '';
    try {
      await navigator.clipboard.writeText(recipient);
      document.getElementById('instapayCopyStatus').textContent = 'Recipient details copied. · تم نسخ بيانات المستلم.';
    } catch {
      document.getElementById('instapayCopyStatus').textContent = 'Copy unavailable. Select the recipient details above and copy them. · تعذّر النسخ. حدّد بيانات المستلم وانسخها.';
    }
  });
  if (onlinePending) refreshPaymentStatus(order);
}

async function refreshPaymentStatus(order) {
  const message = document.getElementById('paymentResultMessage');
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const status = await fetchOrderPaymentStatus(order.id, order.isGuest ? order.trackingUrl : null);
      if (status.paymentStatus === 'paid') {
        message.textContent = `Payment confirmed for order ${order.orderNumber}. A receipt will be sent to ${order.customer.email}.`;
        document.querySelector('.order-success h1').textContent = 'Payment confirmed';
        return;
      }
      if (status.paymentStatus === 'failed') {
        message.textContent = `The payment was not completed. Your order ${order.orderNumber} remains unpaid. You can try again from My Account → Orders or contact the store.`;
        document.querySelector('.order-success h1').textContent = 'Payment not completed';
        return;
      }
    } catch { /* Keep the accurate pending message if the status check is unavailable. */ }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
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

function getSafeTrackingUrl(value) {
  const fallback = 'account.html?tab=orders';
  try {
    const url = new URL(value, window.location.origin);
    const trustedHosts = new Set([window.location.host, 'nuvanti-shop.pages.dev']);
    const sameOrigin = url.origin === window.location.origin;
    return (sameOrigin || (url.protocol === 'https:' && trustedHosts.has(url.host))) && url.pathname.endsWith('/track.html')
      ? `${url.origin}${url.pathname}${url.search}`
      : fallback;
  } catch {
    return fallback;
  }
}
