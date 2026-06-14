// SyncButton.jsx — Full sync progress modal with live polling
import { useState, useEffect, useRef } from 'react'
import { adminAPI } from '../api/api'
import { RefreshCw, CheckCircle, AlertCircle, X, Activity, WifiOff } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SyncProgressModal — shown during / after a bulk sync                      */
/* ─────────────────────────────────────────────────────────────────────────── */
function SyncProgressModal({ onClose }) {
  const [status,   setStatus]   = useState(null)   // null | syncState object
  const [connErr,  setConnErr]  = useState(false)   // can't reach endpoint
  const [errCount, setErrCount] = useState(0)
  const logsRef    = useRef(null)
  const pollRef    = useRef(null)
  const mountedRef = useRef(true)
  const errRef     = useRef(0)   // mutable ref to avoid stale closure

  async function poll() {
    if (!mountedRef.current) return
    try {
      const res = await adminAPI.syncStatus()
      const s   = res.data.data
      if (!mountedRef.current) return
      errRef.current = 0
      setStatus(s)
      setConnErr(false)
      setErrCount(0)
      // Auto-scroll logs
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight
      }
      // Stop polling when sync is done
      if (!s.running && s.finishedAt) {
        clearInterval(pollRef.current)
      }
    } catch {
      if (!mountedRef.current) return
      errRef.current += 1
      setErrCount(errRef.current)
      setConnErr(true)
      // After 5 consecutive failures, stop polling
      if (errRef.current >= 5) {
        clearInterval(pollRef.current)
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true
    poll()   // immediate first check
    pollRef.current = setInterval(poll, 3000)
    return () => {
      mountedRef.current = false
      clearInterval(pollRef.current)
    }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const pct  = status?.total > 0 ? Math.round((status.processed / status.total) * 100) : 0
  const done = status && !status.running && status.finishedAt

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'oklch(0 0 0 / 0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 600,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        boxShadow: '0 24px 64px oklch(0 0 0 / 0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: connErr
            ? 'oklch(0.22 0.06 60)'
            : done
              ? (status.failed > 0 ? 'oklch(0.2 0.04 60)' : 'var(--success-bg, oklch(0.18 0.05 145))')
              : 'var(--card-header)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {connErr
              ? <WifiOff size={18} style={{ color: '#f59e0b' }} />
              : done
                ? status.failed > 0
                  ? <AlertCircle size={18} style={{ color: '#f59e0b' }} />
                  : <CheckCircle size={18} style={{ color: 'var(--success)' }} />
                : <Activity size={18} style={{ color: 'var(--primary)', animation: 'spin 2s linear infinite' }} />
            }
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {connErr
                ? `Connection issue — retrying… (${errCount}/5)`
                : done
                  ? status.failed > 0 ? `Sync done — ${status.failed} student(s) failed` : 'Sync Complete! ✅'
                  : 'Syncing Students…'}
            </span>
          </div>
          {(done || (connErr && errCount >= 5)) && (
            <button className="icon-btn" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {status && (
          <div style={{ padding: '16px 20px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              <span>
                {status.running
                  ? `Processing: ${status.currentStudent || '…'}`
                  : done
                    ? status.failed > 0 ? `${status.failed} student(s) failed — check logs` : 'All students synced!'
                    : 'Queued…'}
              </span>
              <span style={{ fontWeight: 600 }}>
                {status.processed} / {status.total} ({pct}%)
              </span>
            </div>
            <div style={{ height: 6, background: 'var(--muted)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                background: done
                  ? (status.failed > 0 ? '#f59e0b' : 'var(--success)')
                  : 'var(--primary)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--success)' }}>✅ {status.succeeded} succeeded</span>
              <span style={{ color: status.failed > 0 ? 'var(--danger)' : 'var(--fg-muted)' }}>
                {status.failed > 0 ? '❌ ' : '○ '}{status.failed} failed
              </span>
              {status.startedAt && (
                <span style={{ color: 'var(--fg-subtle)', marginLeft: 'auto' }}>
                  Started {new Date(status.startedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Log stream */}
        <div ref={logsRef} style={{
          margin: '12px 20px 20px',
          background: 'oklch(0.08 0 0)',
          border: '1px solid oklch(0.18 0 0)',
          borderRadius: 8,
          padding: '12px 14px',
          fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
          fontSize: '0.72rem',
          lineHeight: 1.7,
          color: 'oklch(0.7 0 0)',
          maxHeight: 240,
          overflowY: 'auto',
          minHeight: 80,
        }}>
          {!status && !connErr && (
            <div style={{ color: 'oklch(0.5 0 0)' }}>Connecting to sync status…</div>
          )}
          {connErr && (
            <div style={{ color: '#f59e0b' }}>
              ⚠ Cannot reach sync status endpoint. Retrying ({errCount}/5)…
            </div>
          )}
          {status?.logs?.map((line, i) => {
            const isErr  = line.includes('❌') || line.toLowerCase().includes('error') || line.toLowerCase().includes('failed')
            const isOk   = line.includes('✅') || line.includes('Done') || line.includes('complete') || line.includes('complete')
            const isInfo = line.includes('Starting') || line.includes('started') || line.includes('Sync')
            return (
              <div key={i} style={{
                color: isErr  ? 'oklch(0.65 0.18 25)'
                     : isOk   ? 'oklch(0.65 0.18 145)'
                     : isInfo ? 'oklch(0.65 0.12 240)'
                     : 'oklch(0.7 0 0)',
                borderBottom: i < (status.logs.length - 1) ? '1px solid oklch(0.12 0 0)' : 'none',
                paddingBottom: '1px',
              }}>
                {line}
              </div>
            )
          })}
          {status?.running && (
            <div style={{ color: 'oklch(0.5 0.12 240)', marginTop: 4 }}>
              ▶ syncing…
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        }}>
          {done ? (
            <>
              <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                {status.failed > 0
                  ? `${status.failed} student(s) had sync errors.`
                  : `All ${status.succeeded} students synced successfully.`}
              </span>
              <button className="btn btn-primary" onClick={onClose}>
                <CheckCircle size={14} /> Close
              </button>
            </>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>
              Sync runs in the background — safe to close this dialog.
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SyncButton — top-level header button that opens the modal                 */
/* ─────────────────────────────────────────────────────────────────────────── */
export default function SyncButton() {
  const [state,     setState]     = useState('idle')  // idle | starting | error
  const [showModal, setShowModal] = useState(false)

  async function handleClick() {
    if (state === 'starting') return
    setState('starting')

    // Open modal immediately so the user sees "Connecting…" right away
    setShowModal(true)

    try {
      // If sync is already running, the modal will pick it up automatically
      const statusRes = await adminAPI.syncStatus()
      if (!statusRes.data.data?.running) {
        // Kick off a new sync
        await adminAPI.triggerSync()
      }
      setState('idle')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 4000)
      // Modal stays open and will show connection errors via its own poll loop
    }
  }

  return (
    <>
      <button
        className="btn btn-sm btn-ghost"
        onClick={handleClick}
        disabled={state === 'starting'}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          ...(state === 'error' ? {
            background: 'var(--danger-bg)', color: 'var(--danger)',
            border: '1px solid var(--danger-border)',
          } : {}),
        }}
        title="Sync all student profiles"
      >
        {state === 'starting'
          ? <div className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
          : state === 'error'
          ? <AlertCircle size={13} />
          : <RefreshCw size={13} />
        }
        {state === 'starting' ? 'Starting…' : state === 'error' ? 'Failed' : 'Sync All'}
      </button>

      {showModal && <SyncProgressModal onClose={() => setShowModal(false)} />}
    </>
  )
}
