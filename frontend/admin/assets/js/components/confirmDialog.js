let counter = 0;

// confirmDialog — for ordinary destructive actions ("Cancel Order?").
// Resolves true/false.
export function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = true }) {
  return new Promise((resolve) => {
    const id = `cf-${++counter}`;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="a-scrim" id="${id}-scrim" data-open="true"></div>
      <div class="a-modal ${danger ? 'a-modal--danger' : ''}" id="${id}" role="alertdialog" aria-modal="true" aria-labelledby="${id}-title" data-open="true">
        <div class="a-modal__head"><h3 id="${id}-title" class="h3">${title}</h3></div>
        <div class="a-modal__body"><p style="color:var(--a-muted);font-size:0.85rem">${body}</p></div>
        <div class="a-modal__foot">
          <button class="btn btn-outline" id="${id}-cancel">Keep</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="${id}-confirm">${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    const cleanup = (result) => { wrap.remove(); resolve(result); };
    document.getElementById(`${id}-cancel`).addEventListener('click', () => cleanup(false));
    document.getElementById(`${id}-scrim`).addEventListener('click', () => cleanup(false));
    document.getElementById(`${id}-confirm`).addEventListener('click', () => cleanup(true));
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { cleanup(false); document.removeEventListener('keydown', esc); } });
  });
}

// typedConfirmDialog — for highly destructive actions ("type DELETE to confirm").
export function typedConfirmDialog({ title, body, confirmWord = 'DELETE', confirmLabel = 'Delete Permanently' }) {
  return new Promise((resolve) => {
    const id = `tcf-${++counter}`;
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="a-scrim" id="${id}-scrim" data-open="true"></div>
      <div class="a-modal a-modal--danger" id="${id}" role="alertdialog" aria-modal="true" aria-labelledby="${id}-title" data-open="true">
        <div class="a-modal__head"><h3 id="${id}-title" class="h3">${title}</h3></div>
        <div class="a-modal__body">
          <p style="color:var(--a-muted);font-size:0.85rem;margin-bottom:1rem">${body}</p>
          <div class="field" style="margin-bottom:0">
            <label for="${id}-input">Type <strong>${confirmWord}</strong> to confirm</label>
            <input type="text" id="${id}-input" autocomplete="off" />
          </div>
        </div>
        <div class="a-modal__foot">
          <button class="btn btn-outline" id="${id}-cancel">Keep</button>
          <button class="btn btn-danger" id="${id}-confirm" disabled>${confirmLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    const input = document.getElementById(`${id}-input`);
    const confirmBtn = document.getElementById(`${id}-confirm`);
    input.addEventListener('input', () => { confirmBtn.disabled = input.value.trim() !== confirmWord; });
    const cleanup = (result) => { wrap.remove(); resolve(result); };
    document.getElementById(`${id}-cancel`).addEventListener('click', () => cleanup(false));
    document.getElementById(`${id}-scrim`).addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));
    setTimeout(() => input.focus(), 100);
  });
}
