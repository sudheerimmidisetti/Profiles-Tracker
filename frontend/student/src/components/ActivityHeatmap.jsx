import { useMemo } from 'react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function ActivityHeatmap({ calendarJson }) {
  const cells = useMemo(() => {
    // calendarJson is LeetCode format: { "timestamp": "count", ... }
    // Build 53 weeks × 7 days grid
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - 371) // ~53 weeks back
    // align to Sunday
    start.setDate(start.getDate() - start.getDay())

    const counts = {}
    if (calendarJson) {
      try {
        const parsed = typeof calendarJson === 'string' ? JSON.parse(calendarJson) : calendarJson
        Object.entries(parsed).forEach(([ts, cnt]) => {
          const d = new Date(parseInt(ts, 10) * 1000)
          counts[d.toDateString()] = parseInt(cnt, 10) || 0
        })
      } catch (_) {}
    }

    const grid = []
    const d = new Date(start)
    for (let w = 0; w < 53; w++) {
      for (let day = 0; day < 7; day++) {
        const key = d.toDateString()
        const cnt = counts[key] || 0
        grid.push({
          key,
          level: cnt === 0 ? 0 : cnt <= 2 ? 1 : cnt <= 5 ? 2 : cnt <= 9 ? 3 : 4,
          count: cnt,
          date: new Date(d),
        })
        d.setDate(d.getDate() + 1)
      }
    }
    return grid
  }, [calendarJson])

  // Month labels
  const monthLabels = useMemo(() => {
    const labels = []
    cells.forEach((cell, i) => {
      if (i % 7 === 0 && cell.date.getDate() <= 7) {
        labels.push({ month: MONTHS[cell.date.getMonth()], col: Math.floor(i / 7) })
      }
    })
    return labels
  }, [cells])

  const weeks = useMemo(() => {
    const w = []
    for (let i = 0; i < cells.length; i += 7) w.push(cells.slice(i, i + 7))
    return w
  }, [cells])

  const totalActive = cells.filter(c => c.level > 0).length

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Submission Activity</h3>
        <span className="badge badge-green">{totalActive} active days</span>
      </div>
      <div className="card-body">
        <div className="heatmap-wrap">
          {/* Month labels */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 4, paddingLeft: 0, width: 'max-content' }}>
            {weeks.map((week, wi) => {
              const monthLabel = monthLabels.find(m => m.col === wi)
              return (
                <div key={wi} style={{ width: 15, fontSize: '0.6rem', color: 'var(--fg-subtle)' }}>
                  {monthLabel?.month || ''}
                </div>
              )
            })}
          </div>
          {/* Grid */}
          <div style={{ display: 'flex', gap: 3 }}>
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((cell, di) => (
                  <div
                    key={`${wi}-${di}`}
                    className={`hm-cell hm-${cell.level}`}
                    title={`${cell.date.toDateString()}: ${cell.count} submission${cell.count !== 1 ? 's' : ''}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--fg-subtle)' }}>Less</span>
          {[0, 1, 2, 3, 4].map(l => (
            <div key={l} className={`hm-cell hm-${l}`} />
          ))}
          <span style={{ fontSize: '0.68rem', color: 'var(--fg-subtle)' }}>More</span>
        </div>
      </div>
    </div>
  )
}
