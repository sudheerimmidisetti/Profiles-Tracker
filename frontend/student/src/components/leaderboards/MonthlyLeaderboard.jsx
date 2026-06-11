// MonthlyLeaderboard.jsx
// Monthly = 0.60×Contest + 0.40×Practice
// Contest = mean of best (W-1) weekly scores (drop-one)
// Practice = UDG points × consistency factor, saturated to benchmark 185

import { useState, useEffect } from 'react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

function recentMonths() {
  const months = []
  const now = new Date()
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function fmtMonth(m) {
  const [y, mo] = m.split('-')
  return new Date(Number(y), Number(mo) - 1, 1)
    .toLocaleDateString('en-IN', { month:'long', year:'numeric' })
}

function RankBadge({ rank }) {
  const cls = rank === 1 ? 'lb-rank-1' : rank === 2 ? 'lb-rank-2' : rank === 3 ? 'lb-rank-3' : 'lb-rank-n'
  return <div className={`lb-rank-badge ${cls}`}>{rank <= 3 ? ['🥇','🥈','🥉'][rank - 1] : rank}</div>
}

function ScoreBar({ value, max = 100 }) {
  return (
    <div className="lb-score-bar">
      <div className="lb-score-bar-fill score-monthly" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

function MonthlyRow({ row, rank }) {
  const [showTip, setShowTip] = useState(false)

  const contestPts  = row.contestPts  ?? 0
  const practicePts = row.practicePts ?? 0
  const total       = row.monthlyScore ?? 0

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

      {/* Contest vs Practice split */}
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:11, color:'var(--fg-muted)', marginBottom:2 }}>Contest</div>
          <div style={{ fontSize:16, fontWeight:700, color:'#34d399' }}>{contestPts.toFixed(1)}</div>
          <div style={{ fontSize:10, color:'var(--fg-muted)' }}>/60</div>
        </div>
        <div style={{ width:1, height:32, background:'rgba(255,255,255,0.1)' }} />
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:11, color:'var(--fg-muted)', marginBottom:2 }}>Practice</div>
          <div style={{ fontSize:16, fontWeight:700, color:'#22d3ee' }}>{practicePts.toFixed(1)}</div>
          <div style={{ fontSize:10, color:'var(--fg-muted)' }}>/40</div>
        </div>
      </div>

      {/* Active weeks + eligibility */}
      <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center', minWidth:80 }}>
        <span style={{ fontSize:11, color:'var(--fg-muted)' }}>{row.activeWeeks ?? 0} active wks</span>
        <span className={row.eligible ? 'lb-eligible' : 'lb-ineligible'}>
          {row.eligible ? '✓ Award' : 'Ineligible'}
        </span>
      </div>

      {/* Total score */}
      <div className="lb-score-section">
        <div className="lb-score-value" style={{ color:'#34d399' }}>{total.toFixed(1)}</div>
        <div className="lb-score-label">/ 100</div>
        <ScoreBar value={total} />
      </div>

      {/* Tooltip */}
      {showTip && (
        <div className="lb-tooltip">
          <div className="lb-tooltip-title">Monthly Score Breakdown</div>

          <div className="lb-tooltip-section">
            <div className="lb-tooltip-section-title">🏆 Contest Component (60pts)</div>
            <div className="lb-tooltip-row"><span>Score</span><span>{contestPts.toFixed(2)} / 60</span></div>
            {row.breakdown?.composites && (
              <div className="lb-tooltip-row">
                <span>Weekly composites</span>
                <span>{row.breakdown.composites.map(c => c.toFixed(0)).join(', ')}</span>
              </div>
            )}
            {row.breakdown?.W && (
              <div className="lb-tooltip-row">
                <span>Weeks (drop-one of {row.breakdown.W})</span>
                <span>{row.breakdown.contestMonth?.toFixed(1)} avg</span>
              </div>
            )}
          </div>

          <div className="lb-tooltip-section">
            <div className="lb-tooltip-section-title">📚 Practice Component (40pts)</div>
            <div className="lb-tooltip-row"><span>UDG points (capped)</span><span>{(row.monthUdg ?? 0).toFixed(1)}</span></div>
            <div className="lb-tooltip-row"><span>Consistency factor</span><span>{row.breakdown?.monthCF?.toFixed(2) ?? '—'}</span></div>
            <div className="lb-tooltip-row"><span>Active weeks</span><span>{row.activeWeeks}/{row.breakdown?.W ?? 4}</span></div>
            <div className="lb-tooltip-row"><span>Score</span><span>{practicePts.toFixed(2)} / 40</span></div>
          </div>

          <div className="lb-tooltip-section">
            <div className="lb-tooltip-row" style={{ fontWeight:700 }}>
              <span>Total</span><span>{total.toFixed(2)} / 100</span>
            </div>
            <div className="lb-tooltip-row">
              <span>Eligible for award?</span>
              <span style={{ color: row.eligible ? '#4ade80' : '#f87171' }}>
                {row.eligible ? 'Yes' : 'No (need ≥2 contest wks + ≥2 active wks)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MonthlyLeaderboard() {
  const months = recentMonths()
  const [selectedMonth, setSelectedMonth] = useState(months[0])
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.monthly(selectedMonth, page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load monthly leaderboard'))
      .finally(() => setLoading(false))
  }, [selectedMonth, page])

  const rows  = data?.data  || []
  const total = data?.total || 0
  const pages = Math.ceil(total / 50)

  return (
    <div className="card">
      <div className="lb-header">
        <div>
          <div className="lb-title">📅 Monthly Leaderboard</div>
          <div className="lb-subtitle">
            60% Contest (drop-one week) + 40% Practice (UDG) · Hover for full breakdown
          </div>
        </div>

        <select
          value={selectedMonth}
          onChange={e => { setSelectedMonth(e.target.value); setPage(1) }}
          style={{ padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.06)',
            border:'1px solid rgba(255,255,255,0.12)', color:'var(--fg)', fontSize:13 }}
        >
          {months.map(m => (
            <option key={m} value={m}>
              {m === months[0] ? `This month (${fmtMonth(m)})` : fmtMonth(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Info banner */}
      <div style={{
        background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)',
        borderRadius:8, padding:'8px 14px', marginBottom:16, fontSize:12, color:'var(--fg-muted)',
        display:'flex', gap:16, flexWrap:'wrap'
      }}>
        <span>📈 <strong style={{ color:'var(--fg)' }}>{fmtMonth(selectedMonth)}</strong></span>
        <span>Practice benchmark: 185 UDG pts/month</span>
        <span>Drop-one worst week applied when W ≥ 4</span>
      </div>

      {loading ? (
        <div className="lb-loading"><div className="spinner" /> Computing monthly scores…</div>
      ) : error ? (
        <div className="lb-error">{error}</div>
      ) : rows.length === 0 ? (
        <div className="lb-empty">
          No data for {fmtMonth(selectedMonth)}.<br />
          <span style={{ fontSize:12 }}>Weekly boards must be computed before monthly scores.</span>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {rows.map((row, i) => (
            <MonthlyRow key={row.email} row={row} rank={(page - 1) * 50 + i + 1} />
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
