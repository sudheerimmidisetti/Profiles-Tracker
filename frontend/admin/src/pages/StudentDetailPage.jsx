// StudentDetailPage.jsx — Full student profile in admin (all 5 tabs stacked vertically)
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import {
  ArrowLeft, ShieldOff, ShieldCheck, RefreshCw, Pencil, ExternalLink,
  ChevronDown, ChevronUp, User, Code, Trophy, Star, Zap, AlertCircle,
  RotateCcw, UserCheck, UserX
} from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area
} from 'recharts'

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate  = d => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const fmtNum   = v => typeof v === 'number' ? v.toLocaleString() : (v ?? '—')
const colorOf  = p => ({ leetcode: 'var(--lc)', codeforces: 'var(--cf)', codechef: 'var(--cc)', hackerrank: 'var(--hr)' })[p] || 'var(--fg)'

const PLATFORM_META = {
  leetcode:   { label: 'LeetCode',   short: 'LC', icon: '🟡', max: 30, url: u => `https://leetcode.com/${u}` },
  codeforces: { label: 'Codeforces', short: 'CF', icon: '🔵', max: 20, url: u => `https://codeforces.com/profile/${u}` },
  codechef:   { label: 'CodeChef',   short: 'CC', icon: '🟤', max: 30, url: u => `https://www.codechef.com/users/${u}` },
  hackerrank: { label: 'HackerRank', short: 'HR', icon: '🟢', max: 20, url: u => `https://www.hackerrank.com/profile/${u}` },
}

function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: '0.8rem'
    }}>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontWeight: 600 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Collapsible section wrapper ───────────────────────────────────────────────
function Section({ title, icon, color, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div
        className="card-header"
        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.2rem' }}>{icon}</span>
          <span className="card-title" style={{ color }}>{title}</span>
        </div>
        {open ? <ChevronUp size={16} color="var(--fg-muted)" /> : <ChevronDown size={16} color="var(--fg-muted)" />}
      </div>
      {open && <div className="card-body">{children}</div>}
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--muted)', borderRadius: 'var(--radius-sm)',
      padding: '14px 16px', minWidth: 110
    }}>
      <div style={{ fontSize: '0.68rem', color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color || 'var(--fg)', lineHeight: 1.2, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.68rem', color: 'var(--fg-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// ── Handle edit modal ─────────────────────────────────────────────────────────
function HandleEditRow({ platform, handle, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(handle || '')
  const [loading, setLoading] = useState(false)

  async function save() {
    if (!val.trim()) return
    setLoading(true)
    try { await onSave(platform, val.trim()); setEditing(false) }
    catch {}
    finally { setLoading(false) }
  }

  const meta = PLATFORM_META[platform]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ width: 80, fontSize: '0.8rem', color: colorOf(platform), fontWeight: 600 }}>{meta?.label}</span>
      {editing ? (
        <>
          <input
            className="form-input"
            style={{ flex: 1, height: 30, fontSize: '0.82rem' }}
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            autoFocus
          />
          <button className="btn btn-primary" style={{ height: 30, fontSize: '0.78rem', padding: '0 12px' }} onClick={save} disabled={loading}>
            {loading ? '…' : 'Save'}
          </button>
          <button className="btn btn-ghost" style={{ height: 30, fontSize: '0.78rem', padding: '0 10px' }} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </>
      ) : (
        <>
          <span style={{ flex: 1, fontSize: '0.85rem', color: handle ? 'var(--fg)' : 'var(--fg-subtle)' }}>
            {handle || 'Not linked'}
          </span>
          {handle && (
            <a href={meta?.url?.(handle)} target="_blank" rel="noreferrer" className="icon-btn" title="Open profile">
              <ExternalLink size={13} />
            </a>
          )}
          <button className="icon-btn" title="Edit handle" onClick={() => setEditing(true)}>
            <Pencil size={13} />
          </button>
        </>
      )}
    </div>
  )
}

// ── Platform profile card ─────────────────────────────────────────────────────
function PlatformProfileCard({ email, platform, handles }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const meta                  = PLATFORM_META[platform]
  const handle                = handles[platform]

  const load = useCallback(async () => {
    if (!handle) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const res = await adminAPI.getPlatform(email, platform)
      setData(res.data?.data ?? res.data)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to load ${meta.label} data`)
    } finally {
      setLoading(false)
    }
  }, [email, platform, handle])

  useEffect(() => { load() }, [load])

  if (!handle) {
    return (
      <div style={{ padding: '20px 0', color: 'var(--fg-subtle)', fontSize: '0.85rem', textAlign: 'center' }}>
        No {meta.label} handle linked. Edit the handle above to add one.
      </div>
    )
  }

  if (loading) return <div className="loading-center" style={{ padding: 30 }}><div className="spinner" /></div>
  if (error)   return <div className="msg msg-error"><AlertCircle size={14} /> {error}</div>
  if (!data)   return null

  const base    = data.detail || data.base || {}
  const detail  = data.detail || {}
  const contests = data.contests || []
  const submissions = data.recentAC || data.acSubmissions || []

  // Build rating chart data
  const ratingHistory = (data.ratingHistory || contests.map((c, i) => ({
    name: c.contestTitle || c.contest_name || c.contest_code || `#${i+1}`,
    rating: c.ratingAfterContest || c.rating_after_contest || c.new_rating,
    date: c.contestTime ? new Date(c.contestTime * 1000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) : c.contest_date || '',
  }))).filter(r => r.rating).slice(-20)

  return (
    <div>
      {/* Stats grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
        {platform === 'leetcode' && <>
          <KPI label="Rating"     value={fmtNum(base.current_rating || detail.contest_rating || detail.rating)} color={colorOf(platform)} />
          <KPI label="Solved"     value={fmtNum(detail.total_solved || detail.totalSolved)}
            sub={`E:${detail.easy_solved||detail.easySolved||0} M:${detail.medium_solved||detail.mediumSolved||0} H:${detail.hard_solved||detail.hardSolved||0}`} />
          <KPI label="Acceptance" value={detail.acceptance_rate ? `${parseFloat(detail.acceptance_rate).toFixed(1)}%` : (detail.acceptanceRate ? `${(detail.acceptanceRate*100).toFixed(1)}%` : '—')} />
          <KPI label="Streak"     value={detail.streak ? `${detail.streak}d` : (detail.currentStreak ? `${detail.currentStreak}d` : '—')} sub="current" />
          <KPI label="Contests"   value={fmtNum(detail.attended_contests_count || detail.contestCount || contests.length)} />
          <KPI label="Global Rank" value={base.global_rank ? `#${fmtNum(base.global_rank)}` : (detail.global_ranking ? `#${fmtNum(detail.global_ranking)}` : '—')} />
        </>}
        {platform === 'codeforces' && <>
          <KPI label="Rating"     value={fmtNum(base.current_rating || detail.currentRating)} color={colorOf(platform)} />
          <KPI label="Max Rating" value={fmtNum(detail.maxRating || detail.max_rating)} />
          <KPI label="Rank"       value={detail.rank || detail.current_rank || base.rank || '—'} />
          <KPI label="Contests"   value={fmtNum(contests.length)} />
          <KPI label="Problems"   value={fmtNum(detail.total_solved || detail.totalSolved || base.total_solved)} />
        </>}
        {platform === 'codechef' && <>
          <KPI label="Rating"     value={fmtNum(base.current_rating || detail.currentRating)} color={colorOf(platform)} />
          <KPI label="Stars"      value={detail.stars || detail.star || base.stars || '—'} />
          <KPI label="Global Rank" value={base.global_rank ? `#${fmtNum(base.global_rank)}` : '—'} />
          <KPI label="Contests"   value={fmtNum(contests.length)} />
        </>}
        {platform === 'hackerrank' && <>
          <KPI label="PS Stars"     value={`${detail.problem_solving_stars ?? detail.problemSolvingStars ?? 0}★`} color={colorOf(platform)} />
          <KPI label="SQL Stars"    value={`${detail.sql_stars ?? detail.sqlStars ?? 0}★`} />
          <KPI label="Java Stars"   value={`${detail.java_stars ?? detail.javaStars ?? 0}★`} />
          <KPI label="Python Stars" value={`${detail.python_stars ?? detail.pythonStars ?? 0}★`} />
        </>}
      </div>

      {/* Rating history chart */}
      {ratingHistory.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Rating History
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={ratingHistory}>
              <defs>
                <linearGradient id={`grad_${platform}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={colorOf(platform)} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={colorOf(platform)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis dataKey="date" tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--fg-subtle)', fontSize: 10 }} />
              <Tooltip content={<DarkTooltip />} />
              <Area type="monotone" dataKey="rating" name="Rating"
                stroke={colorOf(platform)} fill={`url(#grad_${platform})`} strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent contests table */}
      {contests.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recent Contests ({contests.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Contest</th>
                  <th style={{ textAlign: 'right' }}>Rank</th>
                  <th style={{ textAlign: 'right' }}>Rating</th>
                  <th style={{ textAlign: 'right' }}>Change</th>
                  {platform === 'leetcode' && <th style={{ textAlign: 'right' }}>Solved</th>}
                  {platform === 'codechef' && <th>Div</th>}
                </tr>
              </thead>
              <tbody>
                {contests.slice(0, 15).map((c, i) => {
                  const rawChange = (c.ratingAfterContest || c.new_rating || 0) - (c.ratingBeforeContest || c.old_rating || 0)
                  const change = c.ratingChange ?? c.rating_change ?? rawChange
                  return (
                    <tr key={i}>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        {c.contestTitle || c.contest_name || c.contest_code || c.contestId}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        #{fmtNum(c.rankAchieved || c.rank_achieved)}
                      </td>
                      <td style={{ textAlign: 'right', color: colorOf(platform), fontWeight: 700 }}>
                        {fmtNum(c.ratingAfterContest || c.rating_after_contest || c.new_rating)}
                      </td>
                      <td style={{ textAlign: 'right', color: change > 0 ? 'var(--success)' : change < 0 ? 'var(--danger)' : 'var(--fg-muted)', fontWeight: 600, fontSize: '0.82rem' }}>
                        {change > 0 ? `+${change}` : change || '—'}
                      </td>
                      {platform === 'leetcode' && <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{c.problemsSolved ?? c.problems_solved ?? '—'}</td>}
                      {platform === 'codechef' && <td><span className="badge badge-gray" style={{ fontSize: '0.68rem' }}>{c.division || '—'}</span></td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LC difficulty breakdown */}
      {platform === 'leetcode' && (detail.total_solved || detail.totalSolved) > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Difficulty Breakdown
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {[
              { label: 'Easy',   count: detail.easy_solved   || detail.easySolved   || 0, color: '#00b8a9' },
              { label: 'Medium', count: detail.medium_solved || detail.mediumSolved || 0, color: '#ffc01e' },
              { label: 'Hard',   count: detail.hard_solved   || detail.hardSolved   || 0, color: '#ef4743' },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ background: 'var(--muted)', borderRadius: 8, padding: '10px 14px', flex: 1, textAlign: 'center' }}>
                <div style={{ color, fontWeight: 700, fontSize: '1.3rem' }}>{count}</div>
                <div style={{ color: 'var(--fg-muted)', fontSize: '0.72rem', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent AC submissions */}
      {submissions.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Recent Accepted Submissions ({submissions.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {submissions.slice(0, 20).map((s, i) => (
              <span key={i} className="badge badge-gray" style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                {s.title || s.problemId || s.problem_id || `#${i+1}`}
              </span>
            ))}
          </div>
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

  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [blocking, setBlocking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await adminAPI.getStudent(decodedEmail)
      // API returns { success, data: { student: {...}, platforms: { leetcode:{}, ... } } }
      const body = res.data?.data ?? res.data
      const studentData = body?.student ?? body
      const platformsObj = body?.platforms ?? {}
      // Attach platforms object onto student for easy access
      setStudent({ ...studentData, _platforms: platformsObj })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load student')
    } finally {
      setLoading(false)
    }
  }, [decodedEmail])

  useEffect(() => { load() }, [load])

  async function handleSync() {
    setSyncing(true); setSyncMsg('')
    try {
      await adminAPI.syncStudent(decodedEmail)
      setSyncMsg('Sync started! Data will update in a few minutes.')
    } catch (e) {
      setSyncMsg(e.response?.data?.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleBlock() {
    if (!window.confirm(`Are you sure you want to ${student?.is_blocklisted ? 'unblock' : 'block'} ${student?.full_name}?`)) return
    setBlocking(true)
    try {
      if (student.is_blocklisted) { await adminAPI.unblock(decodedEmail) }
      else { await adminAPI.block(decodedEmail) }
      await load()
    } finally { setBlocking(false) }
  }

  async function handleUpdateHandle(platform, username) {
    await adminAPI.updateHandle(decodedEmail, platform, username)
    await load()
  }

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

  // platforms is an object keyed by platform name: { leetcode: {...}, codechef: {...}, ... }
  const platformsObj = student._platforms || {}
  const handles = {
    leetcode:   platformsObj.leetcode?.username,
    codeforces: platformsObj.codeforces?.username,
    codechef:   platformsObj.codechef?.username,
    hackerrank: platformsObj.hackerrank?.username,
  }

  return (
    <>
      <AdminHeader
        title={student.full_name || 'Student Profile'}
        breadcrumb="Students"
        onRefresh={load}
      />
      <div className="page">
        {/* Back + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/students')}>
            <ArrowLeft size={14} /> Students
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-ghost" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? 'spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
          <button
            className={`btn ${student.is_blocklisted ? 'btn-success' : 'btn-danger'}`}
            onClick={handleBlock}
            disabled={blocking}
          >
            {student.is_blocklisted
              ? <><UserCheck size={14} /> Unblock</>
              : <><UserX size={14} /> Block</>
            }
          </button>
        </div>

        {syncMsg && (
          <div className={`msg ${syncMsg.includes('fail') ? 'msg-error' : 'msg-success'}`} style={{ marginBottom: 16 }}>
            {syncMsg}
          </div>
        )}

        {/* ── 1. Dashboard / Overview ─────────────────────────────────────── */}
        <Section title="Dashboard" icon="📊" color="var(--fg)" defaultOpen={true}>
          {/* Student info */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div style={{ flex: '1 1 200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--chart-1), var(--chart-2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', fontWeight: 800, color: '#fff', flexShrink: 0,
                }}>
                  {(student.full_name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--fg)' }}>{student.full_name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--fg-muted)' }}>{student.email}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <span className={`badge ${student.is_verified ? 'badge-green' : 'badge-gray'}`}>
                      {student.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                    {student.is_blocklisted && <span className="badge badge-red">Blocklisted</span>}
                  </div>
                </div>
              </div>
              <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                {[
                  ['Roll Number', student.roll_number],
                  ['Branch',      student.branch],
                  ['College',     student.college],
                  ['Passout Year',student.passout_year],
                  ['Phone',       student.phone],
                  ['Joined',      fmtDate(student.created_at)],
                ].map(([label, val]) => val && (
                  <tr key={label}>
                    <td style={{ color: 'var(--fg-subtle)', paddingRight: 12, paddingBottom: 4, whiteSpace: 'nowrap' }}>{label}</td>
                    <td style={{ color: 'var(--fg)', fontWeight: 500 }}>{val}</td>
                  </tr>
                ))}
              </table>
            </div>

            {/* Platform overview */}
            <div style={{ flex: '1 1 280px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Platform Handles
              </div>
              <div>
                {Object.keys(PLATFORM_META).map(p => (
                  <HandleEditRow
                    key={p}
                    platform={p}
                    handle={handles[p]}
                    onSave={handleUpdateHandle}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Platform rating KPIs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Object.values(platformsObj).map(pp => {
              const meta = PLATFORM_META[pp.platform_name]
              if (!meta) return null
              return (
                <div key={pp.platform_name} style={{
                  background: 'var(--muted)', borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px', minWidth: 120, borderLeft: `3px solid ${colorOf(pp.platform_name)}`
                }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--fg-subtle)', fontWeight: 600, textTransform: 'uppercase' }}>{meta.label}</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: colorOf(pp.platform_name), lineHeight: 1.2, marginTop: 4 }}>
                    {fmtNum(pp.current_rating) || '—'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', marginTop: 2 }}>
                    {pp.total_solved ? `${fmtNum(pp.total_solved)} solved` : ''}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--fg-subtle)', marginTop: 1 }}>
                    Updated {pp.last_updated ? new Date(pp.last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── 2. LeetCode ─────────────────────────────────────────────────── */}
        <Section title="LeetCode" icon="🟡" color="var(--lc)" defaultOpen={!!handles.leetcode}>
          <PlatformProfileCard email={decodedEmail} platform="leetcode" handles={handles} />
        </Section>

        {/* ── 3. CodeChef ─────────────────────────────────────────────────── */}
        <Section title="CodeChef" icon="🟤" color="var(--cc)" defaultOpen={!!handles.codechef}>
          <PlatformProfileCard email={decodedEmail} platform="codechef" handles={handles} />
        </Section>

        {/* ── 4. Codeforces ───────────────────────────────────────────────── */}
        <Section title="Codeforces" icon="🔵" color="var(--cf)" defaultOpen={!!handles.codeforces}>
          <PlatformProfileCard email={decodedEmail} platform="codeforces" handles={handles} />
        </Section>

        {/* ── 5. HackerRank ───────────────────────────────────────────────── */}
        <Section title="HackerRank" icon="🟢" color="var(--hr)" defaultOpen={!!handles.hackerrank}>
          <PlatformProfileCard email={decodedEmail} platform="hackerrank" handles={handles} />
        </Section>
      </div>
    </>
  )
}
