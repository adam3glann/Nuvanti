import { initShell } from '../main.js';
import { icon } from '../components/icons.js';

initShell({ currentPage: 'faq' });

const FAQS = {
  orders: [
    { q: 'How do I track my order?', a: 'Once your order ships, you\'ll receive a tracking link by email. You can also view order status from your account under Orders.' },
    { q: 'Can I change or cancel my order?', a: 'Contact us within 2 hours of placing your order and we\'ll do our best to adjust it before it enters fulfillment.' },
  ],
  shipping: [
    { q: 'Where do you ship?', a: 'We currently ship inside Egypt only.' },
    { q: 'How much does shipping cost?', a: 'Shipping fees are calculated based on your location and are displayed at checkout.' },
    { q: 'How long does delivery take?', a: 'Orders are processed within 1–3 business days. Delivery to Cairo &amp; Giza takes 2–6 business days.' },
  ],
  returns: [
    { q: 'What is your exchange policy?', a: 'We offer exchange only within 14 days from the delivery date. The item must be unused, in its original condition and packaging, with the original invoice provided.' },
    { q: 'Can I get a refund?', a: 'Refunds are not available. You can check your order while the courier is at your door — if it fits, keep it. If not, return it immediately to the courier, as returns aren\'t accepted afterward. In case of a manufacturing defect, report it within 48 hours with photos or video and you may receive a replacement or refund.' },
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
