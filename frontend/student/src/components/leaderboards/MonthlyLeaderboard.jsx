// MonthlyLeaderboard.jsx
import { useState, useEffect } from 'react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

function recentMonths() {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

function fmtMonth(m) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

function RankCell({ rank }) {
  if (rank <= 3) return <span style={{ fontSize: 18, lineHeight: 1 }}>{['🥇','🥈','🥉'][rank - 1]}</span>
  return <div className="rank-badge rank-n" style={{ width: 26, height: 26, fontSize: '0.72rem' }}>{rank}</div>
}

function ScoreBar({ value, max = 100, cls = 'all' }) {
  return (
    <div className="lb-bar-track">
      <div className={`lb-bar-fill ${cls}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

function MonthRow({ row, rank }) {
  const [tip, setTip] = useState(false)
  const contest  = row.contestPts  ?? 0
  const practice = row.practicePts ?? 0
  const total    = row.monthlyScore ?? 0

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
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.full_name}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 1 }}>
          {row.roll_number}
          {row.branch ? <span style={{ color: 'var(--fg-subtle)' }}> · {row.branch}</span> : null}
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {row.lc_handle && <span className="plat-chip lc">LC</span>}
          {row.cc_handle && <span className="plat-chip cc">CC</span>}
          {row.cf_handle && <span className="plat-chip cf">CF</span>}
        </div>
      </div>

      {/* Contest vs Practice split */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ textAlign: 'center', width: 52 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)', marginBottom: 2, fontWeight: 600 }}>CONTEST</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--chart-1)', lineHeight: 1 }}>
            {contest.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)' }}>/60</div>
        </div>
        <div style={{ textAlign: 'center', width: 52 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)', marginBottom: 2, fontWeight: 600 }}>PRACTICE</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--chart-2)', lineHeight: 1 }}>
            {practice.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)' }}>/40</div>
        </div>
        <div style={{ textAlign: 'center', width: 40 }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)', marginBottom: 2, fontWeight: 600 }}>WEEKS</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--fg-muted)', lineHeight: 1 }}>
            {row.activeWeeks ?? 0}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Total */}
      <div className="lb-score-cell">
        <div className="lb-score-num">{total.toFixed(1)}</div>
        <div className="lb-score-denom">/ 100</div>
        <ScoreBar value={total} cls="all" />
        <div style={{ marginTop: 3, textAlign: 'right' }}>
          {row.eligible
            ? <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Award</span>
            : null
          }
        </div>
      </div>

      {/* Tooltip */}
      {tip && (
        <div className="lb-tip">
          <div className="lb-tip-title">Monthly breakdown</div>

          <div className="lb-tip-row">
            <span>Contest (60%)</span>
            <span style={{ color: 'var(--chart-1)' }}>{contest.toFixed(2)} / 60</span>
          </div>
          {row.breakdown?.W && <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
            <span>Weeks (drop-one of {row.breakdown.W})</span>
            <span>{row.activeWeeks} active</span>
          </div>}

          <div className="lb-tip-divider" />

          <div className="lb-tip-row">
            <span>Practice (40%)</span>
            <span style={{ color: 'var(--chart-2)' }}>{practice.toFixed(2)} / 40</span>
          </div>
          <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
            <span>UDG points</span>
            <span>{(row.monthUdg ?? 0).toFixed(1)}</span>
          </div>

          <div className="lb-tip-divider" />

          <div className="lb-tip-row">
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 700 }}>{total.toFixed(2)} / 100</span>
          </div>
          <div className="lb-tip-row">
            <span>Eligible</span>
            <span style={{ color: row.eligible ? 'var(--success)' : 'var(--fg-subtle)' }}>
              {row.eligible ? 'Yes' : 'No — need ≥ 2 contest wks'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MonthlyLeaderboard() {
  const months = recentMonths()
  const [selMonth, setSelMonth] = useState(months[0])
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.monthly(selMonth, page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [selMonth, page])

  const rows  = data?.data  || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 50)
  const isNow = selMonth === months[0]

  return (
    <div className="card">
      {/* Header */}
      <div className="lb-card-header">
        <div>
          <div className="lb-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isNow && <div className="lb-live-dot" />}
            Monthly Leaderboard
          </div>
          <div className="lb-card-sub">60% Contest (drop-one week) + 40% Practice (UDG) · Hover for breakdown</div>
        </div>

        <select
          className="lb-select"
          value={selMonth}
          onChange={e => { setSelMonth(e.target.value); setPage(1) }}
        >
          {months.map((m, i) => (
            <option key={m} value={m}>
              {i === 0 ? `This month · ${fmtMonth(m)}` : fmtMonth(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Context bar */}
      <div className="lb-context-bar">
        <span>{fmtMonth(selMonth)}</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>Practice benchmark: 185 UDG pts/month</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>Drop-one when W ≥ 4</span>
      </div>

      {/* Column labels */}
      {!loading && rows.length > 0 && (
        <div className="lb-col-header" style={{ gap: 0 }}>
          <div style={{ width: 28 }}>#</div>
          <div style={{ flex: 1, paddingLeft: 12 }}>Student</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ width: 52, textAlign: 'center' }}>Contest</div>
            <div style={{ width: 52, textAlign: 'center' }}>Practice</div>
            <div style={{ width: 40, textAlign: 'center' }}>Weeks</div>
          </div>
          <div style={{ width: 1 }} />
          <div style={{ width: 68, textAlign: 'right' }}>Score</div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '6px 0' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Computing monthly scores…</div>
        ) : error ? (
          <div className="msg msg-error" style={{ margin: '20px 16px' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <p className="empty-title">No data for {fmtMonth(selMonth)}</p>
            <p className="empty-desc">Weekly boards must be computed first.</p>
          </div>
        ) : (
          <div className="lb-rows-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <MonthRow key={row.email} row={row} rank={(page - 1) * 50 + i + 1} />
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
