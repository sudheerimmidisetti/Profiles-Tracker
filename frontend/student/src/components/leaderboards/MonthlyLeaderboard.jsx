// MonthlyLeaderboard.jsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import { leaderboardAPI } from '../../api/api'
import './leaderboard.shared.css'

const BRANCHES = ['All', 'CSE', 'CSE1', 'IT', 'AIML']

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
  const [tip, setTip]  = useState(false)
  const [pos, setPos]  = useState({ top: 0, right: 0 })
  const rowRef         = useRef(null)
  const tipRef         = useRef(null)

  const contest     = row.contest_score  ?? row.contestPts  ?? 0
  const practice    = row.practice_score ?? row.practicePts ?? 0
  const total       = row.final_score    ?? row.monthlyScore ?? 0
  const activeWeeks = row.active_weeks   ?? row.activeWeeks ?? 0
  const monthUdg    = row.month_udg      ?? row.monthUdg    ?? 0

  function recalcPos() {
    if (!rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const vpH  = window.innerHeight
    const tipH = tipRef.current?.offsetHeight || 230
    const tipW = tipRef.current?.offsetWidth  || 260
    let top    = rect.bottom + 6
    if (rect.bottom + 6 + tipH > vpH) top = rect.top - 6 - tipH
    let right  = window.innerWidth - rect.right
    if (window.innerWidth - right - tipW < 8) right = 8
    setPos({ top, right })
  }

  function handleEnter() { setTip(true); setTimeout(recalcPos, 0) }
  function handleLeave() { setTip(false) }

  return (
    <div
      ref={rowRef}
      className="lb-row"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
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
      <div className="lb-month-cols">
        <div className="lb-month-col contest">
          <div className="lb-col-label" style={{ marginBottom: 3 }}>Contest</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--chart-1)', lineHeight: 1 }}>{contest.toFixed(1)}</div>
          <div style={{ fontSize: '0.60rem', color: 'var(--fg-subtle)' }}>/60</div>
        </div>
        <div className="lb-month-col practice">
          <div className="lb-col-label" style={{ marginBottom: 3 }}>Practice</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--chart-2)', lineHeight: 1 }}>{practice.toFixed(1)}</div>
          <div style={{ fontSize: '0.60rem', color: 'var(--fg-subtle)' }}>/40</div>
        </div>
        <div className="lb-month-col weeks">
          <div className="lb-col-label" style={{ marginBottom: 3 }}>Weeks</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--fg-muted)', lineHeight: 1 }}>{activeWeeks}</div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Total */}
      <div className="lb-score-cell" style={{ width: 72, minWidth: 72 }}>
        <div className="lb-score-num">{total.toFixed(1)}</div>
        <div className="lb-score-denom">/ 100</div>
        <ScoreBar value={total} cls="all" />
        <div style={{ marginTop: 3, textAlign: 'right' }}>
          {row.eligible && <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Award</span>}
        </div>
      </div>

      {/* Portal Tooltip */}
      {tip && createPortal(
        <div
          ref={tipRef}
          className="lb-tip lb-tip-portal"
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
        >
          <div className="lb-tip-title">Monthly breakdown</div>
          <div className="lb-tip-row">
            <span>Contest (60%)</span>
            <span style={{ color: 'var(--chart-1)' }}>{contest.toFixed(2)} / 60</span>
          </div>
          {row.breakdown?.W && <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
            <span>Weeks (drop-one of {row.breakdown.W})</span>
            <span>{activeWeeks} active</span>
          </div>}
          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span>Practice (40%)</span>
            <span style={{ color: 'var(--chart-2)' }}>{practice.toFixed(2)} / 40</span>
          </div>
          <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
            <span>UDG points</span>
            <span>{monthUdg.toFixed(1)}</span>
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
        </div>,
        document.body
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
  const [search,  setSearch]  = useState('')
  const [branch,  setBranch]  = useState('All')
  const searchRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.monthly(selMonth, page, 50)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [selMonth, page])

  const allRows = data?.data || []
  const total   = data?.total || 0
  const pages   = Math.ceil(total / 50)
  const isNow   = selMonth === months[0]

  const rows = useMemo(() => {
    let r = allRows
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x => (x.full_name || '').toLowerCase().includes(q) || (x.roll_number || '').toLowerCase().includes(q))
    }
    if (branch !== 'All') r = r.filter(x => (x.branch || '').toLowerCase() === branch.toLowerCase())
    return r
  }, [allRows, search, branch])

  const clearSearch = () => { setSearch(''); searchRef.current?.focus() }

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

      {/* Search + filter bar */}
      <div className="lb-search-bar">
        <div className="lb-search-input-wrap">
          <Search size={13} />
          <input
            ref={searchRef}
            className="lb-search-input"
            placeholder="Search name or roll…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button className="lb-search-clear" onClick={clearSearch}><X size={12} /></button>}
        </div>
        <div className="lb-filter-pills">
          {BRANCHES.map(b => (
            <button key={b} className={`lb-f-pill${branch === b ? ' active' : ''}`} onClick={() => setBranch(b)}>{b}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--fg-subtle)' }}>
          {rows.length} student{rows.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Column labels */}
      {!loading && rows.length > 0 && (
        <div className="lb-col-header" style={{ gap: 12 }}>
          <div style={{ width: 28, flexShrink: 0 }}>#</div>
          <div style={{ flex: 1 }}>Student</div>
          <div className="lb-month-cols">
            <div className="lb-month-col contest lb-col-label">Contest</div>
            <div className="lb-month-col practice lb-col-label">Practice</div>
            <div className="lb-month-col weeks lb-col-label">Weeks</div>
          </div>
          <div style={{ width: 1, flexShrink: 0 }} />
          <div style={{ width: 72, textAlign: 'right', flexShrink: 0 }} className="lb-col-label">Score</div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '6px 0' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Computing monthly scores…</div>
        ) : error ? (
          <div className="msg msg-error" style={{ margin: '20px 16px' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div className="lb-no-results">
            {search || branch !== 'All' ? 'No students match your filters.' : `No data for ${fmtMonth(selMonth)}.`}
          </div>
        ) : (
          <div className="lb-rows-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <MonthRow key={row.student_email || row.email} row={row} rank={(page - 1) * 50 + i + 1} />
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
