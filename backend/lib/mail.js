import nodemailer from 'nodemailer';

function configured() {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].every((key) => Boolean(process.env[key]) && !process.env[key].startsWith('PASTE_'));
}

async function deliver({ to, subject, text, html, devLabel, devDetail }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email delivery is not configured.');
    console.info(`${devLabel} for ${to}: ${devDetail}`);
    return;
  }
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject, text, html });
}

export async function sendPasswordReset({ to, resetUrl }) {
  await deliver({
    to,
    subject: 'Reset your Nuvanti admin password',
    text: `We received a request to reset your Nuvanti admin password. Use this link within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>We received a request to reset your Nuvanti admin password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>`,
    devLabel: 'Development password-reset URL',
    devDetail: resetUrl,
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
