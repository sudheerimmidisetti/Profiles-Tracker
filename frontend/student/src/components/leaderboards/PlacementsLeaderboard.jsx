// PlacementsLeaderboard.jsx
import { useState, useEffect } from 'react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

const fmt  = (v, d = 1) => typeof v === 'number' ? v.toFixed(d) : '—'
const pct  = v => typeof v === 'number' ? `${(v * 100).toFixed(0)}%` : '—'

function RankCell({ rank }) {
  if (rank <= 3) {
    return <span style={{ fontSize: 18, lineHeight: 1, userSelect: 'none' }}>
      {['🥇', '🥈', '🥉'][rank - 1]}
    </span>
  }
  return (
    <div className="rank-badge rank-n" style={{ width: 26, height: 26, fontSize: '0.72rem' }}>
      {rank}
    </div>
  )
}

function ScoreBar({ value, max = 100 }) {
  return (
    <div className="lb-bar-track">
      <div className="lb-bar-fill all" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

function Tooltip({ data }) {
  if (!data) return null
  const lc = data.lc ?? {}
  const cc = data.cc ?? {}
  const cf = data.cf ?? {}
  const hr = data.hr ?? {}

  return (
    <div className="lb-tip" style={{ minWidth: 250, right: 0 }}>
      <div className="lb-tip-title">Score breakdown</div>

      <div className="lb-tip-row">
        <span>LeetCode</span><span style={{ color: 'var(--lc)' }}>{fmt(lc.score)} / 30</span>
      </div>
      {lc.prob && <>
        <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
          <span>Problems (UDG)</span><span>{fmt(lc.prob.cappedPts)} pts</span>
        </div>
        <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
          <span>Active weeks</span><span>{lc.prob.activeWeeks}/26</span>
        </div>
      </>}
      {lc.contest && <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
        <span>Contests</span><span>{lc.contest.attended}/{lc.contest.expected}</span>
      </div>}

      <div className="lb-tip-divider" />

      <div className="lb-tip-row">
        <span>CodeChef</span><span style={{ color: 'var(--cc)' }}>{fmt(cc.score)} / 30</span>
      </div>

      <div className="lb-tip-divider" />

      <div className="lb-tip-row">
        <span>Codeforces</span><span style={{ color: 'var(--cf)' }}>{fmt(cf.score)} / 20</span>
      </div>

      <div className="lb-tip-divider" />

      <div className="lb-tip-row">
        <span>HackerRank</span><span>{fmt(hr.score)} / 20</span>
      </div>
      {hr.psStars !== undefined && <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
        <span>PS / SQL / Java / Python</span>
        <span>{hr.psStars}★ · {hr.sqlStars ?? 0}★ · {hr.javStars ?? 0}★ · {hr.pytStars ?? 0}★</span>
      </div>}

      <div className="lb-tip-divider" />
      <div className="lb-tip-row">
        <span style={{ fontWeight: 700, color: 'var(--fg)' }}>Total</span>
        <span style={{ fontWeight: 700, color: 'var(--fg)' }}>{fmt(data.total)} / 100</span>
      </div>
    </div>
  )
}

function PlacementRow({ row, rank }) {
  const [tip, setTip] = useState(false)
  const lc = row.lc?.score ?? row.lc_score ?? 0
  const cc = row.cc?.score ?? row.cc_score ?? 0
  const cf = row.cf?.score ?? row.cf_score ?? 0
  const hr = row.hr?.score ?? row.hr_score ?? 0
  // API returns final_score, not 'total'
  const total = row.final_score ?? row.total_score ?? row.total ?? 0

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

      {/* Identity */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {row.full_name}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 1 }}>
          {row.roll_number}
          {row.branch ? <span style={{ color: 'var(--fg-subtle)' }}> · {row.branch}</span> : null}
        </div>
        {/* Platform handles */}
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {row.lc_handle && <span className="plat-chip lc">LC</span>}
          {row.cc_handle && <span className="plat-chip cc">CC</span>}
          {row.cf_handle && <span className="plat-chip cf">CF</span>}
          {row.hr_handle && <span className="plat-chip hr">HR</span>}
        </div>
      </div>

      {/* Per-platform breakdown bars */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {[
          { label: 'LC', val: lc, max: 30, cls: 'lc' },
          { label: 'CC', val: cc, max: 30, cls: 'cc' },
          { label: 'CF', val: cf, max: 20, cls: 'cf' },
          { label: 'HR', val: hr, max: 20, cls: 'hr' },
        ].map(({ label, val, max, cls }) => (
          <div key={label} style={{ textAlign: 'center', width: 38 }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)', marginBottom: 2, fontWeight: 600 }}>
              {label}
            </div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: `var(--${cls})` }}>
              {val.toFixed(1)}
            </div>
            <div className="lb-bar-track" style={{ width: 38 }}>
              <div className={`lb-bar-fill ${cls}`} style={{ width: `${(val / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Total */}
      <div className="lb-score-cell">
        <div className="lb-score-num">{total.toFixed(1)}</div>
        <div className="lb-score-denom">/ 100</div>
        <ScoreBar value={total} />
      </div>

      {tip && <Tooltip data={row} />}
    </div>
  )
}

export default function PlacementsLeaderboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.placements(page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [page])

  const rows  = data?.data  || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 50)

  return (
    <div className="card">
      {/* Header */}
      <div className="lb-card-header">
        <div>
          <div className="lb-card-title">Placements Leaderboard</div>
          <div className="lb-card-sub">6-month window · 100 pts · Hover any row for breakdown</div>
        </div>
        {total > 0 && (
          <span className="badge badge-gray">{total} students</span>
        )}
      </div>

      {/* Column labels */}
      {!loading && rows.length > 0 && (
        <div className="lb-col-header">
          <div style={{ width: 28 }}>#</div>
          <div style={{ flex: 1 }}>Student</div>
          <div style={{ display: 'flex', gap: 14 }}>
            <div style={{ width: 38, textAlign: 'center' }}>LC</div>
            <div style={{ width: 38, textAlign: 'center' }}>CC</div>
            <div style={{ width: 38, textAlign: 'center' }}>CF</div>
            <div style={{ width: 38, textAlign: 'center' }}>HR</div>
          </div>
          <div style={{ width: 1 }} />
          <div style={{ width: 68, textAlign: 'right' }}>Score</div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '6px 0' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Computing scores…</div>
        ) : error ? (
          <div className="msg msg-error" style={{ margin: '20px 16px' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No data yet</p>
            <p className="empty-desc">Sync profiles to populate this leaderboard.</p>
          </div>
        ) : (
          <div className="lb-rows-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <PlacementRow key={row.student_email || row.email} row={row} rank={(page - 1) * 50 + i + 1} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
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
