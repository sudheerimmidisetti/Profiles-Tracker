// StudentDetailPage.jsx
// Admin view of a student's full profile.
// Left vertical sidebar: Dashboard | LeetCode | CodeChef | Codeforces | HackerRank
// Each platform section shows the EXACT same component as the student website.
// Data is fetched from admin API (adminAPI.getPlatform) instead of analyticsAPI.

import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import { ArrowLeft, RefreshCw, UserX, UserCheck, AlertCircle, Pencil, CheckCircle, XCircle } from 'lucide-react'
import axios from 'axios'

// ── Student components reused exactly from student website ──────────────────
import KPICards        from '@student/components/KPICards'
import PlatformCard    from '@student/components/PlatformCard'
import ActivityHeatmap from '@student/components/ActivityHeatmap'
import LeetCodeProfile   from '@student/components/platform-profiles/LeetCodeProfile'
import CodeChefProfile   from '@student/components/platform-profiles/CodeChefProfile'
import CodeforcesProfile from '@student/components/platform-profiles/CodeforcesProfile'
import HackerRankProfile from '@student/components/platform-profiles/HackerRankProfile'

// Student CSS needed by these components
import '@student/styles/platform-profile.css'

// ── Admin contest-detail fetcher ────────────────────────────────────────────────────────────────
// ContestDetailPanel calls api.get('/api/contest/detail', { params }). In admin,
// the student api's JWT interceptor would catch the resulting 401 and call
// window.location='/login', logging the admin out. This fetcher intercepts
// '/api/contest/detail' and redirects it to the admin-protected endpoint instead.
const _adminHttp = axios.create({ baseURL: import.meta.env.VITE_API_URL || '', timeout: 30000 })
_adminHttp.interceptors.request.use(cfg => {
  const tok = localStorage.getItem('adminToken') || ''
  if (tok) cfg.headers['Authorization'] = `Bearer ${tok}`
  return cfg
})

function makeAdminApiFetch(email) {
  return function adminApiFetch(url, config = {}) {
    if (url === '/api/contest/detail') {
      const { platform, contestId } = config.params || {}
      if (email && platform && contestId) {
        return _adminHttp.get(
          `/api/admin/students/${encodeURIComponent(email)}/contest/detail`,
          { params: { platform, contestId } }
        )
      }
    }
    return _adminHttp.get(url, config)
  }
}

// ── Sidebar items ─────────────────────────────────────────────────────────────
const SECTIONS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: '📊', color: 'var(--fg)' },
  { id: 'leetcode',    label: 'LeetCode',     icon: '🟡', color: '#f89f1b' },
  { id: 'codechef',    label: 'CodeChef',     icon: '🟤', color: '#8b5e3c' },
  { id: 'codeforces',  label: 'Codeforces',   icon: '🔵', color: '#1a8cff' },
  { id: 'hackerrank',  label: 'HackerRank',   icon: '🟢', color: '#2ec866' },
]

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ── Handle edit row ───────────────────────────────────────────────────────────
function HandleEdit({ platform, handle, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(handle || '')
  const [loading, setLoading] = useState(false)

  async function save() {
    if (!val.trim()) return
    setLoading(true)
    try { await onSave(platform, val.trim()); setEditing(false) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 90, fontSize: '0.78rem', color: 'var(--fg-subtle)', flexShrink: 0 }}>{platform}</span>
      {editing ? (
        <>
          <input className="form-input" style={{ flex: 1, height: 28, fontSize: '0.8rem' }}
            value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()} autoFocus />
          <button className="btn btn-primary" style={{ height: 28, fontSize: '0.75rem', padding: '0 10px' }} onClick={save} disabled={loading}>{loading ? '…' : 'Save'}</button>
          <button className="btn btn-ghost"   style={{ height: 28, fontSize: '0.75rem', padding: '0 8px'  }} onClick={() => setEditing(false)}>Cancel</button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: '0.82rem', color: handle ? 'var(--fg)' : 'var(--fg-subtle)', fontWeight: handle ? 500 : 400 }}>
            {handle || 'Not linked'}
          </span>
          <button className="icon-btn" title={`Edit ${platform} handle`} onClick={() => setEditing(true)} style={{ flexShrink: 0 }}>
            <Pencil size={12} />
          </button>
        </>
      )}
    </div>
  )
}

// ── Platform section wrapper — loads data and renders the exact profile component ──
function PlatformSection({ email, platform, handles, apiFetch }) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const handle = handles[platform]

  const load = useCallback(async () => {
    if (!handle) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await adminAPI.getPlatform(email, platform)
      setData(res.data?.data ?? res.data)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to load ${platform}`)
    } finally { setLoading(false) }
  }, [email, platform, handle])

  useEffect(() => { load() }, [load])

  if (!handle) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔗</div>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 4 }}>No {platform} handle linked for this student.</p>
      <p style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>Edit the handle from the Dashboard tab to add one.</p>
    </div>
  )

  if (loading) return (
    <div style={{ padding: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--fg-muted)' }}>
      <div className="pp-spinner" /> Loading profile…
    </div>
  )

  if (error || !data) return (
    <div style={{ padding: 40 }}>
      <div className="msg msg-error"><AlertCircle size={14} /> {error || 'No data available'}</div>
      <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={load}><RefreshCw size={13} /> Retry</button>
    </div>
  )

  // Render exact same component as student website
  // Pass email so ContestDetailPanel gets the right student email (not localStorage)
  // onBack is a no-op — sidebar handles navigation in admin
  // apiFetch bypasses the student JWT interceptor for contest detail calls
  const noBack = () => {}

  if (platform === 'leetcode')   return <LeetCodeProfile   data={data} onBack={noBack} email={email} apiFetch={apiFetch} />
  if (platform === 'codechef')   return <CodeChefProfile   data={data} onBack={noBack} email={email} apiFetch={apiFetch} />
  if (platform === 'codeforces') return <CodeforcesProfile data={data} onBack={noBack} email={email} apiFetch={apiFetch} />
  if (platform === 'hackerrank') return <HackerRankProfile data={data} onBack={noBack} />
  return null
}

// ── Dashboard section — mirrors the student DashboardPage ─────────────────────
function DashboardSection({ student, platformsObj, onUpdateHandle }) {
  // Build the same shape as student website expects: { platforms: { leetcode:{}, ... }, aggregate: { totalSolved } }
  const summaryData = {
    platforms:  platformsObj,
    aggregate: {
      totalSolved: Object.values(platformsObj).reduce((sum, p) => sum + (p.total_solved || 0), 0)
    }
  }

  const calendarJson = platformsObj.leetcode?.contribution_calendar

  return (
    <div className="page" style={{ padding: '0 0 40px' }}>
      {/* Student info card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Avatar + info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: '1 1 260px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--chart-1), var(--chart-2))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {(student.full_name || 'S')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{student.full_name || '—'}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', marginTop: 2 }}>{student.email}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {student.roll_number && <span className="badge badge-gray">{student.roll_number}</span>}
                {student.branch     && <span className="badge badge-gray">{student.branch}</span>}
                {student.college    && <span className="badge badge-gray">{student.college}</span>}
                {student.passout_year && <span className="badge badge-gray">{student.passout_year}</span>}
                <span className={`badge ${student.is_verified ? 'badge-green' : 'badge-gray'}`}>
                  {student.is_verified ? '✓ Verified' : 'Unverified'}
                </span>
                {student.is_blocklisted && <span className="badge badge-red">Blocklisted</span>}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', marginTop: 4 }}>Joined {fmtDate(student.created_at)}</div>
            </div>
          </div>

          {/* Handles */}
          <div style={{ flex: '1 1 240px', minWidth: 220 }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Platform Handles
            </div>
            {['leetcode', 'codeforces', 'codechef', 'hackerrank'].map(p => (
              <HandleEdit
                key={p}
                platform={p}
                handle={platformsObj[p]?.username}
                onSave={onUpdateHandle}
              />
            ))}
          </div>
        </div>
      </div>

      {/* KPI cards — exact same as student DashboardPage */}
      <KPICards data={summaryData} />

      {/* Platform cards — exact same as student DashboardPage */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <h2 style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: 12, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Platform Breakdown
        </h2>
        <div className="platform-grid">
          {['leetcode', 'codeforces', 'codechef', 'hackerrank'].map(p => (
            <PlatformCard key={p} platform={p} data={platformsObj[p] || null} />
          ))}
        </div>
      </div>

      {/* Activity heatmap */}
      {calendarJson && (
        <div style={{ marginTop: 24 }}>
          <ActivityHeatmap
            calendar={calendarJson}
            color="#f89f1b"
            platform="leetcode"
            title="Activity Calendar"
          />
        </div>
      )}
    </div>
  )
}

// ── Main StudentDetailPage ────────────────────────────────────────────────────
export default function StudentDetailPage() {
  const { email }    = useParams()
  const navigate     = useNavigate()
  const decodedEmail = decodeURIComponent(email)

  const [student, setStudent]   = useState(null)
  const [platformsObj, setPlatforms] = useState({})
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)
  const [section, setSection]   = useState('dashboard')

  // Sync state: idle | syncing | done | error
  const [syncState,  setSyncState]  = useState('idle')  // 'idle' | 'syncing' | 'done' | 'error'
  const [syncMsg,    setSyncMsg]    = useState('')
  const [blocking,   setBlocking]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await adminAPI.getStudent(decodedEmail)
      const body = res.data?.data ?? res.data
      setStudent(body?.student ?? body)
      setPlatforms(body?.platforms ?? {})
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load student')
    } finally { setLoading(false) }
  }, [decodedEmail])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncState('syncing')
    setSyncMsg('')
    try {
      const res = await adminAPI.syncStudent(decodedEmail)
      setSyncState('done')
      setSyncMsg(res.data?.message || 'Sync complete!')
      // Reload student data so UI reflects fresh data
      await load()
      // Auto-clear success state after 4s
      setTimeout(() => setSyncState('idle'), 4000)
    } catch (e) {
      setSyncState('error')
      setSyncMsg(e.response?.data?.message || e.message || 'Sync failed — please try again')
    }
  }

  async function handleBlock() {
    if (!window.confirm(`${student?.is_blocklisted ? 'Unblock' : 'Block'} ${student?.full_name}?`)) return
    setBlocking(true)
    try {
      if (student.is_blocklisted) await adminAPI.unblock(decodedEmail)
      else                        await adminAPI.block(decodedEmail)
      await load()
    } finally { setBlocking(false) }
  }

  async function handleUpdateHandle(platform, username) {
    await adminAPI.updateHandle(decodedEmail, platform, username)
    await load()
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <AdminHeader title="Student Profile" breadcrumb="Students" onRefresh={load} />
      <div className="page"><div className="loading-center"><div className="spinner" /> Loading profile…</div></div>
    </>
  )

  if (error) return (
    <>
      <AdminHeader title="Student Profile" breadcrumb="Students" onRefresh={load} />
      <div className="page">
        <div className="msg msg-error"><AlertCircle size={14} /> {error}</div>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => navigate('/students')}>
          <ArrowLeft size={14} /> Back to Students
        </button>
      </div>
    </>
  )

  const currentSection = SECTIONS.find(s => s.id === section) || SECTIONS[0]

  return (
    <>
      <AdminHeader
        title={student?.full_name || 'Student Profile'}
        breadcrumb="Students"
        onRefresh={load}
      />

      <div className="page" style={{ padding: 0 }}>
        {/* ── Top action bar ────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 24px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--surface)',
        }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/students')}>
            <ArrowLeft size={14} /> Students
          </button>
          <div style={{ flex: 1 }} />

          {/* ── Sync feedback ── */}
          {syncState === 'syncing' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RefreshCw size={12} className="spin" /> Syncing all platforms…
            </span>
          )}
          {syncState === 'done' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--success, #22c55e)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={13} /> {syncMsg}
            </span>
          )}
          {syncState === 'error' && (
            <span style={{ fontSize: '0.78rem', color: 'var(--danger, #ef4444)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <XCircle size={13} /> {syncMsg}
              <button className="btn btn-ghost" style={{ height: 22, fontSize: '0.68rem', padding: '0 6px', marginLeft: 4 }}
                onClick={() => setSyncState('idle')}>Dismiss</button>
            </span>
          )}

          <button
            className="btn btn-ghost btn-sm"
            onClick={handleSync}
            disabled={syncState === 'syncing'}
            title="Fetch latest data from all platforms for this student"
          >
            <RefreshCw size={13} className={syncState === 'syncing' ? 'spin' : ''} />
            {syncState === 'syncing' ? 'Syncing…' : 'Sync Now'}
          </button>
          <button
            className={`btn btn-sm ${student?.is_blocklisted ? 'btn-success' : 'btn-danger'}`}
            onClick={handleBlock} disabled={blocking}
          >
            {student?.is_blocklisted
              ? <><UserCheck size={13} /> Unblock</>
              : <><UserX    size={13} /> Block</>
            }
          </button>
        </div>

        {/* ── Main layout: vertical sidebar + content ───────────────────── */}
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 120px)' }}>

          {/* ── Vertical sidebar ─────────────────────────────────────────── */}
          <aside style={{
            width: 200, flexShrink: 0,
            borderRight: '1px solid var(--border-subtle)',
            background: 'var(--surface)',
            padding: '20px 0',
            position: 'sticky', top: 0, height: 'fit-content',
          }}>
            {/* Student mini avatar */}
            <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--chart-1), var(--chart-2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700, color: '#fff', flexShrink: 0,
                }}>
                  {(student?.full_name || 'S')[0].toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {student?.full_name?.split(' ')[0] || 'Student'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--fg-subtle)' }}>
                    {student?.branch || student?.college || ''}
                  </div>
                </div>
              </div>
            </div>

            {/* Nav items */}
            <nav>
              {SECTIONS.map(s => {
                const isActive = section === s.id
                const hasHandle = s.id !== 'dashboard' && platformsObj[s.id]?.username
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '10px 16px',
                      background: isActive ? 'rgba(var(--primary-rgb, 99,102,241), 0.1)' : 'transparent',
                      border: 'none', borderRight: isActive ? `3px solid ${s.color}` : '3px solid transparent',
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{s.icon}</span>
                    <span style={{
                      fontSize: '0.82rem', fontWeight: isActive ? 600 : 400,
                      color: isActive ? s.color : 'var(--fg-muted)',
                      flex: 1,
                    }}>
                      {s.label}
                    </span>
                    {s.id !== 'dashboard' && !hasHandle && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fg-subtle)', flexShrink: 0 }} title="No handle linked" />
                    )}
                  </button>
                )
              })}
            </nav>
          </aside>

          {/* ── Main content — wrapped so we can hide the back button via CSS ──── */}
          <main className="admin-profile-wrapper" style={{ flex: 1, overflow: 'auto', padding: '24px', minWidth: 0 }}>
            {section === 'dashboard' && (
              <DashboardSection
                student={student}
                platformsObj={platformsObj}
                onUpdateHandle={handleUpdateHandle}
              />
            )}

            {section !== 'dashboard' && (
              <PlatformSection
                email={decodedEmail}
                platform={section}
                handles={{
                  leetcode:   platformsObj.leetcode?.username,
                  codeforces: platformsObj.codeforces?.username,
                  codechef:   platformsObj.codechef?.username,
                  hackerrank: platformsObj.hackerrank?.username,
                }}
                apiFetch={makeAdminApiFetch(decodedEmail)}
              />
            )}
          </main>
        </div>
      </div>
    </>
  )
}
