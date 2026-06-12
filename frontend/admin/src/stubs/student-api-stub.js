// stubs/student-api-stub.js
// Replaces student/src/api/api.js when student components run in admin context.
// Uses a plain axios with NO auth interceptors — a 401 from /api/contest/detail
// (which requires student auth) will simply be caught as an error by the component,
// NOT redirected to /login like the real student api.js does.
import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || ''

// Plain instance — no request/response interceptors at all.
// ContestDetailPanel will catch the 401 error and display "Failed to load"
// instead of logging the admin out.
const api = axios.create({ baseURL: BASE, timeout: 15000 })

// ── Stubs for named exports (not used in admin but must not crash) ────────────
export const getTokens   = () => ({})
export const setTokens   = () => {}
export const clearTokens = () => {}
export const authAPI     = {}
export const profileAPI  = {}
export const handlersAPI = {}
export const leaderboardAPI = {}
export const analyticsAPI   = {}

export default api
