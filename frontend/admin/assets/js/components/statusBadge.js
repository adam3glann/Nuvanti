const MAP = {
  // order statuses
  pending: ['status-neutral', 'Pending'], processing: ['status-info', 'Processing'],
  fulfilled: ['status-success', 'Fulfilled'],
  shipped: ['status-info', 'Shipped'], delivered: ['status-success', 'Delivered'],
  cancelled: ['status-danger', 'Cancelled'], returned: ['status-warning', 'Returned'],
  // payment
  paid: ['status-success', 'Paid'], refunded: ['status-warning', 'Refunded'], failed: ['status-danger', 'Failed'],
  // stock
  in: ['status-success', 'In Stock'], low: ['status-warning', 'Low Stock'], out: ['status-danger', 'Out of Stock'],
  // generic
  active: ['status-success', 'Active'], disabled: ['status-neutral', 'Disabled'],
  published: ['status-success', 'Published'], draft: ['status-neutral', 'Draft'],
  expired: ['status-danger', 'Expired'], scheduled: ['status-info', 'Scheduled'], inactive: ['status-neutral', 'Inactive'],
  connected: ['status-success', 'Connected'], enabled: ['status-success', 'Enabled'], not_connected: ['status-neutral', 'Not Connected'],
};

export function statusBadge(key, labelOverride) {
  const [cls, label] = MAP[key] || ['status-neutral', key];
  return `<span class="status-badge ${cls}">${labelOverride || label}</span>`;
}
