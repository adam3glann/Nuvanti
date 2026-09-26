import { initAdminShell } from '../components/shell.js';
import { hasPermission } from '../components/permissions.js';
import { showAdminToast } from '../components/toast.js';
import {
  applyHomepageTextColor, createHomepageSlide, deleteHomepageSlide, fetchHomepageSlides,
  updateHomepageSlide, uploadHomepageSlideImage,
} from '../services/homepageSlideService.js';
import { escapeHtml } from '../components/utils.js';

const session = initAdminShell({ page: 'content', title: 'Homepage Slides' });
const root = document.getElementById('contentRoot');
let slides = [];
if (session) {
  if (!hasPermission(session.role, 'content.manage')) {
    root.innerHTML = '<div class="admin-empty"><h1>Restricted</h1><p>You do not have permission to manage homepage slides.</p></div>';
  } else loadSlides();
}

async function loadSlides() {
  root.innerHTML = '<div class="admin-empty"><p>Loading homepage slides…</p></div>';
  try {
    slides = await fetchHomepageSlides();
    render();
  } catch (error) {
    root.innerHTML = `<div class="admin-empty"><h2>Slides unavailable</h2><p>${escapeHtml(error.message)}</p><button class="btn btn-outline" id="retrySlides">Try again</button></div>`;
    root.querySelector('#retrySlides')?.addEventListener('click', loadSlides);
  }
}

function render() {
  const allTextColor = safeColor(slides[0]?.textColor) ? slides[0].textColor : '#f5f2eb';
  root.innerHTML = `
    <div class="slides-toolbar">
      <div><p>These slides appear in the shop homepage carousel. Lower positions appear first; turn off “Show slide” to hide one without deleting it.</p><p class="hint">Upload requires Cloudinary. You can also use an existing path under <span class="mono">frontend/assets/</span> or paste a public HTTPS image URL.</p></div>
      <button class="btn btn-primary" id="addSlideBtn" type="button">Add slide</button>
    </div>
    <div class="slides-global-color"><div><strong>Default text color on every slide</strong><span>Applying this replaces individual colors and turns off headline gradients.</span></div><input id="allSlidesTextColor" type="color" value="${allTextColor}" aria-label="Default text color on every slide" /><button class="btn btn-outline btn-sm" id="applyAllSlidesTextColor" type="button">Apply to all slides</button></div>
    <div class="slides-list">${slides.length ? slides.map(renderSlide).join('') : '<div class="admin-empty"><h3>No slides</h3><p>Add a slide to show the homepage carousel.</p></div>'}</div>`;
}

function renderSlide(slide) {
  const image = safePreviewUrl(slide.imageUrl) ? slide.imageUrl : '';
  const textColor = safeColor(slide.textColor) ? slide.textColor : '#f5f2eb';
  const titleGradientStart = safeColor(slide.titleGradientStart) ? slide.titleGradientStart : '#83a88a';
  const titleGradientEnd = safeColor(slide.titleGradientEnd) ? slide.titleGradientEnd : '#f5f2eb';
  return `<form class="card slide-card" data-slide-id="${escapeHtml(slide.id)}">
    <div class="slide-card__head">
      <img class="slide-preview" src="${escapeHtml(image)}" alt="" data-preview />
      <div class="slide-card__meta"><strong>Slide ${Number(slide.position) + 1}</strong><label class="slide-toggle"><input type="checkbox" name="isActive" ${slide.isActive ? 'checked' : ''} /> Show slide</label></div>
      <div class="slide-card__actions"><button class="btn btn-outline btn-sm" type="button" data-delete>Delete</button></div>
    </div>
    <div class="card-pad">
      <div class="field-row">
        <div class="field"><label>Image path or HTTPS URL</label><input name="imageUrl" value="${escapeHtml(slide.imageUrl)}" maxlength="1000" required /><span class="hint">Example: assets/img/lifestyle/hero-polo-couple.webp</span></div>
        <div class="field"><label>Eyebrow</label><input name="eyebrow" value="${escapeHtml(slide.eyebrow)}" maxlength="80" /></div>
      </div>
      <div class="field"><label>Headline</label><input name="title" value="${escapeHtml(slide.title)}" maxlength="160" minlength="3" required /></div>
      <div class="field"><label>Description</label><textarea name="description" rows="3" maxlength="500">${escapeHtml(slide.description)}</textarea></div>
      <section class="slide-text-colors" aria-label="Slide text colors"><h3>Text colors</h3><p class="hint">Choose one color for all text, or enable individual colors below to customize particular text.</p>
        <label class="slide-gradient-toggle"><input type="checkbox" name="titleGradientEnabled" ${slide.titleGradientEnabled !== false ? 'checked' : ''} /> Use a gradient on this headline</label>
        <p class="hint">The gradient replaces a custom solid headline color while it is turned on.</p>
        <div class="field-row slide-gradient-pickers">
          ${renderGradientColor(slide.id, 'titleGradientStart', 'Headline gradient start', titleGradientStart)}
          ${renderGradientColor(slide.id, 'titleGradientEnd', 'Headline gradient end', titleGradientEnd)}
        </div>
        <div class="field-row slide-color-grid">
          ${renderColorControl(slide.id, 'textColor', 'All text on this slide', textColor)}
          ${renderOverrideColor(slide.id, 'Eyebrow', 'eyebrowColor', slide.eyebrowColor, textColor)}
          ${renderOverrideColor(slide.id, 'Headline', 'titleColor', slide.titleColor, textColor)}
          ${renderOverrideColor(slide.id, 'Description', 'descriptionColor', slide.descriptionColor, textColor)}
          ${renderOverrideColor(slide.id, 'Button text', 'buttonTextColor', slide.buttonTextColor, textColor)}
        </div>
      </section>
      <div class="field-row">
        <div class="field"><label>Primary button label</label><input name="ctaLabel" value="${escapeHtml(slide.ctaLabel)}" maxlength="50" required /></div>
        <div class="field"><label>Primary button link</label><input name="ctaHref" value="${escapeHtml(slide.ctaHref)}" maxlength="500" required /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Secondary button label (optional)</label><input name="secondaryLabel" value="${escapeHtml(slide.secondaryLabel)}" maxlength="50" /></div>
        <div class="field"><label>Secondary button link (required if label is set)</label><input name="secondaryHref" value="${escapeHtml(slide.secondaryHref)}" maxlength="500" /></div>
      </div>
      <div class="slide-card__foot">
        <div class="field slide-position"><label>Position (0 is first)</label><input name="position" type="number" min="0" max="1000" step="1" value="${Number(slide.position)}" required /></div>
        <div class="field slide-duration"><label>Time on screen (seconds)</label><input name="durationSeconds" type="number" min="3" max="30" step="1" value="${Math.min(30, Math.max(3, Number(slide.durationSeconds) || 5))}" required /><span class="hint">3–30 seconds before the next slide.</span></div>
        <div class="slide-upload"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-file hidden /><button class="btn btn-outline btn-sm" type="button" data-upload>Upload image</button><button class="btn btn-primary" type="submit">Save slide</button></div>
      </div>
    </div>
  </form>`;
}

function renderColorControl(slideId, name, label, value) {
  const inputId = `slide-${slideId}-${name}`;
  return `<div class="field slide-color-control"><label for="${inputId}">${label}</label><input id="${inputId}" name="${name}" type="color" value="${value}" /></div>`;
}

function renderGradientColor(slideId, name, label, value) {
  const inputId = `slide-${slideId}-${name}`;
  return `<div class="field slide-color-control"><label for="${inputId}">${label}</label><input id="${inputId}" name="${name}" type="color" value="${value}" /></div>`;
}

function renderOverrideColor(slideId, label, name, value, fallback) {
  const enabled = safeColor(value);
  const inputId = `slide-${slideId}-${name}`;
  return `<div class="field slide-color-control"><label class="slide-color-toggle"><input type="checkbox" name="use${name[0].toUpperCase()}${name.slice(1)}" data-use-color ${enabled ? 'checked' : ''} /> Custom ${label.toLowerCase()}</label><input id="${inputId}" name="${name}" type="color" value="${enabled ? value : fallback}" ${enabled ? '' : 'disabled'} /></div>`;
}

root?.addEventListener('click', async (event) => {
  if (event.target.closest('#applyAllSlidesTextColor')) {
    const button = event.target.closest('#applyAllSlidesTextColor');
    const textColor = root.querySelector('#allSlidesTextColor')?.value;
    button.disabled = true;
    button.textContent = 'Applying…';
    try {
      const result = await applyHomepageTextColor(textColor);
      slides = slides.map((slide) => ({ ...slide, textColor: result.textColor, eyebrowColor: null, titleColor: null, descriptionColor: null, buttonTextColor: null, titleGradientEnabled: false }));
      render();
      showAdminToast(`Text color applied to ${result.updated} slide${result.updated === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      showAdminToast(error.message, 'error');
      button.disabled = false;
      button.textContent = 'Apply to all slides';
    }
    return;
  }
  if (event.target.closest('#addSlideBtn')) {
    const position = slides.length ? Math.max(...slides.map((slide) => Number(slide.position))) + 1 : 0;
    try {
      await createHomepageSlide({ imageUrl: 'assets/img/lifestyle/campaign-banner.webp', eyebrow: '', title: 'New featured story', description: '', ctaLabel: 'Shop now', ctaHref: 'shop.html', secondaryLabel: '', secondaryHref: '', position, durationSeconds: 5, isActive: true });
      await loadSlides();
      showAdminToast('Slide added. Edit it and save when ready.', 'success');
    } catch (error) { showAdminToast(error.message, 'error'); }
    return;
  }
  const uploadButton = event.target.closest('[data-upload]');
  if (uploadButton) {
    uploadButton.closest('.slide-card')?.querySelector('[data-file]')?.click();
    return;
  }
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    const card = deleteButton.closest('.slide-card');
    if (!window.confirm('Delete this homepage slide?')) return;
    deleteButton.disabled = true;
    try {
      await deleteHomepageSlide(card.dataset.slideId);
      slides = slides.filter((slide) => String(slide.id) !== card.dataset.slideId);
      render();
      showAdminToast('Slide deleted.', 'success');
    } catch (error) { showAdminToast(error.message, 'error'); deleteButton.disabled = false; }
  }
});

root?.addEventListener('input', (event) => {
  if (event.target.name !== 'imageUrl') return;
  const preview = event.target.closest('.slide-card')?.querySelector('[data-preview]');
  if (preview && safePreviewUrl(event.target.value.trim())) preview.src = event.target.value.trim();
});

root?.addEventListener('change', async (event) => {
  if (event.target.matches('[data-use-color]')) {
    const colorInput = event.target.closest('.slide-color-control')?.querySelector('input[type="color"]');
    if (colorInput) colorInput.disabled = !event.target.checked;
    return;
  }
  if (!event.target.matches('[data-file]')) return;
  const file = event.target.files?.[0];
  const card = event.target.closest('.slide-card');
  if (!file || !card) return;
  const button = card.querySelector('[data-upload]');
  button.disabled = true;
  button.textContent = 'Uploading…';
  try {
    const result = await uploadHomepageSlideImage(file);
    card.querySelector('[name="imageUrl"]').value = result.url;
    card.querySelector('[data-preview]').src = result.url;
    showAdminToast('Image uploaded. Save the slide to publish it.', 'success');
  } catch (error) { showAdminToast(error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Upload image'; event.target.value = ''; }
});

root?.addEventListener('submit', async (event) => {
  const form = event.target.closest('.slide-card');
  if (!form) return;
  event.preventDefault();
  if (!form.reportValidity()) return;
  const value = (name) => form.elements.namedItem(name).value.trim();
  const payload = {
    imageUrl: value('imageUrl'), eyebrow: value('eyebrow'), title: value('title'),
    description: value('description'), ctaLabel: value('ctaLabel'), ctaHref: value('ctaHref'),
    secondaryLabel: value('secondaryLabel'), secondaryHref: value('secondaryHref'),
    textColor: value('textColor'),
    eyebrowColor: form.elements.namedItem('useEyebrowColor').checked ? value('eyebrowColor') : null,
    titleColor: form.elements.namedItem('useTitleColor').checked ? value('titleColor') : null,
    descriptionColor: form.elements.namedItem('useDescriptionColor').checked ? value('descriptionColor') : null,
    buttonTextColor: form.elements.namedItem('useButtonTextColor').checked ? value('buttonTextColor') : null,
    titleGradientEnabled: form.elements.namedItem('titleGradientEnabled').checked,
    titleGradientStart: value('titleGradientStart'),
    titleGradientEnd: value('titleGradientEnd'),
    position: Number(value('position')), durationSeconds: Number(value('durationSeconds')), isActive: form.elements.namedItem('isActive').checked,
  };
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = 'Saving…';
  try {
    const saved = await updateHomepageSlide(form.dataset.slideId, payload);
    slides = slides.map((slide) => String(slide.id) === String(saved.id) ? saved : slide).sort((a, b) => a.position - b.position || Number(a.id) - Number(b.id));
    render();
    showAdminToast('Homepage slide saved.', 'success');
  } catch (error) { showAdminToast(error.message, 'error'); button.disabled = false; button.textContent = 'Save slide'; }
});

function safePreviewUrl(value) {
  return /^https:\/\//i.test(value) || /^\/?assets\/[\w./-]+(?:\?[\w%=&.-]*)?$/.test(value) && !value.includes('..');
}

function safeColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}
