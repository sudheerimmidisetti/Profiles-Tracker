import { useState, useEffect, useCallback } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import StudentsTable from '../components/StudentsTable'

const FILTERS = [
  { label: 'All',         value: 'all' },
  { label: 'Verified',    value: 'verified' },
  { label: 'Unverified',  value: 'unverified' },
  { label: 'Blocklisted', value: 'blocklisted' },
]

export default function StudentsPage() {
  const [students, setStudents] = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(1)
  const [filter,   setFilter]   = useState('all')
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (filter === 'verified')   params.verified    = true
    if (filter === 'unverified') params.verified    = false
    if (filter === 'blocklisted') params.blocklisted = true

    adminAPI.listStudents(params)
      .then(r => { setStudents(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, filter])

  useEffect(() => { load() }, [load])

  return (
    <>
      <AdminHeader title="All Students" breadcrumb="Management" onRefresh={load} />
      <div className="page">
        {/* Filter bar */}
        <div className="filter-bar">
          <span className="filter-label">Filter:</span>
          <div className="filter-pills">
            {FILTERS.map(f => (
              <button
                key={f.value}
                className={`f-pill${filter === f.value ? ' active' : ''}`}
                onClick={() => { setFilter(f.value); setPage(1) }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="loading-center"><div className="spinner" /> Loading students…</div>
        ) : (
          <StudentsTable
            students={students}
            total={total}
            page={page}
            onPageChange={setPage}
            onRefresh={load}
          />
        )}
      </div>
    </>
  )
}
