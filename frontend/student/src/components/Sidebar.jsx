import { useState } from 'react'
import { NavLink, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard, Trophy, BarChart2, User, Settings,
  Code2, Flame, ChefHat, Award, Layers,
  ShieldCheck, LogOut, Menu, X, ChevronDown, CalendarDays, Globe
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  {
    title: 'OVERVIEW',
    items: [
      { to: '/',                 label: 'Dashboard',   icon: LayoutDashboard },
      { to: '/leaderboard',      label: 'Leaderboard', icon: Trophy },
      { to: '/analytics',        label: 'Analytics',   icon: BarChart2 },
      { to: '/contests',         label: 'Contests',    icon: Layers },
      { to: '/contest-calendar', label: 'Calendar',    icon: CalendarDays },
    ],
  },
  {
    title: 'PLATFORMS',
    items: [
      { to: '/platform/leetcode',   label: 'LeetCode',   icon: Code2   },
      { to: '/platform/codeforces', label: 'Codeforces', icon: Flame   },
      { to: '/platform/codechef',   label: 'CodeChef',   icon: ChefHat },
      { to: '/platform/hackerrank', label: 'HackerRank', icon: Award   },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [
      { to: '/profile',          label: 'My Profile',      icon: User       },
      { to: '/verify-handlers',  label: 'Link Handles',    icon: ShieldCheck },
      { to: '/settings',         label: 'Settings',         icon: Settings   },
    ],
  },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <>
      {/* Mobile toggle */}
      <button className="mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu size={18} />
      </button>

      {/* Overlay */}
      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} />
      )}

      <aside className={`sidebar${open ? ' open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-inner">
            <div className="logo-icon">
              <Code2 size={18} />
            </div>
            <span className="logo-text">CPTrack</span>
          </div>
          <button className="icon-btn" style={{ display: open ? 'flex' : 'none' }} onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>

        {/* College badge */}
        <div className="sidebar-badge">Aditya University</div>

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
                      onClick={() => setOpen(false)}
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

        {/* Public share links */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <p className="nav-group-title" style={{ marginBottom: 6 }}>PUBLIC LINKS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Link to="/public/leaderboard" target="_blank" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 8, fontSize: '0.78rem',
              color: 'var(--fg-muted)', textDecoration: 'none', transition: 'color .12s',
            }}>
              <Globe size={13}/> Leaderboard
            </Link>
            <Link to="/public/contests" target="_blank" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 8px', borderRadius: 8, fontSize: '0.78rem',
              color: 'var(--fg-muted)', textDecoration: 'none', transition: 'color .12s',
            }}>
              <Globe size={13}/> Contests
            </Link>
          </div>
        </div>

        {/* User */}
        <div className="sidebar-footer">
          <div className="user-row">
            <div className="avatar">{initials}</div>
            <div className="user-info min-w-0">
              <p className="user-name truncate">{user?.full_name || 'Student'}</p>
              <p className="user-sub">{user?.branch || ''} • {user?.roll_number || ''}</p>
            </div>
            <ChevronDown size={14} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>
    </>
  )
}
