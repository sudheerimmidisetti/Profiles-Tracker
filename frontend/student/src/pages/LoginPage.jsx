import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Code2, Mail, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { sendOTP, verifyOTP } = useAuth()
  const navigate = useNavigate()

  const [step,    setStep]    = useState('email')   // 'email' | 'otp'
  const [email,   setEmail]   = useState('')
  const [otp,     setOtp]     = useState(['','','','','',''])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [timer,   setTimer]   = useState(0)
  const otpRefs = useRef([])

  // ── Step 1: send OTP ──────────────────────────────
  const handleSendOTP = async (e) => {
    e.preventDefault()
    setError(''); setSuccess('')
    if (!email.trim()) { setError('Enter your college email'); return }

    setLoading(true)
    try {
      await sendOTP(email.trim().toLowerCase())
      setStep('otp')
      setSuccess('OTP sent to your email. Valid for 2 minutes.')
      startTimer()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send OTP. Check your email.')
    } finally {
      setLoading(false)
    }
  }

  const startTimer = () => {
    setTimer(120)
    const interval = setInterval(() => {
      setTimer(t => { if (t <= 1) { clearInterval(interval); return 0 } return t - 1 })
    }, 1000)
  }

  // ── Step 2: verify OTP ────────────────────────────
  const handleVerify = async (e) => {
    e.preventDefault()
    const code = otp.join('')
    if (code.length < 6) { setError('Enter the 6-digit OTP'); return }

    setLoading(true); setError('')
    try {
      await verifyOTP(email, code)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired OTP')
    } finally {
      setLoading(false)
    }
  }

  // OTP input
  const handleOtpChange = (i, val) => {
    const d = val.replace(/\D/g, '').slice(0, 1)
    const next = [...otp]
    next[i] = d
    setOtp(next)
    if (d && i < 5) otpRefs.current[i + 1]?.focus()
  }

  const handleOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) {
      otpRefs.current[i - 1]?.focus()
    }
  }

  const handleOtpPaste = (e) => {
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (paste.length === 6) {
      setOtp(paste.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-head">
          <div className="auth-logo-row">
            <div className="auth-logo-icon"><Code2 size={22} /></div>
            <span className="auth-logo-name">CPTrack</span>
          </div>
          <h1 className="auth-title">
            {step === 'email' ? 'Welcome back' : 'Check your email'}
          </h1>
          <p className="auth-subtitle">
            {step === 'email'
              ? 'Sign in with your college email to continue'
              : `We sent a 6-digit OTP to ${email}`}
          </p>
        </div>

        {/* Messages */}
        {error   && <div className="msg msg-error"><AlertCircle size={14} />{error}</div>}
        {success && <div className="msg msg-success"><CheckCircle2 size={14} />{success}</div>}

        {step === 'email' ? (
          <form className="auth-form" onSubmit={handleSendOTP}>
            <div className="form-group">
              <label className="form-label">College Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="yourroll@acet.ac.in"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Sending…</> : <><ArrowRight size={16} /> Send OTP</>}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleVerify}>
            <div className="form-group">
              <label className="form-label">6-Digit OTP</label>
              <div className="otp-row" onPaste={handleOtpPaste}>
                {otp.map((d, i) => (
                  <input
                    key={i}
                    ref={el => otpRefs.current[i] = el}
                    className="otp-digit"
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    onKeyDown={e => handleOtpKey(i, e)}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
            </div>

            <button className="btn btn-primary btn-full btn-lg" disabled={loading}>
              {loading
                ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Verifying…</>
                : <><CheckCircle2 size={16} /> Verify & Sign In</>}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('email'); setError(''); setSuccess(''); setOtp(['','','','','','']) }}>
                ← Change email
              </button>
              {timer > 0
                ? <span style={{ color: 'var(--fg-muted)' }}>Resend in {timer}s</span>
                : <button type="button" className="btn btn-ghost btn-sm" onClick={handleSendOTP}>
                    <RefreshCw size={13} /> Resend OTP
                  </button>}
            </div>
          </form>
        )}

        <p style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', textAlign: 'center' }}>
          Only @acet.ac.in, @aec.edu.in and @adityauniversity.in emails are allowed
        </p>
      </div>
    </div>
  )
}
