import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

const api = axios.create({ baseURL: BASE, timeout: 12000 })

// ── Auth helpers ──────────────────────────────────────
export const getTokens = () => ({
  accessToken:  localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  sessionId:    localStorage.getItem('sessionId'),
  email:        localStorage.getItem('email'),
})

export const setTokens = ({ accessToken, refreshToken, sessionId, email }) => {
  if (accessToken)  localStorage.setItem('accessToken',  accessToken)
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
  if (sessionId)    localStorage.setItem('sessionId',    sessionId)
  if (email)        localStorage.setItem('email',        email)
}

export const clearTokens = () => {
  ['accessToken','refreshToken','sessionId','email'].forEach(k => localStorage.removeItem(k))
}

// ── Request interceptor ───────────────────────────────
api.interceptors.request.use(config => {
  const { accessToken } = getTokens()
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// ── Response interceptor — auto-refresh ───────────────
let refreshing = false
let queue = []

api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true

      if (refreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then(token => { orig.headers.Authorization = `Bearer ${token}`; return api(orig) })
      }

      refreshing = true
      try {
        const { sessionId, refreshToken } = getTokens()
        const { data } = await axios.post(`${BASE}/api/auth/refresh`, { sessionId, refreshToken })
        setTokens({ accessToken: data.accessToken })
        queue.forEach(p => p.resolve(data.accessToken))
        queue = []
        orig.headers.Authorization = `Bearer ${data.accessToken}`
        return api(orig)
      } catch (e) {
        queue.forEach(p => p.reject(e))
        queue = []
        clearTokens()
        window.location.href = '/login'
        return Promise.reject(e)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────
export const authAPI = {
  register:    (email)                      => api.post('/api/auth/register', { email }),
  verifyOTP:   (email, otp)                 => api.post('/api/auth/verify-otp', { email, otp }),
  refresh:     (sessionId, refreshToken)    => api.post('/api/auth/refresh', { sessionId, refreshToken }),
  logout:      (sessionId)                  => api.post('/api/auth/logout', { sessionId }),
}

// ── Profile ───────────────────────────────────────────
export const profileAPI = {
  getMe:   ()      => api.get('/api/profile/me'),
  update:  (data)  => api.put('/api/profile/settings', data),
}

// ── Handlers ─────────────────────────────────────────
export const handlersAPI = {
  submit:         (handles)  => api.post('/api/handlers/submit', handles),
  verifyStatus:   ()         => api.get('/api/handlers/verify-status'),
  requestStatus:  ()         => api.get('/api/handlers/request-status'), // for verified students
  confirm:        ()         => api.post('/api/handlers/confirm'),
}


// ── Leaderboard ───────────────────────────────────────
export const leaderboardAPI = {
  // Dynamic filter options
  getFilters: () => api.get('/api/admin/filters'),
  // Original platform leaderboard
  get: (platform, filter = 'all', page = 1, limit = 50, search = '', branch = '', college = '', year = '') =>
    api.get(`/api/leaderboard/${platform}`, { params: { filter, page, limit, search, branch, college, year } }),
  // Placements (6-month rolling)
  placements: (page = 1, limit = 50, college = '', year = '') =>
    api.get('/api/leaderboard/placements', { params: { page, limit, college, year } }),
  // Overall (all-time, same metrics as placements)
  overall: (page = 1, limit = 50, college = '', year = '', search = '') =>
    api.get('/api/leaderboard/overall', { params: { page, limit, college, year, search } }),
  // Weekly (current week or specific week)
  weekly: (week = null, page = 1, limit = 50, college = '', year = '') =>
    api.get('/api/leaderboard/weekly', { params: { week, page, limit, college, year } }),
  // Monthly (current month or specific YYYY-MM)
  monthly: (month = null, page = 1, limit = 50, college = '', year = '') =>
    api.get('/api/leaderboard/monthly', { params: { month, page, limit, college, year } }),
}



// ── Analytics ─────────────────────────────────────────
export const analyticsAPI = {
  snapshots:      (email)    => api.get(`/api/analytics/snapshot/${encodeURIComponent(email)}`),
  summary:        (email)    => api.get(`/api/analytics/summary/${encodeURIComponent(email)}`),
  platformDetail: (platform) =>
    api.get(`/api/analytics/detail/${platform}`, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
    }),
  heatmap: () => api.get('/api/analytics/heatmap'),  // combined cross-platform heatmap
}


export default api
