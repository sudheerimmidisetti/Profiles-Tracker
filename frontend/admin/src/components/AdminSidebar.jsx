import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Trophy, BarChart2,
  Code2, ShieldOff, LogOut, Database, UserCog
} from 'lucide-react'
import { useAdminAuth } from '../context/AdminAuthContext'

const NAV = [
  {
    title: 'OVERVIEW',
    items: [
      { to: '/',            label: 'Dashboard',      icon: LayoutDashboard },
      { to: '/students',    label: 'All Students',   icon: Users },
      { to: '/leaderboard', label: 'Leaderboard',    icon: Trophy },
      { to: '/analytics',   label: 'Analytics',      icon: BarChart2 },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { to: '/blocklist',   label: 'Blocked Students', icon: ShieldOff },
      { to: '/team',        label: 'Admin Team',        icon: UserCog },
    ],
  },
]

export default function AdminSidebar() {
  const { logout } = useAdminAuth()
  const navigate   = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const myEmail = (() => {
    try {
      const token = localStorage.getItem('adminToken')
      if (!token) return null
      return JSON.parse(atob(token.split('.')[1])).email
    } catch { return null }
  })()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-inner">
          <div className="logo-icon" style={{ background: 'var(--danger)' }}>
            <Database size={18} style={{ color: 'white' }} />
          </div>
          <span className="logo-text">CPTrack Admin</span>
        </div>
      </div>

      <div className="sidebar-badge">Administrator Panel</div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(group => (
          <div key={group.title}>
            <p className="nav-group-title">{group.title}</p>
            <ul className="nav-list">
              {group.items.map(item => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  >
                    <item.icon size={16} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-row">
          <div className="avatar" style={{ background: 'var(--danger)' }}>
            {myEmail ? myEmail[0].toUpperCase() : 'A'}
          </div>
          <div className="user-info">
            <p className="user-name" style={{ fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {myEmail || 'Admin'}
            </p>
            <p className="user-sub">Full access</p>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={15} /> Logout
        </button>
      </div>
    </aside>
  )
}
