import { icon } from './icons.js';

let counter = 0;

export function createModal({ title, bodyHTML }) {
  const id = `modal-${++counter}`;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal-scrim" id="${id}-scrim" data-open="false"></div>
    <div class="modal" id="${id}" role="dialog" aria-modal="true" aria-labelledby="${id}-title" data-open="false">
      <div class="modal__head">
        <h3 class="h3" id="${id}-title">${title}</h3>
        <button class="icon-btn" id="${id}-close" aria-label="Close">${icon('close')}</button>
      </div>
      <div class="modal__body">${bodyHTML}</div>
    </div>
  `;
  document.body.appendChild(wrap);

  const modal = document.getElementById(id);
  const scrim = document.getElementById(`${id}-scrim`);
  const close = () => { modal.dataset.open = 'false'; scrim.dataset.open = 'false'; document.body.style.overflow = ''; };
  const open = () => { modal.dataset.open = 'true'; scrim.dataset.open = 'true'; document.body.style.overflow = 'hidden'; };

  document.getElementById(`${id}-close`).addEventListener('click', close);
  scrim.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  return { open, close, id };
}
