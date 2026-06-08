import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authAPI, setTokens, clearTokens, getTokens } from '../api/api'
import { profileAPI } from '../api/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch profile on mount if token exists
  useEffect(() => {
    const { accessToken } = getTokens()
    if (!accessToken) { setLoading(false); return }

    profileAPI.getMe()
      .then(r => setUser(r.data.data))
      .catch(() => clearTokens())
      .finally(() => setLoading(false))
  }, [])

  // Step 1: send OTP
  const sendOTP = useCallback(async (email) => {
    const res = await authAPI.register(email)
    return res.data
  }, [])

  // Step 2: verify OTP → store tokens → load profile
  const verifyOTP = useCallback(async (email, otp) => {
    const res  = await authAPI.verifyOTP(email, otp)
    const data = res.data
    setTokens({
      accessToken:  data.accessToken,
      refreshToken: data.refreshToken,
      sessionId:    data.sessionId,
      email
    })
    // Fetch profile
    const profile = await profileAPI.getMe()
    setUser(profile.data.data)
    return data
  }, [])

  const logout = useCallback(async () => {
    const { sessionId } = getTokens()
    try { await authAPI.logout(sessionId) } catch (_) {}
    clearTokens()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await profileAPI.getMe()
    setUser(res.data.data)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, sendOTP, verifyOTP, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
