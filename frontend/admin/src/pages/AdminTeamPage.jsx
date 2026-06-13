// AdminTeamPage.jsx — Manage admin users (add/remove)
import { useState, useEffect } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import { useAdminAuth } from '../context/AdminAuthContext'
import { UserPlus, Trash2, Mail, AlertCircle, Crown, ShieldCheck } from 'lucide-react'

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

export default function AdminTeamPage() {
  const { logout } = useAdminAuth()
  const [admins,   setAdmins]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [adding,   setAdding]   = useState(false)
  const [removing, setRemoving] = useState(null)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await adminAPI.listAdmins()
      setAdmins(res.data?.data || [])
    } catch {
      setError('Could not load admin list.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!newEmail.trim()) return
    setAdding(true); setError(''); setSuccess('')
    try {
      await adminAPI.addAdmin(newEmail.trim())
      setSuccess(`${newEmail.trim()} has been added as admin.`)
      setNewEmail('')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add admin')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(email) {
    if (!window.confirm(`Remove ${email} from admin access?`)) return
    setRemoving(email); setError(''); setSuccess('')
    try {
      await adminAPI.removeAdmin(email)
      setSuccess(`${email} has been removed.`)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove admin')
    } finally {
      setRemoving(null)
    }
  }

  const myEmail = (() => {
    try {
      const token = localStorage.getItem('adminToken')
      if (!token) return null
      return JSON.parse(atob(token.split('.')[1])).email
    } catch { return null }
  })()

  const meIsSysAdmin = admins.find(a => a.email === myEmail)?.is_system_admin === true

  return (
    <>
      <AdminHeader title="Admin Team" breadcrumb="Settings" onRefresh={load} />
      <div className="page">
        {error   && <div className="msg msg-error"   style={{ marginBottom: 16 }}><AlertCircle size={14} /> {error}</div>}
        {success && <div className="msg msg-success" style={{ marginBottom: 16 }}>{success}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
          {/* Admin list */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Current Admins</h3>
              <span className="badge badge-gray">{admins.length} admin{admins.length !== 1 ? 's' : ''}</span>
            </div>
            {loading ? (
              <div className="loading-center" style={{ padding: 40 }}><div className="spinner" /></div>
            ) : (
              <div className="lb-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Added By</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th className="right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {admins.map(a => {
                      const isSys = a.is_system_admin === true
                      const isMe  = a.email === myEmail
                      // Can remove: must be active, not yourself, not system admin, AND either you're sysadmin or you added them
                      const canRemove = a.is_active && !isMe && !isSys &&
                        (meIsSysAdmin || a.added_by === myEmail)

                      return (
                        <tr key={a.email}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: isSys ? 'linear-gradient(135deg,oklch(0.65 0.22 60),oklch(0.55 0.22 40))' : 'var(--danger)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                              }}>
                                {isSys ? '👑' : a.email[0].toUpperCase()}
                              </div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                {a.email}
                                {isMe && <span className="badge badge-green" style={{ marginLeft: 6, fontSize: '0.65rem' }}>You</span>}
                              </span>
                            </div>
                          </td>
                          <td>
                            {isSys
                              ? <span className="badge" style={{ background: 'oklch(0.55 0.22 60 / 0.15)', color: 'oklch(0.75 0.22 60)', border: '1px solid oklch(0.55 0.22 60 / 0.3)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Crown size={10} /> System Admin
                                </span>
                              : <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <ShieldCheck size={10} /> Admin
                                </span>
                            }
                          </td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{a.added_by || '—'}</td>
                          <td style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{fmtDate(a.created_at)}</td>
                          <td>
                            <span className={`badge ${a.is_active ? 'badge-green' : 'badge-gray'}`}>
                              {a.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="right">
                            {isSys ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', fontStyle: 'italic' }}>Protected</span>
                            ) : canRemove ? (
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleRemove(a.email)}
                                disabled={removing === a.email}
                                title="Remove admin access"
                              >
                                <Trash2 size={13} />
                                {removing === a.email ? ' Removing…' : ' Remove'}
                              </button>
                            ) : !isMe && a.is_active ? (
                              <span style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', fontStyle: 'italic' }}>
                                Added by {a.added_by?.split('@')[0] || '?'}
                              </span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Add admin panel */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title"><UserPlus size={16} /> Add Admin</h3>
            </div>
            <div className="card-body">
              <p style={{ fontSize: '0.82rem', color: 'var(--fg-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                Add another admin by their email. They will receive an OTP the next time they try to log in.
              </p>
              <div className="msg" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: '0.78rem', color: 'var(--warning)', lineHeight: 1.6 }}>
                ⚠️ Admins you add are <strong>sub-admins</strong> — you can remove them but they cannot remove you or other admins.
              </div>
              <form onSubmit={handleAdd}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                    <input
                      type="email"
                      className="form-input"
                      style={{ paddingLeft: 32 }}
                      placeholder="admin@example.com"
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  style={{ background: 'var(--danger)' }}
                  disabled={adding || !newEmail.trim()}
                >
                  {adding
                    ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Adding…</>
                    : <><UserPlus size={14} /> Add as Admin</>
                  }
                </button>
              </form>
            </div>

            {/* Session info */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 20px' }}>
              <p style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', marginBottom: 8 }}>Logged in as</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--fg)', fontWeight: 600 }}>
                {myEmail || '—'}
                {meIsSysAdmin && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'oklch(0.75 0.22 60)' }}>👑 System Admin</span>}
              </p>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--fg-muted)' }}
                onClick={logout}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
