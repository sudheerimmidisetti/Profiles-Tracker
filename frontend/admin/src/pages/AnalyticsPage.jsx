import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import { PlatformComparisonChart, BranchDistributionChart, ActivityTrendChart } from '../components/PlatformCharts'
import { BarChart2, Users, Code, TrendingUp } from 'lucide-react'

export default function AnalyticsPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    adminAPI.overview()
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const branchDist = data?.branchDist?.reduce((acc, r) => {
    acc[r.branch] = parseInt(r.count, 10)
    return acc
  }, {}) ?? {}

  const platformSummary = data?.platforms || {}
  const totalSolved = Object.values(platformSummary).reduce((s, p) => s + (p.solved || 0), 0)
  const totalStudents = data?.students?.total || 0

  // Build per-platform summary rows
  const PLATFORM_ORDER = ['leetcode', 'codeforces', 'codechef', 'hackerrank']
  const PLATFORM_LABELS = { leetcode: 'LeetCode', codeforces: 'Codeforces', codechef: 'CodeChef', hackerrank: 'HackerRank' }
  const PLATFORM_COLORS = { leetcode: 'var(--lc)', codeforces: 'var(--cf)', codechef: 'var(--cc)', hackerrank: 'var(--hr)' }
  const PLATFORM_VAR   = { leetcode: 'lc', codeforces: 'cf', codechef: 'cc', hackerrank: 'hr' }

  return (
    <>
      <AdminHeader title="Analytics" breadcrumb="Overview" onRefresh={load} />
      <div className="page">
        {error && <div className="msg msg-error">{error}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading analytics…</div>
        ) : (
          <>
            {/* Summary strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--primary-bg)' }}>
                    <Users size={16} style={{ color: 'var(--primary)' }} />
                  </div>
                </div>
                <p className="kpi-value">{totalStudents.toLocaleString()}</p>
                <p className="kpi-label">Total Students</p>
                <p className="kpi-sub">{data?.students?.verified} verified</p>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--success-bg)' }}>
                    <Code size={16} style={{ color: 'var(--success)' }} />
                  </div>
                </div>
                <p className="kpi-value">{totalSolved.toLocaleString()}</p>
                <p className="kpi-label">Total Problems Solved</p>
                <p className="kpi-sub">Across all platforms</p>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'oklch(0.65 0.18 240 / 0.12)' }}>
                    <TrendingUp size={16} style={{ color: 'var(--cf)' }} />
                  </div>
                </div>
                <p className="kpi-value">{data?.students?.active7d ?? '—'}</p>
                <p className="kpi-label">Active This Week</p>
                <p className="kpi-sub">Had synced data in 7d</p>
              </div>
              <div className="kpi-card">
                <div className="kpi-top">
                  <div className="kpi-icon" style={{ background: 'var(--warning-bg)' }}>
                    <BarChart2 size={16} style={{ color: 'var(--warning)' }} />
                  </div>
                </div>
                <p className="kpi-value">{data?.students?.newThisMonth ?? '—'}</p>
                <p className="kpi-label">New This Month</p>
                <p className="kpi-sub">{data?.students?.newThisWeek ?? 0} this week</p>
              </div>
            </div>

            {/* Per-platform breakdown */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Platform Breakdown</span>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Platform</th>
                      <th style={{ textAlign: 'right' }}>Linked Students</th>
                      <th style={{ textAlign: 'right' }}>% of Total</th>
                      <th style={{ textAlign: 'right' }}>Avg Solved / Student</th>
                      <th style={{ textAlign: 'right' }}>Total Solved</th>
                      <th style={{ textAlign: 'right' }}>Avg Rating</th>
                      <th style={{ textAlign: 'right' }}>Peak Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PLATFORM_ORDER.map(p => {
                      const d        = platformSummary[p] || {}
                      const coverage = totalStudents > 0 ? Math.round((d.students / totalStudents) * 100) : 0
                      const isHR     = p === 'hackerrank'
                      return (
                        <tr key={p}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLATFORM_COLORS[p] }} />
                              <span style={{ fontWeight: 600 }}>{PLATFORM_LABELS[p]}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>{(d.students || 0).toLocaleString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                              <div style={{ width: 60, height: 4, background: 'var(--muted)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{ width: `${coverage}%`, height: '100%', background: PLATFORM_COLORS[p], borderRadius: 2 }} />
                              </div>
                              <span style={{ fontSize: '0.8rem', color: 'var(--fg-muted)', minWidth: 32 }}>{coverage}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isHR
                              ? <span title="Avg badge stars per linked student">{d.avg_solved_per_student > 0 ? d.avg_solved_per_student.toFixed(1) : '—'} ⭐/stu</span>
                              : (d.avg_solved_per_student > 0 ? d.avg_solved_per_student.toFixed(1) : '—')}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isHR
                              ? <span title="Total HackerRank badge stars">{(d.badges || 0).toLocaleString()} 🏅</span>
                              : (d.solved || 0).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', color: PLATFORM_COLORS[p], fontWeight: 600 }}>
                            {d.avg_rating ? Math.round(d.avg_rating) : '—'}
                          </td>
                          <td style={{ textAlign: 'right', color: PLATFORM_COLORS[p], fontWeight: 600 }}>
                            {d.max_rating ? Math.round(d.max_rating) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Charts */}
            <div className="grid-2">
              <PlatformComparisonChart data={data?.platforms} />
              <BranchDistributionChart data={branchDist} />
            </div>
          </>
        )}
      </div>
    </>
  )
}
