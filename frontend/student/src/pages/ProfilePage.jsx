import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { profileAPI } from '../api/api'
import Header from '../components/Header'
import { User, Phone, BookOpen, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [phone,   setPhone]   = useState(user?.phone   || '')
  const [branch,  setBranch]  = useState(user?.branch  || '')
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState({ type: '', text: '' })

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setMsg({ type: '', text: '' })
    try {
      await profileAPI.update({ phone, branch })
      await refreshUser()
      setMsg({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Update failed' })
    } finally {
      setSaving(false)
    }
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <>
      <Header title="My Profile" breadcrumb="Account" />
      <div className="page">
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Profile header */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div className="avatar avatar-lg">{initials}</div>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{user?.full_name || 'Student'}</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>{user?.email}</p>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <span className="badge badge-gray">{user?.roll_number || '—'}</span>
                  <span className="badge badge-gray">{user?.branch || '—'}</span>
                  {user?.is_verified
                    ? <span className="badge badge-green">✓ Handles Verified</span>
                    : <span className="badge badge-yellow">⚠ Handles Unverified</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Edit form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Account Settings</h3>
            </div>
            <div className="card-body">
              {msg.text && (
                <div className={`msg ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`} style={{ marginBottom: 16 }}>
                  {msg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {msg.text}
                </div>
              )}
              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input className="form-input" value={user?.full_name || ''} disabled style={{ opacity: 0.6 }} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Roll Number</label>
                    <input className="form-input" value={user?.roll_number || ''} disabled style={{ opacity: 0.6 }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input
                      className="form-input"
                      placeholder="9XXXXXXXXX"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      maxLength={10}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Branch</label>
                    <select className="form-input" value={branch} onChange={e => setBranch(e.target.value)}>
                      <option value="">Select branch</option>
                      {['CSE','IT','ECE','EEE','MECH','CIVIL','AIDS','AIML','IOT','CSBS'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
