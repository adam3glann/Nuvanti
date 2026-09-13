export const discounts = [
  { id: 'd-1', code: 'WELCOME10', type: 'percentage', amount: 10, minOrder: 0, usageLimit: 500, used: 214, startDate: '2026-06-01', endDate: '2026-12-31', status: 'active' },
  { id: 'd-2', code: 'FREESHIP', type: 'free_shipping', amount: 0, minOrder: 1500, usageLimit: null, used: 89, startDate: '2026-07-01', endDate: null, status: 'active' },
  { id: 'd-3', code: 'NUVANTI50', type: 'fixed', amount: 50, minOrder: 500, usageLimit: 200, used: 200, startDate: '2026-01-01', endDate: '2026-02-01', status: 'expired' },
  { id: 'd-4', code: 'FALL25', type: 'percentage', amount: 25, minOrder: 2000, usageLimit: 300, used: 12, startDate: '2026-09-01', endDate: '2026-10-15', status: 'active' },
  { id: 'd-5', code: 'ARCHIVE15', type: 'percentage', amount: 15, minOrder: 0, usageLimit: 100, used: 0, startDate: '2026-10-01', endDate: '2026-10-31', status: 'scheduled' },
];
