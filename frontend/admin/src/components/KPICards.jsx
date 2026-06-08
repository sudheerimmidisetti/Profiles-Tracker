import { Users, ShieldCheck, ShieldOff, Activity, TrendingUp } from 'lucide-react'

function StatCard({ icon, value, label, sub, accentColor, trend }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: `${accentColor}18` }}>
          {icon}
        </div>
        {trend !== undefined && (
          <div className={`trend-badge ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
            <TrendingUp size={11} />{trend}%
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
  const total      = stats?.total      ?? 0
  const verified   = stats?.verified   ?? 0
  const blocked    = stats?.blocked    ?? 0
  const active     = stats?.activeWeek ?? 0

  return (
    <div className="kpi-grid">
      <StatCard
        label="Total Students"
        value={total.toLocaleString()}
        sub="Registered in the system"
        accentColor="var(--chart-1)"
        icon={<Users size={20} style={{ color: 'var(--chart-1)' }} />}
      />
      <StatCard
        label="Verified Handles"
        value={verified.toLocaleString()}
        sub={`${total ? Math.round(verified / total * 100) : 0}% of total`}
        accentColor="var(--success)"
        trend={8}
        icon={<ShieldCheck size={20} style={{ color: 'var(--success)' }} />}
      />
      <StatCard
        label="Active This Week"
        value={active.toLocaleString()}
        sub="At least 1 submission"
        accentColor="var(--chart-3)"
        trend={3}
        icon={<Activity size={20} style={{ color: 'var(--chart-3)' }} />}
      />
      <StatCard
        label="Blocklisted"
        value={blocked.toLocaleString()}
        sub="Excluded from leaderboard"
        accentColor="var(--danger)"
        icon={<ShieldOff size={20} style={{ color: 'var(--danger)' }} />}
      />
    </div>
  )
}
