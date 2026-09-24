import { initAdminShell } from '../components/shell.js';
import { formatDateTime, escapeHtml } from '../components/utils.js';
import { showAdminToast } from '../components/toast.js';
import { fetchMessages, setMessageRead } from '../services/messageService.js';

const session = initAdminShell({ page: 'messages', title: 'Contact Messages' });
if (session) load();

async function load() {
  const root = document.getElementById('messagesRoot');
  try {
    const messages = await fetchMessages();
    root.innerHTML = `<div class="card"><div class="card-head"><h2>Inbox</h2><span>${messages.filter((m) => !m.isRead).length} unread</span></div>
      <div class="table-wrap"><table class="admin-table"><thead><tr><th>From</th><th>Message</th><th>Received</th><th>Status</th><th>Action</th></tr></thead><tbody>
      ${messages.length ? messages.map((m) => `<tr><td><strong>${escapeHtml(m.name)}</strong><br /><a href="mailto:${encodeURIComponent(m.email)}">${escapeHtml(m.email)}</a></td><td style="white-space:pre-wrap;max-width:460px">${escapeHtml(m.message)}</td><td>${formatDateTime(m.createdAt)}</td><td>${m.isRead ? 'Read' : 'Unread'}</td><td><button class="btn btn-outline btn-sm" data-id="${escapeHtml(m.id)}" data-read="${!m.isRead}">${m.isRead ? 'Mark unread' : 'Mark read'}</button></td></tr>`).join('') : '<tr><td colspan="5"><div class="admin-empty"><h3>Your inbox is clear</h3><p>New customer messages will appear here.</p></div></td></tr>'}
      </tbody></table></div></div>`;
    root.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      try { await setMessageRead(button.dataset.id, button.dataset.read === 'true'); await load(); }
      catch (error) { button.disabled = false; showAdminToast(error.message, 'error'); }
    }));
  } catch (error) { root.innerHTML = `<div class="admin-empty"><h3>Inbox unavailable</h3><p>${escapeHtml(error.message)}</p></div>`; }
}
