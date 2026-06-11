import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'
import { GraduationCap, Mail, Hash, GitBranch, Calendar, ShieldCheck, ShieldAlert } from 'lucide-react'

export default function ProfilePage() {
  const { user } = useAuth()

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const infoRows = [
    { icon: Hash,         label: 'Roll Number',   value: user?.roll_number   || '—' },
    { icon: GraduationCap,label: 'College',        value: user?.college       || '—' },
    { icon: GitBranch,    label: 'Branch',         value: user?.branch        || '—' },
    { icon: Calendar,     label: 'Passout Year',   value: user?.passout_year  || '—' },
    { icon: Mail,         label: 'Email',          value: user?.email         || '—' },
  ]

  return (
    <>
      <Header title="My Profile" breadcrumb="Account" />
      <div className="page">
        <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Profile header card */}
          <div className="card">
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div className="avatar avatar-lg">{initials}</div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>
                  {user?.full_name || 'Student'}
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: 10 }}>
                  {user?.email}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {user?.roll_number && (
                    <span className="badge badge-gray">{user.roll_number}</span>
                  )}
                  {user?.branch && (
                    <span className="badge badge-gray">{user.branch}</span>
                  )}
                  {user?.college && (
                    <span className="badge badge-gray">{user.college}</span>
                  )}
                  {user?.is_verified
                    ? <span className="badge badge-green"><ShieldCheck size={11} style={{ marginRight: 4 }} />Handles Verified</span>
                    : <span className="badge badge-yellow"><ShieldAlert size={11} style={{ marginRight: 4 }} />Handles Unverified</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Details card — read-only, sourced from Maya college API */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">College Details</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                Sourced from university records
              </span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {infoRows.map(({ icon: Icon, label, value }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '13px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: 'var(--surface-2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={16} color="var(--fg-muted)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginBottom: 1 }}>{label}</div>
                    <div style={{ fontSize: '0.925rem', fontWeight: 500 }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
