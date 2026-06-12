import { RefreshCw, Bell } from 'lucide-react'

export default function AdminHeader({ title, breadcrumb, onRefresh, extra }) {
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

      <div className="header-right">
        {extra}
        {onRefresh && (
          <button className="icon-btn" onClick={onRefresh} title="Refresh data">
            <RefreshCw size={16} />
          </button>
        )}
        <button className="icon-btn" title="Notifications">
          <Bell size={17} />
        </button>
        <div className="avatar" style={{ background: 'var(--danger)', fontSize: '0.75rem', fontWeight: 700 }}>
          AD
        </div>
      </div>
    </header>
  )
}
