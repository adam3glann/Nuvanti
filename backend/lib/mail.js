import nodemailer from 'nodemailer';
import { storePublicOrigin } from './publicOrigins.js';

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
    html: emailLayout({ preheader: 'Your Nuvanti email delivery is set up.', eyebrow: 'EMAIL DELIVERY TEST', title: 'Your email is working', intro: 'This message confirms that Nuvanti can send email from its production service.' }),
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
    html: emailLayout({ preheader: `A new contact message from ${name}.`, eyebrow: 'CONTACT MESSAGE', title: 'A customer got in touch', intro: 'Reply directly to this email to respond to the customer.', content: `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:12px 0;border-bottom:1px solid #e4e5df;font-family:Arial,sans-serif;font-size:14px;color:#17211d"><strong>${safeName}</strong><br><span style="color:#66716b">${safeEmail}</span></td></tr><tr><td style="padding:18px 0;font-family:Arial,sans-serif;font-size:14px;line-height:22px;color:#17211d">${safeMessage.replace(/\n/g, '<br>')}</td></tr></table>` }),
    devLabel: 'Development contact notification',
    devDetail: `message from ${email}`,
  });
}

export async function sendPasswordReset({ to, resetUrl }) {
  await deliver({
    to,
    subject: 'Reset your Nuvanti password',
    text: `We received a request to reset your Nuvanti password. Use this link within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: emailLayout({ preheader: 'Reset your Nuvanti password.', eyebrow: 'ACCOUNT SECURITY', title: 'Reset your password', intro: 'We received a request to reset your Nuvanti password. Use the button below to choose a new one.', actionLabel: 'RESET PASSWORD', actionUrl: resetUrl, footerNote: 'This link expires in 30 minutes. If you did not request a reset, you can ignore this email.' }),
    devLabel: 'Development password-reset URL',
    devDetail: resetUrl,
  });
}

export async function sendAdminLoginCode({ to, name, code }) {
  const safeName = escapeHtml(name || 'administrator');
  await deliver({
    to,
    subject: 'Your Nuvanti admin sign-in code',
    text: `Hi ${name || 'administrator'}, your Nuvanti admin sign-in code is ${code}. It expires in 10 minutes and can be used once. If you did not try to sign in, change your password and contact the store owner.`,
    html: emailLayout({ preheader: 'Your one-time Nuvanti administrator sign-in code.', eyebrow: 'ADMIN SECURITY', title: `Hi ${safeName}, here is your code`, intro: 'Enter this one-time code to finish signing in.', content: `<div style="padding:18px 12px;background-color:#f2f2ec;border:1px solid #e4e5df;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:bold;letter-spacing:8px;color:#17211d">${escapeHtml(code)}</div>`, footerNote: 'This code expires in 10 minutes and can be used once. If you did not try to sign in, change your password and contact the store owner.' }),
    devLabel: 'Development admin sign-in code',
    devDetail: code,
  });
}

export async function sendVerificationEmail({ to, name, verifyUrl }) {
  await deliver({
    to,
    subject: 'Confirm your email for Nuvanti',
    text: `Hi ${name}, please confirm your email address: ${verifyUrl}\n\nThis link expires in 24 hours.`,
    html: emailLayout({ preheader: 'Confirm your email address for Nuvanti.', eyebrow: 'WELCOME TO NUVANTI', title: `Hi ${escapeHtml(name)}, confirm your email`, intro: 'One quick step to finish setting up your account and get ready to shop.', actionLabel: 'CONFIRM EMAIL', actionUrl: verifyUrl, footerNote: 'This link expires in 24 hours. If you did not create an account, you can ignore this email.' }),
    devLabel: 'Development email-verification URL',
    devDetail: verifyUrl,
  });
}

export async function sendNewsletterConfirmation({ to, confirmUrl, unsubscribeUrl }) {
  await deliver({
    to,
    subject: 'Confirm your Nuvanti newsletter subscription',
    text: `Please confirm that you want Nuvanti updates about new arrivals, restocks, and occasional offers: ${confirmUrl}\n\nIf you did not request this, ignore this email. You can unsubscribe at any time: ${unsubscribeUrl}`,
    html: emailLayout({ preheader: 'Confirm your Nuvanti newsletter subscription.', eyebrow: 'NUVANTI NEWSLETTER', title: 'A little Nuvanti in your inbox', intro: 'Confirm your subscription for updates about new arrivals, restocks, and occasional offers.', content: `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:19px;color:#66716b">If you did not request this, ignore this email. You can <a href="${escapeHtml(unsubscribeUrl)}" style="color:#315b45">unsubscribe here</a>.</p>`, actionLabel: 'CONFIRM SUBSCRIPTION', actionUrl: confirmUrl }),
    devLabel: 'Development newsletter confirmation URL',
    devDetail: confirmUrl,
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function emailLayout({ preheader = '', eyebrow = 'NUVANTI', title, intro = '', content = '', actionLabel, actionUrl, footerNote = 'Thank you for choosing Nuvanti.' }) {
  const action = actionLabel && actionUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr><td align="center" bgcolor="#315b45" style="border-radius:4px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:14px 26px;border:1px solid #315b45;border-radius:4px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;line-height:18px;text-decoration:none">${escapeHtml(actionLabel)}</a></td></tr></table>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body bgcolor="#f2f2ec" style="margin:0;padding:0;background-color:#f2f2ec"><div style="display:none;font-size:1px;color:#f2f2ec;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f2ec" style="width:100%;background-color:#f2f2ec"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e4e5df"><tr><td bgcolor="#17211d" style="padding:22px 30px;background-color:#17211d;border-bottom:4px solid #537760"><div style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;letter-spacing:3px;line-height:26px;color:#ffffff">NUVANTI</div><div style="padding-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:1.5px;line-height:15px;color:#d4ddd5">CONSIDERED CLOTHING · MADE TO LAST</div></td></tr><tr><td style="padding:30px 30px 10px;font-family:Arial,Helvetica,sans-serif;color:#17211d"><div style="font-size:11px;font-weight:bold;letter-spacing:1.5px;line-height:16px;color:#477354">${escapeHtml(eyebrow)}</div><h1 style="margin:9px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:bold;line-height:32px;color:#17211d">${title}</h1>${intro ? `<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:23px;color:#59645e">${intro}</p>` : ''}</td></tr>${content ? `<tr><td style="padding:12px 30px 22px;font-family:Arial,Helvetica,sans-serif;color:#17211d">${content}</td></tr>` : ''}${action ? `<tr><td align="center" style="padding:8px 30px 30px">${action}</td></tr>` : ''}<tr><td align="center" bgcolor="#17211d" style="padding:18px 24px;background-color:#17211d;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:17px;color:#d4ddd5">${escapeHtml(footerNote)}<br>Nuvanti · Egypt</td></tr></table></td></tr></table></body></html>`;
}

function emailImageUrl(value) {
  try {
    const url = new URL(String(value || ''), storePublicOrigin());
    return url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
}

// Sent right after checkout. Best-effort â€” a failure here must never fail
// the order itself, so callers should wrap this in try/catch.
export async function sendOrderConfirmation({ to, name, orderId, items, totalCents, subtotalCents, discountCents, discountCode, shippingCents, delivery, shippingAddress, trackingUrl }) {
  const itemLines = items.map((item) => {
    const variant = [item.color, item.size].filter(Boolean).join(' / ');
    const unitPrice = (Number(item.priceCents) / 100).toLocaleString('en-US');
    return `- ${item.name}${variant ? ` (${variant})` : ''} x${item.quantity} — ${unitPrice} EGP each`;
  }).join('\n');
  const itemRows = items.map((item) => {
    const variant = [item.color, item.size].filter(Boolean).join(' / ');
    const imageUrl = emailImageUrl(item.image);
    const image = imageUrl
      ? `<img src="${escapeHtml(imageUrl)}" width="72" height="88" alt="${escapeHtml(item.name)}" style="display:block;width:72px;height:88px;object-fit:cover;border:0;background-color:#f2f2ec">`
      : '<span style="display:block;width:72px;height:88px;background-color:#f2f2ec"></span>';
    const lineTotal = (Number(item.priceCents) * Number(item.quantity) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<tr><td width="84" valign="top" style="padding:14px 0;border-bottom:1px solid #e4e5df">${image}</td><td valign="top" style="padding:14px 8px;border-bottom:1px solid #e4e5df;font-family:Arial,Helvetica,sans-serif;color:#17211d"><strong style="font-size:14px;line-height:20px">${escapeHtml(item.name)}</strong>${variant ? `<div style="padding-top:4px;color:#66716b;font-size:12px">${escapeHtml(variant)}</div>` : ''}<div style="padding-top:6px;color:#66716b;font-size:12px">Qty ${Number(item.quantity)}</div></td><td width="105" valign="top" align="right" style="padding:14px 0;border-bottom:1px solid #e4e5df;font-family:Arial,Helvetica,sans-serif;font-size:13px;white-space:nowrap;color:#17211d">${lineTotal} EGP</td></tr>`;
  }).join('');
  const total = (Number(totalCents) / 100).toLocaleString('en-US');
  const subtotal = (Number(subtotalCents) / 100).toLocaleString('en-US');
  const discount = (Number(discountCents || 0) / 100).toLocaleString('en-US');
  const shippingCost = (Number(shippingCents) / 100).toLocaleString('en-US');
  const address = [shippingAddress?.name || name, shippingAddress?.phone, shippingAddress?.address1, shippingAddress?.city, shippingAddress?.country, shippingAddress?.postalCode].filter(Boolean).join(', ');
  const discountLine = Number(discountCents) > 0 ? `Discount${discountCode ? ` (${discountCode})` : ''}: -${discount} EGP\n` : '';
  const discountHtml = Number(discountCents) > 0 ? `<tr><td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#59645e">Discount${discountCode ? ` (${escapeHtml(discountCode)})` : ''}</td><td align="right" style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#315b45">-${discount} EGP</td></tr>` : '';
  const deliveryLabel = delivery === 'express' ? 'Express' : 'Standard';
  const summaryHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#59645e">Subtotal</td><td align="right" style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#17211d">${subtotal} EGP</td></tr>${discountHtml}<tr><td style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#59645e">${deliveryLabel} shipping</td><td align="right" style="padding:5px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#17211d">${shippingCost} EGP</td></tr><tr><td style="padding:13px 0 4px;border-top:1px solid #d9ddd6;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#17211d">Total</td><td align="right" style="padding:13px 0 4px;border-top:1px solid #d9ddd6;font-family:Arial,Helvetica,sans-serif;font-size:17px;font-weight:bold;color:#17211d">${total} EGP</td></tr></table>`;
  const orderContent = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td colspan="3" bgcolor="#f2f2ec" style="padding:12px 14px;background-color:#f2f2ec;border:1px solid #e4e5df;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#17211d"><strong>Order NV-${escapeHtml(orderId)}</strong></td></tr>${itemRows}</table><div style="padding-top:18px">${summaryHtml}</div><div style="margin-top:18px;padding:14px;background-color:#f7f7f2;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#59645e"><strong style="color:#17211d">Delivering to</strong><br>${escapeHtml(address)}</div>`;
  await deliver({
    to,
    subject: `Your Nuvanti order NV-${orderId} is confirmed`,
    text: `Hi ${name}, thanks for your order!\n\nOrder NV-${orderId}\nItems:\n${itemLines}\n\nSubtotal: ${subtotal} EGP\n${discountLine}Shipping (${deliveryLabel}): ${shippingCost} EGP\nTotal: ${total} EGP\n\nDelivering to: ${address}\n\nTrack your order: ${trackingUrl}`,
    html: emailLayout({ preheader: `Order NV-${orderId} is confirmed. Track your Nuvanti order anytime.`, eyebrow: 'ORDER CONFIRMED', title: `Thanks for your order, ${escapeHtml(name)}.`, intro: 'We’ve received your order and are getting it ready.', content: orderContent, actionLabel: 'TRACK YOUR ORDER', actionUrl: trackingUrl, footerNote: 'You can also view your order details from your Nuvanti account.' }),
    devLabel: 'Development order-confirmation email',
    devDetail: `order #${orderId}, ${trackingUrl}`,
  });
}
export async function sendOrderStatusUpdate({ to, name, orderId, status, trackingUrl }) {
  const labels = { pending: 'Order received', paid: 'Payment received', processing: 'Being prepared', shipped: 'Shipped', out_for_delivery: 'Out for delivery', fulfilled: 'Delivered', cancelled: 'Cancelled' };
  const label = labels[status] || 'Updated';
  await deliver({
    to,
    subject: `Update on your Nuvanti order NV-${orderId}: ${label}`,
    text: `Hi ${name}, your Nuvanti order NV-${orderId} is now: ${label}.\n\nView the latest status: ${trackingUrl}`,
    html: emailLayout({ preheader: `Order NV-${orderId} status: ${label}.`, eyebrow: 'ORDER UPDATE', title: `Your order is ${escapeHtml(label.toLowerCase())}`, intro: `Hi ${escapeHtml(name)}, the status of order NV-${escapeHtml(orderId)} has changed.`, actionLabel: 'VIEW ORDER STATUS', actionUrl: trackingUrl }),
    devLabel: 'Development order-status email',
    devDetail: `order #${orderId}: ${label}, ${trackingUrl}`,
  });
}

// Sent when a super_admin creates a new staff/manager/admin account. The
// account starts with an unusable random password â€” this link (via the same
// reset-token flow) is the only way to set a real one.
export async function sendAdminWelcome({ to, name, resetUrl }) {
  await deliver({
    to,
    subject: 'Set up your Nuvanti admin account',
    text: `Hi ${name}, an administrator account was created for you on Nuvanti. Set your password within 24 hours using this link: ${resetUrl}\n\nIf you weren't expecting this, contact your store administrator.`,
    html: emailLayout({ preheader: 'Finish setting up your Nuvanti administrator account.', eyebrow: 'ADMIN ACCOUNT', title: `Welcome, ${escapeHtml(name)}`, intro: 'An administrator account was created for you on Nuvanti. Set a password to finish setting it up.', actionLabel: 'SET YOUR PASSWORD', actionUrl: resetUrl, footerNote: 'This link expires in 24 hours. If you were not expecting this, contact your store administrator.' }),
    devLabel: 'Development admin-setup URL',
    devDetail: resetUrl,
  });
}
