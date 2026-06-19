// Admin ContestPage — same UI as student version but uses admin-auth API endpoints
import { useState, useEffect, useCallback } from 'react'
import { contestsAPI, cohortsAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import {
  Trophy, Clock, Users, ExternalLink, ChevronDown, ChevronLeft, ChevronRight,
  X, TrendingUp, TrendingDown, Minus,
  Calendar, Code2, Zap, Search, UsersRound, CalendarDays, LayoutGrid, Bell
} from 'lucide-react'
import lcLogo from '../assets/leetcode.svg'
import cfLogo from '../assets/codeforces.svg'
import ccLogo from '../assets/codechef.svg'

// ── Platform metadata ─────────────────────────────────────────────────────────
const PLAT = {
  leetcode:   { label: 'LeetCode',   color: '#f89f1b', bg: 'rgba(248,159,27,.12)', logo: lcLogo },
  codeforces: { label: 'Codeforces', color: '#1a8cff', bg: 'rgba(26,140,255,.12)', logo: cfLogo },
  codechef:   { label: 'CodeChef',   color: '#22c55e', bg: 'rgba(34,197,94,.12)',  logo: ccLogo },
}

const MONTHS = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAYS_ABBR = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmtCalTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST'
}
function fmtCalDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric',
    month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
  }) + ' IST'
}

// ── .ics download ─────────────────────────────────────────────────────────────
function downloadICS(contest) {
  const p = PLAT[contest.platform] || {}
  const start = new Date(contest.startTime)
  const end   = contest.durationMin
    ? new Date(start.getTime() + contest.durationMin * 60000)
    : new Date(start.getTime() + 90 * 60000)
  const pad = n => String(n).padStart(2,'0')
  const toICS = d =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`
  const ics = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ACET CPTrack//Admin//EN',
    'CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
    `UID:${contest.platform}-${contest.contestId}@acet-admin`,
    `DTSTART:${toICS(start)}`,`DTEND:${toICS(end)}`,
    `SUMMARY:${contest.name} (${p.label||contest.platform})`,
    `DESCRIPTION:${contest.url}`,`URL:${contest.url}`,
    'END:VEVENT','END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${contest.name.replace(/[^a-z0-9]/gi,'_')}.ics`
  a.click(); URL.revokeObjectURL(a.href)
}

// ── Admin Contest Calendar Component ──────────────────────────────────────────
function AdminContestCalendar() {
  const [contests,    setContests]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [platFilter,  setPlatFilter]  = useState('all')
  const [panelItem,   setPanelItem]   = useState(null)
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

  const filtered = platFilter === 'all' ? contests : contests.filter(c => c.platform === platFilter)

  const byDate = {}
  for (const c of filtered) {
    const d = new Date(c.startTime).toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(c)
  }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDow    = new Date(calYear, calMonth, 1).getDay()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => { if (calMonth === 0) { setCalYear(y=>y-1); setCalMonth(11) } else setCalMonth(m=>m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y=>y+1); setCalMonth(0) } else setCalMonth(m=>m+1) }
  const todayStr = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Kolkata' })

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
      {/* Calendar */}
      <div style={{ flex: 1, minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={prevMonth} style={{ width: 28, height: 28, borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={13}/></button>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', minWidth: 150, textAlign: 'center' }}>{MONTHS[calMonth]} {calYear}</span>
            <button onClick={nextMonth} style={{ width: 28, height: 28, borderRadius: 7, border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={13}/></button>
          </div>
          {/* Platform filter pills */}
          <div style={{ display: 'flex', gap: 5 }}>
            {['all','leetcode','codeforces','codechef'].map(k => (
              <button key={k} onClick={() => setPlatFilter(k)} style={{
                padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                border: `1.5px solid ${platFilter===k && k!=='all' ? PLAT[k]?.color : platFilter===k ? 'var(--primary)' : 'var(--border)'}`,
                background: platFilter===k && k!=='all' ? PLAT[k]?.bg : platFilter===k ? 'rgba(99,102,241,.1)' : 'var(--bg)',
                color: platFilter===k && k!=='all' ? PLAT[k]?.color : platFilter===k ? 'var(--primary)' : 'var(--fg-muted)',
              }}>
                {k==='all' ? 'All' : PLAT[k].label}
              </button>
            ))}
          </div>
        </div>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: '1px solid var(--border)' }}>
          {DAYS_ABBR.map(d => <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: '0.63rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--fg-muted)' }}>{d}</div>)}
        </div>
        {/* Grid */}
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ width: 22, height: 22, margin: '0 auto' }} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} style={{ minHeight: 80, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
              const ds = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
              const dayC = byDate[ds] || []
              const isToday = ds === todayStr
              const isPast  = ds < todayStr
              return (
                <div key={d} style={{
                  minHeight: 80, padding: 5, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)',
                  background: isToday ? 'rgba(99,102,241,.05)' : 'transparent',
                  opacity: isPast ? .55 : 1,
                }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: '50%', fontSize: '0.75rem', fontWeight: isToday ? 800 : 600,
                    background: isToday ? 'var(--primary)' : 'transparent',
                    color: isToday ? '#fff' : 'var(--fg-muted)',
                  }}>{d}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                    {dayC.slice(0,3).map((c,ci) => {
                      const p = PLAT[c.platform] || {}
                      return (
                        <button key={ci} onClick={() => setPanelItem(c)} style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '2px 5px', borderRadius: 4,
                          background: p.bg, color: p.color, border: `1px solid ${p.color}33`,
                          fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {p.logo && <img src={p.logo} alt="" style={{ width: 9, height: 9, flexShrink: 0 }} />}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtCalTime(c.startTime)}</span>
                        </button>
                      )
                    })}
                    {dayC.length > 3 && <span style={{ fontSize: '0.58rem', color: 'var(--fg-muted)', paddingLeft: 5 }}>+{dayC.length-3}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ width: 260, flexShrink: 0 }}>
        {panelItem ? (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 6,
                background: PLAT[panelItem.platform]?.bg, color: PLAT[panelItem.platform]?.color,
                fontSize: '0.68rem', fontWeight: 700,
              }}>
                {PLAT[panelItem.platform]?.logo && <img src={PLAT[panelItem.platform].logo} alt="" style={{ width: 11, height: 11 }} />}
                {PLAT[panelItem.platform]?.label || panelItem.platform}
              </span>
              <button onClick={() => setPanelItem(null)} style={{ width: 24, height: 24, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={12}/></button>
            </div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', lineHeight: 1.35 }}>{panelItem.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span>🕐 {fmtCalDateTime(panelItem.startTime)}</span>
              {panelItem.durationMin && <span>⏱ {panelItem.durationMin} min</span>}
            </div>
            <a href={panelItem.url} target="_blank" rel="noopener" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px', borderRadius: 9, background: 'var(--primary)', color: '#fff',
              fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none',
            }}><ExternalLink size={12}/> Open Contest</a>
            <button onClick={() => downloadICS(panelItem)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px', borderRadius: 9, border: '1.5px solid var(--border)',
              background: 'var(--bg)', color: 'var(--fg-muted)', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
            }}><Bell size={12}/> Add to Calendar (.ics)</button>
          </div>
        ) : (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={12}/> Upcoming
            </div>
            {filtered.filter(c => new Date(c.startTime) > new Date()).slice(0,8).map((c,i) => {
              const p = PLAT[c.platform] || {}
              return (
                <button key={i} onClick={() => setPanelItem(c)} style={{
                  display: 'flex', alignItems: 'center', gap: 9, padding: '9px 14px',
                  borderBottom: '1px solid var(--border)', background: 'transparent',
                  border: 'none', borderBottomColor: 'var(--border)', borderBottomStyle: 'solid', borderBottomWidth: 1,
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--fg-muted)', marginTop: 2 }}>{fmtCalDateTime(c.startTime)}</div>
                  </div>
                </button>
              )
            })}
            {!loading && filtered.filter(c => new Date(c.startTime) > new Date()).length === 0 && (
              <div style={{ padding: 16, fontSize: '0.75rem', color: 'var(--fg-muted)' }}>No upcoming contests.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function fmtDuration(mins) {
  if (!mins) return null
  const h = Math.floor(mins / 60), m = mins % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-IN',
    { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' IST'
}
function timeUntil(iso) {
  if (!iso) return null
  const diff = new Date(iso) - Date.now()
  if (diff <= 0) return 'Started'
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)
  if (days > 0)  return `In ${days}d ${hours}h`
  if (hours > 0) return `In ${hours}h ${mins}m`
  return `In ${mins}m`
}

function TrendIcon({ change }) {
  if (change > 0)  return <TrendingUp size={12} style={{ color: '#22c55e' }} />
  if (change < 0)  return <TrendingDown size={12} style={{ color: '#ef4444' }} />
  return <Minus size={12} style={{ color: 'var(--fg-muted)' }} />
}

// ── Contest Card ──────────────────────────────────────────────────────────────
function ContestCard({ contest, onClick }) {
  const p = PLAT[contest.platform] || PLAT.leetcode
  const isPast = contest.status === 'past'
  return (
    <div
      onClick={() => onClick(contest)}
      style={{
        borderRadius: 14, padding: 18,
        border: `1.5px solid var(--border)`,
        background: 'var(--surface)',
        cursor: 'pointer',
        transition: 'transform .15s, box-shadow .15s, border-color .15s',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}
      className="contest-card-hover"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
          background: p.bg, color: p.color, letterSpacing: '.04em',
          display: 'inline-flex', alignItems: 'center', gap: 5,
        }}>
          {p.logo && <img src={p.logo} alt={p.label} style={{ width: 13, height: 13, objectFit: 'contain', flexShrink: 0 }} />}
          {p.label}
        </span>
        {isPast
          ? <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
              background: 'rgba(128,128,128,.1)', color: 'var(--fg-muted)' }}>Past</span>
          : <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px', borderRadius: 6,
              background: 'rgba(34,197,94,.1)', color: '#22c55e' }}>{timeUntil(contest.startTime) || 'Soon'}</span>
        }
      </div>

      <div style={{ fontSize: '0.88rem', fontWeight: 700, lineHeight: 1.35 }}>{contest.name}</div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {[
          [<Calendar size={11} />, fmtDate(contest.startTime)],
          [<Clock size={11} />,    fmtTime(contest.startTime)],
          [<Zap size={11} />,      fmtDuration(contest.durationMin)],
        ].filter(([, v]) => v).map(([icon, val], i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4,
            fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
            {icon}{val}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 6 }}>
        {isPast ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', fontWeight: 600, color: 'var(--fg-muted)' }}>
              <Users size={12} />{contest.participants} participant{contest.participants !== 1 ? 's' : ''}
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)' }}>View Results →</span>
          </>
        ) : (
          <a href={contest.url} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 13px', borderRadius: 8,
              background: 'rgba(34,197,94,.12)', color: '#22c55e',
              fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
            Register <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  )
}

// ── Results Modal ─────────────────────────────────────────────────────────────
function ResultsModal({ contest, cohortId, cohortName, onClose }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const p = PLAT[contest.platform] || PLAT.leetcode

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const cid = contest._contestIds ? contest._contestIds.join(',') : contest.contestId
    contestsAPI.participants(contest.platform, cid, cohortId || undefined)
      .then(r => { if (!cancelled) { setData(r.data.data); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [contest.contestId, contest.platform, cohortId])

  const exportCSV = () => {
    if (!data || data.length === 0) return
    const headers = ['Cohort Rank','Name','Roll Number','Branch','College','Handle',
      'Global Rank','Problems Solved','Rating Before','Rating After','Rating Change','Division']
    const rows = data.map(r => [
      r.cohortRank ?? '', r.name ?? '', r.rollNumber ?? '', r.branch ?? '',
      r.college ?? '', r.handle ?? '', r.globalRank ?? '', r.problemsSolved ?? '',
      r.ratingBefore ?? '', r.ratingAfter ?? '',
      r.ratingChange != null ? (r.ratingChange >= 0 ? '+' : '') + r.ratingChange : '',
      r.division ?? '',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
      .join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${contest.name.replace(/[^a-z0-9]/gi,'_')}_participants.csv`
    a.click()
  }

  const filtered = (data || []).filter(r =>
    !search ||
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
    r.handle?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg, oklch(0.1 0 0))',
        border: '1px solid var(--border)', borderRadius: 18,
        width: '100%', maxWidth: 900, maxHeight: '88vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.5)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '3px 9px',
              borderRadius: 6, background: p.bg, color: p.color, marginBottom: 6, display: 'inline-block' }}>
              {p.label}
            </span>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 4px', letterSpacing: '-.02em' }}>
              {contest.name}
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', margin: 0 }}>
              {fmtDate(contest.startTime)}
              {data && ` · ${data.length} cohort participant${data.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Cohort applied indicator */}
            {cohortId && cohortName && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20,
                background: 'rgba(99,102,241,.12)', color: 'var(--primary)',
                fontSize: '0.72rem', fontWeight: 700,
                border: '1.5px solid rgba(99,102,241,.25)',
              }}>
                <UsersRound size={11}/> {cohortName}
              </span>
            )}
            {data && data.length > 0 && (
              <button onClick={exportCSV} style={{
                padding: '6px 13px', borderRadius: 8, cursor: 'pointer',
                border: '1.5px solid var(--border)', background: 'var(--surface)',
                color: 'var(--fg-muted)', fontSize: '0.75rem', fontWeight: 600,
              }}>
                ↓ Export CSV
              </button>
            )}
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--fg-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={16} /></button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border)', position: 'relative', flexShrink: 0 }}>
          <Search size={14} style={{ position: 'absolute', left: 38, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
          <input
            type="text" placeholder="Search by name, roll no, handle…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 34px',
              borderRadius: 10, border: '1.5px solid var(--border)',
              background: 'var(--surface)', color: 'var(--fg)',
              fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 48, color: 'var(--fg-muted)' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
              <span>Loading participants…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 48, color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
              <Trophy size={36} style={{ opacity: .25 }} />
              <p>{data?.length === 0 ? 'No cohort students participated.' : 'No matches.'}</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr>
                  {['#','Student','Handle','Global Rank','Solved','Rating After','Change'].map(h => (
                    <th key={h} style={{
                      padding: '10px 14px', textAlign: 'left',
                      fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.06em', color: 'var(--fg-muted)',
                      borderBottom: '1px solid var(--border)',
                      position: 'sticky', top: 0, background: 'var(--bg, oklch(0.1 0 0))',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.email || i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--fg-muted)', fontSize: '0.78rem' }}>{r.cohortRank}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 600 }}>{r.name || r.email}</div>
                      {r.rollNumber && <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)' }}>{r.rollNumber}</div>}
                      {r.branch    && <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>{r.branch}</div>}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.78rem' }}>{r.handle || '—'}</span>
                    </td>
                    <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {r.globalRank ? `#${r.globalRank.toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {r.problemsSolved != null ? `${r.problemsSolved}${r.totalProblems ? `/${r.totalProblems}` : ''}` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {r.ratingAfter != null ? r.ratingAfter : '—'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      {r.ratingChange != null ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: '0.78rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                          background: r.ratingChange >= 0 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                          color: r.ratingChange >= 0 ? '#22c55e' : '#ef4444',
                        }}>
                          <TrendIcon change={r.ratingChange} />
                          {r.ratingChange >= 0 ? '+' : ''}{r.ratingChange}
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Admin Contest Page ───────────────────────────────────────────────────
export default function AdminContestPage() {
  const [platform,   setPlatform]   = useState('all')
  const [weekOffset, setWeekOffset] = useState(0)
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [selected,   setSelected]   = useState(null)
  const [cohorts,    setCohorts]    = useState([])
  const [cohortId,   setCohortId]   = useState('')
  const [view,       setView]       = useState('grid')   // 'grid' | 'calendar'

  useEffect(() => {
    cohortsAPI.list().then(r => setCohorts(r.data.data || [])).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await contestsAPI.list(platform, weekOffset)
      setData(r.data.data)
    } catch { setData({ upcoming: [], past: [] }) }
    finally { setLoading(false) }
  }, [platform, weekOffset])

  useEffect(() => { load() }, [load])

  const handleCardClick = (contest) => {
    if (contest.status === 'upcoming') window.open(contest.url, '_blank', 'noopener')
    else setSelected(contest)
  }

  const weekLabel = weekOffset === 0 ? 'This Week'
    : weekOffset === -1 ? 'Last Week'
    : `${Math.abs(weekOffset)} weeks ago`
  const { start, end } = data?.week || {}
  const weekRange = start && end ? `${fmtDate(start)} – ${fmtDate(end)}` : ''

  const sectionStyle = { marginBottom: 32 }
  const sectionHdr = (dot, label, count) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot,
        boxShadow: dot === '#22c55e' ? '0 0 6px rgba(34,197,94,.5)' : 'none' }} />
      <h2 style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.02em', margin: 0 }}>{label}</h2>
      <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>{count}</span>
    </div>
  )

  return (
    <>
      <AdminHeader title="Contests" breadcrumb="Overview" />
      <div className="page">

      {/* ── View Toggle Row ────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'grid',     label: 'Grid',     Icon: LayoutGrid },
          { id: 'calendar', label: 'Calendar', Icon: CalendarDays },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setView(id)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
            border: `1.5px solid ${view === id ? 'var(--primary)' : 'var(--border)'}`,
            background: view === id ? 'rgba(99,102,241,.1)' : 'var(--surface)',
            color: view === id ? 'var(--primary)' : 'var(--fg-muted)',
            fontSize: '0.78rem', fontWeight: 600, transition: 'all .15s',
          }}>
            <Icon size={13}/> {label}
          </button>
        ))}
      </div>

      {/* ── Calendar view ──────────────────────────────────────────── */}
      {view === 'calendar' && <AdminContestCalendar />}

      {/* ── Grid view ──────────────────────────────────────────────── */}
      {view === 'grid' && <>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {['all','leetcode','codeforces','codechef'].map(p => (
            <button key={p}
              onClick={() => { setPlatform(p); setWeekOffset(0) }}
              style={{
                padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${platform === p && p !== 'all' ? PLAT[p]?.color : platform === p ? 'var(--primary)' : 'var(--border)'}`,
                background: platform === p && p !== 'all' ? PLAT[p]?.bg : platform === p ? 'rgba(99,102,241,.1)' : 'var(--surface)',
                color: platform === p && p !== 'all' ? PLAT[p]?.color : platform === p ? 'var(--primary)' : 'var(--fg-muted)',
                fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all .15s',
              }}>
              {p === 'all' ? 'All Platforms' : PLAT[p]?.label || p}
            </button>
          ))}
        </div>

        {/* ── Cohort filter ────────────────────────────────── */}
        {cohorts.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <UsersRound size={14} style={{ color: cohortId ? 'var(--primary)' : 'var(--fg-muted)', flexShrink: 0 }} />
            <select
              value={cohortId}
              onChange={e => setCohortId(e.target.value)}
              style={{
                padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                border: `1.5px solid ${cohortId ? 'var(--primary)' : 'var(--border)'}`,
                background: cohortId ? 'rgba(99,102,241,.08)' : 'var(--surface)',
                color: cohortId ? 'var(--primary)' : 'var(--fg-muted)',
                fontSize: '0.78rem', fontWeight: 600, outline: 'none',
              }}
            >
              <option value=''>All Students</option>
              {cohorts.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.member_count})</option>
              ))}
            </select>
            {cohortId && (
              <button
                onClick={() => setCohortId('')}
                title="Clear cohort filter"
                style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  border: '1px solid var(--border)', background: 'var(--surface)',
                  color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            )}
          </div>
        )}

        <div className="cf-week-nav" style={{ marginLeft: 'auto' }}>
          <ChevronDown size={13} className="cf-week-chevron" />
          <select
            className="cf-week-select"
            value={weekOffset}
            onChange={e => setWeekOffset(Number(e.target.value))}
          >
            <option value={0}>This Week</option>
            <option value={-1}>Last Week</option>
            {Array.from({ length: 10 }, (_, i) => i + 2).map(n => (
              <option key={n} value={-n}>{n} weeks ago</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div>
          {weekOffset === 0 && (
            <div style={sectionStyle}>
              {sectionHdr('#22c55e', 'Upcoming', data?.upcoming?.length ?? 0)}
              {!data?.upcoming?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 36, gap: 10,
                  color: 'var(--fg-muted)', fontSize: '0.85rem',
                  border: '1.5px dashed var(--border)', borderRadius: 14, textAlign: 'center' }}>
                  <Code2 size={28} style={{ opacity: .3 }} />
                  <p>No upcoming contests found.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                  {data.upcoming.map((c, i) => <ContestCard key={i} contest={c} onClick={handleCardClick} />)}
                </div>
              )}
            </div>
          )}

          <div style={sectionStyle}>
            {sectionHdr('var(--fg-muted)', 'Past', data?.past?.length ?? 0)}
            {!data?.past?.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 36, gap: 10,
                color: 'var(--fg-muted)', fontSize: '0.85rem',
                border: '1.5px dashed var(--border)', borderRadius: 14, textAlign: 'center' }}>
                <Trophy size={28} style={{ opacity: .3 }} />
                <p>No past contests this week from cohort data.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                {data.past.map((c, i) => <ContestCard key={i} contest={c} onClick={handleCardClick} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {selected && <ResultsModal
        contest={selected}
        cohortId={cohortId || undefined}
        cohortName={cohorts.find(c => String(c.id) === String(cohortId))?.name}
        onClose={() => setSelected(null)}
      />}

      </> /* end grid view */}

      </div>
    </>
  )
}
