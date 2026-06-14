// AdminAuthContext.jsx — JWT Bearer token-based auth
import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { clearAdminToken, isAdminLoggedIn, setAdminToken } from '../api/api'

const AdminAuthCtx = createContext(null)

export function AdminAuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn)

  // Re-check token validity every 60 s — handles silent expiry without a 401
  useEffect(() => {
    const id = setInterval(() => {
      if (!isAdminLoggedIn()) setLoggedIn(false)
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Expose a way for the interceptor to trigger logout via state (not page reload)
  const handleForceLogout = useCallback(() => {
    clearAdminToken()
    setLoggedIn(false)
  }, [])

  // Make handleForceLogout available globally so the axios interceptor can call it
  useEffect(() => {
    window.__adminForceLogout = handleForceLogout
    return () => { delete window.__adminForceLogout }
  }, [handleForceLogout])

  const loginWithOtp = async (email, otp) => {
    const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/admin/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    })
    const data = await res.json()
    if (!res.ok || !data.token) {
      throw new Error(data.message || 'Verification failed')
    }
    setAdminToken(data.token)
    setLoggedIn(true)
    return data
  }

  const logout = () => {
    clearAdminToken()
    setLoggedIn(false)
  }

  return (
    <AdminAuthCtx.Provider value={{ loggedIn, loginWithOtp, logout }}>
      {children}
    </AdminAuthCtx.Provider>
  )
}

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthCtx)
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider')
  return ctx
}
