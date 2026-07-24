// Self-hosted replacement for the Base44 SDK client.
// Implements the same shape (`db.auth.*`, `db.entities.*`, `db.integrations.Core.UploadFile`)
// that the rest of the app already expects, so page components didn't need to change.

const TOKEN_KEY = 'access_token';

// Same-origin by default (the backend serves the built frontend). Set
// VITE_API_URL if the API is hosted on a different origin.
const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, { method = 'GET', body, headers } = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }

  if (!res.ok) {
    const error = new Error((data && data.message) || res.statusText);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

function makeEntity(name) {
  return {
    async list(sort = '-created_date', limit) {
      const params = new URLSearchParams();
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      return request(`/api/entities/${name}?${params.toString()}`);
    },
    async filter(query = {}, sort = '-created_date', limit) {
      const params = new URLSearchParams();
      params.set('filter', JSON.stringify(query));
      if (sort) params.set('sort', sort);
      if (limit) params.set('limit', String(limit));
      return request(`/api/entities/${name}?${params.toString()}`);
    },
    async get(id) {
      const rows = await request(`/api/entities/${name}?${new URLSearchParams({ filter: JSON.stringify({ id }) })}`);
      return rows[0] || null;
    },
    async create(data) {
      return request(`/api/entities/${name}`, { method: 'POST', body: data });
    },
    async update(id, data) {
      return request(`/api/entities/${name}/${id}`, { method: 'PATCH', body: data });
    },
    async delete(id) {
      return request(`/api/entities/${name}/${id}`, { method: 'DELETE' });
    },
  };
}

// The User entity has different admin-only endpoints (listing all users,
// changing role/ban status) rather than the generic filter/create flow.
const UserEntity = {
  async list() {
    return request('/api/entities/User/list-all');
  },
  async update(id, data) {
    return request(`/api/entities/User/${id}`, { method: 'PATCH', body: data });
  },
};

export const db = {
  auth: {
    async isAuthenticated() {
      if (!getToken()) return false;
      try {
        await request('/api/auth/me');
        return true;
      } catch {
        return false;
      }
    },
    async me() {
      return request('/api/auth/me');
    },
    async updateMe(data) {
      return request('/api/auth/me', { method: 'PATCH', body: data });
    },
    async loginViaEmailPassword(email, password) {
      const result = await request('/api/auth/login', { method: 'POST', body: { email, password } });
      if (result?.access_token) setToken(result.access_token);
      return result;
    },
    // Step 1 of registration: just an email, triggers a verification code.
    async registerRequest(email, turnstileToken) {
      return request('/api/auth/register-request', { method: 'POST', body: { email, turnstileToken } });
    },
    async registerResend(email) {
      return request('/api/auth/register-resend', { method: 'POST', body: { email } });
    },
    // Step 2: code + chosen password together finishes the registration.
    async registerComplete({ email, otpCode, password }) {
      const result = await request('/api/auth/register-complete', {
        method: 'POST',
        body: { email, otpCode, password },
      });
      if (result?.access_token) setToken(result.access_token);
      return result;
    },
    async resetPasswordRequest(email) {
      return request('/api/auth/reset-password-request', { method: 'POST', body: { email } });
    },
    async resetPassword({ resetToken, newPassword }) {
      return request('/api/auth/reset-password', { method: 'POST', body: { resetToken, newPassword } });
    },
    // Admin-only: pending verification codes, for manually relaying one
    // when email delivery isn't set up (or gets blocked by the provider).
    async pendingCodes() {
      return request('/api/auth/pending-codes');
    },
    setToken(token) {
      setToken(token);
    },
    logout(redirectUrl) {
      setToken(null);
      if (redirectUrl) window.location.href = '/login';
    },
    redirectToLogin() {
      window.location.href = '/login';
    },
  },
  entities: {
    Roll: makeEntity('Roll'),
    ArenaMatch: makeEntity('ArenaMatch'),
    User: UserEntity,
  },
  integrations: {
    Core: {
      async UploadFile({ file }) {
        const token = getToken();
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`${API_BASE}/api/uploads`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        return res.json();
      },
    },
  },
};

export default db;
