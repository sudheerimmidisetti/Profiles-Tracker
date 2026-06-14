import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  LayoutDashboard, Users, Trophy, BarChart2,
  Code2, ShieldOff, LogOut, Database, UserCog, RefreshCw
} from 'lucide-react'
import { useAdminAuth } from '../context/AdminAuthContext'
import { adminAPI } from '../api/api'

export default function AdminSidebar() {
  const { logout } = useAdminAuth()
  const navigate   = useNavigate()
  const [pendingHandles, setPendingHandles] = useState(0)

  // Poll for pending handle requests every 60 seconds
  useEffect(() => {
    const load = async () => {
      try {
        const r = await adminAPI.listHandleRequests({ status: 'pending', limit: 1 })
        setPendingHandles(r.data.pendingCount || 0)
      } catch {}
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [])

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
        {
          to: '/handle-requests',
          label: 'Handle Requests',
          icon: RefreshCw,
          badge: pendingHandles > 0 ? pendingHandles : null,
        },
        { to: '/blocklist',   label: 'Blocked Students', icon: ShieldOff },
        { to: '/team',        label: 'Admin Team',        icon: UserCog },
      ],
    },
  ]

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
                    {item.badge && (
                      <span style={{
                        marginLeft: 'auto',
                        background: 'var(--danger)',
                        color: 'white',
                        borderRadius: '9999px',
                        padding: '1px 7px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        lineHeight: '1.4',
                      }}>
                        {item.badge}
                      </span>
                    )}
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
