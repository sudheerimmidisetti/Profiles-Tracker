import { useState, useEffect } from 'react'
import { handlersAPI } from '../api/api'
import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'
import {
  Copy, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck,
  ExternalLink, Clock, XCircle, Send, ChevronDown, ChevronUp
} from 'lucide-react'

const PLATFORMS = ['leetcode', 'codeforces', 'codechef', 'hackerrank']

const PLATFORM_LABELS = {
  leetcode:   'LeetCode',
  codeforces: 'Codeforces',
  codechef:   'CodeChef',
  hackerrank: 'HackerRank',
}

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

/* ─── Verified-student: Request Update UI ─────────────────────────────────── */
function HandleUpdateRequest() {
  const [currentHandles, setCurrentHandles] = useState({})
  const [requests, setRequests]             = useState([])
  const [handles, setHandles]               = useState({ leetcode: '', codeforces: '', codechef: '', hackerrank: '' })
  const [loading, setLoading]               = useState(false)
  const [msg, setMsg]                       = useState({ type: '', text: '' })
  const [showForm, setShowForm]             = useState(false)

  const hasPending = requests.some(r => r.status === 'pending')

  useEffect(() => {
    handlersAPI.requestStatus()
      .then(r => {
        const d = r.data.data
        setCurrentHandles(d?.currentHandles || {})
        setRequests(d?.requests || [])
        // Pre-fill form with current handles
        const cur = d?.currentHandles || {}
        setHandles({
          leetcode:   cur.leetcode   || '',
          codeforces: cur.codeforces || '',
          codechef:   cur.codechef   || '',
          hackerrank: cur.hackerrank || '',
        })
      })
      .catch(() => {})
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    const filled = PLATFORMS.filter(p => handles[p].trim())
    if (!filled.length) { setMsg({ type: 'error', text: 'Enter at least one handle' }); return }

    setLoading(true); setMsg({ type: '', text: '' })
    try {
      const payload = {}
      filled.forEach(p => { payload[p] = handles[p].trim() })
      await handlersAPI.submit(payload)
      setMsg({ type: 'success', text: '✅ Handle update request submitted! An admin will review it shortly.' })
      setShowForm(false)
      // Refresh requests list
      const r2 = await handlersAPI.requestStatus()
      const d2 = r2.data.data
      setRequests(d2?.requests || [])
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Submission failed' })
    } finally {
      setLoading(false)
    }
  }

  const statusBadge = (status) => {
    if (status === 'pending')  return <span className="badge badge-orange"><Clock size={11} /> Pending</span>
    if (status === 'approved') return <span className="badge badge-green"><CheckCircle2 size={11} /> Approved</span>
    if (status === 'rejected') return <span className="badge badge-red"><XCircle size={11} /> Rejected</span>
    return null
  }

  return (
    <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Current handles card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Current Handles</h3>
          <span className="badge badge-green"><ShieldCheck size={12} /> Verified</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PLATFORMS.map(p => (
            <div key={p} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', fontWeight: 500 }}>{PLATFORM_LABELS[p]}</span>
              {currentHandles[p]
                ? <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg-base)' }}>@{currentHandles[p]}</span>
                : <span style={{ fontSize: '0.8rem', color: 'var(--fg-subtle)' }}>Not linked</span>
              }
            </div>
          ))}

          {/* Notice about the request flow */}
          <div className="msg msg-info" style={{ marginTop: 8, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600, fontSize: '0.82rem' }}>
              <AlertCircle size={13} /> How handle updates work
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              Since your handles are already verified, any changes must be reviewed by an admin. Submit a request below — the admin will approve or reject it, and your data will sync automatically on approval.
            </p>
          </div>
        </div>
      </div>

      {/* Request history */}
      {requests.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Request History</h3>
            <span className="badge badge-gray">{requests.length} request{requests.length > 1 ? 's' : ''}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {requests.map(req => (
              <div key={req.id} style={{
                border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px',
                background: 'var(--surface-raised)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                    {new Date(req.requested_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {statusBadge(req.status)}
                </div>

                {/* Handle diff */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
                  {[
                    { key: 'leetcode',   label: 'LeetCode',   old: req.lc_handle_old, new_: req.lc_handle   },
                    { key: 'codeforces', label: 'Codeforces', old: req.cf_handle_old, new_: req.cf_handle   },
                    { key: 'codechef',   label: 'CodeChef',   old: req.cc_handle_old, new_: req.cc_handle   },
                    { key: 'hackerrank', label: 'HackerRank', old: req.hr_handle_old, new_: req.hr_handle   },
                  ].filter(h => h.new_).map(h => (
                    <div key={h.key} style={{ fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--fg-muted)' }}>{h.label}: </span>
                      <span style={{ color: 'var(--fg-subtle)', textDecoration: 'line-through' }}>{h.old || '—'}</span>
                      <span style={{ color: 'var(--accent)', fontWeight: 600, marginLeft: 4 }}>→ {h.new_}</span>
                    </div>
                  ))}
                </div>

                {req.status === 'rejected' && req.reject_reason && (
                  <div className="msg msg-error" style={{ marginTop: 8, padding: '6px 10px', fontSize: '0.78rem' }}>
                    <XCircle size={12} /> Reason: {req.reject_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request form */}
      <div className="card">
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => !hasPending && setShowForm(f => !f)}>
          <h3 className="card-title">Request Handle Update</h3>
          {hasPending
            ? <span className="badge badge-orange"><Clock size={11} /> Pending review</span>
            : showForm
              ? <ChevronUp size={16} style={{ color: 'var(--fg-muted)' }} />
              : <ChevronDown size={16} style={{ color: 'var(--fg-muted)' }} />
          }
        </div>

        {hasPending && (
          <div className="card-body">
            <div className="msg msg-info" style={{ fontSize: '0.82rem' }}>
              <Clock size={14} /> You already have a pending request. Please wait for admin to review it before submitting another.
            </div>
          </div>
        )}

        {!hasPending && showForm && (
          <div className="card-body">
            {msg.text && (
              <div className={`msg ${msg.type === 'error' ? 'msg-error' : 'msg-success'}`} style={{ marginBottom: 14 }}>
                {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{msg.text}
              </div>
            )}
            <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', margin: '0 0 14px' }}>
              Enter only the handles you want to change. Leave others blank to keep them as-is.
            </p>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {PLATFORMS.map(p => (
                <div key={p} className="form-group">
                  <label className="form-label">
                    {PLATFORM_LABELS[p]}
                    {currentHandles[p] && (
                      <span style={{ color: 'var(--fg-subtle)', fontWeight: 400 }}> (current: @{currentHandles[p]})</span>
                    )}
                  </label>
                  <input
                    className="form-input"
                    placeholder={currentHandles[p] ? `Keep "${currentHandles[p]}" or enter new` : `Your ${PLATFORM_LABELS[p]} username`}
                    value={handles[p]}
                    onChange={e => setHandles(h => ({ ...h, [p]: e.target.value }))}
                  />
                </div>
              ))}
              <button className="btn btn-primary" disabled={loading} style={{ marginTop: 4 }}>
                {loading ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Submitting…</> : <><Send size={14} /> Submit Request</>}
              </button>
            </form>
          </div>
        )}

        {!hasPending && !showForm && (
          <div className="card-body" style={{ paddingTop: 0 }}>
            <button className="btn btn-secondary" onClick={() => setShowForm(true)} style={{ width: '100%' }}>
              <RefreshCw size={14} /> Request Handle Update
            </button>
          </div>
        )}
      </div>

      {/* Stand-alone success/error message (shown even when form is collapsed) */}
      {!showForm && msg.text && (
        <div className={`msg ${msg.type === 'error' ? 'msg-error' : 'msg-success'}`}>
          {msg.type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}{msg.text}
        </div>
      )}
    </div>
  )
}

/* ─── First-time verification flow ───────────────────────────────────────── */
export default function VerifyHandlersPage() {
  const { user, refreshUser } = useAuth()

  // Step: 'form' | 'verify' | 'done'
  const [step,       setStep]       = useState(user?.is_verified ? 'done' : 'form')
  const [handles,    setHandles]    = useState({ leetcode: '', codeforces: '', codechef: '', hackerrank: '' })
  const [code,       setCode]       = useState('')
  const [status,     setStatus]     = useState({})
  const [failed,     setFailed]     = useState({})
  const [loading,    setLoading]    = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [msg,        setMsg]        = useState({ type: '', text: '' })
  const [copied,     setCopied]     = useState(false)

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

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

        {/* ── VERIFIED: show handle update request UI ───────────────────── */}
        {step === 'done' && <HandleUpdateRequest />}

        {/* ── FIRST-TIME: form step ─────────────────────────────────────── */}
        {step === 'form' && (
          <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Info banner — first-time only */}
            <div className="msg msg-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 600 }}>
                <ShieldCheck size={14} /> First-time Setup
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                Enter your handles below. You will verify ownership via a code placed on each platform. <strong>After this initial setup, handle changes require admin approval.</strong>
              </p>
            </div>

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
          </div>
        )}

        {/* ── FIRST-TIME: verify step ───────────────────────────────────── */}
        {step === 'verify' && (
          <div style={{ maxWidth: 580, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">Set Your Name on Each Platform</h3>
                <span className="badge badge-blue">Step 2 of 2</span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                <div className="msg msg-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <AlertCircle size={14} /> How to verify
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.6 }}>
                    Go to each platform below → Edit Profile → change the <strong>First Name / Name field</strong> to exactly this code → come back and click <em>Verify Now</em>.
                  </p>
                </div>

                <div className="code-display">
                  {codeChars.slice(0, 4).map((c, i) => <div key={i} className="code-char">{c}</div>)}
                  <span className="code-dash">–</span>
                  {codeChars.slice(4).map((c, i) => <div key={i + 4} className="code-char">{c}</div>)}
                  <button className="btn btn-ghost btn-sm btn-icon" style={{ marginLeft: 8 }} onClick={copyCode} title="Copy">
                    {copied ? <CheckCircle2 size={15} style={{ color: 'var(--success)' }} /> : <Copy size={15} />}
                  </button>
                </div>

                <div className="verify-platforms">
                  {submittedPlatforms.map(p => {
                    const s = status[p]
                    const f = failed[p]
                    const isPassed     = s?.passed === true
                    const isFailed     = s?.passed === false
                    const isScraperErr = f?.scraperError

                    return (
                      <div key={p} className="verify-row" style={{
                        borderLeft: isPassed ? '3px solid var(--success)' : isFailed ? '3px solid var(--error)' : '3px solid var(--border)',
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
                          {isPassed && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--success)' }}>✓ Name matched!</p>}
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
          </div>
        )}

      </div>
    </>
  )
}
