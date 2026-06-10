// frontend/student/src/components/AnalyticsCharts.jsx
// Simple placeholder charts for the AnalyticsPage.
// These are separate from the premium RatingChart used on platform profiles.
export function RatingChart({ data }) {
  if (!data || !Object.keys(data).length) return null
  const platforms = Object.entries(data)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:20 }}>
      <h3 style={{ fontSize:'0.85rem', color:'var(--fg-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>
        Rating Over Time
      </h3>
      {platforms.map(([platform, entries]) => {
        if (!entries?.length) return null
        const latest = entries[entries.length - 1]
        const first  = entries[0]
        const delta  = (latest.rating || 0) - (first.rating || 0)
        const isUp   = delta >= 0
        return (
          <div key={platform} style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ width:90, fontSize:'0.8rem', color:'var(--fg-muted)', textTransform:'capitalize' }}>
              {platform}
            </span>
            <span style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--fg)' }}>
              {latest.rating || '—'}
            </span>
            <span style={{ fontSize:'0.78rem', fontWeight:600, color: isUp ? '#22c55e' : '#ef4444' }}>
              {isUp ? '▲' : '▼'} {Math.abs(delta)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function SolvedChart({ data }) {
  if (!data || !Object.keys(data).length) return null
  const platforms = Object.entries(data)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16, marginBottom:20 }}>
      <h3 style={{ fontSize:'0.85rem', color:'var(--fg-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>
        Problems Solved
      </h3>
      {platforms.map(([platform, entries]) => {
        if (!entries?.length) return null
        const latest = entries[entries.length - 1]
        return (
          <div key={platform} style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ width:90, fontSize:'0.8rem', color:'var(--fg-muted)', textTransform:'capitalize' }}>
              {platform}
            </span>
            <span style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--fg)' }}>
              {latest.totalSolved || '—'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
