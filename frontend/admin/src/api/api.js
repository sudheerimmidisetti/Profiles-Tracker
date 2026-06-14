// api.js — Admin API client using JWT Bearer tokens
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE, timeout: 30000 })

const getToken  = () => localStorage.getItem('adminToken') || ''

api.interceptors.request.use(config => {
  const token = getToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      // Token expired / revoked — clear and redirect to login
      clearAdminToken()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ── Admin API ─────────────────────────────────────────────────────────────────
export const adminAPI = {
  overview:         ()                           => api.get('/api/admin/overview'),
  listStudents:     (params)                     => api.get('/api/admin/students', { params }),
  getStudent:       (email)                      => api.get(`/api/admin/students/${encodeURIComponent(email)}`),
  getPlatform:      (email, platform)            => api.get(`/api/admin/students/${encodeURIComponent(email)}/platform/${platform}`),
  block:            (email)                      => api.put(`/api/admin/blocklist/${encodeURIComponent(email)}`),
  unblock:          (email)                      => api.put(`/api/admin/unblocklist/${encodeURIComponent(email)}`),
  triggerSync:      ()                           => api.post('/api/admin/sync'),
  syncStatus:       ()                           => api.get('/api/admin/sync-status'),
  getFilters:       ()                           => api.get('/api/admin/filters'),
  updateHandle:     (email, platform, username)  => api.put(`/api/admin/students/${encodeURIComponent(email)}/handle`, { platform, username }),
  syncStudent:      (email)                      => api.post(`/api/admin/students/${encodeURIComponent(email)}/sync`),
  // Admin user management
  listAdmins:       ()                           => api.get('/api/admin/auth/admins'),
  addAdmin:         (email)                      => api.post('/api/admin/auth/add-admin', { email }),
  removeAdmin:      (email)                      => api.delete('/api/admin/auth/remove-admin', { data: { email } }),
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export const leaderboardAPI = {
  getFilters: ()                                                                 =>
                api.get('/api/admin/filters'),
  get:        (platform, filter = 'all', page = 1, limit = 50, search = '', branch = '', college = '', year = '') =>
                api.get(`/api/leaderboard/${platform}`, { params: { filter, page, limit, search, branch, college, year } }),
  placements: (page = 1, limit = 50, college = '', year = '') =>
                api.get('/api/leaderboard/placements', { params: { page, limit, college, year } }),
  weekly:     (week = null, page = 1, limit = 50, college = '', year = '') =>
                api.get('/api/leaderboard/weekly', { params: { week, page, limit, college, year } }),
  monthly:    (month = null, page = 1, limit = 50, college = '', year = '') =>
                api.get('/api/leaderboard/monthly', { params: { month, page, limit, college, year } }),
}


// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  snapshots: (email) => api.get(`/api/analytics/snapshot/${encodeURIComponent(email)}`),
  summary:   (email) => api.get(`/api/analytics/summary/${encodeURIComponent(email)}`),
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
export const setAdminToken    = (t) => localStorage.setItem('adminToken', t)
export const clearAdminToken  = ()  => localStorage.removeItem('adminToken')
export const isAdminLoggedIn  = ()  => !!localStorage.getItem('adminToken')

// Legacy compatibility (for any code still using setAdminSecret)
export const setAdminSecret   = setAdminToken
export const clearAdminSecret = clearAdminToken

export default api
