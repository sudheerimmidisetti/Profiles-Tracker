// WeeklyLeaderboard.jsx — clean SaaS-style weekly contest leaderboard
import { useState, useEffect } from 'react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

function currentWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString().slice(0, 10)
}

function recentWeeks() {
  const weeks = []
  const base = new Date(currentWeekStart())
  for (let i = 0; i < 8; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() - i * 7)
    weeks.push(d.toISOString().slice(0, 10))
  }
  return weeks
}

function fmtWeekRange(w) {
  const start = new Date(w)
  const end   = new Date(w); end.setDate(start.getDate() + 6)
  const opts   = { day: 'numeric', month: 'short' }
  return `${start.toLocaleDateString('en-IN', opts)} – ${end.toLocaleDateString('en-IN', opts)}`
}

function RankBadge({ rank }) {
  const medals = ['🥇', '🥈', '🥉']
  if (rank <= 3) {
    return <span style={{ fontSize: 20 }}>{medals[rank - 1]}</span>
  }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(255,255,255,0.06)', color: 'var(--fg-muted)',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>{rank}</div>
  )
}

function PlatformScore({ label, value, color }) {
  const attended = value > 0
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginBottom: 3, fontWeight: 500 }}>
        {label}
      </div>
      <div style={{
        fontSize: 15, fontWeight: 700,
        color: attended ? color : 'rgba(255,255,255,0.15)',
      }}>
        {attended ? value.toFixed(1) : '—'}
      </div>
    </div>
  )
}

function WeeklyRow({ row, rank }) {
  const [showTip, setShowTip] = useState(false)

  const composite = row.composite ?? 0
  const barWidth  = `${Math.min(100, composite)}%`

  return (
    <div
      className="lb-row"
      style={{ gap: 14, cursor: 'pointer' }}
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      {/* Rank */}
      <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <RankBadge rank={rank} />
      </div>

      {/* Identity */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.full_name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 1 }}>
          {row.roll_number}{row.branch ? ` · ${row.branch}` : ''}
        </div>
        {/* Composite bar */}
        <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.07)', marginTop: 6, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 99, width: barWidth,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Per-platform scores */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        <PlatformScore label="LC"  value={row.lcScore ?? 0}  color="#fbbf24" />
        <PlatformScore label="CC"  value={row.ccScore ?? 0}  color="#34d399" />
        <PlatformScore label="CF"  value={row.cfScore ?? 0}  color="#60a5fa" />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />

      {/* Composite + eligibility */}
      <div style={{ textAlign: 'right', minWidth: 72 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#a5b4fc', lineHeight: 1 }}>
          {composite.toFixed(1)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 2 }}>
          {row.eligible
            ? <span style={{ color: '#4ade80', fontWeight: 600 }}>✓ Award</span>
            : <span style={{ color: 'rgba(255,255,255,0.25)' }}>{row.platformsAttended}/3 plat.</span>
          }
        </div>
      </div>

      {/* Tooltip */}
      {showTip && (
        <div className="lb-tooltip" style={{ minWidth: 240 }}>
          <div className="lb-tooltip-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Weekly Breakdown</span>
            <span style={{ color: '#a5b4fc' }}>{composite.toFixed(2)}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', fontSize: 12 }}>
            <span style={{ color: 'var(--fg-muted)' }}>LeetCode (×0.35)</span>
            <span style={{ color: (row.lcScore ?? 0) > 0 ? '#fbbf24' : 'rgba(255,255,255,0.25)', textAlign:'right', fontWeight: 600 }}>
              {(row.lcScore ?? 0) > 0 ? (row.lcScore ?? 0).toFixed(2) : 'DNS'}
            </span>
            <span style={{ color: 'var(--fg-muted)' }}>CodeChef (×0.30)</span>
            <span style={{ color: (row.ccScore ?? 0) > 0 ? '#34d399' : 'rgba(255,255,255,0.25)', textAlign:'right', fontWeight: 600 }}>
              {(row.ccScore ?? 0) > 0 ? (row.ccScore ?? 0).toFixed(2) : 'DNS'}
            </span>
            <span style={{ color: 'var(--fg-muted)' }}>Codeforces (×0.35)</span>
            <span style={{ color: (row.cfScore ?? 0) > 0 ? '#60a5fa' : 'rgba(255,255,255,0.25)', textAlign:'right', fontWeight: 600 }}>
              {(row.cfScore ?? 0) > 0 ? (row.cfScore ?? 0).toFixed(2) : 'DNS'}
            </span>
          </div>

          <div style={{
            marginTop: 10, paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.07)',
            display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', fontSize: 12
          }}>
            <span style={{ color: 'var(--fg-muted)' }}>Platforms attended</span>
            <span style={{ textAlign:'right', fontWeight:600 }}>{row.platformsAttended} / 3</span>
            <span style={{ color: 'var(--fg-muted)' }}>Award eligible?</span>
            <span style={{ color: row.eligible ? '#4ade80' : '#f87171', textAlign:'right', fontWeight:600 }}>
              {row.eligible ? 'Yes' : 'No (need ≥2)'}
            </span>
          </div>

          {row.lc_handle && (
            <div style={{
              marginTop: 10, paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              display: 'flex', gap: 8, flexWrap: 'wrap'
            }}>
              {row.lc_handle && <span className="lb-handle lb-plat-lc">LC: {row.lc_handle}</span>}
              {row.cc_handle && <span className="lb-handle lb-plat-cc">CC: {row.cc_handle}</span>}
              {row.cf_handle && <span className="lb-handle lb-plat-cf">CF: {row.cf_handle}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function WeeklyHeader({ week }) {
  const thisWeek = currentWeekStart()
  const isNow    = week === thisWeek
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px', borderRadius: 8, marginBottom: 16,
      background: 'rgba(99,102,241,0.07)',
      border: '1px solid rgba(99,102,241,0.18)',
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: isNow ? '#4ade80' : '#6366f1', flexShrink: 0 }} />
      <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>
        {isNow ? <strong style={{ color: 'var(--fg)' }}>Live week</strong> : 'Past week'} ·{' '}
        <strong style={{ color: 'var(--fg)' }}>{fmtWeekRange(week)}</strong>
      </div>
      <div style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
        Proxy scoring · 0.35×LC + 0.30×CC + 0.35×CF
      </div>
    </div>
  )
}

export default function WeeklyLeaderboard() {
  const weeks          = recentWeeks()
  const [selWeek, setSelWeek] = useState(weeks[0])
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.weekly(selWeek, page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [selWeek, page])

  const rows  = data?.data  || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 50)

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚡ Weekly Performers
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 3 }}>
            Contest performance only · Award requires ≥ 2 platforms
          </div>
        </div>

        {/* Week selector */}
        <select
          value={selWeek}
          onChange={e => { setSelWeek(e.target.value); setPage(1) }}
          style={{
            padding: '7px 12px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'var(--fg)', fontSize: 13, cursor: 'pointer',
          }}
        >
          {weeks.map((w, i) => (
            <option key={w} value={w}>
              {i === 0 ? `This week · ${fmtWeekRange(w)}` : fmtWeekRange(w)}
            </option>
          ))}
        </select>
      </div>

      {/* Week context bar */}
      <WeeklyHeader week={selWeek} />

      {/* Column labels */}
      {!loading && rows.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '46px 1fr 180px 1px 80px',
          gap: 14, paddingBottom: 8,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          marginBottom: 8,
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign:'center' }}>#</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>STUDENT</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', display:'flex', justifyContent:'space-around' }}>
            <span>LC</span><span>CC</span><span>CF</span>
          </div>
          <div />
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', textAlign:'right' }}>SCORE</div>
        </div>
      )}

      {/* Rows */}
      {loading ? (
        <div className="lb-loading"><div className="spinner" /> Loading…</div>
      ) : error ? (
        <div className="lb-error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty" style={{ padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>No contest data this week</div>
          <div style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
            Contest results appear after profiles are synced post-contest.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rows.map((row, i) => (
            <WeeklyRow key={row.email} row={row} rank={(page - 1) * 50 + i + 1} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="lb-pagination">
          <button className="lb-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
          <span className="lb-page-info">{page} / {pages}</span>
          <button className="lb-page-btn" onClick={() => setPage(p => p + 1)} disabled={page === pages}>›</button>
        </div>
      )}
    </div>
  )
}
