// frontend/student/src/components/RatingChart.jsx
// Premium trading-style rating chart shared across all platforms.
// Props:
//   points  — array of { date (ms|Date|string), rating, label, meta:{} }
//   platform — 'codeforces' | 'codechef' | 'leetcode'
//   height   — number, default 260
import { useState, useMemo, useCallback, useRef } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Dot
} from 'recharts'
import './RatingChart.css'

// ── Palette per platform ─────────────────────────────────────────────────────
const PLATFORM_COLORS = {
  codeforces: { line: '#1a8cff', grad0: 'rgba(26,140,255,0.35)', grad1: 'rgba(26,140,255,0)' },
  codechef:   { line: '#f89f1b', grad0: 'rgba(248,159,27,0.35)',  grad1: 'rgba(248,159,27,0)' },
  leetcode:   { line: '#22c55e', grad0: 'rgba(34,197,94,0.35)',   grad1: 'rgba(34,197,94,0)' },
}

// ── Time range buttons ───────────────────────────────────────────────────────
const RANGES = [
  { label: '1M',  months: 1   },
  { label: '3M',  months: 3   },
  { label: '6M',  months: 6   },
  { label: '1Y',  months: 12  },
  { label: 'All', months: null },
]

function formatAxisDate(ms) {
  const d = new Date(ms)
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function formatFullDate(ms) {
  const d = new Date(ms)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload }) {
  if (!active || !payload?.[0]) return null
  const p  = payload[0].payload
  const up = (p.ratingChange ?? 0) >= 0
  const col = up ? '#22c55e' : '#ef4444'

  return (
    <div className="rc-tooltip">
      <div className="rc-tt-header">
        <span className="rc-tt-name">{p.label || p.contestName || 'Contest'}</span>
        {p.date && <span className="rc-tt-date">{formatFullDate(p.date)}</span>}
      </div>

      <div className="rc-tt-rating">
        <span className="rc-tt-rating-val">{Math.round(p.rating)}</span>
        {p.ratingChange != null && (
          <span className="rc-tt-delta" style={{ color: col }}>
            {up ? '▲' : '▼'} {Math.abs(Math.round(p.ratingChange))}
          </span>
        )}
      </div>

      <div className="rc-tt-grid">
        {p.ratingBefore != null && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Rating Before</span>
            <span className="rc-tt-v">{Math.round(p.ratingBefore)}</span>
          </div>
        )}
        {p.rank != null && p.rank > 0 && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Rank</span>
            <span className="rc-tt-v">#{p.rank.toLocaleString()}</span>
          </div>
        )}
        {p.division && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Division</span>
            <span className="rc-tt-v" style={{ color:'#1a8cff' }}>{p.division}</span>
          </div>
        )}
        {p.problemsSolved != null && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Problems Solved</span>
            <span className="rc-tt-v">{p.problemsSolved}</span>
          </div>
        )}
        {p.stars != null && p.stars > 0 && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Stars</span>
            <span className="rc-tt-v" style={{ color:'#f89f1b' }}>{'★'.repeat(p.stars)}</span>
          </div>
        )}
        {p.contestType && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Type</span>
            <span className="rc-tt-v">{p.contestType}</span>
          </div>
        )}
        {p.finishTime != null && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Finish Time</span>
            <span className="rc-tt-v">{p.finishTime}</span>
          </div>
        )}
        {p.totalFinished != null && (
          <div className="rc-tt-row">
            <span className="rc-tt-k">Total Finishers</span>
            <span className="rc-tt-v">{p.totalFinished?.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Custom dot on hover ──────────────────────────────────────────────────────
function ActiveDot({ cx, cy, fill }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={8}  fill={fill} opacity={0.2} />
      <circle cx={cx} cy={cy} r={4}  fill={fill} stroke="#fff" strokeWidth={2} />
    </g>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function RatingChart({ points = [], platform = 'codeforces', height = 260 }) {
  const [range, setRange]         = useState('All')
  const [crosshair, setCrosshair] = useState(null)
  const colors = PLATFORM_COLORS[platform] || PLATFORM_COLORS.codeforces

  // Filter by selected time range
  const filtered = useMemo(() => {
    if (!points.length) return []
    const rangeInfo = RANGES.find(r => r.label === range)
    if (!rangeInfo?.months) return points
    const cutoff = Date.now() - rangeInfo.months * 30 * 24 * 3600 * 1000
    const f = points.filter(p => p.date >= cutoff)
    return f.length >= 2 ? f : points.slice(-Math.max(2, Math.ceil(points.length * 0.2)))
  }, [points, range])

  // Min/max for domain with padding
  const { minR, maxR, minDate, maxDate } = useMemo(() => {
    if (!filtered.length) return { minR: 0, maxR: 100, minDate: 0, maxDate: Date.now() }
    const ratings = filtered.map(p => p.rating)
    const lo = Math.min(...ratings)
    const hi = Math.max(...ratings)
    const pad = Math.max((hi - lo) * 0.15, 30)
    const dates = filtered.map(p => p.date)
    return {
      minR:    Math.max(0, Math.floor(lo - pad)),
      maxR:    Math.ceil(hi + pad),
      minDate: Math.min(...dates),
      maxDate: Math.max(...dates),
    }
  }, [filtered])

  // Last point for header display
  const last   = filtered[filtered.length - 1]
  const first  = filtered[0]
  const delta  = last && first ? last.rating - first.rating : 0
  const isUp   = delta >= 0

  if (!points.length) {
    return (
      <div className="rc-empty">
        <span>📈</span>
        <p>No contest history yet</p>
      </div>
    )
  }

  return (
    <div className="rc-root">
      {/* ── Header ── */}
      <div className="rc-header">
        <div className="rc-header-left">
          {last && (
            <>
              <span className="rc-current-rating">{Math.round(last.rating)}</span>
              <span className="rc-delta" style={{ color: isUp ? '#22c55e' : '#ef4444' }}>
                {isUp ? '▲' : '▼'} {Math.abs(Math.round(delta))}
                <span className="rc-delta-pct">
                  {first?.rating ? ` (${((delta/first.rating)*100).toFixed(1)}%)` : ''}
                </span>
                <span className="rc-delta-label"> over selected period</span>
              </span>
            </>
          )}
        </div>

        {/* ── Range selector ── */}
        <div className="rc-ranges">
          {RANGES.map(r => (
            <button
              key={r.label}
              className={`rc-range-btn${range === r.label ? ' active' : ''}`}
              onClick={() => setRange(r.label)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="rc-chart-wrap" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={filtered}
            margin={{ top: 10, right: 16, bottom: 0, left: 0 }}
            onMouseLeave={() => setCrosshair(null)}
          >
            <defs>
              <linearGradient id={`rc-grad-${platform}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={colors.grad0} />
                <stop offset="100%" stopColor={colors.grad1} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              type="number"
              domain={[minDate, maxDate]}
              scale="time"
              tickFormatter={formatAxisDate}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickCount={6}
              padding={{ left: 0, right: 8 }}
            />
            <YAxis
              domain={[minR, maxR]}
              tick={{ fill: 'var(--fg-muted)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickCount={5}
            />

            {/* Crosshair reference line */}
            {crosshair && (
              <ReferenceLine x={crosshair} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            )}

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
            />

            <Area
              type="monotone"
              dataKey="rating"
              stroke={colors.line}
              strokeWidth={2.5}
              fill={`url(#rc-grad-${platform})`}
              activeDot={<ActiveDot fill={colors.line} />}
              dot={filtered.length <= 20
                ? { r: 3, fill: colors.line, stroke: 'var(--surface)', strokeWidth: 1.5 }
                : false
              }
              isAnimationActive={true}
              animationDuration={600}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ── Footer legend ── */}
      <div className="rc-footer">
        <div className="rc-legend">
          <span className="rc-legend-dot" style={{ background: colors.line }} />
          <span>{filtered.length} contest{filtered.length !== 1 ? 's' : ''} shown</span>
        </div>
        {last?.date && (
          <span className="rc-last-update">
            Latest: {formatFullDate(last.date)}
          </span>
        )}
      </div>
    </div>
  )
}
