import { useState } from 'react'
import { Search, Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'leetcode',   label: 'LC' },
  { id: 'codeforces', label: 'CF' },
  { id: 'codechef',   label: 'CC' },
  { id: 'hackerrank', label: 'HR' },
]

export default function Header({ title, breadcrumb, onPlatformChange, activePlatform: externalPlatform }) {
  const { user } = useAuth()
  const [active, setActive] = useState(externalPlatform || 'all')

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handlePill = (id) => {
    setActive(id)
    onPlatformChange?.(id)
  }

  return (
    <header className="header">
      {/* Left */}
      <div className="header-left">
        {breadcrumb && (
          <div className="breadcrumb">
            <span>{breadcrumb}</span>
            <span className="breadcrumb-sep">›</span>
          </div>
        )}
        <h1 className="header-title">{title}</h1>
      </div>

      {/* Center */}
      <div className="header-search">
        <Search className="search-ico" size={14} />
        <input type="text" placeholder="Search students, handles…" />
      </div>

      {/* Right */}
      <div className="header-right">
        {/* Platform pills */}
        <div className="pills">
          {PLATFORMS.map(p => (
            <button
              key={p.id}
              className={`pill${active === p.id ? ' active' : ''}`}
              onClick={() => handlePill(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

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
