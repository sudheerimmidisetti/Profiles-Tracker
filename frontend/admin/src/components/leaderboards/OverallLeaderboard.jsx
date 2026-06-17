// OverallLeaderboard.jsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Download } from 'lucide-react'
import { leaderboardAPI } from '../../api/api'
import { useExportCSV } from '../../hooks/useExportCSV'
import './leaderboard.shared.css'

const BRANCHES = ['All', 'CSE', 'CSE1', 'IT', 'AIML']
const fmt = (v, d = 1) => typeof v === 'number' ? v.toFixed(d) : '—'

function RankCell({ rank }) {
  if (rank <= 3) return <span style={{ fontSize: 18, lineHeight: 1, userSelect: 'none' }}>{['🥇','🥈','🥉'][rank - 1]}</span>
  return <div className="rank-badge rank-n" style={{ width: 26, height: 26, fontSize: '0.72rem' }}>{rank}</div>
}

function ScoreBar({ value, max = 100 }) {
  return (
    <div className="lb-bar-track">
      <div className="lb-bar-fill all" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  )
}

function PlacementRow({ row, rank }) {
  const [tip, setTip] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const rowRef        = useRef(null)
  const tipRef        = useRef(null)

  const lc    = row.lc?.score ?? row.lc_score ?? 0
  const cc    = row.cc?.score ?? row.cc_score ?? 0
  const cf    = row.cf?.score ?? row.cf_score ?? 0
  const hr    = row.hr?.score ?? row.hr_score ?? 0
  const total = row.final_score ?? row.total_score ?? row.total ?? 0

  const lcData = row.lc ?? {}
  const ccData = row.cc ?? {}
  const cfData = row.cf ?? {}
  const hrData = row.hr ?? {}

  function recalcPos() {
    if (!rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const vpH  = window.innerHeight
    const tipH = tipRef.current?.offsetHeight || 280
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
        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
          {row.lc_handle && <span className="plat-chip lc">LC</span>}
          {row.cc_handle && <span className="plat-chip cc">CC</span>}
          {row.cf_handle && <span className="plat-chip cf">CF</span>}
          {row.hr_handle && <span className="plat-chip hr">HR</span>}
        </div>
      </div>

      {/* Per-platform scores */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        {[
          { label: 'LC', val: lc, max: 30, cls: 'lc' },
          { label: 'CC', val: cc, max: 30, cls: 'cc' },
          { label: 'CF', val: cf, max: 20, cls: 'cf' },
          { label: 'HR', val: hr, max: 20, cls: 'hr' },
        ].map(({ label, val, max, cls }) => (
          <div key={label} style={{ textAlign: 'center', width: 38 }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)', marginBottom: 2, fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: `var(--${cls})` }}>{val.toFixed(1)}</div>
            <div className="lb-bar-track" style={{ width: 38 }}>
              <div className={`lb-bar-fill ${cls}`} style={{ width: `${(val / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 36, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Total */}
      <div className="lb-score-cell" style={{ width: 72, minWidth: 72 }}>
        <div className="lb-score-num">{total.toFixed(1)}</div>
        <div className="lb-score-denom">/ 100</div>
        <ScoreBar value={total} />
      </div>

      {/* Portal Tooltip */}
      {tip && createPortal(
        <div
          ref={tipRef}
          className="lb-tip lb-tip-portal"
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999, minWidth: 250 }}
        >
          <div className="lb-tip-title">Score breakdown</div>
          <div className="lb-tip-row">
            <span>LeetCode</span><span style={{ color: 'var(--lc)' }}>{fmt(lc)} / 30</span>
          </div>
          {lcData.prob && <>
            <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
              <span>Problems (UDG)</span><span>{fmt(lcData.prob.cappedPts)} pts</span>
            </div>
            <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
              <span>Active weeks</span><span>{lcData.prob.activeWeeks}/26</span>
            </div>
          </>}
          {lcData.contest && <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
            <span>Contests</span><span>{lcData.contest.attended}/{lcData.contest.expected}</span>
          </div>}

          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span>CodeChef</span><span style={{ color: 'var(--cc)' }}>{fmt(cc)} / 30</span>
          </div>

          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span>Codeforces</span><span style={{ color: 'var(--cf)' }}>{fmt(cf)} / 20</span>
          </div>

          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span>HackerRank</span><span>{fmt(hr)} / 20</span>
          </div>
          {hrData.psStars !== undefined && <div className="lb-tip-row" style={{ paddingLeft: 10 }}>
            <span>PS / SQL / Java / Py</span>
            <span>{hrData.psStars}★ · {hrData.sqlStars ?? 0}★ · {hrData.javStars ?? 0}★ · {hrData.pytStars ?? 0}★</span>
          </div>}

          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span style={{ fontWeight: 700, color: 'var(--fg)' }}>Total</span>
            <span style={{ fontWeight: 700, color: 'var(--fg)' }}>{fmt(total)} / 100</span>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default function OverallLeaderboard() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [page,    setPage]    = useState(1)
  const [search,  setSearch]  = useState('')
  const [branch,  setBranch]  = useState('')
  const [college, setCollege] = useState('')
  const [year,    setYear]    = useState('')
  const [filterOpts, setFilterOpts] = useState({ branches: [], colleges: [], years: [] })
  const searchRef = useRef(null)

  // ── CSV Export ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10)
  const { exporting, exportCSV } = useExportCSV(
    async () => {
      const r = await leaderboardAPI.overall(1, 9999, college, year, '')
      return r.data?.data || []
    },
    (rows) => ({
      headers: ['Rank','Name','Roll Number','Branch','College','LC Handle','CC Handle','CF Handle','HR Handle','LC Score','CC Score','CF Score','HR Score','Total Score'],
      rows: rows.map((r, i) => [
        i + 1,
        r.full_name || '',
        r.roll_number || '',
        r.branch || '',
        r.college || '',
        r.lc_handle || '',
        r.cc_handle || '',
        r.cf_handle || '',
        r.hr_handle || '',
        (r.lc?.score ?? r.lc_score ?? 0).toFixed(2),
        (r.cc?.score ?? r.cc_score ?? 0).toFixed(2),
        (r.cf?.score ?? r.cf_score ?? 0).toFixed(2),
        (r.hr?.score ?? r.hr_score ?? 0).toFixed(2),
        (r.final_score ?? r.total_score ?? 0).toFixed(2),
      ])
    }),
    `overall_leaderboard_${today}.csv`
  )

  useEffect(() => {
    leaderboardAPI.getFilters()
      .then(r => setFilterOpts(r.data.data || { branches: [], colleges: [], years: [] }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.overall(page, 50, college, year, search)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [page, college, year])

  const allRows = data?.data  || []
  const total   = data?.total || 0
  const pages   = Math.ceil(total / 50)

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
          <div className="lb-card-title">Overall Leaderboard</div>
          <div className="lb-card-sub">All-time · 100 pts · Full journey · Hover any row for breakdown</div>
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
          {total > 0 && <span className="badge badge-gray">{total} students</span>}
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="lb-search-bar" style={{ flexWrap: 'wrap', gap: 8 }}>
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
        <div className="lb-col-header">
          <div style={{ width: 28 }}>#</div>
          <div style={{ flex: 1 }}>Student</div>
          <div style={{ display: 'flex', gap: 14 }}>
            {['LC', 'CC', 'CF', 'HR'].map(l => (
              <div key={l} style={{ width: 38, textAlign: 'center' }} className="lb-col-label">{l}</div>
            ))}
          </div>
          <div style={{ width: 1 }} />
          <div style={{ width: 72, textAlign: 'right' }} className="lb-col-label">Score</div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '6px 0' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Computing scores…</div>
        ) : error ? (
          <div className="msg msg-error" style={{ margin: '20px 16px' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div className="lb-no-results">
            {hasFilters ? 'No students match your filters.' : 'No data yet. Sync profiles to populate.'}
          </div>
        ) : (
          <div className="lb-rows-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <PlacementRow key={row.student_email || row.email} row={row} rank={row.rank ?? (page - 1) * 50 + i + 1} />
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
