// SyncModal.jsx — Full sync progress modal with live polling
import { useState, useEffect, useRef, useCallback } from 'react'
import { adminAPI } from '../api/api'
import { RefreshCw, CheckCircle, AlertCircle, X, Activity } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SyncProgressModal — shown during / after a bulk sync                      */
/* ─────────────────────────────────────────────────────────────────────────── */
function SyncProgressModal({ onClose }) {
  const [status, setStatus]   = useState(null)  // null | syncState object
  const [error,  setError]    = useState('')
  const logsRef               = useRef(null)
  const pollRef               = useRef(null)

  const poll = useCallback(async () => {
    try {
      const res = await adminAPI.syncStatus()
      const s   = res.data.data
      setStatus(s)
      // Auto-scroll logs
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight
      }
      // Stop polling when done
      if (!s.running && s.finishedAt) {
        clearInterval(pollRef.current)
      }
    } catch (e) {
      setError('Could not reach sync status endpoint.')
      clearInterval(pollRef.current)
    }
  }, [])

  useEffect(() => {
    poll() // immediate first check
    pollRef.current = setInterval(poll, 1500)
    return () => clearInterval(pollRef.current)
  }, [poll])

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
          background: done
            ? (status.error ? 'var(--danger-bg)' : 'var(--success-bg)')
            : 'var(--card-header)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {done
              ? status.error
                ? <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
                : <CheckCircle  size={18} style={{ color: 'var(--success)' }} />
              : <Activity size={18} style={{ color: 'var(--primary)', animation: 'spin 2s linear infinite' }} />
            }
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {done
                ? status.error ? 'Sync Finished with Errors' : 'Sync Complete!'
                : 'Syncing Students…'}
            </span>
          </div>
          {done && (
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
                  : done ? (status.error ? `Error: ${status.error}` : `All done!`) : 'Waiting…'}
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
                  ? (status.error ? 'var(--danger)' : 'var(--success)')
                  : 'var(--primary)',
                borderRadius: 3,
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.75rem' }}>
              <span style={{ color: 'var(--success)' }}>✅ {status.succeeded} succeeded</span>
              <span style={{ color: 'var(--danger)' }}>❌ {status.failed} failed</span>
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
          {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
          {!status && !error && <div style={{ color: 'oklch(0.4 0 0)' }}>Connecting to sync status…</div>}
          {status?.logs?.map((line, i) => {
            const isError   = line.includes('❌')
            const isSuccess = line.includes('✅')
            return (
              <div key={i} style={{
                color: isError ? 'oklch(0.65 0.18 25)' : isSuccess ? 'oklch(0.65 0.18 145)' : 'oklch(0.7 0 0)',
              }}>
                {line}
              </div>
            )
          })}
          {status?.running && (
            <div style={{ color: 'oklch(0.5 0.12 240)', animation: 'pulse 1.5s ease-in-out infinite' }}>
              ▶ syncing…
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          {done ? (
            <button className="btn btn-primary" onClick={onClose}>
              <CheckCircle size={14} /> Done
            </button>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>
              Sync is running in the background. You can close this page safely.
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
  const [state,    setState]    = useState('idle')  // idle | starting | modal
  const [showModal, setShowModal] = useState(false)

  async function handleClick() {
    if (state === 'starting') return
    setState('starting')
    try {
      await adminAPI.triggerSync()
      setState('idle')
      setShowModal(true)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 4000)
    }
  }

  // Also open modal if sync is already running
  async function openExistingSync() {
    try {
      const res = await adminAPI.syncStatus()
      if (res.data.data?.running) {
        setState('idle')
        setShowModal(true)
        return
      }
    } catch { /* ignore */ }
    await handleClick()
  }

  return (
    <>
      <button
        className="btn btn-sm btn-ghost"
        onClick={openExistingSync}
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
