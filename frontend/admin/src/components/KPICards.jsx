import { Users, ShieldCheck, ShieldOff, Activity, UserPlus, TrendingUp } from 'lucide-react'

function StatCard({ icon, value, label, sub, accentColor, trend }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: `${accentColor}18` }}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`trend-badge ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
            <TrendingUp size={11} />{trend > 0 ? '+' : ''}{trend}
          </div>
        )}
      </div>
      <div>
        <p className="kpi-value">{value ?? '—'}</p>
        <p className="kpi-label">{label}</p>
        {sub && <p className="kpi-sub">{sub}</p>}
      </div>
    </div>
  )
}

export default function KPICards({ stats }) {
  const total       = stats?.total       ?? 0
  const verified    = stats?.verified    ?? 0
  const blocked     = stats?.blocked     ?? 0
  const active7d    = stats?.active7d    ?? 0
  const newThisWeek = stats?.newThisWeek ?? 0

  return (
    <div className="kpi-grid">
      <StatCard
        icon={<Users size={16} style={{ color: 'var(--primary)' }} />}
        value={total.toLocaleString()}
        label="Total Students"
        sub={`${verified} verified`}
        accentColor="oklch(0.70 0.15 200)"
        trend={newThisWeek}
      />
      <StatCard
        icon={<ShieldCheck size={16} style={{ color: 'var(--success)' }} />}
        value={verified.toLocaleString()}
        label="Verified"
        sub={`${Math.round((verified / (total || 1)) * 100)}% of total`}
        accentColor="oklch(0.72 0.19 145)"
      />
      <StatCard
        icon={<Activity size={16} style={{ color: 'var(--warning)' }} />}
        value={active7d.toLocaleString()}
        label="Active This Week"
        sub="Had data synced in 7d"
        accentColor="oklch(0.80 0.15 85)"
      />
      <StatCard
        icon={<UserPlus size={16} style={{ color: 'var(--chart-1)' }} />}
        value={newThisWeek.toLocaleString()}
        label="Joined This Week"
        sub={`${stats?.newThisMonth ?? 0} this month`}
        accentColor="oklch(0.70 0.15 200)"
      />
      <StatCard
        icon={<ShieldOff size={16} style={{ color: 'var(--danger)' }} />}
        value={blocked.toLocaleString()}
        label="Blocked"
        sub="Hidden from leaderboard"
        accentColor="oklch(0.65 0.2 25)"
      />
    </div>
  )
}
