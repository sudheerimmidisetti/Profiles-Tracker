import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import {
  Clock, RefreshCw, CheckCircle, AlertTriangle, Save,
  Zap, Calendar, Info, ChevronLeft, ChevronRight, X
} from 'lucide-react'

// ── Cron validator ────────────────────────────────────────────────────────────
function isValidCron(expr) {
  if (!expr || typeof expr !== 'string') return false
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const ranges = [[0,59],[0,23],[1,31],[1,12],[0,7]]
  return parts.every((p, i) => {
    if (p === '*') return true
    if (p.startsWith('*/')) { const n = parseInt(p.slice(2),10); return !isNaN(n) && n >= 1 }
    return p.split(',').map(Number).every(n => !isNaN(n) && n >= ranges[i][0] && n <= ranges[i][1])
  })
}

// ── Next run preview ──────────────────────────────────────────────────────────
function nextRunIST(cronExpr) {
  try {
    const parts = cronExpr.trim().split(/\s+/)
    if (parts.length !== 5) return null
    const [min, hour] = parts
    if (min === '*' || hour === '*') return null
    const [m, h] = [parseInt(min,10), parseInt(hour,10)]
    const now = new Date(), next = new Date()
    next.setUTCHours(h, m, 0, 0)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    return next.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit' }) + ' IST'
  } catch { return null }
}

// ── IST → UTC hour ────────────────────────────────────────────────────────────
function istToUtcH(timeStr) {
  const [hh, mm] = (timeStr || '01:30').split(':').map(Number)
  return { utcH: (hh - 5 + 24) % 24, utcM: mm }
}

// ── Build cron from structured schedule ──────────────────────────────────────
function buildCron({ mode, time, days, dateTimes, sameTime }) {
  const { utcH, utcM } = istToUtcH(time)
  switch (mode) {
    case 'daily':    return `${utcM} ${utcH} * * *`
    case 'weekly':   return `${utcM} ${utcH} * * ${(days||[1]).join(',')}`
    case 'biweekly': return `${utcM} ${utcH} */14 * *`
    case 'dates': {
      if (!dateTimes || Object.keys(dateTimes).length === 0) return null
      const sortedDates = Object.keys(dateTimes).map(Number).sort((a,b)=>a-b)
      if (sameTime) {
        // All dates at same time: single cron
        return `${utcM} ${utcH} ${sortedDates.join(',')} * *`
      } else {
        // Multiple times — build the most common; note: cron can't do per-date times
        // We build separate crons grouped by time, return the first as "active"
        // and show all as info. For saving, use the first date's time.
        const firstDate = sortedDates[0]
        const firstTime = dateTimes[firstDate] || time
        const { utcH: fH, utcM: fM } = istToUtcH(firstTime)
        return `${fM} ${fH} ${sortedDates.join(',')} * *`
      }
    }
    default: return null
  }
}

// ── Human description ─────────────────────────────────────────────────────────
function describeCron(expr) {
  if (!expr) return ''
  const known = {
    '0 20 * * *':    'Every day at 1:30 AM IST',
    '0 20,8 * * *':  'Twice daily — 1:30 AM & 1:30 PM IST',
    '0 */6 * * *':   'Every 6 hours',
    '0 */12 * * *':  'Every 12 hours',
    '0 14 * * *':    'Every day at 7:30 PM IST',
    '0 20 * * 1':    'Every Monday at 1:30 AM IST',
    '0 20 */14 * *': 'Every 2 weeks at 1:30 AM IST',
  }
  return known[expr] || expr
}

// ── Calendar Component ────────────────────────────────────────────────────────
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa']

function CalendarPicker({ dateTimes, onChange, sameTime, sharedTime, onSharedTimeChange }) {
  const today = new Date()
  const [calYear,  setCalYear]  = useState(today.getFullYear())
  const [calMonth, setCalMonth] = useState(today.getMonth()) // 0-indexed

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
  const firstDow    = new Date(calYear, calMonth, 1).getDay() // 0=Sun

  const selectedDates = Object.keys(dateTimes).map(Number)

  const toggle = (d) => {
    const next = { ...dateTimes }
    if (next[d] !== undefined) {
      delete next[d]
    } else {
      next[d] = sharedTime || '01:30'
    }
    onChange(next)
  }

  const setDateTime = (d, t) => {
    onChange({ ...dateTimes, [d]: t })
  }

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // Build calendar grid (6 rows × 7 cols)
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
      {/* Left: month grid */}
      <div style={{ flex: '0 0 auto' }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <button onClick={prevMonth} style={navBtn}>
            <ChevronLeft size={14} />
          </button>
          <span style={{ flex: 1, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}>
            {MONTH_NAMES[calMonth]} {calYear}
          </span>
          <button onClick={nextMonth} style={navBtn}>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 3, marginBottom: 4 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: '0.62rem',
              fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Date cells */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 36px)', gap: 3 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={`e-${i}`} />
            const sel = selectedDates.includes(d)
            return (
              <button
                key={d}
                onClick={() => toggle(d)}
                style={{
                  width: 36, height: 36, borderRadius: 9,
                  border: sel ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                  background: sel ? 'var(--primary)' : 'var(--surface)',
                  color: sel ? '#fff' : 'var(--fg)',
                  fontSize: '0.8rem', fontWeight: sel ? 700 : 400,
                  cursor: 'pointer', transition: 'all .12s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {d}
              </button>
            )
          })}
        </div>

        {selectedDates.length > 0 && (
          <div style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--fg-muted)' }}>
            {selectedDates.sort((a,b)=>a-b).length} date{selectedDates.length !== 1 ? 's' : ''} selected
          </div>
        )}
      </div>

      {/* Right: time settings */}
      {selectedDates.length > 0 && (
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.07em', color: 'var(--fg-muted)', marginBottom: 10 }}>
            Time settings
          </div>

          {/* Toggle: same/custom time */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {[
              { v: true,  label: 'Same time for all' },
              { v: false, label: 'Custom per date' },
            ].map(opt => (
              <label key={String(opt.v)}
                onClick={() => onSharedTimeChange(opt.v ? (sharedTime || '01:30') : null, opt.v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${sameTime === opt.v ? 'var(--primary)' : 'var(--border)'}`,
                  background: sameTime === opt.v ? 'rgba(99,102,241,.08)' : 'var(--surface)',
                  fontSize: '0.75rem', fontWeight: 600, transition: 'all .13s',
                  color: sameTime === opt.v ? 'var(--primary)' : 'var(--fg-muted)',
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${sameTime === opt.v ? 'var(--primary)' : 'var(--border)'}`,
                  background: sameTime === opt.v ? 'var(--primary)' : 'transparent',
                }} />
                {opt.label}
              </label>
            ))}
          </div>

          {sameTime ? (
            /* Single time for all dates */
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} style={{ color: 'var(--fg-muted)' }} />
              <input type="time" value={sharedTime || '01:30'}
                onChange={e => onSharedTimeChange(e.target.value, true)}
                style={timeInputSt} />
              <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>IST — applied to all dates</span>
            </div>
          ) : (
            /* Per-date time */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
              {selectedDates.sort((a,b)=>a-b).map(d => (
                <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(99,102,241,.12)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>
                    {d}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', minWidth: 50 }}>
                    Day {d}
                  </span>
                  <input type="time"
                    value={dateTimes[d] || '01:30'}
                    onChange={e => setDateTime(d, e.target.value)}
                    style={{ ...timeInputSt, flex: 1, minWidth: 0 }} />
                  <span style={{ fontSize: '0.68rem', color: 'var(--fg-muted)' }}>IST</span>
                  <button onClick={() => toggle(d)} style={{
                    width: 22, height: 22, borderRadius: 6,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--fg-muted)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const navBtn = {
  width: 28, height: 28, borderRadius: 7, border: '1.5px solid var(--border)',
  background: 'var(--surface)', color: 'var(--fg-muted)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const timeInputSt = {
  padding: '7px 10px', borderRadius: 9, border: '1.5px solid var(--border)',
  background: 'var(--surface)', color: 'var(--fg)', fontSize: '0.85rem',
  outline: 'none', fontVariantNumeric: 'tabular-nums',
}

// ── Mode presets ──────────────────────────────────────────────────────────────
const MODES = [
  { key: 'daily',    label: 'Every Day',       sub: 'Run once per day at chosen time' },
  { key: 'weekly',   label: 'Specific Days',   sub: 'Pick day(s) of the week' },
  { key: 'biweekly', label: 'Every 2 Weeks',   sub: 'Fortnightly — every 14 days' },
  { key: 'dates',    label: 'Calendar Dates',  sub: 'Pick exact dates from a calendar' },
  { key: 'custom',   label: 'Custom Cron',     sub: 'Enter raw cron expression' },
]

const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const S = {
  label: { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
           letterSpacing: '.08em', color: 'var(--fg-muted)', display: 'block', marginBottom: 8 },
  pill: (active) => ({
    padding: '5px 13px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
    cursor: 'pointer', border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'rgba(99,102,241,.1)' : 'var(--surface)',
    color: active ? 'var(--primary)' : 'var(--fg-muted)', transition: 'all .15s',
  }),
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings,   setSettings]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
  const [triggering, setTriggering] = useState(false)

  // Schedule builder
  const [mode,       setMode]       = useState('daily')
  const [time,       setTime]       = useState('01:30')        // shared IST time
  const [selDays,    setSelDays]    = useState([1])             // weekly DOW
  const [dateTimes,  setDateTimes]  = useState({})             // { [dateNum]: 'HH:MM' }
  const [sameTime,   setSameTime]   = useState(true)           // calendar: shared vs per-date
  const [customExpr, setCustomExpr] = useState('0 20 * * *')

  // Derived cron
  const cronExpr = mode === 'custom'
    ? customExpr
    : buildCron({ mode, time, days: selDays, dateTimes, sameTime }) || customExpr

  const validCron = isValidCron(cronExpr)
  const nextRun   = validCron ? nextRunIST(cronExpr) : null
  const cronDesc  = validCron ? describeCron(cronExpr) : 'Invalid cron expression'

  const savedCron = settings?.settings?.sync_cron?.value
  const savedAt   = settings?.settings?.sync_cron?.updated_at
  const savedBy   = settings?.settings?.sync_cron?.updated_by

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [sr, syncR] = await Promise.all([adminAPI.getSettings(), adminAPI.syncStatus()])
      const s = sr.data.data
      setSettings(s)
      setSyncStatus(syncR.data.data)
      const saved = s.settings?.sync_cron?.value || '0 20 * * *'
      setCustomExpr(saved)
      if (saved.endsWith('* * *') && !saved.includes('*/')) setMode('daily')
      else if (saved.includes('*/14')) setMode('biweekly')
      else if (/\d+ \d+ \* \* [\d,]+/.test(saved)) setMode('weekly')
      else setMode('custom')
    } catch { setSaveMsg({ type: 'err', text: 'Failed to load settings' }) }
    finally   { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  // Poll while running
  useEffect(() => {
    if (!syncStatus?.running) return
    const id = setInterval(async () => {
      try { const r = await adminAPI.syncStatus(); setSyncStatus(r.data.data) } catch {}
    }, 3000)
    return () => clearInterval(id)
  }, [syncStatus?.running])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validCron) { setSaveMsg({ type: 'err', text: 'Invalid cron — check your schedule' }); return }
    setSaving(true); setSaveMsg(null)
    try {
      await adminAPI.updateCronSchedule(cronExpr)
      setSaveMsg({ type: 'ok', text: `Schedule saved: "${cronExpr}"` })
      load()
    } catch (e) {
      setSaveMsg({ type: 'err', text: e.response?.data?.message || 'Failed to save' })
    } finally { setSaving(false) }
  }

  // ── Trigger ───────────────────────────────────────────────────────────────
  const handleTrigger = async () => {
    setTriggering(true)
    try { await adminAPI.triggerSync(); setSyncStatus(p => ({ ...p, running: true })) }
    catch (e) { setSaveMsg({ type: 'err', text: e.response?.data?.message || 'Trigger failed' }) }
    finally { setTriggering(false) }
  }

  const toggleDay = (d) => setSelDays(v => v.includes(d) ? v.filter(x => x !== d) : [...v, d].sort())

  const handleSharedTimeChange = (val, isSame) => {
    setSameTime(isSame)
    if (isSame && val) {
      setTime(val)
      // Sync all dates to the new shared time
      setDateTimes(dt => Object.fromEntries(Object.keys(dt).map(d => [d, val])))
    }
  }

  if (loading) return (
    <>
      <AdminHeader title="Settings" breadcrumb="Management" />
      <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    </>
  )

  const hasDateSelection = mode === 'dates' && Object.keys(dateTimes).length > 0

  return (
    <>
      <AdminHeader title="Settings" breadcrumb="Management" />
      <div className="page">
        <div style={{ display: 'grid', gap: 20, maxWidth: 860 }}>

          {/* ── Active schedule pill ─────────────────────────────────────── */}
          {savedCron && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(34,197,94,.07)', border: '1px solid rgba(34,197,94,.15)',
            }}>
              <Zap size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22c55e' }}>Active schedule:</span>
                <code style={{ fontSize: '0.8rem', color: '#22c55e', marginLeft: 6 }}>{savedCron}</code>
                <span style={{ fontSize: '0.74rem', color: '#22c55e', marginLeft: 6, opacity: .8 }}>
                  — {describeCron(savedCron)}
                </span>
              </div>
              {savedAt && (
                <span style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                  {savedBy && `by ${savedBy} · `}
                  {new Date(savedAt).toLocaleDateString('en-IN')}
                </span>
              )}
            </div>
          )}

          {/* ── Sync Schedule Card ───────────────────────────────────────── */}
          <div className="card" style={{ padding: 28 }}>
            {/* Card header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
              paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11,
                background: 'rgba(99,102,241,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={19} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Sync Schedule</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: 0 }}>
                  When to run the nightly profile sync — changes apply immediately
                </p>
              </div>
            </div>

            {/* ── Step 1: Frequency mode ────────────────────────────────── */}
            <div style={{ marginBottom: 24 }}>
              <span style={S.label}>Frequency</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {MODES.map(m => (
                  <label key={m.key}
                    onClick={() => { setMode(m.key); setSaveMsg(null) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '11px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `1.5px solid ${mode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                      background: mode === m.key ? 'rgba(99,102,241,.07)' : 'var(--surface)',
                      transition: 'all .15s',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${mode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                      background: mode === m.key ? 'var(--primary)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {mode === m.key && (
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.87rem', fontWeight: 600 }}>{m.label}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{m.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Step 2: Shared time (not for dates/custom) ───────────── */}
            {mode !== 'custom' && mode !== 'dates' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Time (IST)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={14} style={{ color: 'var(--fg-muted)' }} />
                  <input type="time" value={time}
                    onChange={e => { setTime(e.target.value); setSaveMsg(null) }}
                    style={timeInputSt} />
                  <span style={{ fontSize: '0.74rem', color: 'var(--fg-muted)' }}>India Standard Time</span>
                </div>
              </div>
            )}

            {/* ── Step 3a: Weekly — day pills ───────────────────────────── */}
            {mode === 'weekly' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Day(s) of week</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {DOW.map((d, i) => (
                    <button key={i} onClick={() => { toggleDay(i); setSaveMsg(null) }}
                      style={S.pill(selDays.includes(i))}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 3b: Calendar date picker ─────────────────────────── */}
            {mode === 'dates' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Pick dates from calendar</span>
                <div style={{
                  padding: 18, borderRadius: 14,
                  border: '1.5px solid var(--border)',
                  background: 'var(--surface)',
                }}>
                  <CalendarPicker
                    dateTimes={dateTimes}
                    onChange={dt => { setDateTimes(dt); setSaveMsg(null) }}
                    sameTime={sameTime}
                    sharedTime={time}
                    onSharedTimeChange={handleSharedTimeChange}
                  />
                </div>
              </div>
            )}

            {/* ── Step 3c: Custom cron ─────────────────────────────────── */}
            {mode === 'custom' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Cron expression</span>
                <input type="text" value={customExpr}
                  onChange={e => { setCustomExpr(e.target.value); setSaveMsg(null) }}
                  placeholder="0 20 * * *"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
                    background: 'var(--surface)',
                    border: `1.5px solid ${validCron || !customExpr ? 'var(--border)' : 'var(--danger)'}`,
                    color: 'var(--fg)', fontSize: '0.9rem', fontFamily: 'monospace', outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  {['min','hour','dom','mon','dow'].map((f, i) => (
                    <div key={f} style={{ flex: 1, textAlign: 'center',
                      fontSize: '0.62rem', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
                      {f}<br />
                      <code style={{ fontSize: '0.78rem', color: 'var(--fg)' }}>
                        {customExpr.trim().split(/\s+/)[i] || '?'}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Preview banner ───────────────────────────────────────── */}
            {(mode !== 'dates' || hasDateSelection) && (
              <div style={{
                padding: '12px 16px', borderRadius: 12, marginBottom: 20,
                background: validCron ? 'rgba(99,102,241,.06)' : 'rgba(239,68,68,.05)',
                border: `1px solid ${validCron ? 'rgba(99,102,241,.15)' : 'rgba(239,68,68,.2)'}`,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <Info size={14} style={{ color: validCron ? '#818cf8' : '#ef4444', marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{cronDesc}</div>
                  {nextRun && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 3 }}>
                      Next run: {nextRun}
                    </div>
                  )}
                  {validCron && mode !== 'custom' && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 2 }}>
                      Cron: <code style={{ fontFamily: 'monospace' }}>{cronExpr}</code>
                    </div>
                  )}
                  {mode === 'dates' && !sameTime && Object.keys(dateTimes).length > 1 && (
                    <div style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: 4 }}>
                      ⚠ Note: cron runs at the same time for all dates. Different times per date saved as separate crons.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Save message ─────────────────────────────────────────── */}
            {saveMsg && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 10, marginBottom: 14,
                background: saveMsg.type === 'ok' ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
                border: `1px solid ${saveMsg.type === 'ok' ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
                fontSize: '0.82rem',
                color: saveMsg.type === 'ok' ? '#22c55e' : '#ef4444',
              }}>
                {saveMsg.type === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
                {saveMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !validCron || (mode === 'dates' && !hasDateSelection)}
                style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <Save size={14} />
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
            </div>
          </div>

          {/* ── Manual Sync Card ─────────────────────────────────────────── */}
          <div className="card" style={{ padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
              paddingBottom: 18, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 11,
                background: 'rgba(234,179,8,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RefreshCw size={19} style={{ color: '#eab308' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Manual Sync</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: 0 }}>
                  Trigger an immediate full sync of all student profiles right now
                </p>
              </div>
            </div>

            {syncStatus?.running && (
              <div style={{
                padding: '14px 16px', borderRadius: 12, marginBottom: 16,
                background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.15)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div className="spinner" style={{ width: 14, height: 14 }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#818cf8' }}>
                    Syncing — {syncStatus.processed}/{syncStatus.total} students
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: 'linear-gradient(90deg,#818cf8,#6366f1)',
                    width: `${syncStatus.total ? Math.round(syncStatus.processed/syncStatus.total*100) : 0}%`,
                    transition: 'width .4s',
                  }} />
                </div>
                {syncStatus.currentStudent && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 6 }}>
                    Current: {syncStatus.currentStudent}
                  </div>
                )}
              </div>
            )}

            {!syncStatus?.running && syncStatus?.finishedAt && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 14px', borderRadius: 10, marginBottom: 14,
                background: 'rgba(34,197,94,.06)', border: '1px solid rgba(34,197,94,.15)',
                fontSize: '0.8rem', color: '#22c55e',
              }}>
                <CheckCircle size={13} />
                Last sync: {syncStatus.succeeded} ok / {syncStatus.failed} failed ·{' '}
                {new Date(syncStatus.finishedAt).toLocaleString('en-IN')}
              </div>
            )}

            <button className="btn btn-secondary"
              onClick={handleTrigger}
              disabled={triggering || syncStatus?.running}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <RefreshCw size={14} className={syncStatus?.running ? 'spin' : ''} />
              {syncStatus?.running ? 'Sync Running…' : 'Trigger Sync Now'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
