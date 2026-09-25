import nodemailer from 'nodemailer';

function hasValue(key) {
  const value = String(process.env[key] || '').trim();
  return Boolean(value) && !/(?:example\.com|^paste_|replace-with|your[-_])/i.test(value);
}

export function emailDeliveryStatus() {
  const senderReady = hasValue('MAIL_FROM');
  const resendReady = hasValue('RESEND_API_KEY') && senderReady;
  const smtpReady = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].every(hasValue) && senderReady;
  const provider = resendReady ? 'Resend' : smtpReady ? 'SMTP' : null;
  const missing = [];
  if (!senderReady) missing.push('MAIL_FROM');
  if (!resendReady && !smtpReady) {
    if (!hasValue('RESEND_API_KEY')) missing.push('RESEND_API_KEY');
    if (!['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].every(hasValue)) {
      missing.push(...['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].filter((key) => !hasValue(key)));
    }
  }
  return { configured: Boolean(provider), provider, senderConfigured: senderReady, missing: [...new Set(missing)] };
}

async function deliver({ to, subject, text, html, replyTo, devLabel, devDetail }) {
  const status = emailDeliveryStatus();
  if (!status.configured) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email delivery is not configured.');
    console.info(`${devLabel} for ${to}: ${devDetail}`);
    return;
  }
  if (status.provider === 'Resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Resend email delivery failed (${response.status}): ${result.message || 'provider rejected the message'}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html, ...(replyTo ? { replyTo } : {}) });
}

export async function sendTestEmail({ to }) {
  await deliver({
    to,
    subject: 'Nuvanti email delivery test',
    text: 'This test confirms that Nuvanti can send email from its production service.',
    html: '<p>This test confirms that Nuvanti can send email from its production service.</p>',
    devLabel: 'Development email test',
    devDetail: 'Nuvanti mail transport test',
  });
}

export async function sendContactNotification({ to, name, email, message }) {
  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeMessage = escapeHtml(message);
  await deliver({
    to,
    replyTo: email,
    subject: `New Nuvanti contact message from ${name}`,
    text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    html: `<p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p>${safeMessage.replace(/\n/g, '<br>')}</p>`,
    devLabel: 'Development contact notification',
    devDetail: `message from ${email}`,
  });
}

export async function sendPasswordReset({ to, resetUrl }) {
  await deliver({
    to,
    subject: 'Reset your Nuvanti password',
    text: `We received a request to reset your Nuvanti password. Use this link within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>We received a request to reset your Nuvanti password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
    devLabel: 'Development password-reset URL',
    devDetail: resetUrl,
  });
}

export async function sendVerificationEmail({ to, name, verifyUrl }) {
  await deliver({
    to,
    subject: 'Confirm your email for Nuvanti',
    text: `Hi ${name}, please confirm your email address: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${name}, please confirm your email address.</p><p><a href="${verifyUrl}">Confirm my email</a></p><p>This link expires in 24 hours.</p>`,
    devLabel: 'Development email-verification URL',
    devDetail: verifyUrl,
  });
}

export async function sendNewsletterConfirmation({ to, confirmUrl, unsubscribeUrl }) {
  await deliver({
    to,
    subject: 'Confirm your Nuvanti newsletter subscription',
    text: `Please confirm that you want Nuvanti updates about new arrivals, restocks, and occasional offers: ${confirmUrl}\n\nIf you did not request this, ignore this email. You can unsubscribe at any time: ${unsubscribeUrl}`,
    html: `<p>Please confirm that you want Nuvanti updates about new arrivals, restocks, and occasional offers.</p><p><a href="${confirmUrl}">Confirm subscription</a></p><p>If you did not request this, ignore this email. You can unsubscribe at any time from <a href="${unsubscribeUrl}">this page</a>.</p>`,
    devLabel: 'Development newsletter confirmation URL',
    devDetail: confirmUrl,
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Sent right after checkout. Best-effort — a failure here must never fail
// the order itself, so callers should wrap this in try/catch.
export async function sendOrderConfirmation({ to, name, orderId, items, totalCents, trackingUrl }) {
  const itemLines = items.map((i) => `- ${i.name} x${i.quantity}`).join('\n');
  const itemRows = items.map((i) => `<li>${escapeHtml(i.name)} × ${i.quantity}</li>`).join('');
  const total = (totalCents / 100).toLocaleString('en-US');
  await deliver({
    to,
    subject: `Your Nuvanti order #${orderId} is confirmed`,
    text: `Hi ${name}, thanks for your order!\n\nOrder #${orderId}\n${itemLines}\n\nTotal: ${total} EGP\n\nTrack your order any time: ${trackingUrl}`,
    html: `<p>Hi ${escapeHtml(name)}, thanks for your order!</p><p><strong>Order #${orderId}</strong></p><ul>${itemRows}</ul><p>Total: ${total} EGP</p><p><a href="${trackingUrl}">Track your order</a></p>`,
    devLabel: 'Development order-confirmation email',
    devDetail: `order #${orderId}, ${trackingUrl}`,
  });
}
export async function sendOrderStatusUpdate({ to, name, orderId, status, trackingUrl }) {
  const labels = { pending: 'Order received', paid: 'Payment received', processing: 'Being prepared', shipped: 'Shipped', out_for_delivery: 'Out for delivery', fulfilled: 'Delivered', cancelled: 'Cancelled' };
  const label = labels[status] || 'Updated';
  await deliver({
    to,
    subject: `Update on your Nuvanti order #${orderId}: ${label}`,
    text: `Hi ${name}, your Nuvanti order #${orderId} is now: ${label}.\n\nView the latest status: ${trackingUrl}`,
    html: `<p>Hi ${escapeHtml(name)}, your Nuvanti order <strong>#${orderId}</strong> is now: <strong>${escapeHtml(label)}</strong>.</p><p><a href="${trackingUrl}">View your order status</a></p>`,
    devLabel: 'Development order-status email',
    devDetail: `order #${orderId}: ${label}, ${trackingUrl}`,
  });
}

// Sent when a super_admin creates a new staff/manager/admin account. The
// account starts with an unusable random password — this link (via the same
// reset-token flow) is the only way to set a real one.
export async function sendAdminWelcome({ to, name, resetUrl }) {
  await deliver({
    to,
    subject: 'Set up your Nuvanti admin account',
    text: `Hi ${name}, an administrator account was created for you on Nuvanti. Set your password within 24 hours using this link: ${resetUrl}\n\nIf you weren't expecting this, contact your store administrator.`,
    html: `<p>Hi ${name}, an administrator account was created for you on Nuvanti.</p><p><a href="${resetUrl}">Set your password</a> to finish setting up your account.</p><p>This link expires in 24 hours. If you weren't expecting this, contact your store administrator.</p>`,
    devLabel: 'Development admin-setup URL',
    devDetail: resetUrl,
  });
}
