import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { analyticsAPI, adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import { ArrowLeft, ShieldOff, ShieldCheck, AlertCircle } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'

function MiniTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: '0.78rem' }}>
      <p style={{ color: 'var(--fg-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>)}
    </div>
  )
}

function RatingChartLocal({ data }) {
  const platforms = Object.keys(data || {}).filter(p => data[p]?.length)
  const COLORS = { leetcode: 'var(--lc)', codeforces: 'var(--cf)', codechef: 'var(--cc)', hackerrank: 'var(--hr)' }
  const dateMap = {}
  platforms.forEach(p => data[p].forEach(e => {
    const d = e.date?.slice(0,10)
    if (!dateMap[d]) dateMap[d] = { date: d }
    dateMap[d][p] = e.rating
  }))
  const chartData = Object.values(dateMap).sort((a,b) => a.date.localeCompare(b.date))

  if (!chartData.length) return <div className="empty-state" style={{ minHeight: 160 }}><p className="empty-desc">No rating history</p></div>

  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">Rating Over Time</h3></div>
      <div className="card-body" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={d => d?.slice(5)} tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<MiniTooltip />} />
            {platforms.map(p => <Line key={p} type="monotone" dataKey={p} stroke={COLORS[p]} strokeWidth={2} dot={false} name={p} connectNulls />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SolvedChartLocal({ data }) {
  const platforms = Object.keys(data || {}).filter(p => data[p]?.length)
  const COLORS = { leetcode: 'var(--lc)', codeforces: 'var(--cf)', codechef: 'var(--cc)', hackerrank: 'var(--hr)' }
  const dateMap = {}
  platforms.forEach(p => data[p].forEach(e => {
    const d = e.date?.slice(0,7)
    if (!dateMap[d]) dateMap[d] = { date: d }
    if (!dateMap[d][p] || e.totalSolved > dateMap[d][p]) dateMap[d][p] = e.totalSolved
  }))
  const chartData = Object.values(dateMap).sort((a,b) => a.date.localeCompare(b.date))

  if (!chartData.length) return null

  return (
    <div className="card">
      <div className="card-header"><h3 className="card-title">Problems Solved (Monthly)</h3></div>
      <div className="card-body" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--fg-subtle)' }} axisLine={false} tickLine={false} />
            <Tooltip content={<MiniTooltip />} />
            {platforms.map(p => <Bar key={p} dataKey={p} fill={COLORS[p]} radius={[3,3,0,0]} name={p} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function StudentDetailPage() {
  const { email } = useParams()
  const navigate  = useNavigate()

  const [summary,   setSummary]   = useState(null)
  const [snapshots, setSnapshots] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [blocking,  setBlocking]  = useState(false)

  const decodedEmail = decodeURIComponent(email)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      analyticsAPI.summary(decodedEmail),
      analyticsAPI.snapshots(decodedEmail),
    ])
      .then(([s, snap]) => { setSummary(s.data.data); setSnapshots(snap.data.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [decodedEmail])

  const handleBlock = async () => {
    setBlocking(true)
    try {
      await adminAPI.block(decodedEmail)
      setSummary(s => ({ ...s, student: { ...s?.student, is_blocklisted: true } }))
    } finally { setBlocking(false) }
  }

  const handleUnblock = async () => {
    setBlocking(true)
    try {
      await adminAPI.unblock(decodedEmail)
      setSummary(s => ({ ...s, student: { ...s?.student, is_blocklisted: false } }))
    } finally { setBlocking(false) }
  }

  const student   = summary?.student
  const platforms = summary?.platforms || {}
  const initials  = student?.full_name
    ? student.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <>
      <AdminHeader title="Student Detail" breadcrumb="Students" />
      <div className="page">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ alignSelf: 'flex-start', marginBottom: -8 }}>
          <ArrowLeft size={14} /> Back to Students
        </button>

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading…</div>
        ) : !student ? (
          <div className="empty-state">
            <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
            <p className="empty-title">Student not found</p>
          </div>
        ) : (
          <>
            {/* Profile card */}
            <div className="card">
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div className="avatar avatar-lg">{initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{student.full_name || '—'}</h2>
                    {student.is_verified    && <span className="badge badge-green">✓ Verified</span>}
                    {student.is_blocklisted && <span className="badge badge-red">Blocked</span>}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginTop: 4 }}>{student.email}</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    <span className="badge badge-gray">{student.roll_number || '—'}</span>
                    <span className="badge badge-gray">{student.branch || '—'}</span>
                    {student.phone && <span className="badge badge-gray">📞 {student.phone}</span>}
                  </div>
                </div>
                <div>
                  {student.is_blocklisted ? (
                    <button className="btn btn-success" onClick={handleUnblock} disabled={blocking}>
                      <ShieldCheck size={15} /> Unblock
                    </button>
                  ) : (
                    <button className="btn btn-danger" onClick={handleBlock} disabled={blocking}>
                      <ShieldOff size={15} /> Block from Leaderboard
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Platform stats */}
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 12 }}>PLATFORM STATS</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                {['leetcode','codeforces','codechef','hackerrank'].map(p => {
                  const d = platforms[p]
                  return (
                    <div key={p} className="kpi-card">
                      <p style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', textTransform: 'capitalize', marginBottom: 8 }}>{p}</p>
                      <p style={{ fontSize: '1.4rem', fontWeight: 800 }}>{d?.current_rating ? Math.round(d.current_rating) : '—'}</p>
                      <p style={{ fontSize: '0.72rem', color: 'var(--fg-muted)' }}>
                        {d ? `${d.total_solved ?? 0} solved · @${d.username || '?'}` : 'Not linked'}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Charts */}
            {snapshots && (
              <div className="grid-2">
                <RatingChartLocal data={snapshots} />
                <SolvedChartLocal data={snapshots} />
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
