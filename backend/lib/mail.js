import nodemailer from 'nodemailer';

function configured() {
  return ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].every((key) => Boolean(process.env[key]) && !process.env[key].startsWith('PASTE_'));
}

export async function sendPasswordReset({ to, resetUrl }) {
  if (!configured()) {
    if (process.env.NODE_ENV === 'production') throw new Error('Email delivery is not configured.');
    console.info(`Development password-reset URL for ${to}: ${resetUrl}`);
    return;
  }
  const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
  await transporter.sendMail({ from: process.env.MAIL_FROM, to, subject: 'Reset your Nuvanti admin password', text: `We received a request to reset your Nuvanti admin password. Use this link within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`, html: `<p>We received a request to reset your Nuvanti admin password.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 30 minutes. If you did not request it, you can ignore this email.</p>` });
}
