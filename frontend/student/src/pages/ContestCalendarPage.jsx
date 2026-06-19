import { useState, useEffect } from 'react'
import { contestsAPI } from '../api/api'
import Header from '../components/Header'
import { Calendar, ChevronLeft, ChevronRight, Clock, ExternalLink, Bell, X } from 'lucide-react'
import lcLogo from '../assets/leetcode.svg'
import cfLogo from '../assets/codeforces.svg'
import ccLogo from '../assets/codechef.svg'
import './ContestCalendarPage.css'

const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#f89f1b', bg: 'rgba(248,159,27,.15)', logo: lcLogo },
  codeforces: { label: 'Codeforces', color: '#1a8cff', bg: 'rgba(26,140,255,.15)', logo: cfLogo },
  codechef:   { label: 'CodeChef',   color: '#22c55e', bg: 'rgba(34,197,94,.15)',  logo: ccLogo },
}

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST'
}
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric',
    month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST'
}

// Generate .ics file for Google/Apple Calendar
function downloadICS(contest) {
  const p = PLAT[contest.platform] || {}
  const start = new Date(contest.startTime)
  const end   = contest.durationMin
    ? new Date(start.getTime() + contest.durationMin * 60000)
    : new Date(start.getTime() + 90 * 60000) // default 90 min

  const pad = n => String(n).padStart(2, '0')
  const toICS = d =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ACET CPTrack//Contest Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${contest.platform}-${contest.contestId}@acet-cptrack`,
    `DTSTART:${toICS(start)}`,
    `DTEND:${toICS(end)}`,
    `SUMMARY:${contest.name} (${p.label || contest.platform})`,
    `DESCRIPTION:Contest on ${p.label || contest.platform}. Join at: ${contest.url}`,
    `URL:${contest.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${contest.name.replace(/[^a-z0-9]/gi,'_')}.ics`
  a.click()
  URL.revokeObjectURL(a.href)
}

// Side panel for selected contest
function ContestPanel({ contest, onClose }) {
  if (!contest) return null
  const p = PLAT[contest.platform] || {}
  return (
    <div className="cal-panel" onClick={e => e.stopPropagation()}>
      <div className="cal-panel-header">
        <span className="cal-panel-badge" style={{ background: p.bg, color: p.color }}>
          {p.logo && <img src={p.logo} alt={p.label} />}
          {p.label || contest.platform}
        </span>
        <button className="cal-panel-close" onClick={onClose}><X size={15}/></button>
      </div>
      <h3 className="cal-panel-title">{contest.name}</h3>
      <div className="cal-panel-meta">
        <div className="cal-panel-row">
          <Clock size={13}/> {fmtDateTime(contest.startTime)}
        </div>
        {contest.durationMin && (
          <div className="cal-panel-row">
            <span style={{ fontSize: '0.85rem' }}>⏱</span> {contest.durationMin} min
          </div>
        )}
      </div>
      <div className="cal-panel-actions">
        <a href={contest.url} target="_blank" rel="noopener" className="btn btn-primary cal-btn">
          <ExternalLink size={13}/> Open Contest
        </a>
        <button onClick={() => downloadICS(contest)} className="btn btn-secondary cal-btn">
          <Bell size={13}/> Add to Calendar (.ics)
        </button>
      </div>
      <p className="cal-panel-hint">
        Adding to calendar will set a reminder before the contest starts.
        The .ics file opens in Google Calendar, Apple Calendar, and Outlook.
      </p>
    </div>
  )
}

export default function ContestCalendarPage() {
  const [contests,  setContests]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [selected,  setSelected]  = useState(null)
  const [platFilter, setPlatFilter] = useState('all')

  // Calendar navigation
  const today = new Date()
  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth())

  useEffect(() => {
    setLoading(true)
    contestsAPI.calendar(6)
      .then(r => setContests(r.data.data || []))
      .catch(() => setContests([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = platFilter === 'all'
    ? contests
    : contests.filter(c => c.platform === platFilter)

  // Map contests by date (YYYY-MM-DD in IST)
  const byDate = {}
  for (const c of filtered) {
    const d = new Date(c.startTime).toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(c)
  }

  // Calendar grid
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDow    = new Date(calYear, calMonth, 1).getDay()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11) }
    else setCalMonth(m => m-1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0) }
    else setCalMonth(m => m+1)
  }

  const todayStr = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

  return (
    <>
      <Header title="Contest Calendar" breadcrumb="Contests" />
      <div className="page">
        <div className="cal-layout" onClick={() => setSelected(null)}>
          {/* Left: calendar */}
          <div className="cal-main" onClick={e => e.stopPropagation()}>
            {/* Header row */}
            <div className="cal-topbar">
              <div className="cal-month-nav">
                <button onClick={prevMonth} className="cal-nav-btn"><ChevronLeft size={15}/></button>
                <span className="cal-month-label">{MONTHS[calMonth]} {calYear}</span>
                <button onClick={nextMonth} className="cal-nav-btn"><ChevronRight size={15}/></button>
              </div>

              {/* Platform filter */}
              <div className="cal-plat-filter">
                {['all','leetcode','codeforces','codechef'].map(k => (
                  <button key={k}
                    onClick={() => setPlatFilter(k)}
                    className={`cal-plat-btn ${platFilter === k ? 'active' : ''}`}
                    style={platFilter === k && k !== 'all'
                      ? { borderColor: PLAT[k].color, color: PLAT[k].color, background: PLAT[k].bg }
                      : {}}
                  >
                    {k === 'all' ? 'All' : (
                      <>{PLAT[k].logo && <img src={PLAT[k].logo} alt={k} style={{ width: 12, height: 12 }} />} {PLAT[k].label}</>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Day headers */}
            <div className="cal-grid-header">
              {DAYS.map(d => <div key={d}>{d}</div>)}
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto' }} />
              </div>
            ) : (
              <div className="cal-grid">
                {cells.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="cal-cell cal-cell-empty" />
                  const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                  const dayContests = byDate[dateStr] || []
                  const isToday = dateStr === todayStr
                  const isPast  = new Date(dateStr) < new Date(todayStr)

                  return (
                    <div key={d}
                      className={`cal-cell ${isToday ? 'cal-cell-today' : ''} ${isPast ? 'cal-cell-past' : ''}`}
                    >
                      <span className={`cal-cell-num ${isToday ? 'today' : ''}`}>{d}</span>
                      <div className="cal-events">
                        {dayContests.slice(0,3).map((c, ci) => {
                          const p = PLAT[c.platform] || {}
                          return (
                            <button key={ci}
                              className="cal-event-pill"
                              style={{ background: p.bg, color: p.color, borderColor: p.color + '44' }}
                              onClick={() => setSelected(c)}
                              title={c.name}
                            >
                              {p.logo && <img src={p.logo} alt="" style={{ width: 10, height: 10, flexShrink: 0 }} />}
                              <span className="cal-event-name">{fmtTime(c.startTime)}</span>
                            </button>
                          )
                        })}
                        {dayContests.length > 3 && (
                          <span className="cal-more">+{dayContests.length-3} more</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right: detail panel OR upcoming list */}
          <div className="cal-sidebar">
            {selected ? (
              <ContestPanel contest={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="cal-upcoming">
                <div className="cal-upcoming-title">
                  <Calendar size={14}/> Upcoming Contests
                </div>
                {filtered.filter(c => new Date(c.startTime) > new Date()).slice(0, 10).map((c, i) => {
                  const p = PLAT[c.platform] || {}
                  return (
                    <button key={i} className="cal-upcoming-item" onClick={() => setSelected(c)}>
                      <div className="cal-upcoming-dot" style={{ background: p.color }} />
                      <div className="cal-upcoming-info">
                        <div className="cal-upcoming-name">{c.name}</div>
                        <div className="cal-upcoming-time">{fmtDateTime(c.startTime)}</div>
                      </div>
                    </button>
                  )
                })}
                {!loading && filtered.filter(c => new Date(c.startTime) > new Date()).length === 0 && (
                  <div style={{ color: 'var(--fg-muted)', fontSize: '0.8rem', padding: 12 }}>
                    No upcoming contests in the next 6 weeks.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
