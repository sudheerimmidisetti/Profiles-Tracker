import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import StudentsTable from '../components/StudentsTable'
import { ShieldOff } from 'lucide-react'

export default function BlocklistPage() {
  const [students, setStudents] = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    adminAPI.listStudents({ page, limit: 20, blocklisted: true })
      .then(r => { setStudents(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { load() }, [load])

  return (
    <>
      <AdminHeader title="Blocked Students" breadcrumb="Management" onRefresh={load} />
      <div className="page">
        {total === 0 && !loading && (
          <div className="empty-state">
            <ShieldOff size={32} style={{ color: 'var(--fg-subtle)' }} />
            <p className="empty-title">No blocked students</p>
            <p style={{ fontSize: '0.78rem', color: 'var(--fg-subtle)' }}>
              Students can be blocked from their profile page.
            </p>
          </div>
        )}

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading…</div>
        ) : total > 0 ? (
          <>
            <div className="filter-bar">
              <span className="count-badge">{total} blocked student{total !== 1 ? 's' : ''}</span>
            </div>
            <StudentsTable
              students={students}
              total={total}
              page={page}
              onPageChange={setPage}
              onRefresh={load}
            />
          </>
        ) : null}
      </div>
    </>
  )
}
