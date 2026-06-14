// admin/src/pages/HandleRequestsPage.jsx
import { useState, useEffect, useCallback } from 'react'
import AdminHeader from '../components/AdminHeader'
import { adminAPI } from '../api/api'
import {
  CheckCircle2, XCircle, Clock, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, User, Search
} from 'lucide-react'

const STATUS_FILTERS = [
  { value: '',         label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function statusBadge(status) {
  if (status === 'pending')  return <span className="badge badge-orange"><Clock size={11} /> Pending</span>
  if (status === 'approved') return <span className="badge badge-green"><CheckCircle2 size={11} /> Approved</span>
  if (status === 'rejected') return <span className="badge badge-red"><XCircle size={11} /> Rejected</span>
  return null
}

function HandleDiff({ req }) {
  const rows = [
    { label: 'LeetCode',   old: req.lc_handle_old, new_: req.lc_handle   },
    { label: 'Codeforces', old: req.cf_handle_old, new_: req.cf_handle   },
    { label: 'CodeChef',   old: req.cc_handle_old, new_: req.cc_handle   },
    { label: 'HackerRank', old: req.hr_handle_old, new_: req.hr_handle   },
  ].filter(r => r.new_)

  if (!rows.length) return <span style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>No handles specified</span>

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: 4 }}>
      {rows.map(r => (
        <div key={r.label} style={{ fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--fg-muted)', fontWeight: 500 }}>{r.label}: </span>
          {r.old
            ? <><span style={{ color: 'var(--fg-subtle)', textDecoration: 'line-through' }}>{r.old}</span>
                <span style={{ color: 'var(--fg-muted)', margin: '0 4px' }}>→</span>
                <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{r.new_}</span></>
            : <span style={{ color: 'var(--success)', fontWeight: 600 }}>+ {r.new_}</span>
          }
        </div>
      ))}
    </div>
  )
}

function RejectModal({ requestId, onReject, onClose }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    await onReject(requestId, reason)
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface-card)', borderRadius: 12, padding: 28,
        width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <XCircle size={20} style={{ color: 'var(--danger)' }} />
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Reject Request</h3>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--fg-muted)' }}>
          Optionally provide a reason. The student will see this when they view their request history.
        </p>
        <textarea
          className="form-input"
          style={{ minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
          placeholder="Reason for rejection (optional)…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={submit} disabled={loading}>
            {loading ? 'Rejecting…' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function HandleRequestsPage() {
  const [requests,      setRequests]      = useState([])
  const [total,         setTotal]         = useState(0)
  const [pendingCount,  setPendingCount]  = useState(0)
  const [statusFilter,  setStatusFilter]  = useState('')
  const [loading,       setLoading]       = useState(false)
  const [acting,        setActing]        = useState({})    // { [id]: true } while approving/rejecting
  const [toast,         setToast]         = useState(null)
  const [rejectModal,   setRejectModal]   = useState(null)  // requestId or null
  const [expanded,      setExpanded]      = useState({})    // { [id]: bool }

  const showToast = (type, text) => {
    setToast({ type, text })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (statusFilter) params.status = statusFilter
      const r = await adminAPI.listHandleRequests(params)
      setRequests(r.data.data || [])
      setTotal(r.data.total || 0)
      setPendingCount(r.data.pendingCount || 0)
    } catch {
      showToast('error', 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const approve = async (id) => {
    setActing(a => ({ ...a, [id]: true }))
    try {
      await adminAPI.approveHandleRequest(id)
      showToast('success', '✅ Request approved — sync triggered!')
      load()
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Approval failed')
    } finally {
      setActing(a => ({ ...a, [id]: false }))
    }
  }

  const reject = async (id, reason) => {
    setActing(a => ({ ...a, [id]: true }))
    try {
      await adminAPI.rejectHandleRequest(id, reason)
      showToast('success', 'Request rejected.')
      setRejectModal(null)
      load()
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Rejection failed')
    } finally {
      setActing(a => ({ ...a, [id]: false }))
    }
  }

  const toggleExpand = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }))

  return (
    <>
      <AdminHeader title="Handle Requests" breadcrumb="Management" />
      <div className="page">

        {/* Toast */}
        {toast && (
          <div style={{
            position: 'fixed', top: 20, right: 20, zIndex: 2000,
            padding: '10px 18px', borderRadius: 8, fontWeight: 500, fontSize: '0.875rem',
            background: toast.type === 'error' ? 'var(--danger)' : 'var(--success)',
            color: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}>
            {toast.text}
          </div>
        )}

        {rejectModal && (
          <RejectModal
            requestId={rejectModal}
            onReject={reject}
            onClose={() => setRejectModal(null)}
          />
        )}

        {/* Summary strip */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
            <Clock size={18} style={{ color: 'var(--warning)' }} />
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{pendingCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Pending Review</div>
            </div>
          </div>
          <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
            <User size={18} style={{ color: 'var(--accent)' }} />
            <div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1 }}>{total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Total Requests</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div className="pills">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  className={`pill${statusFilter === f.value ? ' active' : ''}`}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                  {f.value === 'pending' && pendingCount > 0 && (
                    <span style={{
                      marginLeft: 6, background: 'var(--warning)', color: 'white',
                      borderRadius: '9999px', padding: '1px 6px', fontSize: '0.7rem', fontWeight: 700,
                    }}>{pendingCount}</span>
                  )}
                </button>
              ))}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading} style={{ marginLeft: 'auto' }}>
              <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* List */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--fg-muted)' }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            Loading…
          </div>
        )}

        {!loading && requests.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--fg-muted)' }}>
            <CheckCircle2 size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p style={{ margin: 0, fontWeight: 500 }}>No requests found</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
              {statusFilter === 'pending' ? 'All caught up!' : 'No handle update requests yet.'}
            </p>
          </div>
        )}

        {!loading && requests.map(req => (
          <div key={req.id} className="card" style={{ marginBottom: 12 }}>
            {/* Header row */}
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>

              {/* Student avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem',
              }}>
                {(req.full_name || req.student_email)[0].toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{req.full_name || '—'}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{req.student_email}</span>
                  {req.roll_number && <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{req.roll_number}</span>}
                  {req.branch && <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>{req.branch}</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-subtle)', marginTop: 2 }}>
                  {new Date(req.requested_at).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
              </div>

              {/* Status */}
              <div style={{ flexShrink: 0 }}>{statusBadge(req.status)}</div>

              {/* Expand toggle */}
              <button
                className="btn btn-ghost btn-sm btn-icon"
                onClick={() => toggleExpand(req.id)}
                title={expanded[req.id] ? 'Collapse' : 'Expand'}
              >
                {expanded[req.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {/* Summary diff (always visible) */}
            <div style={{ padding: '0 18px 12px', borderTop: '1px solid var(--border)' }}>
              <div style={{ paddingTop: 10 }}>
                <HandleDiff req={req} />
              </div>
            </div>

            {/* Expanded detail + actions */}
            {expanded[req.id] && (
              <div style={{ padding: '0 18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

                {/* Reviewer info for reviewed requests */}
                {req.status !== 'pending' && (
                  <div className="msg msg-info" style={{ fontSize: '0.8rem', padding: '8px 12px' }}>
                    {req.status === 'approved' ? '✅' : '❌'} Reviewed by <strong>{req.reviewed_by}</strong> on {new Date(req.reviewed_at).toLocaleString('en-IN')}
                    {req.reject_reason && <div style={{ marginTop: 4 }}>Reason: <em>{req.reject_reason}</em></div>}
                  </div>
                )}

                {/* Actions for pending */}
                {req.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => approve(req.id)}
                      disabled={!!acting[req.id]}
                      style={{ flex: 1 }}
                    >
                      {acting[req.id] ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <CheckCircle2 size={14} />}
                      Approve & Sync
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => setRejectModal(req.id)}
                      disabled={!!acting[req.id]}
                      style={{ flex: 1 }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
