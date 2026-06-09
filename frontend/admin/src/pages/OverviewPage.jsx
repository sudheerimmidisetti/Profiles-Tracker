import { useState, useEffect, useCallback } from 'react'
import { adminAPI, leaderboardAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import KPICards from '../components/KPICards'
import ConsistencyLeaderboard from '../components/ConsistencyLeaderboard'
import { PlatformComparisonChart, BranchDistributionChart } from '../components/PlatformCharts'

export default function OverviewPage() {
  const [students,     setStudents]     = useState([])
  const [platformData, setPlatformData] = useState(null)
  const [loading,      setLoading]      = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      adminAPI.listStudents({ limit: 1000 }),
      // Fetch top-1 per platform to get counts (total field)
      leaderboardAPI.get('leetcode',   'all', 1, 1),
      leaderboardAPI.get('codeforces', 'all', 1, 1),
      leaderboardAPI.get('codechef',   'all', 1, 1),
      leaderboardAPI.get('hackerrank', 'all', 1, 1),
    ])
      .then(([studRes, lc, cf, cc, hr]) => {
        const studs = studRes.data.data || []
        setStudents(studs)
        setPlatformData({
          leetcode:   { students: lc.data.total   || 0, solved: 0 },
          codeforces: { students: cf.data.total   || 0, solved: 0 },
          codechef:   { students: cc.data.total   || 0, solved: 0 },
          hackerrank: { students: hr.data.total   || 0, solved: 0 },
        })
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Compute stats — active_this_week: students verified within last 7 days (proxy)
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const stats = {
    total:      students.length,
    verified:   students.filter(s => s.is_verified).length,
    blocked:    students.filter(s => s.is_blocklisted).length,
    activeWeek: students.filter(s => s.is_verified && new Date(s.created_at) > oneWeekAgo).length,
  }

  // Branch distribution
  const branchDist = students.reduce((acc, s) => {
    const b = s.branch || 'Other'
    acc[b] = (acc[b] || 0) + 1
    return acc
  }, {})

  return (
    <>
      <AdminHeader title="Dashboard" onRefresh={load} />
      <div className="page">
        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading dashboard…</div>
        ) : (
          <>
            <KPICards stats={stats} />

            <div className="grid-2">
              <PlatformComparisonChart data={platformData} />
              <BranchDistributionChart data={branchDist} />
            </div>

            <ConsistencyLeaderboard />
          </>
        )}
      </div>
    </>
  )
}
