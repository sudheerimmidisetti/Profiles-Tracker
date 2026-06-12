import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminAPI, analyticsAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import { ArrowLeft, ShieldOff, ShieldCheck, AlertCircle,
         Trophy, Star, Zap, Code, ExternalLink } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, CartesianGrid
} from 'recharts'

const PLATFORM_COLORS = {
  leetcode:   'var(--lc)',
  codeforces: 'var(--cf)',
  codechef:   'var(--cc)',
  hackerrank: 'var(--hr)',
}
const PLATFORM_LABELS = {
  leetcode:   'LeetCode',
  codeforces: 'Codeforces',
  codechef:   'CodeChef',
  hackerrank: 'HackerRank',
}
const PLATFORM_URLS = {
  leetcode:   u => `https://leetcode.com/${u}`,
  codeforces: u => `https://codeforces.com/profile/${u}`,
  codechef:   u => `https://www.codechef.com/users/${u}`,
  hackerrank: u => `https://www.hackerrank.com/profile/${u}`,
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

function RatingChart({ snapshots }) {
  if (!snapshots?.length) return null
  const data = snapshots
    .slice(-60)
    .map(s => ({
      date: new Date(s.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      lc:   s.lc_rating   || null,
      cf:   s.cf_rating   || null,
      cc:   s.cc_rating   || null,
    }))

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Rating History</span>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<DarkTooltip />} />
            <Line type="monotone" dataKey="lc" name="LeetCode"   stroke="var(--lc)" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="cf" name="Codeforces" stroke="var(--cf)" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="cc" name="CodeChef"   stroke="var(--cc)" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function SolvedChart({ snapshots }) {
  if (!snapshots?.length) return null
  const data = snapshots
    .slice(-60)
    .map(s => ({
      date:  new Date(s.recorded_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
      lc:    s.lc_solved   || null,
      cf:    s.cf_solved   || null,
      cc:    s.cc_solved   || null,
      hr:    s.hr_solved   || null,
    }))

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">Problems Solved</span>
      </div>
      <div className="card-body">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<DarkTooltip />} />
            <Line type="monotone" dataKey="lc" name="LeetCode"   stroke="var(--lc)" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="cf" name="Codeforces" stroke="var(--cf)" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="cc" name="CodeChef"   stroke="var(--cc)" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="hr" name="HackerRank" stroke="var(--hr)" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default function StudentDetailPage() {
  const { email }   = useParams()
  const navigate    = useNavigate()
  const [loading,   setLoading]   = useState(true)
  const [student,   setStudent]   = useState(null)
  const [platforms, setPlatforms] = useState({})
  const [snapshots, setSnapshots] = useState(null)
  const [blocking,  setBlocking]  = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      adminAPI.getStudent(decodeURIComponent(email)),
      analyticsAPI.snapshots(decodeURIComponent(email)).catch(() => null),
    ]).then(([stuRes, snapRes]) => {
      setStudent(stuRes.data.data.student)
      setPlatforms(stuRes.data.data.platforms)
      setSnapshots(snapRes?.data?.data || null)
    }).catch(e => {
      setError(e.response?.data?.message || 'Failed to load student')
    }).finally(() => setLoading(false))
  }, [email])

  const handleBlock = async () => {
    if (!confirm(`Block ${student?.full_name || email} from leaderboards?`)) return
    setBlocking(true)
    try {
      await adminAPI.block(decodeURIComponent(email))
      setStudent(s => ({ ...s, is_blocklisted: true }))
    } finally { setBlocking(false) }
  }

  const handleUnblock = async () => {
    setBlocking(true)
    try {
      await adminAPI.unblock(decodeURIComponent(email))
      setStudent(s => ({ ...s, is_blocklisted: false }))
    } finally { setBlocking(false) }
  }

  const initials = student?.full_name
    ?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <>
      <AdminHeader title="Student Profile" breadcrumb="Students" />
      <div className="page">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => navigate(-1)}
          style={{ alignSelf: 'flex-start', marginBottom: -8 }}
        >
          <ArrowLeft size={14} /> Back to Students
        </button>

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading profile…</div>
        ) : error ? (
          <div className="empty-state">
            <AlertCircle size={32} style={{ color: 'var(--danger)' }} />
            <p className="empty-title">{error}</p>
          </div>
        ) : (
          <>
            {/* Profile Hero */}
            <div className="card">
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <div className="avatar avatar-lg">{initials}</div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{student?.full_name || '—'}</h2>
                    {student?.is_verified    && <span className="badge badge-green">✓ Verified</span>}
                    {student?.is_blocklisted && <span className="badge badge-red">⛔ Blocked</span>}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--fg-muted)', marginBottom: 8 }}>{student?.email}</p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {student?.roll_number  && <span className="badge badge-gray">{student.roll_number}</span>}
                    {student?.branch       && <span className="badge badge-gray">{student.branch}</span>}
                    {student?.passout_year && <span className="badge badge-gray">Class of {student.passout_year}</span>}
                    {student?.college      && <span className="badge badge-gray">{student.college}</span>}
                    {student?.phone        && <span className="badge badge-gray">📞 {student.phone}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  {student?.is_blocklisted ? (
                    <button className="btn btn-success" onClick={handleUnblock} disabled={blocking}>
                      <ShieldCheck size={14} /> Unblock
                    </button>
                  ) : (
                    <button className="btn btn-danger" onClick={handleBlock} disabled={blocking}>
                      <ShieldOff size={14} /> Block from Leaderboard
                    </button>
                  )}
                  <p style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)' }}>
                    Joined {new Date(student?.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Platform Cards */}
            <div>
              <h3 className="section-label">Platform Profiles</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {['leetcode', 'codeforces', 'codechef', 'hackerrank'].map(p => {
                  const d = platforms[p]
                  const color = PLATFORM_COLORS[p]
                  return (
                    <div key={p} className="kpi-card" style={{ borderTop: `3px solid ${color}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <p style={{ fontSize: '0.7rem', color: 'var(--fg-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {PLATFORM_LABELS[p]}
                        </p>
                        {d?.username && (
                          <a
                            href={PLATFORM_URLS[p](d.username)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--fg-muted)' }}
                            title={`View @${d.username}`}
                          >
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                      {d ? (
                        <>
                          <p style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{d.current_rating ? Math.round(d.current_rating) : '—'}</p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--fg-muted)', marginTop: 2 }}>
                            {d.total_solved ?? 0} solved
                            {d.global_rank ? ` · #${d.global_rank.toLocaleString()}` : ''}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--fg-subtle)', marginTop: 2 }}>@{d.username}</p>
                        </>
                      ) : (
                        <p style={{ fontSize: '0.8rem', color: 'var(--fg-subtle)' }}>Not linked</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Charts */}
            {snapshots && snapshots.length > 0 && (
              <div className="grid-2">
                <RatingChart snapshots={snapshots} />
                <SolvedChart snapshots={snapshots} />
              </div>
            )}

            {/* Snapshot availability notice */}
            {(!snapshots || snapshots.length === 0) && (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <Zap size={28} style={{ color: 'var(--fg-subtle)' }} />
                <p className="empty-title" style={{ fontSize: '0.9rem' }}>No history snapshots yet</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>
                  Snapshots are recorded nightly after the sync job runs.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
