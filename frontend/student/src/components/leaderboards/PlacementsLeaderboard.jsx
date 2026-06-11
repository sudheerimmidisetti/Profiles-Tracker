// PlacementsLeaderboard.jsx
// 6-month rolling window leaderboard — Total 100pts = LC(30)+CC(30)+CF(20)+HR(20)
import { useState, useEffect, useRef } from 'react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

const THEME = 'score-placements'

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'lb-rank-1' : rank === 2 ? 'lb-rank-2' : rank === 3 ? 'lb-rank-3' : 'lb-rank-n'
  return (
    <div className={`lb-rank-badge ${cls}`}>
      {rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}
    </div>
  )
}

function ScoreBar({ value, max = 100, theme = THEME }) {
  return (
    <div className="lb-score-bar">
      <div className={`lb-score-bar-fill ${theme}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

function BreakdownTooltip({ data }) {
  if (!data) return null
  const fmt = v => typeof v === 'number' ? v.toFixed(2) : (v ?? '—')
  const pct  = v => typeof v === 'number' ? `${(v * 100).toFixed(1)}%` : '—'

  return (
    <div className="lb-tooltip">
      <div className="lb-tooltip-title">Score Breakdown</div>

      {/* LC */}
      <div className="lb-tooltip-section">
        <div className="lb-tooltip-section-title">🟡 LeetCode — {fmt(data.lc?.score)}/30</div>
        {data.lc?.prob && <>
          <div className="lb-tooltip-row"><span>Problems (capped)</span><span>{fmt(data.lc.prob.cappedPts)} pts</span></div>
          <div className="lb-tooltip-row"><span>Consistency</span><span>{pct(data.lc.prob.consistencyFactor)}</span></div>
          <div className="lb-tooltip-row"><span>Active weeks</span><span>{data.lc.prob.activeWeeks}/26</span></div>
        </>}
        {data.lc?.contest && <>
          <div className="lb-tooltip-row"><span>Contests attended</span><span>{data.lc.contest.attended}/{data.lc.contest.expected}</span></div>
          <div className="lb-tooltip-row"><span>Participation (P)</span><span>{pct(data.lc.contest.P)}</span></div>
          <div className="lb-tooltip-row"><span>Trajectory (T)</span><span>{pct(data.lc.contest.T)}</span></div>
        </>}
      </div>

      {/* CC */}
      <div className="lb-tooltip-section">
        <div className="lb-tooltip-section-title">🟢 CodeChef — {fmt(data.cc?.score)}/30</div>
        {data.cc?.prob && <>
          <div className="lb-tooltip-row"><span>Problems (capped)</span><span>{fmt(data.cc.prob.cappedPts)} pts</span></div>
          <div className="lb-tooltip-row"><span>Active weeks</span><span>{data.cc.prob.activeWeeks}/26</span></div>
        </>}
        {data.cc?.contest && <div className="lb-tooltip-row"><span>Contests</span><span>{data.cc.contest.attended}/{data.cc.contest.expected}</span></div>}
      </div>

      {/* CF */}
      <div className="lb-tooltip-section">
        <div className="lb-tooltip-section-title">🔵 Codeforces — {fmt(data.cf?.score)}/20</div>
        {data.cf?.prob && <div className="lb-tooltip-row"><span>Problems (capped)</span><span>{fmt(data.cf.prob.cappedPts)} pts</span></div>}
        {data.cf?.contest && <div className="lb-tooltip-row"><span>Contests</span><span>{data.cf.contest.attended}/{data.cf.contest.expected}</span></div>}
      </div>

      {/* HR */}
      <div className="lb-tooltip-section">
        <div className="lb-tooltip-section-title">🟠 HackerRank — {fmt(data.hr?.score)}/20</div>
        {data.hr && <>
          <div className="lb-tooltip-row"><span>Problem Solving</span><span>{'★'.repeat(data.hr.psStars || 0)} ({fmt(data.hr.ps)})</span></div>
          <div className="lb-tooltip-row"><span>SQL / Java / Python</span><span>{fmt(data.hr.sql)} / {fmt(data.hr.java)} / {fmt(data.hr.python)}</span></div>
        </>}
      </div>
    </div>
  )
}

function PlacementRow({ row, rank, myEmail }) {
  const [showTip, setShowTip] = useState(false)
  const ref = useRef()

  return (
    <div
      className={`lb-row ${row.email === myEmail ? 'me' : ''}`}
      ref={ref}
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
          {row.hr_handle && <span className="lb-handle lb-plat-hr">HR: {row.hr_handle}</span>}
        </div>
      </div>

      {/* Per-platform mini scores */}
      <div className="lb-platform-scores" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="lb-plat-pill lb-plat-lc">LC {(row.lc?.score ?? 0).toFixed(1)}</span>
          <span className="lb-plat-pill lb-plat-cc">CC {(row.cc?.score ?? 0).toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className="lb-plat-pill lb-plat-cf">CF {(row.cf?.score ?? 0).toFixed(1)}</span>
          <span className="lb-plat-pill lb-plat-hr">HR {(row.hr?.score ?? 0).toFixed(1)}</span>
        </div>
      </div>

      <div className="lb-score-section">
        <div className="lb-score-value" style={{ color: '#fbbf24' }}>{(row.total ?? 0).toFixed(1)}</div>
        <div className="lb-score-label">/ 100</div>
        <ScoreBar value={row.total ?? 0} />
      </div>

      {showTip && <BreakdownTooltip data={row} />}
    </div>
  )
}

export default function PlacementsLeaderboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)
  const myEmail = null // TODO: pull from auth context if needed

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.placements(page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load placements leaderboard'))
      .finally(() => setLoading(false))
  }, [page])

  const rows  = data?.data  || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 50)

  return (
    <div className="card">
      <div className="lb-header">
        <div>
          <div className="lb-title">🏆 Placements Leaderboard</div>
          <div className="lb-subtitle">
            6-month rolling window · 100 pts = LC(30) + CC(30) + CF(20) + HR(20) · Hover a row for breakdown
          </div>
        </div>
        {total > 0 && <div style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{total} students</div>}
      </div>

      {loading ? (
        <div className="lb-loading">
          <div className="spinner" /> Computing scores…
        </div>
      ) : error ? (
        <div className="lb-error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">No data yet. Sync profiles to populate this leaderboard.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((row, i) => (
            <PlacementRow key={row.email} row={row} rank={(page - 1) * 50 + i + 1} myEmail={myEmail} />
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
