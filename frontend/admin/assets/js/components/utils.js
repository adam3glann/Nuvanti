export function formatPrice(v) {
  return `${Math.round(v).toLocaleString('en-US')} EGP`;
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
