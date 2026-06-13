import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'

/* ── Dark tooltip — used by bar & line charts ────────────────────────────── */
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'oklch(0.13 0 0)',
      border: '1px solid oklch(0.25 0 0)',
      borderTop: '2px solid var(--chart-1)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: '0.8rem',
      boxShadow: '0 8px 24px oklch(0 0 0 / 0.6)',
    }}>
      {label && <p style={{ color: 'oklch(0.55 0 0)', marginBottom: 6, fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || 'var(--fg)', fontWeight: 600, margin: '2px 0' }}>
          <span style={{ color: 'oklch(0.55 0 0)', fontWeight: 400 }}>{p.name}: </span>
          {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

/* ── Dark tooltip for Pie chart ─────────────────────────────────────────── */
function PieDarkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div style={{
      background: 'oklch(0.13 0 0)',
      border: '1px solid oklch(0.25 0 0)',
      borderTop: `2px solid ${p.payload.fill}`,
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: '0.8rem',
      boxShadow: '0 8px 24px oklch(0 0 0 / 0.6)',
      pointerEvents: 'none',
    }}>
      <p style={{ color: 'var(--fg)', fontWeight: 700, margin: 0 }}>{p.name}</p>
      <p style={{ color: p.payload.fill, fontWeight: 600, margin: '4px 0 0' }}>{p.value.toLocaleString()} students</p>
    </div>
  )
}

export function PlatformComparisonChart({ data }) {
  const platforms = [
    { platform: 'LeetCode',   students: data?.leetcode?.students   ?? 0, solved: data?.leetcode?.solved   ?? 0 },
    { platform: 'Codeforces', students: data?.codeforces?.students ?? 0, solved: data?.codeforces?.solved ?? 0 },
    { platform: 'CodeChef',   students: data?.codechef?.students   ?? 0, solved: data?.codechef?.solved   ?? 0 },
    { platform: 'HackerRank', students: data?.hackerrank?.students ?? 0, solved: data?.hackerrank?.badges ?? data?.hackerrank?.solved ?? 0 },
  ]

  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">Platform Coverage</h3></div>
      <div className="card-body" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={platforms} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="platform" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} cursor={{ fill: 'oklch(1 0 0 / 0.04)' }} />
            <Bar dataKey="students" fill="var(--chart-1)" name="Students" radius={[4,4,0,0]}
              activeBar={{ fill: 'var(--chart-1)', filter: 'brightness(1.15)' }} />
            <Bar dataKey="solved"   fill="var(--chart-2)" name="Solved"   radius={[4,4,0,0]}
              activeBar={{ fill: 'var(--chart-2)', filter: 'brightness(1.15)' }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function BranchDistributionChart({ data }) {
  const COLORS = [
    'var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)',
    'oklch(0.72 0.15 160)','oklch(0.65 0.15 280)',
  ]

  const chartData = Object.entries(data || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)

  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">Students by Branch</h3></div>
      <div className="card-body" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} paddingAngle={2}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieDarkTooltip />} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--fg-muted)' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ActivityTrendChart({ data }) {
  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">Weekly Activity Trend</h3></div>
      <div className="card-body" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={d => d?.slice(5)} tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'oklch(0.4 0 0)', strokeWidth: 1, strokeDasharray: '4 2' }} />
            <Line type="monotone" dataKey="count" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Active Students"
              activeDot={{ r: 4, fill: 'var(--chart-2)', stroke: 'var(--card)', strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
