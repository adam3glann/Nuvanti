import { query } from './db.js';
import { sendAdminLoginNotification, sendContactNotification } from './mail.js';

async function activeSuperAdminEmails() {
  const { rows } = await query(`SELECT email FROM users
    WHERE role = 'super_admin' AND is_active = true ORDER BY id`);
  return rows.map((row) => row.email).filter(Boolean);
}

async function deliverNotifications(label, recipients, createMessage) {
  const results = await Promise.allSettled(recipients.map((to) => createMessage(to)));
  for (const result of results) {
    if (result.status === 'rejected') console.error(`${label} email failed:`, result.reason);
  }
}

export async function notifySuperAdminsOfLogin({ user, req }) {
  const recipients = await activeSuperAdminEmails();
  await deliverNotifications('Admin sign-in notification', recipients, (to) => sendAdminLoginNotification({
    to,
    name: user.name,
    email: user.email,
    role: user.role,
    ip: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 500),
    loggedInAt: new Date().toISOString(),
  }));
}

export async function notifySuperAdminsOfContact({ message, supportEmail }) {
  const superAdminEmails = await activeSuperAdminEmails();
  const recipients = [...new Map(
    [...superAdminEmails, supportEmail].filter(Boolean).map((email) => [email.toLowerCase(), email]),
  ).values()];
  await deliverNotifications('Contact message notification', recipients, (to) => sendContactNotification({ to, ...message }));
}
