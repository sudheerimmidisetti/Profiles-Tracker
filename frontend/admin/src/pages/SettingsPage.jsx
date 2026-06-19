import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import {
  Clock, RefreshCw, CheckCircle, AlertTriangle, Save,
  Zap, Calendar, Info
} from 'lucide-react'

// ── Cron expression validator ─────────────────────────────────────────────────
const CRON_FIELDS = ['min', 'hour', 'dom', 'mon', 'dow']
function isValidCron(expr) {
  if (!expr || typeof expr !== 'string') return false
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return false
  const ranges = [[0,59],[0,23],[1,31],[1,12],[0,7]]
  return parts.every((p, i) => {
    if (p === '*') return true
    if (p.startsWith('*/')) {
      const n = parseInt(p.slice(2), 10)
      return !isNaN(n) && n >= 1
    }
    const nums = p.split(',').map(Number)
    return nums.every(n => !isNaN(n) && n >= ranges[i][0] && n <= ranges[i][1])
  })
}

// ── Human-readable cron description ──────────────────────────────────────────
function describeCron(expr) {
  if (!expr) return ''
  const map = {
    '0 20 * * *':   'Every day at 1:30 AM IST (8:00 PM UTC)',
    '0 20,8 * * *': 'Twice daily — 1:30 AM & 1:30 PM IST',
    '0 */6 * * *':  'Every 6 hours',
    '0 */12 * * *': 'Every 12 hours',
    '0 14 * * *':   'Every day at 7:30 PM IST',
  }
  return map[expr] || `Custom: ${expr}`
}

// ── Next run calculator (approximation) ──────────────────────────────────────
function nextRunIST(cronExpr) {
  try {
    const parts = cronExpr.trim().split(/\s+/)
    if (parts.length !== 5) return null
    const [min, hour] = parts
    if (min === '*' || hour === '*') return null
    const [m, h] = [parseInt(min,10), parseInt(hour,10)]
    const now = new Date()
    // Calculate in UTC then display as IST (+5:30)
    const next = new Date()
    next.setUTCHours(h, m, 0, 0)
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
    // Format as IST
    const istMs = next.getTime() + 5.5 * 60 * 60 * 1000
    const d = new Date(istMs)
    return d.toUTCString().replace('GMT', 'IST')
  } catch { return null }
}

// ── Presets ───────────────────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Every night at 1:30 AM IST',  value: '0 20 * * *',   icon: '🌙' },
  { label: 'Twice daily (1:30 AM + 1:30 PM IST)', value: '0 20,8 * * *', icon: '🔁' },
  { label: 'Every 6 hours',              value: '0 */6 * * *',  icon: '⏰' },
  { label: 'Every 12 hours',             value: '0 */12 * * *', icon: '🕛' },
  { label: 'Every evening at 7:30 PM IST', value: '0 14 * * *',  icon: '🌆' },
]

// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [settings,    setSettings]    = useState(null)
  const [cronExpr,    setCronExpr]    = useState('')
  const [customMode,  setCustomMode]  = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [saveMsg,     setSaveMsg]     = useState(null) // { type: 'ok'|'err', text }
  const [loading,     setLoading]     = useState(true)
  const [syncStatus,  setSyncStatus]  = useState(null)
  const [triggering,  setTriggering]  = useState(false)

  // ── Load settings ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [settRes, syncRes] = await Promise.all([
        adminAPI.getSettings(),
        adminAPI.syncStatus(),
      ])
      const s = settRes.data.data
      setSettings(s)
      const saved = s.settings?.sync_cron?.value || '0 20 * * *'
      setCronExpr(saved)
      const isPreset = PRESETS.some(p => p.value === saved)
      setCustomMode(!isPreset)
      setSyncStatus(syncRes.data.data)
    } catch (e) {
      setSaveMsg({ type: 'err', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Poll sync status while running
  useEffect(() => {
    if (!syncStatus?.running) return
    const id = setInterval(async () => {
      try {
        const r = await adminAPI.syncStatus()
        setSyncStatus(r.data.data)
      } catch {}
    }, 3000)
    return () => clearInterval(id)
  }, [syncStatus?.running])

  // ── Save cron ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValidCron(cronExpr)) {
      setSaveMsg({ type: 'err', text: 'Invalid cron expression. Check format: min hour dom mon dow' })
      return
    }
    setSaving(true)
    setSaveMsg(null)
    try {
      await adminAPI.updateCronSchedule(cronExpr)
      setSaveMsg({ type: 'ok', text: `Schedule saved: "${cronExpr}"` })
      load()
    } catch (e) {
      setSaveMsg({ type: 'err', text: e.response?.data?.message || 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  // ── Trigger sync ───────────────────────────────────────────────────────────
  const handleTrigger = async () => {
    setTriggering(true)
    try {
      await adminAPI.triggerSync()
      setSyncStatus(prev => ({ ...prev, running: true }))
    } catch (e) {
      setSaveMsg({ type: 'err', text: e.response?.data?.message || 'Failed to trigger sync' })
    } finally {
      setTriggering(false)
    }
  }

  if (loading) {
    return (
      <div className="page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  const validCron    = isValidCron(cronExpr)
  const cronDesc     = validCron ? describeCron(cronExpr) : 'Invalid cron expression'
  const nextRun      = validCron ? nextRunIST(cronExpr) : null
  const savedCron    = settings?.settings?.sync_cron?.value
  const savedUpdatedBy = settings?.settings?.sync_cron?.updated_by
  const savedUpdatedAt = settings?.settings?.sync_cron?.updated_at

  return (
    <div className="page-wrapper">
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 28 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={22} style={{ color: 'var(--chart-2)' }} />
          Admin Settings
        </h1>
        <p className="page-sub">Configure system behaviour — changes take effect immediately without server restart.</p>
      </div>

      <div style={{ display: 'grid', gap: 20, maxWidth: 780 }}>

        {/* ── Sync Schedule Card ─────────────────────────────────────────── */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(99,102,241,.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Calendar size={18} style={{ color: '#818cf8' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Sync Schedule</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: 0 }}>
                Controls when the nightly profile scrape runs (IST timezone)
              </p>
            </div>
          </div>

          {/* Current live schedule pill */}
          {settings?.jobStatus && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(34,197,94,.08)',
              border: '1px solid rgba(34,197,94,.15)',
              marginBottom: 20,
            }}>
              <Zap size={13} style={{ color: '#22c55e' }} />
              <span style={{ fontSize: '0.78rem', color: '#22c55e', fontWeight: 600 }}>
                Active: &quot;{savedCron}&quot;
              </span>
              {savedUpdatedBy && (
                <span style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginLeft: 'auto' }}>
                  Updated by {savedUpdatedBy}
                  {savedUpdatedAt && ` · ${new Date(savedUpdatedAt).toLocaleDateString('en-IN')}`}
                </span>
              )}
            </div>
          )}

          {/* Preset buttons */}
          <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                       letterSpacing: '.08em', color: 'var(--fg-muted)', marginBottom: 10 }}>
            Quick Presets
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {PRESETS.map(p => (
              <label
                key={p.value}
                onClick={() => { setCronExpr(p.value); setCustomMode(false); setSaveMsg(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${cronExpr === p.value && !customMode ? 'var(--primary)' : 'var(--border)'}`,
                  background: cronExpr === p.value && !customMode ? 'rgba(99,102,241,.08)' : 'var(--surface)',
                  transition: 'all .15s',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{p.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.label}</div>
                  <code style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>{p.value}</code>
                </div>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${cronExpr === p.value && !customMode ? 'var(--primary)' : 'var(--border)'}`,
                  background: cronExpr === p.value && !customMode ? 'var(--primary)' : 'transparent',
                  flexShrink: 0,
                }} />
              </label>
            ))}

            {/* Custom cron option */}
            <label
              onClick={() => { setCustomMode(true); setSaveMsg(null) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${customMode ? 'var(--primary)' : 'var(--border)'}`,
                background: customMode ? 'rgba(99,102,241,.08)' : 'var(--surface)',
                transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>✍️</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Custom cron expression</div>
                <code style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>e.g. 30 1 * * 1-5</code>
              </div>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2px solid ${customMode ? 'var(--primary)' : 'var(--border)'}`,
                background: customMode ? 'var(--primary)' : 'transparent',
                flexShrink: 0,
              }} />
            </label>
          </div>

          {/* Custom cron input */}
          {customMode && (
            <div style={{ marginBottom: 16 }}>
              <input
                type="text"
                value={cronExpr}
                onChange={e => { setCronExpr(e.target.value); setSaveMsg(null) }}
                placeholder="0 20 * * *"
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: 10,
                  background: 'var(--surface)', border: `1.5px solid ${validCron || !cronExpr ? 'var(--border)' : 'var(--danger)'}`,
                  color: 'var(--fg)', fontSize: '0.9rem', fontFamily: 'monospace',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {CRON_FIELDS.map((f, i) => (
                  <div key={f} style={{ flex: 1, textAlign: 'center',
                    fontSize: '0.62rem', color: 'var(--fg-muted)', textTransform: 'uppercase' }}>
                    {f}<br />
                    <code style={{ fontSize: '0.78rem', color: 'var(--fg)' }}>
                      {cronExpr.trim().split(/\s+/)[i] || '?'}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview bar */}
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--surface)', border: '1px solid var(--border)',
            marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <Info size={14} style={{ color: 'var(--fg-muted)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>{cronDesc}</div>
              {nextRun && (
                <div style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 2 }}>
                  Next run: {nextRun}
                </div>
              )}
            </div>
          </div>

          {/* Save message */}
          {saveMsg && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 14px', borderRadius: 10, marginBottom: 14,
              background: saveMsg.type === 'ok' ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
              border: `1px solid ${saveMsg.type === 'ok' ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}`,
              fontSize: '0.82rem',
              color: saveMsg.type === 'ok' ? '#22c55e' : '#ef4444',
            }}>
              {saveMsg.type === 'ok'
                ? <CheckCircle size={14} />
                : <AlertTriangle size={14} />}
              {saveMsg.text}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !validCron}
              style={{ display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Schedule'}
            </button>
          </div>
        </div>

        {/* ── Sync Now Card ──────────────────────────────────────────────── */}
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: 'rgba(234,179,8,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <RefreshCw size={18} style={{ color: '#eab308' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Manual Sync</h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: 0 }}>
                Trigger an immediate sync of all students right now
              </p>
            </div>
          </div>

          {syncStatus?.running && (
            <div style={{
              padding: '12px 14px', borderRadius: 10, marginBottom: 14,
              background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div className="spinner" style={{ width: 14, height: 14 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#818cf8' }}>
                  Sync running — {syncStatus.processed}/{syncStatus.total} students
                </span>
              </div>
              <div style={{
                height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, #818cf8, #6366f1)',
                  width: `${syncStatus.total ? Math.round(syncStatus.processed / syncStatus.total * 100) : 0}%`,
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
              Last sync finished · {syncStatus.succeeded} ok / {syncStatus.failed} failed
              · {new Date(syncStatus.finishedAt).toLocaleString('en-IN')}
            </div>
          )}

          <button
            className="btn btn-secondary"
            onClick={handleTrigger}
            disabled={triggering || syncStatus?.running}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}
          >
            <RefreshCw size={14} className={syncStatus?.running ? 'spin' : ''} />
            {syncStatus?.running ? 'Sync Running…' : 'Trigger Sync Now'}
          </button>
        </div>

      </div>
    </div>
  )
}
