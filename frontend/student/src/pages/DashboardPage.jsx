// frontend/student/src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { analyticsAPI } from '../api/api'
import Header         from '../components/Header'
import KPICards       from '../components/KPICards'
import PlatformCard   from '../components/PlatformCard'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { ShieldCheck, GraduationCap, Hash, BookOpen, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// ── Profile Hero Card ──────────────────────────────────────────────────────────
function ProfileHero({ user }) {
  if (!user) return null

  const initials = (user.full_name || user.email || '?')
    .split(' ').map(s => s[0]).join('').toUpperCase().slice(0, 2)

  const currentYear = new Date().getFullYear()
  const yearLabel = user.passout_year
    ? (() => {
        const diff = Number(user.passout_year) - currentYear
        if (diff > 3) return '1st Year'
        if (diff === 3) return '2nd Year'
        if (diff === 2) return '3rd Year'
        if (diff === 1) return '4th Year'
        return `Passout ${user.passout_year}`
      })()
    : null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 20,
      padding: '20px 24px', borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.08) 100%)',
      border: '1px solid rgba(99,102,241,0.2)',
      marginBottom: 24, flexWrap: 'wrap',
    }}>
      {/* Avatar */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.4rem', fontWeight: 900, color: '#fff', letterSpacing: '-.04em',
        boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
      }}>
        {initials}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-.03em', color: 'var(--fg)' }}>
            {user.full_name || 'Student'}
          </h2>
          {user.is_verified && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              padding: '2px 9px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 700,
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              color: '#22c55e',
            }}>
              <ShieldCheck size={9}/> Verified
            </span>
          )}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px' }}>
          {user.roll_number && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              <Hash size={11} style={{ color: '#6366f1' }}/>{user.roll_number}
            </span>
          )}
          {user.branch && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              <BookOpen size={11} style={{ color: '#a855f7' }}/>{user.branch}
            </span>
          )}
          {yearLabel && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--fg-muted)' }}>
              <GraduationCap size={11} style={{ color: '#f59e0b' }}/>{yearLabel}
            </span>
          )}
          {user.college && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: 'var(--fg-muted)', maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <User size={11} style={{ color: '#22c55e' }}/>{user.college}
            </span>
          )}
        </div>
      </div>

      {/* Email chip */}
      <div style={{
        padding: '6px 14px', borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--border)',
        fontSize: '0.75rem', color: 'var(--fg-muted)', fontFamily: 'monospace',
      }}>
        {user.email}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()

  const [summary,  setSummary]  = useState(null)
  const [heatmap,  setHeatmap]  = useState(null)   // { calendarMap, firstDate }
  const [loading,  setLoading]  = useState(true)
  const [hmLoading, setHmLoading] = useState(true)

  // Load summary (platform cards + KPI)
  useEffect(() => {
    if (!user?.email) return
    analyticsAPI.summary(user.email)
      .then(r => setSummary(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  // Load combined heatmap separately (heavier query, parallel)
  useEffect(() => {
    if (!user?.email) return
    analyticsAPI.heatmap()
      .then(r => setHeatmap(r.data.data))
      .catch(console.error)
      .finally(() => setHmLoading(false))
  }, [user])

  const platforms = summary?.platforms || {}

  return (
    <>
      <Header title="Dashboard" breadcrumb="Overview" />

      <div className="page">
        {/* Profile Hero */}
        <ProfileHero user={user} />

        {/* Verification warning */}
        {user && !user.is_verified && (
          <div className="msg msg-info" style={{ cursor: 'pointer', marginBottom: 16 }} onClick={() => navigate('/verify-handlers')}>
            <ShieldCheck size={16} />
            <span>
              Your coding handles are not verified yet.{' '}
              <strong>Link your accounts →</strong>
            </span>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading your stats…</div>
        ) : (
          <>
            {/* KPI row */}
            <KPICards data={summary} />

            {/* Platform cards */}
            <div>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 12, color: 'var(--fg-muted)' }}>
                PLATFORM BREAKDOWN
              </h2>
              <div className="platform-grid">
                {['leetcode', 'codeforces', 'codechef', 'hackerrank'].map(p => (
                  <PlatformCard key={p} platform={p} data={platforms[p]} />
                ))}
              </div>
            </div>

            {/* Combined Activity Heatmap */}
            {hmLoading ? (
              <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: '0.85rem' }}>
                <div className="spinner" style={{ display: 'inline-block', marginRight: 8 }} />
                Loading activity heatmap…
              </div>
            ) : (
              <ActivityHeatmap
                calendar={heatmap?.calendarMap || {}}
                firstDate={heatmap?.firstDate || null}
                color="#22c55e"
                title="Submission Activity — All Platforms"
                platform="all"
              />
            )}
          </>
        )}
      </div>
    </>
  )
}
