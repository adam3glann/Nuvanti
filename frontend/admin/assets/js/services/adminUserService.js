const API = window.NUVANTI_API_URL || `${location.protocol}//${location.hostname}:4000`;
async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  if (response.status === 204) return true;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Unable to update administrator accounts.');
  return body;
}

export const fetchAdminUsers = () => request('/api/admin/admin-users');

// name/email/role only — the backend creates the account with an unusable
// random password and emails a setup link. Never send a password from here.
export const createAdminUser = (data) => request('/api/admin/admin-users', { method: 'POST', body: JSON.stringify({ name: data.name, email: data.email, role: data.role }) });

export const toggleAdminUserStatus = async (id) => {
  const user = (await fetchAdminUsers()).find((u) => u.id === String(id));
  return request(`/api/admin/admin-users/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !user?.isActive }) });
};

export const deleteAdminUser = (id) => request(`/api/admin/admin-users/${id}`, { method: 'DELETE' });
