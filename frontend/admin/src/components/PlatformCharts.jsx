import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.8rem'
    }}>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

export function PlatformComparisonChart({ data }) {
  // data: [{ platform, students, solved }]
  const platforms = [
    { platform: 'LeetCode',   students: data?.leetcode?.students   ?? 0, solved: data?.leetcode?.solved   ?? 0 },
    { platform: 'Codeforces', students: data?.codeforces?.students ?? 0, solved: data?.codeforces?.solved ?? 0 },
    { platform: 'CodeChef',   students: data?.codechef?.students   ?? 0, solved: data?.codechef?.solved   ?? 0 },
    { platform: 'HackerRank', students: data?.hackerrank?.students ?? 0, solved: data?.hackerrank?.solved ?? 0 },
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
            <Tooltip content={<DarkTooltip />} />
            <Bar dataKey="students" fill="var(--chart-1)" name="Students" radius={[4,4,0,0]} />
            <Bar dataKey="solved"   fill="var(--chart-2)" name="Solved"   radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function BranchDistributionChart({ data }) {
  const COLORS = ['var(--chart-1)','var(--chart-2)','var(--chart-3)','var(--chart-4)','var(--chart-5)',
    'oklch(0.72 0.15 160)','oklch(0.65 0.15 280)']

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
            <Tooltip formatter={(val, name) => [val, name]} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: 'var(--fg-muted)' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function ActivityTrendChart({ data }) {
  // data: [{ date, count }]
  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">Weekly Activity Trend</h3></div>
      <div className="card-body" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={d => d?.slice(5)} tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<DarkTooltip />} />
            <Line type="monotone" dataKey="count" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Active Students" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
