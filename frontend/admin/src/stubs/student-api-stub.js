// stubs/student-api-stub.js
// Replaces student/src/api/api.js when student components run in admin context.
//
// KEY PURPOSE: ContestDetailPanel does `api.get('/api/contest/detail', {...})`.
// In admin:
//   - The student api.js interceptor would catch 401s and call window.location='/login'
//   - /api/contest/detail requires student JWT + Redis session (admin JWT doesn't work)
//
// This stub intercepts that call and redirects it to:
//   GET /api/admin/students/:email/contest/detail?platform=...&contestId=...
// which is protected by adminAuth (admin JWT works fine).
//
// All other calls go through a plain axios (no logout-on-401 interceptor).

import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''
const getAdminToken = () => localStorage.getItem('adminToken') || ''

// Plain axios instance — no interceptors that could log admin out
const plainAxios = axios.create({ baseURL: BASE, timeout: 30000 })

// Attach admin token to every request
plainAxios.interceptors.request.use(config => {
  const token = getAdminToken()
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

// ── Proxy object that mimics the student api default export ──────────────────
// ContestDetailPanel calls: api.get('/api/contest/detail', { params: { platform, contestId, email } })
const adminApiProxy = {
  get(url, config = {}) {
    // Intercept the contest detail call and redirect to admin route
    if (url === '/api/contest/detail') {
      const { platform, contestId, email } = config.params || {}
      if (email && platform && contestId) {
        const adminUrl = `/api/admin/students/${encodeURIComponent(email)}/contest/detail`
        return plainAxios.get(adminUrl, { params: { platform, contestId } })
      }
    }
    // All other GET calls — pass through with admin auth
    return plainAxios.get(url, config)
  },
  post(url, data, config) {
    return plainAxios.post(url, data, config)
  },
  put(url, data, config) {
    return plainAxios.put(url, data, config)
  },
  delete(url, config) {
    return plainAxios.delete(url, config)
  },
}

// ── Named exports (not used in admin but must not crash on import) ────────────
export const getTokens      = () => ({})
export const setTokens      = () => {}
export const clearTokens    = () => {}
export const authAPI        = {}
export const profileAPI     = {}
export const handlersAPI    = {}
export const leaderboardAPI = {}
export const analyticsAPI   = {}

export default adminApiProxy
