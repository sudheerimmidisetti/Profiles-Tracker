// MonthlyLeaderboard.jsx — Admin
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Download } from 'lucide-react'
import { leaderboardAPI } from '../../api/api'
import { useExportCSV } from '../../hooks/useExportCSV'
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
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const rowRef        = useRef(null)
  const tipRef        = useRef(null)

  const contest      = row.contest_score ?? row.contestPts  ?? 0
  const total        = row.final_score   ?? row.monthlyScore ?? 0
  const activeWeeks  = row.active_weeks  ?? row.activeWeeks  ?? 0
  const composites   = row.breakdown?.composites ?? []
  const weeks        = row.breakdown?.weeks ?? []
  const W            = row.breakdown?.W ?? 4

  function recalcPos() {
    if (!rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const vpH  = window.innerHeight
    const tipH = tipRef.current?.offsetHeight || 240
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
    <div ref={rowRef} className="lb-row" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
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

      {/* Contest + Weeks */}
      <div className="lb-month-cols">
        <div className="lb-month-col contest">
          <div className="lb-col-label" style={{ marginBottom: 3 }}>Contest</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--chart-1)', lineHeight: 1 }}>{contest.toFixed(1)}</div>
          <div style={{ fontSize: '0.60rem', color: 'var(--fg-subtle)' }}>/100</div>
        </div>
        <div className="lb-month-col weeks">
          <div className="lb-col-label" style={{ marginBottom: 3 }}>Weeks</div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--fg-muted)', lineHeight: 1 }}>
            {activeWeeks}<span style={{ fontSize: '0.65rem', opacity: 0.5 }}>/4</span>
          </div>
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

      {/* Tooltip */}
      {tip && createPortal(
        <div ref={tipRef} className="lb-tip lb-tip-portal"
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}>
          <div className="lb-tip-title">Monthly breakdown</div>
          <div className="lb-tip-row">
            <span style={{ fontWeight: 600 }}>Formula</span>
            <span style={{ color: 'var(--fg-subtle)', fontSize: '0.72rem' }}>
              (W1+W2+W3+W4) / 4
            </span>
          </div>
          <div className="lb-tip-divider" />
          {composites.map((c, i) => (
            <div key={i} className="lb-tip-row"
              style={{ opacity: c === 0 ? 0.35 : 1 }}>
              <span>Week {i + 1}{weeks[i] ? ` · ${weeks[i].slice(5)}` : ''}</span>
              <span style={{ color: c === 0 ? 'var(--fg-subtle)' : 'var(--chart-1)', fontWeight: 600 }}>
                {c === 0 ? '—' : c.toFixed(1)}
              </span>
            </div>
          ))}
          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span style={{ fontWeight: 700 }}>Total</span>
            <span style={{ fontWeight: 700 }}>{total.toFixed(2)} / 100</span>
          </div>
          <div className="lb-tip-row">
            <span>Eligible</span>
            <span style={{ color: row.eligible ? 'var(--success)' : 'var(--fg-subtle)' }}>
              {row.eligible ? `Yes (${activeWeeks}/4 weeks)` : `No — need ≥ 2 weeks (has ${activeWeeks})`}
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
  const [selMonth,    setSelMonth]    = useState(months[0])
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [page,        setPage]        = useState(1)
  const [search,      setSearch]      = useState('')
  const [branch,      setBranch]      = useState('')
  const [college,     setCollege]     = useState('')
  const [year,        setYear]        = useState('')
  const [filterOpts,  setFilterOpts]  = useState({ branches: [], colleges: [], years: [] })
  const searchRef = useRef(null)

  // ── CSV Export ────────────────────────────────────────────────────────────
  const { exporting, exportCSV } = useExportCSV(
    async () => {
      const r = await leaderboardAPI.monthly(selMonth, 1, 9999, college, year)
      return r.data?.data || []
    },
    (rows) => ({
      headers: ['Rank','Name','Roll Number','Branch','College','LC Handle','CC Handle','CF Handle','Contest Score','Week 1','Week 2','Week 3','Week 4','Active Weeks','Eligible'],
      rows: rows.map((r, i) => [
        i + 1,
        r.full_name || '',
        r.roll_number || '',
        r.branch || '',
        r.college || '',
        r.lc_handle || '',
        r.cc_handle || '',
        r.cf_handle || '',
        (r.contest_score ?? r.final_score ?? 0).toFixed(2),
        (r.breakdown?.composites?.[0] ?? 0).toFixed(2),
        (r.breakdown?.composites?.[1] ?? 0).toFixed(2),
        (r.breakdown?.composites?.[2] ?? 0).toFixed(2),
        (r.breakdown?.composites?.[3] ?? 0).toFixed(2),
        r.active_weeks ?? 0,
        r.eligible ? 'Yes' : 'No',
      ])
    }),
    `monthly_leaderboard_${selMonth}.csv`
  )

  useEffect(() => {
    leaderboardAPI.getFilters()
      .then(r => setFilterOpts(r.data.data || { branches: [], colleges: [], years: [] }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.monthly(selMonth, page, 50, college, year)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [selMonth, page, college, year])

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
    if (branch) r = r.filter(x => (x.branch || '').toLowerCase() === branch.toLowerCase())
    return r
  }, [allRows, search, branch])

  const clearSearch = () => { setSearch(''); searchRef.current?.focus() }
  const hasFilters  = college || year || branch || search

  const selectStyle = {
    background: 'var(--card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--fg)',
    fontSize: '0.78rem', padding: '4px 28px 4px 10px',
    cursor: 'pointer', outline: 'none', appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="lb-card-header">
        <div>
          <div className="lb-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isNow && <div className="lb-live-dot" />}
            Monthly Leaderboard
          </div>
          <div className="lb-card-sub">
            Contest only · (Week1 + Week2 + Week3 + Week4) / 4 · Hover for per-week breakdown
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={exportCSV}
            disabled={exporting || loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--card)',
              color: 'var(--fg)', fontSize: '0.75rem', fontWeight: 600,
              cursor: exporting || loading ? 'not-allowed' : 'pointer',
              opacity: exporting || loading ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            <Download size={13} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <select className="lb-select" value={selMonth}
            onChange={e => { setSelMonth(e.target.value); setPage(1) }}>
            {months.map((m, i) => (
              <option key={m} value={m}>
                {i === 0 ? `This month · ${fmtMonth(m)}` : fmtMonth(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Context bar */}
      <div className="lb-context-bar">
        <span>{fmtMonth(selMonth)}</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>4 contest weeks · average score / 100</span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span>Eligible: competed ≥ 2 of 4 weeks</span>
      </div>

      {/* Search + filter */}
      <div className="lb-search-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="lb-search-input-wrap">
          <Search size={13} />
          <input ref={searchRef} className="lb-search-input"
            placeholder="Search name or roll…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="lb-search-clear" onClick={clearSearch}><X size={12} /></button>}
        </div>
        {filterOpts.branches.length > 0 && (
          <select style={selectStyle} value={branch} onChange={e => { setBranch(e.target.value); setPage(1) }}>
            <option value="">All Branches</option>
            {filterOpts.branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        {filterOpts.colleges.length > 0 && (
          <select style={selectStyle} value={college} onChange={e => { setCollege(e.target.value); setPage(1) }}>
            <option value="">All Colleges</option>
            {filterOpts.colleges.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {filterOpts.years.length > 0 && (
          <select style={selectStyle} value={year} onChange={e => { setYear(e.target.value); setPage(1) }}>
            <option value="">All Years</option>
            {filterOpts.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        {hasFilters && (
          <button className="lb-f-pill" style={{ marginLeft: 0 }}
            onClick={() => { setSearch(''); setBranch(''); setCollege(''); setYear(''); setPage(1) }}>
            <X size={10} /> Clear
          </button>
        )}
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
            <div className="lb-month-col weeks lb-col-label">Weeks</div>
          </div>
          <div style={{ width: 1, flexShrink: 0 }} />
          <div style={{ width: 72, textAlign: 'right', flexShrink: 0 }} className="lb-col-label">Score</div>
        </div>
      )}

      {/* Rows */}
      <div style={{ padding: '6px 0' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Computing monthly scores…</div>
        ) : error ? (
          <div className="msg msg-error" style={{ margin: '20px 16px' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div className="lb-no-results">
            {hasFilters ? 'No students match your filters.' : `No data for ${fmtMonth(selMonth)}.`}
          </div>
        ) : (
          <div className="lb-rows-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <MonthRow key={row.student_email || row.email} row={row} rank={row.rank ?? (page - 1) * 50 + i + 1} />
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
