import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import KPICards from '../components/KPICards'
import ConsistencyLeaderboard from '../components/ConsistencyLeaderboard'
import { PlatformComparisonChart, BranchDistributionChart } from '../components/PlatformCharts'

export default function OverviewPage() {
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    adminAPI.listStudents({ limit: 1000 })
      .then(r => setStudents(r.data.data || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Compute stats
  const stats = {
    total:      students.length,
    verified:   students.filter(s => s.is_verified).length,
    blocked:    students.filter(s => s.is_blocklisted).length,
    activeWeek: students.filter(s => s.active_this_week).length,
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
              <PlatformComparisonChart data={null} />
              <BranchDistributionChart data={branchDist} />
            </div>

            <ConsistencyLeaderboard />
          </>
        )}
      </div>
    </>
  )
}
