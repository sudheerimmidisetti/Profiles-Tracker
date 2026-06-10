// frontend/student/src/components/ActivityHeatmap.jsx
// Shared heatmap for LeetCode, Codeforces, CodeChef.
// Supports: year filter, month group separators, hover tooltip, day-click drawer with DB fetch.
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import './ActivityHeatmap.css'


const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_ABBR = ['S','M','T','W','T','F','S']

// ── Parse any format into { 'YYYY-MM-DD': count } ─────────────────────────────
function parseCalendar(calendar) {
  const map = {}
  if (!calendar) return map

  let raw = calendar
  if (typeof calendar === 'string') {
    try { raw = JSON.parse(calendar) } catch { return map }
  }

  if (Array.isArray(raw)) {
    // CC format: [{date:"2024-6-10", count:32}]
    raw.forEach(({ date, count }) => {
      if (!date) return
      const parts = String(date).split('-')
      if (parts.length === 3) {
        const iso = `${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`
        map[iso] = (map[iso] || 0) + (parseInt(count) || 0)
      }
    })
  } else if (typeof raw === 'object') {
    // LC/CF format: { "1767225600": 2 }  OR  { "2024-01-01": 2 }
    Object.entries(raw).forEach(([key, cnt]) => {
      const num = Number(key)
      const dt  = !isNaN(num) && num > 1e9
        ? new Date(num * 1000)
        : new Date(key)
      if (!isNaN(dt)) {
        const iso = dt.toISOString().slice(0, 10)
        map[iso] = (map[iso] || 0) + (parseInt(cnt) || 0)
      }
    })
  }
  return map
}

// ── Find years with data ───────────────────────────────────────────────────────
function getAvailableYears(map) {
  const years = new Set(Object.keys(map).map(iso => iso.slice(0, 4)))
  const currentYear = String(new Date().getFullYear())
  years.add(currentYear)
  return [...years].sort().reverse()
}

// ── Build month-grouped grid for a given year ──────────────────────────────────
// Returns [{monthIdx, monthName, weeks: [[{iso,date,count,inYear}]]}]
function buildGrid(year, map) {
  const y = parseInt(year)
  const today = new Date(); today.setHours(23,59,59,999)

  // Start from Jan 1 of selected year, aligned to Sunday
  const jan1 = new Date(y, 0, 1)
  const gridStart = new Date(jan1)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  // End: Dec 31 (or today if current year)
  const isCurrentYear = y === new Date().getFullYear()
  const yearEnd = isCurrentYear ? today : new Date(y, 11, 31, 23, 59, 59)

  // Pad end to complete the last week
  const gridEnd = new Date(yearEnd)
  while (gridEnd.getDay() !== 6) gridEnd.setDate(gridEnd.getDate() + 1)

  // Build all days
  const allDays = []
  const cur = new Date(gridStart)
  while (cur <= gridEnd) {
    const iso = cur.toISOString().slice(0, 10)
    allDays.push({
      iso,
      date:   new Date(cur),
      count:  map[iso] || 0,
      inYear: cur.getFullYear() === y,
    })
    cur.setDate(cur.getDate() + 1)
  }

  // Chunk into 7-day weeks
  const allWeeks = []
  for (let i = 0; i < allDays.length; i += 7) {
    allWeeks.push(allDays.slice(i, i + 7))
  }

  // Group weeks by the month of their first in-year day
  const groups = []
  let curGroup = null
  allWeeks.forEach(week => {
    const anchor = week.find(d => d.inYear) || week[0]
    const mIdx = anchor.date.getFullYear() === y ? anchor.date.getMonth() : -1
    if (mIdx < 0) { if (curGroup) curGroup.weeks.push(week); return }
    if (!curGroup || curGroup.monthIdx !== mIdx) {
      curGroup = { monthIdx: mIdx, monthName: MONTHS[mIdx], fullName: FULL_MONTHS[mIdx], weeks: [] }
      groups.push(curGroup)
    }
    curGroup.weeks.push(week)
  })

  return groups
}

function heatLevel(count, max) {
  if (count === 0 || max === 0) return 0
  const pct = count / max
  if (pct < 0.25) return 1
  if (pct < 0.50) return 2
  if (pct < 0.75) return 3
  return 4
}

// ── Tooltip component ─────────────────────────────────────────────────────────
function HoverTooltip({ cell, color }) {
  if (!cell || !cell.inYear) return null
  const dateStr = cell.date.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  })
  return (
    <div className="ahm-tooltip" style={{ '--ahm-color': color }}>
      <div className="ahm-tt-date">{dateStr}</div>
      <div className="ahm-tt-count" style={{ color }}>
        {cell.count === 0
          ? 'No submissions'
          : `${cell.count} submission${cell.count !== 1 ? 's' : ''}`}
      </div>
      {cell.count > 0 && (
        <div className="ahm-tt-hint">Click to see details →</div>
      )}
    </div>
  )
}

// ── Day Detail Drawer ─────────────────────────────────────────────────────────
function DayDrawer({ cell, platform, recentSubs, color, onClose }) {
  const [dbSubs,   setDbSubs]   = useState(null)  // null = not fetched yet
  const [loading,  setLoading]  = useState(false)

  // Fetch from student_submissions table on mount
  useEffect(() => {
    if (!cell?.iso || !platform) return
    setLoading(true)
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || ''
    axios.get(`/api/analytics/submissions/${platform}`, {
      params: { date: cell.iso },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => setDbSubs(r.data?.data || []))
      .catch(() => setDbSubs([]))  // fall back silently
      .finally(() => setLoading(false))
  }, [cell?.iso, platform])

  // Merge: prefer DB rows; fall back to in-memory recentSubs for same date
  const matchSubs = useMemo(() => {
    if (dbSubs && dbSubs.length > 0) return dbSubs
    if (!recentSubs?.length || !cell?.iso) return []
    return recentSubs.filter(s => {
      const ts = s.submitted_at || s.timestamp || s.createdAt
      if (!ts) return false
      const d = new Date(typeof ts === 'number' && ts > 1e10 ? ts : ts * 1000)
      return !isNaN(d) && d.toISOString().slice(0, 10) === cell.iso
    })
  }, [dbSubs, recentSubs, cell?.iso])

  if (!cell) return null

  const statusInfo = (s) => {
    const raw = (s.status || s.verdict || s.result || '').toString().toUpperCase().trim()
    if (raw === 'OK' || raw.includes('ACCEPT') || raw === 'AC')
      return { label: 'Accepted', cls: 'ac', icon: '✓' }
    if (raw.includes('WRONG') || raw === 'WA' || raw.includes('INCORRECT'))
      return { label: 'Wrong Answer', cls: 'wa', icon: '✗' }
    if (raw.includes('TIME') || raw === 'TLE')
      return { label: 'Time Limit Exceeded', cls: 'tle', icon: '⏱' }
    if (raw.includes('MEMORY') || raw === 'MLE')
      return { label: 'Memory Limit Exceeded', cls: 'mle', icon: '💾' }
    if (raw.includes('RUNTIME') || raw === 'RE' || raw.includes('RUNTIME_ERROR'))
      return { label: 'Runtime Error', cls: 're', icon: '💥' }
    if (raw.includes('COMPIL') || raw === 'CE')
      return { label: 'Compilation Error', cls: 'ce', icon: '🔧' }
    if (raw.includes('PARTIAL') || raw === 'PA')
      return { label: 'Partial Score', cls: 'pa', icon: '◑' }
    if (raw.includes('TESTCASE') || raw.includes('FAILED'))
      return { label: 'Test Case Failed', cls: 'wa', icon: '✗' }
    if (raw.includes('SKIPPED') || raw.includes('SKIP'))
      return { label: 'Skipped', cls: 'na', icon: '—' }
    return { label: raw || 'Accepted', cls: 'ac', icon: '✓' }
  }

  const dateStr = cell.date.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="ahm-drawer-overlay" onClick={onClose}>
      <div className="ahm-drawer" onClick={e => e.stopPropagation()} style={{ '--ahm-color': color }}>
        <div className="ahm-drawer-head">
          <div>
            <div className="ahm-drawer-date">{dateStr}</div>
            <div className="ahm-drawer-kpi" style={{ color }}>
              {cell.count} submission{cell.count !== 1 ? 's' : ''}
            </div>
          </div>
          <button className="ahm-drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ahm-drawer-body">
          {loading ? (
            <div className="ahm-drawer-empty">
              <div className="ahm-drawer-empty-icon" style={{ animation: 'spin 1s linear infinite' }}>⟳</div>
              <div className="ahm-drawer-empty-title">Loading submissions…</div>
            </div>
          ) : matchSubs.length > 0 ? (
            <>
              <div className="ahm-drawer-section-title">Problems Solved</div>
              <div className="ahm-drawer-list">
                {matchSubs.map((s, i) => {
                  const st = statusInfo(s)
                  const name = s.problem_name || s.problemName || s.title
                    || s.challenge_name || s.name || `Submission ${i + 1}`
                  return (
                    <div key={i} className="ahm-drawer-row">
                      <span className={`ahm-verdict-chip ahm-vc-${st.cls}`}>
                        <span>{st.icon}</span> {st.label}
                      </span>
                      <div className="ahm-drawer-row-info">
                        <span className="ahm-drawer-prob">{name}</span>
                        <div className="ahm-drawer-row-meta">
                          {s.language && <span className="ahm-drawer-lang">{s.language}</span>}
                          {s.runtime_ms && (
                            <span className="ahm-drawer-perf">⏱ {s.runtime_ms} ms</span>
                          )}
                          {s.memory_kb && (
                            <span className="ahm-drawer-perf">💾 {s.memory_kb} KB</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="ahm-drawer-empty">
              <div className="ahm-drawer-empty-icon">📊</div>
              <div className="ahm-drawer-empty-title">
                {cell.count} submission{cell.count !== 1 ? 's' : ''} on this day
              </div>
              <div className="ahm-drawer-empty-sub">
                Detailed problem data will appear here after the next sync.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ActivityHeatmap({
  calendar,
  color             = '#22c55e',
  platformLabel     = '',
  platform          = '',           // e.g. 'leetcode' | 'codeforces' | 'codechef'
  recentSubmissions = [],
  title             = 'Submission Activity',
}) {

  const dayMap = useMemo(() => parseCalendar(calendar), [calendar])
  const years  = useMemo(() => getAvailableYears(dayMap), [dayMap])

  const [selYear,     setSelYear]     = useState(() => years[0] || String(new Date().getFullYear()))
  const [hovered,     setHovered]     = useState(null)
  const [tooltipPos,  setTooltipPos]  = useState({ x: 0, y: 0 })
  const [clickedCell, setClickedCell] = useState(null)
  const gridRef = useRef(null)

  useEffect(() => {
    if (years.length && !years.includes(selYear)) setSelYear(years[0])
  }, [years])

  const monthGroups = useMemo(() => buildGrid(selYear, dayMap), [selYear, dayMap])

  const maxCount = useMemo(() => {
    const vals = Object.entries(dayMap)
      .filter(([iso]) => iso.startsWith(selYear))
      .map(([, c]) => c)
    return Math.max(1, ...vals)
  }, [dayMap, selYear])

  // Stats
  const yearEntries = useMemo(() =>
    Object.entries(dayMap).filter(([iso]) => iso.startsWith(selYear))
  , [dayMap, selYear])
  const totalSubs  = yearEntries.reduce((a, [, c]) => a + c, 0)
  const activeDays = yearEntries.filter(([, c]) => c > 0).length

  const streak = useMemo(() => {
    let s = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      if ((dayMap[d.toISOString().slice(0, 10)] || 0) > 0) s++
      else if (i > 0) break
    }
    return s
  }, [dayMap])

  const handleMouseEnter = useCallback((e, cell) => {
    if (!cell.inYear) return
    const rect = e.currentTarget.getBoundingClientRect()
    const gridRect = gridRef.current?.getBoundingClientRect() || { left: 0, top: 0 }
    setTooltipPos({
      x: rect.left - gridRect.left + rect.width / 2,
      y: rect.top  - gridRect.top  - 8,
    })
    setHovered(cell)
  }, [])

  const handleClick = useCallback((cell) => {
    if (!cell.inYear || cell.count === 0) return
    setClickedCell(cell)
  }, [])

  return (
    <div className="ahm-root">
      {/* ── Header ── */}
      <div className="ahm-header">
        <div className="ahm-header-left">
          <span className="ahm-title">{title}</span>
          <div className="ahm-stats-row">
            <span className="ahm-stat-item">
              <strong>{totalSubs.toLocaleString()}</strong> submissions in {selYear}
            </span>
            <span className="ahm-stat-dot">·</span>
            <span className="ahm-stat-item">
              <strong>{activeDays}</strong> active days
            </span>
            {streak > 1 && (
              <>
                <span className="ahm-stat-dot">·</span>
                <span className="ahm-stat-item">🔥 <strong>{streak}</strong>-day streak</span>
              </>
            )}
          </div>
        </div>

        {/* Year pills */}
        {years.length > 1 && (
          <div className="ahm-year-pills">
            {years.map(y => (
              <button
                key={y}
                className={`ahm-year-btn${y === selYear ? ' active' : ''}`}
                style={y === selYear
                  ? { borderColor: color, color, background: `color-mix(in srgb, ${color} 12%, transparent)` }
                  : {}}
                onClick={() => setSelYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scrollable grid ── */}
      <div className="ahm-scroll-wrap">
        <div className="ahm-grid-container" ref={gridRef}>
          {/* Day-of-week axis */}
          <div className="ahm-dow-col">
            <div className="ahm-dow-spacer" /> {/* Align with month labels */}
            {DAYS_ABBR.map((d, i) => (
              <div key={i} className="ahm-dow-label">{i % 2 === 1 ? d : ''}</div>
            ))}
          </div>

          {/* Month groups */}
          {monthGroups.map((mg, mi) => (
            <div key={`${mg.monthName}-${mi}`} className="ahm-month-block">
              {/* Month name above */}
              <div className="ahm-month-name" title={mg.fullName}>{mg.monthName}</div>

              {/* Week columns for this month */}
              <div className="ahm-month-weeks">
                {mg.weeks.map((week, wi) => (
                  <div key={wi} className="ahm-week">
                    {week.map((cell, di) => {
                      const level = heatLevel(cell.count, maxCount)
                      const isHov = hovered?.iso === cell.iso
                      const isClk = clickedCell?.iso === cell.iso
                      return (
                        <div
                          key={di}
                          className={`ahm-cell${!cell.inYear ? ' ahm-cell-out' : ''}${cell.count > 0 && cell.inYear ? ' ahm-cell-active' : ''}`}
                          style={cell.inYear && level > 0 ? {
                            background: color,
                            opacity: level === 1 ? 0.22 : level === 2 ? 0.48 : level === 3 ? 0.74 : 1,
                            transform: isHov || isClk ? 'scale(1.4)' : undefined,
                            outline: isClk ? `2px solid ${color}` : undefined,
                            outlineOffset: '1px',
                          } : undefined}
                          onMouseEnter={e => handleMouseEnter(e, cell)}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => handleClick(cell)}
                          title={cell.inYear ? `${cell.date.toDateString()}: ${cell.count} submissions` : undefined}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Relative tooltip */}
          {hovered && hovered.inYear && (
            <div className="ahm-tooltip-wrap" style={{
              left: tooltipPos.x,
              top:  tooltipPos.y,
            }}>
              <HoverTooltip cell={hovered} color={color} />
            </div>
          )}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="ahm-legend-row">
        <span className="ahm-legend-txt">Less</span>
        {[0,1,2,3,4].map(l => (
          <div key={l} className="ahm-legend-cell" style={l > 0 ? {
            background: color,
            opacity: l === 1 ? 0.22 : l === 2 ? 0.48 : l === 3 ? 0.74 : 1,
          } : {}} />
        ))}
        <span className="ahm-legend-txt">More</span>
      </div>

      {/* ── Day Detail Drawer ── */}
      {clickedCell && (
        <DayDrawer
          cell={clickedCell}
          platform={platform}
          recentSubs={recentSubmissions}
          color={color}
          onClose={() => setClickedCell(null)}
        />
      )}

    </div>
  )
}
