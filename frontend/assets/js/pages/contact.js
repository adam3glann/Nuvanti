import { initShell } from '../main.js';

initShell({ currentPage: 'contact' });

const form = document.getElementById('contactForm');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const inputs = form.querySelectorAll('[required]');
  for (const input of inputs) {
    if (!input.checkValidity()) { input.reportValidity(); return; }
  }
  form.hidden = true;
  document.getElementById('contactSuccess').hidden = false;
});
