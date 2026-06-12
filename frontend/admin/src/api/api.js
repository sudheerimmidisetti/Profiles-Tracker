import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE, timeout: 15000 })

const getSecret = () => localStorage.getItem('adminSecret') || ''

api.interceptors.request.use(config => {
  const secret = getSecret()
  if (secret) config.headers['X-Admin-Secret'] = secret
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('adminSecret')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Admin API ─────────────────────────────────────────────────────────────────
export const adminAPI = {
  overview:       ()                           => api.get('/api/admin/overview'),
  listStudents:   (params)                     => api.get('/api/admin/students', { params }),
  getStudent:     (email)                      => api.get(`/api/admin/students/${encodeURIComponent(email)}`),
  block:          (email)                      => api.put(`/api/admin/blocklist/${encodeURIComponent(email)}`),
  unblock:        (email)                      => api.put(`/api/admin/unblocklist/${encodeURIComponent(email)}`),
  triggerSync:    ()                           => api.post('/api/admin/sync'),
  updateHandle:   (email, platform, username)  => api.put(`/api/admin/students/${encodeURIComponent(email)}/handle`, { platform, username }),
  syncStudent:    (email)                      => api.post(`/api/admin/students/${encodeURIComponent(email)}/sync`),
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
export const leaderboardAPI = {
  get:        (platform, filter = 'all', page = 1, limit = 50) =>
                api.get(`/api/leaderboard/${platform}`, { params: { filter, page, limit } }),
  placements: (page = 1, limit = 50) =>
                api.get('/api/leaderboard/placements', { params: { page, limit } }),
  weekly:     (page = 1, limit = 50) =>
                api.get('/api/leaderboard/weekly',     { params: { page, limit } }),
  monthly:    (page = 1, limit = 50) =>
                api.get('/api/leaderboard/monthly',    { params: { page, limit } }),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  snapshots: (email) => api.get(`/api/analytics/snapshot/${encodeURIComponent(email)}`),
  summary:   (email) => api.get(`/api/analytics/summary/${encodeURIComponent(email)}`),
}

export const setAdminSecret  = (s) => localStorage.setItem('adminSecret', s)
export const clearAdminSecret = () => localStorage.removeItem('adminSecret')
export const isAdminLoggedIn  = ()  => !!localStorage.getItem('adminSecret')

export default api
