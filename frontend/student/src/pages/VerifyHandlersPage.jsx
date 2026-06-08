import { useState, useEffect } from 'react'
import { handlersAPI } from '../api/api'
import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'
import { Copy, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, ExternalLink } from 'lucide-react'

const PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank']

const PLATFORM_LABELS = {
  leetcode:   'LeetCode',
  codeforces: 'Codeforces',
  codechef:   'CodeChef',
  hackerrank: 'HackerRank'
}

// Exact field to change per platform
const PLATFORM_FIELD = {
  leetcode:   'Name field',
  codeforces: 'First name field',
  codechef:   'First name field',
  hackerrank: 'Name field',
}

const PLATFORM_EDIT_URL = {
  leetcode:   'https://leetcode.com/profile/',
  codeforces: 'https://codeforces.com/settings/general',
  codechef:   'https://www.codechef.com/settings/edit',
  hackerrank: 'https://www.hackerrank.com/profile',
}

export default function VerifyHandlersPage() {
  const { user, refreshUser } = useAuth()

  // Step: 'form' | 'verify' | 'done'
  const [step,       setStep]       = useState(user?.is_verified ? 'done' : 'form')
  const [handles,    setHandles]    = useState({ leetcode: '', codeforces: '', codechef: '', hackerrank: '' })
  const [code,       setCode]       = useState('')
  const [status,     setStatus]     = useState({})   // results from API
  const [failed,     setFailed]     = useState({})   // failed platforms with hints
  const [loading,    setLoading]    = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [msg,        setMsg]        = useState({ type: '', text: '' })
  const [copied,     setCopied]     = useState(false)

  // Load existing verify status if already submitted
  useEffect(() => {
    if (user?.is_verified) { setStep('done'); return }
    handlersAPI.verifyStatus()
      .then(r => {
        const d = r.data.data || r.data
        if (d?.code) {
          setCode(d.code)
          if (d.handles) {
            setHandles(h => ({ ...h, ...Object.fromEntries(
              Object.entries(d.handles).filter(([, v]) => v)
            ) }))
          }
          setStep('verify')
        }
      })
      .catch(() => {})
  }, [user])

  // Step 1: Submit handles
  const handleSubmit = async (e) => {
    e.preventDefault()
    const filled = PLATFORMS.filter(p => handles[p].trim())
    if (!filled.length) { setMsg({ type: 'error', text: 'Enter at least one platform handle' }); return }

    setLoading(true); setMsg({ type: '', text: '' })
    try {
      const payload = {}
      filled.forEach(p => { payload[p] = handles[p].trim() })
      const res = await handlersAPI.submit(payload)
      const d = res.data.data || res.data
      setCode(d.code)
      setStep('verify')
      setMsg({ type: 'success', text: 'Verification code generated! Set it as your First Name on each platform, then click Verify.' })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Submission failed' })
    } finally {
      setLoading(false)
    }
  }

  // Copy code
  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Step 2: Confirm verification
  const handleConfirm = async () => {
    setConfirming(true); setMsg({ type: '', text: '' }); setFailed({})
    try {
      const res = await handlersAPI.confirm()
      const d = res.data.data || res.data
      setStatus(d?.results || {})
      if (res.data.success) {
        setStep('done')
        await refreshUser()
        setMsg({ type: 'success', text: '✅ All handles verified successfully!' })
      } else {
        // Build per-platform hint map from failed array
        const failedMap = {}
        ;(d?.failed || []).forEach(f => { failedMap[f.platform] = f })
        setFailed(failedMap)
        setMsg({ type: 'error', text: 'Verification failed on some platforms. See hints below ↓' })
      }
    } catch (err) {
      const d = err.response?.data?.data || err.response?.data
      setStatus(d?.results || {})
      const failedMap = {}
      ;(d?.failed || []).forEach(f => { failedMap[f.platform] = f })
      setFailed(failedMap)
      setMsg({ type: 'error', text: err.response?.data?.message || 'Verification failed. Check each platform and retry.' })
    } finally {
      setConfirming(false)
    }
  }

  const codeChars = code ? code.split('') : []
  const submittedPlatforms = PLATFORMS.filter(p => handles[p])

  return (
    <>
      <Header title="Link Handles" breadcrumb="Account" />
      <div className="page">
        <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Done state */}
          {step === 'done' && (
            <div className="card">
              <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
                <ShieldCheck size={48} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Handles Verified!</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
                  Your coding profiles are linked and showing on the leaderboard.
                </p>
                <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => setStep('form')}>
                  Update Handles
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Submit handles */}
          {step === 'form' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Enter Your Handles</h3>
                <span className="badge badge-gray">Step 1 of 2</span>
              </div>
              <div className="card-body">
                {msg.text && (
                  <div className={`msg ${msg.type === 'error' ? 'msg-error' : 'msg-success'}`} style={{ marginBottom: 14 }}>
                    {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{msg.text}
                  </div>
                )}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {PLATFORMS.map(p => (
                    <div key={p} className="form-group">
                      <label className="form-label">{PLATFORM_LABELS[p]} Username <span style={{ color: 'var(--fg-subtle)' }}>(optional)</span></label>
                      <input
                        className="form-input"
                        placeholder={`Your ${PLATFORM_LABELS[p]} username`}
                        value={handles[p]}
                        onChange={e => setHandles(h => ({ ...h, [p]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <button className="btn btn-primary" disabled={loading}>
                    {loading ? 'Generating Code…' : 'Generate Verification Code →'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Step 2: Verify */}
          {step === 'verify' && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Set Your Name on Each Platform</h3>
                <span className="badge badge-blue">Step 2 of 2</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Instruction banner */}
                <div className="msg msg-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <AlertCircle size={14} /> How to verify
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Go to each platform below → Edit Profile → change the <strong>First Name / Name field</strong> to exactly this code → come back and click <em>Verify Now</em>.
                  </p>
                </div>

                {/* Code display */}
                <div className="code-display">
                  {codeChars.slice(0, 4).map((c, i) => (
                    <div key={i} className="code-char">{c}</div>
                  ))}
                  <span className="code-dash">–</span>
                  {codeChars.slice(4).map((c, i) => (
                    <div key={i + 4} className="code-char">{c}</div>
                  ))}
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 8 }} onClick={copyCode} title="Copy">
                    {copied ? <CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> : <Copy size={15} />}
                  </button>
                </div>

                {/* Per-platform rows */}
                <div className="verify-platforms">
                  {submittedPlatforms.map(p => {
                    const s     = status[p]
                    const f     = failed[p]
                    const isPassed  = s?.passed === true
                    const isFailed  = s?.passed === false
                    const isScraperErr = f?.scraperError

                    return (
                      <div key={p} className="verify-row" style={{
                        borderLeft: isPassed  ? '3px solid var(--success)' :
                                    isFailed  ? '3px solid var(--error)'   : '3px solid var(--border)',
                        paddingLeft: 12, borderRadius: 6, background: 'var(--surface-raised)', padding: '10px 12px'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <p className="verify-plat-name" style={{ margin: 0 }}>{PLATFORM_LABELS[p]}</p>
                            <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>@{handles[p]}</span>
                            <a href={PLATFORM_EDIT_URL[p]} target="_blank" rel="noreferrer"
                               style={{ color: 'var(--accent)', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 2, textDecoration: 'none' }}>
                              Edit <ExternalLink size={10} />
                            </a>
                          </div>

                          {/* Show hint if failed */}
                          {isFailed && f?.hint && (
                            <p style={{ margin: 0, fontSize: '0.78rem', color: isScraperErr ? 'var(--warning)' : 'var(--error)', lineHeight: 1.5 }}>
                              {isScraperErr ? '⚠️' : '✗'} {f.hint}
                            </p>
                          )}
                          {!isFailed && !isPassed && (
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>
                              Change {PLATFORM_FIELD[p]} to <strong style={{ color: 'var(--fg-base)', fontFamily: 'monospace' }}>{code}</strong>
                            </p>
                          )}
                          {isPassed && (
                            <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--success)' }}>✓ Name matched!</p>
                          )}
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {isPassed  && <span className="badge badge-green"><CheckCircle2 size={12} /> Verified</span>}
                          {isFailed  && !isScraperErr && <span className="badge badge-red"><AlertCircle size={12} /> Mismatch</span>}
                          {isFailed  && isScraperErr  && <span className="badge badge-orange"><AlertCircle size={12} /> Check Handle</span>}
                          {!s        && <span className="badge badge-gray">Pending</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {msg.text && (
                  <div className={`msg ${msg.type === 'error' ? 'msg-error' : 'msg-success'}`}>
                    {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{msg.text}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary flex-1" onClick={handleConfirm} disabled={confirming}>
                    {confirming ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Checking…</> : <><ShieldCheck size={15} /> Verify Now</>}
                  </button>
                  <button className="btn btn-ghost" onClick={() => setStep('form')}>
                    <RefreshCw size={14} /> Edit
                  </button>
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--fg-subtle)', textAlign: 'center', margin: 0 }}>
                  Code expires in 24 hours. You can re-generate anytime by clicking Edit.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
