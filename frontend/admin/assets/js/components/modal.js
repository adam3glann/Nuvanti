import { icon } from './icons.js';

let counter = 0;

export function createAdminModal({ title, bodyHTML, footHTML = '' }) {
  const id = `amodal-${++counter}`;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="a-scrim" id="${id}-scrim" data-open="false"></div>
    <div class="a-modal" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" data-open="false">
      <div class="a-modal__head">
        <h3 class="h3" id="${id}-title">${title}</h3>
        <button class="icon-btn" id="${id}-close" aria-label="Close">${icon('x')}</button>
      </div>
      <div class="a-modal__body">${bodyHTML}</div>
      ${footHTML ? `<div class="a-modal__foot">${footHTML}</div>` : ''}
    </div>
  `;
  document.body.appendChild(wrap);
  const modal = document.getElementById(id);
  const scrim = document.getElementById(`${id}-scrim`);
  const close = () => { modal.dataset.open = 'false'; scrim.dataset.open = 'false'; };
  const open = () => { modal.dataset.open = 'true'; scrim.dataset.open = 'true'; };
  document.getElementById(`${id}-close`).addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  return { id, open, close, root: wrap };
}

export function createAdminDrawer({ title, bodyHTML }) {
  const id = `adrawer-${++counter}`;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="a-scrim" id="${id}-scrim" data-open="false"></div>
    <aside class="a-drawer" id="${id}" aria-label="${title}" data-open="false">
      <div class="a-modal__head">
        <h3 class="h3">${title}</h3>
        <button class="icon-btn" id="${id}-close" aria-label="Close">${icon('x')}</button>
      </div>
      <div class="a-modal__body">${bodyHTML}</div>
    </aside>
  `;
  document.body.appendChild(wrap);
  const drawer = document.getElementById(id);
  const scrim = document.getElementById(`${id}-scrim`);
  const close = () => { drawer.dataset.open = 'false'; scrim.dataset.open = 'false'; };
  const open = () => { drawer.dataset.open = 'true'; scrim.dataset.open = 'true'; };
  document.getElementById(`${id}-close`).addEventListener('click', close);
  scrim.addEventListener('click', close);
  return { id, open, close, root: wrap };
}
