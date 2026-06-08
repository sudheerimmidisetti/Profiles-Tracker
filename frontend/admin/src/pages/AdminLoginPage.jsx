import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import { Database, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const { login }  = useAdminAuth()
  const navigate   = useNavigate()
  const [secret,   setSecret]  = useState('')
  const [show,     setShow]    = useState(false)
  const [loading,  setLoading] = useState(false)
  const [error,    setError]   = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!secret.trim()) { setError('Enter the admin secret'); return }

    setLoading(true); setError('')
    try {
      await login(secret.trim())
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid admin secret')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-head">
          <div className="auth-logo-row">
            <div className="auth-logo-icon" style={{ background: 'var(--danger)' }}>
              <Database size={22} style={{ color: 'white' }} />
            </div>
            <span className="auth-logo-name">CPTrack Admin</span>
          </div>
          <h1 className="auth-title">Admin Access</h1>
          <p className="auth-subtitle">Enter the admin secret to access the dashboard</p>
        </div>

        {error && (
          <div className="msg msg-error">
            <AlertCircle size={14} />{error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Admin Secret</label>
            <div style={{ position: 'relative' }}>
              <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
              <input
                type={show ? 'text' : 'password'}
                className="form-input"
                style={{ paddingLeft: 36, paddingRight: 40 }}
                placeholder="Enter admin secret"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer' }}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <button className="btn btn-primary btn-full btn-lg" disabled={loading} style={{ background: 'var(--danger)', color: 'white' }}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Authenticating…</> : 'Access Dashboard →'}
          </button>
        </form>

        <p style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', textAlign: 'center' }}>
          Set ADMIN_SECRET in your backend .env file
        </p>
      </div>
    </div>
  )
}
