// api.js — Admin API client using JWT Bearer tokens
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE, timeout: 30000 })

// ── Token helpers ────────────────────────────────────────────────────────────
export const setAdminToken    = (t) => localStorage.setItem('adminToken', t)
export const clearAdminToken  = ()  => localStorage.removeItem('adminToken')
export const isAdminLoggedIn  = ()  => {
  const t = localStorage.getItem('adminToken')
  if (!t) return false
  try {
    const { exp } = JSON.parse(atob(t.split('.')[1]))
    return !exp || Date.now() / 1000 < exp
  } catch { return false }
}

// ── Admin JWT-aware response interceptor ─────────────────────────────────────
// Only logs out when the admin JWT is provably invalid / expired.
// Never redirects on platform-level 401s (e.g., contest service errors).
let _redirecting = false   // guard: prevent multiple concurrent redirects

function forceLogout() {
  if (_redirecting) return
  _redirecting = true
  clearAdminToken()
  // Prefer React state-based logout (AdminAuthContext registers window.__adminForceLogout)
  // This avoids a full hard-reload and lets React Router handle the /login redirect.
  if (typeof window.__adminForceLogout === 'function') {
    window.__adminForceLogout()
    // Reset _redirecting after a tick so subsequent calls can flow normally
    setTimeout(() => { _redirecting = false }, 2000)
  } else {
    window.location.href = '/login'
  }
}

// ── Request interceptor — attach admin Bearer token ─────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken') || ''
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status
    if (status === 401 || status === 403) {
      const msg = err.response?.data?.message || ''
      // Only force logout if:
      // 1. The admin token is missing/expired (checked client-side)
      // 2. OR the backend explicitly says the token is invalid/expired
      const tokenInvalid = !isAdminLoggedIn()
      const backendSaysInvalid =
        msg.includes('Session expired') ||
        msg.includes('Invalid token') ||
        msg.includes('Invalid or expired') ||
        msg.includes('No token') ||
        msg.includes('Admin access revoked')

      if (tokenInvalid || backendSaysInvalid) {
        forceLogout()
      }
      // Otherwise (e.g., 403 from contest service, platform error) — do NOT logout
    }
    return Promise.reject(err)
  }
)

// ── Admin API ─────────────────────────────────────────────────────────────────
export const adminAPI = {
  overview:              ()                           => api.get('/api/admin/overview'),
  listStudents:          (params)                     => api.get('/api/admin/students', { params }),
  getStudent:            (email)                      => api.get(`/api/admin/students/${encodeURIComponent(email)}`),
  getPlatform:           (email, platform)            => api.get(`/api/admin/students/${encodeURIComponent(email)}/platform/${platform}`),
  block:                 (email)                      => api.put(`/api/admin/blocklist/${encodeURIComponent(email)}`),
  unblock:               (email)                      => api.put(`/api/admin/unblocklist/${encodeURIComponent(email)}`),
  triggerSync:           ()                           => api.post('/api/admin/sync'),
  syncStatus:            ()                           => api.get('/api/admin/sync-status'),
  getFilters:            ()                           => api.get('/api/admin/filters'),
  updateHandle:          (email, platform, username)  => api.put(`/api/admin/students/${encodeURIComponent(email)}/handle`, { platform, username }),
  syncStudent:           (email)                      => api.post(`/api/admin/students/${encodeURIComponent(email)}/sync`),
  // Admin user management
  listAdmins:            ()                           => api.get('/api/admin/auth/admins'),
  addAdmin:              (email)                      => api.post('/api/admin/auth/add-admin', { email }),
  removeAdmin:           (email)                      => api.delete('/api/admin/auth/remove-admin', { data: { email } }),
  // Handle Update Requests
  listHandleRequests:    (params)                     => api.get('/api/admin/handle-requests', { params }),
  approveHandleRequest:  (id)                         => api.put(`/api/admin/handle-requests/${id}/approve`),
  rejectHandleRequest:   (id, reason)                 => api.put(`/api/admin/handle-requests/${id}/reject`, { reason }),
  // Settings
  getSettings:           ()                           => api.get('/api/admin/settings'),
  updateCronSchedule:    (schedule)                   => api.put('/api/admin/settings/cron', { schedule }),
  // Contests
  getContestDetail:      (email, platform, contestId) => api.get(`/api/admin/students/${encodeURIComponent(email)}/contest/detail`, { params: { platform, contestId } }),
}


// ── Leaderboard ───────────────────────────────────────────────────────────────
export const leaderboardAPI = {
  getFilters: ()                                                                 =>
                api.get('/api/admin/filters'),
  get:        (platform, filter = 'all', page = 1, limit = 50, search = '', branch = '', college = '', year = '') =>
                api.get(`/api/leaderboard/${platform}`, { params: { filter, page, limit, search, branch, college, year } }),
  placements: (page = 1, limit = 50, college = '', year = '') =>
                api.get('/api/leaderboard/placements', { params: { page, limit, college, year } }),
  overall:    (page = 1, limit = 50, college = '', year = '', search = '') =>
                api.get('/api/leaderboard/overall', { params: { page, limit, college, year, search } }),
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

// ── Contests (admin-auth) ─────────────────────────────────────────────────────
export const contestsAPI = {
  list:         (platform = 'all', week = 0) => api.get('/api/contests/admin', { params: { platform, week } }),
  participants: (platform, contestId)        => api.get(`/api/contests/admin/${platform}/${encodeURIComponent(contestId)}/participants`),
}

// Legacy compatibility (for any code still using setAdminSecret)
export const setAdminSecret   = setAdminToken
export const clearAdminSecret = clearAdminToken

export default api
