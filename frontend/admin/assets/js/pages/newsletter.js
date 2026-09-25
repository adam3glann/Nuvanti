import { initAdminShell } from '../components/shell.js';
import { hasPermission } from '../components/permissions.js';
import { escapeHtml, formatDateTime } from '../components/utils.js';
import { showAdminToast } from '../components/toast.js';
import { fetchNewsletterSubscribers } from '../services/newsletterService.js';

const session = initAdminShell({ page: 'newsletter', title: 'Newsletter' });
if (session && !hasPermission(session.role, 'content.manage')) {
  document.getElementById('newsletterRoot').innerHTML = '<div class="admin-empty"><h2>Restricted</h2><p>You do not have permission to view subscribers.</p></div>';
} else if (session) load();

async function load() {
  const root = document.getElementById('newsletterRoot');
  root.innerHTML = '<div class="a-skeleton" style="height:180px;border-radius:12px"></div>';
  try {
    const subscribers = await fetchNewsletterSubscribers();
    const rows = subscribers.map((item) => '<tr><td>' + escapeHtml(item.email) + '</td><td>' + formatDateTime(item.confirmedAt) + '</td><td>' + formatDateTime(item.consentedAt) + '</td></tr>').join('');
    root.innerHTML = '<div class="page-title-row"><div><h1>Newsletter</h1><p>Confirmed subscribers who consented to Nuvanti marketing emails.</p></div><button class="btn btn-primary" id="exportSubscribers" ' + (subscribers.length ? '' : 'disabled') + '>Export CSV</button></div><div class="card"><div class="table-wrap"><table class="admin-table"><thead><tr><th>Email</th><th>Confirmed</th><th>Consent Recorded</th></tr></thead><tbody>' + (rows || '<tr><td colspan="3"><div class="admin-empty"><h3>No confirmed subscribers yet</h3><p>New subscribers appear here after confirming their email.</p></div></td></tr>') + '</tbody></table></div></div>';
    document.getElementById('exportSubscribers')?.addEventListener('click', () => exportCsv(subscribers));
  } catch (error) {
    root.innerHTML = '<div class="admin-empty"><h2>Newsletter list unavailable</h2><p>' + escapeHtml(error.message) + '</p><button class="btn btn-outline" id="retryNewsletter">Try Again</button></div>';
    document.getElementById('retryNewsletter')?.addEventListener('click', load);
  }
}

function exportCsv(rows) {
  const quote = (value) => {
    let text = String(value ?? '');
    if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
    return '"' + text.replace(/"/g, '""') + '"';
  };
  const csv = ['Email,Confirmed,Consent Recorded', ...rows.map((item) => [item.email, item.confirmedAt, item.consentedAt].map(quote).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'nuvanti-newsletter-subscribers.csv';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showAdminToast('Subscriber list exported.', 'success');
}
