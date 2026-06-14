// Header.jsx — top navigation bar (no global search bar)
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Header({ title, breadcrumb }) {
  const { user } = useAuth()

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <header className="header">
      {/* Left — breadcrumb + title */}
      <div className="header-left">
        {breadcrumb && (
          <div className="breadcrumb">
            <span>{breadcrumb}</span>
            <span className="breadcrumb-sep">›</span>
          </div>
        )}
        <h1 className="header-title">{title}</h1>
      </div>

      {/* Right — notifications + avatar */}
      <div className="header-right">
        {/* Notifications */}
        <button className="icon-btn">
          <Bell size={17} />
          <span className="notif-dot" />
        </button>

        {/* Avatar */}
        <div className="avatar" title={user?.full_name}>{initials}</div>
      </div>
    </header>
  )
}
