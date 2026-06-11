// WeeklyLeaderboard.jsx
// This week's contest performers only.
// Formula: Weekly = 0.35×LC + 0.30×CC + 0.35×CF (0 if not attended)
// Award eligibility: ≥ 2 platforms attended

import { useState, useEffect } from 'react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

/** Get Monday of the current week as YYYY-MM-DD */
function currentWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1))
  return monday.toISOString().slice(0, 10)
}

/** List of last 8 Monday dates for the week picker */
function recentWeeks() {
  const weeks = []
  const cur = new Date(currentWeekStart())
  for (let i = 0; i < 8; i++) {
    const d = new Date(cur)
    d.setDate(cur.getDate() - i * 7)
    weeks.push(d.toISOString().slice(0, 10))
  }
  return weeks
}

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'lb-rank-1' : rank === 2 ? 'lb-rank-2' : rank === 3 ? 'lb-rank-3' : 'lb-rank-n'
  return <div className={`lb-rank-badge ${cls}`}>{rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}</div>
}

function ScoreBar({ value, max = 100 }) {
  return (
    <div className="lb-score-bar">
      <div className="lb-score-bar-fill score-weekly" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

function WeeklyRow({ row, rank }) {
  const [showTip, setShowTip] = useState(false)

  return (
    <div
      className="lb-row"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <RankBadge rank={rank} />

      <div className="lb-info">
        <div className="lb-name">{row.full_name}</div>
        <div className="lb-sub">{row.roll_number} · {row.branch}</div>
        <div className="lb-handles">
          {row.lc_handle && <span className="lb-handle lb-plat-lc">LC: {row.lc_handle}</span>}
          {row.cc_handle && <span className="lb-handle lb-plat-cc">CC: {row.cc_handle}</span>}
          {row.cf_handle && <span className="lb-handle lb-plat-cf">CF: {row.cf_handle}</span>}
        </div>
      </div>

      {/* Platform scores */}
      <div style={{ display: 'flex', gap: 6 }}>
        <span className="lb-plat-pill lb-plat-lc" title="LeetCode score">
          LC {row.lcScore > 0 ? row.lcScore.toFixed(1) : '—'}
        </span>
        <span className="lb-plat-pill lb-plat-cc" title="CodeChef score">
          CC {row.ccScore > 0 ? row.ccScore.toFixed(1) : '—'}
        </span>
        <span className="lb-plat-pill lb-plat-cf" title="Codeforces score">
          CF {row.cfScore > 0 ? row.cfScore.toFixed(1) : '—'}
        </span>
      </div>

      {/* Eligible badge */}
      <span className={row.eligible ? 'lb-eligible' : 'lb-ineligible'}>
        {row.eligible ? '✓ Eligible' : `${row.platformsAttended}/3 platforms`}
      </span>

      {/* Composite score */}
      <div className="lb-score-section">
        <div className="lb-score-value" style={{ color: '#a5b4fc' }}>{(row.composite ?? 0).toFixed(1)}</div>
        <div className="lb-score-label">/ 100</div>
        <ScoreBar value={row.composite ?? 0} />
      </div>

      {/* Tooltip */}
      {showTip && (
        <div className="lb-tooltip">
          <div className="lb-tooltip-title">Weekly Score Details</div>
          <div className="lb-tooltip-row"><span>LeetCode (×0.35)</span><span>{(row.lcScore ?? 0).toFixed(2)}</span></div>
          <div className="lb-tooltip-row"><span>CodeChef (×0.30)</span><span>{(row.ccScore ?? 0).toFixed(2)}</span></div>
          <div className="lb-tooltip-row"><span>Codeforces (×0.35)</span><span>{(row.cfScore ?? 0).toFixed(2)}</span></div>
          <div className="lb-tooltip-section">
            <div className="lb-tooltip-row" style={{ fontWeight:700 }}>
              <span>Composite</span><span>{(row.composite ?? 0).toFixed(2)}</span>
            </div>
            <div className="lb-tooltip-row">
              <span>Platforms attended</span><span>{row.platformsAttended}/3</span>
            </div>
            <div className="lb-tooltip-row">
              <span>Award eligible?</span>
              <span style={{ color: row.eligible ? '#4ade80' : '#f87171' }}>
                {row.eligible ? 'Yes (≥2 platforms)' : 'No'}
              </span>
            </div>
          </div>
          <div className="lb-tooltip-section" style={{ fontSize:11, color:'var(--fg-muted)' }}>
            Score = 0 if platform not attended · Proxy used if no live standings
          </div>
        </div>
      )}
    </div>
  )
}

export default function WeeklyLeaderboard() {
  const weeks   = recentWeeks()
  const [selectedWeek, setSelectedWeek] = useState(weeks[0])
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.weekly(selectedWeek, page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load weekly leaderboard'))
      .finally(() => setLoading(false))
  }, [selectedWeek, page])

  const rows  = data?.data  || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 50)

  const fmtWeek = (w) => {
    const d = new Date(w)
    const end = new Date(d); end.setDate(d.getDate() + 6)
    return `${d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })} – ${end.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}`
  }

  return (
    <div className="card">
      <div className="lb-header">
        <div>
          <div className="lb-title">⚡ Weekly Performers</div>
          <div className="lb-subtitle">
            Contest performance only · 0.35×LC + 0.30×CC + 0.35×CF · Award needs ≥2 platforms
          </div>
        </div>

        {/* Week picker */}
        <select
          value={selectedWeek}
          onChange={e => { setSelectedWeek(e.target.value); setPage(1) }}
          style={{ padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.12)', color:'var(--fg)', fontSize:13 }}
        >
          {weeks.map(w => (
            <option key={w} value={w}>
              {w === weeks[0] ? `This week (${fmtWeek(w)})` : fmtWeek(w)}
            </option>
          ))}
        </select>
      </div>

      {/* Current week info bar */}
      <div style={{
        background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)',
        borderRadius:8, padding:'8px 14px', marginBottom:16, fontSize:12, color:'var(--fg-muted)'
      }}>
        📅 Week of <strong style={{ color:'var(--fg)' }}>{fmtWeek(selectedWeek)}</strong>
        {' · '}Scores use rating-change proxy until live standings are scraped
      </div>

      {loading ? (
        <div className="lb-loading"><div className="spinner" /> Loading…</div>
      ) : error ? (
        <div className="lb-error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">
          No contest data for this week yet.<br />
          <span style={{ fontSize:12, marginTop:8, display:'block' }}>
            Make sure profiles are synced after contests end.
          </span>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((row, i) => (
            <WeeklyRow key={row.email} row={row} rank={(page - 1) * 50 + i + 1} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="lb-pagination">
          <button className="lb-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹ Prev</button>
          <span className="lb-page-info">Page {page} of {pages}</span>
          <button className="lb-page-btn" onClick={() => setPage(p => p + 1)} disabled={page === pages}>Next ›</button>
        </div>
      )}
    </div>
  )
}
