// WeeklyLeaderboard.jsx
import { useState, useEffect } from 'react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

function currentWeekStart() {
  const now = new Date()
  const d   = now.getDay()
  const mon = new Date(now)
  mon.setDate(now.getDate() - (d === 0 ? 6 : d - 1))
  mon.setHours(0, 0, 0, 0)
  return mon.toISOString().slice(0, 10)
}

function recentWeeks() {
  const base = new Date(currentWeekStart())
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() - i * 7)
    return d.toISOString().slice(0, 10)
  })
}

function fmtRange(w) {
  const s = new Date(w)
  const e = new Date(w); e.setDate(s.getDate() + 6)
  const o = { day: 'numeric', month: 'short' }
  return `${s.toLocaleDateString('en-IN', o)} – ${e.toLocaleDateString('en-IN', o)}`
}

function RankCell({ rank }) {
  if (rank <= 3) return <span style={{ fontSize: 18, lineHeight: 1 }}>{['🥇','🥈','🥉'][rank - 1]}</span>
  return <div className="rank-badge rank-n" style={{ width: 26, height: 26, fontSize: '0.72rem' }}>{rank}</div>
}

function PlatScore({ val, color }) {
  const has = val > 0
  return (
    <div style={{ textAlign: 'center', width: 52 }}>
      <div style={{
        fontSize: '0.95rem',
        fontWeight: 700,
        color: has ? color : 'var(--fg-subtle)',
        lineHeight: 1,
      }}>
        {has ? val.toFixed(1) : '—'}
      </div>
    </div>
  )
}

function WeekRow({ row, rank }) {
  const [tip, setTip] = useState(false)
  const composite = row.composite ?? 0

  return (
    <div
      className="lb-row"
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
    >
      {/* Rank */}
      <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
        <RankCell rank={rank} />
      </div>

      {/* Identity + bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.full_name}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 1 }}>
          {row.roll_number}
          {row.branch ? <span style={{ color: 'var(--fg-subtle)' }}> · {row.branch}</span> : null}
        </div>
        {/* Progress bar — composite score */}
        <div className="lb-bar-track" style={{ marginTop: 6, width: '100%' }}>
          <div className="lb-bar-fill cf" style={{ width: `${Math.min(100, composite)}%` }} />
        </div>
      </div>

      {/* Platform scores */}
      <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
        <PlatScore val={row.lcScore ?? 0} color="var(--lc)" />
        <PlatScore val={row.ccScore ?? 0} color="var(--cc)" />
        <PlatScore val={row.cfScore ?? 0} color="var(--cf)" />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Composite + eligibility */}
      <div className="lb-score-cell">
        <div className="lb-score-num">{composite.toFixed(1)}</div>
        <div className="lb-score-denom">/ 100</div>
        <div style={{ marginTop: 3, textAlign: 'right' }}>
          {row.eligible
            ? <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Award</span>
            : <span style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)' }}>{row.platformsAttended}/3</span>
          }
        </div>
      </div>

      {/* Tooltip */}
      {tip && (
        <div className="lb-tip">
          <div className="lb-tip-title">Weekly breakdown</div>
          <div className="lb-tip-row">
            <span>LeetCode <span style={{ color: 'var(--fg-subtle)', fontSize: '0.68rem' }}>×0.35</span></span>
            <span style={{ color: (row.lcScore ?? 0) > 0 ? 'var(--lc)' : 'var(--fg-subtle)' }}>
              {(row.lcScore ?? 0) > 0 ? (row.lcScore).toFixed(2) : 'DNS'}
            </span>
          </div>
          <div className="lb-tip-row">
            <span>CodeChef <span style={{ color: 'var(--fg-subtle)', fontSize: '0.68rem' }}>×0.30</span></span>
            <span style={{ color: (row.ccScore ?? 0) > 0 ? 'var(--cc)' : 'var(--fg-subtle)' }}>
              {(row.ccScore ?? 0) > 0 ? (row.ccScore).toFixed(2) : 'DNS'}
            </span>
          </div>
          <div className="lb-tip-row">
            <span>Codeforces <span style={{ color: 'var(--fg-subtle)', fontSize: '0.68rem' }}>×0.35</span></span>
            <span style={{ color: (row.cfScore ?? 0) > 0 ? 'var(--cf)' : 'var(--fg-subtle)' }}>
              {(row.cfScore ?? 0) > 0 ? (row.cfScore).toFixed(2) : 'DNS'}
            </span>
          </div>
          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span>Platforms</span>
            <span>{row.platformsAttended} / 3</span>
          </div>
          <div className="lb-tip-row">
            <span>Eligible</span>
            <span style={{ color: row.eligible ? 'var(--success)' : 'var(--fg-subtle)' }}>
              {row.eligible ? 'Yes' : 'No — need ≥ 2'}
            </span>
          </div>
          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span style={{ fontWeight: 700 }}>Composite</span>
            <span style={{ fontWeight: 700 }}>{composite.toFixed(2)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WeeklyLeaderboard() {
  const weeks  = recentWeeks()
  const thisWk = weeks[0]
  const [selWk,   setSelWk]   = useState(thisWk)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.weekly(selWk, page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [selWk, page])

  const rows  = data?.data  || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 50)
  const isLive = selWk === thisWk

  return (
    <div className="card">
      {/* Header */}
      <div className="lb-card-header">
        <div>
          <div className="lb-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isLive && <div className="lb-live-dot" />}
            Weekly Performers
          </div>
          <div className="lb-card-sub">Contest performance only · Award requires ≥ 2 platforms</div>
        </div>

        {/* Week picker */}
        <select
          className="lb-select"
          value={selWk}
          onChange={e => { setSelWk(e.target.value); setPage(1) }}
        >
          {weeks.map((w, i) => (
            <option key={w} value={w}>
              {i === 0 ? `This week · ${fmtRange(w)}` : fmtRange(w)}
            </option>
          ))}
        </select>
      </div>

      {/* Context bar */}
      <div className="lb-context-bar">
        <span>{fmtRange(selWk)}</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>0.35 × LC + 0.30 × CC + 0.35 × CF</span>
        {isLive && <>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ color: 'var(--success)', fontWeight: 600 }}>Live</span>
        </>}
      </div>

      {/* Column labels */}
      {!loading && rows.length > 0 && (
        <div className="lb-col-header" style={{ gap: 0 }}>
          <div style={{ width: 28 }}>#</div>
          <div style={{ flex: 1, paddingLeft: 12 }}>Student</div>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ width: 52, textAlign: 'center' }}>LC</div>
            <div style={{ width: 52, textAlign: 'center' }}>CC</div>
            <div style={{ width: 52, textAlign: 'center' }}>CF</div>
          </div>
          <div style={{ width: 1 }} />
          <div style={{ width: 68, textAlign: 'right' }}>Score</div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '6px 0' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading…</div>
        ) : error ? (
          <div className="msg msg-error" style={{ margin: '20px 16px' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No contest data</p>
            <p className="empty-desc">Contest results appear after profiles are synced.</p>
          </div>
        ) : (
          <div className="lb-rows-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <WeekRow key={row.email} row={row} rank={(page - 1) * 50 + i + 1} />
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="lb-pagination">
          <button className="lb-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
          <span className="lb-page-info">Page {page} of {pages}</span>
          <button className="lb-page-btn" onClick={() => setPage(p => p + 1)} disabled={page === pages}>›</button>
        </div>
      )}
    </div>
  )
}
