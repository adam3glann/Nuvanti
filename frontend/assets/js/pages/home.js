import { initShell, initScrollReveal } from '../main.js';
import { icon } from '../components/icons.js';
import { productCardHTML, bindProductCardEvents } from '../components/productCard.js';
import { refreshCartDrawer } from '../components/cartDrawer.js';
import { subscribeToNewsletter, unsubscribeFromNewsletter } from '../services/newsletterService.js';
import { fetchHomepageSlides } from '../services/homepageService.js';
import {
  fetchFeatured, fetchBestsellers, fetchNewArrivals, fetchCategories,
} from '../services/productService.js';

initShell({ transparentHeader: true, currentPage: 'index' });

const HERO_SLIDES = [
  {
    image: 'assets/img/lifestyle/campaign-tanktop.webp',
    eyebrow: "SUMMER '26",
    title: 'Embroidered details, made to be <span class="gradient-text">noticed</span>.',
    desc: 'Ribbed tanks finished with hand-drawn embroidery — the Cup motif or the Nuvanti Star, both in soft cream cotton.',
    cta: { label: 'Shop Tank Tops', href: 'shop.html?category=tank-tops' },
    secondary: { label: 'Explore the Shop', href: 'shop.html' },
  },
  {
    image: 'assets/img/lifestyle/hero-polo-couple.webp',
    eyebrow: 'Bestseller',
    title: 'The knitted polo everyone <span class="gradient-text">asks about</span>.',
    desc: 'Contrast tipping, chest embroidery, and a star crest on the back — in Navy, Off-White, and Olive.',
    cta: { label: 'Shop the Polo', href: 'product.html?slug=knitted-embroidered-polo' },
  },
  {
    image: 'assets/img/lifestyle/hero-sweatpants-group.webp',
    eyebrow: 'Nuv Sweatpants',
    title: 'Wide-leg comfort, built to <span class="gradient-text">move</span>.',
    desc: 'Premium cotton fleece with a graffiti-style back patch. Currently sold out — join the list for restock news.',
    cta: { label: 'View Sweatpants', href: 'product.html?slug=nuv-sweatpants' },
  },
];

loadHeroSlides();
loadFeatured();
loadCategories();
loadNewArrivals();
loadBestsellers();
initNewsletter();
initInstagramGrid();

async function loadHeroSlides() {
  let slides;
  try {
    slides = await fetchHomepageSlides();
  } catch {
    slides = HERO_SLIDES.map((slide) => ({
      imageUrl: slide.image, eyebrow: slide.eyebrow,
      title: slide.title.replace(/<[^>]*>/g, ''), description: slide.desc,
      ctaLabel: slide.cta.label, ctaHref: slide.cta.href,
      secondaryLabel: slide.secondary?.label || '', secondaryHref: slide.secondary?.href || '',
    }));
  }
  renderHero(slides);
  if (slides.length) initHeroSlider();
}

function renderHero(slides) {
  const el = document.getElementById('heroSlider');
  if (!slides.length) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    ${slides.map((s, i) => `
      <div class="hero-slide" data-active="${i === 0}" data-index="${i}" data-duration="${Math.min(30, Math.max(3, Math.floor(Number(s.durationSeconds) || 5)))}" aria-hidden="${i !== 0}">
        <img class="hero-slide__img" src="${escapeHtml(s.imageUrl)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} />
        <div class="hero-slide__scrim"></div>
        <div class="hero-slide__content">
          ${s.eyebrow ? `<p class="label hero-slide__eyebrow">${escapeHtml(s.eyebrow)}</p>` : ''}
          <h1 class="hero-slide__title font-display">${escapeHtml(s.title)}</h1>
          ${s.description ? `<p class="hero-slide__desc">${escapeHtml(s.description)}</p>` : ''}
          <div class="hero-slide__ctas">
            <a href="${escapeHtml(s.ctaHref)}" class="btn btn-primary">${escapeHtml(s.ctaLabel)}</a>
            ${s.secondaryLabel ? `<a href="${escapeHtml(s.secondaryHref)}" class="btn btn-ink-outline">${escapeHtml(s.secondaryLabel)}</a>` : ''}
          </div>
        </div>
      </div>
    `).join('')}
    <div class="hero-controls">
      <button class="hero-arrow" id="heroPrev" aria-label="Previous slide">${icon('chevronLeft')}</button>
      <div class="hero-dots" id="heroDots">
        ${slides.map((_, i) => `<button class="hero-dot" data-active="${i === 0}" data-goto="${i}" aria-label="Go to slide ${i + 1}" aria-pressed="${i === 0}"></button>`).join('')}
      </div>
      <button class="hero-arrow" id="heroNext" aria-label="Next slide">${icon('chevronRight')}</button>
    </div>
  `;
}

function initHeroSlider() {
  const slider = document.getElementById('heroSlider');
  const slides = [...slider.querySelectorAll('.hero-slide')];
  const dots = [...slider.querySelectorAll('.hero-dot')];
  slides.forEach((slide) => {
    const image = slide.querySelector('.hero-slide__img');
    const setImageShape = () => {
      if (image.naturalWidth && image.naturalHeight) {
        slide.dataset.imageShape = image.naturalWidth / image.naturalHeight < 1.2 ? 'portrait' : 'landscape';
      }
    };
    image.addEventListener('load', setImageShape, { once: true });
    setImageShape();
  });
  if (slides.length < 2) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current = 0;
  let timer;

  function goTo(index, direction) {
    const nextIndex = (index + slides.length) % slides.length;
    if (nextIndex === current) return;
    slider.dataset.direction = direction || (nextIndex > current ? 'next' : 'previous');
    current = nextIndex;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.dataset.active = String(active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.dataset.active = String(active);
      dot.setAttribute('aria-pressed', String(active));
    });
  }
  function next() { goTo(current + 1, 'next'); }
  function prev() { goTo(current - 1, 'previous'); }
  function stopAutoplay() { clearTimeout(timer); }
  function startAutoplay() {
    stopAutoplay();
    // Reduced-motion affects the transition styling, not whether the slides
    // advance. Keeping autoplay enabled also avoids desktop OS preferences
    // accidentally freezing the hero while touch devices keep cycling.
    if (document.hidden) return;
    const durationMs = Math.min(30, Math.max(3, Number(slides[current].dataset.duration) || 5)) * 1000;
    timer = setTimeout(() => {
      next();
      startAutoplay();
    }, durationMs);
  }
  function manualGo(action) {
    action();
    startAutoplay();
  }

  document.getElementById('heroNext').addEventListener('click', () => manualGo(next));
  document.getElementById('heroPrev').addEventListener('click', () => manualGo(prev));
  dots.forEach((dot) => dot.addEventListener('click', () => manualGo(() => goTo(Number(dot.dataset.goto)))));
  document.addEventListener('visibilitychange', startAutoplay);
  motionPreference.addEventListener?.('change', startAutoplay);

  slider.setAttribute('tabindex', '0');
  slider.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') manualGo(next);
    if (event.key === 'ArrowLeft') manualGo(prev);
  });

  let startX = null;
  slider.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', (event) => {
    if (startX == null) return;
    const dx = event.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) manualGo(dx < 0 ? next : prev);
    startX = null;
  }, { passive: true });

  startAutoplay();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

async function loadFeatured() {
  const el = document.getElementById('featuredGrid');
  try {
    const list = await fetchFeatured();
    el.innerHTML = list.slice(0, 8).map(productCardHTML).join('');
    bindProductCardEvents(el, { products: list, onCartChange: refreshCartDrawer });
  } catch { el.innerHTML = serviceUnavailable(); }
}

async function loadCategories() {
  const el = document.getElementById('categoryGrid');
  try {
  const list = await fetchCategories();
  el.innerHTML = list.map((c, index) => `
    <a class="category-card reveal" style="--card-order:${Math.min(index, 7)}" href="shop.html?category=${encodeURIComponent(c.slug)}">
      <img src="${escapeHtml(c.image)}" alt="${escapeHtml(c.name)}" loading="lazy" />
      <span class="category-card__label">
        <span>${escapeHtml(c.name)}</span>
        <span>${icon('chevronRight')}</span>
      </span>
    </a>
  `).join('');
  initScrollReveal(el);
  } catch { el.innerHTML = serviceUnavailable(); }
}

async function loadNewArrivals() {
  const el = document.getElementById('newArrivalsTrack');
  try {
  const list = await fetchNewArrivals();
  el.innerHTML = list.map(productCardHTML).join('');
  bindProductCardEvents(el, { products: list, onCartChange: refreshCartDrawer });

  const track = document.getElementById('newArrivalsTrack');
  document.getElementById('naPrev')?.addEventListener('click', () => track.scrollBy({ left: -320, behavior: 'smooth' }));
  document.getElementById('naNext')?.addEventListener('click', () => track.scrollBy({ left: 320, behavior: 'smooth' }));
  } catch { el.innerHTML = serviceUnavailable(); }
}

async function loadBestsellers() {
  const el = document.getElementById('bestsellerGrid');
  try {
    const list = await fetchBestsellers();
    el.innerHTML = list.slice(0, 4).map(productCardHTML).join('');
    bindProductCardEvents(el, { products: list, onCartChange: refreshCartDrawer });
  } catch { el.innerHTML = serviceUnavailable(); }
}

function serviceUnavailable() {
  return '<div class="state-block"><p>We could not load the live shop right now. Please refresh in a moment.</p></div>';
}

function initInstagramGrid() {
  const el = document.getElementById('socialGrid');
  const shots = [1, 2, 3, 4, 5, 6, 7, 8];
  el.innerHTML = shots.map((n) => `
    <a class="social-item" href="https://www.instagram.com/_.nuvanti._/" target="_blank" rel="noopener" aria-label="View on Instagram">
      <img src="assets/img/lifestyle/social-${n}.webp" alt="" loading="lazy" />
      <span class="social-item__overlay">${icon('instagram')}</span>
    </a>
  `).join('');
}

function initNewsletter() {
  const form = document.getElementById('newsletterForm');
  if (!form) return;
  const message = document.getElementById('newsletterMessage');
  const params = new URLSearchParams(location.search);
  const state = params.get('newsletter');
  if (state === 'confirmed') message.textContent = 'Your subscription is confirmed. Thank you for joining Nuvanti.';
  if (state === 'invalid') message.textContent = 'That confirmation link has expired. Please subscribe again to receive a new link.';
  if (state === 'confirmed' || state === 'invalid') {
    message.hidden = false;
    history.replaceState(null, '', location.pathname + location.hash);
  }
  if (state === 'unsubscribe') {
    const token = params.get('token') || '';
    form.hidden = true;
    message.hidden = false;
    message.textContent = 'Would you like to unsubscribe from Nuvanti marketing emails?';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-ink-outline';
    button.textContent = 'Unsubscribe';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await unsubscribeFromNewsletter(token);
        message.textContent = 'You have been unsubscribed from Nuvanti marketing emails.';
        history.replaceState(null, '', location.pathname + location.hash);
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    });
    message.insertAdjacentElement('afterend', button);
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const consent = document.getElementById('newsletterConsent');
    if (!input.value || !input.checkValidity() || !consent.checked) { form.reportValidity(); return; }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Sending…';
    message.hidden = true;
    try {
      const result = await subscribeToNewsletter(input.value);
      form.hidden = true;
      message.textContent = result.message || 'Check your inbox to confirm your subscription.';
      message.hidden = false;
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
      button.disabled = false;
      button.textContent = 'Subscribe';
    }
  });
}
