// WeeklyLeaderboard.jsx
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, ChevronDown, Download } from 'lucide-react'
import { leaderboardAPI } from '../../api/api'
import { useExportCSV } from '../../hooks/useExportCSV'
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
    <div className="lb-week-col">
      <div style={{
        fontSize: '0.92rem',
        fontWeight: 700,
        color: has ? color : 'var(--fg-subtle)',
        lineHeight: 1,
      }}>
        {has ? val.toFixed(1) : '—'}
      </div>
    </div>
  )
}

// ── Portal Tooltip ────────────────────────────────────────────────────────────
function WeekRow({ row, rank }) {
  const [tip, setTip]      = useState(false)
  const [pos, setPos]      = useState({ top: 0, right: 0 })
  const rowRef             = useRef(null)
  const tipRef             = useRef(null)

  const lcScore   = row.lc_score  ?? row.lcScore  ?? 0
  const ccScore   = row.cc_score  ?? row.ccScore  ?? 0
  const cfScore   = row.cf_score  ?? row.cfScore  ?? 0
  const composite = row.final_score ?? row.total_score ?? row.composite ?? 0
  const plats     = row.platforms_attended ?? row.platformsAttended ?? 0

  function recalcPos() {
    if (!rowRef.current) return
    const rect = rowRef.current.getBoundingClientRect()
    const vpH  = window.innerHeight
    const tipH = tipRef.current?.offsetHeight || 210
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

      {/* Identity + bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {row.full_name}
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 1 }}>
          {row.roll_number}
          {row.branch ? <span style={{ color: 'var(--fg-subtle)' }}> · {row.branch}</span> : null}
        </div>
        <div className="lb-bar-track" style={{ marginTop: 6, width: '100%' }}>
          <div className="lb-bar-fill cf" style={{ width: `${Math.min(100, composite)}%` }} />
        </div>
      </div>

      {/* Platform scores */}
      <div className="lb-week-cols">
        <PlatScore val={lcScore} color="var(--lc)" />
        <PlatScore val={ccScore} color="var(--cc)" />
        <PlatScore val={cfScore} color="var(--cf)" />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 32, background: 'var(--border-subtle)', flexShrink: 0 }} />

      {/* Composite */}
      <div className="lb-score-cell" style={{ width: 72, minWidth: 72 }}>
        <div className="lb-score-num">{composite.toFixed(1)}</div>
        <div className="lb-score-denom">/ 100</div>
        <div style={{ marginTop: 3, textAlign: 'right' }}>
          {row.eligible
            ? <span className="badge badge-green" style={{ fontSize: '0.62rem', padding: '1px 5px' }}>Award</span>
            : <span style={{ fontSize: '0.62rem', color: 'var(--fg-subtle)' }}>{plats}/3</span>
          }
        </div>
      </div>

      {/* Portal Tooltip — renders in document.body, never clipped */}
      {tip && createPortal(
        <div
          ref={tipRef}
          className="lb-tip lb-tip-portal"
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
        >
          <div className="lb-tip-title">Weekly breakdown</div>
          <div className="lb-tip-row">
            <span>LeetCode <span style={{ color: 'var(--fg-subtle)', fontSize: '0.68rem' }}>×0.35</span></span>
            <span style={{ color: lcScore > 0 ? 'var(--lc)' : 'var(--fg-subtle)' }}>
              {lcScore > 0 ? lcScore.toFixed(2) : 'DNS'}
            </span>
          </div>
          <div className="lb-tip-row">
            <span>CodeChef <span style={{ color: 'var(--fg-subtle)', fontSize: '0.68rem' }}>×0.30</span></span>
            <span style={{ color: ccScore > 0 ? 'var(--cc)' : 'var(--fg-subtle)' }}>
              {ccScore > 0 ? ccScore.toFixed(2) : 'DNS'}
            </span>
          </div>
          <div className="lb-tip-row">
            <span>Codeforces <span style={{ color: 'var(--fg-subtle)', fontSize: '0.68rem' }}>×0.35</span></span>
            <span style={{ color: cfScore > 0 ? 'var(--cf)' : 'var(--fg-subtle)' }}>
              {cfScore > 0 ? cfScore.toFixed(2) : 'DNS'}
            </span>
          </div>
          <div className="lb-tip-divider" />
          <div className="lb-tip-row">
            <span>Platforms</span>
            <span>{plats} / 3</span>
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
        </div>,
        document.body
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
  const [search,  setSearch]  = useState('')
  const [branch,  setBranch]  = useState('')
  const [college, setCollege] = useState('')
  const [year,    setYear]    = useState('')
  const [filterOpts, setFilterOpts] = useState({ branches: [], colleges: [], years: [] })
  const searchRef = useRef(null)

  // ── CSV Export ────────────────────────────────────────────────────────────
  const { exporting, exportCSV } = useExportCSV(
    async () => {
      const r = await leaderboardAPI.weekly(selWk, 1, 9999, college, year)
      return r.data?.data || []
    },
    (rows) => ({
      headers: ['Rank','Name','Roll Number','Branch','College','LC Handle','CC Handle','CF Handle','LC Score','CC Score','CF Score','Composite','Platforms','Eligible'],
      rows: rows.map((r, i) => [
        i + 1,
        r.full_name || '',
        r.roll_number || '',
        r.branch || '',
        r.college || '',
        r.lc_handle || '',
        r.cc_handle || '',
        r.cf_handle || '',
        (r.lc_score ?? 0).toFixed(2),
        (r.cc_score ?? 0).toFixed(2),
        (r.cf_score ?? 0).toFixed(2),
        (r.final_score ?? r.composite ?? 0).toFixed(2),
        r.platforms_attended ?? 0,
        r.eligible ? 'Yes' : 'No',
      ])
    }),
    `weekly_leaderboard_${selWk}.csv`
  )

  // Load dynamic filter options once
  useEffect(() => {
    leaderboardAPI.getFilters()
      .then(r => setFilterOpts(r.data.data || { branches: [], colleges: [], years: [] }))
      .catch(() => {}) // fail silently, filters just won't appear
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    leaderboardAPI.weekly(selWk, page, 50, college, year)
      .then(r => setData(r.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [selWk, page, college, year])

  const allRows = data?.data || []
  const total   = data?.total || 0
  const pages   = Math.ceil(total / 50)
  const isLive  = selWk === thisWk

  // Client-side search + branch filter
  const rows = useMemo(() => {
    let r = allRows
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(x => (x.full_name || '').toLowerCase().includes(q) || (x.roll_number || '').toLowerCase().includes(q))
    }
    if (branch) {
      r = r.filter(x => (x.branch || '').toLowerCase() === branch.toLowerCase())
    }
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
            {isLive && <div className="lb-live-dot" />}
            Weekly Performers
          </div>
          <div className="lb-card-sub">Contest performance only · Award requires ≥ 2 platforms</div>
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

        {/* Branch dropdown */}
        {filterOpts.branches.length > 0 && (
          <select style={selectStyle} value={branch} onChange={e => { setBranch(e.target.value); setPage(1) }}>
            <option value="">All Branches</option>
            {filterOpts.branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        )}

        {/* College dropdown */}
        {filterOpts.colleges.length > 0 && (
          <select style={selectStyle} value={college} onChange={e => { setCollege(e.target.value); setPage(1) }}>
            <option value="">All Colleges</option>
            {filterOpts.colleges.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}

        {/* Year dropdown */}
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
          <div className="lb-week-cols">
            <div className="lb-week-col lb-col-label">LC</div>
            <div className="lb-week-col lb-col-label">CC</div>
            <div className="lb-week-col lb-col-label">CF</div>
          </div>
          <div style={{ width: 1, flexShrink: 0 }} />
          <div style={{ width: 72, textAlign: 'right', flexShrink: 0 }} className="lb-col-label">Score</div>
        </div>
      )}

      {/* Body */}
      <div style={{ padding: '6px 0' }}>
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading…</div>
        ) : error ? (
          <div className="msg msg-error" style={{ margin: '20px 16px' }}>{error}</div>
        ) : rows.length === 0 ? (
          <div className="lb-no-results">
            {hasFilters ? 'No students match your filters.' : 'No contest data for this week.'}
          </div>
        ) : (
          <div className="lb-rows-list" style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map((row, i) => (
              <WeekRow key={row.student_email || row.email} row={row} rank={(page - 1) * 50 + i + 1} />
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
