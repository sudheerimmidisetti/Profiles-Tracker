import { useState, useEffect, useCallback, useRef } from 'react'
import { adminAPI } from '../api/api'
import AdminHeader from '../components/AdminHeader'
import StudentsTable from '../components/StudentsTable'
import { Search, X } from 'lucide-react'

const FILTERS = [
  { label: 'All',         value: 'all' },
  { label: 'Verified',    value: 'verified' },
  { label: 'Unverified',  value: 'unverified' },
  { label: 'Blocklisted', value: 'blocklisted' },
]

export default function StudentsPage() {
  const [students,  setStudents]  = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(1)
  const [filter,    setFilter]    = useState('all')
  const [search,    setSearch]    = useState('')
  const [loading,   setLoading]   = useState(true)
  const searchRef = useRef(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = { page, limit: 20 }
    if (filter === 'verified')    params.verified    = true
    if (filter === 'unverified')  params.verified    = false
    if (filter === 'blocklisted') params.blocklisted = true
    if (search.trim())            params.search      = search.trim()

    adminAPI.listStudents(params)
      .then(r => { setStudents(r.data.data || []); setTotal(r.data.total || 0) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, filter, search])

  useEffect(() => { load() }, [load])

  const handleSearch = (val) => { setSearch(val); setPage(1) }
  const clearSearch  = ()    => { setSearch('');  setPage(1); searchRef.current?.focus() }

  return (
    <>
      <AdminHeader title="Students" breadcrumb="Management" onRefresh={load} />
      <div className="page">
        {/* Toolbar */}
        <div className="toolbar">
          {/* Search */}
          <div className="search-box">
            <Search size={14} className="search-box-ico" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search name, email, roll, branch…"
              value={search}
              onChange={e => handleSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={clearSearch}><X size={13} /></button>
            )}
          </div>

          {/* Filter pills */}
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

          <span className="count-badge">{total.toLocaleString()} students</span>
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
