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
  updateHandle:     (email, platform, username)  => api.put(`/api/admin/students/${encodeURIComponent(email)}/handle`, { platform, username }),
  syncStudent:      (email)                      => api.post(`/api/admin/students/${encodeURIComponent(email)}/sync`),
  // Admin user management
  listAdmins:       ()                           => api.get('/api/admin/auth/admins'),
  addAdmin:         (email)                      => api.post('/api/admin/auth/add-admin', { email }),
  removeAdmin:      (email)                      => api.delete('/api/admin/auth/remove-admin', { data: { email } }),
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export const leaderboardAPI = {
  get:        (platform, filter = 'all', page = 1, limit = 50, search = '', branch = '') =>
                api.get(`/api/leaderboard/${platform}`, { params: { filter, page, limit, search, branch } }),
  placements: (page = 1, limit = 50) =>
                api.get('/api/leaderboard/placements', { params: { page, limit } }),
  weekly:     (page = 1, limit = 50) => {
                // Compute current week's Monday in IST (UTC+5:30) explicitly
                // so admin and student views always agree on the same week boundary
                const now = new Date()
                const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
                const day = ist.getUTCDay()
                const mon = new Date(ist.getTime() - (day === 0 ? 6 : day - 1) * 86400000)
                mon.setUTCHours(0, 0, 0, 0)
                const week = mon.toISOString().slice(0, 10)
                return api.get('/api/leaderboard/weekly', { params: { week, page, limit } })
              },
  monthly:    (page = 1, limit = 50) =>
                api.get('/api/leaderboard/monthly',    { params: { page, limit } }),
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
