import { Search, Bell, RefreshCw } from 'lucide-react'

export default function AdminHeader({ title, breadcrumb, onRefresh }) {
  return (
    <header className="header">
      <div className="header-left">
        {breadcrumb && (
          <div className="breadcrumb">
            <span>{breadcrumb}</span>
            <span className="breadcrumb-sep">›</span>
          </div>
        )}
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-search">
        <Search className="search-ico" size={14} />
        <input type="text" placeholder="Search students, emails, roll numbers…" />
      </div>

      <div className="header-right">
        {onRefresh && (
          <button className="icon-btn" onClick={onRefresh} title="Refresh data">
            <RefreshCw size={16} />
          </button>
        )}
        <button className="icon-btn">
          <Bell size={17} />
        </button>
        <div className="avatar" style={{ background: 'var(--danger)' }}>A</div>
      </div>
    </header>
  )
}
