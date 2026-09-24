import { initShell } from '../main.js';
import { API_ORIGIN } from '../config.js';
import { showToast } from '../components/toast.js';

initShell({ currentPage: 'contact' });

const form = document.getElementById('contactForm');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const inputs = form.querySelectorAll('[required]');
  for (const input of inputs) {
    if (!input.checkValidity()) { input.reportValidity(); return; }
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    const response = await fetch(`${API_ORIGIN}/api/contact`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: document.getElementById('cName').value, email: document.getElementById('cEmail').value, message: `${document.getElementById('cSubject').value}\n\n${document.getElementById('cMessage').value}` }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Message could not be sent. Please try again.');
    form.hidden = true;
    document.getElementById('contactSuccess').hidden = false;
  } catch (error) {
    showToast(error.message || 'Message could not be sent. Please try again.', { icon: 'alertTriangle' });
    button.disabled = false;
    button.textContent = 'Send Message';
  }
});
