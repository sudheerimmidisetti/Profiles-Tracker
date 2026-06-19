import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import {
  Clock, RefreshCw, CheckCircle, AlertTriangle, Save,
  Zap, Calendar, Info, ChevronDown
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
    const now  = new Date()
    const next = new Date()
    next.setUTCHours(h, m, 0, 0)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    return next.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata',
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit' }) + ' IST'
  } catch { return null }
}

// ── Build cron from structured schedule ──────────────────────────────────────
// mode: 'daily' | 'weekly' | 'biweekly' | 'dates' | 'custom'
function buildCron({ mode, time, days, dates }) {
  const [hh, mm] = (time || '20:00').split(':').map(Number)
  const utcH = (hh - 5 + 24) % 24  // IST to UTC (approximate, ignoring :30)
  switch (mode) {
    case 'daily':    return `${mm} ${utcH} * * *`
    case 'weekly':   return `${mm} ${utcH} * * ${(days||[0]).join(',')}`
    case 'biweekly': return `${mm} ${utcH} */14 * *`
    case 'dates':    return `${mm} ${utcH} ${(dates||[1]).join(',')} * *`
    default:         return null  // custom
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

// ── Day labels ────────────────────────────────────────────────────────────────
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// ── Quick mode presets ────────────────────────────────────────────────────────
const MODES = [
  { key: 'daily',    label: 'Every Day',        sub: 'Run once per day at chosen time' },
  { key: 'weekly',   label: 'Specific Days',    sub: 'Pick day(s) of the week' },
  { key: 'biweekly', label: 'Every 2 Weeks',    sub: 'Fortnightly schedule' },
  { key: 'dates',    label: 'Specific Dates',   sub: 'Pick day numbers in the month (e.g. 1, 15)' },
  { key: 'custom',   label: 'Custom Cron',      sub: 'Enter raw cron expression' },
]

// ── Small reusable components ─────────────────────────────────────────────────
const S = {
  label: { fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase',
           letterSpacing: '.08em', color: 'var(--fg-muted)', display: 'block', marginBottom: 8 },
  row:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  pill:  (active) => ({
    padding: '5px 13px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
    cursor: 'pointer', border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'rgba(99,102,241,.1)' : 'var(--surface)',
    color: active ? 'var(--primary)' : 'var(--fg-muted)', transition: 'all .15s',
  }),
  timeInput: {
    padding: '9px 12px', borderRadius: 10, border: '1.5px solid var(--border)',
    background: 'var(--surface)', color: 'var(--fg)', fontSize: '0.9rem',
    outline: 'none', fontVariantNumeric: 'tabular-nums',
  },
  card: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 14, padding: 24, marginBottom: 0,
  },
  sectionLabel: {
    fontSize: '0.8rem', fontWeight: 700, marginBottom: 14, display: 'flex',
    alignItems: 'center', gap: 6,
  },
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings,   setSettings]   = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [saveMsg,    setSaveMsg]    = useState(null)
  const [syncStatus, setSyncStatus] = useState(null)
  const [triggering, setTriggering] = useState(false)

  // Schedule builder state
  const [mode,       setMode]       = useState('daily')
  const [time,       setTime]       = useState('01:30')       // IST display time
  const [selDays,    setSelDays]    = useState([1])            // weekly: Mon
  const [selDates,   setSelDates]   = useState([1])            // dates mode
  const [customExpr, setCustomExpr] = useState('0 20 * * *')  // raw cron

  // Derive cron
  const cronExpr = mode === 'custom'
    ? customExpr
    : buildCron({ mode, time, days: selDays, dates: selDates }) || customExpr

  const validCron  = isValidCron(cronExpr)
  const nextRun    = validCron ? nextRunIST(cronExpr) : null
  const cronDesc   = validCron ? describeCron(cronExpr) : 'Invalid cron expression'

  const savedCron     = settings?.settings?.sync_cron?.value
  const savedAt       = settings?.settings?.sync_cron?.updated_at
  const savedBy       = settings?.settings?.sync_cron?.updated_by

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [sr, syncR] = await Promise.all([adminAPI.getSettings(), adminAPI.syncStatus()])
      const s = sr.data.data
      setSettings(s)
      setSyncStatus(syncR.data.data)
      const saved = s.settings?.sync_cron?.value || '0 20 * * *'
      setCustomExpr(saved)
      // Try to detect mode from saved cron
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
    if (!validCron) { setSaveMsg({ type: 'err', text: 'Invalid cron — check format' }); return }
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

  const toggleDay  = (d)  => setSelDays(v  => v.includes(d)  ? v.filter(x => x !== d)  : [...v, d].sort())
  const toggleDate = (d)  => setSelDates(v => v.includes(d)  ? v.filter(x => x !== d)  : [...v, d].sort())

  if (loading) return (
    <>
      <AdminHeader title="Settings" breadcrumb="Management" />
      <div className="page" style={{ alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    </>
  )

  return (
    <>
      <AdminHeader title="Settings" breadcrumb="Management" />
      <div className="page">
        <div style={{ display: 'grid', gap: 20, maxWidth: 820 }}>

          {/* ── Active schedule pill ─────────────────────────────────────── */}
          {savedCron && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px', borderRadius: 12,
              background: 'rgba(34,197,94,.07)',
              border: '1px solid rgba(34,197,94,.15)',
            }}>
              <Zap size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22c55e' }}>
                  Active schedule:
                </span>
                <code style={{ fontSize: '0.8rem', color: '#22c55e', marginLeft: 6 }}>{savedCron}</code>
                <span style={{ fontSize: '0.75rem', color: '#22c55e', marginLeft: 6, opacity: .8 }}>
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
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(99,102,241,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Calendar size={19} style={{ color: '#818cf8' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Sync Schedule</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: 0 }}>
                  When to run the nightly profile sync — changes apply immediately
                </p>
              </div>
            </div>

            {/* ── Step 1: Mode ──────────────────────────────────────────── */}
            <div style={{ marginBottom: 22 }}>
              <span style={S.label}>Frequency</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MODES.map(m => (
                  <label key={m.key}
                    onClick={() => { setMode(m.key); setSaveMsg(null) }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                      border: `1.5px solid ${mode === m.key ? 'var(--primary)' : 'var(--border)'}`,
                      background: mode === m.key ? 'rgba(99,102,241,.07)' : 'var(--surface)',
                      transition: 'all .15s',
                    }}
                  >
                    {/* Radio dot */}
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

            {/* ── Step 2: Time (not for custom) ────────────────────────── */}
            {mode !== 'custom' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Time (IST)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={15} style={{ color: 'var(--fg-muted)' }} />
                  <input
                    type="time"
                    value={time}
                    onChange={e => { setTime(e.target.value); setSaveMsg(null) }}
                    style={S.timeInput}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                    India Standard Time
                  </span>
                </div>
              </div>
            )}

            {/* ── Step 3: Specific Days (weekly) ───────────────────────── */}
            {mode === 'weekly' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Day(s) of week</span>
                <div style={S.row}>
                  {DOW.map((d, i) => (
                    <button key={i} onClick={() => { toggleDay(i); setSaveMsg(null) }}
                      style={S.pill(selDays.includes(i))}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 3: Specific Dates ───────────────────────────────── */}
            {mode === 'dates' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Day(s) of month</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                    <button key={d} onClick={() => { toggleDate(d); setSaveMsg(null) }}
                      style={{
                        ...S.pill(selDates.includes(d)),
                        width: 38, padding: '5px 0', textAlign: 'center',
                      }}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 3: Custom Cron ──────────────────────────────────── */}
            {mode === 'custom' && (
              <div style={{ marginBottom: 22 }}>
                <span style={S.label}>Cron expression</span>
                <input
                  type="text"
                  value={customExpr}
                  onChange={e => { setCustomExpr(e.target.value); setSaveMsg(null) }}
                  placeholder="0 20 * * *"
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10, boxSizing: 'border-box',
                    background: 'var(--surface)',
                    border: `1.5px solid ${validCron || !customExpr ? 'var(--border)' : 'var(--danger)'}`,
                    color: 'var(--fg)', fontSize: '0.9rem', fontFamily: 'monospace', outline: 'none',
                  }}
                />
                {/* Field labels */}
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
            <div style={{
              padding: '12px 16px', borderRadius: 12, marginBottom: 20,
              background: validCron ? 'rgba(99,102,241,.06)' : 'rgba(239,68,68,.05)',
              border: `1px solid ${validCron ? 'rgba(99,102,241,.15)' : 'rgba(239,68,68,.2)'}`,
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <Info size={14} style={{ color: validCron ? '#818cf8' : '#ef4444', marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, fontFamily: mode === 'custom' ? 'monospace' : 'inherit' }}>
                  {cronDesc}
                </div>
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
              </div>
            </div>

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

            {/* ── Actions ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !validCron}
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
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: 'rgba(234,179,8,.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
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
