// AdminLoginPage.jsx — Email + OTP two-step login
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import { Mail, Lock, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const { loginWithOtp } = useAdminAuth()
  const navigate         = useNavigate()

  const [step,    setStep]    = useState('email')   // 'email' | 'otp'
  const [email,   setEmail]   = useState('')
  const [otp,     setOtp]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')

  const BASE = import.meta.env.VITE_API_URL || ''

  async function handleRequestOtp(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Enter your admin email address'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch(`${BASE}/api/admin/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Request failed')
      setSuccess(data.message || 'OTP sent! Check your email.')
      setStep('otp')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault()
    if (!otp.trim()) { setError('Enter the OTP from your email'); return }
    setLoading(true); setError('')
    try {
      await loginWithOtp(email.trim(), otp.trim())
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-head">
          <div className="auth-logo-row">
            <div className="auth-logo-icon" style={{ background: 'var(--danger)' }}>
              <Lock size={20} style={{ color: 'white' }} />
            </div>
            <span className="auth-logo-name">CPTrack Admin</span>
          </div>
          <h1 className="auth-title">
            {step === 'email' ? 'Admin Access' : 'Verify Email'}
          </h1>
          <p className="auth-subtitle">
            {step === 'email'
              ? 'Enter your admin email to receive a login code'
              : `We sent a 6-digit code to ${email}`
            }
          </p>
        </div>

        {/* Messages */}
        {error && (
          <div className="msg msg-error">
            <AlertCircle size={14} />{error}
          </div>
        )}
        {success && step === 'otp' && (
          <div className="msg msg-success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={14} />{success}
          </div>
        )}

        {/* Step 1: Email */}
        {step === 'email' && (
          <form className="auth-form" onSubmit={handleRequestOtp}>
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              style={{ background: 'var(--danger)', color: 'white' }}
            >
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending…</>
                : 'Send Login Code →'
              }
            </button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 'otp' && (
          <form className="auth-form" onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label className="form-label">6-Digit Code</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="form-input"
                  style={{ paddingLeft: 36, letterSpacing: '0.2em', fontSize: '1.2rem', textAlign: 'center' }}
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              </div>
            </div>
            <button
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              style={{ background: 'var(--danger)', color: 'white' }}
            >
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Verifying…</>
                : 'Verify & Sign In →'
              }
            </button>

            <button
              type="button"
              className="btn btn-ghost btn-full"
              style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--fg-muted)' }}
              onClick={() => { setStep('email'); setError(''); setOtp('') }}
            >
              <ArrowLeft size={13} /> Change email or resend code
            </button>
          </form>
        )}

        <p style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', textAlign: 'center', marginTop: 8 }}>
          Only registered admin emails can log in.
        </p>
      </div>
    </div>
  )
}
