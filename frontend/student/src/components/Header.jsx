// Header.jsx — top navigation bar
import { Bell, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export default function Header({ title, breadcrumb }) {
  const { user } = useAuth()
  const { theme, toggle } = useTheme()

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

      {/* Right — theme toggle + notifications + avatar */}
      <div className="header-right">
        {/* Theme Toggle */}
        <button
          className="theme-toggle"
          onClick={toggle}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

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
