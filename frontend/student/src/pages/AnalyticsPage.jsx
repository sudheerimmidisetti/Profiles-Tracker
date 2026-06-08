import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { analyticsAPI } from '../api/api'
import Header from '../components/Header'
import { RatingChart, SolvedChart } from '../components/RatingChart'

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.email) return
    analyticsAPI.snapshots(user.email)
      .then(r => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  return (
    <>
      <Header title="Analytics" breadcrumb="Overview" />
      <div className="page">
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading analytics…</div>
        ) : (
          <>
            <RatingChart data={data || {}} />
            <SolvedChart data={data || {}} />

            {/* Stats grid */}
            {data && (
              <div className="grid-2">
                {Object.entries(data).map(([platform, entries]) => {
                  if (!entries?.length) return null
                  const latest = entries[entries.length - 1]
                  const first  = entries[0]
                  const ratingChange = (latest.rating || 0) - (first.rating || 0)
                  return (
                    <div key={platform} className="card">
                      <div className="card-header">
                        <h3 className="card-title" style={{ textTransform: 'capitalize' }}>{platform}</h3>
                        <span className={`badge ${ratingChange >= 0 ? 'badge-green' : 'badge-red'}`}>
                          {ratingChange >= 0 ? '+' : ''}{ratingChange} rating
                        </span>
                      </div>
                      <div className="card-body">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{latest.rating || '—'}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Current Rating</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800 }}>{latest.totalSolved || '—'}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Total Solved</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '1rem', fontWeight: 600 }}>{entries.length}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Data Points</p>
                          </div>
                          <div>
                            <p style={{ fontSize: '1rem', fontWeight: 600 }}>
                              {first.date?.slice(0, 10) || '—'}
                            </p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Tracked Since</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
