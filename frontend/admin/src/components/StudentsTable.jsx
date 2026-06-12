import { useState } from 'react'
import { Eye, ShieldOff, ShieldCheck, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react'
import { adminAPI } from '../api/api'
import { useNavigate } from 'react-router-dom'

export default function StudentsTable({ students = [], total, page, onPageChange, onRefresh, showSyncButton = false }) {
  const [blocking,  setBlocking]  = useState(null)
  const [syncingId, setSyncingId] = useState(null)
  const [search,    setSearch]    = useState('')
  const navigate = useNavigate()

  const pages = Math.ceil(total / 20)

  const handleBlock = async (email) => {
    setBlocking(email)
    try {
      await adminAPI.block(email)
      onRefresh?.()
    } finally {
      setBlocking(null)
    }
  }

  const handleUnblock = async (email) => {
    setBlocking(email)
    try {
      await adminAPI.unblock(email)
      onRefresh?.()
    } finally {
      setBlocking(null)
    }
  }

  const handleSync = async (email) => {
    setSyncingId(email)
    try { await adminAPI.syncStudent(email) }
    catch (e) { console.error(e) }
    finally { setSyncingId(null) }
  }

  const filtered = search
    ? students.filter(s =>
        s.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.email?.toLowerCase().includes(search.toLowerCase()) ||
        s.roll_number?.toLowerCase().includes(search.toLowerCase())
      )
    : students

  return (
    <div className="card">
      {/* Search */}
      <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
        <h3 className="card-title">All Students <span style={{ color: 'var(--fg-muted)', fontWeight: 400, fontSize: '0.8rem' }}>({total.toLocaleString()})</span></h3>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: 30, height: 34 }}
            placeholder="Search name, email, roll…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No students found</p>
          <p className="empty-desc">Try a different search or filter.</p>
        </div>
      ) : (
        <>
          <div className="lb-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Roll No.</th>
                  <th>Branch</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const initials = s.full_name
                    ? s.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                    : '?'
                  return (
                    <tr key={s.email}>
                      <td style={{ color: 'var(--fg-muted)', fontSize: '0.78rem' }}>
                        {(page - 1) * 20 + i + 1}
                      </td>
                      <td>
                        <div className="student-cell">
                          <div className="avatar" style={{ background: s.is_blocklisted ? 'var(--danger-bg)' : undefined }}>
                            {initials}
                          </div>
                          <div className="student-info">
                            <p className="sname">{s.full_name || '—'}</p>
                            <p className="shandle">{s.verified_handles?.join(' · ') || 'No handles'}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="dept-tag">{s.roll_number || '—'}</span>
                      </td>
                      <td>
                        <span className="dept-tag">{s.branch || '—'}</span>
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
                        {s.email}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {s.is_verified
                            ? <span className="badge badge-green">✓ Verified</span>
                            : <span className="badge badge-gray">Unverified</span>}
                          {s.is_blocklisted && <span className="badge badge-red">Blocked</span>}
                        </div>
                      </td>
                      <td className="right">
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title="View detail"
                            onClick={() => navigate(`/students/${encodeURIComponent(s.email)}`)}
                          >
                            <Eye size={14} />
                          </button>
                          {showSyncButton && (
                            <button
                              className="btn btn-ghost btn-sm btn-icon"
                              title="Sync now"
                              onClick={() => handleSync(s.email)}
                              disabled={syncingId === s.email}
                            >
                              <RefreshCw size={13} className={syncingId === s.email ? 'spin' : ''} />
                            </button>
                          )}
                          {s.is_blocklisted ? (
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleUnblock(s.email)}
                              disabled={blocking === s.email}
                              title="Unblock"
                            >
                              <ShieldCheck size={13} /> Unblock
                            </button>
                          ) : (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleBlock(s.email)}
                              disabled={blocking === s.email}
                              title="Block from leaderboard"
                            >
                              <ShieldOff size={13} /> Block
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <p className="pag-info">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()}
            </p>
            <div className="pag-btns">
              <button className="pag-btn" disabled={page === 1} onClick={() => onPageChange?.(page - 1)}>
                <ChevronLeft size={15} />
              </button>
              <span className="pag-current">{page} / {pages || 1}</span>
              <button className="pag-btn" disabled={page >= pages} onClick={() => onPageChange?.(page + 1)}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
