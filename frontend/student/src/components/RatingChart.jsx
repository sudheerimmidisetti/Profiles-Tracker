import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from 'recharts'

const COLORS = {
  leetcode:   'var(--lc)',
  codeforces: 'var(--cf)',
  codechef:   'var(--cc)',
  hackerrank: 'var(--hr)',
}

function CustomTooltip({ active, payload, label }) {
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

export function RatingChart({ data }) {
  // data shape: { leetcode: [{date, rating}], codeforces: [...], ... }
  const platforms = Object.keys(data || {}).filter(p => data[p]?.length)

  if (!platforms.length) {
    return (
      <div className="empty-state" style={{ minHeight: 200 }}>
        <p className="empty-title">No rating history yet</p>
        <p className="empty-desc">Data will appear after the first nightly sync.</p>
      </div>
    )
  }

  // Merge all dates
  const dateMap = {}
  platforms.forEach(p => {
    data[p].forEach(entry => {
      const d = entry.date?.slice(0, 10)
      if (!dateMap[d]) dateMap[d] = { date: d }
      dateMap[d][p] = entry.rating
    })
  })

  const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Rating Over Time</h3>
        <div className="flex gap-2">
          {platforms.map(p => (
            <span key={p} className="badge badge-gray" style={{ color: COLORS[p] }}>
              ● {p.charAt(0).toUpperCase() + p.slice(1, 2).toUpperCase()}
            </span>
          ))}
        </div>
      </div>
      <div className="card-body chart-container" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={d => d?.slice(5)}
              tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }}
              axisLine={false} tickLine={false}
            />
            <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {platforms.map(p => (
              <Line
                key={p} type="monotone" dataKey={p}
                stroke={COLORS[p]} strokeWidth={2} dot={false}
                name={p.charAt(0).toUpperCase() + p.slice(1)}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function SolvedChart({ data }) {
  const platforms = Object.keys(data || {}).filter(p => data[p]?.length)

  if (!platforms.length) {
    return (
      <div className="empty-state" style={{ minHeight: 200 }}>
        <p className="empty-title">No solve history yet</p>
      </div>
    )
  }

  const dateMap = {}
  platforms.forEach(p => {
    data[p].forEach(entry => {
      const d = entry.date?.slice(0, 7) // YYYY-MM
      if (!dateMap[d]) dateMap[d] = { date: d }
      if (!dateMap[d][p] || entry.totalSolved > dateMap[d][p]) {
        dateMap[d][p] = entry.totalSolved
      }
    })
  })

  const chartData = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Problems Solved (Monthly)</h3>
      </div>
      <div className="card-body chart-container" style={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {platforms.map(p => (
              <Bar key={p} dataKey={p} fill={COLORS[p]} radius={[3, 3, 0, 0]} name={p} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
