import { initAdminShell } from '../components/shell.js';
import { showAdminToast } from '../components/toast.js';
import { icon } from '../components/icons.js';

const session = initAdminShell({ page: 'content', title: 'Homepage & CMS' });
if (session) init();

const STORAGE_KEY = 'nuvanti_admin_content_v1';
const DEFAULTS = {
  hero: [
    { title: 'Built for the way you actually move.', subtitle: 'Heavyweight cottons, considered proportions.', cta: 'Shop New Arrivals', link: '/shop.html?filter=new', active: true },
    { title: 'The hoodie everyone asks about.', subtitle: 'Brushed-back fleece, a fit that holds its shape.', cta: 'Shop the Hoodie', link: '/product.html?slug=signature-hoodie', active: true },
  ],
  banner: { text: 'Free shipping over 3,000 EGP', cta: 'Shop Now', link: '/shop.html', active: true },
  faq: [
    { q: 'How do I track my order?', a: 'You\'ll receive a tracking link by email once your order ships.' },
    { q: 'What is your return policy?', a: 'Unworn items can be returned within 30 days of delivery.' },
  ],
};

function getContent() {
  try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) }; } catch { return DEFAULTS; }
}
function saveContent(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

let tab = 'hero';

function init() {
  renderTabs();
  render();
}

function renderTabs() {
  document.getElementById('tabs').innerHTML = ['hero', 'banner', 'faq'].map((t) => `
    <button class="admin-tab" data-tab="${t}" aria-selected="${tab === t}">${t === 'hero' ? 'Hero Slides' : t === 'banner' ? 'Promo Banner' : 'FAQ'}</button>
  `).join('');
  document.querySelectorAll('.admin-tab').forEach((btn) => btn.addEventListener('click', () => { tab = btn.dataset.tab; renderTabs(); render(); }));
}

function render() {
  const content = getContent();
  const root = document.getElementById('contentRoot');

  if (tab === 'hero') {
    root.innerHTML = `
      <div id="heroList" style="display:flex;flex-direction:column;gap:1rem"></div>
      <button class="btn btn-outline" id="addSlideBtn" style="margin-top:1rem">+ Add Slide</button>
    `;
    renderHeroList(content.hero);
    document.getElementById('addSlideBtn').addEventListener('click', () => {
      content.hero.push({ title: 'New Slide', subtitle: '', cta: 'Shop Now', link: '/shop.html', active: false });
      saveContent(content);
      render();
    });
  } else if (tab === 'banner') {
    root.innerHTML = `
      <div class="field"><label>Banner Text</label><input id="bText" value="${esc(content.banner.text)}" /></div>
      <div class="field"><label>CTA Label</label><input id="bCta" value="${esc(content.banner.cta)}" /></div>
      <div class="field"><label>Link</label><input id="bLink" value="${esc(content.banner.link)}" /></div>
      <label class="checkbox-row" style="margin-bottom:1rem"><input type="checkbox" id="bActive" ${content.banner.active ? 'checked' : ''}/> Active</label>
      <button class="btn btn-primary" id="saveBannerBtn">Save Banner</button>
    `;
    document.getElementById('saveBannerBtn').addEventListener('click', () => {
      content.banner = { text: val('bText'), cta: val('bCta'), link: val('bLink'), active: document.getElementById('bActive').checked };
      saveContent(content);
      showAdminToast('Banner saved.', 'success');
    });
  } else {
    root.innerHTML = `
      <div id="faqList" style="display:flex;flex-direction:column;gap:1rem"></div>
      <button class="btn btn-outline" id="addFaqBtn" style="margin-top:1rem">+ Add FAQ</button>
    `;
    renderFaqList(content.faq);
    document.getElementById('addFaqBtn').addEventListener('click', () => {
      content.faq.push({ q: 'New question', a: '' });
      saveContent(content);
      render();
    });
  }
}

function renderHeroList(slides) {
  const el = document.getElementById('heroList');
  el.innerHTML = slides.map((s, i) => `
    <div class="card card-pad" data-slide="${i}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
        <strong>Slide ${i + 1}</strong>
        <div style="display:flex;gap:.5rem;align-items:center">
          <label class="checkbox-row"><input type="checkbox" class="slide-active" ${s.active ? 'checked' : ''}/> Active</label>
          <button class="icon-btn" data-remove-slide="${i}" aria-label="Remove">${icon('trash')}</button>
        </div>
      </div>
      <div class="field"><label>Title</label><input class="slide-title" value="${esc(s.title)}" /></div>
      <div class="field"><label>Subtitle</label><input class="slide-subtitle" value="${esc(s.subtitle)}" /></div>
      <div class="field-row">
        <div class="field"><label>CTA Label</label><input class="slide-cta" value="${esc(s.cta)}" /></div>
        <div class="field"><label>Link</label><input class="slide-link" value="${esc(s.link)}" /></div>
      </div>
      <button class="btn btn-outline btn-sm save-slide-btn">Save Slide</button>
    </div>
  `).join('');

  el.querySelectorAll('[data-slide]').forEach((card) => {
    const i = Number(card.dataset.slide);
    card.querySelector('.save-slide-btn').addEventListener('click', () => {
      const content = getContent();
      content.hero[i] = {
        title: card.querySelector('.slide-title').value, subtitle: card.querySelector('.slide-subtitle').value,
        cta: card.querySelector('.slide-cta').value, link: card.querySelector('.slide-link').value,
        active: card.querySelector('.slide-active').checked,
      };
      saveContent(content);
      showAdminToast('Slide saved.', 'success');
    });
  });
  el.querySelectorAll('[data-remove-slide]').forEach((btn) => btn.addEventListener('click', () => {
    const content = getContent();
    content.hero.splice(Number(btn.dataset.removeSlide), 1);
    saveContent(content);
    render();
  }));
}

function renderFaqList(faqs) {
  const el = document.getElementById('faqList');
  el.innerHTML = faqs.map((f, i) => `
    <div class="card card-pad" data-faq="${i}">
      <div class="field"><label>Question</label><input class="faq-q" value="${esc(f.q)}" /></div>
      <div class="field"><label>Answer</label><textarea class="faq-a" rows="2">${esc(f.a)}</textarea></div>
      <div style="display:flex;gap:.5rem">
        <button class="btn btn-outline btn-sm save-faq-btn">Save</button>
        <button class="btn btn-ghost btn-sm" data-remove-faq="${i}" style="color:var(--a-danger)">Remove</button>
      </div>
    </div>
  `).join('');
  el.querySelectorAll('[data-faq]').forEach((card) => {
    const i = Number(card.dataset.faq);
    card.querySelector('.save-faq-btn').addEventListener('click', () => {
      const content = getContent();
      content.faq[i] = { q: card.querySelector('.faq-q').value, a: card.querySelector('.faq-a').value };
      saveContent(content);
      showAdminToast('FAQ saved.', 'success');
    });
  });
  el.querySelectorAll('[data-remove-faq]').forEach((btn) => btn.addEventListener('click', () => {
    const content = getContent();
    content.faq.splice(Number(btn.dataset.removeFaq), 1);
    saveContent(content);
    render();
  }));
}

function val(id) { return document.getElementById(id).value; }
function esc(s) { return (s || '').replace(/"/g, '&quot;'); }
