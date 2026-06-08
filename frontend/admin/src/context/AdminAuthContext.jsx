import { createContext, useContext, useState } from 'react'
import { setAdminSecret, clearAdminSecret, isAdminLoggedIn } from '../api/api'
import api from '../api/api'

const AdminAuthCtx = createContext(null)

export function AdminAuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(isAdminLoggedIn())

  const login = async (secret) => {
    setAdminSecret(secret)
    // Test with a quick API call
    try {
      await api.get('/api/admin/students', { params: { limit: 1 }, headers: { 'X-Admin-Secret': secret } })
      setLoggedIn(true)
    } catch (err) {
      clearAdminSecret()
      throw err
    }
  }

  const logout = () => {
    clearAdminSecret()
    setLoggedIn(false)
  }

  return (
    <AdminAuthCtx.Provider value={{ loggedIn, login, logout }}>
      {children}
    </AdminAuthCtx.Provider>
  )
}

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthCtx)
  if (!ctx) throw new Error('useAdminAuth must be inside AdminAuthProvider')
  return ctx
}
