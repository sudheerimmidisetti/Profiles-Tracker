import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import KPICards from '../components/KPICards'
import { PlatformComparisonChart, BranchDistributionChart } from '../components/PlatformCharts'
import RecentStudentsTable from '../components/RecentStudentsTable'
import SyncButton from '../components/SyncButton'

export default function OverviewPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    adminAPI.overview()
      .then(r => setData(r.data.data))
      .catch(e => setError(e.response?.data?.message || 'Failed to load overview'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const stats = data ? {
    total:        data.students.total,
    verified:     data.students.verified,
    blocked:      data.students.blocked,
    newThisWeek:  data.students.newThisWeek,
    newThisMonth: data.students.newThisMonth,
    active7d:     data.students.active7d,
  } : null

  const branchDist = data?.branchDist?.reduce((acc, r) => {
    acc[r.branch] = parseInt(r.count, 10)
    return acc
  }, {}) ?? {}

  return (
    <>
      <AdminHeader title="Dashboard" onRefresh={load} extra={<SyncButton />} />
      <div className="page">
        {error && <div className="msg msg-error">{error}</div>}

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading dashboard…</div>
        ) : (
          <>
            <KPICards stats={stats} />

            <div className="grid-2">
              <PlatformComparisonChart data={data?.platforms} />
              <BranchDistributionChart data={branchDist} />
            </div>

            {data?.recentStudents?.length > 0 && (
              <RecentStudentsTable students={data.recentStudents} />
            )}
          </>
        )}
      </div>
    </>
  )
}
