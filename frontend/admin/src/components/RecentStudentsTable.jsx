import { useNavigate } from 'react-router-dom'
import { Eye } from 'lucide-react'

export default function RecentStudentsTable({ students = [] }) {
  const navigate = useNavigate()
  if (!students.length) return null

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Recently Joined</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate('/students')}
        >
          View all →
        </button>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Joined</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.email}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: '0.7rem', flexShrink: 0 }}>
                      {s.full_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.full_name || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{s.email}</div>
                    </div>
                  </div>
                </td>
                <td><span className="badge badge-gray">{s.branch || '—'}</span></td>
                <td>
                  {s.is_verified
                    ? <span className="badge badge-green">Verified</span>
                    : <span className="badge badge-gray">Pending</span>}
                </td>
                <td style={{ fontSize: '0.8rem', color: 'var(--fg-muted)' }}>
                  {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </td>
                <td>
                  <button className="icon-btn"
                    onClick={() => navigate(`/students/${encodeURIComponent(s.email)}`)}>
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
