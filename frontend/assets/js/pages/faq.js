import { initShell } from '../main.js';
import { icon } from '../components/icons.js';

initShell({ currentPage: 'faq' });

const FAQS = {
  orders: [
    { q: 'How do I track my order?', a: 'Once your order ships, you\'ll receive a tracking link by email. You can also view order status from your account under Orders.' },
    { q: 'Can I change or cancel my order?', a: 'Contact us within 2 hours of placing your order and we\'ll do our best to adjust it before it enters fulfillment.' },
  ],
  shipping: [
    { q: 'How much does shipping cost?', a: 'Standard shipping is free on orders over 3,000 EGP, otherwise a flat 75 EGP. Express shipping is available for 150 EGP.' },
    { q: 'How long does delivery take?', a: 'Standard delivery takes 4–7 business days. Express delivery takes 1–2 business days.' },
  ],
  returns: [
    { q: 'What is your return policy?', a: 'Unworn items with tags attached can be returned within 30 days of delivery for a full refund.' },
    { q: 'How do I start a return?', a: 'Go to your account under Orders and select "Start a Return," or contact us directly with your order number.' },
  ],
  payments: [
    { q: 'What payment methods do you accept?', a: 'We accept Visa, Mastercard, Meeza, and Cash on Delivery within Egypt.' },
    { q: 'Is my payment information secure?', a: 'Yes — all payments are processed by a certified third-party payment provider. We never store your full card details.' },
  ],
  products: [
    { q: 'What are your products made from?', a: 'Each product page lists exact materials. We favor heavier-weight cottons and blends built to hold shape over time.' },
    { q: 'How do I care for my Nuvanti pieces?', a: 'Machine wash cold, inside out, and hang or lay flat to dry. Avoid high heat, which can shrink heavier cottons.' },
  ],
  sizing: [
    { q: 'How do I find my size?', a: 'Check our full Size Guide for detailed measurements per item. Most pieces are designed with a relaxed, true-to-size fit.' },
    { q: 'What if my size is sold out?', a: 'Sizes typically restock within 2–3 weeks. You can also reach out and we\'ll notify you when it\'s back.' },
  ],
};

const CATEGORY_LABELS = {
  orders: 'Orders', shipping: 'Shipping', returns: 'Returns',
  payments: 'Payments', products: 'Products', sizing: 'Sizing',
};

render();

function render() {
  const root = document.getElementById('faqRoot');
  root.innerHTML = Object.entries(FAQS).map(([key, items]) => `
    <div id="${key}" style="margin-bottom:3rem;scroll-margin-top:6rem">
      <h2 class="h3" style="margin-bottom:1rem">${CATEGORY_LABELS[key]}</h2>
      ${items.map((item, i) => `
        <div class="accordion-item">
          <button class="accordion-trigger" aria-expanded="false" aria-controls="${key}-${i}" id="${key}-trigger-${i}">
            ${item.q} <span class="plus">${icon('plus')}</span>
          </button>
          <div class="accordion-panel" id="${key}-${i}" role="region" aria-labelledby="${key}-trigger-${i}">
            <div class="accordion-panel__inner">${item.a}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  root.querySelectorAll('.accordion-trigger').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      const isOpen = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!isOpen));
      panel.style.maxHeight = isOpen ? '0px' : `${panel.scrollHeight}px`;
    });
  });
}
