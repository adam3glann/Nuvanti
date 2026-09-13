export const auditLogs = [
  { id: 'log-1', user: 'Laila Farouk', role: 'super_admin', action: 'created administrator', resource: 'Karim Adel (staff)', timestamp: '2026-08-29T09:00:00Z', ip: '41.20.xx.xx' },
  { id: 'log-2', user: 'Omar Sabry', role: 'admin', action: 'changed product price', resource: 'Signature Hoodie (2150 → 2250 EGP)', timestamp: '2026-08-30T14:22:00Z', ip: '156.202.xx.xx' },
  { id: 'log-3', user: 'Yara Khaled', role: 'manager', action: 'adjusted inventory', resource: 'Oversized Essential Tee — M (+20)', timestamp: '2026-08-31T10:05:00Z', ip: '197.55.xx.xx' },
  { id: 'log-4', user: 'Karim Adel', role: 'staff', action: 'updated order status', resource: 'NV-100014 → Shipped', timestamp: '2026-09-01T08:44:00Z', ip: '102.44.xx.xx' },
  { id: 'log-5', user: 'Omar Sabry', role: 'admin', action: 'deleted product', resource: 'Limited Capsule Tee (discontinued)', timestamp: '2026-09-01T16:10:00Z', ip: '156.202.xx.xx' },
  { id: 'log-6', user: 'Laila Farouk', role: 'super_admin', action: 'disabled administrator', resource: 'Nour Ibrahim (staff)', timestamp: '2026-06-11T12:00:00Z', ip: '41.20.xx.xx' },
  { id: 'log-7', user: 'Yara Khaled', role: 'manager', action: 'created discount', resource: 'FALL25 (25% off, min 2000 EGP)', timestamp: '2026-08-28T11:30:00Z', ip: '197.55.xx.xx' },
  { id: 'log-8', user: 'Omar Sabry', role: 'admin', action: 'refunded order', resource: 'NV-100031 (1850 EGP)', timestamp: '2026-08-27T09:12:00Z', ip: '156.202.xx.xx' },
];

export const notifications = [
  { id: 'n-1', type: 'order', title: 'New order NV-100041 received', time: '2026-09-02T07:40:00Z', unread: true, link: 'order-detail.html?id=NV-100041' },
  { id: 'n-2', type: 'stock', title: 'Signature Hoodie — L is low on stock (3 left)', time: '2026-09-02T06:15:00Z', unread: true, link: 'inventory.html' },
  { id: 'n-3', type: 'stock', title: 'Straight Leg Denim — 36 is out of stock', time: '2026-09-01T21:00:00Z', unread: true, link: 'inventory.html' },
  { id: 'n-4', type: 'payment', title: 'Payment issue on order NV-100038', time: '2026-09-01T15:22:00Z', unread: false, link: 'order-detail.html?id=NV-100038' },
  { id: 'n-5', type: 'return', title: 'Return request submitted for NV-100029', time: '2026-08-31T12:00:00Z', unread: false, link: 'orders.html?status=returned' },
  { id: 'n-6', type: 'security', title: 'New device login for Omar Sabry', time: '2026-08-30T09:05:00Z', unread: false, link: 'security.html' },
];
