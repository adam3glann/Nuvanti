// Product images are stored as paths relative to the storefront (e.g.
// "assets/img/products/...") or as full Cloudinary URLs. The admin app only
// exposes the storefront's assets under /store-assets, so map accordingly.
export function storeAssetSrc(url) {
  return /^https?:\/\//i.test(url || '') ? url : `/store-assets/${String(url || '').replace(/^assets\//, '')}`;
}

// Customer-supplied strings (name, email, shipping address, contact
// messages, etc.) are rendered into innerHTML across the admin pages. Escape
// them before interpolation so a customer can't stash markup/script in a
// field that later runs in an admin's browser.
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function formatPrice(v) {
  const amount = Number(v);
  return Number.isFinite(amount) ? `${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })} EGP` : 'Price unavailable';
}
// Business totals are shown without grouping separators to match the exact
// amount owners asked to see (for example, 112231 EGP).
export function formatBusinessAmount(v) {
  const amount = Number(v);
  return Number.isFinite(amount) ? `${amount.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 2 })} EGP` : 'Amount unavailable';
}
export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function paginationHTML(page, perPage, total) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(total, page * perPage);
  return `
    <div class="pagination">
      <span>${total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}</span>
      <div class="pagination-controls">
        <button class="btn btn-outline btn-sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Previous</button>
        <span style="padding:0 .5rem;align-self:center">Page ${page} of ${totalPages}</span>
        <button class="btn btn-outline btn-sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Next</button>
      </div>
    </div>
  `;
}
