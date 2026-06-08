import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { analyticsAPI } from '../api/api'
import Header from '../components/Header'
import KPICards from '../components/KPICards'
import PlatformCard from '../components/PlatformCard'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [summary,  setSummary]  = useState(null)
  const [snapshots, setSnapshots] = useState(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user?.email) return

    Promise.all([
      analyticsAPI.summary(user.email),
      analyticsAPI.snapshots(user.email),
    ])
      .then(([s, snap]) => {
        setSummary(s.data.data)
        setSnapshots(snap.data.data)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const platforms = summary?.platforms || {}
  const lcCalendar = null // Would come from a dedicated LC endpoint if available

  return (
    <>
      <Header title="Dashboard" breadcrumb="Overview" />

      <div className="page">
        {/* Verification warning */}
        {user && !user.is_verified && (
          <div className="msg msg-info" style={{ cursor: 'pointer' }} onClick={() => navigate('/verify-handlers')}>
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

            {/* Heatmap (LeetCode contribution calendar) */}
            <ActivityHeatmap calendarJson={platforms.leetcode?.contribution_calendar} />
          </>
        )}
      </div>
    </>
  )
}
