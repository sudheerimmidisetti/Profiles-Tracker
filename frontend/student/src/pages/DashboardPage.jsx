// frontend/student/src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { analyticsAPI } from '../api/api'
import { useNavigate } from 'react-router-dom'
import Header         from '../components/Header'
import KPICards       from '../components/KPICards'
import PlatformCard   from '../components/PlatformCard'
import ActivityHeatmap from '../components/ActivityHeatmap'
import { ShieldCheck } from 'lucide-react'

export default function DashboardPage() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [summary,   setSummary]   = useState(null)
  const [heatmap,   setHeatmap]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [hmLoading, setHmLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) return
    analyticsAPI.summary(user.email)
      .then(r => setSummary(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

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
        {/* Verification warning */}
        {user && !user.is_verified && (
          <div
            className="msg msg-info"
            style={{ cursor: 'pointer', marginBottom: 16 }}
            onClick={() => navigate('/verify-handlers')}
          >
            <ShieldCheck size={16} />
            <span>Your coding handles are not verified yet. <strong>Link your accounts →</strong></span>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading your stats…</div>
        ) : (
          <>
            <KPICards data={summary} />

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
