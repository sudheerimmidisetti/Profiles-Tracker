import { Users, Code, Activity, Target, TrendingUp, TrendingDown } from 'lucide-react'

function StatCard({ title, value, sub, trend, icon, chips, progress }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon">{icon}</div>
        {trend !== undefined && (
          <div className={`trend-badge ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
            {trend >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="kpi-value">{value ?? '—'}</p>
        <p className="kpi-label">{title}</p>
        {sub && <p className="kpi-sub">{sub}</p>}
      </div>
      {chips && (
        <div className="kpi-chips">
          {chips.map((c, i) => (
            <span key={i} className="kpi-chip">{c.label} <b>{c.value}</b></span>
          ))}
        </div>
      )}
      {progress !== undefined && (
        <div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="kpi-sub" style={{ marginTop: 4, textAlign: 'right' }}>{progress}%</p>
        </div>
      )}
    </div>
  )
}

export default function KPICards({ data }) {
  const lc = data?.platforms?.leetcode
  const cf = data?.platforms?.codeforces
  const cc = data?.platforms?.codechef
  const hr = data?.platforms?.hackerrank

  const totalSolved = data?.aggregate?.totalSolved

  return (
    <div className="kpi-grid">
      <StatCard
        title="Total Problems Solved"
        value={totalSolved?.toLocaleString() ?? '—'}
        sub="Across all platforms"
        icon={<Code size={20} style={{ color: 'var(--chart-2)' }} />}
        chips={[
          { label: 'LC', value: lc?.total_solved ?? '—' },
          { label: 'CF', value: cf?.total_solved ?? '—' },
          { label: 'CC', value: cc?.total_solved ?? '—' },
        ]}
      />
      <StatCard
        title="LeetCode Rating"
        value={lc?.contest_rating ? Math.round(lc.contest_rating) : lc?.current_rating ? Math.round(lc.current_rating) : '—'}
        sub={lc?.top_percentage ? `Top ${lc.top_percentage.toFixed(1)}%` : lc?.username ? `@${lc.username}` : 'Not linked'}
        trend={lc ? 4 : undefined}
        icon={<Target size={20} style={{ color: 'var(--lc)' }} />}
      />
      <StatCard
        title="Codeforces Rating"
        value={cf?.current_rating ?? '—'}
        sub={cf?.username ? `@${cf.username}` : 'Not linked'}
        trend={cf ? 2 : undefined}
        icon={<Activity size={20} style={{ color: 'var(--cf)' }} />}
      />
      <StatCard
        title="Global Rank"
        value={lc?.global_rank ? `#${lc.global_rank.toLocaleString()}` : '—'}
        sub="LeetCode global"
        icon={<Users size={20} style={{ color: 'var(--chart-5)' }} />}
      />
    </div>
  )
}
